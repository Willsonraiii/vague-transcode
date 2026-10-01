import { useCallback, useEffect, useRef, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { CheckIcon, CloseIcon, DownloadIcon, FpsIcon, HdrIcon, KeyIcon, UploadIcon } from './icons.jsx';

const MAX_BYTES = 600 * 1024 * 1024;
const VANILLA = '#F6E7C1';
const MODES = [
  { id: 'hdr', label: 'FPS + Quality + HDR', Icon: HdrIcon },
  { id: 'standard', label: 'FPS + Quality', Icon: FpsIcon }
];

const fmt = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const readKey = () => { try { return localStorage.getItem('obitoKey') || ''; } catch { return ''; } };
const writeKey = (v) => { try { localStorage.setItem('obitoKey', v); } catch { /* storage unavailable */ } };

/* ---------- small glass components ---------- */

function GlassCard({ children, className = '' }) {
  return <section className={'glass ' + className}>{children}</section>;
}

function ModeSelect({ value, onChange }) {
  return (
    <div className="modes" role="radiogroup" aria-label="Optimization type">
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={'mode' + (value === id ? ' on' : '')}
          onClick={() => onChange(id)}
        >
          <span className="mode-ico"><Icon /></span>
          <span className="mode-txt">{label}</span>
          <span className="mode-tick"><CheckIcon width={14} height={14} strokeWidth={2.6} /></span>
        </button>
      ))}
    </div>
  );
}

function Orb({ state }) {
  return (
    <div className="orb" data-state={state}>
      <span className="halo h1" />
      <span className="halo h2" />
      <ThinkingOrb state={state} size={64} theme="dark" color={VANILLA} aria-label={'Status: ' + state} />
    </div>
  );
}

function Progress({ value }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <i style={{ width: Math.max(2, Math.min(100, value)) + '%' }} />
    </div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const [phase, setPhase] = useState('idle'); // idle | upload | queued | process | done | error
  const [mode, setMode] = useState('hdr');
  const [pct, setPct] = useState(0);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState(readKey);
  const [needKey, setNeedKey] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const xhrRef = useRef(null);
  const timer = useRef(null);
  const jobId = useRef(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  const headers = useCallback(() => (keyRef.current ? { 'x-access-token': keyRef.current } : {}), []);
  const withKey = useCallback((url) => (keyRef.current ? url + '?token=' + encodeURIComponent(keyRef.current) : url), []);

  useEffect(() => () => { clearInterval(timer.current); }, []);

  const fail = useCallback((msg, askKey = false) => {
    clearInterval(timer.current);
    setError(msg);
    setNeedKey(askKey);
    setPhase('error');
  }, []);

  const poll = useCallback((id) => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const r = await fetch(withKey('/api/jobs/' + id), { headers: headers() });
        if (r.status === 401) return fail('Access key needed.', true);
        const job = await r.json();
        if (job.status === 'queued') setPhase('queued');
        else if (job.status === 'processing') { setPhase('process'); setPct(job.progress || 0); }
        else if (job.status === 'failed') fail(job.error || 'Something went wrong. Try again.');
        else if (job.status === 'done') {
          clearInterval(timer.current);
          setResult({ id, bytes: job.outputBytes || 0 });
          setPct(100);
          setPhase('done');
        }
      } catch {
        fail('Lost connection to the server.');
      }
    }, 1500);
  }, [fail, headers, withKey]);

  const start = useCallback((f) => {
    if (!f) return;
    if (f.size > MAX_BYTES) { setFile(f); return fail('That file is over 600 MB.'); }
    if (f.type && !f.type.startsWith('video/')) return fail('Please choose a video file.');
    setFile(f); setResult(null); setError(''); setNeedKey(false); setPct(0); setPhase('upload');

    const form = new FormData();
    form.append('mode', mode);
    form.append('video', f, f.name);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/jobs');
    for (const [k, v] of Object.entries(headers())) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct((e.loaded / e.total) * 100); };
    xhr.onerror = () => fail('Cannot reach the server.');
    xhr.onabort = () => {};
    xhr.onload = () => {
      if (xhr.status === 401) return fail('Access key needed.', true);
      if (xhr.status !== 201) {
        let m = 'Upload failed (' + xhr.status + ').';
        try { m = JSON.parse(xhr.responseText).error || m; } catch { /* keep default */ }
        return fail(m);
      }
      try { jobId.current = JSON.parse(xhr.responseText).id; } catch { return fail('Unexpected server reply.'); }
      setPct(0); setPhase('queued');
      poll(jobId.current);
    };
    xhr.send(form);
  }, [fail, headers, mode, poll]);

  const cancel = useCallback(async () => {
    try { xhrRef.current?.abort(); } catch { /* ignore */ }
    clearInterval(timer.current);
    if (jobId.current) {
      try { await fetch(withKey('/api/jobs/' + jobId.current), { method: 'DELETE', headers: headers() }); } catch { /* ignore */ }
    }
    jobId.current = null;
    setPhase('idle'); setPct(0);
  }, [headers, withKey]);

  const reset = useCallback(() => {
    clearInterval(timer.current);
    jobId.current = null;
    setPhase('idle'); setFile(null); setResult(null); setError(''); setNeedKey(false); setPct(0);
    if (input.current) input.current.value = '';
  }, []);

  const onKey = (v) => { setKey(v); writeKey(v); };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (phase === 'idle') start(e.dataTransfer.files?.[0]); };
  const busy = phase === 'upload' || phase === 'queued' || phase === 'process';

  const orbState = phase === 'upload' ? 'connecting' : phase === 'process' ? 'working' : 'breathing';
  const title = {
    idle: 'Upload your video',
    upload: 'Uploading',
    queued: 'Getting ready',
    process: 'Optimizing',
    done: 'Your video is ready',
    error: 'Something went wrong'
  }[phase];
  const sub = {
    idle: 'MP4 or MOV · up to 600 MB',
    upload: file ? file.name : '',
    queued: file ? file.name : '',
    process: file ? file.name : '',
    done: result?.bytes ? fmt(result.bytes) : file?.name || '',
    error: error
  }[phase];

  return (
    <div className="app">
      <div className="cosmos" aria-hidden="true">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
        <span className="stars s1" /><span className="stars s2" /><span className="stars s3" />
      </div>

      <main className="shell">
        <header className="brand">
          <span className="logo"><span /></span>
          <b>OBITO STUDIO</b>
        </header>

        <GlassCard className={'card' + (drag ? ' drag' : '')}>
          <div
            className="drop"
            onDragOver={(e) => { e.preventDefault(); if (phase === 'idle') setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            {phase === 'done' ? (
              <div className="done-badge"><CheckIcon width={30} height={30} strokeWidth={2.4} /></div>
            ) : phase === 'error' ? (
              <div className="err-badge"><CloseIcon width={26} height={26} strokeWidth={2.4} /></div>
            ) : (
              <Orb state={orbState} />
            )}

            <h1 className="title" aria-live="polite">{title}</h1>
            <p className={'sub' + (phase === 'error' ? ' sub-err' : '')}>{sub}</p>

            {busy && (
              <div className="run">
                <Progress value={phase === 'queued' ? 4 : pct} />
                <div className="run-row">
                  <span>{phase === 'queued' ? 'Waiting' : Math.round(pct) + '%'}</span>
                  <button type="button" className="link" onClick={cancel}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {phase === 'idle' && (
            <>
              <ModeSelect value={mode} onChange={setMode} />
              <button type="button" className="btn primary" onClick={() => input.current?.click()}>
                <UploadIcon /> Choose video
              </button>
            </>
          )}

          {phase === 'done' && result && (
            <>
              <a className="btn primary" href={withKey('/api/jobs/' + result.id + '/download')}>
                <DownloadIcon /> Download
              </a>
              <button type="button" className="btn glassy" onClick={reset}>Optimize another</button>
            </>
          )}

          {phase === 'error' && (
            <button type="button" className="btn glassy" onClick={reset}>Try again</button>
          )}

          {(needKey || phase === 'idle') && (
            <label className={'keyrow' + (needKey ? ' need' : '')}>
              <KeyIcon width={16} height={16} />
              <input
                type="password"
                placeholder="Access key"
                value={key}
                autoComplete="current-password"
                onChange={(e) => onKey(e.target.value)}
              />
            </label>
          )}

          <input
            ref={input}
            type="file"
            hidden
            accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
            onChange={(e) => start(e.target.files?.[0])}
          />
        </GlassCard>

        <footer className="foot">Files are deleted after download or 1 hour.</footer>
      </main>
    </div>
  );
}
