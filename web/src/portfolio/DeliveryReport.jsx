import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { SECTION_EASE } from './primitives';

const LINES = [
  { tag: 'feed', text: 'smooth 60 / 120 motion · no cadence ripple' },
  { tag: 'color', text: 'hlg highlights land the way you graded them' },
  { tag: 'sound', text: 'original audio plays back untouched' },
  { tag: 'upload', text: 'posts in seconds · no processing hang' },
  { tag: 'master', text: 'leaves the studio bit-for-bit' },
];

const STATS = [
  { value: 0, suffix: null, label: 'Frames re-encoded', group: false, hero: true },
  { value: 100, suffix: '%', label: 'HDR preserved', group: false },
  { value: 60, suffix: '–120', label: 'FPS native motion', group: false },
  { value: 2, suffix: null, label: 'Audio tracks kept', group: false },
];

function useCountUp(target, active, reduced, group) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (reduced || target === 0) {
      setN(target);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1500;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduced]);
  return group ? n.toLocaleString('en-US') : String(n);
}

function Stat({ stat, active, reduced }) {
  const shown = useCountUp(stat.value, active, reduced, stat.group);
  return (
    <div className={stat.hero ? 'dr-stat dr-stat--hero' : 'dr-stat'}>
      <span className="dr-stat-value">
        {shown}
        {stat.suffix && <em className="dr-stat-suffix">{stat.suffix}</em>}
      </span>
      <span className="dr-stat-label">{stat.label}</span>
    </div>
  );
}

function Line({ line, index, started, reduced }) {
  const stampAt = 0.5 + index * 0.16;
  if (reduced || !started) {
    return (
      <div className="dr-line">
        <span className="dr-tag">{line.tag}</span>
        <span className="dr-text">{line.text}</span>
        <span className="dr-pass">Pass</span>
      </div>
    );
  }
  return (
    <motion.div
      className="dr-line"
      initial={{ opacity: 0, x: -14, filter: 'blur(4px)' }}
      animate={started ? { opacity: 1, x: 0, filter: 'blur(0px)' } : undefined}
      transition={{ delay: stampAt, duration: 0.5, ease: SECTION_EASE }}
    >
      <span className="dr-tag">{line.tag}</span>
      <span className="dr-text">{line.text}</span>
      <motion.span
        className="dr-pass"
        initial={{ opacity: 0, scale: 1.3 }}
        animate={started ? { opacity: 1, scale: 1 } : undefined}
        transition={{ delay: stampAt + 0.42, duration: 0.28, ease: SECTION_EASE }}
      >
        Pass
      </motion.span>
    </motion.div>
  );
}

export default function DeliveryReport() {
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { once: true, margin: '-12% 0px' });
  const reduced = useReducedMotion();
  const started = inView || reduced;

  return (
    <div ref={rootRef} className="dr-wrap">
      <div className="dr-console">
        <header className="dr-head">
          <span className="dr-dot" aria-hidden="true" />
          <span className="dr-head-label">Delivery report</span>
          <span className="dr-file">what your followers see</span>
          <motion.span
            className="dr-pass-chip"
            initial={reduced ? false : { opacity: 0, scale: 1.25 }}
            animate={started && !reduced ? { opacity: 1, scale: 1 } : undefined}
            transition={{ delay: 1.55, duration: 0.35, ease: SECTION_EASE }}
          >
            Pass
          </motion.span>
        </header>

        <div className="dr-body">
          <div className="dr-term" aria-label="Container validation output">
            <div className="dr-line dr-line--cmd">
              <span className="dr-prompt">$</span>
              <span className="dr-text">ffprobe what-tiktok-serves</span>
            </div>
            {LINES.map((line, i) => (
              <Line key={line.tag} line={line} index={i} started={started} reduced={reduced} />
            ))}
            <div className="dr-line dr-line--pw">
              <span className="dr-cursor" aria-hidden="true" />
            </div>
          </div>

          <div className="dr-stats">
            {STATS.map((stat) => (
              <Stat key={stat.label} stat={stat} active={started} reduced={reduced} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
