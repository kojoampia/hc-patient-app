/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/icon/icon.constants.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

/**
 * The portal's icon set: the inner geometry of a 24x24 stroked icon, drawn on a `none` fill with
 * `currentColor`. Kept as raw path data rather than one component per icon because they are only
 * ever rendered through {@link IconComponent}, which supplies the `<svg>` wrapper and its
 * attributes — that is the only place the geometry is read.
 *
 * Every value here is a compile-time constant. Nothing user-supplied reaches it, which is what
 * makes IconComponent's sanitiser bypass safe.
 */
export const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.6V21h14V9.6"/><path d="M9.5 21v-6h5v6"/>',
  folder: '<path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2.5h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  case: '<path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/><path d="M8.5 13h7M8.5 17h4.5"/>',
  alert: '<path d="M12 9v4M12 16.5v.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.8 8.8l6.4 6.4"/>',
  report: '<path d="M4 20V9.5M9.3 20V4.5M14.7 20v-8M20 20v-13"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5.5 4.5-9.5 16-9.5C20 12 17 20 11 20z"/><path d="M4.5 19.5C7 14 11 11 16 9"/>',
  user: '<circle cx="12" cy="8" r="3.9"/><path d="M4.5 20.5c1.4-4 4-6 7.5-6s6.1 2 7.5 6"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
  drop: '<path d="M12 3s6 6.2 6 10.3A6 6 0 0 1 6 13.3C6 9.2 12 3 12 3z"/>',
  temp: '<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/><path d="M12 17.5v.01"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-4.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M20 6.5 9.4 17.1 4 11.7"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  eye: '<path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  filter: '<path d="M3.5 5.5h17l-6.6 8v5.4l-3.8-2v-3.4z"/>',
  expand: '<path d="M14.5 4.5H20v5.5M9.5 19.5H4V14"/><path d="M20 4.5 13.5 11M4 19.5 10.5 13"/>',
  print:
    '<path d="M6.5 9V3.5h11V9M6.5 18H5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2h-1.5"/><rect x="6.5" y="14" width="11" height="6.5" rx="1"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5H5.5a2 2 0 0 0-2 2v10"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  logout: '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M13 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H13"/>',
  phone:
    '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a10.5 10.5 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-10.5A6.5 6.5 0 0 1 18.5 10.5C18.5 15 12 21 12 21z"/><circle cx="12" cy="10.3" r="2.4"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3.5 3.5 0 0 0 5 3 9.5 9.5 0 1 0-3.5 4.2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  shield: '<path d="M12 3l7.5 3v6c0 5-3.4 8-7.5 9.5C7.9 20 4.5 17 4.5 12V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/>',
  note: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8.5h8M8 12.5h8M8 16.5h4.5"/>',
  save: '<path d="M5 3.5h11L20.5 8v12.5a1 1 0 0 1-1 1H5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 5 3.5z"/><path d="M8 3.5v6h7M8 17h8"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-7 18-3.5-7.5L3 10z"/>',
  star: '<path d="m12 3.6 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17.4l-5.38 2.85 1.03-6L3.3 10l6-.9z"/>',
  run: '<circle cx="15" cy="4.5" r="2"/><path d="M13.5 8.5 9 11l1.5 4 3 1.5 1.5 4"/><path d="M9 11 5.5 14.5M13.5 8.5l4 2 1 4"/>',
  stetho: '<path d="M6 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M10 12.5v3a4.5 4.5 0 0 0 9 0v-2"/><circle cx="19" cy="10.5" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4A2.5 2.5 0 0 1 14.5 10c0 1.7-2.5 2-2.5 3.6"/><path d="M12 16.9v.01"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  inbox: '<path d="M3 12h5l1.5 3h5L16 12h5"/><path d="M5.5 5.5h13l2.5 6.5v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;
