import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const GlobalTelemetry = ({ onOpenReview }) => {
  const [stats, setStats] = useState({
    registeredUsers: 0,
    totalOptimizations: 0,
  });
  const [loading, setLoading] = useState(true);

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

  const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <section id="telemetry" className="scroll-anchor py-8 sm:py-12 border-t border-b border-white/[0.06] bg-[hsl(var(--bg))]">
      <div className="container-hirael">
        {/* Freely in one row, no frames, titles below numbers */}
        <div className="flex flex-row items-center justify-center gap-8 sm:gap-16 md:gap-24 text-center">
          {/* Signed Users */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <span className="font-clash inframe-title font-medium text-3xl sm:text-5xl md:text-6xl text-white tracking-tight">
              {loading ? '—' : formatNumber(stats.registeredUsers)}
            </span>
            <span className="font-sans text-[11px] sm:text-xs md:text-sm font-medium uppercase tracking-wider text-neutral-400 mt-2">
              Signed Users
            </span>
          </motion.div>

          {/* Minimalist vertical hairline divider */}
          <div className="w-px h-10 sm:h-14 bg-white/10 shrink-0" aria-hidden="true" />

          {/* Optimized Videos */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <span className="font-clash inframe-title font-medium text-3xl sm:text-5xl md:text-6xl text-cyan-300 tracking-tight">
              {loading ? '—' : formatNumber(stats.totalOptimizations)}
            </span>
            <span className="font-sans text-[11px] sm:text-xs md:text-sm font-medium uppercase tracking-wider text-neutral-400 mt-2">
              Optimized Videos
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
