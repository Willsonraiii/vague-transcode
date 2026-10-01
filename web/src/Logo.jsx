// OBITO STUDIO mark: a glass tile holding a vanilla planet-ring "O" with a cosmic orbit and a spark.
export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="OBITO STUDIO" className="logo-svg">
      <defs>
        <linearGradient id="lg-tile" x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a35b8" />
          <stop offset="0.55" stopColor="#21144f" />
          <stop offset="1" stopColor="#0d0a2a" />
        </linearGradient>
        <linearGradient id="lg-ring" x1="14" y1="12" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="1" stopColor="#e8c98a" />
        </linearGradient>
        <linearGradient id="lg-orbit" x1="4" y1="30" x2="44" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7aa8ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c58bff" />
          <stop offset="1" stopColor="#ffe9b8" />
        </linearGradient>
        <radialGradient id="lg-shine" cx="0.25" cy="0.1" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="lg-front"><rect x="0" y="24" width="48" height="24" /></clipPath>
        <clipPath id="lg-back"><rect x="0" y="0" width="48" height="24" /></clipPath>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#lg-tile)" />
      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#lg-shine)" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="12.5" fill="none" stroke="#fff6dc" strokeOpacity="0.38" />
      {/* back half of the orbit, behind the planet */}
      <ellipse cx="24" cy="24" rx="19" ry="6.2" transform="rotate(-22 24 24)" fill="none" stroke="url(#lg-orbit)" strokeWidth="1.5" clipPath="url(#lg-back)" opacity="0.7" />
      {/* planet ring "O" */}
      <circle cx="24" cy="24" r="9.2" fill="none" stroke="url(#lg-ring)" strokeWidth="3.6" />
      <circle cx="24" cy="24" r="12.4" fill="none" stroke="#fff6dc" strokeOpacity="0.1" />
      {/* front half of the orbit */}
      <ellipse cx="24" cy="24" rx="19" ry="6.2" transform="rotate(-22 24 24)" fill="none" stroke="url(#lg-orbit)" strokeWidth="1.8" clipPath="url(#lg-front)" />
      {/* spark */}
      <path d="M37 9.2l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#fff6dc" />
    </svg>
  );
}
