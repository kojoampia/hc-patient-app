/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/membership-stream.service.ts @ 7481b5b
 * Divergence: two, both mobile-specific and both load-bearing — see the class doc's "What is
 *   different on this app" section. (1) The body is read through `window.CapacitorWebFetch`, the
 *   original webview fetch the Capacitor bridge saves before CapacitorHttp patches `window.fetch`
 *   onto the native client — the patched fetch cannot stream a response body and would hang on an
 *   SSE response for ever, silently. See {@link resolveStreamFetch}. (2) The token comes from
 *   `SessionTokenService`'s signal rather than `StateStorageService`, because on this app the token
 *   LEAVES MEMORY on every lock: the stream suspends while it is gone and resumes when it returns,
 *   where the web client treats a missing token as the end of the session — including a
 *   post-headers re-check inside connect(), because a lock landing between the response settling
 *   and its continuation would otherwise turn into a sign-out. Started and stopped by `TabsPage`
 *   rather than `ShellComponent`.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, effect, inject, untracked } from '@angular/core';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { SessionTokenService } from 'app/core/native/session-token.service';
import { PatientContextService } from './patient-context.service';

/**
 * The `event:` line the api puts on a membership frame — `MembershipChangedEvent.TYPE`.
 *
 * <p>A literal on the wire in two repositories, so a rename there is not a compile error here; it is a frame this
 * client silently stops recognising. Asserted as a literal on both sides for that reason.</p>
 */
export const MEMBERSHIP_CHANGED_EVENT = 'MembershipChanged';

/**
 * What the server promises when the stream is idle — `MembershipStreamRegistry.DEFAULT_HEARTBEAT_SECONDS`.
 *
 * <p>It is here to be divided into {@link SILENCE_TIMEOUT_MS} rather than to be used directly: this client never waits
 * 25 seconds for anything, it only needs to know what "too quiet" means.</p>
 */
export const SERVER_HEARTBEAT_MS = 25_000;

/**
 * How long silence is allowed to last before the connection is assumed dead.
 *
 * <p>Derived rather than chosen, because the only liveness signal this stream has is the heartbeat: nothing else
 * arrives on an idle line, and a membership can sit `PENDING` for as long as the back office takes. Two beats plus
 * slack, so one lost beat costs nothing and two mean something is genuinely wrong. That derivation is the whole
 * reason for the number.</p>
 *
 * <p>On this app the watchdog also carries the <b>short resume</b>: Android kills a backgrounded app's connections
 * at the OS level, and a resume inside `LONG_ABSENCE_MS` (app-lifecycle.service.ts) never locks, so nothing else
 * notices the line is dead. The webview's timers are paused while backgrounded, so this fires within one timeout of
 * the resume — which bounds how stale the screen can be after a short absence.</p>
 */
export const SILENCE_TIMEOUT_MS = SERVER_HEARTBEAT_MS * 2 + 10_000;

/**
 * How long to wait before each successive reconnect, the last rung repeating for ever.
 *
 * <p>`EventSource` would have given this away free. It cannot send an `Authorization` header, and putting a token
 * carrying patient scope in a query string writes it into nginx access logs and every proxy in between — so the
 * whole of reconnect and backoff is hand-written, and this ladder is the cost of keeping the header
 * (backlog item 39).</p>
 */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 15_000, 30_000];

/** An SSE block is terminated by a blank line; all three line terminators are legal ahead of it. */
const BLOCK_BOUNDARY = /\r\n\r\n|\n\n|\r\r/;

/** Within a block, the same three. */
const LINE_BOUNDARY = /\r\n|\n|\r/;

/** The whole of what this stream needs from a fetch, named so the selection below has a shape to return. */
type StreamFetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * The fetch this stream reads through, and THE ONE MOBILE-SPECIFIC DEFECT THIS FUNCTION EXISTS AROUND.
 *
 * <p><b>`CapacitorHttp.enabled` patches `window.fetch` onto the native HTTP client, and the native client cannot
 * stream a response body.</b> Its only `ReadableStream` handling (`convertBody` in
 * `@capacitor/android/…/native-bridge.js`) is on the <em>request</em> side; a response is buffered whole and
 * returned when it ends. An SSE response never ends — so under the patched fetch the promise never resolves, no
 * error is thrown, no frame arrives, and the client looks connected while hearing nothing, for ever. That is the
 * worst possible failure shape, and no browser-based test can see it because the patch only exists on device.</p>
 *
 * <p>The bridge saves the ORIGINAL webview fetch as `window.CapacitorWebFetch` before patching, and uses it itself
 * for same-origin requests. That original streams normally and is the supported escape hatch, so it is what this
 * returns whenever it exists. On the web build and under Jest the bridge never ran, the hatch is undefined, and
 * this is plain `fetch` — the exact code path the web client uses.</p>
 *
 * <p>⛔ <b>Do not "simplify" this back to a bare `fetch()`.</b> Under the patch that reintroduces the silent hang,
 * and it will pass every test in this repo while doing so.</p>
 *
 * <p>⚠ <b>What this costs on device, recorded rather than hidden:</b> the webview's own fetch is subject to CORS,
 * which the native client never is — and that asymmetry is exactly why `CapacitorHttp` is enabled at all
 * (capacitor.config.ts: the gateway has CORS deliberately disabled and would refuse every preflight). This one
 * request therefore goes cross-origin from `https://localhost` to the gateway with an `Authorization` header, which
 * demands a preflight the gateway does not currently answer. Until the gateway allows the app origin on this route,
 * an on-device connect is expected to be <em>refused</em> — which lands in the ordinary failure path below: the
 * fetch rejects, the ladder bounds retries at its top rung, and nothing hangs. A visible, bounded failure that
 * starts working the moment the gateway answers, with no app release, was chosen over a silent permanent hang.</p>
 *
 * <p>Bound to `globalThis` because a detached `fetch` reference throws `Illegal invocation` when called — the
 * reason the bridge itself calls the hatch as `win.CapacitorWebFetch(...)`.</p>
 */
const resolveStreamFetch = (): StreamFetch => {
  const host = globalThis as { CapacitorWebFetch?: StreamFetch; fetch: StreamFetch };
  return (host.CapacitorWebFetch ?? host.fetch).bind(globalThis);
};

/**
 * The patient's open line to their own membership: an administrator verifies their plan and the screen changes
 * without them touching it.
 *
 * <p>Backlog item 39 cycle 3, the mobile half of the client cycle 2 built for the web — `GET
 * /api/membership-events`, streamed through the gateway, filtered server-side by `PatientScope`. <b>There is no
 * filtering here and there must not be.</b> A frame this client receives is a frame it was entitled to receive;
 * deciding again on this side would be a second implementation of a rule the api already owns, in the one place it
 * cannot be enforced.</p>
 *
 * <h2>`fetch` rather than `EventSource`, and what that costs</h2>
 *
 * <p>`EventSource` cannot set request headers, so it cannot send the bearer token `auth.interceptor.ts` puts on
 * every other call. The alternative — the token in the query string — is not available: it would put a JWT carrying
 * patient scope into nginx access logs and any proxy between. So this reads the body through a
 * {@link ReadableStream} instead, and pays for the header by hand-writing everything `EventSource` does for free:
 * framing, reconnect, backoff and liveness. That trade was made deliberately in item 39 and is not open here.</p>
 *
 * <h2>It carries no state, on purpose</h2>
 *
 * <p>A frame says "something about your membership changed" and nothing else is read from it — not even parsed. The
 * push carries identifiers only and the client re-fetches: the reaction to a frame is
 * {@link PatientContextService#reload}, which is what every other screen in the portal already goes through. Two
 * things follow. A payload change in the api cannot break this client, because it never looks inside `data:`. And
 * the re-fetch goes back through `HttpClient`, so it carries the interceptors' `Authorization` and `X-Acting-As`
 * and is scoped exactly as any other read is — the stream decides <em>when</em> to ask, never <em>what</em> the
 * answer is. (This also keeps the stream on the right side of §8.4 trap 1: the raw fetch below carries the token by
 * hand and nothing else, and every request that reads actual data still rides the interceptor chain.)</p>
 *
 * <h2>Three properties of this stream that break a naive reader</h2>
 *
 * <ol>
 *   <li><b>The first thing that ever arrives is a comment.</b> The api flushes `:connected` as the stream opens. A
 *     reader that treats the first blank-line-delimited block as an event and parses its `data:` chokes on byte
 *     one. Comments are handled from the first block by {@link dispatch}, which is also where `:keep-alive`
 *     lands.</li>
 *   <li><b>The server ends every stream after thirty minutes, by design.</b> It bounds the visibility decision
 *     `PatientScope` froze at connect. That arrives as a clean end of body, and is <b>not</b> a failure — see
 *     {@link reconnect}.</li>
 *   <li><b>Silence longer than two heartbeats is the only evidence available that the line is dead.</b> A TCP
 *     connection dropped by a proxy, a sleeping device or Android reclaiming a backgrounded app's sockets produces
 *     no event this client can see; it just stops. {@link SILENCE_TIMEOUT_MS} is the watchdog.</li>
 * </ol>
 *
 * <h2>Why it re-fetches on every connect</h2>
 *
 * <p>The stream does not replay. A client disconnected across an activation would otherwise miss it and sit on
 * "Awaiting confirmation" until the patient restarted the app — which is the entire defect item 39 exists to fix,
 * reintroduced through the back door of a dropped connection. Re-fetching on connect makes the push an optimisation
 * rather than the only path, and it is why the thirty-minute close is harmless.</p>
 *
 * <h2>What is different on this app: the stream follows the token</h2>
 *
 * <p>On this app the in-memory token is routinely <em>absent while the session is alive</em>, which the web never
 * is: `AppLockService` subscribes to `resumed$` and locks on every cold start and long resume, and a lock clears
 * the in-memory token while leaving the disk copy alone (`SessionTokenService.lock()`). Backgrounding also kills
 * this connection at the OS level — so resume is the common case here, not an edge one, and a stream that
 * reconnected blindly on resume would fire request after request with no token, exactly the shape
 * `app-lock.service.ts` records being bitten by ("Running the fork before the token is back in memory means every
 * request in it goes out unauthenticated").</p>
 *
 * <p>So the lifecycle is driven by two things and nothing else:</p>
 *
 * <ul>
 *   <li><b>The shell.</b> `TabsPage` calls {@link start} and {@link stop}, exactly as the web's `ShellComponent`
 *     does — the stream's lifetime is the portal's, and it never runs for the sign-in, lock or dead-end
 *     screens.</li>
 *   <li><b>The token signal.</b> The constructor's effect suspends the stream the moment the token leaves memory —
 *     aborting the connection and cancelling every pending timer, so a locked app issues <em>nothing</em>, not even
 *     a scheduled retry — and resumes it the moment the token returns, which `AppLockService.unlock()` does
 *     <em>before</em> navigating back into the shell. The reconnect's {@link connect} then calls `reload()`, so
 *     whatever changed while the app was away is picked up at the unlock, not a watchdog-timeout later.</li>
 * </ul>
 *
 * <p>It deliberately does <b>not</b> subscribe to `resumed$` or `appStateChange`. `resumed$` emits only cold-start
 * and long-resume, and both of those arrive here as the token leaving and returning anyway; racing the lock for the
 * raw event would sometimes reconnect with a token the lock was about to clear, leaving an authenticated stream
 * open behind the lock screen. A short resume never locks, so the token never moves and nothing here fires — the
 * OS-killed connection is caught by the silence watchdog instead, which bounds the staleness. Following the token
 * also means this does not care whether Ionic destroys `TabsPage` on the `/lock` navigation, which is exactly the
 * kind of framework behaviour that changes between versions.</p>
 */
@Injectable({ providedIn: 'root' })
export class MembershipStreamService {
  private readonly applicationConfigService = inject(ApplicationConfigService);
  private readonly sessionToken = inject(SessionTokenService);
  private readonly context = inject(PatientContextService);

  private readonly url = this.applicationConfigService.getEndpointFor('api/membership-events', 'hcpatientservice');

  /**
   * Whether {@link start} has been called and {@link stop} has not — whether the shell wants the stream.
   *
   * <p>The web calls this `running`, and there wanting is having: no token means the session is over. Here the two
   * come apart — a locked app still <em>wants</em> the stream and must not <em>have</em> it — so the name says
   * which half this field carries. `enabled && hasToken` is when a connection may exist.</p>
   */
  private enabled = false;

  /**
   * The controller for the connection in flight, or null between attempts.
   *
   * <p>Also the identity of an attempt: a continuation that finds a different controller here belongs to a
   * connection that has already been replaced, and must do nothing rather than schedule a second reconnect.</p>
   */
  private controller: AbortController | null = null;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Which rung of {@link RECONNECT_DELAYS_MS} the next failure waits for. */
  private rung = 0;

  constructor() {
    /**
     * THE LOCK INTERACTION, in one place. Token gone — a lock, or a sign-out — means suspend now:
     * not on the next failed request, and not by letting a pending retry fire into a 401. Token
     * back means reconnect now, with the reload on connect standing in for everything missed.
     * Everything it calls is guarded by {@link enabled}, so this does nothing outside the shell.
     */
    effect(() => {
      const hasToken = this.sessionToken.hasToken();
      untracked(() => {
        if (!hasToken) {
          this.suspend();
        } else if (this.enabled && this.controller === null && this.reconnectTimer === null) {
          void this.connect();
        }
      });
    });
  }

  /** Opens the stream, if it is not already open. Safe to call twice; the second call does nothing. */
  start(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    void this.connect();
  }

  /**
   * Closes the stream and cancels anything pending.
   *
   * <p>Not optional and not merely tidy. An abandoned reader holds an open connection to the gateway for as long as
   * the process lives, goes on calling {@link PatientContextService#reload} on a service every screen shares, and
   * fails nothing while it does — which is exactly the kind of leak that is never noticed.</p>
   */
  stop(): void {
    this.enabled = false;
    this.suspend();
  }

  /**
   * One connection attempt, from the request to the end of the body.
   *
   * <p>The `fetch` promise resolving <em>is</em> the "connected" signal: it settles when the response headers
   * arrive, which item 63 made happen on connect rather than on the first heartbeat. A stream that answered its
   * headers and then went quiet is still caught, by the watchdog {@link read} arms before its first read.</p>
   */
  private async connect(): Promise<void> {
    const token = this.sessionToken.get();
    if (!token) {
      // Locked, or signed out. Issue nothing — not a request, not a retry timer. The web client declares the
      // session over here; on this app a missing token is routinely temporary (every long resume goes through it),
      // so the stream stays wanted and the constructor's effect reopens it the moment the token is back in memory.
      return;
    }

    const controller = new AbortController();
    this.controller = controller;

    let response: Response;
    try {
      response = await resolveStreamFetch()(this.url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
        // A cached event stream is a contradiction, and a stale one would be replayed as though it were new.
        cache: 'no-store',
      });
    } catch {
      this.reconnect(controller);
      return;
    }

    if (this.controller !== controller) {
      // Superseded, stopped, or a lock whose suspension has already flushed. Whoever nulled the field also
      // aborted this connection, so there is nothing left to close — only a continuation that must not act. The
      // web client has the same microtask-sized window against stop() and wears it; here a lock makes it real.
      return;
    }

    if (!this.sessionToken.hasToken()) {
      // The token left memory between the headers arriving and this continuation running, and the suspension has
      // NOT flushed yet: lock() clears the signal synchronously, but the effect that suspends runs on the
      // scheduler's tick, and nothing here may depend on which of the two beats a microtask. The identity check
      // above only detects a suspension that already happened; this one holds regardless of ordering.
      //
      // What it prevents is not a stale screen but a destroyed session: the reload below would go out through
      // HttpClient with no token to attach, the gateway would 401, and auth-expired.interceptor.ts treats any 401
      // while the account still looks signed in as an expired session — clearing the token FROM THE STORE, not
      // merely from memory. A lock deliberately leaves the store intact so the unlock restores the session; this
      // path would silently turn every unluckily-timed lock into a sign-out, and the user would biometric-unlock
      // into /login. Suspending here rather than bare-returning also closes the connection this attempt just
      // opened, so a lock-and-unlock that coalesces into a single effect run cannot leave it dangling unread.
      this.suspend();
      return;
    }

    if (!response.ok || !response.body) {
      // Includes the expired-token case. Retrying is bounded by the ladder's top rung rather than special-cased:
      // `auth-expired.interceptor.ts` signs the session out on the next ordinary request, and the shell's teardown
      // stops this.
      this.reconnect(controller);
      return;
    }

    // Connected. The ladder resets here rather than on the first frame, because a frame may be half an hour away —
    // and this one line is also the whole of "the thirty-minute close is not a failure": a close can only follow a
    // connection that worked, so the ladder is always back at its first rung by the time one arrives. Deleting it
    // makes a long-lived session reconnect later and later for ever, having never had anything go wrong. See
    // reconnect().
    this.rung = 0;
    // The stream does not replay, so this is what guarantees a change made while this client was disconnected is
    // not missed — including everything that happened while the app was backgrounded or locked. See the class doc.
    this.context.reload();
    await this.read(response.body.getReader(), controller);
  }

  /**
   * Reads the body until it ends, breaks, or goes quiet, and frames what arrives.
   *
   * <p>Chunk boundaries are not frame boundaries: a block can arrive split across two reads, and two blocks can
   * arrive in one. The partial tail is kept in `buffer` and completed by the next chunk. `TextDecoder` is given
   * `{ stream: true }` for the same reason one level down — a multi-byte character can straddle a chunk.</p>
   */
  private async read(reader: ReadableStreamDefaultReader<Uint8Array>, controller: AbortController): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    this.armSilenceWatchdog(controller);

    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // The connection broke, or the watchdog aborted it, or stop() or a lock did. The guard in reconnect()
        // drops the last two cases; the other two are the same thing to this client.
        this.reconnect(controller);
        return;
      }

      if (chunk.done) {
        // The server completed the stream — the thirty-minute maximum age, or a restart. See reconnect().
        this.reconnect(controller);
        return;
      }

      // Any bytes at all count as alive — a keep-alive comment is exactly as good as a frame, which is the point
      // of sending one.
      this.armSilenceWatchdog(controller);

      // Everything done with the bytes is inside a try, and the reason is not defensiveness.
      //
      // This block is the one place in the loop that runs application code — dispatch() reaches
      // PatientContextService.reload(), and through it every subscriber of the portal's shared pipelines. A
      // synchronous throw from any of them lands here, and without this catch it rejects read(), propagates
      // through connect(), and dies in `void this.connect()` as an unhandled rejection: nothing schedules a
      // reconnect, `enabled` stays true so start() will not open another, and the watchdog fires once into a void
      // sixty seconds later. The stream is then dead for the life of the process and NOTHING SAYS SO — which is
      // exactly the failure stop()'s doc describes, arrived at from the other direction.
      //
      // Treating it as a failed connection is the right answer rather than a convenient one: the reconnect
      // re-fetches, so the change whose handling threw is picked up anyway, and any blocks after the throwing one
      // are re-derived from the server rather than guessed at here.
      try {
        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split(BLOCK_BOUNDARY);
        // The last piece is whatever follows the final blank line: either empty, or a block still arriving.
        buffer = blocks.pop() ?? '';
        blocks.forEach(block => this.dispatch(block));
      } catch {
        this.reconnect(controller);
        return;
      }
    }
  }

  /**
   * Acts on one complete SSE block.
   *
   * <p><b>A block carrying only comments is the ordinary case here, not an edge case.</b> The first block of every
   * stream is `:connected` and every idle 25 seconds produces `:keep-alive`; a reader that assumes a block has a
   * `data:` line fails on the first thing the server ever sends it.</p>
   *
   * <p>Only the `event:` field is read. `data:` is deliberately never parsed — see the class doc — and an event
   * this client does not recognise is ignored rather than treated as a change, so a second kind of push (which the
   * api's frame is typed to allow) cannot make the portal re-fetch on something that has nothing to do with it.</p>
   */
  private dispatch(block: string): void {
    let name = '';
    for (const line of block.split(LINE_BOUNDARY)) {
      if (line === '' || line.startsWith(':')) {
        continue;
      }
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      if (field === 'event') {
        // One optional space after the colon belongs to the framing rather than to the value.
        name = (colon === -1 ? '' : line.slice(colon + 1)).replace(/^ /, '');
      }
    }
    if (name === MEMBERSHIP_CHANGED_EVENT) {
      this.context.reload();
    }
  }

  /**
   * Schedules the next attempt, or does nothing if this connection has already been superseded or stopped.
   *
   * <h3>Why the server's own close and a broken connection come here by the same door</h3>
   *
   * <p>They are told apart, and the place that tells them apart is {@link connect}, which resets the ladder the
   * moment a connection succeeds. The api completes every stream at thirty minutes deliberately, to bound the
   * visibility it froze at connect — so an end of body always follows a connection that worked, the ladder is
   * therefore already back at its first rung when it arrives, and a long-lived session reconnects in a second
   * however many times it renews. A stream that never connected cannot end; it can only fail.</p>
   *
   * <p>Cycle 2 proved by mutation that a `reason` parameter distinguishing the two here changes nothing — every
   * close in a real sequence is followed by a connect that resets the ladder anyway — and that carrying one makes
   * the real guard look tested when it is not. So there isn't one, on either client.</p>
   *
   * <p>A close still waits the first rung rather than reconnecting instantly. One second is invisible half an hour
   * in, and it is what bounds a server that is completing streams as fast as it opens them — a restart does exactly
   * that, and an instant reconnect would answer it with a request per round trip.</p>
   */
  private reconnect(controller: AbortController): void {
    if (!this.enabled || this.controller !== controller) {
      // The second half also covers the lock: suspend() nulls the controller, so a continuation of the connection
      // it aborted lands here and dies quietly instead of scheduling a retry the lock just cancelled.
      return;
    }
    this.clearSilenceWatchdog();
    this.controller = null;
    // Three of the four ways in here leave nothing to close — the connection had already broken, ended, or been
    // aborted by the watchdog. The fourth does not: a throw out of dispatch() abandons a connection that is still
    // perfectly alive, and without this it would stay open to the gateway for the life of the process while a
    // second one was opened beside it. Aborting something already finished is a no-op, and the pending read this
    // rejects comes back to the guard above and stops there.
    controller.abort();

    const delayMs = RECONNECT_DELAYS_MS[this.rung];
    this.rung = Math.min(this.rung + 1, RECONNECT_DELAYS_MS.length - 1);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  /**
   * Tears the connection down and cancels everything pending, without giving up the claim to run.
   *
   * <p>This is the web's `stop()` body, factored out because on this app it has two callers meaning two different
   * things: {@link stop}, after which nothing restarts the stream until the shell does, and the constructor's
   * token effect, after which the same effect restarts it the moment the token is back. The rung reset makes a
   * resume connect on the first rung — an unlock is a human act, not a retry loop, and the failures the ladder was
   * climbing about belonged to a connection that no longer exists.</p>
   */
  private suspend(): void {
    this.rung = 0;
    this.clearSilenceWatchdog();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Aborting errors the body stream, so the pending read() rejects and the loop above unwinds.
    this.controller?.abort();
    this.controller = null;
  }

  /**
   * Restarts the dead-connection timer.
   *
   * <p>Armed before the first read rather than after it, so a response whose headers arrived and whose body never
   * does is caught too — which is the shape the endpoint this listens to had before item 63.</p>
   */
  private armSilenceWatchdog(controller: AbortController): void {
    this.clearSilenceWatchdog();
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      // Aborting rejects the pending read, so the failure path is the one the loop already has rather than a
      // second one written here. Silence is a failure and escalates, unlike a close.
      controller.abort();
    }, SILENCE_TIMEOUT_MS);
  }

  private clearSilenceWatchdog(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
