// OBITO STUDIO — C² Living Monogram. O + S interlocked, no frame.
// The S (bigger) draws -> holds -> wipes -> rests -> repeats. The O breathes with an orbiting shine.
export default function Logo({ size = 62 }) {
  const S = 'M47 17c-7-6.5-20-5.5-24.5 1-3.6 5.3 1.6 8.6 9.5 10.6 8.6 2.2 14.6 5.4 11 11.4-4.4 7.3-18.6 8.6-26 2';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="OBITO STUDIO" className="logo-svg">
      <defs>
        <linearGradient id="lg-o" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6dc" /><stop offset=".55" stopColor="#f6e7c1" /><stop offset="1" stopColor="#e8c07f" />
        </linearGradient>
        <linearGradient id="lg-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9b8ff" /><stop offset=".5" stopColor="#a04ad0" /><stop offset="1" stopColor="#6a46e0" />
        </linearGradient>
        <clipPath id="lg-top"><rect x="0" y="0" width="64" height="31" /></clipPath>
        <clipPath id="lg-bot"><rect x="0" y="31" width="64" height="33" /></clipPath>
      </defs>
      {/* S behind the O on the top half (S is 1.3x the O) */}
      <g clipPath="url(#lg-top)">
        <g transform="translate(32 32) scale(1.3) translate(-32 -32)">
          <path className="s-path" pathLength="100" d={S} fill="none" stroke="url(#lg-s)" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
      {/* the O, breathing, with an orbiting shine */}
      <g className="o-g">
        <circle cx="32" cy="32" r="13.5" fill="none" stroke="url(#lg-o)" strokeWidth="5" />
        <path className="o-shine" d="M23.5 26a11.5 11.5 0 0 1 7.5-4.2" fill="none" stroke="#ffffff" strokeOpacity=".6" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* S in front on the bottom half */}
      <g clipPath="url(#lg-bot)">
        <g transform="translate(32 32) scale(1.3) translate(-32 -32)">
          <path className="s-path" pathLength="100" d={S} fill="none" stroke="url(#lg-s)" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
      <path className="spark" d="M50 8.5l1.5 3.6 3.6 1.5-3.6 1.5-1.5 3.6-1.5-3.6-3.6-1.5 3.6-1.5z" fill="#fff6dc" />
    </svg>
  );
}
