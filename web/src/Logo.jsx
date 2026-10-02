// OBITO STUDIO monogram: the O of Obito interlocked with the S of Studio.
// No frame, no tile — just the glass mark. Gradient strokes are part of the logo itself.
export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="OBITO STUDIO" className="logo-svg">
      <defs>
        <linearGradient id="lg-o" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset=".55" stopColor="#f6e7c1" />
          <stop offset="1" stopColor="#e8c07f" />
        </linearGradient>
        <linearGradient id="lg-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9b8ff" />
          <stop offset=".5" stopColor="#a04ad0" />
          <stop offset="1" stopColor="#6a46e0" />
        </linearGradient>
        <clipPath id="lg-top"><rect x="0" y="0" width="64" height="31" /></clipPath>
        <clipPath id="lg-bot"><rect x="0" y="31" width="64" height="33" /></clipPath>
      </defs>
      {/* S ribbon passes BEHIND the O on the top half */}
      <path className="lg-s" d="M47 17c-7-6.5-20-5.5-24.5 1-3.6 5.3 1.6 8.6 9.5 10.6 8.6 2.2 14.6 5.4 11 11.4-4.4 7.3-18.6 8.6-26 2"
        fill="none" stroke="url(#lg-s)" strokeWidth="5" strokeLinecap="round" clipPath="url(#lg-top)" opacity=".85" />
      {/* the O */}
      <circle className="lg-o" cx="32" cy="32" r="15.5" fill="none" stroke="url(#lg-o)" strokeWidth="5.4" />
      {/* inner glass highlight on the O */}
      <path d="M22.5 25.5a13.5 13.5 0 0 1 9-5" fill="none" stroke="#ffffff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
      {/* S ribbon IN FRONT on the bottom half -> interlocked */}
      <path className="lg-s" d="M47 17c-7-6.5-20-5.5-24.5 1-3.6 5.3 1.6 8.6 9.5 10.6 8.6 2.2 14.6 5.4 11 11.4-4.4 7.3-18.6 8.6-26 2"
        fill="none" stroke="url(#lg-s)" strokeWidth="5" strokeLinecap="round" clipPath="url(#lg-bot)" />
      {/* the studio spark */}
      <path d="M50 8.5l1.5 3.6 3.6 1.5-3.6 1.5-1.5 3.6-1.5-3.6-3.6-1.5 3.6-1.5z" fill="#fff6dc" />
    </svg>
  );
}
