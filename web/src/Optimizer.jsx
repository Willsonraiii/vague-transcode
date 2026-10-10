import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import { BotAvatar } from 'bot-avatars';
import { BorderBeam } from 'border-beam';
import { MetalFx } from 'metal-fx';
import {
  CheckIcon, CloseIcon, DownloadIcon, FpsIcon, HdrIcon, KeyIcon,
  PauseIcon, PlayIcon, UploadIcon, RefreshIcon, ShareIcon, SparkIcon
} from './icons.jsx';
import { probeLocalFile } from './localProbe.js';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import { COLOR_PRESETS, getPresetById } from './colorPresets.js';

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
// Adaptive dynamic chunking: 2 MB start for quick initial feedback, scaling up to 8 MB for maximum bandwidth saturation
const MIN_CHUNK = 2 * 1024 * 1024;
const MAX_CHUNK = 8 * 1024 * 1024;
const CHUNK_TIMEOUT_MS = 120 * 1000;  // 120s timeout per slice
const CHUNK_RETRIES = 5;              // per chunk, with fresh sync between tries

const MODES = [
  { id: 'hdr', label: 'FPS + Quality + HDR', shortLabel: 'FPS + HDR', badge: 'iPhone HDR', Icon: HdrIcon },
  { id: 'standard', label: 'FPS + Quality', shortLabel: 'FPS + Quality', badge: 'Standard', Icon: FpsIcon }
];

// Standard binary byte formatting (1 MB = 1024 * 1024 bytes -> 71.0 MB for 74.5M bytes)
const fmt = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const hdrLabel = (t) => (!t || t === 'unknown' || t === 'sdr' ? 'SDR' : t === 'smpte2084' ? 'HDR10 / PQ' : t === 'arib-std-b67' ? 'HLG' : String(t).toUpperCase());
const fmtDur = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : '—');

/* ---------- Interactive Bot Avatar Stage (Libraries.dev bot-avatars) ---------- */
function BotStage({ phase, busy }) {
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
function LiveTerminal({ log = [], busy, phase }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // ONLY show once video actually starts working (upload, queued, process, done)
  // NEVER on gallery pick / confirm screen!
  const isWorking = phase === 'upload' || phase === 'queued' || phase === 'process' || phase === 'done';
  if (!isWorking) return null;

  return (
    <div className="live-terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className={`terminal-indicator ${busy || phase === 'process' ? 'pulsing' : 'done'}`} />
          <span>Live Optimizing Terminal</span>
        </div>
        <div className="terminal-meta">
          <span>{phase === 'done' ? 'Completed' : phase === 'process' ? 'Processing' : phase === 'queued' ? 'Queued' : 'Stream Active'}</span>
        </div>
      </div>
      <div className="terminal-body">
        {log.length === 0 ? (
          <div className="terminal-line dim">
            <span className="term-num">00</span>
            <span className="term-text">Waiting for container remux stream...</span>
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
        <div ref={terminalEndRef} />
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
        {p.audio ? <span className="spec-chip">{p.audio} audio</span> : null}
        {p.dur ? <span className="spec-chip">{fmtDur(p.dur)}</span> : null}
        <span className="spec-chip">{fmt(p.size)}</span>
      </div>
    </div>
  );
}

/* ---------- Interactive Color Preset Picker (Confirm Phase) ---------- */
function ColorPresetPicker({ value, onChange }) {
  return (
    <div className="color-preset-section">
      <div className="color-preset-header">
        <div className="preset-header-title">
          <SparkIcon width={14} height={14} className="text-amber-400" />
          <span>Color Grade Style</span>
        </div>
        <span className="preset-optional-badge">Optional</span>
      </div>
      <div className="color-preset-scroll" role="radiogroup" aria-label="Color grade preset">
        {COLOR_PRESETS.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`preset-card ${active ? 'active' : ''}`}
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(8); } catch {}
                onChange(p.id);
              }}
            >
              <div className="preset-card-glow" style={{ background: p.accentColor }} />
              <div className="preset-swatch-row">
                <span className="preset-dot" style={{ background: p.accentColor }} />
                <span className="preset-badge">{p.badge}</span>
              </div>
              <div className="preset-title">{p.name}</div>
              <div className="preset-desc">{p.shortDesc}</div>
            </button>
          );
        })}
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
      <BorderBeam
        size="md"
        colorVariant="colorful"
        strength={0.7}
        theme="dark"
        borderRadius={999}
        className="w-full relative rounded-full"
      >
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
      </BorderBeam>
    </div>
  );
}

/* ---------- Main Studio Optimizer Component ---------- */
export default function Optimizer({ apiKey, onKeyChange, onBusy }) {
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
  const [error, setError] = useState('');
  const [needKey, setNeedKey] = useState(false);
  const [drag, setDrag] = useState(false);
  const [kept, setKept] = useState(null);
  const [dl, setDl] = useState({ state: 'idle', pct: 0 });
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

  const [colorPreset, setColorPreset] = useState('original');
  const presetRef = useRef('original');
  presetRef.current = colorPreset;
  const [gradeState, setGradeState] = useState({ loading: false, resultId: null, preset: null, error: '' });
  const [uploadSpeed, setUploadSpeed] = useState('');
  const uploadStartTime = useRef(0);

  const headers = useCallback(() => (keyRef.current ? { 'x-access-token': keyRef.current } : {}), []);
  const withKey = useCallback((url) => (keyRef.current ? url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : url), []);
  useEffect(() => () => clearInterval(timer.current), []);

  // Keep the screen awake while this page is actively transferring or processing.
  // Browsers may release the lock when hidden; request it again on return.
  useEffect(() => {
    const active = phase === 'upload' || phase === 'queued' || phase === 'process' || dl.state === 'loading' || gradeState.loading;
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
  }, [phase, dl.state, gradeState.loading]);

  const fail = useCallback((msg, askKey = false) => {
    clearInterval(timer.current);
    setError(msg);
    setNeedKey(askKey);
    setPhase('error');
    setUploadSpeed('');
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
        if (job.status === 'queued') setPhase('queued');
        else if (job.status === 'processing') { setPhase('process'); setPct(job.progress || 0); }
        else if (job.status === 'failed') fail(job.error || 'Optimization failed.');
        else if (job.status === 'done') {
          clearInterval(timer.current);
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
    const presetLabel = presetRef.current !== 'original' ? ` (${getPresetById(presetRef.current).name})` : '';
    setLog((prev) => [...prev, `[obito] Ingestion complete. Initializing timescale remux engine${presetLabel}...`]);
    try {
      const r = await fetch(withKey('/api/uploads/' + uploadId + '/start'), {
        method: 'POST',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ mode: modeRef.current, preset: presetRef.current })
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
      setLog((prev) => [...prev, `[obito] Pipeline engaged (Job ${jobId.current.slice(0, 8)}). Harmonizing container atoms...`]);
      poll(jobId.current);
    } catch { fail('Could not reach the server.'); }
  }, [fail, headers, poll, withKey]);

  const applyPostGrade = useCallback(async (targetPreset) => {
    if (!result?.id || gradeState.loading) return;
    setGradeState({ loading: true, resultId: null, preset: targetPreset, error: '' });
    try {
      const r = await fetch(withKey('/api/jobs/' + result.id + '/grade'), {
        method: 'POST',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ preset: targetPreset })
      });
      if (!r.ok) {
        const errJson = await r.json().catch(() => ({}));
        throw new Error(errJson.error || 'Could not start color grade.');
      }
      const data = await r.json();
      const gradeJobId = data.id;

      let gradeFails = 0;
      const gradeTimer = setInterval(async () => {
        try {
          const resp = await fetch(withKey('/api/jobs/' + gradeJobId), { headers: headers() });
          if (resp.ok) {
            gradeFails = 0;
            const j = await resp.json();
            if (j.status === 'done') {
              clearInterval(gradeTimer);
              setGradeState({ loading: false, resultId: gradeJobId, preset: targetPreset, error: '' });
            } else if (j.status === 'failed') {
              clearInterval(gradeTimer);
              setGradeState({ loading: false, resultId: null, preset: null, error: j.error || 'Grading failed.' });
            }
          } else {
            gradeFails++;
            if (gradeFails > 15) {
              clearInterval(gradeTimer);
              setGradeState({ loading: false, resultId: null, preset: null, error: 'Lost connection to server.' });
            }
          }
        } catch {
          gradeFails++;
          if (gradeFails > 15) {
            clearInterval(gradeTimer);
            setGradeState({ loading: false, resultId: null, preset: null, error: 'Lost connection to server.' });
          }
        }
      }, 1500);
    } catch (err) {
      setGradeState({ loading: false, resultId: null, preset: null, error: err.message || 'Error applying grade.' });
    }
  }, [gradeState.loading, headers, result, withKey]);

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
          if (chunkDurationSec < 3.0) {
            currentChunk = Math.min(currentChunk * 2, MAX_CHUNK);
          } else if (chunkDurationSec > 25.0) {
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
        `[client] Selected: ${f.name} (${fmt(f.size)})`,
        p
          ? `[obito] On-device probe: ${p.w}×${p.h} · ${p.fps} fps · ${(p.codec || '').toUpperCase()}${p.transfer ? ' · ' + p.transfer : ''}`
          : `[obito] Ready for lossless remuxing: ${f.name} (${fmt(f.size)})`
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
    upId.current = null;
    jobId.current = null;
    fileRef.current = null;
    setColorPreset('original');
    setGradeState({ loading: false, resultId: null, preset: null, error: '' });
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

  const prepareFile = async () => {
    if (!result?.id || dl.state === 'loading') return;
    setDl({ state: 'loading', pct: 0 });
    try {
      const r = await fetch(withKey('/api/jobs/' + result.id + '/download'), { headers: headers() });
      if (!r.ok) throw new Error('Download failed');
      const reader = r.body?.getReader();
      const len = Number(r.headers.get('content-length') || 0);
      let rcv = 0;
      const chunks = [];
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          rcv += value.length;
          if (len) setDl({ state: 'loading', pct: (rcv / len) * 100 });
        }
      } else {
        chunks.push(await r.arrayBuffer());
      }
      const blob = new Blob(chunks, { type: 'video/mp4' });
      setDl({ state: 'ready', blob, pct: 100 });
    } catch {
      setDl({ state: 'error', pct: 0 });
    }
  };

  const saveFile = async () => {
    if (!dl.blob) return;
    const name = (file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-lossless.mp4';
    const f = new File([dl.blob], name, { type: 'video/mp4' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: name });
        return;
      } catch { /* fallback to anchor download */ }
    }
    const url = URL.createObjectURL(dl.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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
    <div className="studio-optimizer w-full max-w-3xl mx-auto">
      {/* ---------- Main Clean Dropzone Box ---------- */}
      <div
        className={`clean-dropzone ${drag ? 'drag-over' : ''} phase-${phase}`}
        onDragOver={(e) => { e.preventDefault(); if (phase === 'idle') setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        {/* Bot Avatar Centerpiece (Libraries.dev bot-avatars) */}
        <BotStage phase={phase} busy={busy} />

        <div className="dropzone-text">
          <h2 className="dropzone-title">
            {phase === 'idle' && (drag ? 'Drop your video now' : 'Choose a video to optimize')}
            {phase === 'confirm' && 'Check video details'}
            {phase === 'upload' && 'Uploading video...'}
            {phase === 'paused' && 'Upload paused'}
            {phase === 'queued' && 'Queued for optimization...'}
            {phase === 'process' && 'Optimizing video for TikTok...'}
            {phase === 'done' && 'Your video is ready!'}
            {phase === 'error' && 'Notice'}
          </h2>
          <p className="dropzone-sub">
            {phase === 'idle' && 'MP4 or MOV · up to 600 MB'}
            {phase === 'confirm' && `${file?.name} · zero re-encoding loss`}
            {phase === 'upload' && `${file?.name} (${fmt(file?.size || 0)})${uploadSpeed ? ' · ' + uploadSpeed : ''}`}
            {phase === 'paused' && `${Math.round(pct)}% uploaded · Tap Resume to continue`}
            {phase === 'queued' && 'Preparing container remux...'}
            {phase === 'process' && 'Repackaging container with zero quality loss...'}
            {phase === 'done' && `Output size: ${fmt(result?.bytes || 0)}`}
            {phase === 'error' && error}
          </p>
        </div>

        {/* Mode Selector and Choose Button when Idle */}
        {phase === 'idle' && (
          <div className="idle-actions">
            {kept && (
              <div className="resumable-chip">
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
              <label htmlFor="video-file-input" className="btn-primary-hero choose-file-label">
                <UploadIcon width={18} height={18} />
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

            <div className="engine-trust-row">
              <div className="trust-item">
                <span className="trust-val">60 / 120fps</span>
                <span className="trust-lbl">Native Fluidity</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-item">
                <span className="trust-val">100% Lossless</span>
                <span className="trust-lbl">Stream Copy</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-item">
                <span className="trust-val">HDR &amp; Dolby</span>
                <span className="trust-lbl">Original Gamut</span>
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
          <SpecGrid p={out} realFps={result?.srcFps} isOutput />
        )}

        {/* Live Optimizing Terminal */}
        <LiveTerminal log={log} busy={busy} phase={phase} />

        {/* Action Buttons for Non-Idle States */}
        <div className="dropzone-controls">
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
            <>
              <ColorPresetPicker value={colorPreset} onChange={setColorPreset} />
              <div className="confirm-buttons">
                <SafeMetalFx preset="chromatic" strength={1} theme="dark" innerShadow>
                  <button
                    type="button"
                    className="btn-start-optimize"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(12); } catch {}
                      confirmAt === 'pre' ? runUpload() : startJob(upId.current);
                    }}
                  >
                    <SparkIcon width={20} height={20} />
                    <span>Start Optimize Video</span>
                  </button>
                </SafeMetalFx>
                <button
                  type="button"
                  className="btn-secondary btn-choose-another"
                  onClick={reset}
                >
                  <RefreshIcon width={16} height={16} />
                  <span>Choose another</span>
                </button>
              </div>
            </>
          )}

          {phase === 'done' && result && (
            <>
              <div className="done-buttons flex flex-wrap items-center justify-center gap-3">
              {!isStandalone() ? (
                <a
                  href={withKey('/api/jobs/' + result.id + '/download')}
                  download={(file?.name ? file.name.replace(/\.[^.]+$/, '') : 'tiktok-optimized') + '-obito-' + mode + '.mp4'}
                >
                  <LiquidButton
                    type="button"
                    className="text-white border border-white/20 rounded-full font-semibold shadow-xl"
                    size="xl"
                  >
                    <DownloadIcon width={20} height={20} />
                    <span>Download Master Video</span>
                  </LiquidButton>
                </a>
              ) : dl.state === 'ready' ? (
                <LiquidButton
                  type="button"
                  className="text-white border border-white/20 rounded-full font-semibold shadow-xl"
                  size="xl"
                  onClick={saveFile}
                >
                  <ShareIcon width={20} height={20} />
                  <span>Save Video / Share</span>
                </LiquidButton>
              ) : (
                <LiquidButton
                  type="button"
                  className="text-white border border-white/20 rounded-full font-semibold shadow-xl"
                  size="xl"
                  onClick={prepareFile}
                  disabled={dl.state === 'loading'}
                >
                  <DownloadIcon width={20} height={20} />
                  <span>
                    {dl.state === 'loading'
                      ? `Preparing (${Math.round(dl.pct)}%)`
                      : dl.state === 'error'
                      ? 'Retry Download'
                      : 'Download Master Video'}
                  </span>
                </LiquidButton>
              )}
              <button type="button" className="btn-secondary" onClick={reset}>
                <RefreshIcon width={16} height={16} /> Optimize another
              </button>
            </div>

            {/* Aesthetic Post-Optimization Color Grade */}
            <div className="post-grade-section">
              <div className="post-grade-head">
                <SparkIcon width={15} height={15} className="text-amber-400" />
                <h4>Want an aesthetic look? Grade this video</h4>
              </div>
              <p className="post-grade-sub">Render a styled master variation without re-uploading.</p>
              <div className="post-grade-pills">
                {COLOR_PRESETS.filter((p) => p.id !== 'original').map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="post-grade-pill-btn"
                    disabled={gradeState.loading}
                    onClick={() => applyPostGrade(p.id)}
                  >
                    <span className="post-grade-pill-dot" style={{ background: p.accentColor }} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
              {gradeState.loading && (
                <div className="mt-3 text-xs text-sky-400 flex items-center gap-2">
                  <span className="terminal-indicator pulsing" />
                  <span>Applying {getPresetById(gradeState.preset).name} preset...</span>
                </div>
              )}
              {gradeState.resultId && (
                <div className="graded-ready-card">
                  <div className="graded-ready-info">
                    <CheckIcon width={16} height={16} />
                    <span>{getPresetById(gradeState.preset).name} ready!</span>
                  </div>
                  <a
                    href={withKey('/api/jobs/' + gradeState.resultId + '/download')}
                    className="btn-chip"
                    download
                  >
                    <DownloadIcon width={14} height={14} /> Download Graded
                  </a>
                </div>
              )}
              {gradeState.error && (
                <div className="mt-2 text-xs text-rose-400">
                  {gradeState.error}
                </div>
              )}
            </div>
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
