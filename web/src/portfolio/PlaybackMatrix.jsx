import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SECTION_EASE } from './primitives';

const SCREENS = [
  {
    id: 'iphone',
    name: 'iPhone 16 Pro',
    tag: 'Super Retina XDR OLED',
    fps: '120.00 FPS',
    fpsSub: 'ProMotion Dynamic Sync',
    hdr: '10-Bit HLG',
    hdrSub: '1,600 nits Peak Highlight',
    audio: '48 kHz Stereo',
    audioSub: 'Dual-Track AAC Passthrough',
    gamut: 'Rec.2020 Wide',
    badge: 'Apple XDR Active',
    accentColor: '#38bdf8',
    summary: 'Direct HLG Rec.2020 metadata triggers Apple’s native XDR tone mapper. Highlight clipping is eliminated and 120fps motion stays butter-smooth in the TikTok feed.',
    specs: [
      { k: 'Resolution Target', v: '4K Ultra HD' },
      { k: 'Cadence Lock', v: '120Hz ProMotion' },
      { k: 'Color Volume', v: '100% Rec.2020' },
      { k: 'Pixel Quality', v: 'Bit-for-Bit Copy' },
    ],
  },
  {
    id: 'android',
    name: 'Galaxy Ultra 120Hz',
    tag: 'Dynamic AMOLED 2X',
    fps: '60.00 / 120 FPS',
    fpsSub: 'Anti-Stutter Decimator Bypass',
    hdr: 'Ultra HDR / DCI-P3',
    hdrSub: 'Full Dynamic Range',
    audio: '48 kHz 320k',
    audioSub: 'Zero Downmix / Phase Lock',
    gamut: 'DCI-P3 Extended',
    badge: 'LTPO 120Hz Locked',
    accentColor: '#cbd5e1',
    summary: 'Bypasses TikTok mobile compression which cuts standard uploads to 30fps. Native cadence lock forces 60fps & 120fps display refresh synchronization with zero judder.',
    specs: [
      { k: 'Resolution Target', v: '4K · 120 FPS Fluid' },
      { k: 'Frame Drop', v: '0 Frames Decimated' },
      { k: 'Ingest Speed', v: '< 2.4s Validation' },
      { k: 'Playback', v: 'Fluid High-FPS' },
    ],
  },
  {
    id: 'studio',
    name: 'Reference Studio Master',
    tag: 'DaVinci / Premiere Timeline',
    fps: 'Native Timeline',
    fpsSub: 'Speed Factor 1 Cadence',
    hdr: 'Master Color Grade',
    hdrSub: 'Preserved Gamut Integrity',
    audio: 'Master Bus Audio',
    audioSub: 'Full Dynamic Headroom',
    gamut: 'Cinema Master',
    badge: 'Zero Upload Hang',
    accentColor: '#ffffff',
    summary: 'Fixes the notorious "video processing stuck" hang caused by timeline drift. Delivers flawless 4K, 60fps & 120fps playback with zero generational pixel degradation.',
    specs: [
      { k: 'Master Detail', v: '4K Bit-for-Bit' },
      { k: 'Processing Hang', v: '0s (Bypassed)' },
      { k: 'Audio Latency', v: '0ms Clock Drift' },
      { k: 'Generational Loss', v: '0.00% Quality Loss' },
    ],
  },
];

export default function PlaybackMatrix() {
  const [activeScreenId, setActiveScreenId] = useState(SCREENS[0].id);
  const current = SCREENS.find((s) => s.id === activeScreenId) || SCREENS[0];

  return (
    <div className="w-full">
      {/* Device Selector Tabs */}
      <div className="flex items-center justify-center gap-2 mb-8 sm:mb-12 overflow-x-auto pb-2 scrollbar-none select-none">
        {SCREENS.map((screen) => {
          const isActive = screen.id === activeScreenId;
          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => setActiveScreenId(screen.id)}
              className={`liquid-glass-chip flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-[13px] font-medium transition-all duration-300 ${
                isActive
                  ? 'border-white/35 bg-white/[0.12] text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: screen.accentColor }}
              />
              <span className="font-clash">{screen.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
        {/* Left: Device Telemetry Glass Monitor (7 cols) */}
        <div className="lg:col-span-7 liquid-glass-frame relative rounded-3xl p-6 sm:p-8 md:p-10 flex flex-col justify-between overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

          {/* Top Monitor Status Bar */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span
                  className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: current.accentColor }}
                />
                <span
                  className="relative inline-flex size-2 rounded-full"
                  style={{ backgroundColor: current.accentColor }}
                />
              </span>
              <span className="font-clash inframe-title text-[11px] uppercase tracking-wider text-white/90">
                {current.tag}
              </span>
            </div>

            <span className="font-clash inframe-title text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/75">
              {current.badge}
            </span>
          </div>

          {/* Live Simulated HUD Telemetry Matrix */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: SECTION_EASE }}
              className="space-y-6"
            >
              {/* Primary Readout Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                  <span className="block text-[10px] font-clash inframe-title uppercase tracking-wider text-white/45 mb-1">
                    Frame Cadence
                  </span>
                  <span className="font-clash inframe-title font-medium text-xl sm:text-2xl text-white block tracking-[-0.02em]">
                    {current.fps}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-clash inframe-title mt-0.5 block truncate">
                    {current.fpsSub}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                  <span className="block text-[10px] font-clash inframe-title uppercase tracking-wider text-white/45 mb-1">
                    Dynamic Range
                  </span>
                  <span className="font-clash inframe-title font-medium text-xl sm:text-2xl text-white block tracking-[-0.02em]">
                    {current.hdr}
                  </span>
                  <span className="text-[11px] text-sky-400 font-clash inframe-title mt-0.5 block truncate">
                    {current.hdrSub}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                  <span className="block text-[10px] font-clash inframe-title uppercase tracking-wider text-white/45 mb-1">
                    Audio Pipeline
                  </span>
                  <span className="font-clash inframe-title font-medium text-xl sm:text-2xl text-white block tracking-[-0.02em]">
                    {current.audio}
                  </span>
                  <span className="text-[11px] text-purple-300 font-clash inframe-title mt-0.5 block truncate">
                    {current.audioSub}
                  </span>
                </div>
              </div>

              {/* Graphical Stream-Copy Wave Pulse */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] relative overflow-hidden">
                <div className="flex items-center justify-between text-[10px] font-clash inframe-title text-white/40 mb-2">
                  <span>STREAM INTEGRITY TIMELINE</span>
                  <span>100% BIT-FOR-BIT</span>
                </div>
                <div className="h-10 flex items-end gap-1 select-none" aria-hidden="true">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const h = 30 + ((i * 17) % 65);
                    return (
                      <span
                        key={i}
                        className="flex-1 rounded-sm opacity-60 transition-all duration-300 hover:opacity-100"
                        style={{
                          height: `${h}%`,
                          backgroundColor: i % 2 === 0 ? current.accentColor : 'rgba(255,255,255,0.25)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Explanatory Technical Rationale */}
              <p className="font-bricolage text-sm sm:text-[15px] text-neutral-300 leading-relaxed pt-1">
                {current.summary}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Technical Atom Breakdown (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="liquid-glass-frame rounded-3xl p-6 sm:p-7 relative overflow-hidden flex-1 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <h4 className="font-clash inframe-title font-medium text-xl text-white mb-4 tracking-[-0.02em]">
              Hardware Alignment
            </h4>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {current.specs.map((item) => (
                  <div
                    key={item.k}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-clash inframe-title"
                  >
                    <span className="text-neutral-400">{item.k}</span>
                    <span className="text-white font-medium">{item.v}</span>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Quick Platform Rule Callout */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.025] border border-white/[0.08] flex items-center gap-3">
            <span className="size-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <p className="text-xs text-neutral-400 font-bricolage leading-normal">
              Obito Studio executes lossless video mastering. 4K detail, 60fps &amp; 120fps motion, and HDR colors are never re-encoded or degraded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
