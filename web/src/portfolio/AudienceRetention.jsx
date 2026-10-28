import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { SECTION_EASE } from './primitives';
import { FpsIcon, SunIcon, CheckIcon, SpeakerIcon } from '../icons.jsx';

function useCountUp(target, active, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

export default function AudienceRetention() {
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { once: true, margin: '-10% 0px' });
  const reduced = useReducedMotion();
  const started = inView || reduced;

  const countHold = useCountUp(68, started);
  const countNits = useCountUp(1600, started);

  const CARDS = [
    {
      id: 'motion',
      icon: <FpsIcon width={20} height={20} />,
      tag: 'FEED FLUIDITY',
      metric: `+${countHold}%`,
      metricLabel: 'Higher 3-Second Hold Rate',
      accent: '#6ee7b7',
      title: 'Stops the 30fps Feed Stutter',
      desc: 'Standard 30fps uploads blend into the feed stutter. True 60fps & 120fps motion breaks the scroll rhythm, hooking viewer attention in the decisive first 3 seconds.',
      compare: [
        { label: 'TikTok 30fps Standard', val: '32%', width: '32%', isObito: false },
        { label: 'Obito 60 / 120 FPS Master', val: '68%', width: '68%', isObito: true },
      ],
    },
    {
      id: 'hdr',
      icon: <SunIcon width={20} height={20} />,
      tag: 'DYNAMIC RANGE',
      metric: `${countNits} Nits`,
      metricLabel: 'Peak Highlight Contrast',
      accent: '#f59e0b',
      title: 'OLED Feed Contrast Pop',
      desc: 'TikTok feeds are dark by default. Native Apple HDR (10-bit Rec.2020) forces phone OLED panels to full luminance, making jewelry, lighting, and edges pop with natural depth.',
      compare: [
        { label: 'SDR 8-Bit Clamped', val: '350 nits', width: '25%', isObito: false },
        { label: 'Apple HDR 10-Bit Rec.2020', val: '1,600 nits', width: '100%', isObito: true },
      ],
    },
    {
      id: 'ingest',
      icon: <CheckIcon width={20} height={20} />,
      tag: 'ALGORITHM MOMENTUM',
      metric: '0 sec',
      metricLabel: 'Transcode Queue Delay',
      accent: '#38bdf8',
      title: 'Zero Processing Hang',
      desc: 'High-bitrate files often sit trapped in TikTok processing queues or fail upload during peak posting hours. Obito structures atoms to validate instantly upon upload.',
      compare: [
        { label: 'Standard High-Bitrate', val: '3–15 min hang', width: '75%', isObito: false },
        { label: 'Obito Atom Ingest', val: 'Instant (< 2s)', width: '12%', isObito: true },
      ],
    },
    {
      id: 'audio',
      icon: <SpeakerIcon width={20} height={20} />,
      tag: 'AUDIO RETENTION',
      metric: '0 ms',
      metricLabel: 'Timeline Clock Drift',
      accent: '#a78bfa',
      title: 'Dual-Track Beat Sync',
      desc: 'Music beat drops and voiceovers hit exactly on the cut without platform downmixing or high-frequency clipping, keeping headphone listeners immersed.',
      compare: [
        { label: 'Platform Downmix', val: 'Phase drift & clipping', width: '55%', isObito: false },
        { label: 'Dual-Track AAC', val: 'Untouched passthrough', width: '100%', isObito: true },
      ],
    },
  ];

  return (
    <div ref={rootRef} className="w-full">
      {/* 2x2 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.id}
            className="liquid-glass-frame relative rounded-2xl sm:rounded-3xl p-6 sm:p-7 md:p-8 flex flex-col justify-between overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
            initial={{ opacity: 0.2, y: 24, filter: 'blur(8px)' }}
            animate={started ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
            transition={{ delay: i * 0.1, duration: 0.52, ease: SECTION_EASE }}
          >
            {/* Top Bar: Icon + Tag + Big Metric */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="size-9 rounded-xl flex items-center justify-center border border-white/15 bg-white/[0.06] text-white shadow-inner"
                    style={{ color: card.accent }}
                  >
                    {card.icon}
                  </div>
                  <span className="text-[10.5px] font-clash inframe-title tracking-[0.14em] uppercase text-white/60">
                    {card.tag}
                  </span>
                </div>

                <div className="text-right">
                  <div className="font-clash font-bold text-2xl sm:text-3xl text-white tracking-tight tabular-nums">
                    {card.metric}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-clash inframe-title uppercase tracking-wider text-white/50">
                    {card.metricLabel}
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <h3 className="font-clash font-bold text-lg sm:text-xl text-white mb-2 leading-snug">
                {card.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-neutral-300/80 leading-relaxed mb-6">
                {card.desc}
              </p>
            </div>

            {/* Visual Comparison Track */}
            <div className="rounded-xl border border-white/10 bg-black/25 p-3.5 space-y-2.5">
              {card.compare.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={item.isObito ? 'text-white font-medium' : 'text-neutral-400'}>
                      {item.label}
                    </span>
                    <span className={`font-clash inframe-title text-[10px] ${item.isObito ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}`}>
                      {item.val}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: item.isObito ? card.accent : 'rgba(255,255,255,0.2)',
                        boxShadow: item.isObito ? `0 0 10px ${card.accent}` : 'none'
                      }}
                      initial={{ width: 0 }}
                      animate={started ? { width: item.width } : { width: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 + idx * 0.15, duration: 0.8, ease: SECTION_EASE }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom Summary Bar */}
      <motion.div
        className="mt-6 rounded-2xl border border-white/12 bg-white/[0.035] backdrop-blur-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
        initial={{ opacity: 0, y: 16 }}
        animate={started ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: 0.5, duration: 0.5, ease: SECTION_EASE }}
      >
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-xs sm:text-sm text-neutral-200 font-medium">
            Engineered for creators who measure results in view-through rate and feed impact.
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="px-3 py-1 rounded-full text-[10.5px] font-clash inframe-title text-white/80 bg-white/[0.06] border border-white/12">
            60 &amp; 120 FPS Fluidity
          </span>
          <span className="px-3 py-1 rounded-full text-[10.5px] font-clash inframe-title text-white/80 bg-white/[0.06] border border-white/12">
            Native Apple HDR
          </span>
          <span className="px-3 py-1 rounded-full text-[10.5px] font-clash inframe-title text-white/80 bg-white/[0.06] border border-white/12">
            Zero Quality Loss
          </span>
        </div>
      </motion.div>
    </div>
  );
}
