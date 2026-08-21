/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/vitals.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

import { IStat } from 'app/entities/patientMS/stat/stat.model';
import { IconName } from 'app/shared/ui/icon/icon.constants';
import { TrendPoint } from 'app/shared/ui/charts/trend-chart.component';
import { byDateAsc, formatDay } from './portal-format';

/** A vital as the tiles and the record screen need it: latest reading plus its recent history. */
export interface VitalSummary {
  /** Stat `type`, lowercased — the series key, e.g. `bp`. */
  readonly key: string;
  readonly label: string;
  /** Formatted for display: "120/80" for a paired reading, "36.4" otherwise. */
  readonly display: string;
  readonly unit: string;
  readonly icon: IconName;
  readonly flag: 'OK' | 'WARN' | 'DANGER';
  readonly note: string;
  /** The reference band in words, when the reading carries one. */
  readonly band: string;
  readonly recordedAt: dayjs.Dayjs | null;
  /** Who took the latest reading, for attribution. Null when the record does not say. */
  readonly source: string | null;
  readonly recordedById: string | null;
  /** Oldest to newest — a trend reads left to right. */
  readonly series: readonly number[];
  readonly trend: readonly TrendPoint[];
  /** Every reading, newest first, for the history table. */
  readonly history: readonly { readonly when: string; readonly value: string }[];
}

/** How many readings a trend shows before it starts dropping the oldest. */
const TREND_LENGTH = 7;

/** Icon per known vital type. Anything unrecognised still renders, with a neutral icon. */
const ICONS: Readonly<Record<string, IconName | undefined>> = {
  temperature: 'temp',
  temp: 'temp',
  bp: 'gauge',
  'blood pressure': 'gauge',
  bloodpressure: 'gauge',
  heart: 'heart',
  'heart rate': 'heart',
  heartrate: 'heart',
  pulse: 'heart',
  sugar: 'drop',
  'blood sugar': 'drop',
  glucose: 'drop',
  weight: 'report',
};

/**
 * Folds a flat list of Stat readings into one summary per vital type.
 *
 * Readings arrive as individual documents — many per type, over months. The tiles want the most
 * recent of each type plus enough history to draw a shape, which is what this produces.
 */
export function summariseVitals(stats: readonly IStat[]): readonly VitalSummary[] {
  const byType = new Map<string, IStat[]>();
  for (const stat of stats) {
    const key = (stat.type ?? stat.name ?? 'other').trim().toLowerCase();
    const bucket = byType.get(key);
    if (bucket) {
      bucket.push(stat);
    } else {
      byType.set(key, [stat]);
    }
  }

  return [...byType.entries()].map(([key, readings]) => summarise(key, readings)).sort((a, b) => a.label.localeCompare(b.label));
}

function summarise(key: string, readings: IStat[]): VitalSummary {
  const when = (stat: IStat): dayjs.Dayjs | null | undefined => stat.recordedAt ?? stat.createdDate;
  const chronological = [...readings].sort(byDateAsc(when));
  const latest = chronological.at(-1)!;
  const recent = chronological.slice(-TREND_LENGTH);

  return {
    key,
    label: latest.name ?? titleCase(key),
    display: displayValue(latest),
    unit: latest.unit ?? '',
    icon: ICONS[key] ?? 'report',
    flag: latest.flag ?? 'OK',
    note: latest.note ?? latest.description ?? '',
    band: bandOf(latest),
    recordedAt: when(latest) ?? null,
    source: latest.source ?? null,
    recordedById: latest.recordedById ?? null,
    // The plotted series is the primary value only: a systolic/diastolic pair cannot be one line,
    // and the table below the chart carries both.
    series: recent.map(stat => stat.value ?? 0),
    trend: recent.map(stat => ({ label: shortLabel(when(stat)), value: stat.value ?? 0 })),
    history: [...chronological].reverse().map(stat => ({
      when: formatDay(when(stat)),
      value: `${displayValue(stat)}${stat.unit ? ` ${stat.unit}` : ''}`,
    })),
  };
}

/** Blood pressure reads "120/80"; everything else is a single figure. */
function displayValue(stat: IStat): string {
  if (stat.value == null) {
    return '—';
  }
  return stat.secondaryValue != null ? `${stat.value}/${stat.secondaryValue}` : String(stat.value);
}

function bandOf(stat: IStat): string {
  const { referenceLow: low, referenceHigh: high, unit } = stat;
  const suffix = unit ? ` ${unit}` : '';
  if (low != null && high != null) {
    return `Normal ${low} – ${high}${suffix}`;
  }
  if (high != null) {
    return `Target below ${high}${suffix}`;
  }
  if (low != null) {
    return `Target above ${low}${suffix}`;
  }
  return '';
}

/** "24 Jul" — short enough to sit under a data point without colliding with its neighbour. */
function shortLabel(value: dayjs.Dayjs | null | undefined): string {
  return value ? value.format('DD MMM') : '—';
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
