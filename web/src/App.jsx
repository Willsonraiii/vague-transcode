import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from './Logo.jsx';
import Optimizer from './Optimizer.jsx';
import Inspector from './Inspector.jsx';
import Library from './Library.jsx';
import {
  ChevronIcon, FpsIcon, HdrIcon, HelpIcon,
  InspectIcon, LayersIcon, LightningIcon, ShieldIcon, SparkIcon, FilmIcon
} from './icons.jsx';

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

export default function App() {
  const [activeTab, setActiveTab] = useState('optimizer'); // optimizer | inspect | library | architecture | faq
  const [apiKey, setApiKey] = useState(() => lsGet('obitoKey') || '');
  const [busy, setBusy] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [now, setNow] = useState(() => new Date());

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

  // Touch / Finger swipe navigation across tabs
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    }
  };

  const onTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Minimum 45px swipe, mostly horizontal, fast enough (<600ms)
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 600) {
      const tabIds = TABS.map((t) => t.id);
      const currIdx = tabIds.indexOf(activeTab);
      if (currIdx !== -1) {
        if (dx < 0 && currIdx < tabIds.length - 1) {
          // Swipe Left -> Next Tab
          setActiveTab(tabIds[currIdx + 1]);
        } else if (dx > 0 && currIdx > 0) {
          // Swipe Right -> Previous Tab
          setActiveTab(tabIds[currIdx - 1]);
        }
      }
    }
  };

  const dayStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="studio-app">
      {/* ---------- Ultra-Premium Studio Top Bar with Frameless Living Logo ---------- */}
      <header
        className="studio-topbar"
        onPointerMove={onTopbarMove}
        onPointerLeave={onTopbarLeave}
      >
        {/* Left Segment: Brand */}
        <div className="topbar-left">
          <div className="studio-brand" onClick={() => setActiveTab('optimizer')}>
            <span className="brand-name">OBITO STUDIO</span>
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
          >
            <span className="key-dot" />
            <span>{apiKey ? 'Key Set' : 'Key'}</span>
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

      {/* ---------- Main Workspace Viewport (with finger swipe support) ---------- */}
      <main
        className="studio-workspace"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeTab === 'optimizer' && (
          <section className="workspace-view active optimizer-view">
            <div className={`hero-banner ${busy ? 'busy-hidden-mobile' : ''}`}>
              <h1 className="hero-headline">TikTok Lossless Video Master</h1>
              <p className="hero-subline">Preserve native high FPS (60fps, 120fps+) &amp; HDR with zero TikTok compression.</p>
            </div>

            <Optimizer apiKey={apiKey} onKeyChange={onKeyChange} onBusy={setBusy} />
          </section>
        )}

        {activeTab === 'inspect' && (
          <section className="workspace-view active">
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
          <section className="workspace-view active">
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
          <section className="workspace-view active">
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
          <section className="workspace-view active">
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

      {/* ---------- iOS Style Glassmorphic Bottom Navigation Row ---------- */}
      <nav className="ios-dock-wrap" aria-label="Studio Tools Menu">
        <div className="ios-dock-bar">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                className={`ios-dock-item ${active ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label={label}
              >
                <Icon width={16} height={16} />
                <span className="dock-label">{label}</span>
                {id === 'optimizer' && busy && <span className="dock-pulse" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
