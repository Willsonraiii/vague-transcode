import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from './Logo.jsx';
import Optimizer from './Optimizer.jsx';
import Inspector from './Inspector.jsx';
import Library from './Library.jsx';
import { ShaderAnimation } from '@/components/ui/shader-animation';
import {
  ChevronIcon, FpsIcon, HdrIcon, HelpIcon,
  InspectIcon, LayersIcon, LightningIcon, ShieldIcon, SparkIcon, FilmIcon,
  PremiumKeyIcon
} from './icons.jsx';
import { ShutterText } from '@/components/ui/hero-shutter-text.jsx';
import { AnimatedText } from '@/components/ui/animated-text.jsx';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const TABS = [
  { id: 'optimizer', label: 'Optimizer', Icon: LightningIcon },
  { id: 'inspect', label: 'Inspector', Icon: InspectIcon },
  { id: 'library', label: 'Library', Icon: FilmIcon },
  { id: 'architecture', label: 'Specs', Icon: LayersIcon },
  { id: 'faq', label: 'FAQ', Icon: HelpIcon },
];

/* ---------- Technical Architecture Content ---------- */
const ARCH_PILLARS = [
  {
    Icon: FpsIcon,
    title: '19200 Timescale Harmonization',
    subtitle: '60fps & 120fps TikTok Ingestion',
    desc: 'TikTok\'s transcode engine aggressively enforces specific timescale multiples (19200, 15360). When footage arrives with non-standard timescales (e.g. 60000/1001 or 1000/1), TikTok\'s ingestion pipeline flattens playback to 30fps. Obito Studio remuxes container atoms to exact 19200 fractions without touching video frames.'
  },
  {
    Icon: LayersIcon,
    title: 'Zero Generational Loss',
    subtitle: '-c copy Pure Stream Copy',
    desc: 'Standard transcoders decompress every frame and re-compress with lossy encoders (libx264/libx265), degrading high-frequency textures and edge sharpness. Obito Studio never touches compressed video or audio packets. Only moov/trak headers are modified, preserving 100% of master bitrate.'
  },
  {
    Icon: HdrIcon,
    title: 'Apple Dolby Vision Profile 8 Demuxing',
    subtitle: 'Dynamic RPU → Native HLG Rec.2020',
    desc: 'iPhone HDR videos embed Dolby Vision Profile 8.4 dynamic metadata (RPU). TikTok strips unhandled Dolby Vision atoms, causing washed-out, blown-out SDR playback. Obito Studio extracts and translates container color primaries to native HLG (arib-std-b67) so peak nits survive.'
  },
  {
    Icon: ShieldIcon,
    title: 'Self-Hosted Sovereign Security',
    subtitle: 'Zero Cloud Storage · Immediate Purge',
    desc: 'Your creative masters never leave your private machine or network. Temporary container remuxing operates in-memory or on local NVMe, and files are automatically purged immediately after download or within one hour of inactivity.'
  }
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    name: 'Master Video Selection',
    detail: 'Import any MP4, MOV, or M4V up to 600 MB. Instant on-device container probing verifies resolution, frame-rate, color transfer, and Dolby Vision metadata before uploading.'
  },
  {
    step: '02',
    name: 'Hardware-Accelerated Stream Remux',
    detail: 'Resumable chunked ingestion streams to your server. The lossless pipeline restructures MP4 box atom layouts, interleaves audio streams, and normalizes duration timescale.'
  },
  {
    step: '03',
    name: 'Publish via TikTok Studio',
    detail: 'Download the verified master MP4 and publish directly through TikTok Studio (Desktop or Web). TikTok acknowledges the 19200 timescale and serves high-bitrate 60fps & HDR.'
  }
];

const FAQ_ITEMS = [
  [
    'Does Obito Studio re-encode or compress my footage?',
    'Never. Obito Studio strictly executes stream-copy remuxing (`-c copy`). Video packets and audio streams remain bit-for-bit identical to your export master. Zero generational degradation occurs.'
  ],
  [
    'Which preset should I select?',
    'Select "Apple HDR & Dolby Vision" for any iPhone HDR, 10-bit Log, or Dolby Vision clips to prevent TikTok from stripping wide color gamut information. Select "Standard Lossless" for SDR, gaming captures, and standard screen recordings.'
  ],
  [
    'What happens if my connection drops during upload?',
    'Uploads are chunked and completely resumable. Received data chunks remain safely cached on your server for up to one hour. Re-selecting the file or tapping Resume continues instantly without restarting.'
  ],
  [
    'Why do some local video players display 00:00 duration?',
    'The remuxed MP4 contains a specialized dual-audio timescale structure engineered specifically for TikTok\'s ingestion pipeline. Some legacy desktop video players show 00:00, but TikTok\'s mobile app and TikTok Studio parse the duration with 100% precision.'
  ],
  [
    'What are the supported file sizes and formats?',
    'MP4, MOV, and M4V containers up to 600 MB. 30 fps, 60 fps, and 120 fps portrait (9:16) and landscape masters are fully supported.'
  ],
  [
    'Are my video files stored on remote servers?',
    'No. Obito Studio operates on your self-hosted instance. Files are never sent to third-party cloud services and are deleted automatically as soon as you download the result.'
  ]
];

const HERO_MESSAGES = [
  {
    title: 'TIKTOK LOSSLESS MASTER',
    sub: 'Preserve native high FPS (60fps, 120fps+) & HDR with zero TikTok compression.'
  },
  {
    title: '60FPS NATIVE FLUIDITY',
    sub: 'Never let TikTok downgrade your high frame-rate mobile edits to 30fps.'
  },
  {
    title: '100% BIT-FOR-BIT LOSSLESS',
    sub: 'Pure stream-copy remuxing — video packets and audio streams stay untouched.'
  },
  {
    title: 'APPLE HDR & DOLBY VISION',
    sub: 'Original 10-bit color gamut intact for crystal-clear smartphone playback.'
  },
  {
    title: '19200 TIMESCALE REMUX',
    sub: 'Timescale container structure engineered specifically for TikTok ingestion.'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('optimizer'); // optimizer | inspect | library | architecture | faq
  const [apiKey, setApiKey] = useState(() => lsGet('obitoKey') || '');
  const [busy, setBusy] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [now, setNow] = useState(() => new Date());
  const [heroMsgIndex, setHeroMsgIndex] = useState(0);
  const [brandKey, setBrandKey] = useState(0);
  const [showPatchBanner, setShowPatchBanner] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroMsgIndex((prev) => (prev + 1) % HERO_MESSAGES.length);
    }, 4800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const onKeyChange = useCallback((v) => {
    setApiKey(v);
    lsSet('obitoKey', v);
  }, []);

  // 3D perspective mouse tracking over topbar
  const onTopbarMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setTilt({
      x: Math.max(-1, Math.min(1, dx)),
      y: Math.max(-1, Math.min(1, dy))
    });
  };

  const onTopbarLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Ref to the dock container and active pill slider
  const dockBarRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, ready: false });
  const [dragOffset, setDragOffset] = useState(0);

  // Measure and align sliding glass pill indicator
  const [hoveredTab, setHoveredTab] = useState(null);

  // Measure and align sliding glass pill indicator
  const updatePill = useCallback(() => {
    if (!dockBarRef.current) return;
    const targetTab = hoveredTab || activeTab;
    const activeBtn = dockBarRef.current.querySelector(`.ios-dock-item[data-tab-id="${targetTab}"]`);
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        ready: true,
        dragging: !!hoveredTab
      });
    }
  }, [activeTab, hoveredTab]);

  useEffect(() => {
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  const suppressClickRef = useRef(false);

  const switchTabWithHaptic = useCallback((tabId) => {
    setActiveTab((prev) => {
      if (prev !== tabId) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(12); } catch {}
        return tabId;
      }
      return prev;
    });
  }, []);

  const onDockTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      const t = e.touches[0];
      if (dockBarRef.current) {
        const rect = dockBarRef.current.getBoundingClientRect();
        setDragOffset(Math.max(0, Math.min(t.clientX - rect.left, rect.width)));
      }
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const tabBtn = el?.closest('.ios-dock-item');
      if (tabBtn) setHoveredTab(tabBtn.getAttribute('data-tab-id'));
    }
  };

  const onDockTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0];
    if (dockBarRef.current) {
      const rect = dockBarRef.current.getBoundingClientRect();
      setDragOffset(Math.max(0, Math.min(t.clientX - rect.left, rect.width)));
    }
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const tabBtn = el?.closest('.ios-dock-item');
    if (tabBtn) {
      const tabId = tabBtn.getAttribute('data-tab-id');
      if (tabId !== hoveredTab) {
        setHoveredTab(tabId);
        if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(6); } catch {}
      }
    } else {
      setHoveredTab(null);
    }
  };

  const onDockTouchEnd = (e) => {
    if (hoveredTab) {
      switchTabWithHaptic(hoveredTab);
      suppressClickRef.current = true;
      setTimeout(() => suppressClickRef.current = false, 300);
    }
    setHoveredTab(null);
    setDragOffset(0);
  };

  const dayStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="studio-app relative">
      <ShaderAnimation />
      {/* ---------- Ultra-Premium Studio Top Bar with Frameless Living Logo ---------- */}
      <header
        className="studio-topbar"
        onPointerMove={onTopbarMove}
        onPointerLeave={onTopbarLeave}
      >
        {/* Left Segment: Brand */}
        <div className="topbar-left">
          <div
            className="studio-brand brand-stacked"
            onClick={() => {
              setActiveTab('optimizer');
            }}
            title="OBITO STUDIO"
          >
            <div className="brand-obito">
              <AnimatedText
                text="OBITO"
                fontSize={14}
                minWeight={120}
                maxWeight={850}
                animationDuration={1.8}
                delayMultiplier={0.16}
                phaseOffset={0}
                reverse={false}
                justify={false}
                color="#ffffff"
                letterSpacing="0.08em"
              />
            </div>
            <div className="brand-studio">
              <AnimatedText
                text="STUDIO"
                fontSize={10.5}
                minWeight={200}
                maxWeight={820}
                animationDuration={1.8}
                delayMultiplier={0.16}
                phaseOffset={-0.9}
                reverse={true}
                justify={false}
                color="rgba(255, 255, 255, 0.78)"
                letterSpacing="0.22em"
              />
            </div>
          </div>
        </div>

        {/* Center Segment: Frameless 3D Living Monogram (At Mid) */}
        <div className="topbar-center">
          <button
            type="button"
            className="topbar-logo-btn"
            style={{
              transform: `perspective(360px) rotateY(${tilt.x * 14}deg) rotateX(${-tilt.y * 12}deg)`
            }}
            onClick={() => {
              setActiveTab('optimizer');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="OBITO STUDIO"
          >
            <Logo size={42} />
          </button>
        </div>

        {/* Right Segment: Access Key & Clock */}
        <div className="topbar-right">
          <button
            type="button"
            className={`key-badge-btn ${apiKey ? 'configured' : ''}`}
            onClick={() => setShowKeyModal((v) => !v)}
            title="Configure Server Access Key"
            aria-label="Server Access Key"
          >
            <PremiumKeyIcon width={15} height={15} />
            <span className="key-btn-text">{apiKey ? 'Key Set' : 'Key'}</span>
          </button>

          <div className="studio-clock" aria-label="Local Time">
            <span className="clock-day">{dayStr}</span>
            <span className="clock-time">{timeStr}</span>
          </div>
        </div>
      </header>

      {/* Access Key Popover Modal */}
      {showKeyModal && (
        <div className="modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Server Access Token</span>
              <button type="button" className="modal-close" onClick={() => setShowKeyModal(false)}>×</button>
            </div>
            <p className="modal-desc">
              If your self-hosted Obito Studio instance requires authentication, enter your access token here.
            </p>
            <input
              type="password"
              className="studio-input"
              placeholder="Enter server access token"
              value={apiKey}
              onChange={(e) => onKeyChange(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button type="button" className="btn-studio primary" onClick={() => setShowKeyModal(false)}>
                Save Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Main Workspace Viewport ---------- */}
      <main className="studio-workspace">
        {activeTab === 'optimizer' && (
          <section className={`workspace-view active optimizer-view ${busy ? 'is-busy' : ''}`} key="optimizer">
            {showPatchBanner && (
              <div className="w-full max-w-xl mx-auto px-2 sm:px-4 mb-4">
                <div className="rounded-2xl border border-sky-400/35 bg-gradient-to-r from-sky-950/75 via-slate-900/85 to-indigo-950/75 backdrop-blur-xl p-3 sm:p-4 shadow-2xl text-left transition-all">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                      <span className="text-[11px] font-black tracking-wider uppercase text-emerald-400">Live Patch Deployed</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/90 font-mono font-bold">v2.5.0</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPatchBanner(false)}
                      className="text-white/40 hover:text-white/90 text-sm leading-none px-1.5 py-0.5 rounded hover:bg-white/10 transition"
                      title="Dismiss update banner"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs font-bold text-white mb-2 tracking-tight">
                    Universal Multi-Segment STTS Split & Memory Hardening
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-white/80">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Multi-entry STTS split (fixed 70% crash)</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Sub-process 96MB GC sandbox</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Signed CTTS B-frames (no range error)</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Smooth 4MB uploads without dropback</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="hero-banner text-center mb-6">
              <h1
                className="hero-headline text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter text-white mb-2 cursor-pointer select-none"
                style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
                onClick={() => setHeroMsgIndex((prev) => (prev + 1) % HERO_MESSAGES.length)}
                title="Click to cycle message"
              >
                <ShutterText
                  text={HERO_MESSAGES[heroMsgIndex].title}
                  triggerKey={heroMsgIndex}
                  textClassName="text-[clamp(1.4rem,3.8vw,3.25rem)] font-extrabold tracking-tight"
                  textColor="#ffffff"
                  topSliceColor="#38bdf8"
                  midSliceColor="#cbd5e1"
                  botSliceColor="#818cf8"
                />
              </h1>
              <p className="hero-subline text-white/70 text-xs sm:text-sm md:text-base max-w-xl mx-auto mb-3 transition-opacity duration-300">
                {HERO_MESSAGES[heroMsgIndex].sub}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                <p className="text-xs text-green-400 font-medium tracking-wide">TikTok Ingestion Engine Ready · 19200 Timescale</p>
              </div>
            </div>

            <Optimizer apiKey={apiKey} onKeyChange={onKeyChange} onBusy={setBusy} />
          </section>
        )}

        {activeTab === 'inspect' && (
          <section className="workspace-view active" key="inspect">
            <div className="section-head">
              <div className="head-badge">
                <InspectIcon width={14} height={14} />
                <span>TIKTOK INGESTION DIAGNOSTICS</span>
              </div>
              <h2 className="head-title">TikTok Video &amp; Codec Inspector</h2>
              <p className="head-sub">
                Audit any live TikTok video URL or local master clip against TikTok\'s high-FPS (60fps / 120fps) and HDR ingestion criteria.
              </p>
            </div>
            <Inspector apiKey={apiKey} />
          </section>
        )}

        {activeTab === 'library' && (
          <section className="workspace-view active" key="library">
            <div className="section-head">
              <div className="head-badge">
                <FilmIcon width={14} height={14} />
                <span>SERVER STORAGE AUDIT</span>
              </div>
              <h2 className="head-title">Lossless Export Master Library</h2>
              <p className="head-sub">
                Review recently repackaged masters and cached uploads currently staged in local server memory.
              </p>
            </div>
            <Library apiKey={apiKey} />
          </section>
        )}

        {activeTab === 'architecture' && (
          <section className="workspace-view active" key="architecture">
            <div className="section-head">
              <div className="head-badge">
                <LayersIcon width={14} height={14} />
                <span>TECHNICAL SPECIFICATIONS</span>
              </div>
              <h2 className="head-title">Engine Architecture &amp; Methodology</h2>
              <p className="head-sub">
                How Obito Studio preserves full 60/120fps motion fluidity and wide dynamic range without transcoding.
              </p>
            </div>

            <div className="pillars-grid">
              {ARCH_PILLARS.map(({ Icon, title, subtitle, desc }) => (
                <div className="pillar-card" key={title}>
                  <div className="pillar-header">
                    <div className="pillar-icon">
                      <Icon width={22} height={22} />
                    </div>
                    <div>
                      <h3 className="pillar-title">{title}</h3>
                      <span className="pillar-sub">{subtitle}</span>
                    </div>
                  </div>
                  <p className="pillar-desc">{desc}</p>
                </div>
              ))}
            </div>

            <div className="workflow-section">
              <h3 className="sub-title">Three-Phase Mastering Pipeline</h3>
              <div className="workflow-grid">
                {WORKFLOW_STEPS.map(({ step, name, detail }) => (
                  <div className="workflow-card" key={step}>
                    <span className="wf-step">{step}</span>
                    <h4 className="wf-name">{name}</h4>
                    <p className="wf-detail">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'faq' && (
          <section className="workspace-view active" key="faq">
            <div className="section-head">
              <div className="head-badge">
                <HelpIcon width={14} height={14} />
                <span>OPERATIONAL FAQ</span>
              </div>
              <h2 className="head-title">Frequently Asked Questions</h2>
              <p className="head-sub">
                Everything you need to know about timescale remuxing, bitrates, and privacy.
              </p>
            </div>

            <div className="faq-container">
              {FAQ_ITEMS.map(([q, a]) => (
                <details className="faq-item" key={q}>
                  <summary className="faq-question">
                    <span>{q}</span>
                    <ChevronIcon width={18} height={18} />
                  </summary>
                  <p className="faq-answer">{a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ---------- Studio Footer ---------- */}
      <footer className="studio-footer">
        <div className="footer-left">
          <Logo size={20} />
          <span>OBITO STUDIO · High-Performance Lossless Video Mastering Suite</span>
        </div>
        <div className="footer-right">
          <span>Bit-for-Bit Stream Copy · 19200 Timescale · DOVI Profile 8.4</span>
        </div>
      </footer>

      {/* ---------- iOS Vision Clear Glass Bottom Dock ---------- */}
      <nav
        className="ios-dock-wrap"
        aria-label="Studio Tools Menu"
        onTouchStart={onDockTouchStart}
        onTouchMove={onDockTouchMove}
        onTouchEnd={onDockTouchEnd}
        onTouchCancel={() => { setDragOffset(0); setHoveredTab(null); }}
      >
        <div
          className="ios-dock-bar"
          ref={dockBarRef}
        >
          {/* Animated Clear Glass Sliding Pill Lens (Uniform size across all tabs) */}
          {indicatorStyle.ready && (
            <div
              className={`ios-dock-pill-slider ${dragOffset > 0 ? 'dragging' : ''}`}
              style={{
                transform: `translateX(${dragOffset > 0 ? dragOffset - (indicatorStyle.width / 2) : indicatorStyle.left}px)`,
                width: `${indicatorStyle.width}px`
              }}
            />
          )}

          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                data-tab-id={id}
                className={`ios-dock-item ${active ? 'active' : ''} ${hoveredTab === id ? 'hovered' : ''}`}
                onClick={(e) => {
                  if (suppressClickRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  switchTabWithHaptic(id);
                }}
                aria-label={label}
              >
                <div className="dock-icon-wrap">
                  <Icon width={21} height={21} />
                  {id === 'optimizer' && busy && <span className="dock-pulse" />}
                </div>
                <span className="dock-label">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
