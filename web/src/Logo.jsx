// OBITO STUDIO mark (flat): tile, vanilla planet-ring "O", cosmic orbit and a spark.
export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="OBITO STUDIO" className="logo-svg">
      <defs>
        <clipPath id="lg-front"><rect x="0" y="24" width="48" height="24" /></clipPath>
        <clipPath id="lg-back"><rect x="0" y="0" width="48" height="24" /></clipPath>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill="#231650" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="12.5" fill="none" stroke="#fff4d8" strokeOpacity="0.3" />
      <ellipse cx="24" cy="24" rx="19" ry="6.2" transform="rotate(-22 24 24)" fill="none" stroke="#b98cff" strokeWidth="1.5" clipPath="url(#lg-back)" opacity="0.6" />
      <circle cx="24" cy="24" r="9.2" fill="none" stroke="#f6e7c1" strokeWidth="3.6" />
      <ellipse cx="24" cy="24" rx="19" ry="6.2" transform="rotate(-22 24 24)" fill="none" stroke="#c9a2ff" strokeWidth="1.8" clipPath="url(#lg-front)" />
      <path d="M37 9.2l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#fff4d8" />
    </svg>
  );
}
