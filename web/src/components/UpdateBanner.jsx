import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const CURRENT_UPDATE_KEY = 'obito_update_seen_2026_10_26_v24';

export const UpdateBanner = ({ isSignedUser, onSwitchTab }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSignedUser) return;
    try {
      const seen = localStorage.getItem(CURRENT_UPDATE_KEY);
      if (!seen) {
        // Mark immediately so a page reload will NEVER show the banner again
        localStorage.setItem(CURRENT_UPDATE_KEY, 'true');
        setVisible(true);
      }
    } catch {
      /* ignore storage exception */
    }
  }, [isSignedUser]);

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleExplore = () => {
    setVisible(false);
    if (onSwitchTab) onSwitchTab('dashboard');
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-5 right-5 z-[110] max-w-md w-[calc(100vw-2.5rem)] pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl p-5 bg-[#0b0d14]/95 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl text-white overflow-hidden"
        >
          {/* Subtle top ambient rim light */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
                Studio Update · October Release
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="size-6 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white text-xs transition-all cursor-pointer"
              aria-label="Dismiss update banner"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5 space-y-1">
            <h4 className="font-clash inframe-title font-medium text-sm sm:text-base text-white tracking-tight">
              Hardware 60fps Pipeline &amp; Personal Telemetry Live
            </h4>
            <p className="font-sans text-xs text-neutral-400 leading-relaxed">
              We updated the video mastering suite with dedicated GPU acceleration, platform telemetry, and personal job history.
            </p>
          </div>

          {/* Key Updates List */}
          <div className="mt-3.5 space-y-2 pt-3 border-t border-white/[0.08] text-xs">
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">GPU Hardware Decoded 60fps:</strong> Comparison player now runs at native 60fps lockstep without browser lag.
              </span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Creator Optimization History:</strong> Track your personal mastered jobs, pipeline modes, and bitrates in your dashboard.
              </span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Live Telemetry &amp; Reviews:</strong> Real-time platform counters and direct engineering feedback channel.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all cursor-pointer"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={handleExplore}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>View Dashboard History</span>
              <span className="text-cyan-400">→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
