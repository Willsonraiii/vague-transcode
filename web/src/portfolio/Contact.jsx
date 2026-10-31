import React from 'react';
import { ArrowUpRight, RingLink } from './primitives';
import { cn } from '@/lib/utils';
import Logo from '../Logo.jsx';

const EMAIL = 'resume@willsonrai.com.np';

const SOCIALS = [
  {
    label: 'WhatsApp',
    href: 'https://wa.me/9779813952103?text=Hi%20Willson%2C%20contacting%20regarding%20Obito%20Studio.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.18 8.18 0 0 1-5.82 2.42c-1.48 0-2.93-.39-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/Willsonraiii/vague-transcode',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com/@willsonrai',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
];

const MARQUEE_WORDS = [
  'Building The Future',
  'Mastering Motion',
  'Lossless 60fps',
  '4K Ultra HD',
  '120fps Fluidity',
  'Native Apple HDR',
  'Zero Quality Loss',
];

const Marquee = () => {
  return (
    <div className="flex overflow-hidden py-4 select-none mb-4 sm:mb-8 border-y border-white/[0.06] bg-white/[0.015]" aria-hidden="true">
      <div className="flex w-max shrink-0 animate-marquee">
        {Array.from({ length: 4 }).map((_, group) => (
          <div key={group} className="flex shrink-0 items-center">
            {MARQUEE_WORDS.map((w, i) => (
              <span
                key={i}
                className="font-clash px-6 text-xl sm:text-2xl md:text-3xl font-semibold tracking-[-0.02em] whitespace-nowrap text-white/20 uppercase select-none"
              >
                {w} <span className="text-white/10 mx-2">/</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Contact = ({ onSwitchTab }) => {
  return (
    <footer id="contact" className="relative overflow-hidden bg-[hsl(var(--bg))] pt-16 pb-8 md:pt-20 md:pb-12 border-t border-[hsl(var(--stroke))] mt-16 sm:mt-24">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <video
          src="/media/portfolio/background.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-full min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 -scale-y-100 object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[hsl(var(--bg))] to-transparent" />
      </div>

      <Marquee />

      <div className="container-hirael px-4 sm:px-6">
        {/* iOS 26 Liquid-Glass Inquiry Panel */}
        <div className="liquid-glass-frame relative rounded-3xl p-8 sm:p-12 md:p-14 my-8 sm:my-14 text-center overflow-hidden max-w-3xl mx-auto shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

          <h3 className="font-clash font-bold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight mb-3">
            Master Your Timeline
          </h3>

          <p className="font-bricolage text-sm sm:text-base text-neutral-400 max-w-md mx-auto mb-8 leading-relaxed">
            Direct engineering line for video mastering pipelines, creator integrations, and lossless 60fps / HDR workflow assistance.
          </p>

          <RingLink
            href={`mailto:${EMAIL}`}
            outerClassName="inline-block transition-transform duration-300 hover:scale-105"
            innerClassName="liquid-glass-chip rounded-full px-6 py-3.5 sm:px-8 sm:py-4 font-clash text-lg sm:text-2xl font-medium text-white flex items-center justify-center gap-3 hover:border-white/40 shadow-lg"
          >
            <span>{EMAIL}</span>
            <ArrowUpRight className="size-4 text-emerald-400" />
          </RingLink>
        </div>

        {/* 4-Column Directory for All Studio Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-t border-white/[0.08] text-xs">
          <div>
            <span className="font-clash inframe-title text-[12px] uppercase tracking-[0.16em] text-white block mb-3.5 font-medium">
              Ecosystem
            </span>
            <ul className="space-y-2.5 text-neutral-400 font-bricolage text-[13px]">
              <li>
                <a href="https://willsonrai.com.np" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>willsonrai.com.np</span>
                  <ArrowUpRight className="size-2.5 opacity-60" />
                </a>
              </li>
              <li>
                <a href="https://obitostudio.willsonrai.com.np" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>Obito Studio Live</span>
                  <ArrowUpRight className="size-2.5 opacity-60" />
                </a>
              </li>
              <li>
                <a href="https://github.com/Willsonraiii" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>GitHub Profile</span>
                  <ArrowUpRight className="size-2.5 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-clash inframe-title text-[12px] uppercase tracking-[0.16em] text-white block mb-3.5 font-medium">
              Studio Tools
            </span>
            <ul className="space-y-2.5 text-neutral-400 font-bricolage text-[13px]">
              <li>
                <a href="/" onClick={(e) => { e.preventDefault(); onSwitchTab?.('optimizer'); }} className="hover:text-white transition-colors text-left block">
                  Lossless Optimizer
                </a>
              </li>
              <li>
                <a href="#compare" className="hover:text-white transition-colors block">
                  Quality Comparison
                </a>
              </li>
              <li>
                <a href="/inspector.html" onClick={(e) => { e.preventDefault(); onSwitchTab?.('inspect'); }} className="hover:text-white transition-colors text-left block">
                  Codec Inspector
                </a>
              </li>
              <li>
                <button type="button" onClick={() => onSwitchTab?.('dashboard')} className="hover:text-white transition-colors text-left">
                  Control Dashboard
                </button>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-clash inframe-title text-[12px] uppercase tracking-[0.16em] text-white block mb-3.5 font-medium">
              Documentation
            </span>
            <ul className="space-y-2.5 text-neutral-400 font-bricolage text-[13px]">
              <li>
                <a href="/guide.html" onClick={(e) => { e.preventDefault(); onSwitchTab?.('guide'); }} className="hover:text-white transition-colors text-left block">
                  Creator Upload Guide
                </a>
              </li>
              <li>
                <a href="/guide.html" className="hover:text-white transition-colors block">
                  DaVinci Resolve Master
                </a>
              </li>
              <li>
                <a href="/specs.html" onClick={(e) => { e.preventDefault(); onSwitchTab?.('specs'); }} className="hover:text-white transition-colors text-left block">
                  Ingestion Specs &amp; FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-clash inframe-title text-[12px] uppercase tracking-[0.16em] text-white block mb-3.5 font-medium">
              Policy &amp; Trust
            </span>
            <ul className="space-y-2.5 text-neutral-400 font-bricolage text-[13px]">
              <li>
                <a href="/privacy.html" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms.html" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full liquid-glass-chip text-[10.5px] text-emerald-400 font-clash inframe-title font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Zero Cloud RAM Spikes
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Social & Copyright Bar */}
        <div className="flex flex-col gap-6 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <div className="flex items-center gap-2 liquid-glass-chip rounded-full px-3 py-1 text-xs text-neutral-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-clash inframe-title text-[11px] text-emerald-300 font-medium">Engine Online · Lossless v3.1</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors duration-300',
                  'liquid-glass-chip hover:border-white/30 hover:text-white',
                )}
              >
                {social.icon}
              </a>
            ))}
          </div>

          <span className="text-xs text-neutral-400 font-clash inframe-title">&copy; 2026 Obito Studio · Engineered by Willson Rai</span>
        </div>
      </div>
    </footer>
  );
};
