const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const UploadIcon = (p) => (
  <svg {...base} {...p}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
);
export const DownloadIcon = (p) => (
  <svg {...base} {...p}><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg>
);
export const HdrIcon = (p) => (
  <svg {...base} {...p}><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="M7 10v4M7 12h3M10 10v4M13 14v-4h1.3a1.5 1.5 0 0 1 0 3H13M15 13l1.6 1" /></svg>
);
export const FpsIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="m12 7.5 0 4.7 3 1.8" /></svg>
);
export const KeyIcon = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="15" r="3.5" /><path d="m10.5 12.5 8-8M15.5 7.5l2.5 2.5" /></svg>
);
export const CheckIcon = (p) => (
  <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const PauseIcon = (p) => (
  <svg {...base} {...p}><path d="M8 5v14M16 5v14" strokeWidth="2.6" /></svg>
);
export const PlayIcon = (p) => (
  <svg {...base} {...p}><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
);
export const WifiIcon = (p) => (
  <svg {...base} {...p}><path d="M2.5 9.5a14 14 0 0 1 19 0M5.5 13a9.6 9.6 0 0 1 13 0M8.6 16.4a5.2 5.2 0 0 1 6.8 0" /><circle cx="12" cy="19.6" r="1" fill="currentColor" /></svg>
);
export const SparkIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
);
export const LayersIcon = (p) => (
  <svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
);
export const ShieldIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3 4.5 6v5.5c0 4.3 3 8 7.5 9.5 4.5-1.5 7.5-5.2 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>
);
export const ChevronIcon = (p) => (
  <svg {...base} {...p}><path d="m7 10 5 5 5-5" /></svg>
);
