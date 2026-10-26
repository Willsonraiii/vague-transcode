import React from 'react';
import { Navbar, Hero } from './Hero';
import { VideoComparison } from './VideoComparison';
import WorkflowSignalPath from './WorkflowSignalPath';
import SimpleProcess from './SimpleProcess';
import ProductionEcosystem from './ProductionEcosystem';
import { Contact } from './Contact';
import Optimizer, { BotStage } from '../Optimizer';
import Dashboard from '../Dashboard';
import Inspector from '../Inspector';
import Guide from '../Guide';
import { SectionHeader, LiquidGlassDefs } from './primitives';
import { ChevronIcon, PremiumKeyIcon } from '../icons';

export default function PortfolioView({
  activeTab,
  onSwitchTab,
  apiKey,
  onKeyChange,
  busy,
  setBusy,
  memberPreview,
  authChecking,
  ownerAuthenticated,
  currentUserName,
  userName = 'Guest',
  userTier = 'free',
  isMasterOwner,
  onOpenSignIn,
  onOpenAdmin,
  onSignOut,
  archPillars,
  workflowSteps,
  faqItems,
}) {
  React.useLayoutEffect(() => {
    const hash = window.location.hash.slice(1);
    const scroll = () => {
      if (hash) {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
          return;
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    scroll();
    const frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  return (
    <div
      data-slot="portfolio"
      className="min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text))] antialiased selection:bg-white/20 [overflow-x:clip] w-full max-w-full"
    >
      <LiquidGlassDefs />

      {/* Floating Hirael Pill Navbar */}
      <Navbar
        activeTab={activeTab}
        onSwitchTab={onSwitchTab}
        busy={busy}
        memberPreview={memberPreview}
        ownerAuthenticated={ownerAuthenticated}
        currentUserName={currentUserName}
        isMasterOwner={isMasterOwner}
        onOpenSignIn={onOpenSignIn}
        onOpenAdmin={onOpenAdmin}
        onSignOut={onSignOut}
      />

      {/* Main Homepage Flow (Strictly Showcase, No Dropzone) */}
      {activeTab === 'home' && (
        <main id="home">
          {/* 1. Hero with Looping Video Background */}
          <Hero
            onOpenSignIn={onOpenSignIn}
            onSwitchTab={onSwitchTab}
            ownerAuthenticated={ownerAuthenticated}
            memberPreview={memberPreview}
            currentUserName={currentUserName}
            userName={userName}
            isMasterOwner={isMasterOwner}
            userTier={userTier}
          />

          {/* 2. Realtime Video Swap Comparison Section */}
          <VideoComparison />

          {/* 2b. Simple Process Section (Login, Optimize, Post) */}
          <section id="process" className="section-hirael scroll-anchor bg-[hsl(var(--bg))]">
            <div className="container-hirael">
              <SectionHeader
                lead="Simple"
                accent="Process"
                subtext="Three effortless steps from your timeline master to lossless TikTok playback."
                className="mb-4 sm:mb-5"
              />

              <SimpleProcess
                onOpenSignIn={onOpenSignIn}
                onSwitchTab={onSwitchTab}
                ownerAuthenticated={ownerAuthenticated}
                memberPreview={memberPreview}
              />
            </div>
          </section>

          {/* 3. Supported Production Ecosystem */}
          <section id="ecosystem" className="section-hirael scroll-anchor bg-[hsl(var(--bg))]">
            <div className="container-hirael">
              <SectionHeader
                lead="Supported"
                accent="Ecosystem"
                subtext="Direct master compatibility across cinema cameras, mobile sensors, and editing suites."
                className="mb-8 sm:mb-12"
              />

              <ProductionEcosystem />
            </div>
          </section>

          {/* 3. How Obito Studio Works */}
          <section id="architecture" className="scroll-anchor bg-[hsl(var(--bg))] pt-10 pb-12 sm:pt-16 sm:pb-20 md:pt-20 md:pb-24">
            <div className="container-hirael">
              <SectionHeader
                lead="How Obito Studio"
                accent="Works"
                subtext="Container surgery, not compression. Four moves between your timeline and TikTok."
                className="mb-5 sm:mb-8"
              />

              <WorkflowSignalPath />

              <div className="mt-4 flex items-center justify-center gap-2 font-clash inframe-title text-[11px] sm:text-xs text-white/70">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="text-white/90 font-medium">Official TikTok Content Posting API</span>
                <span className="text-white/30">·</span>
                <span className="text-cyan-300 font-semibold">In Developer Review (Coming Soon)</span>
              </div>
            </div>
          </section>

        </main>
      )}

      {/* Dedicated Optimizer Pipeline Studio Page */}
      {activeTab === 'optimizer' && (
        <main id="optimizer" className="scroll-anchor pt-24 sm:pt-28 md:pt-32 pb-10 sm:pb-14">
          <div className="container-hirael">
            <SectionHeader
              lead="Pipeline"
              accent="Studio"
              subtext="Bit-for-bit video mastering in 4K, 60fps & 120fps with native Apple HDR preservation."
              className="mb-6 sm:mb-8"
            />

            {memberPreview && authChecking ? (
              <div className="dropzone-sub text-center py-12 text-neutral-400 font-clash inframe-title text-xs">
                Checking access permissions…
              </div>
            ) : memberPreview && !ownerAuthenticated ? (
              <div className="studio-optimizer w-full max-w-xl mx-auto px-3 sm:px-0">
                <div
                  className="clean-dropzone liquid-glass-frame relative overflow-hidden rounded-[26px] p-5 sm:p-6 md:p-7 phase-idle text-center cursor-pointer"
                  onClick={(e) => {
                    if (e.target.closest('button, a, input')) return;
                    onOpenSignIn?.();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onOpenSignIn?.();
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

                  <BotStage phase="idle" busy={false} />

                  <div className="dropzone-text mt-1.5 mb-3 text-center">
                    <h2 className="dropzone-title font-clash inframe-title font-medium text-xl sm:text-2xl md:text-[26px] text-white tracking-[-0.02em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
                      Choose a video to optimize
                    </h2>
                    <p className="dropzone-sub font-bricolage text-xs sm:text-[13.5px] text-neutral-300 mt-1 max-w-md mx-auto leading-relaxed">
                      Sign in with an active membership to upload a video.
                    </p>
                  </div>

                  <div className="idle-actions w-full">
                    <div className="choose-btn-wrap my-3">
                      <button
                        type="button"
                        onClick={onOpenSignIn}
                        className="choose-file-label liquid-glass-chip rounded-full px-6 py-2.5 sm:px-7 sm:py-3 font-clash inframe-title text-xs sm:text-[13px] font-medium text-white inline-flex items-center justify-center gap-2 hover:border-white/40 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer tracking-normal"
                      >
                        <PremiumKeyIcon width={15} height={15} className="text-white/90" />
                        <span>Sign in to optimize</span>
                      </button>
                    </div>

                    <div className="engine-trust-row grid grid-cols-3 gap-2 sm:gap-2.5 w-full max-w-md mx-auto mt-3.5 pt-3.5 border-t border-white/[0.08]">
                      <div className="trust-item p-2 sm:p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center">
                        <span className="trust-val font-clash inframe-title font-medium text-white/95 text-xs sm:text-[12.5px] block tracking-normal">4K Ultra HD</span>
                        <span className="trust-lbl font-sans font-normal text-[9.5px] text-neutral-400 block mt-0.5 tracking-wide">Full Resolution</span>
                      </div>
                      <div className="trust-item p-2 sm:p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center">
                        <span className="trust-val font-clash inframe-title font-medium text-emerald-400 text-xs sm:text-[12.5px] block tracking-normal">60 &amp; 120 FPS</span>
                        <span className="trust-lbl font-sans font-normal text-[9.5px] text-neutral-400 block mt-0.5 tracking-wide">Smooth Motion</span>
                      </div>
                      <div className="trust-item p-2 sm:p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center">
                        <span className="trust-val font-clash inframe-title font-medium text-amber-300 text-xs sm:text-[12.5px] block tracking-normal">Apple HDR</span>
                        <span className="trust-lbl font-sans font-normal text-[9.5px] text-neutral-400 block mt-0.5 tracking-wide">Dynamic Range</span>
                      </div>
                    </div>

                    <div className="tiktok-tip-card liquid-glass-frame rounded-xl p-3 sm:p-3.5 mt-3 text-left flex items-start gap-2.5 border border-white/[0.08] shadow-md max-w-md mx-auto">
                      <div className="size-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white shrink-0 mt-0.5">
                        <PremiumKeyIcon width={14} height={14} className="text-white/80" />
                      </div>
                      <div className="tiktok-tip-content flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="tiktok-tip-title font-clash inframe-title font-medium text-[11px] sm:text-xs text-white block tracking-[-0.02em]">Studio Membership Access</span>
                          {onOpenSignIn && (
                            <button
                              type="button"
                              onClick={onOpenSignIn}
                              className="text-cyan-400 hover:text-cyan-300 font-clash inframe-title font-medium text-[11px] transition-colors cursor-pointer shrink-0"
                            >
                              Sign In &rarr;
                            </button>
                          )}
                        </div>
                        <span className="tiktok-tip-desc font-bricolage text-[11px] sm:text-xs text-neutral-300 leading-snug block mt-0.5">
                          Bit-for-bit mastering requires an active pass or invite code. Enter your credentials or redeem a referral pass to proceed.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <Optimizer
                  apiKey={apiKey}
                  onKeyChange={onKeyChange}
                  onBusy={setBusy}
                  userName={userName}
                  userTier={userTier}
                  onSwitchTab={onSwitchTab}
                  onSwitchToGuide={() => onSwitchTab?.('guide')}
                />
              </div>
            )}
          </div>
        </main>
      )}

      {/* Dedicated FAQ Page */}
      {activeTab === 'faq' && (
        <main id="faq" className="scroll-anchor pt-24 sm:pt-28 md:pt-32 pb-20 sm:pb-28 min-h-screen">
          <div className="container-hirael">
            <SectionHeader
              lead="Frequently Asked"
              accent="Questions"
              subtext="Quick answers about quality, privacy, and uploads."
              className="mb-6 sm:mb-8"
            />

            <div className="space-y-3.5 max-w-3xl mx-auto text-left">
              {faqItems?.map(([q, a]) => (
                <details
                  key={q}
                  className="group rounded-2xl liquid-glass-frame p-4 sm:p-5 transition-all hover:border-white/25"
                >
                  <summary className="flex cursor-pointer items-center justify-between font-medium text-xs sm:text-sm text-white/90 select-none">
                    <span>{q}</span>
                    <ChevronIcon width={14} height={14} className="transition-transform group-open:rotate-180 text-white/40 shrink-0 ml-4" />
                  </summary>
                  <p className="mt-3.5 text-xs sm:text-sm text-[hsl(var(--muted))] leading-relaxed border-t border-[hsl(var(--stroke))] pt-3.5">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* Dedicated Compare Tab */}
      {activeTab === 'compare' && (
        <main id="compare" className="scroll-anchor pt-24 sm:pt-28 md:pt-32 pb-20 sm:pb-28">
          <VideoComparison />
        </main>
      )}

      {/* Dedicated Inspector Tab */}
      {activeTab === 'inspect' && (
        <main id="inspect" className="scroll-anchor pt-24 sm:pt-28 md:pt-32 pb-20 sm:pb-28">
          <div className="container-hirael">
            <SectionHeader
              lead="TikTok Container"
              accent="Inspector"
              subtext="Audit 4K resolution, 60fps & 120fps fluid playback, and native HDR color profile."
              className="mb-6 sm:mb-8"
            />
            <div className="w-full">
              <Inspector apiKey={apiKey} />
            </div>
          </div>
        </main>
      )}

      {/* Dedicated Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <main id="dashboard" className="scroll-anchor pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16">
          <div className="container-hirael">
            <SectionHeader
              lead="Creator"
              accent="Dashboard"
              subtext="Manage your connected TikTok accounts, studio pass, and personal account settings."
              className="mb-6 sm:mb-8"
            />
            <div className="w-full">
              <Dashboard
                onSwitchTab={onSwitchTab}
                apiKey={apiKey}
                onKeyChange={onKeyChange}
                onSignOut={onSignOut}
                userName={userName}
                userTier={userTier}
                ownerAuthenticated={ownerAuthenticated}
                isMasterOwner={isMasterOwner}
                onOpenSignIn={onOpenSignIn}
              />
            </div>
          </div>
        </main>
      )}

      {/* Dedicated Guide Tab */}
      {activeTab === 'guide' && (
        <main id="guide" className="scroll-anchor pt-24 sm:pt-28 md:pt-32 pb-14 sm:pb-20">
          <div className="container-hirael">
            <SectionHeader
              lead="Creator"
              accent="Guide"
              subtext="Export specifications (20–35 Mbps) and upload protocol to retain native 60/120fps motion and Apple HDR."
              className="mb-6 sm:mb-8"
            />
            <div className="w-full">
              <Guide onSwitchToOptimizer={() => onSwitchTab('optimizer')} hideHeader={true} />
            </div>
          </div>
        </main>
      )}

      {/* Dedicated Specs & FAQ Tab */}
      {activeTab === 'specs' && (
        <main id="specs" className="scroll-anchor pt-28 sm:pt-32 md:pt-36 pb-20 sm:pb-28">
          <div className="container-hirael">
            <SectionHeader
              lead="Technical"
              accent="Architecture"
              subtext="How Obito Studio preserves full 60/120fps motion fluidity and wide dynamic range without transcoding."
              className="mb-8 sm:mb-12"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12 sm:mb-16">
              {archPillars?.map(({ Icon, title, subtitle, desc }) => (
                <div
                  key={title}
                  className="rounded-3xl liquid-glass-frame p-5 sm:p-7 hover:border-white/25 transition-all"
                >
                  <div className="flex items-center gap-3.5 mb-3.5">
                    <div className="size-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                      <Icon width={20} height={20} />
                    </div>
                    <div>
                      <h3 className="font-title text-sm sm:text-base font-normal text-white">{title}</h3>
                      <span className="text-[11px] text-[hsl(var(--muted))] font-clash inframe-title">{subtitle}</span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[hsl(var(--muted))] leading-relaxed font-sans">{desc}</p>
                </div>
              ))}
            </div>

            <SectionHeader
              lead="Frequently Asked"
              accent="Questions"
              subtext="Everything you need to know about 4K mastering, 60fps & 120fps delivery, and HDR preservation."
              className="mb-6 sm:mb-8"
            />

            <div className="space-y-3.5 max-w-3xl">
              {faqItems?.map(([q, a]) => (
                <details
                  key={q}
                  className="group rounded-2xl liquid-glass-frame p-4 sm:p-5 transition-all hover:border-white/25"
                >
                  <summary className="flex cursor-pointer items-center justify-between font-medium text-xs sm:text-sm text-white/90 select-none">
                    <span>{q}</span>
                    <ChevronIcon width={14} height={14} className="transition-transform group-open:rotate-180 text-white/40 shrink-0 ml-4" />
                  </summary>
                  <p className="mt-3.5 text-xs sm:text-sm text-[hsl(var(--muted))] leading-relaxed border-t border-[hsl(var(--stroke))] pt-3.5">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* Hirael Luxury Footer with All User Links */}
      <Contact onSwitchTab={onSwitchTab} />
    </div>
  );
}
