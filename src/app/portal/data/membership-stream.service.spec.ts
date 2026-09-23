/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/membership-stream.service.spec.ts @ 7481b5b
 * Divergence: the StateStorageService stub becomes a FakeSessionToken built on a real signal,
 *   because the mobile service reacts to the token LEAVING and RETURNING (lock/unlock), not just to
 *   its value at connect; `settle()` also ticks TestBed so the token effect flushes. Five tests are
 *   mobile-only: the CapacitorWebFetch selection (and that the patched fetch is never used), the
 *   lock suspending the stream, no reconnect firing while locked, the unlock resuming with the
 *   fresh token, and a start with no token waiting rather than dying. The web's "does not connect
 *   at all without a token" is folded into that last one — its absence-only half is satisfied by a
 *   dead client, which cycle 2's own record warns about.
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';

import { SessionTokenService } from 'app/core/native/session-token.service';
import { PatientContextService } from './patient-context.service';
import { MEMBERSHIP_CHANGED_EVENT, MembershipStreamService, SERVER_HEARTBEAT_MS, SILENCE_TIMEOUT_MS } from './membership-stream.service';

const encoder = new TextEncoder();

/**
 * Exactly what the api flushes as the stream opens, byte for byte.
 *
 * <p>Read off the wire on 2026-09-18 against the quality stack through both nginx hops — `:connected\n\n` then
 * `:keep-alive\n\n`, LF only, no space after the colon. It is written out here rather than built from the constants
 * because the point of these tests is that the client survives what the server actually sends.</p>
 */
const CONNECTED_COMMENT = ':connected\n\n';
const KEEP_ALIVE_COMMENT = ':keep-alive\n\n';

/** A membership frame in the shape `MembershipStreamRegistry.deliver` builds: an id, a name, and JSON data. */
const membershipFrame = (membershipId = 'm1', status = 'ACTIVE'): string =>
  `id:e-${membershipId}\nevent:${MEMBERSHIP_CHANGED_EVENT}\n` +
  `data:{"eventId":"e-${membershipId}","type":"${MEMBERSHIP_CHANGED_EVENT}","patientId":"p1",` +
  `"membershipId":"${membershipId}","status":"${status}"}\n\n`;

/**
 * One response body, standing in for a connected server.
 *
 * <p>Deliberately not a real `ReadableStream`: what these tests need is the four things a server can do to a
 * connected client — write, go quiet, end the stream cleanly, and break — each as a method a test can call at a
 * moment of its choosing. jsdom has no `fetch` and no body to borrow either way.</p>
 */
class FakeBody {
  private waiting: { resolve: (result: ReadableStreamReadResult<Uint8Array>) => void; reject: (error: unknown) => void } | null = null;

  private readonly queued: ReadableStreamReadResult<Uint8Array>[] = [];

  /** True once the client aborted the request, which is what teardown, a lock and the silence watchdog all do. */
  cancelled = false;

  // `abortSignal` rather than the web's `signal`: this spec imports Angular's `signal()` for the token fake, and
  // no-shadow is at error here.
  constructor(abortSignal: AbortSignal) {
    // A real abort errors the body stream, so whatever read() is outstanding rejects. Anything less and teardown
    // would look like it worked while the loop sat waiting for ever.
    abortSignal.addEventListener('abort', () => {
      this.cancelled = true;
      this.fail(new Error('aborted'));
    });
  }

  getReader(): ReadableStreamDefaultReader<Uint8Array> {
    return {
      read: (): Promise<ReadableStreamReadResult<Uint8Array>> =>
        new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
          const next = this.queued.shift();
          if (next) {
            resolve(next);
            return;
          }
          this.waiting = { resolve, reject };
        }),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;
  }

  /** The server writes bytes — a whole block, or any fragment of one. */
  writes(text: string): void {
    this.deliver({ done: false, value: encoder.encode(text) });
  }

  /** The server completes the stream. This is what the thirty-minute maximum age does, and it is not an error. */
  ends(): void {
    this.deliver({ done: true, value: undefined } as ReadableStreamReadResult<Uint8Array>);
  }

  /** The connection breaks under the client. */
  breaks(): void {
    this.fail(new Error('network'));
  }

  private deliver(result: ReadableStreamReadResult<Uint8Array>): void {
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting) {
      waiting.resolve(result);
      return;
    }
    this.queued.push(result);
  }

  private fail(error: Error): void {
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.reject(error);
  }
}

/**
 * The two halves of SessionTokenService this stream reads: the synchronous value and the signal.
 *
 * <p>Built on a real Angular signal rather than a returning stub, because what the mobile service does that the
 * web's does not is <em>react to the signal changing</em> — a lock clears it, an unlock restores it, and the tests
 * below drive exactly those transitions through {@link set}.</p>
 */
class FakeSessionToken {
  private readonly value = signal<string | null>('a.jwt.value');

  readonly hasToken = computed(() => this.value() !== null);

  get(): string | null {
    return this.value();
  }

  /** What SessionTokenService.lock() / unlock() / persist() do to the in-memory copy. */
  set(token: string | null): void {
    this.value.set(token);
  }
}

/**
 * Lets every pending promise continuation run, and flushes the token effect.
 *
 * <p><b>Jest's fake timers rather than Angular's `fakeAsync`, and that is not a preference.</b> `tsconfig.json`
 * targets ES2022, so `async`/`await` compiles to a native async function — and zone.js cannot follow a native
 * `await`. Under `fakeAsync` the continuation after `await fetch(...)` never runs at all inside the synchronous
 * test body, so the stream never appears to connect and every assertion about it is vacuous. Cycle 2 measured this
 * on the web: the first draft of its suite failed 9 of 16 that way.</p>
 *
 * <p>`TestBed.tick()` is the mobile addition: the suspend-on-lock/resume-on-unlock behaviour lives in a root
 * effect, and root effects flush on the TestBed's synchronization tick rather than on a microtask. Without it a
 * token change is a signal write nothing has read yet, and every lock test would pass vacuously against a stream
 * that never noticed.</p>
 */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    TestBed.tick();
    await Promise.resolve();
  }
};

/** Moves the fake clock, then lets whatever that started finish. */
const advance = async (ms: number): Promise<void> => {
  await jest.advanceTimersByTimeAsync(ms);
  await settle();
};

describe('MembershipStreamService', () => {
  let service: MembershipStreamService;
  let reload: jest.Mock;
  let fetchMock: jest.Mock;
  let opened: FakeBody[];
  /** What the next fetch answers with. Changed by the tests that are about a connection not being made. */
  let answers: 'stream' | 'refused' | 'unreachable';
  let sessionToken: FakeSessionToken;
  const originalFetch = globalThis.fetch;

  /** The connection the client is on now. */
  const latest = (): FakeBody => opened[opened.length - 1];

  /** Answers like the streaming server, whatever fetch implementation carries the request. */
  const answer = (init: { signal: AbortSignal }): Promise<unknown> => {
    if (answers === 'unreachable') {
      return Promise.reject(new Error('offline'));
    }
    if (answers === 'refused') {
      return Promise.resolve({ ok: false, status: 503, body: null });
    }
    const body = new FakeBody(init.signal);
    opened.push(body);
    return Promise.resolve({ ok: true, status: 200, body });
  };

  beforeEach(() => {
    // Every wait in this service is a setTimeout, so the clock is the only thing a test has to move.
    jest.useFakeTimers();
    opened = [];
    answers = 'stream';
    sessionToken = new FakeSessionToken();
    reload = jest.fn();

    fetchMock = jest.fn((_url: string, init: { signal: AbortSignal }) => answer(init));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    TestBed.configureTestingModule({
      providers: [
        { provide: PatientContextService, useValue: { reload } },
        { provide: SessionTokenService, useValue: sessionToken },
      ],
    });
    service = TestBed.inject(MembershipStreamService);
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
    // Installed by the CapacitorWebFetch tests; on a device it belongs to the bridge, here it must not leak.
    delete (globalThis as { CapacitorWebFetch?: unknown }).CapacitorWebFetch;
  });

  it('opens the stream through the gateway route, with the token in the header and nowhere else', async () => {
    service.start();
    await settle();

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    // Built through ApplicationConfigService, so the gateway's routing applies. A hardcoded service path is a
    // workspace-wide rule violation rather than a style preference.
    expect(url).toBe('services/hcpatientservice/api/membership-events');
    expect(init.headers.Authorization).toBe('Bearer a.jwt.value');
    // The whole reason EventSource was ruled out: a token in the query string is a JWT carrying patient scope
    // written into nginx access logs and every proxy in between.
    expect(url).not.toContain('a.jwt.value');

    service.stop();
  });

  it('reads through CapacitorWebFetch when the bridge has patched fetch, and never through the patch', async () => {
    /**
     * THE ONE DEFECT NO BROWSER TEST CAN SEE. On device, CapacitorHttp.enabled patches window.fetch
     * onto the native HTTP client, which has no response-body streaming: an SSE response is buffered
     * until it ends, and it never ends, so the promise never settles — modelled here literally. A
     * client built on the patched fetch looks connected and hears nothing, for ever.
     */
    const patched = jest.fn(() => new Promise<never>(() => undefined));
    globalThis.fetch = patched as unknown as typeof fetch;
    // The escape hatch the bridge itself saves before patching: the original, streaming webview fetch.
    const hatch = jest.fn((_url: string, init: { signal: AbortSignal }) => answer(init));
    (globalThis as { CapacitorWebFetch?: unknown }).CapacitorWebFetch = hatch;

    service.start();
    await settle();

    expect(hatch).toHaveBeenCalledTimes(1);
    expect(patched).not.toHaveBeenCalled();
    // The token still travels in the header on this path — the hatch bypasses the interceptor chain, so if this
    // request does not carry it by hand, nothing does.
    const [, init] = hatch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer a.jwt.value');

    // And the half a dead-or-hanging client cannot fake: bytes delivered through the hatch reach dispatch.
    latest().writes(CONNECTED_COMMENT);
    await settle();
    reload.mockClear();
    latest().writes(membershipFrame());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('survives the comment-only block the stream opens with, and reads the frame after it', async () => {
    service.start();
    await settle();
    reload.mockClear();

    // The FIRST thing this client ever receives. A reader that treats the first blank-line-delimited block as an
    // event and parses its `data:` breaks here, on byte one, before any membership has changed.
    latest().writes(CONNECTED_COMMENT);
    await settle();

    // A comment is not a change.
    expect(reload).not.toHaveBeenCalled();
    // And it is not a failure either: nothing reconnected.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The half that a comment-swallowing bug cannot fake — the reader is still working afterwards.
    latest().writes(membershipFrame());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('ignores the keep-alive comment the same way', async () => {
    service.start();
    await settle();
    reload.mockClear();

    latest().writes(CONNECTED_COMMENT + KEEP_ALIVE_COMMENT);
    await settle();

    expect(reload).not.toHaveBeenCalled();

    // Asserted after the negative, because "nothing reloaded" is also what a reader that died on the first comment
    // looks like. Cycle 2 measured it: with comment handling broken this test stayed GREEN without these two lines.
    latest().writes(membershipFrame());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('re-fetches on connect, because the stream does not replay', async () => {
    service.start();
    await settle();

    // A client that was disconnected while an administrator verified the plan would otherwise never learn of it —
    // which is item 39's own defect, reintroduced through a dropped connection.
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('re-fetches exactly once for a membership frame', async () => {
    service.start();
    await settle();
    reload.mockClear();

    latest().writes(membershipFrame());
    await settle();

    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('frames a block that arrives split across two reads', async () => {
    service.start();
    await settle();
    reload.mockClear();

    const frame = membershipFrame();
    latest().writes(frame.slice(0, 20));
    await settle();
    // Nothing yet: a chunk boundary is not a frame boundary, and acting on half a block is how a client invents an
    // event the server never sent.
    expect(reload).not.toHaveBeenCalled();

    latest().writes(frame.slice(20));
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('ignores an event type it does not know', async () => {
    service.start();
    await settle();
    reload.mockClear();

    // The api's frame is typed so a second kind of push can share this topic. Re-fetching memberships because
    // something else happened would be acting on a message addressed to somebody else.
    latest().writes('id:x\nevent:SomethingElse\ndata:{"x":1}\n\n');
    await settle();

    expect(reload).not.toHaveBeenCalled();

    // The same strengthening the two comment tests carry, and for the same reason: "nothing reloaded" is also what
    // a client that died on the unknown event looks like, so the negative alone would stay green while the stream
    // was gone. Asserting the reader still works afterwards is what tells "ignored" from "killed".
    latest().writes(membershipFrame());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('reconnects when acting on a frame throws, instead of dying where nothing can see it', async () => {
    service.start();
    await settle();
    const abandoned = latest();

    // reload() reaches every subscriber of the portal's shared pipelines, so a synchronous throw out of one of
    // them arrives exactly here. Without a catch it rejects the read loop, propagates through connect(), and is
    // lost in `void this.connect()`: no reconnect, `enabled` still true, and the watchdog firing once into a void
    // a minute later. The stream would be dead for the life of the process with nothing surfaced.
    reload.mockImplementationOnce(() => {
      throw new Error('a subscriber blew up');
    });
    abandoned.writes(membershipFrame());
    await settle();

    // The connection it walked away from is closed rather than left open beside the new one.
    expect(abandoned.cancelled).toBe(true);

    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // One on the first connect, one that threw, one on the reconnect — so the change whose handling threw is
    // picked up anyway rather than lost with the connection.
    expect(reload).toHaveBeenCalledTimes(3);

    service.stop();
  });

  it('treats the thirty-minute server close as normal and does not escalate', async () => {
    service.start();
    await settle();
    latest().writes(CONNECTED_COMMENT);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // What the api does at thirty minutes to bound the visibility PatientScope froze at connect: complete(), not
    // completeWithError(). A client that read this as a failure would climb the ladder on every long-lived
    // session.
    latest().ends();
    await advance(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Three closes in a row, each answered at the same first rung. An escalating client would be at 2s and then
    // 5s.
    latest().ends();
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    latest().ends();
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // And each reconnect re-fetches, which is what stops a patient missing an activation that happened while the
    // stream was being renewed.
    expect(reload).toHaveBeenCalledTimes(4);

    service.stop();
  });

  it('backs off further each time the connection fails', async () => {
    answers = 'unreachable';

    service.start();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    // 1s, 2s, 5s, 15s, 30s — and the last rung repeats rather than growing without bound.
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await advance(15000);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await advance(30000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    await advance(30000);
    expect(fetchMock).toHaveBeenCalledTimes(7);

    service.stop();
  });

  it('starts the ladder again once a connection succeeds', async () => {
    answers = 'unreachable';
    service.start();
    await settle();
    await advance(1000);
    await advance(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    answers = 'stream';
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // A stream that breaks after a good connection waits one second, not the five the previous failures had
    // reached.
    latest().breaks();
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    service.stop();
  });

  it('reconnects when a refused response comes back instead of a stream', async () => {
    answers = 'refused';
    service.start();
    await settle();

    expect(reload).not.toHaveBeenCalled();
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    service.stop();
  });

  it('gives up on a line that has gone quiet for longer than two heartbeats', async () => {
    // The only liveness signal there is. A connection dropped by a proxy, a sleeping device or Android reclaiming
    // a backgrounded app's sockets produces no event this client can see; it simply stops arriving.
    expect(SILENCE_TIMEOUT_MS).toBeGreaterThan(SERVER_HEARTBEAT_MS * 2);

    service.start();
    await settle();
    latest().writes(CONNECTED_COMMENT);
    await settle();
    const abandoned = latest();

    await advance(SILENCE_TIMEOUT_MS - 1);
    // One lost beat is not evidence of anything.
    expect(abandoned.cancelled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(abandoned.cancelled).toBe(true);
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    service.stop();
  });

  it('counts a keep-alive as proof the line is alive', async () => {
    service.start();
    await settle();

    await advance(SERVER_HEARTBEAT_MS);
    latest().writes(KEEP_ALIVE_COMMENT);
    await settle();

    await advance(SILENCE_TIMEOUT_MS - 1);
    // The beat pushed the deadline out. Without that, an idle stream — which is the ordinary state of this one,
    // since a membership can sit PENDING for as long as the back office takes — would be torn down every minute.
    expect(latest().cancelled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('stops the reader and everything pending when the shell is torn down', async () => {
    service.start();
    await settle();
    const body = latest();
    reload.mockClear();

    service.stop();
    await settle();

    // The connection is actually closed, not merely forgotten. A forgotten reader holds a connection to the
    // gateway open for the life of the process and goes on reloading a service every screen shares.
    expect(body.cancelled).toBe(true);

    // Nothing rescheduled itself, and a late frame on the old connection reaches nobody.
    body.writes(membershipFrame());
    await advance(60_000);
    expect(reload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens one stream however often it is started', async () => {
    service.start();
    service.start();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('suspends the stream the moment a lock clears the in-memory token', async () => {
    service.start();
    await settle();
    latest().writes(CONNECTED_COMMENT);
    await settle();
    const abandoned = latest();
    reload.mockClear();

    /**
     * What AppLockService.lock() does on every cold start and long resume: SessionTokenService.lock()
     * clears the in-memory token and leaves the disk copy alone. From this moment until the unlock
     * there is nothing to authenticate with, and a request issued anyway goes out bare — the exact
     * shape app-lock.service.ts records being bitten by. Backgrounding also kills the connection at
     * the OS level, so this is the common case, not an edge one.
     */
    sessionToken.set(null);
    await settle();

    // The connection is closed, not left streaming behind the lock screen.
    expect(abandoned.cancelled).toBe(true);

    // And the locked app stays SILENT: no reconnect, no unauthenticated request, no reload firing
    // patient-scoped fetches through an interceptor that has no token to attach — however long the
    // lock lasts. (The resume test below is the positive half that keeps this from being satisfied
    // by a dead client.)
    await advance(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    service.stop();
  });

  it('cancels a pending retry when the lock arrives mid-backoff', async () => {
    answers = 'unreachable';
    service.start();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The retry is on the clock when the lock lands. A stream that only checked the token at connect
    // time would let this timer fire into a tokenless connect — harmless today only if that guard
    // exists, so pin the stronger property: nothing fires at all.
    sessionToken.set(null);
    await settle();

    await advance(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('resumes with the fresh token when the unlock puts one back, and re-fetches what it missed', async () => {
    service.start();
    await settle();
    sessionToken.set(null);
    await settle();
    reload.mockClear();
    fetchMock.mockClear();

    /**
     * AppLockService.unlock() reads the token back into memory BEFORE navigating into the shell —
     * its file header calls that order load-bearing — so by the time anything here can fire, the
     * signal carries the restored token. The reconnect must use IT, not a copy captured at start():
     * a re-issued token would otherwise be ignored until the next full restart.
     */
    sessionToken.set('after.unlock.jwt');
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer after.unlock.jwt');

    // The reload on connect is what covers everything that happened while the app was away — the
    // stream does not replay, and an activation during the absence would otherwise wait for the
    // next frame that may never come.
    expect(reload).toHaveBeenCalledTimes(1);

    // And the resumed stream is a working one, not a token that connected and died.
    latest().writes(CONNECTED_COMMENT + membershipFrame());
    await settle();
    expect(reload).toHaveBeenCalledTimes(2);

    service.stop();
  });

  it('waits rather than dying when started without a token, and connects when one arrives', async () => {
    sessionToken.set(null);

    service.start();
    await advance(60_000);

    // Locked or signed out: nothing to listen to, and no retry loop asking anyway.
    expect(fetchMock).not.toHaveBeenCalled();

    // DIVERGENCE FROM THE WEB, where a missing token at start means the session is over and the
    // stream declares itself dead. Here the token's absence is routinely temporary — TabsPage can
    // construct while an unlock is still writing the token back — so the stream waits for the
    // signal instead. A dead client passes the assertion above; this half is what it cannot pass.
    sessionToken.set('a.jwt.value');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);

    service.stop();
  });

  it('does not open a stream on unlock when the shell is gone', async () => {
    service.start();
    await settle();
    service.stop();
    fetchMock.mockClear();

    // A token change with no shell wanting the stream — sign-out on the lock screen, sign-in on the
    // login page — must not open a connection from a service nothing is looking at.
    sessionToken.set(null);
    await settle();
    sessionToken.set('next.session.jwt');
    await settle();
    await advance(60_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
