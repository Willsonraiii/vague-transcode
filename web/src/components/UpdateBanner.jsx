import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const CURRENT_UPDATE_KEY = 'obito_update_seen_2026_10_30_v3_3_turbo_fix';

export const UpdateBanner = ({ isSignedUser, onSwitchTab }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(CURRENT_UPDATE_KEY);
      if (!seen) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }

    const handleForceShow = () => setVisible(true);
    window.addEventListener('obito:showUpdateBanner', handleForceShow);
    return () => window.removeEventListener('obito:showUpdateBanner', handleForceShow);
  }, []);

  const handleDismiss = () => {
    try { localStorage.setItem(CURRENT_UPDATE_KEY, 'true'); } catch {}
    setVisible(false);
  };

  const handleExplore = () => {
    try { localStorage.setItem(CURRENT_UPDATE_KEY, 'true'); } catch {}
    setVisible(false);
    if (onSwitchTab) onSwitchTab('optimizer');
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
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] font-semibold tracking-wider text-emerald-300 uppercase">
                New Enhancements Live · v3.2
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
              Zero-Buffering Engine &amp; Studio Lossless Audit
            </h4>
            <p className="font-sans text-xs text-neutral-400 leading-relaxed">
              New pipeline updates are active to eliminate TikTok feed stalls and provide verified lossless proof.
            </p>
          </div>

          {/* Key Updates List */}
          <div className="mt-3.5 space-y-2 pt-3 border-t border-white/[0.08] text-xs">
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Pre-Flight Buffer Risk Audit:</strong> Instant on-device bitrate probe alerts you before uploading if a video is too heavy for mobile feeds.
              </span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Studio Lossless Audit Receipt:</strong> Proves 0.00% re-encoding loss, 19200 clock sync, and 10-bit HLG gamut retention on every master.
              </span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Zero-Buffering Interleaving:</strong> Video and Audio Chunk 0 are aligned within ~6 bytes in `mdat` to prevent CDN buffer starvation.
              </span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-amber-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Download Stability &amp; Mobile Memory Fix:</strong> Replaced in-memory RAM buffering with direct kernel streaming so iPhone and Android downloads never reload or break.
              </span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
              <span>
                <strong className="text-white font-medium">Audio Lead-In &amp; btrt Cushion:</strong> Smooth playback buffer pre-allocation for mobile players on slow networks.
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
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleExplore}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg"
            >
              <span>Try Video Optimizer</span>
              <span className="text-emerald-400">→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
