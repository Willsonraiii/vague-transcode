import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpRight, RingLink } from './primitives';
import { cn } from '@/lib/utils';
import Logo from '../Logo.jsx';
import { AnimatedText } from '../components/ui/animated-text.jsx';
import { SonarGrid } from '../components/ui/sonar-grid.jsx';
import {
  UserIcon, ChevronDownIcon, PremiumKeyIcon, LogoutIcon
} from '../icons.jsx';

const ROLES = [
  'Lossless 60fps Fluidity',
  'Native 120fps Motion',
  '10-bit HLG Rec.2020',
  'Bit-for-Bit Stream Copy',
  '19200 Base Clock',
];
const ROLE_INTERVAL = 2200;

export const Navbar = ({
  activeTab,
  onSwitchTab,
  busy,
  memberPreview,
  ownerAuthenticated,
  currentUserName,
  isMasterOwner,
  onOpenSignIn,
  onOpenAdmin,
  onSignOut,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [lensMore, setLensMore] = useState(false);
  const moreBtnRef = useRef(null);
  const morePanelRef = useRef(null);
  const userBtnRef = useRef(null);
  const userPanelRef = useRef(null);

  useEffect(() => {
    if (!showMoreMenu && !showUserMenu) return;

    const onPointerDownOutside = (e) => {
      if (showMoreMenu) {
        const inPanel = morePanelRef.current && morePanelRef.current.contains(e.target);
        const inBtn = moreBtnRef.current && moreBtnRef.current.contains(e.target);
        if (!inPanel && !inBtn) {
          setShowMoreMenu(false);
          setLensMore(false);
        }
      }
      if (showUserMenu) {
        const inPanel = userPanelRef.current && userPanelRef.current.contains(e.target);
        const inBtn = userBtnRef.current && userBtnRef.current.contains(e.target);
        if (!inPanel && !inBtn) {
          setShowUserMenu(false);
        }
      }
    };

    document.addEventListener('pointerdown', onPointerDownOutside, true);
    document.addEventListener('touchstart', onPointerDownOutside, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('touchstart', onPointerDownOutside, { capture: true });
    };
  }, [showMoreMenu, showUserMenu]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const allNavItems = [
    { id: 'home', label: 'Home', primary: true },
    { id: 'optimizer', label: 'Optimizer', primary: true },
    { id: 'inspect', label: 'Inspector', primary: false },
    { id: 'dashboard', label: 'Dashboard', primary: false },
    { id: 'guide', label: 'Guide', primary: false },
    { id: 'faq', label: 'FAQ', primary: false },
    { id: 'specs', label: 'Specs', primary: false },
  ];

  const primaryNavItems = allNavItems.filter((n) => n.primary);
  const secondaryNavItems = allNavItems.filter((n) => !n.primary);

  const secondaryActive = secondaryNavItems.some((n) => n.id === activeTab);

  const handleNavClick = (id) => {
    setShowMoreMenu(false);
    setLensMore(false);
    if (id === 'home' && activeTab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onSwitchTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // iOS-27 liquid-glass selector: one travelling lens gliding to active chip.
  const navPillRef = useRef(null);
  const lensRef = useRef(null);

  const updateLens = useCallback(() => {
    const pill = navPillRef.current;
    const lens = lensRef.current;
    if (!pill || !lens) return;
    const chips = Array.from(pill.querySelectorAll('[data-chipnav]'));
    const isVisible = (c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    let target = chips.find((c) => c.dataset.chipnav === activeTab && isVisible(c));
    if (!target && (lensMore || secondaryActive)) {
      target = chips.find((c) => c.dataset.chipnav === 'more' && isVisible(c));
    }
    if (!target) target = chips.find((c) => c.dataset.chipnav === 'home' && isVisible(c));
    if (!target) {
      lens.style.opacity = '0';
      return;
    }
    const pr = pill.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const borderLeft = pill.clientLeft || 0;
    const borderTop = pill.clientTop || 0;

    const left = r.left - pr.left - borderLeft;
    const top = r.top - pr.top - borderTop;

    lens.style.opacity = '1';
    lens.style.left = `${Math.round(left)}px`;
    lens.style.top = `${Math.round(top)}px`;
    lens.style.width = `${Math.round(r.width)}px`;
    lens.style.height = `${Math.round(r.height)}px`;
  }, [activeTab, lensMore, secondaryActive]);

  useEffect(() => {
    updateLens();
    const frame = requestAnimationFrame(updateLens);
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateLens);
    }
    window.addEventListener('resize', updateLens);
    window.addEventListener('orientationchange', updateLens);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateLens);
      window.removeEventListener('orientationchange', updateLens);
    };
  }, [updateLens, busy]);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex justify-center px-2.5 pt-3 sm:px-4 sm:pt-4 md:pt-5 pointer-events-none">
      <div
        ref={navPillRef}
        className={cn(
          'liquid-glass-nav relative inline-flex items-center rounded-full px-1.5 sm:px-2 md:px-4 py-1.5 md:py-2 transition-all duration-300 pointer-events-auto max-w-[calc(100vw-1.25rem)] md:w-full md:max-w-4xl lg:max-w-5xl md:justify-between',
          scrolled && 'is-scrolled',
        )}
      >
        {/* Travelling liquid-glass lens (rests on the active chip) */}
        <div ref={lensRef} className="nav-lens" aria-hidden="true" />

        {/* 1. Brand Group: Monogram Logo & Wordmark */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              onSwitchTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Obito Studio Home"
            className="group relative flex size-7 sm:size-8 shrink-0 items-center justify-center transition-transform duration-300 hover:scale-110 mr-0.5 sm:mr-1 cursor-pointer"
          >
            <Logo size={24} />
          </button>

          <button
            type="button"
            onClick={() => {
              onSwitchTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Obito Studio"
            className="flex flex-col items-start select-none cursor-pointer shrink-0 mr-1 sm:mr-1.5 w-[58px]"
          >
            <div className="brand-obito w-[58px] overflow-visible">
              <AnimatedText
                text="OBITO"
                fontSize={11.5}
                minWeight={500}
                maxWeight={700}
                animationDuration={1.8}
                delayMultiplier={0.16}
                phaseOffset={0}
                reverse={false}
                justify={false}
                color="#ffffff"
                letterSpacing="0.08em"
                fontFamily="'Clash Display', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
              />
            </div>
            <div className="brand-studio w-[58px] overflow-visible">
              <AnimatedText
                text="STUDIO"
                fontSize={8.5}
                minWeight={500}
                maxWeight={700}
                animationDuration={1.8}
                delayMultiplier={0.16}
                phaseOffset={-0.9}
                reverse={true}
                justify={false}
                color="rgba(255,255,255,0.78)"
                letterSpacing="0.2em"
                fontFamily="'Clash Display', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
              />
            </div>
          </button>

          <span className="hidden md:block ml-2 mr-1 h-3.5 w-px bg-white/10 shrink-0" />
          <span className="md:hidden mx-0.5 sm:mx-1 h-3.5 w-px bg-white/10 block shrink-0" />
        </div>

        {/* 2. Nav chips — inline on desktop, compact with More dropdown on mobile */}
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5">
          {allNavItems.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                data-chipnav={link.id}
                onClick={() => handleNavClick(link.id)}
                className={cn(
                  'relative z-[2] inline-flex items-center justify-center gap-1 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] md:text-[12.5px] lg:text-[13px] transition-colors duration-200 font-clash inframe-title font-medium whitespace-nowrap shrink-0 cursor-pointer leading-none tracking-[-0.015em]',
                  link.primary ? 'inline-flex' : 'hidden md:inline-flex',
                  isActive ? 'text-white' : 'text-neutral-400 hover:text-white',
                )}
              >
                <span className="leading-none">{link.label}</span>
                {link.id === 'optimizer' && busy && (
                  <span className="size-1.5 rounded-full bg-emerald-400 ml-0.5" />
                )}
              </button>
            );
          })}

          {/* More — mobile only dropdown */}
          <div className="relative shrink-0 md:hidden">
            <button
              ref={moreBtnRef}
              type="button"
              data-chipnav="more"
              aria-haspopup="menu"
              aria-expanded={showMoreMenu}
              onClick={() => setShowMoreMenu((v) => { const next = !v; setLensMore(next); return next; })}
              className={cn(
                'relative z-[2] inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] transition-colors duration-200 font-clash inframe-title font-medium whitespace-nowrap shrink-0 cursor-pointer leading-none tracking-[-0.015em]',
                secondaryActive ? 'text-white' : 'text-neutral-400 hover:text-white',
              )}
            >
              <span className="leading-none inline-flex items-center gap-1">
                <span>More</span>
                {secondaryActive && <span className="size-1 rounded-full bg-cyan-400 shrink-0" />}
              </span>
              <ChevronDownIcon width={10} height={10} className={cn('transition-transform duration-200 opacity-70 shrink-0', showMoreMenu && 'rotate-180')} />
            </button>

            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 pointer-events-auto cursor-pointer"
                  onClick={() => { setShowMoreMenu(false); setLensMore(false); }}
                  onTouchStart={() => { setShowMoreMenu(false); setLensMore(false); }}
                />
                <div
                  ref={morePanelRef}
                  role="menu"
                  className="dropdown-panel absolute right-0 top-full mt-2 w-40 rounded-2xl p-1.5 z-50 text-xs sm:text-[13px] pointer-events-auto"
                >
                  {secondaryNavItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer font-clash inframe-title font-medium tracking-[-0.015em]',
                        activeTab === item.id ? 'bg-white/15 text-white font-medium' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span>{item.label}</span>
                      {activeTab === item.id && <span className="size-1.5 rounded-full bg-white" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. Action Button: Sign In / Member Profile */}
        <div className="flex items-center shrink-0">
          <span className="hidden md:block ml-1 mr-2.5 h-3.5 w-px bg-white/10 shrink-0" />
          <span className="md:hidden mx-0.5 sm:mx-1 h-3.5 w-px bg-white/10 block shrink-0" />

        {/* Action Button: Sign In / Member Profile */}
        {memberPreview && ownerAuthenticated ? (
          <div className="relative shrink-0 ml-0.5">
            <button
              ref={userBtnRef}
              type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              className="liquid-glass-chip flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white sm:px-3 sm:py-1.5 sm:text-[13px] font-clash inframe-title font-medium tracking-[-0.015em]"
            >
              <UserIcon width={12} height={12} />
              <span className="hidden sm:inline max-w-[80px] truncate">{currentUserName || 'Member'}</span>
              <ChevronDownIcon width={10} height={10} />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 pointer-events-auto cursor-pointer"
                  onClick={() => setShowUserMenu(false)}
                  onTouchStart={() => setShowUserMenu(false)}
                />
                <div
                  ref={userPanelRef}
                  className="dropdown-panel absolute right-0 top-full mt-2 w-48 rounded-2xl p-2 z-50 text-xs pointer-events-auto"
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <span className="font-clash inframe-title text-[10px] text-neutral-400 block">Signed in as</span>
                    <strong className="text-white truncate block">{currentUserName || 'Member'}</strong>
                  </div>
                  {isMasterOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAdmin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10 rounded-lg text-white/90 hover:text-white font-clash inframe-title font-medium tracking-[-0.015em]"
                    >
                      <PremiumKeyIcon width={13} height={13} />
                      <span>Passes &amp; Referrals</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-rose-500/10 rounded-lg text-rose-400 font-clash inframe-title font-medium tracking-[-0.015em]"
                  >
                    <LogoutIcon width={13} height={13} />
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="shrink-0 ml-0.5">
            <RingLink
              href="#optimizer"
              onClick={(e) => {
                e.preventDefault();
                onOpenSignIn();
              }}
              innerClassName="liquid-glass-chip px-2.5 py-1 text-[11px] text-white sm:px-3.5 sm:py-1.5 sm:text-[13px] font-clash inframe-title font-medium tracking-[-0.015em]"
            >
              Sign in
              <ArrowUpRight className="hidden size-3 sm:inline-block" />
            </RingLink>
          </div>
        )}
        </div>
      </div>
    </nav>
  );
};

export const Hero = ({ onOpenSignIn, onSwitchTab, ownerAuthenticated, memberPreview }) => {
  const [roleIndex, setRoleIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRoleIndex((i) => (i + 1) % ROLES.length), ROLE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="home"
      className="relative flex h-[100svh] min-h-[580px] w-full flex-col items-center justify-center overflow-hidden pt-20 pb-12 sm:pt-24 sm:pb-16 md:pt-32 md:pb-20"
    >
      {/* Background Ambient Video Layer */}
      <div className="absolute inset-0 overflow-hidden">
        {/* SonarGrid — dotted field with expanding sonar rings */}
        <SonarGrid
          color="#dce4f6"
          spacing={24}
          dotRadius={1.2}
          baseOpacity={0.24}
          pingEvery={0}
          seedPing={false}
          speed={260}
          ringWidth={90}
          amplitude={1.2}
          interactive
          className="absolute inset-0"
        />
        {/* Soft center vignette to protect typography contrast from background dots */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(8,9,14,0.65)_0%,rgba(8,9,14,0)_68%)] pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[hsl(var(--bg))] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[hsl(var(--bg))] to-transparent" />
      </div>

      {/* Main Hero Content (Hirael Portfolio Layout) */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-3xl mx-auto">
        {/* Studio Live — Frameless Studio Header with Identical Robust Clash Display Font */}
        <div className="mb-5 sm:mb-6 md:mb-7 -translate-y-3 sm:translate-y-0 flex items-center justify-center gap-2.5 sm:gap-3 select-none">
          <span className="font-clash text-[11.5px] sm:text-[13px] font-semibold tracking-[0.24em] uppercase text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
            STUDIO
          </span>
          <span className="h-2.5 w-px bg-white/25 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 sm:gap-2">
            <span className="css-live-signal" title="Live Broadcast" role="img" aria-label="Live">
              <span className="css-live-arc css-live-arc--outer-l" />
              <span className="css-live-arc css-live-arc--inner-l" />
              <span className="css-live-beacon" />
              <span className="css-live-arc css-live-arc--inner-r" />
              <span className="css-live-arc css-live-arc--outer-r" />
            </span>
            <span className="font-clash text-[11.5px] sm:text-[13px] font-semibold tracking-[0.24em] uppercase text-[#ff6363] drop-shadow-[0_0_14px_rgba(255,99,99,0.5)]">
              LIVE
            </span>
          </span>
        </div>

        {/* Cinematic Studio Hero Title (Unified Font with Bold Solid Stems) */}
        <h1 className="mb-4 sm:mb-6 flex flex-col items-center select-none tracking-tight">
          <span className="font-clash font-semibold text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] leading-[1] text-white/90 drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)] tracking-[-0.015em]">
            TikTok
          </span>
          <span className="font-clash font-bold text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] leading-[0.92] tracking-[-0.03em] uppercase text-white drop-shadow-[0_14px_45px_rgba(0,0,0,0.98)]">
            Optimizer
          </span>
        </h1>

        {/* Studio Subtitle & Dynamic Technical Flow */}
        <div className="mb-7 sm:mb-9 max-w-lg md:max-w-xl mx-auto flex flex-col items-center gap-2 sm:gap-2.5">
          <p className="text-[17px] sm:text-[18.5px] text-[hsl(var(--muted))] leading-relaxed font-bricolage font-normal">
            Upload once — keep 60/120 fps, HDR, and every bit of your master.
          </p>
          <p className="inline-flex flex-wrap items-center justify-center gap-1.5 text-[14.5px] sm:text-[16px] text-neutral-400 font-bricolage font-normal">
            <span>Engineered for</span>
            <span
              key={roleIndex}
              className="animate-role-fade-in inline-block text-white font-medium border-b border-white/20 pb-0.5"
            >
              {ROLES[roleIndex]}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-400">Zero re-encoding</span>
          </p>
        </div>

        {/* Upper 2 Buttons: Exact Same Size (Compact & Sleek) */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5 mt-1 sm:mt-2">
          {/* 1. Primary Engine Action: Master Video */}
          <button
            type="button"
            onClick={() => onSwitchTab?.('optimizer')}
            className="group relative inline-flex shrink-0 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <span className="relative inline-flex items-center justify-center gap-1.5 rounded-full liquid-glass-white-solid min-w-[125px] sm:min-w-[140px] h-10 sm:h-11 px-5 sm:px-6 text-xs sm:text-[13px] font-clash inframe-title font-semibold text-neutral-950 shadow-lg">
              <span>Master Video</span>
              <ArrowUpRight className="size-3 sm:size-3.5 text-neutral-950 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
            </span>
          </button>

          {/* 2. Secondary Action: Compare (Exact Same Size) */}
          <RingLink
            href="#compare"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById('compare');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            outerClassName="transition-transform duration-300 hover:scale-105 active:scale-95"
            innerClassName="liquid-glass-white min-w-[125px] sm:min-w-[140px] h-10 sm:h-11 px-5 sm:px-6 text-xs sm:text-[13px] text-white font-clash inframe-title font-semibold flex items-center justify-center gap-1.5 shadow-lg"
          >
            <span>Compare</span>
            <ArrowUpRight className="size-3 sm:size-3.5 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
          </RingLink>
        </div>

        {/* Clean Secondary Member Sign In Link */}
        <div className="mt-4 sm:mt-5 text-center">
          {ownerAuthenticated && memberPreview ? (
            <button
              type="button"
              onClick={() => onSwitchTab?.('dashboard')}
              className="font-clash inframe-title text-xs sm:text-[13px] text-white/55 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 group"
            >
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Signed in as Member</span>
              <span className="text-white/80 group-hover:text-cyan-300 underline underline-offset-4 ml-0.5">Open Dashboard</span>
              <ArrowUpRight className="size-3 text-white/40 group-hover:text-cyan-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenSignIn?.()}
              className="font-clash inframe-title text-xs sm:text-[13px] text-white/55 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 group"
            >
              <span>Have a Studio Pass?</span>
              <span className="text-white/85 group-hover:text-cyan-300 underline underline-offset-4">Sign in</span>
              <ArrowUpRight className="size-3 text-white/40 group-hover:text-cyan-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <div className="absolute bottom-5 sm:bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 sm:gap-2.5">
        <span className="font-clash inframe-title text-[10px] tracking-[0.25em] text-[hsl(var(--muted))] uppercase">Scroll</span>
        <span className="relative block h-8 sm:h-9 w-px overflow-hidden bg-[hsl(var(--stroke))]">
          <span className="pf-gradient animate-scroll-down absolute inset-x-0 top-0 block h-1/2 w-full" />
        </span>
      </div>
    </section>
  );
};
