import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const STATS = [
  { value: 4, suffix: 'K', label: 'Ultra HD Detail' },
  { value: 60, suffix: ' FPS', label: 'Native Cadence Lock' },
  { value: 120, suffix: ' FPS', label: 'ProMotion Fluidity' },
];

const useCountUp = (target, active, duration = 1400) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
};

const Stat = ({ value, suffix, label, active }) => {
  const count = useCountUp(value, active);

  return (
    <div className="flex flex-col items-center border-t border-[hsl(var(--stroke))] pt-6 sm:pt-8 text-center sm:items-start sm:text-start">
      <span className="font-clash font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-none tabular-nums text-white">
        {count.toLocaleString()}
        {suffix}
      </span>
      <span className="mt-3 text-[11px] sm:text-xs tracking-[0.2em] text-[hsl(var(--muted))] uppercase font-clash inframe-title font-medium">{label}</span>
    </div>
  );
};

export const Stats = () => {
  const [active, setActive] = useState(false);

  return (
    <section id="stats" className="section-hirael scroll-anchor bg-[hsl(var(--bg))]">
      <div className="container-hirael">
        <motion.div
          onViewportEnter={() => setActive(true)}
          viewport={{ once: true, margin: '0px' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10"
        >
          {STATS.map((stat) => (
            <Stat key={stat.label} active={active} {...stat} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
