import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const SECTION_EASE = [0.25, 0.1, 0.25, 1];

export const onAnchorClick = (event, href) => {
  if (!href || !href.startsWith('#') || href.length < 2) return;
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
};

export const ArrowUpRight = ({ className }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-3.5', className)}
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
};

export const ArrowRight = ({ className }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-3.5', className)}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
};

export const RingLink = ({
  href,
  children,
  ariaLabel,
  target,
  rel,
  outerClassName,
  innerClassName,
  onClick,
}) => {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target={target}
      rel={rel ?? (target === '_blank' ? 'noreferrer' : undefined)}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (href?.startsWith('#')) onAnchorClick(e, href);
      }}
      className={cn('group relative inline-flex shrink-0 cursor-pointer', outerClassName)}
    >
      <span
        aria-hidden="true"
        className="pf-gradient pointer-events-none absolute -inset-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span
        className={cn(
          'relative inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-300',
          innerClassName,
        )}
      >
        {children}
      </span>
    </a>
  );
};

export const SectionHeader = ({
  lead,
  accent,
  trailing = '',
  subtext,
  viewAll,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: SECTION_EASE }}
      viewport={{ once: true, margin: '0px' }}
      className={cn('w-full', className)}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-full max-w-2xl">
          <h2 className="font-clash font-bold text-2xl sm:text-3xl md:text-4xl lg:text-[44px] leading-tight tracking-[-0.025em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.8)]">
            {lead} <span className="font-bold text-white">{accent}</span>
            {trailing}
          </h2>
          {subtext && (
            <p className="mt-2.5 mx-auto max-w-lg text-[17px] sm:text-[18px] text-[hsl(var(--muted))] leading-relaxed font-bricolage font-normal">{subtext}</p>
          )}
          {viewAll ? (
            <RingLink
              href={viewAll.href}
              outerClassName="mt-4 inline-flex shrink-0"
              innerClassName="liquid-glass-chip px-4 py-2 text-xs text-white hover:border-white/30"
            >
              {viewAll.label}
              <ArrowRight className="size-3" />
            </RingLink>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};


export const LiquidGlassDefs = () => (
  <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
    <filter id="liquid-glass" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
      <feImage
        href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20240%20240'%3E%3Crect%20width='240'%20height='240'%20fill='rgb(128,128,128)'/%3E%3Crect%20x='2'%20y='2'%20width='236'%20height='236'%20rx='119'%20ry='119'%20fill='none'%20stroke='rgb(235,235,235)'%20stroke-width='14'/%3E%3C/svg%3E"
        preserveAspectRatio="none"
        result="rim"
      />
      <feComposite in="rim" in2="SourceGraphic" operator="in" result="rimClip" />
      <feDisplacementMap in="SourceGraphic" in2="rimClip" scale="16" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
);
