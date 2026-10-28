import React from 'react';
import { motion } from 'framer-motion';
import { FilmIcon, UploadIcon, TikTokIcon } from './icons.jsx';

const EXPORT_SPECS = [
  { k: 'Resolution', v: '4K (2160×3840) or 1080p' },
  { k: 'Frame Rate', v: '60 fps or 120 fps native' },
  { k: 'Bitrate', v: '20–35 Mbps (Recommended)' },
  { k: 'Color Space', v: 'Rec.2020 HLG or Rec.709' },
  { k: 'Audio Track', v: '48 kHz AAC Stereo' },
];

export default function Guide({ onSwitchToOptimizer, hideHeader = false }) {
  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Optional Top Header if accessed standalone */}
      {!hideHeader && (
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="font-clash inframe-title font-bold text-2xl sm:text-3xl text-white mb-1.5 tracking-tight">
            Creator Upload Guide
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm max-w-md mx-auto font-sans">
            Export specifications and upload protocol to retain native 60/120fps motion and Apple HDR.
          </p>
        </div>
      )}

      {/* 3 Pro Columns (Single Frame / Responsive Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
        {/* Step 01: Export Master */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.04 }}
          className="liquid-glass-frame relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-lg overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-clash inframe-title text-xs font-semibold text-cyan-400 tracking-wider">
                01 / EXPORT
              </span>
              <FilmIcon width={16} height={16} className="text-white/40" />
            </div>

            <h2 className="font-clash inframe-title font-semibold text-base sm:text-[17px] text-white tracking-tight leading-tight mb-1">
              Export Master Video
            </h2>
            <p className="text-[11.5px] text-neutral-400 font-sans mb-3.5 leading-snug">
              DaVinci Resolve · Premiere Pro · CapCut · FCP
            </p>

            {/* Spec Table */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-2.5 space-y-1.5 mb-3">
              {EXPORT_SPECS.map((spec) => (
                <div key={spec.k} className="flex items-center justify-between text-[11px] font-sans gap-2 min-w-0">
                  <span className="text-neutral-400 shrink-0">{spec.k}</span>
                  <span className="font-clash inframe-title font-medium text-white/90 text-right truncate">{spec.v}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 font-sans leading-relaxed pt-2.5 border-t border-white/[0.06]">
            Export vertical 9:16 master at recommended 20–35 Mbps. Obito restructures container atoms with zero pixel re-encoding.
          </p>
        </motion.div>

        {/* Step 02: Mobile Files Rule */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="liquid-glass-frame relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-lg overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-clash inframe-title text-xs font-semibold text-cyan-400 tracking-wider">
                02 / MOBILE RULE
              </span>
              <UploadIcon width={16} height={16} className="text-white/40" />
            </div>

            <h2 className="font-clash inframe-title font-semibold text-base sm:text-[17px] text-white tracking-tight leading-tight mb-1">
              Select via Files App
            </h2>
            <p className="text-[11.5px] text-neutral-400 font-sans mb-3.5 leading-snug">
              Avoid silent photo gallery downsampling
            </p>

            <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/30 p-3 mb-3 text-[11.5px] text-neutral-300 font-sans leading-relaxed">
              <p>
                <b className="text-white">Photo Pickers Compress:</b> Selecting from Camera Roll or Photos silently clamps high bitrates and transcodes Rec.2020 HDR to 8-bit SDR.
              </p>
              <p>
                <b className="text-cyan-300">The Rule:</b> Save your master to the <b className="text-white">Files</b> app. During upload, choose <b className="text-white">Files / Browse</b> instead of Photo Library.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 font-sans leading-relaxed pt-2.5 border-t border-white/[0.06]">
            Maintains 100% of your source bitrate (recommended 20–35 Mbps), fluid 60/120fps motion, and native Apple HDR gamut.
          </p>
        </motion.div>

        {/* Step 03: Direct Web Publishing */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.12 }}
          className="liquid-glass-frame relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-lg overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-clash inframe-title text-xs font-semibold text-cyan-400 tracking-wider">
                03 / PUBLISH
              </span>
              <TikTokIcon width={16} height={16} className="text-white/40" />
            </div>

            <h2 className="font-clash inframe-title font-semibold text-base sm:text-[17px] text-white tracking-tight leading-tight mb-1">
              Publish via Web Uploader
            </h2>
            <p className="text-[11.5px] text-neutral-400 font-sans mb-3.5 leading-snug">
              tiktok.com/upload · Direct to Public
            </p>

            <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/30 p-3 mb-3 text-[11.5px] text-neutral-300 font-sans leading-relaxed">
              <p>
                <b className="text-white">Post Directly as Public:</b> Saving as a <i>Private Draft</i> first invokes TikTok’s aggressive secondary compression pass.
              </p>
              <p>
                <b className="text-cyan-300">Official Direct Post API:</b> Fully built and currently in TikTok Developer review (launching in a couple of days).
              </p>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 font-sans leading-relaxed pt-2.5 border-t border-white/[0.06]">
            Browser web uploading bypasses the mobile app ingest filter to preserve peak master clarity.
          </p>
        </motion.div>
      </div>

      {/* Studio Action & Summary Bar */}
      <div className="mt-3.5 sm:mt-4.5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-lg w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 w-full min-w-0 overflow-hidden justify-center sm:justify-start">
          <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <span className="font-clash inframe-title text-[11px] sm:text-xs text-white/80 font-medium truncate max-w-full">
            Workflow: 60/120fps master (20–35 Mbps) &rarr; Files App &rarr; Public Web Upload
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-center">
          <a
            href="https://www.tiktok.com/upload?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-clash inframe-title text-[11px] font-medium transition-colors"
          >
            tiktok.com/upload &nearr;
          </a>
          {onSwitchToOptimizer && (
            <button
              type="button"
              onClick={onSwitchToOptimizer}
              className="liquid-glass-white px-3.5 py-1.5 rounded-full text-[11px] font-clash inframe-title font-semibold text-white flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer"
            >
              <span>Master Video</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
