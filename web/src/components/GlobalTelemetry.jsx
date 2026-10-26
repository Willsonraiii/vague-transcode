import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * High-precision animated odometer for telemetry counts.
 * Uses easeOutExpo easing to smoothly reveal counts once scrolled into view.
 */
function AnimatedCounter({ targetValue, duration = 1800, isVisible, className = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startValRef = useRef(0);
  const animFrameRef = useRef(null);
  const target = typeof targetValue === 'number' && !isNaN(targetValue) ? targetValue : 0;

  useEffect(() => {
    if (!isVisible) return;

    const start = startValRef.current;
    if (start === target && displayValue === target) return;

    let startTime = null;

    // Exponential deceleration easing (Apple / DaVinci UI style)
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = Math.round(start + (target - start) * eased);

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(target);
        startValRef.current = target;
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [target, duration, isVisible]);

  return (
    <span className={`tabular-nums font-mono font-medium tracking-tight ${className}`}>
      {new Intl.NumberFormat('en-US').format(displayValue)}
    </span>
  );
}

export const GlobalTelemetry = () => {
  const [stats, setStats] = useState({
    registeredUsers: 0,
    totalOptimizations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef(null);

  // Trigger counting animation once the section enters viewport
  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Poll live telemetry data every 20 seconds
  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/telemetry/stats');
        const data = await res.json();
        if (mounted && data?.ok && data.stats) {
          setStats(data.stats);
        }
      } catch {
        /* silent fallback */
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="telemetry"
      aria-label="Platform Telemetry"
      className="scroll-anchor relative py-12 sm:py-16 md:py-20 bg-[hsl(var(--bg))] border-t border-b border-white/[0.06] overflow-hidden"
    >
      {/* Subtle ambient lens background glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(56,189,248,0.04),transparent_75%)]"
        aria-hidden="true"
      />

      <div className="container-hirael max-w-5xl mx-auto px-4 sm:px-6">
        {/* Freely in one row, no card frames/boxes, titles below numbers */}
        <div className="flex flex-row items-center justify-center gap-10 sm:gap-20 md:gap-32 text-center select-none">
          {/* Signed Users */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center flex-1 max-w-[280px]"
          >
            <div className="font-clash inframe-title font-semibold text-4xl sm:text-6xl md:text-7xl text-white tracking-tight drop-shadow-[0_2px_18px_rgba(255,255,255,0.12)]">
              {loading && !isInView ? (
                <span className="opacity-40 font-mono">—</span>
              ) : (
                <AnimatedCounter
                  targetValue={stats.registeredUsers}
                  duration={1600}
                  isVisible={isInView}
                  className="text-white"
                />
              )}
            </div>
            <span className="font-sans text-[10.5px] sm:text-xs md:text-sm font-medium uppercase tracking-[0.22em] text-neutral-400 mt-2.5 sm:mt-3.5">
              Signed Users
            </span>
          </motion.div>

          {/* Minimalist vertical hairline divider with gradient fade */}
          <div
            className="w-px h-14 sm:h-20 md:h-24 bg-gradient-to-b from-transparent via-white/20 to-transparent shrink-0"
            aria-hidden="true"
          />

          {/* Optimized Videos */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center flex-1 max-w-[280px]"
          >
            <div className="font-clash inframe-title font-semibold text-4xl sm:text-6xl md:text-7xl text-cyan-300 tracking-tight drop-shadow-[0_2px_22px_rgba(56,189,248,0.25)]">
              {loading && !isInView ? (
                <span className="opacity-40 font-mono">—</span>
              ) : (
                <AnimatedCounter
                  targetValue={stats.totalOptimizations}
                  duration={1800}
                  isVisible={isInView}
                  className="text-cyan-300"
                />
              )}
            </div>
            <span className="font-sans text-[10.5px] sm:text-xs md:text-sm font-medium uppercase tracking-[0.22em] text-neutral-400 mt-2.5 sm:mt-3.5">
              Optimized Videos
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
