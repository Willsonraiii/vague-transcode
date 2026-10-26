import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import TikTokPostSheet from './TikTokPostSheet.jsx';
import { BotAvatar } from 'bot-avatars';
import { MetalFx } from 'metal-fx';
import {
  CheckIcon, CloseIcon, DownloadIcon, FpsIcon, HdrIcon, KeyIcon,
  PauseIcon, PlayIcon, UploadIcon, RefreshIcon, ShareIcon, LightningIcon, InfoIcon,
  BookOpenIcon, TikTokIcon
} from './icons.jsx';
import { probeLocalFile } from './localProbe.js';
import { downloadWithTurbo, isTurboDownloadSupported } from './lib/turbo-downloader.js';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

class MetalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('MetalFx shader bypassed:', err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function SafeMetalFx({ children, ...props }) {
  return (
    <MetalErrorBoundary fallback={children}>
      <MetalFx {...props}>
        {children}
      </MetalFx>
    </MetalErrorBoundary>
  );
}

const MAX_BYTES = 600 * 1024 * 1024;
// Adaptive dynamic chunking: 2 MB start ensures fast ACK and eliminates timeouts on mobile WAN, scaling to 8 MB on fast Wi-Fi
const MIN_CHUNK = 2 * 1024 * 1024;
const MAX_CHUNK = 8 * 1024 * 1024;
const CHUNK_TIMEOUT_MS = 120 * 1000;  // 120s timeout per slice
const CHUNK_RETRIES = 5;              // per chunk, with fresh sync between tries

const MODES = [
  { id: 'hdr', label: 'HDR', shortLabel: 'HDR', badge: 'Apple HDR', Icon: HdrIcon },
  { id: 'standard', label: 'SDR', shortLabel: 'SDR', badge: 'Standard', Icon: FpsIcon }
];

// Standard binary byte formatting (1 MB = 1024 * 1024 bytes -> 71.0 MB for 74.5M bytes)
const fmt = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const hdrLabel = (t) => (!t || t === 'unknown' || t === 'sdr' ? 'SDR' : t === 'smpte2084' ? 'HDR10 / PQ' : t === 'arib-std-b67' ? 'HLG' : String(t).toUpperCase());
const fmtDur = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : '—');

/* ---------- Interactive Bot Avatar Stage (Libraries.dev bot-avatars) ---------- */
export function BotStage({ phase, busy }) {
  const isWorking = phase === 'upload' || phase === 'queued' || phase === 'process';
  const avatarType =
    phase === 'done' ? 'star' :
    phase === 'process' ? 'mech' :
    phase === 'upload' ? 'droid' :
    phase === 'paused' ? 'blob' :
    phase === 'error' ? 'ghost' :
    'clover';

  const avatarState =
    phase === 'process' || phase === 'upload' || busy ? 'working' :
    phase === 'paused' || phase === 'error' ? 'sleeping' :
    phase === 'done' ? 'working' :
    'default';

  const avatarFace = phase === 'done' ? 'mouth' : 'eyes';

  return (
    <div className={`bot-stage state-${phase}`} aria-hidden="true">
      <div className="bot-ambient-glow" />
      <div className="bot-pedestal">
        <BotAvatar
          type={avatarType}
          state={avatarState}
          face={avatarFace}
          size={70}
          theme="dark"
          interactive={true}
          shading="plastic"
        />
        {phase === 'done' && (
          <div className="bot-verified-badge" title="Optimization verified">
            <CheckIcon width={14} height={14} strokeWidth={2.8} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Live Optimizing Terminal ---------- */
function LiveTerminal({ log = [], busy, phase, queuePos, userName = 'Guest', userTier = 'free' }) {
  const terminalBodyRef = useRef(null);

  useEffect(() => {
    const el = terminalBodyRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 40);
    return () => clearTimeout(timer);
  }, [log, phase]);

  // ONLY show once video actually starts working (upload, queued, process, done)
  // NEVER on gallery pick / confirm screen!
  const isWorking = phase === 'upload' || phase === 'queued' || phase === 'process' || phase === 'done';
  if (!isWorking) return null;

  const tierKey = (userTier || 'free').toLowerCase();
  const cleanUser = userName || 'guest';

  return (
    <div className="live-terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className={`terminal-indicator ${busy || phase === 'process' ? 'pulsing' : 'done'}`} />
          <span>Live Optimizing Terminal</span>
        </div>
        <div className="terminal-meta">
          <span className="term-user-chip">@{cleanUser}</span>
          <span className={`term-tier-chip tier-${tierKey}`}>{tierKey.toUpperCase()}</span>
          <span>{phase === 'done' ? 'Completed' : phase === 'process' ? 'Processing' : phase === 'queued' ? (queuePos ? `Queued #${queuePos}` : 'Queued') : 'Stream Active'}</span>
        </div>
      </div>
      <div className="terminal-body" ref={terminalBodyRef}>
        <div className="terminal-line term-auth-line">
          <span className="term-num">SYS</span>
          <span className="term-text font-mono">
            <span className="text-emerald-400 font-semibold">[auth]</span> User: <b className="text-white">@{cleanUser}</b> · Tier: <span className={`term-tier-badge tier-${tierKey}`}>{tierKey.toUpperCase()}</span> · Engine: <span className="text-sky-300">Obito Sovereign Engine</span>
          </span>
        </div>
        {phase === 'queued' && (
          <div className="terminal-line obito">
            <span className="term-num">QUE</span>
            <span className="term-text">
              {queuePos
                ? `[queue] Position #${queuePos} in line · Waiting for active master to complete`
                : '[queue] Registered in processing pipeline · Holding slot safely'}
            </span>
          </div>
        )}
        {log.length === 0 ? (
          <div className="terminal-line dim">
            <span className="term-num">00</span>
            <span className="term-text">Waiting for stream initialization...</span>
          </div>
        ) : (
          log.map((line, idx) => {
            const isObito = line.startsWith('[obito]');
            const isFf = line.startsWith('[ff]');
            const isErr = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
            return (
              <div key={idx} className={`terminal-line ${isErr ? 'err' : isObito ? 'obito' : isFf ? 'ff' : ''}`}>
                <span className="term-num">{String(idx + 1).padStart(2, '0')}</span>
                <span className="term-text">{line}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------- Simple, Clean Video Spec Chips ---------- */
function SpecGrid({ p, realFps, isOutput }) {
  if (!p) return null;
  const fpsText = realFps && realFps !== p.fps ? `${realFps} → ${p.fps} fps` : (p.fps ? `${p.fps} fps` : null);
  const isDolby = !!p.dv;
  const isHdr = p.transfer && p.transfer !== 'sdr' && p.transfer !== 'unknown';
  const bitrateMbps = p.dur > 0 && p.size > 0 ? ((p.size * 8) / (p.dur * 1e6)).toFixed(1) : null;

  return (
    <div className="spec-card">
      <div className="spec-card-head">
        <b>{isOutput ? 'Optimized file specs' : (p.fps || p.w ? 'Video specs (detected on-device)' : 'Selected video file')}</b>
      </div>
      <div className="spec-chips">
        {fpsText && <span className="spec-chip highlight">{fpsText}</span>}
        {p.w && p.h && <span className="spec-chip">{p.w}×{p.h}</span>}
        {isHdr && <span className="spec-chip highlight-amber">{hdrLabel(p.transfer)}</span>}
        {isDolby && <span className="spec-chip highlight-amber">Dolby Vision Profile {p.dv}</span>}
        <span className="spec-chip">{(p.codec || '—').toUpperCase()}</span>
        {bitrateMbps && <span className="spec-chip" title="Calculated bitrate (Recommended: 20–35 Mbps)">{bitrateMbps} Mbps</span>}
        {p.audio ? <span className="spec-chip">{p.audio} audio</span> : null}
        {p.dur ? <span className="spec-chip">{fmtDur(p.dur)}</span> : null}
        <span className="spec-chip">{fmt(p.size)}</span>
      </div>
    </div>
  );
}


const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;
const readMap = () => { try { return JSON.parse(lsGet('obitoUploads') || '{}'); } catch { return {}; } };
const writeMap = (m) => lsSet('obitoUploads', JSON.stringify(m));

/* ---------- Sculpted Ultra-Premium Mode Toggle ---------- */
function ModeSelect({ value, onChange }) {
  const modeGroupRef = useRef(null);
  const [modePill, setModePill] = useState({ left: 0, width: 0, ready: false });

  const updateModePill = useCallback(() => {
    if (!modeGroupRef.current) return;
    const activeBtn = modeGroupRef.current.querySelector(`.mode-toggle-btn[data-mode-id="${value}"]`);
    if (activeBtn) {
      setModePill({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth, ready: true });
    }
  }, [value]);

  useEffect(() => {
    updateModePill();
    window.addEventListener('resize', updateModePill);
    return () => window.removeEventListener('resize', updateModePill);
  }, [updateModePill]);

  const touchRef = useRef({ startX: 0, startY: 0, startTime: 0, hasSwiped: false, initialMode: 'hdr' });
  const suppressClickRef = useRef(false);

  const switchModeWithHaptic = useCallback((newMode) => {
    if (newMode !== value) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(10); } catch {}
      onChange(newMode);
    }
  }, [value, onChange]);

  const onModeTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      const t = e.touches[0];
      touchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        hasSwiped: false,
        initialMode: value
      };
    }
  };

  const onModeTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (!touchRef.current.hasSwiped && Math.abs(dx) >= 28) {
        touchRef.current.hasSwiped = true;
        suppressClickRef.current = true;

        const modeIds = MODES.map((m) => m.id);
        const currIdx = modeIds.indexOf(touchRef.current.initialMode);
        if (currIdx !== -1) {
          if (dx > 0 && currIdx < modeIds.length - 1) {
            // Swipe Right -> Step forward to the right
            switchModeWithHaptic(modeIds[currIdx + 1]);
          } else if (dx < 0 && currIdx > 0) {
            // Swipe Left -> Step backward to the left
            switchModeWithHaptic(modeIds[currIdx - 1]);
          } else {
            if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(6); } catch {}
          }
        }
      }
    }
  };

  const onModeTouchEnd = (e) => {
    if (touchRef.current.hasSwiped) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 350);
      return;
    }

    if (e.changedTouches && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchRef.current.startX;
      const dy = t.clientY - touchRef.current.startY;
      const dt = Date.now() - touchRef.current.startTime;

      if (Math.abs(dx) >= 22 && Math.abs(dx) > Math.abs(dy) * 1.1 && dt < 320) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 350);

        const modeIds = MODES.map((m) => m.id);
        const currIdx = modeIds.indexOf(touchRef.current.initialMode);
        if (currIdx !== -1) {
          if (dx > 0 && currIdx < modeIds.length - 1) {
            switchModeWithHaptic(modeIds[currIdx + 1]);
          } else if (dx < 0 && currIdx > 0) {
            switchModeWithHaptic(modeIds[currIdx - 1]);
          }
        }
      }
    }
  };

  return (
    <div className="mode-toggle-wrap">
      <div
        className="mode-toggle-group"
        ref={modeGroupRef}
        role="radiogroup"
        aria-label="Optimization mode"
        onTouchStart={onModeTouchStart}
        onTouchMove={onModeTouchMove}
        onTouchEnd={onModeTouchEnd}
      >
        {/* Animated Clear Glass Sliding Pill */}
        {modePill.ready && (
          <div
            className="mode-toggle-pill-slider"
            style={{
              transform: `translateX(${modePill.left}px)`,
              width: `${modePill.width}px`
            }}
          />
        )}

        {MODES.map(({ id, label, shortLabel, badge, Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              data-mode-id={id}
              role="radio"
              aria-checked={active}
              className={`mode-toggle-btn ${active ? 'active' : ''} mode-${id}`}
              onClick={(e) => {
                if (suppressClickRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                switchModeWithHaptic(id);
              }}
            >
              <div className="mode-btn-content">
                <Icon width={15} height={15} className="mode-btn-icon" />
                <span className="mode-btn-label mode-btn-label-full">{label}</span>
                <span className="mode-btn-label mode-btn-label-short">{shortLabel}</span>
              </div>
              <span className="mode-btn-badge">{badge}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Main Studio Optimizer Component ---------- */
export default function Optimizer({ apiKey, onKeyChange, onBusy, userName = 'Guest', userTier = 'free', onSwitchTab, onSwitchToGuide }) {
  const [phase, setPhase] = useState('idle'); // idle | upload | paused | queued | process | done | error | confirm
  const [mode, setMode] = useState('hdr');
  const [pct, setPct] = useState(0);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [src, setSrc] = useState(null);
  const [out, setOut] = useState(null);
  const [confirmAt, setConfirmAt] = useState('pre');
  const srcRef = useRef(null);
  const dropzoneRef = useRef(null);
  const [error, setError] = useState('');
  const [needKey, setNeedKey] = useState(false);
  const [drag, setDrag] = useState(false);
  const [kept, setKept] = useState(null);
  const [dl, setDl] = useState({ state: 'idle', pct: 0, speed: '' });
  const [ttOpen, setTtOpen] = useState(false);          // Post to TikTok sheet
  const [ttReviewOpen, setTtReviewOpen] = useState(false); // TikTok Direct Post Developer Review modal
  const [ttCfg, setTtCfg] = useState({ enabled: false }); // GET /api/tiktok/config
  const input = useRef(null);
  const xhrRef = useRef(null);
  const timer = useRef(null);
  const upId = useRef(null);
  const jobId = useRef(null);
  const fileRef = useRef(null);
  const flags = useRef({ pause: false, cancel: false });
  const keyRef = useRef(apiKey);
  const modeRef = useRef(mode);
  const savedFile = useRef(null);
  keyRef.current = apiKey;
  modeRef.current = mode;

  const [ensureH264, setEnsureH264] = useState(false);
  const h264Ref = useRef(false);
  h264Ref.current = ensureH264;
  const [uploadSpeed, setUploadSpeed] = useState('');
  const uploadStartTime = useRef(0);
  const [queuePos, setQueuePos] = useState(null);
  const [serverQueue, setServerQueue] = useState({ busy: false, queuedCount: 0 });

  const headers = useCallback(() => (keyRef.current ? { 'x-access-token': keyRef.current } : {}), []);

  // Is "Post to TikTok" configured on this server?  (public endpoint)
  useEffect(() => {
    fetch('/api/tiktok/config').then((r) => r.json()).then(setTtCfg).catch(() => {});
  }, []);

  // If the TikTok sign-in had to use a full-page redirect (popup blocked), the page reloaded and
  // the finished job state was lost — restore it from the server and reopen the sheet.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.get('tiktok')) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('obito.tiktokReturnJob') || 'null'); localStorage.removeItem('obito.tiktokReturnJob'); } catch { /* ignore */ }
    window.history.replaceState(null, '', window.location.pathname + '#optimizer');
    if (!saved?.jobId || Date.now() - (saved.at || 0) > 60 * 60 * 1000) return;
    fetch('/api/jobs/' + saved.jobId, { headers: headers() }).then((r) => r.ok ? r.json() : null).then((job) => {
      if (!job || job.status !== 'done') return;
      if (job.probeIn) setSrc(job.probeIn);
      if (job.probeOut) setOut(job.probeOut);
      setFile({ name: saved.fileName || 'video.mp4' });
      setResult({ id: job.id, bytes: job.outputBytes || 0, srcFps: job.result?.derived?.sourceFps, derived: job.result?.derived });
      setPct(100);
      setPhase('done');
      if (q.get('tiktok') === 'connected') setTtOpen(true);
    }).catch(() => {});
  }, [headers]);
  const withKey = useCallback((url) => (keyRef.current ? url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : url), []);
  useEffect(() => () => clearInterval(timer.current), []);

  // Poll server queue status while on confirm screen to inform user of busy engine
  useEffect(() => {
    if (phase !== 'confirm') return;
    let mounted = true;
    const checkQueue = async () => {
      try {
        const res = await fetch('/api/queue/status');
        if (res.ok) {
          const d = await res.json();
          if (mounted) setServerQueue(d);
        }
      } catch {}
    };
    checkQueue();
    const interval = setInterval(checkQueue, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [phase]);

  // Keep the screen awake while this page is actively transferring, processing, or downloading.
  // Browsers may release the lock when hidden; request it again on return.
  useEffect(() => {
    const active = phase === 'upload' || phase === 'queued' || phase === 'process' || phase === 'done' || dl.state === 'loading';
    if (!active || !navigator.wakeLock?.request) return;
    let mounted = true;
    let lock = null;
    const acquire = async () => {
      if (!mounted || document.visibilityState !== 'visible' || lock) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (!mounted) { await next.release(); return; }
        lock = next;
        next.addEventListener('release', () => {
          if (lock === next) lock = null;
        });
      } catch { /* Unsupported, low battery, or OS policy: proceed normally. */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', onVisibility);
    void acquire();
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lock) void lock.release();
    };
  }, [phase, dl.state]);

  const fail = useCallback((msg, askKey = false) => {
    clearInterval(timer.current);
    setError(msg);
    setNeedKey(askKey);
    setPhase('error');
    setUploadSpeed('');
    setQueuePos(null);
    const f = fileRef.current;
    if (f) {
      const m = readMap();
      delete m[fileKey(f)];
      writeMap(m);
    }
    upId.current = null;
  }, []);

  /* ----- job polling ----- */
  const poll = useCallback((id) => {
    clearInterval(timer.current);
    let failCount = 0;
    timer.current = setInterval(async () => {
      try {
        const r = await fetch(withKey('/api/jobs/' + id), { headers: headers() });
        if (r.status === 401) return fail('Access key required.', true);
        if (r.status === 404) return fail('Job session expired. Please re-select the video.');
        if (!r.ok) {
          failCount++;
          if (failCount > 15) return fail('Server unavailable. Please check your connection.');
          return;
        }
        const job = await r.json();
        failCount = 0;
        if (Array.isArray(job.log)) setLog(job.log);
        if (job.probeIn) setSrc(job.probeIn);
        if (job.probeOut) setOut(job.probeOut);
        if (job.status === 'queued') {
          setPhase('queued');
          if (job.queuePosition) setQueuePos(job.queuePosition);
        } else if (job.status === 'processing') {
          setPhase('process');
          setPct(job.progress || 0);
          setQueuePos(null);
        } else if (job.status === 'failed') {
          setQueuePos(null);
          fail(job.error || 'Optimization failed.');
        } else if (job.status === 'done') {
          clearInterval(timer.current);
          setQueuePos(null);
          setResult({ id, bytes: job.outputBytes || 0, srcFps: job.result?.derived?.sourceFps, derived: job.result?.derived });
          setPct(100);
          setPhase('done');
        }
      } catch {
        failCount++;
        if (failCount > 15) fail('Lost server connection during processing.');
      }
    }, 1500);
  }, [fail, headers, withKey]);

  const startJob = useCallback(async (uploadId) => {
    setPhase('queued');
    setPct(0);
    const h264Label = h264Ref.current ? ' · H.264 compatibility tag' : '';
    setLog((prev) => [...prev, `[obito] Ingestion complete. Initializing lossless master engine${h264Label}...`]);
    try {
      const r = await fetch(withKey('/api/uploads/' + uploadId + '/start'), {
        method: 'POST',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ mode: modeRef.current, ensureH264: h264Ref.current })
      });
      if (r.status === 401) return fail('Access key required.', true);
      if (r.status === 404) {
        const f = fileRef.current;
        if (f) {
          const m = readMap();
          delete m[fileKey(f)];
          writeMap(m);
        }
        upId.current = null;
        setKept(null);
        return fail('Upload session expired on server. Please re-select video.');
      }
      if (!r.ok) return fail('Failed to start optimization.');
      jobId.current = (await r.json()).id;
      setLog((prev) => [...prev, `[obito] Pipeline engaged (Job ${jobId.current.slice(0, 8)}). Locking 60/120fps cadence and HDR color...`]);
      poll(jobId.current);
    } catch { fail('Could not reach the server.'); }
  }, [fail, headers, poll, withKey]);

  /* ----- chunk upload loop ----- */
  const runUpload = useCallback(async () => {
    const f = fileRef.current;
    if (!f) return;
    setPhase('upload');
    setLog((prev) => [...prev, `[client] Uploading master video (${fmt(f.size)})...`]);
    flags.current.pause = false;
    flags.current.cancel = false;
    let id = upId.current;
    let offset = 0;

    // 1. If we have a cached upload ID, verify with server if it actually exists and is active
    if (id) {
      try {
        const r = await fetch(withKey('/api/uploads/' + id), { headers: headers() });
        if (r.status === 401) return fail('Access key required.', true);
        if (r.status === 404) {
          // Stale ID from prior session or server restart — clear and create fresh upload
          const m = readMap();
          delete m[fileKey(f)];
          writeMap(m);
          id = null;
          upId.current = null;
          offset = 0;
        } else if (r.ok) {
          const u = await r.json();
          offset = u.received ?? u.bytesReceived ?? 0;
        } else {
          id = null;
          upId.current = null;
          offset = 0;
        }
      } catch {
        id = null;
        upId.current = null;
        offset = 0;
      }
    }

    // 2. If no valid upload session on server, initiate a fresh one
    if (!id) {
      try {
        const r = await fetch(withKey('/api/uploads'), {
          method: 'POST',
          headers: { ...headers(), 'content-type': 'application/json' },
          body: JSON.stringify({ name: f.name, size: f.size })
        });
        if (r.status === 401) return fail('Access key required.', true);
        if (!r.ok) return fail((await r.json().catch(() => ({}))).error || 'Could not initiate upload.');
        id = (await r.json()).id;
        upId.current = id;
        const m = readMap();
        m[fileKey(f)] = { id, size: f.size, name: f.name, savedAt: Date.now() };
        writeMap(m);
        offset = 0;
      } catch { return fail('Could not connect to server.'); }
    }

    uploadStartTime.current = Date.now();
    let currentChunk = MIN_CHUNK;

    // 3. Chunk upload loop (adaptive dynamic scaling: 2 MB -> 4 MB -> 8 MB)
    while (offset < f.size) {
      if (flags.current.cancel) return;
      if (flags.current.pause) { setPhase('paused'); return; }

      setPct((offset / f.size) * 100);

      let res = null;
      for (let attempt = 0; attempt < CHUNK_RETRIES; attempt++) {
        if (flags.current.cancel || flags.current.pause) break;
        // Recomputed every attempt: a failed chunk can leave the server holding
        // part of the body, and the refreshed offset decides the next slice.
        const end = Math.min(offset + currentChunk, f.size);
        const chunk = f.slice(offset, end);
        const isLast = end === f.size;
        const chunkStartTime = Date.now();
        try {
          res = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrRef.current = xhr;
            xhr.open('PUT', withKey(`/api/uploads/${id}?offset=${offset}${isLast ? '&last=1' : ''}`));
            if (keyRef.current) xhr.setRequestHeader('x-access-token', keyRef.current);
            xhr.setRequestHeader('content-type', 'application/octet-stream');
            xhr.timeout = CHUNK_TIMEOUT_MS;
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable && !flags.current.pause && !flags.current.cancel) {
                const loadedTotal = offset + e.loaded;
                setPct((loadedTotal / f.size) * 100);
                const elapsed = (Date.now() - uploadStartTime.current) / 1000;
                if (elapsed > 0.5) {
                  const bytesPerSec = loadedTotal / elapsed;
                  const mbps = (bytesPerSec / 1048576).toFixed(1);
                  const remBytes = Math.max(0, f.size - loadedTotal);
                  const remSec = Math.ceil(remBytes / (bytesPerSec || 1));
                  setUploadSpeed(`${mbps} MB/s · ${remSec}s left`);
                }
              }
            };
            xhr.onload = () => {
              if (xhr.status === 401) return reject(new Error('KEY_NEEDED'));
              if (xhr.status === 404) {
                // Server lost or pruned this upload ID — purge cache and trigger auto-restart
                const m = readMap();
                delete m[fileKey(f)];
                writeMap(m);
                upId.current = null;
                return reject(new Error('UNKNOWN_UPLOAD'));
              }
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
                return;
              }
              if (xhr.status === 409) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  if (typeof data.received === 'number') {
                    resolve({ synced: true, received: data.received });
                    return;
                  }
                } catch {}
              }
              let errMsg = 'CHUNK_FAIL';
              try {
                const j = JSON.parse(xhr.responseText);
                if (j.error) errMsg = j.error;
              } catch {}
              reject(new Error(errMsg));
            };
            xhr.onerror = () => reject(new Error('NET_ERR'));
            xhr.ontimeout = () => reject(new Error('NET_TIMEOUT'));
            xhr.onabort = () => resolve({ aborted: true });
            xhr.send(chunk);
          });

          // Chunk accepted! Calculate duration for adaptive dynamic scaling
          const chunkDurationSec = (Date.now() - chunkStartTime) / 1000;
          if (chunkDurationSec < 2.5) {
            currentChunk = Math.min(currentChunk * 2, MAX_CHUNK);
          } else if (chunkDurationSec > 20.0) {
            currentChunk = Math.max(MIN_CHUNK, Math.floor(currentChunk / 2));
          }
          break; // chunk accepted
        } catch (err) {
          currentChunk = MIN_CHUNK; // scale back down on retry for safety
          if (err.message === 'KEY_NEEDED') return fail('Access key required.', true);
          if (err.message === 'UNKNOWN_UPLOAD') {
            // Upload was purged/unknown on server — immediately re-create and resume from offset 0
            setLog((prev) => [...prev, '[client] Server session expired. Re-starting fresh upload...']);
            try {
              const r = await fetch(withKey('/api/uploads'), {
                method: 'POST',
                headers: { ...headers(), 'content-type': 'application/json' },
                body: JSON.stringify({ name: f.name, size: f.size })
              });
              if (r.status === 401) return fail('Access key required.', true);
              if (!r.ok) return fail('Could not start fresh upload.');
              id = (await r.json()).id;
              upId.current = id;
              const m = readMap();
              m[fileKey(f)] = { id, size: f.size, name: f.name, savedAt: Date.now() };
              writeMap(m);
              offset = 0;
              uploadStartTime.current = Date.now();
              currentChunk = MIN_CHUNK;
              res = null;
              break; // exit retry loop and continue outer while loop with new id and offset 0
            } catch {
              return fail('Lost connection to server.');
            }
          }
          if (attempt === CHUNK_RETRIES - 1) {
            const detail = err?.message && err.message !== 'CHUNK_FAIL' && err.message !== 'NET_ERR'
              ? err.message
              : 'Upload interrupted. Check your connection.';
            return fail(detail);
          }
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          try {
            const r = await fetch(withKey('/api/uploads/' + id), { headers: headers() });
            if (r.status === 404) {
              const m = readMap();
              delete m[fileKey(f)];
              writeMap(m);
              upId.current = null;
            } else if (r.ok) {
              const j = await r.json();
              const rec = j.received ?? j.bytesReceived;
              if (typeof rec === 'number') offset = rec;
            }
          } catch { /* keep the old offset and retry as-is */ }
          if (flags.current.cancel || flags.current.pause) break;
        }
      }

      if (flags.current.cancel) return;
      if (flags.current.pause) { setPhase('paused'); return; }
      if (!res) continue;              // paused/refreshed — re-enter the loop
      if (res.aborted) return;
      offset = res.received ?? res.bytesReceived ?? Math.min(offset + currentChunk, f.size);
    }

    setPct(100);
    setUploadSpeed('');
    const m = readMap();
    delete m[fileKey(f)];
    writeMap(m);

    if (confirmAt === 'pre') {
      startJob(id);
    } else {
      try {
        const r = await fetch(withKey('/api/uploads/' + id), { headers: headers() });
        if (r.ok) {
          const u = await r.json();
          if (u.probe) {
            setSrc(u.probe);
            srcRef.current = u.probe;
            setPhase('confirm');
            return;
          }
        }
      } catch { /* proceed */ }
      startJob(id);
    }
  }, [confirmAt, fail, headers, startJob, withKey]);

  /* ----- start user action ----- */
  const start = async (f) => {
    try {
      if (!f) return;
      const isVideo = /\.(mp4|mov|m4v)$/i.test(f.name || '') || (f.type && (f.type.startsWith('video/') || f.type === 'video/quicktime'));
      if (!isVideo) return fail('Only MP4, MOV, and M4V video files are supported.');
      if (f.size > MAX_BYTES) { setFile(f); return fail('That video exceeds the 600 MB size limit.'); }

      // Ensure file has a proper name for display and server ingestion
      if (!/\.(mp4|mov|m4v)$/i.test(f.name || '')) {
        try { Object.defineProperty(f, 'name', { value: (f.name || 'video') + '.mp4', writable: true }); } catch {}
      }

      setFile(f);
      fileRef.current = f;
      savedFile.current = f;
      setError('');
      setResult(null);
      setLog([]);
      setOut(null);
      setDl({ state: 'idle', pct: 0 });

      const m = readMap();
      const hit = m[fileKey(f)];
      // If cached entry is older than 30 minutes, purge it
      if (hit && (!hit.savedAt || Date.now() - hit.savedAt > 30 * 60 * 1000)) {
        delete m[fileKey(f)];
        writeMap(m);
        upId.current = null;
      } else {
        upId.current = hit?.id || null;
      }
      jobId.current = null;

      let p = null;
      try {
        p = await probeLocalFile(f);
      } catch (err) {
        console.warn('Local probe error, using fallback:', err);
      }

      const detected = p || {
        size: f.size,
        dur: null,
        w: null,
        h: null,
        fps: null,
        codec: (f.name.split('.').pop() || 'MP4').toUpperCase(),
        transfer: 'sdr'
      };

      setSrc(detected);
      srcRef.current = detected;
      setConfirmAt('pre');
      setPhase('confirm');
      setLog([
        `[auth] User: @${userName || 'guest'} · Tier: ${(userTier || 'free').toUpperCase()}`,
        `[client] Selected: ${f.name} (${fmt(f.size)})`,
        p
          ? `[obito] Video probe: ${p.w}×${p.h} · ${p.fps} fps · ${(p.codec || '').toUpperCase()}${p.transfer ? ' · ' + p.transfer : ''}`
          : `[obito] Ready for lossless mastering: ${f.name} (${fmt(f.size)})`
      ]);
    } catch (err) {
      console.error('Error selecting file:', err);
      fail('Could not load selected video: ' + (err.message || 'unknown error'));
    }
  };

  const pause = () => { flags.current.pause = true; xhrRef.current?.abort(); setPhase('paused'); };
  const resume = () => { flags.current.pause = false; runUpload(); };
  const cancel = () => {
    flags.current.cancel = true;
    flags.current.pause = false;
    xhrRef.current?.abort();
    clearInterval(timer.current);
    setUploadSpeed('');
    const f = fileRef.current;
    if (f) {
      const m = readMap();
      delete m[fileKey(f)];
      writeMap(m);
    }
    upId.current = null;
    jobId.current = null;
    setKept(null);
    setPhase('idle');
    setPct(0);
  };
  const reset = () => {
    flags.current.cancel = true;
    flags.current.pause = false;
    xhrRef.current?.abort();
    clearInterval(timer.current);
    setUploadSpeed('');
    const f = fileRef.current;
    if (f) {
      const m = readMap();
      delete m[fileKey(f)];
      writeMap(m);
    }
    setPhase('idle');
    setFile(null);
    setResult(null);
    setLog([]);
    setSrc(null);
    setOut(null);
    setPct(0);
    setError('');
    setQueuePos(null);
    upId.current = null;
    jobId.current = null;
    fileRef.current = null;
  };

  const continueKept = () => {
    if (!kept) return;
    fileRef.current = kept.file;
    setFile(kept.file);
    upId.current = kept.id;
    setKept(null);
    runUpload();
  };

  const discardKept = () => {
    if (kept?.file) {
      const m = readMap();
      delete m[fileKey(kept.file)];
      writeMap(m);
    }
    setKept(null);
  };

  const handleDirectDownload = () => {
    if (!result?.id) return;
    const downloadUrl = withKey('/api/jobs/' + result.id + '/download');
    const name = (file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-obito-' + mode + '.mp4';

    // Direct native browser streaming (zero JS RAM usage)
    if (isStandalone()) {
      window.open(downloadUrl, '_blank');
      return;
    }
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = name;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
  };

  const handleTurboDownload = async () => {
    if (!result?.id) return;
    const downloadUrl = withKey('/api/jobs/' + result.id + '/download');
    const name = (file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-obito-' + mode + '.mp4';

    // If Turbo download is not supported in environment, fall back to direct download
    if (!isTurboDownloadSupported()) {
      handleDirectDownload();
      return;
    }

    try {
      setDl({ state: 'loading', pct: 0, speed: 'Connecting...' });
      await downloadWithTurbo({
        url: downloadUrl,
        fileName: name,
        totalBytes: result.bytes || 0,
        headers: headers(),
        onProgress: ({ percent, speedFormatted }) => {
          setDl({ state: 'loading', pct: percent, speed: speedFormatted });
        },
      });
      setDl({ state: 'done', pct: 100, speed: '' });
      setTimeout(() => setDl({ state: 'idle', pct: 0, speed: '' }), 2500);
    } catch (err) {
      if (err.isCancelled) {
        setDl({ state: 'idle', pct: 0, speed: '' });
        return;
      }
      console.warn('Turbo download error:', err);
      setDl({ state: 'error', pct: 0, speed: '', error: 'Transfer interrupted. Tap to retry or use Direct Download.' });
    }
  };

  const saveFile = async () => {
    if (!result?.id) return;
    const name = (file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-lossless.mp4';

    // For large files (> 40 MB), use direct native download to prevent mobile heap crashes
    if (file && file.size > 40 * 1024 * 1024) {
      handleDirectDownload();
      return;
    }

    try {
      setDl({ state: 'loading', pct: 0 });
      const res = await fetch(withKey('/api/jobs/' + result.id + '/download'), { headers: headers() });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const f = new File([blob], name, { type: 'video/mp4' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: name });
      } else {
        handleDirectDownload();
      }
    } catch {
      handleDirectDownload();
    } finally {
      setDl({ state: 'idle', pct: 0 });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    if (phase === 'idle') start(e.dataTransfer.files?.[0]);
  };

  const busy = phase === 'upload' || phase === 'queued' || phase === 'process';
  const isBusyOrConfirm = busy || phase === 'confirm';
  useEffect(() => { onBusy && onBusy(isBusyOrConfirm); }, [isBusyOrConfirm, onBusy]);

  return (
    <div className="studio-optimizer w-full max-w-xl mx-auto px-3 sm:px-0">
      {/* ---------- Main Clean Dropzone Box ---------- */}
      <div
        ref={dropzoneRef}
        className={`clean-dropzone liquid-glass-frame relative overflow-hidden rounded-[26px] p-5 sm:p-6 md:p-7 ${drag ? 'drag-over' : ''} phase-${phase}`}
        onDragOver={(e) => { e.preventDefault(); if (phase === 'idle') setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* Bot Avatar Centerpiece (Libraries.dev bot-avatars) */}
        <BotStage phase={phase} busy={busy} />

        <div className="dropzone-text mt-1.5 mb-3 text-center">
          <h2 className="dropzone-title font-clash inframe-title font-medium text-xl sm:text-2xl md:text-[26px] text-white tracking-[-0.02em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
            {phase === 'idle' && (drag ? 'Drop Your Video Now' : 'Lossless Video Optimizer')}
            {phase === 'confirm' && 'Verify Master Video'}
            {phase === 'upload' && 'Staging Master Video…'}
            {phase === 'paused' && 'Upload Paused'}
            {phase === 'queued' && (queuePos ? `Queued for Remux (#${queuePos})` : 'Queued for Remux…')}
            {phase === 'process' && 'Mastering Video for TikTok…'}
            {phase === 'done' && 'Master Ready for Delivery'}
            {phase === 'error' && 'Notice'}
          </h2>
          <div className="dropzone-sub font-bricolage text-xs sm:text-[13.5px] text-neutral-300 mt-1 max-w-md mx-auto leading-relaxed">
            {phase === 'idle' && 'Master video in 4K, 60 fps & 120 fps with native HDR · Recommended export bitrate: 20–35 Mbps.'}
            {phase === 'confirm' && `${file?.name} · zero quality loss`}
            {phase === 'upload' && `${file?.name} (${fmt(file?.size || 0)})${uploadSpeed ? ' · ' + uploadSpeed : ''}`}
            {phase === 'paused' && `${Math.round(pct)}% uploaded · Tap Resume to continue`}
            {phase === 'queued' && (queuePos && queuePos > 1
              ? `Position #${queuePos} in queue · Another video is optimizing · Auto-starts next`
              : 'Another master video is optimizing · Auto-starts immediately')}
            {phase === 'process' && 'Delivering 4K, 60fps & 120fps master for TikTok…'}
            {phase === 'done' && `Output size: ${fmt(result?.bytes || 0)}`}
            {phase === 'error' && error}
          </div>
        </div>

        {/* Mode Selector and Choose Button when Idle */}
        {phase === 'idle' && (
          <div className="idle-actions w-full">
            {kept && (
              <div className="resumable-chip mb-4">
                <div className="chip-info">
                  <b>{kept.name}</b>
                  <span>{Math.round(kept.pct)}% already uploaded</span>
                </div>
                <button type="button" className="btn-chip" onClick={continueKept}>
                  <PlayIcon width={14} height={14} /> Resume
                </button>
                <button type="button" className="btn-chip-ghost" onClick={discardKept} aria-label="Discard">
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
            )}

            <ModeSelect value={mode} onChange={setMode} />

            <div className="choose-btn-wrap my-3">
              <label htmlFor="video-file-input" className="choose-file-label liquid-glass-chip rounded-full px-6 py-2.5 sm:px-7 sm:py-3 font-clash inframe-title text-xs sm:text-[13px] font-medium text-white inline-flex items-center justify-center gap-2 hover:border-white/40 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer tracking-normal">
                <UploadIcon width={15} height={15} className="text-white/90" />
                <span>Choose Video File</span>
                <input
                  id="video-file-input"
                  ref={input}
                  type="file"
                  hidden
                  accept="video/mp4,video/quicktime,video/*,.mp4,.mov,.m4v"
                  onChange={(e) => {
                    start(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
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
                <InfoIcon width={14} height={14} className="text-white/80" />
              </div>
              <div className="tiktok-tip-content flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="tiktok-tip-title font-clash inframe-title font-medium text-[11px] sm:text-xs text-white block tracking-[-0.02em]">Creator Publishing Guidance</span>
                  {onSwitchToGuide && (
                    <button
                      type="button"
                      onClick={onSwitchToGuide}
                      className="text-cyan-400 hover:text-cyan-300 font-clash inframe-title font-medium text-[11px] transition-colors cursor-pointer shrink-0"
                    >
                      View Guide &rarr;
                    </button>
                  )}
                </div>
                <span className="tiktok-tip-desc font-bricolage text-[11px] sm:text-xs text-neutral-300 leading-snug block mt-0.5">
                  Publish directly as <b className="text-white">Public</b> on TikTok (tiktok.com/upload). Recommended bitrate: 20–35 Mbps. Direct post is in developer review (coming soon).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar when Busy */}
        {(busy || phase === 'paused') && (
          <div className="simple-progress">
            <div className="progress-track-bar">
              <div
                className="progress-fill-bar"
                style={{ width: `${Math.max(3, Math.min(100, phase === 'queued' ? 5 : pct))}%` }}
              />
            </div>
            <div className="progress-meta">
              <span className="pct-text">
                {phase === 'queued' ? 'Queued' : `${Math.round(pct)}%`}
                {phase === 'upload' && uploadSpeed ? ` · ${uploadSpeed}` : ''}
              </span>
              <button type="button" className="btn-abort" onClick={cancel}>Cancel</button>
            </div>
          </div>
        )}

        {/* Pre-Upload Details (confirm phase only) */}
        {src && phase === 'confirm' && (
          <SpecGrid p={src} />
        )}

        {/* Output Specs when Done */}
        {phase === 'done' && out && (
          <>
            <SpecGrid p={out} realFps={result?.srcFps} isOutput />
            <div className="tiktok-tip-card liquid-glass-frame rounded-2xl p-4 sm:p-4.5 mt-5 text-left flex items-start gap-3 border border-white/[0.08] shadow-lg max-w-lg mx-auto">
              <div className="size-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white shrink-0 mt-0.5">
                <InfoIcon width={16} height={16} className="text-white/80" />
              </div>
              <div className="tiktok-tip-content flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="tiktok-tip-title font-clash inframe-title font-medium text-xs sm:text-sm text-white block tracking-[-0.02em]">Creator Upload Tip</span>
                  {onSwitchToGuide && (
                    <button
                      type="button"
                      onClick={onSwitchToGuide}
                      className="text-cyan-400 hover:text-cyan-300 font-clash inframe-title font-medium text-xs transition-colors cursor-pointer shrink-0"
                    >
                      View Guide &rarr;
                    </button>
                  )}
                </div>
                <span className="tiktok-tip-desc font-bricolage text-xs sm:text-[13px] text-neutral-300 leading-relaxed block mt-0.5">
                  Publish directly as <b className="text-white">Public</b> on TikTok (tiktok.com/upload). Recommended bitrate: 20–35 Mbps. Direct post is in developer review (coming soon).
                </span>
              </div>
            </div>
          </>
        )}

        {/* Live Optimizing Terminal */}
        <LiveTerminal log={log} busy={busy} phase={phase} queuePos={queuePos} userName={userName} userTier={userTier} />

        {/* Action Buttons for Non-Idle States */}
        <div className="dropzone-controls">
          {phase === 'queued' && (
            <div className="queued-status-card">
              <div className="queued-status-pulse">
                <span className="queued-spinner" />
                <span className="queued-label">
                  {queuePos ? `HOLDING QUEUE POSITION #${queuePos}` : 'SERVER REMUX QUEUE ACTIVE'}
                </span>
              </div>
              <p className="queued-sub-text">
                {queuePos && queuePos > 1
                  ? `There are ${queuePos - 1} video(s) ahead in line. Your video is safely staged and will begin remuxing automatically.`
                  : 'Another master video is currently remuxing on the engine. Your video is staged on NVMe and will auto-start next.'}
              </p>
            </div>
          )}

          {phase === 'upload' && (
            <button type="button" className="btn-secondary" onClick={pause}>
              <PauseIcon width={18} height={18} /> Pause upload
            </button>
          )}

          {phase === 'paused' && (
            <button type="button" className="btn-primary" onClick={resume}>
              <PlayIcon width={18} height={18} /> Resume upload
            </button>
          )}

          {phase === 'confirm' && (
            <div className="confirm-buttons">
              {serverQueue.busy && (
                <div className="queue-busy-banner">
                  <div className="queue-busy-header">
                    <span className="queue-busy-dot" />
                    <span className="queue-busy-badge">SERVER ENGINE BUSY</span>
                    <span className="queue-busy-count">Holding Position #{serverQueue.queuedCount + 1}</span>
                  </div>
                  <p className="queue-busy-msg">
                    Another master video is currently processing on the server. When you start, your video will safely hold queue position #{(serverQueue.queuedCount || 0) + 1} and auto-start immediately when ready.
                  </p>
                </div>
              )}
              <SafeMetalFx preset="chromatic" strength={1} theme="dark" innerShadow>
                <button
                  type="button"
                  className="btn-start-optimize"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(12); } catch {}
                    confirmAt === 'pre' ? runUpload() : startJob(upId.current);
                    if (dropzoneRef.current) {
                      const rect = dropzoneRef.current.getBoundingClientRect();
                      if (rect.top < 60 || rect.top > 200) {
                        dropzoneRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }
                  }}
                >
                  <LightningIcon width={18} height={18} />
                  <span>Start Optimize Video</span>
                </button>
              </SafeMetalFx>
              <div className="h264-opt-wrap">
                <label className="h264-opt-label">
                  <input
                    type="checkbox"
                    className="h264-opt-checkbox"
                    checked={ensureH264}
                    onChange={(e) => setEnsureH264(e.target.checked)}
                  />
                  <span className="h264-opt-badge">Optional</span>
                  <span className="h264-opt-text">Tag as H.264 compatible (avc1 metadata brand)</span>
                </label>
              </div>
              <button
                type="button"
                className="btn-secondary btn-choose-another"
                onClick={reset}
              >
                <RefreshIcon width={16} height={16} />
                <span>Choose another</span>
              </button>
            </div>
          )}

          {phase === 'done' && result && (
            <>
              {dl.state === 'loading' && (
                <div style={{ width: '100%', maxWidth: 440, margin: '0 auto 16px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,189,248,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>Turbo Stream</span>
                      <span>·</span>
                      <span style={{ color: '#ffffff' }}>{dl.speed || 'Transferring...'}</span>
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8' }}>{dl.pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${dl.pct}%`, height: '100%', background: '#38bdf8', transition: 'width 0.2s linear' }} />
                  </div>
                </div>
              )}

              {dl.state === 'error' && (
                <div style={{ width: '100%', maxWidth: 440, margin: '0 auto 16px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: '12px', textAlign: 'center' }}>
                  <span>{dl.error || 'Transfer interrupted. Tap to retry or use Direct Download below.'}</span>
                </div>
              )}

              <div className="done-buttons flex flex-wrap items-center justify-center gap-3 mt-4">
                {isTurboDownloadSupported() ? (
                  <>
                    <button
                      type="button"
                      onClick={handleTurboDownload}
                      disabled={dl.state === 'loading'}
                      className="btn-download-master liquid-glass-chip rounded-full px-6 py-3 font-clash text-xs sm:text-sm font-semibold text-white flex items-center gap-2 hover:border-white/40 shadow-xl transition-all hover:scale-105 active:scale-95"
                      title="Accelerated 4x parallel chunk download directly to disk"
                    >
                      <DownloadIcon width={18} height={18} className="text-emerald-400" />
                      <span>{dl.state === 'loading' ? `Downloading ${dl.pct}%` : 'Download Master (High-Speed)'}</span>
                    </button>
                    <a
                      href={withKey('/api/jobs/' + result.id + '/download')}
                      download={(file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-obito-' + mode + '.mp4'}
                      target={isStandalone() ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="btn-secondary liquid-glass-chip rounded-full px-5 py-3 text-xs sm:text-sm font-medium text-white/90 flex items-center gap-2 hover:border-white/30"
                      title="Standard direct browser download"
                    >
                      <DownloadIcon width={15} height={15} />
                      <span>Direct Download</span>
                    </a>
                  </>
                ) : (
                  <a
                    href={withKey('/api/jobs/' + result.id + '/download')}
                    download={(file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-obito-' + mode + '.mp4'}
                    target={isStandalone() ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="btn-download-master liquid-glass-chip rounded-full px-6 py-3 font-clash text-xs sm:text-sm font-semibold text-white flex items-center gap-2 hover:border-white/40 shadow-xl"
                  >
                    <DownloadIcon width={18} height={18} />
                    <span>Download Master Video</span>
                  </a>
                )}

                {typeof navigator !== 'undefined' && navigator.canShare && (
                  <button
                    type="button"
                    className="btn-secondary liquid-glass-chip rounded-full px-4 py-3 text-xs sm:text-sm font-medium text-white/90 flex items-center gap-2 hover:border-white/30"
                    onClick={saveFile}
                    title="Share video or save to device"
                  >
                    <ShareIcon width={15} height={15} />
                    <span>Share</span>
                  </button>
                )}

                {/* Direct TikTok Post Button: Coming Soon */}
                <button
                  type="button"
                  onClick={() => setTtReviewOpen(true)}
                  className="btn-secondary btn-tiktok liquid-glass-chip rounded-full px-4 py-3 text-xs sm:text-sm font-medium text-white/90 flex items-center gap-2 hover:border-cyan-400/40 hover:bg-white/[0.08] transition-all cursor-pointer group shadow-lg"
                  title="Official TikTok Direct Post is in developer review — click to view status"
                >
                  <TikTokIcon width={15} height={15} className="text-white group-hover:scale-110 transition-transform" />
                  <span>Post to TikTok</span>
                  <span className="text-[10px] font-clash inframe-title bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                    Coming Soon
                  </span>
                </button>

                <button
                  type="button"
                  className="btn-secondary liquid-glass-chip rounded-full px-4 py-3 text-xs sm:text-sm font-medium text-white/75 flex items-center gap-2 hover:border-white/30"
                  onClick={reset}
                >
                  <RefreshIcon width={15} height={15} /> Optimize another
                </button>
              </div>

              {/* Post-Mastering Guide Redirect */}
              {onSwitchToGuide && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left max-w-lg mx-auto shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
                      <BookOpenIcon width={17} height={17} />
                    </div>
                    <div>
                      <span className="font-clash inframe-title font-medium text-xs sm:text-[13.5px] text-white block">
                        Ready to upload your master?
                      </span>
                      <span className="text-[11px] text-neutral-400 block font-sans mt-0.5">
                        Direct post is in developer review — follow the 3-step guide: use Files App &amp; Web upload to preserve 60/120fps HDR.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onSwitchToGuide}
                    className="liquid-glass-white shrink-0 px-4 py-2 rounded-full text-xs font-clash inframe-title font-medium text-white flex items-center gap-1.5 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <span>Check Guide</span>
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              )}
              <TikTokPostSheet
                open={ttOpen}
                onClose={() => setTtOpen(false)}
                jobId={result.id}
                apiKey={apiKey}
                fileName={file?.name}
              />

              {/* Official TikTok Direct Post Review Status Modal */}
              {ttReviewOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
                  onClick={() => setTtReviewOpen(false)}
                  role="dialog"
                  aria-modal="true"
                >
                  <div
                    className="w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-950/95 p-5 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.85)] text-white backdrop-blur-2xl relative overflow-hidden text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top Specular Hairline */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />

                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                          <TikTokIcon width={20} height={20} />
                        </div>
                        <div>
                          <h3 className="font-clash inframe-title font-semibold text-base sm:text-lg text-white tracking-tight leading-tight">
                            Official TikTok Direct Post
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="font-clash inframe-title text-[11px] font-medium text-cyan-300 tracking-wide uppercase">
                              In TikTok Developer Review (Coming Soon)
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="size-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => setTtReviewOpen(false)}
                        aria-label="Close"
                      >
                        <CloseIcon width={14} height={14} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="space-y-3.5 mb-6">
                      <p className="text-xs sm:text-[13.5px] text-neutral-300 leading-relaxed font-sans">
                        Our direct integration with <b className="text-white">TikTok&apos;s Content Posting API</b> is fully engineered and undergoing final review with the official TikTok Developer Team.
                      </p>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          <CheckIcon className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-clash inframe-title text-xs font-medium text-white block">
                              Official Launch in a Couple of Days
                            </span>
                            <span className="text-[11px] text-neutral-400 font-sans block leading-snug">
                              Scheduled to go live globally as soon as developer approval completes.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <CheckIcon className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-clash inframe-title text-xs font-medium text-white block">
                              Bit-for-Bit 4K, 60fps &amp; 120fps Quality
                            </span>
                            <span className="text-[11px] text-neutral-400 font-sans block leading-snug">
                              Direct stream container surgery at recommended 20–35 Mbps with native HDR Rec.2020 intact.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <CheckIcon className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-clash inframe-title text-xs font-medium text-white block">
                              Interim Web Uploader Ready
                            </span>
                            <span className="text-[11px] text-neutral-400 font-sans block leading-snug">
                              Download your master and upload via tiktok.com/upload or Files App.
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11.5px] sm:text-xs text-neutral-400 leading-relaxed font-sans">
                        Your mastered video is ready right now! Upload directly through the TikTok web uploader to retain maximum clarity.
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                      <a
                        href="https://www.tiktok.com/upload?lang=en"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:flex-1 py-2.5 px-4 rounded-full bg-white text-black font-clash inframe-title text-xs sm:text-[13px] font-semibold text-center hover:bg-neutral-200 transition-colors shadow-lg flex items-center justify-center gap-1.5"
                      >
                        <span>Open tiktok.com/upload</span>
                        <span aria-hidden="true">&nearr;</span>
                      </a>
                      {onSwitchToGuide && (
                        <button
                          type="button"
                          onClick={() => {
                            setTtReviewOpen(false);
                            onSwitchToGuide();
                          }}
                          className="w-full sm:flex-1 py-2.5 px-4 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-clash inframe-title text-xs sm:text-[13px] font-medium text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>View Creator Guide</span>
                          <span aria-hidden="true">&rarr;</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {phase === 'error' && (
            <button type="button" className="btn-secondary" onClick={reset}>
              <RefreshIcon width={16} height={16} /> Try again
            </button>
          )}

          {needKey && (
            <label className="access-key-field required">
              <KeyIcon width={15} height={15} />
              <input
                type="password"
                placeholder="Access key (if required)"
                value={apiKey}
                autoComplete="current-password"
                onChange={(e) => onKeyChange(e.target.value)}
              />
            </label>
          )}

        </div>
      </div>
    </div>
  );
}
