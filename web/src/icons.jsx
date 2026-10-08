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
export const PremiumKeyIcon = (p) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="premium-key-svg"
    {...p}
  >
    <defs>
      <linearGradient id="premKeyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
    </defs>
    <circle cx="7.5" cy="15.5" r="4.8" stroke="url(#premKeyGrad)" strokeWidth="2.2" />
    <circle cx="7.5" cy="15.5" r="2" stroke="url(#premKeyGrad)" strokeWidth="1.2" opacity="0.7" />
    <path d="M11 12L20 3" stroke="url(#premKeyGrad)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M16.5 6.5L19.5 9.5" stroke="url(#premKeyGrad)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M7 4L7.8 5.8L9.6 6.6L7.8 7.4L7 9.2L6.2 7.4L4.4 6.6L6.2 5.8Z" fill="#fde047" opacity="0.95" />
  </svg>
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

export const ListIcon = (p) => (
  <svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
);
export const HelpIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></svg>
);
export const WifiOffIcon = (p) => (
  <svg {...base} {...p}><path d="M3 3l18 18M2.5 9.5a14 14 0 0 1 4-2.6M9.5 5.2A14 14 0 0 1 21.5 9.5M5.5 13a9.6 9.6 0 0 1 3-1.9M13.4 11a9.6 9.6 0 0 1 5.1 2M8.6 16.4a5.2 5.2 0 0 1 6.8 0" /><circle cx="12" cy="19.6" r="1" fill="currentColor" /></svg>
);
export const ControlIcon = (p) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <rect x="3" y="4" width="18" height="7" rx="3.5" fill="rgba(255,244,216,.32)" />
    <circle cx="7" cy="7.5" r="2.6" fill="#fff" />
    <rect x="3" y="13" width="18" height="7" rx="3.5" fill="#0a84ff" />
    <circle cx="17" cy="16.5" r="2.6" fill="#fff" />
  </svg>
);
export const InspectIcon = (p) => (
  <svg {...base} {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /><path d="M8 10.5h1.6l1-2 1.4 4 1-2H14" /></svg>
);
export const SunIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" /></svg>
);
export const SpeakerIcon = (p) => (
  <svg {...base} {...p}><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" fill="currentColor" stroke="none" /><path d="M15.5 9a4.3 4.3 0 0 1 0 6M18 6.8a8 8 0 0 1 0 10.4" /></svg>
);
export const TailnetIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></svg>
);

export const LightningIcon = (p) => (
  <svg {...base} {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
);
export const FilmIcon = (p) => (
  <svg {...base} {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 4v16M17 4v16M2 8h5M2 12h5M2 16h5M17 8h5M17 12h5M17 16h5" /></svg>
);
export const TrashIcon = (p) => (
  <svg {...base} {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
);
export const CopyIcon = (p) => (
  <svg {...base} {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const SearchIcon = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);
export const ShareIcon = (p) => (
  <svg {...base} {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
);
export const RefreshIcon = (p) => (
  <svg {...base} {...p}><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16" /></svg>
);
export const AlertTriangleIcon = (p) => (
  <svg {...base} {...p}><path d="m10.3 3.6-8.3 14.4A2 2 0 0 0 3.7 21h16.6a2 2 0 0 0 1.7-3l-8.3-14.4a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>
);
export const TerminalIcon = (p) => (
  <svg {...base} {...p}><path d="m4 17 6-6-6-6M12 19h8" /></svg>
);

