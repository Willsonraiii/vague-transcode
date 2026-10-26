import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SectionHeader, SECTION_EASE } from '@/portfolio/primitives';

export const GlobalTelemetry = ({ onOpenReview }) => {
  const [stats, setStats] = useState({
    registeredUsers: 0,
    totalOptimizations: 0,
    totalBytesProcessed: 0,
    averageRating: 5.0,
    reviewCount: 0,
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

  const formatDataSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <section id="telemetry" className="section-hirael scroll-anchor bg-[hsl(var(--bg))] pt-10 pb-12 sm:pt-16 sm:pb-16 border-t border-white/[0.06]">
      <div className="container-hirael">
        <SectionHeader
          lead="Mastering"
          accent="Telemetry"
          subtext="Live platform-wide processing volume, active creator accounts, and lossless stream metrics."
          className="mb-8 sm:mb-12"
        />

        {/* 4-Card Liquid-Glass Studio Telemetry Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Signed Users */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: SECTION_EASE }}
            className="group relative rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-white/[0.05] to-white/[0.015] border border-white/10 hover:border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
                  Signed Creators
                </span>
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-clash inframe-title font-medium text-3xl sm:text-4xl text-white tracking-tight">
                {loading ? '—' : formatNumber(stats.registeredUsers)}
              </div>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                Total creators authenticated with verified studio passes across desktop and mobile.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-emerald-400/90">
              <span>ACTIVE PASSES</span>
              <span>100% VERIFIED</span>
            </div>
          </motion.div>

          {/* Card 2: Optimized Videos (All Over) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.08, ease: SECTION_EASE }}
            className="group relative rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-white/[0.05] to-white/[0.015] border border-white/10 hover:border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
                  Videos Mastered
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                  Platform-Wide
                </span>
              </div>
              <div className="font-clash inframe-title font-medium text-3xl sm:text-4xl text-cyan-300 tracking-tight">
                {loading ? '—' : formatNumber(stats.totalOptimizations)}
              </div>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                Total mastered video jobs processed with pure container surgery and zero cloud RAM spikes.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-cyan-400/90">
              <span>STREAM PROCESSED</span>
              <span>{loading ? '—' : formatDataSize(stats.totalBytesProcessed)}</span>
            </div>
          </motion.div>

          {/* Card 3: Re-compression Loss (0 dB) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.16, ease: SECTION_EASE }}
            className="group relative rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-white/[0.05] to-white/[0.015] border border-white/10 hover:border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
                  Generation Loss
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.08] text-white/90 border border-white/15">
                  Bit-for-Bit
                </span>
              </div>
              <div className="font-clash inframe-title font-medium text-3xl sm:text-4xl text-white tracking-tight">
                0.0 dB
              </div>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                Pure stream copy (<code className="font-mono text-white/90 bg-white/5 px-1 rounded">-c copy</code>). Pixels, bitrates, and audio packets are untouched.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-neutral-300">
              <span>PIXEL FIDELITY</span>
              <span className="text-emerald-400 font-medium">100% LOSSLESS</span>
            </div>
          </motion.div>

          {/* Card 4: 19200 Timescale Harmonization */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.24, ease: SECTION_EASE }}
            className="group relative rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-white/[0.05] to-white/[0.015] border border-white/10 hover:border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
                  Timescale Base
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/25">
                  TikTok Native
                </span>
              </div>
              <div className="font-clash inframe-title font-medium text-3xl sm:text-4xl text-purple-300 tracking-tight">
                19,200 Hz
              </div>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                Synchronized track base clock locking native 60fps &amp; 120fps motion fluidity without downsampling.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-purple-400/90">
              <span>MOTION FLUIDITY</span>
              <span>60 / 120 FPS</span>
            </div>
          </motion.div>
        </div>

        {/* Telemetry Footer with Review Action */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2.5 text-xs text-neutral-400">
            <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Continuous Telemetry Stream · Verified on Suga Cloud container runtime</span>
          </div>
          {onOpenReview && (
            <button
              type="button"
              onClick={onOpenReview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white transition-all cursor-pointer shadow-sm"
            >
              <span>★ Rate &amp; Share Experience</span>
              <span className="text-cyan-400">→</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
