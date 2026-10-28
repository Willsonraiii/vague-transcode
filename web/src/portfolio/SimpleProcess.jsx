import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, SECTION_EASE } from './primitives';
import { PremiumKeyIcon, LightningIcon, TikTokIcon } from '../icons.jsx';

const STEPS = [
  {
    step: '01',
    title: 'Login',
    short: 'Pass or TikTok Auth',
    accent: '#38bdf8',
    icon: <PremiumKeyIcon className="size-4" />,
    actionType: 'login',
  },
  {
    step: '02',
    title: 'Optimize',
    short: 'Lossless surgery · 0 re-encode',
    accent: '#a855f7',
    icon: <LightningIcon className="size-4" />,
    actionType: 'optimize',
  },
  {
    step: '03',
    title: 'Post',
    short: 'Official TikTok Direct API (Coming Soon)',
    accent: '#00f2fe',
    icon: <TikTokIcon className="size-4" />,
    actionType: 'post',
  },
];

export default function SimpleProcess({
  onOpenSignIn,
  onSwitchTab,
  ownerAuthenticated,
  memberPreview,
}) {
  const handleAction = (actionType) => {
    if (actionType === 'login') {
      if (ownerAuthenticated && memberPreview) {
        onSwitchTab?.('dashboard');
      } else {
        onOpenSignIn?.();
      }
    } else {
      onSwitchTab?.('optimizer');
    }
  };

  return (
    <div className="w-full">
      {/* Shortest One Frame with 3 Compact Inframe Boxes */}
      <div className="liquid-glass-frame relative rounded-2xl p-2.5 sm:p-3 overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        {/* Top Hairline Specular Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5 relative z-10">
          {STEPS.map((item, idx) => {
            const isLoginAuthed = item.actionType === 'login' && ownerAuthenticated && memberPreview;

            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, duration: 0.35, ease: SECTION_EASE }}
                onClick={() => handleAction(item.actionType)}
                className="group relative rounded-xl px-3.5 py-3 sm:px-4 sm:py-3 border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center justify-between gap-3 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.06] cursor-pointer overflow-hidden"
              >
                {/* Inframe Box Specular Top Highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {/* Left: Icon & Text */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-8 sm:size-9 rounded-lg flex items-center justify-center border border-white/15 bg-black/50 text-white shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                    style={{ color: item.accent }}
                  >
                    {item.icon}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-clash inframe-title text-[10px] sm:text-[11px] font-semibold tracking-wider"
                        style={{ color: item.accent }}
                      >
                        {item.step}
                      </span>
                      <h3 className="font-clash inframe-title font-medium text-sm sm:text-[15px] text-white tracking-tight truncate">
                        {item.title}
                      </h3>
                      {isLoginAuthed && (
                        <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 font-sans truncate leading-tight">
                      {item.short}
                    </p>
                  </div>
                </div>

                {/* Right: Clean Action Arrow */}
                <ArrowUpRight className="size-3.5 text-white/40 transition-transform duration-200 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
