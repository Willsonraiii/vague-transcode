import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion';
import { SECTION_EASE } from './primitives';
import { CheckIcon } from '../icons.jsx';

const CATEGORIES = [
  { id: 'all', label: 'Complete Ecosystem' },
  { id: 'nle', label: 'Desktop NLEs' },
  { id: 'mobile', label: 'Mobile Apps' },
  { id: 'cameras', label: 'Cinema & Cameras' },
];

const ECOSYSTEM_ITEMS = [
  // 1. Desktop Editing Suites
  {
    id: 'davinci',
    category: 'nle',
    name: 'DaVinci Resolve Studio',
    subtitle: 'Blackmagic Design Timeline',
    tag: 'COLOR REFERENCE NLE',
    accentColor: '#38bdf8',
    formats: ['Rec.2020 HLG', 'ACEScct', 'Apple ProRes 422 HQ', '10-Bit H.265 (20–35 Mbps)'],
    specs: [
      { k: 'Color Gamut', v: 'Rec.2020 / P3-D65' },
      { k: 'Framerate Sync', v: 'Native 60.00 / 120.00' },
      { k: 'Transfer Atom', v: 'arib-std-b67 / hlg' },
      { k: 'Ingest Integrity', v: '100% Bit-for-Bit' },
    ],
    note: 'Export QuickTime ProRes or HEVC Master at recommended 20–35 Mbps. Obito Studio restructures timescale metadata to prevent TikTok 30fps downsampling and highlight clipping.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#121318" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        {/* DaVinci Resolve authentic 3-color pinwheel */}
        <path d="M12 12C12 7.2 15.6 4.4 18.2 5.5C19.8 6.2 20.2 8.6 19.1 10.6C18 12.6 15 12 12 12Z" fill="#ff4d4d" />
        <path d="M12 12C15.6 14.6 17.2 18.2 15.1 19.7C13.5 20.7 11.1 19.9 9.8 18C8.8 16.4 9.8 13.4 12 12Z" fill="#00b4d8" />
        <path d="M12 12C8.4 14.1 4.8 13.5 4.3 10.9C3.8 9 5.4 7.3 7.4 7.3C9.4 7.3 10.9 9.9 12 12Z" fill="#10b981" />
        <circle cx="12" cy="12" r="2.2" fill="#0b0c10" stroke="#ffffff" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: 'premiere',
    category: 'nle',
    name: 'Adobe Premiere Pro',
    subtitle: 'Creative Cloud Timeline',
    tag: 'INDUSTRY STANDARD NLE',
    accentColor: '#cbd5e1',
    formats: ['PQ / HLG HDR', 'ProRes Masters', 'Sony XAVC S-I', 'Rec.709 Wide'],
    specs: [
      { k: 'Sequence Sync', v: '60 & 120 FPS Fluid' },
      { k: 'Bit Depth', v: '10-Bit / 12-Bit Color' },
      { k: 'Audio Track', v: 'Dual-Track 48kHz AAC' },
      { k: 'Processing Hang', v: 'Bypassed (0s)' },
    ],
    note: 'Eliminates the common "processing stuck at 99%" error on TikTok by rebuilding the moov header ahead of media samples. Recommended export bitrate: 20–35 Mbps.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#130426" stroke="#9999ff" strokeWidth="1" strokeOpacity="0.45" />
        {/* Authentic Pr emblem */}
        <path d="M5.5 6.5h4.2c1.9 0 3.1 1.1 3.1 2.8 0 1.6-1.2 2.8-3.1 2.8H7.7V17.5H5.5V6.5zm2.2 3.8h2c.7 0 1.2-.4 1.2-1.1 0-.6-.5-1.1-1.2-1.1h-2v2.2z" fill="#ea80fc" />
        <path d="M14.5 9.8h2.1v1.3c.5-.9 1.4-1.4 2.4-1.3v2.2c-1.4-.1-2.2.7-2.2 2.1v3.4h-2.3V9.8z" fill="#ea80fc" />
      </svg>
    ),
  },
  {
    id: 'fcp',
    category: 'nle',
    name: 'Apple Final Cut Pro',
    subtitle: 'Apple Silicon Native',
    tag: 'MAC WORKSTATION NLE',
    accentColor: '#ffffff',
    formats: ['Wide Gamut HDR', 'ProRes 422', 'Apple Log LUT', 'Dolby Vision HLG'],
    specs: [
      { k: 'HDR Space', v: 'Wide Gamut Rec. 2020' },
      { k: 'Cadence Guard', v: 'ProMotion Dynamic 120' },
      { k: 'Audio Engine', v: 'Direct Passthrough' },
      { k: 'Generation Loss', v: '0.00% Zero Loss' },
    ],
    note: 'Native support for Apple Silicon media engines. Export ProRes or HEVC master at 20–35 Mbps directly; Obito packages container atoms without recompression.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect x="2" y="3" width="20" height="18" rx="4" fill="#181a22" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        <path d="M2 7.5h20V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2.5z" fill="#242834" />
        <path d="M5 3l2 4.5M9 3l2 4.5M13 3l2 4.5M17 3l2 4.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="2" y="7.5" width="20" height="2" fill="url(#fcpGradient)" />
        <line x1="5" y1="13" x2="19" y2="13" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
        <line x1="5" y1="16.5" x2="15" y2="16.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
        <defs>
          <linearGradient id="fcpGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="35%" stopColor="#818cf8" />
            <stop offset="70%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },

  // 2. Mobile Editing Apps
  {
    id: 'capcut',
    category: 'mobile',
    name: 'CapCut',
    subtitle: 'ByteDance Mobile & Desktop Timeline',
    tag: 'MOBILE CREATOR TIMELINE',
    accentColor: '#00f2fe',
    formats: ['4K 60 FPS Export', 'High Bitrate Mode', 'HDR Video Mode', 'Lossless Ingest'],
    specs: [
      { k: 'Export Preset', v: '4K · 20–35 Mbps Rec.' },
      { k: 'Compression Bypass', v: '100% Bit-for-Bit' },
      { k: 'Bitrate Cap', v: 'Preserved (No Drop)' },
      { k: 'Direct Post', v: 'Seamless Ingestion' },
    ],
    note: 'Export your edit in 4K 60fps at recommended 20–35 Mbps. Obito Studio restructures the container atoms to bypass TikTok’s heavy mobile re-compression, keeping text, effects, and fluid motion sharp.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#0b0c10" stroke="rgba(0,242,254,0.3)" strokeWidth="1" />
        {/* Authentic CapCut dual ribbon cutters */}
        <path d="M4.5 5.8h6.2l4.8 5a1.8 1.8 0 0 1 0 2.4l-4.8 5H4.5l4.8-5a1.8 1.8 0 0 0 0-2.4L4.5 5.8z" fill="#ffffff" />
        <path d="M19.5 18.2h-6.2l-4.8-5a1.8 1.8 0 0 1 0-2.4l4.8-5h6.2l-4.8 5a1.8 1.8 0 0 0 0 2.4l4.8 5z" fill="#00f2fe" />
      </svg>
    ),
  },
  {
    id: 'vn',
    category: 'mobile',
    name: 'VN Video Editor',
    subtitle: 'VlogNow Mobile & iPad',
    tag: 'MOBILE TIMELINE NLE',
    accentColor: '#00f0ff',
    formats: ['Custom 100Mbps Bitrate', 'Curve Speed Sync', '4K 60 FPS Native', 'Rec.709 Wide'],
    specs: [
      { k: 'Speed Ramps', v: 'Cadence Locked 60Hz' },
      { k: 'Audio Sampling', v: 'Dual-Track 48kHz' },
      { k: 'Bitrate Ceiling', v: 'Up to 100 Mbps' },
      { k: 'Processing Queue', v: 'Instant (< 2s)' },
    ],
    note: 'Popular among mobile cinematographers for smooth velocity edits. Obito locks VN’s 60fps speed curve timestamps so beat drops and speed ramps don’t stutter or drop frames on TikTok.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#0e1017" stroke="rgba(0,240,255,0.3)" strokeWidth="1" />
        {/* Authentic VN linked typography */}
        <path d="M5.2 7.2h2.4l2.4 7.2 2.4-7.2h2.4l-3.6 9.6H8.8L5.2 7.2z" fill="#00f0ff" />
        <path d="M14 7.2h2.2v5.3l3.2-5.3h2.2v9.6h-2.2v-5.3l-3.2 5.3H14V7.2z" fill="#ffffff" />
      </svg>
    ),
  },
  {
    id: 'adobemobile',
    category: 'mobile',
    name: 'Adobe Video Editor (iOS)',
    subtitle: 'Premiere Rush & Mobile for iPhone & iPad',
    tag: 'APPLE SILICON MOBILE NLE',
    accentColor: '#f43f5e',
    formats: ['Apple Silicon Render', '4K 60 FPS Mobile', 'Multi-Track Audio', 'Color Lumetri'],
    specs: [
      { k: 'Platform Sync', v: 'iOS / iPadOS Native' },
      { k: 'Audio Engine', v: 'Stereo AAC Passthrough' },
      { k: 'Color Space', v: 'Rec.709 / P3 Display' },
      { k: 'Timeline Drift', v: '0 ms Clock Sync' },
    ],
    note: 'Export directly on your iPhone or iPad. Obito Studio harmonizes timeline clocks and patches container atoms so mobile Adobe edits post at full visual fidelity with zero transcode lag.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#1f0727" stroke="#f43f5e" strokeWidth="1" strokeOpacity="0.45" />
        {/* Authentic Ru mobile emblem */}
        <path d="M5.5 6.5h4.5c1.8 0 2.9 1 2.9 2.5 0 1.2-.8 2-1.8 2.3l2.2 4.2H11l-1.9-3.8H7.7v3.8H5.5V6.5zm2.2 3.4h2.1c.6 0 1-.3 1-.8 0-.5-.4-.8-1-.8H7.7v1.6z" fill="#f43f5e" />
        <path d="M14.5 10.2h2.1v4.4c0 .8.4 1.2 1.1 1.2s1.1-.4 1.1-1.2v-4.4h2.1v4.6c0 1.9-1.2 2.9-3.2 2.9-2 0-3.2-1-3.2-2.9v-4.6z" fill="#fda4af" />
      </svg>
    ),
  },

  // 3. Cinema & Cameras
  {
    id: 'iphone',
    category: 'cameras',
    name: 'Apple iPhone Pro',
    subtitle: 'iPhone 15 Pro · iPhone 16 Pro',
    tag: 'MOBILE LOG & HDR',
    accentColor: '#38bdf8',
    formats: ['4K 120 FPS ProRes', 'Apple Log', 'Dolby Vision HDR', 'Spatial Audio'],
    specs: [
      { k: 'Mobile Ingest', v: '4K 120 FPS Direct' },
      { k: 'Color Profile', v: 'Apple Log Rec.2020' },
      { k: 'Display Sync', v: 'ProMotion 120Hz' },
      { k: 'Direct Post', v: 'Instant Direct Upload' },
    ],
    note: 'Full support for iPhone 16 Pro 4K 120fps ProRes Log captures. Preserves native Apple Log tonemapping and ProMotion fluidity across the entire TikTok feed.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#14151a" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
        {/* Authentic Apple Silhouette */}
        <path d="M15.4 13.1c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.7-1.8-3.3-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.9-.4 7.2 1.2 9.5.8 1.1 1.6 2.3 2.9 2.2 1.1 0 1.6-.7 2.8-.7s1.8.7 2.9.7c1.2 0 2-1.1 2.7-2.1.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.2-.9-2.2-3.1z" fill="#f8fafc" />
        <path d="M14 6.6c.6-.8 1-1.8.9-2.9-.9.1-1.9.6-2.5 1.3-.6.7-1 1.7-.9 2.8 1 0 1.9-.5 2.5-1.2z" fill="#f8fafc" />
      </svg>
    ),
  },
  {
    id: 'sony',
    category: 'cameras',
    name: 'Sony Cinema & Alpha',
    subtitle: 'FX3 · FX6 · A7S III · A1',
    tag: 'CINEMA SENSOR',
    accentColor: '#ff6a00',
    formats: ['XAVC S-I 4:2:2', 'S-Log3 / S-Gamut3.Cine', '4K 120p All-Intra', 'S-Cinetone'],
    specs: [
      { k: 'Max Framerate', v: '120.00 FPS Native' },
      { k: 'Color Sampling', v: '10-Bit 4:2:2 Passthrough' },
      { k: 'Dynamic Range', v: '15+ Stops Preserved' },
      { k: 'Container Match', v: 'MP4 / QuickTime Sync' },
    ],
    note: 'High-framerate 120p action and low-light S-Log3 color grades retain full dynamic range without TikTok posterization or color banding.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#121316" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* Authentic Sony Alpha α symbol */}
        <path d="M17.8 16.5c-1.1 0-2.1-.5-2.8-1.4-.9 1-2 1.4-3.5 1.4-2.7 0-4.6-2-4.6-4.7 0-2.8 1.9-4.7 4.6-4.7 1.4 0 2.5.5 3.4 1.4V7.2h2.1v9.3h.8zM11.5 9.7c-1.5 0-2.5 1.1-2.5 2.7s1 2.7 2.5 2.7c1.3 0 2.2-.9 2.5-2.1v-.6c-.3-1.3-1.2-2.1-2.5-2.1z" fill="#ff6a00" />
      </svg>
    ),
  },
  {
    id: 'canon',
    category: 'cameras',
    name: 'Canon Cinema EOS',
    subtitle: 'C70 · C300 Mk III · R5 C · R6 II',
    tag: 'CINEMA SENSOR',
    accentColor: '#dc2626',
    formats: ['Canon Log 2 / 3', 'Cinema RAW Light', 'XF-AVC 10-Bit', '4K 120p High Frame Rate'],
    specs: [
      { k: 'Gamma Curve', v: 'Canon Log 2 / 3 Wide' },
      { k: 'Ingest Speed', v: 'Direct Stream Copy' },
      { k: 'Peak Highlights', v: '1,600 Nits Target' },
      { k: 'Cadence Ripple', v: 'Eliminated' },
    ],
    note: 'Wide Canon gamut timelines are harmonized to match TikTok ingestion standards while preserving organic highlight rolloff.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#121316" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* Authentic Canon Cinema C emblem */}
        <path d="M15.8 8.4C14.8 7.4 13.5 6.8 12 6.8c-2.9 0-5.2 2.3-5.2 5.2s2.3 5.2 5.2 5.2c1.5 0 2.8-.6 3.8-1.6l1.6 1.6c-1.4 1.4-3.3 2.2-5.4 2.2-4.2 0-7.4-3.3-7.4-7.4S7.8 4.6 12 4.6c2.1 0 4 .8 5.4 2.2l-1.6 1.6z" fill="#dc2626" />
        <circle cx="17.8" cy="12" r="1.6" fill="#f59e0b" />
      </svg>
    ),
  },
  {
    id: 'red',
    category: 'cameras',
    name: 'RED Digital Cinema',
    subtitle: 'V-Raptor 8K · Komodo-X 6K',
    tag: 'CINEMA SENSOR',
    accentColor: '#ef4444',
    formats: ['REDCODE RAW', 'IPP2 Color Pipeline', 'ProRes 4444 / 422 HQ', 'High-Speed Global Shutter'],
    specs: [
      { k: 'Master Clarity', v: '4K Bit-for-Bit' },
      { k: 'Motion Lock', v: '120 FPS High-Speed' },
      { k: 'Color Science', v: 'RED IPP2 Standard' },
      { k: 'Recompression', v: '0% (Never Re-encoded)' },
    ],
    note: 'Master downsamples from 8K/6K sensor captures retain cinema-grade sharpness with zero secondary pixel degradation.',
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="5.5" fill="#0d0e12" stroke="rgba(239,68,68,0.35)" strokeWidth="1" />
        {/* Authentic RED Cinema R */}
        <path d="M5.5 5.8h6.5c2.4 0 4 1.4 4 3.4 0 1.4-.8 2.4-2.1 2.9L18 18.2h-3.3l-3.2-5.1H8.7v5.1H5.5V5.8zm3.2 4.9h3.3c1 0 1.7-.5 1.7-1.3 0-.8-.7-1.3-1.7-1.3H8.7v2.6z" fill="#ef4444" />
        <path d="M17.2 6.8h1.6v1.6h-1.6zM17.2 10.2h1.6v1.6h-1.6z" fill="#ffffff" />
      </svg>
    ),
  },
];

export default function ProductionEcosystem() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedId, setSelectedId] = useState('davinci');
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { once: true, margin: '-8% 0px' });
  const reduced = useReducedMotion();
  const started = inView || reduced;

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    const newFiltered = catId === 'all'
      ? ECOSYSTEM_ITEMS
      : ECOSYSTEM_ITEMS.filter((item) => item.category === catId);
    if (!newFiltered.some((item) => item.id === selectedId)) {
      setSelectedId(newFiltered[0]?.id || 'davinci');
    }
  };

  const filtered = activeCategory === 'all'
    ? ECOSYSTEM_ITEMS
    : ECOSYSTEM_ITEMS.filter((item) => item.category === activeCategory);

  const current = ECOSYSTEM_ITEMS.find((item) => item.id === selectedId) || ECOSYSTEM_ITEMS[0];
  const currentIndex = Math.max(0, filtered.findIndex((item) => item.id === current.id));

  const handleNextPass = () => {
    const nextIdx = (currentIndex + 1) % filtered.length;
    setSelectedId(filtered[nextIdx].id);
  };

  const handlePrevPass = () => {
    const prevIdx = (currentIndex - 1 + filtered.length) % filtered.length;
    setSelectedId(filtered[prevIdx].id);
  };

  return (
    <div ref={rootRef} className="w-full">
      {/* Category Filter Controls */}
      <div className="flex items-center justify-center gap-2 mb-8 sm:mb-10 overflow-x-auto pb-2 scrollbar-none select-none">
        {CATEGORIES.map((cat) => {
          const isActive = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className={`liquid-glass-chip flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-[13px] font-medium transition-all duration-300 ${
                isActive
                  ? 'border-white/35 bg-white/[0.12] text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <span className="font-clash">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage: 2-Column Split (3D Directional Stage on Left, Inspector on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: 3D Directional Stage Deck (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3 select-none">
          {/* 1. Clean Direction & Navigation Bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="font-clash inframe-title text-xs font-semibold tracking-[0.14em] uppercase text-white/80">
                MASTER PROTOCOL
              </span>
              <span className="font-clash inframe-title text-xs text-white/40">
                · {String(currentIndex + 1).padStart(2, '0')}/{String(filtered.length).padStart(2, '0')}
              </span>
            </div>

            {/* Directional Arrows & Direct Cue */}
            <div className="flex items-center gap-2">
              <span className="font-clash inframe-title text-[11px] text-neutral-400 hidden sm:inline-block">
                Directional Deck
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevPass}
                  aria-label="Previous Platform"
                  className="size-7 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.12] hover:border-white/35 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleNextPass}
                  aria-label="Next Platform"
                  className="size-7 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.12] hover:border-white/35 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Direct Icon Rail: Quick one-tap access across all platforms */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-x-auto scrollbar-none shadow-inner">
            {filtered.map((item, idx) => {
              const isSelected = item.id === current.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  title={item.name}
                  className={`size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border border-white/40 bg-white/[0.16] shadow-[0_0_16px_rgba(255,255,255,0.2)] scale-105'
                      : 'border border-transparent bg-white/[0.02] hover:bg-white/[0.07] hover:border-white/15 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="scale-75 sm:scale-85 pointer-events-none">
                    {item.icon}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. The 3D Layered Card Stage (Deep, Tactile, Non-flat) */}
          <div
            className="relative w-full pt-1 pb-2 min-h-[340px] flex items-center justify-center"
            style={{ perspective: 1200 }}
          >
            {/* Ambient Studio Backlight Glow */}
            <div
              className="absolute inset-x-8 top-10 bottom-6 rounded-3xl blur-3xl opacity-35 -z-10 transition-all duration-700 pointer-events-none"
              style={{ background: current.accentColor }}
            />

            {/* Peeking Background Card 2 (Deepest Layer in 3D space) */}
            {filtered.length > 2 && (
              <div
                onClick={() => {
                  const idx2 = (currentIndex + 2) % filtered.length;
                  setSelectedId(filtered[idx2].id);
                }}
                className="absolute inset-x-0 h-[280px] rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md cursor-pointer transition-all duration-500 pointer-events-auto hidden sm:block"
                style={{
                  transform: 'translateX(38px) translateY(-16px) translateZ(-60px) scale(0.88) rotateY(-10deg)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                  filter: 'brightness(0.45) blur(1px)',
                  zIndex: 10,
                }}
              />
            )}

            {/* Peeking Background Card 1 (Mid Layer in 3D space) */}
            {filtered.length > 1 && (
              <div
                onClick={handleNextPass}
                className="absolute inset-x-0 h-[300px] rounded-3xl border border-white/15 bg-white/[0.04] backdrop-blur-lg cursor-pointer transition-all duration-500 pointer-events-auto"
                style={{
                  transform: 'translateX(20px) translateY(-8px) translateZ(-30px) scale(0.94) rotateY(-5deg)',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.85)',
                  filter: 'brightness(0.65) blur(0.5px)',
                  zIndex: 20,
                }}
              >
                <div className="p-4 flex items-center justify-between opacity-70">
                  <span className="font-clash inframe-title text-xs text-white/70">
                    {filtered[(currentIndex + 1) % filtered.length]?.name}
                  </span>
                  <span className="font-clash inframe-title text-[11px] text-white/50">Next Pass →</span>
                </div>
              </div>
            )}

            {/* Active Featured Card (Foreground 3D Glass Master) */}
            <motion.div
              key={current.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative z-30 w-full rounded-3xl p-5 sm:p-6 border border-white/30 bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-black/85 backdrop-blur-2xl overflow-hidden"
              style={{
                boxShadow: `0 35px 70px -15px rgba(0,0,0,0.95), 0 0 35px -5px ${current.accentColor}40, inset 0 1px 2px rgba(255,255,255,0.6)`,
              }}
            >
              {/* Top Glass Highlight Edge */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

              {/* Glowing Brand Accent Beacon Line */}
              <div
                className="absolute inset-x-0 top-0 h-1 opacity-90 pointer-events-none"
                style={{ background: `linear-gradient(90deg, transparent, ${current.accentColor}, transparent)` }}
              />

              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="size-11 sm:size-12 rounded-2xl flex items-center justify-center border border-white/25 bg-black/60 text-white shrink-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"
                    style={{ color: current.accentColor }}
                  >
                    {current.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-clash inframe-title font-medium text-base sm:text-lg text-white tracking-[-0.02em] truncate">
                        {current.name}
                      </h3>
                      <span className="font-clash inframe-title text-[10.5px] tracking-wider uppercase text-white/50 hidden sm:inline-block">
                        · {current.tag}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-300 truncate block font-sans">
                      {current.subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 font-clash inframe-title text-[10.5px] font-medium tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    DIRECT INGEST
                  </span>
                </div>
              </div>

              {/* Lossless Surgery Note */}
              <p className="text-xs sm:text-[13px] text-neutral-200 leading-relaxed font-sans mb-4">
                {current.note}
              </p>

              {/* Ingest Formats Chips */}
              <div className="mb-4">
                <span className="font-clash inframe-title text-xs font-medium tracking-wide uppercase text-white/50 block mb-1.5">
                  Supported Timelines &amp; Format Atom Passthrough
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {current.formats.map((fmt) => (
                    <span
                      key={fmt}
                      className="font-clash inframe-title text-xs text-white/90 bg-white/[0.07] border border-white/15 px-2.5 py-0.5 rounded-md"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick Specs Micro-Matrix */}
              <div className="pt-3.5 border-t border-white/[0.1] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {current.specs.map((sp) => (
                  <div key={sp.k} className="p-1.5 rounded-lg bg-black/40 border border-white/[0.08]">
                    <span className="font-clash inframe-title text-[9.5px] text-white/50 block uppercase truncate">{sp.k}</span>
                    <span className="font-clash inframe-title text-[11px] text-white font-medium block truncate">{sp.v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* 4. Directional Progress Track */}
          <div className="flex items-center gap-1 px-1 mt-1">
            {filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-label={`Jump to ${item.name}`}
                className={`h-1 flex-1 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                    : 'bg-white/15 hover:bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Specification & Compatibility Monitor (5 cols) */}
        <div className="lg:col-span-5 liquid-glass-frame relative rounded-2xl sm:rounded-3xl p-6 sm:p-7 flex flex-col justify-between overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

          <div>
            {/* Header Status */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-full animate-pulse" style={{ backgroundColor: current.accentColor }} />
                <span className="font-clash inframe-title text-xs font-semibold tracking-[0.14em] uppercase text-white/80">
                  VERIFIED PROTOCOL
                </span>
              </div>
              <span className="font-clash inframe-title text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckIcon width={13} height={13} />
                <span>Lossless Ingest</span>
              </span>
            </div>

            {/* Title & Tag */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-clash inframe-title font-medium text-xl sm:text-2xl text-white tracking-[-0.02em]">
                  {current.name}
                </h3>
              </div>
              <span className="font-clash inframe-title text-xs text-neutral-400 block mb-3">
                {current.subtitle} · {current.tag}
              </span>
              <p className="text-xs sm:text-[13px] text-neutral-300 leading-relaxed font-sans">
                {current.note}
              </p>
            </div>

            {/* Formats Chips */}
            <div className="mb-6">
              <span className="font-clash inframe-title text-xs font-medium tracking-wide uppercase text-white/50 block mb-2">
                SUPPORTED TIMELINES &amp; SENSORS
              </span>
              <div className="flex flex-wrap gap-1.5">
                {current.formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="font-clash inframe-title text-xs text-white/90 bg-white/[0.06] border border-white/12 px-2.5 py-1 rounded-md"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            {/* 4-Item Spec Matrix */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {current.specs.map((spec) => (
                <div key={spec.k} className="rounded-xl border border-white/[0.08] bg-black/30 p-2.5 sm:p-3">
                  <span className="font-clash inframe-title text-[10px] text-white/50 block mb-1 uppercase">
                    {spec.k}
                  </span>
                  <span className="font-clash inframe-title font-medium text-xs sm:text-sm text-white tracking-[-0.02em]">
                    {spec.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Security Guarantee */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-neutral-400">
            <span className="font-clash inframe-title">Surgery Mode: Atom Passthrough</span>
            <span className="font-clash inframe-title text-emerald-400 font-medium">0% Transcode Loss</span>
          </div>
        </div>
      </div>

      {/* Bottom Full Ecosystem Footnote */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <span className="text-xs text-neutral-300 font-sans">
          Also compatible with <b>RED R3D</b>, <b>ARRI ProRes</b>, <b>Blackmagic RAW</b>, and <b>Sony XAVC S</b> masters exported in standard QuickTime/MP4 containers.
        </span>
        <span className="font-clash inframe-title text-xs text-white/60 shrink-0">
          SMPTE Timecode · 19200 Timescale Harmonized
        </span>
      </div>
    </div>
  );
}
