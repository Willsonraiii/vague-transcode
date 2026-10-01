import { useCallback, useEffect, useRef, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { BotAvatar } from 'bot-avatars';
import { BorderBeam } from 'border-beam';
import Logo from './Logo.jsx';
import {
  CheckIcon, ChevronIcon, CloseIcon, DownloadIcon, FpsIcon, HdrIcon, KeyIcon, LayersIcon,
  PauseIcon, PlayIcon, ShieldIcon, SparkIcon, UploadIcon, WifiIcon
} from './icons.jsx';

const MAX_BYTES = 600 * 1024 * 1024;
const CHUNK = 8 * 1024 * 1024;
const VANILLA = '#F6E7C1';
const MODES = [
  { id: 'hdr', label: 'FPS + Quality + HDR', Icon: HdrIcon },
  { id: 'standard', label: 'FPS + Quality', Icon: FpsIcon }
];

const fmt = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;
const readMap = () => { try { return JSON.parse(lsGet('obitoUploads') || '{}'); } catch { return {}; } };
const writeMap = (m) => lsSet('obitoUploads', JSON.stringify(m));

/* ---------- macOS-style chrome ---------- */

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t); }, []);
  const clock = now.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <nav className="menubar" aria-label="Main">
      <div className="mb-left">
        <a className="mb-brand" href="#optimizer"><Logo size={18} /><b>OBITO STUDIO</b></a>
        <a href="#optimizer">Optimizer</a>
        <a href="#how">How it works</a>
        <a href="#faq">FAQ</a>
      </div>
      <div className="mb-right"><WifiIcon width={16} height={16} /><span>{clock}</span></div>
    </nav>
  );
}

function Window({ title, id, className = '', children }) {
  return (
    <section className={'win ' + className} id={id}>
      <header className="win-bar">
        <span className="lights" aria-hidden="true"><i className="l-r" /><i className="l-y" /><i className="l-g" /></span>
        <b>{title}</b>
        <span className="lights-pad" />
      </header>
      <div className="win-body">{children}</div>
    </section>
  );
}

function ModeSelect({ value, onChange }) {
  return (
    <div className="modes" role="radiogroup" aria-label="Optimization type">
      {MODES.map(({ id, label, Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={value === id}
          className={'mode' + (value === id ? ' on' : '')} onClick={() => onChange(id)}>
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
      <span className="halo h1" /><span className="halo h2" />
      <ThinkingOrb state={state} size={64} theme="dark" color={VANILLA} />
    </div>
  );
}

function Bot({ state }) {
  return (
    <div className="bot" data-state={state}>
      <span className="halo h1" />
      <BotAvatar type="clover" size={92} state={state} theme="dark" />
    </div>
  );
}

function Progress({ value, paused, smooth }) {
  return (
    <div className={'progress' + (paused ? ' paused' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <i style={{ width: Math.max(2, Math.min(100, value)) + '%', transition: smooth ? 'width 1.4s linear' : 'none' }} />
    </div>
  );
}

/* ---------- content ---------- */

const FEATURES = [
  { Icon: FpsIcon, t: 'Built for 60 & 120 fps', d: 'The frame-rate timing is adjusted so TikTok is less likely to flatten fast footage to 30 fps.' },
  { Icon: LayersIcon, t: 'No re-encoding', d: 'Your video is repackaged, not recompressed. Pixels are copied as they are, so nothing gets softer.' },
  { Icon: HdrIcon, t: 'HDR clips stay HDR', d: 'The HDR button prepares iPhone HDR videos so their colour information survives the upload.' },
  { Icon: ShieldIcon, t: 'Private by design', d: 'It runs on your own server. Files are deleted after you download, or after one hour.' }
];
const STEPS = [
  { n: '1', t: 'Pick a type & choose your video', d: 'MP4 or MOV, up to 600 MB. Choose HDR for iPhone HDR clips.' },
  { n: '2', t: 'We optimize it', d: 'Upload at your pace: pause, resume or cancel and carry on later without starting over.' },
  { n: '3', t: 'Download and post', d: 'Save the file, then upload it through TikTok Studio.' }
];
const FAQ = [
  ['Does it re-encode my video?', 'No. The video and audio are copied as they are and only the container and timing are rewritten, which is why quality stays identical and it finishes quickly.'],
  ['What is the difference between the two buttons?', 'FPS + Quality fixes the frame-rate timing and keeps your quality. FPS + Quality + HDR does the same and also prepares HDR clips for TikTok. If your video is not HDR, either works.'],
  ['What if I pause or cancel an upload?', 'Nothing is thrown away. The part already uploaded stays on the server for an hour, so choosing the same video again, or tapping Continue, picks up where it stopped.'],
  ['Why does my gallery show no duration?', 'The optimized file is made for TikTok, and some players show no duration for it. Upload it through TikTok Studio to see how it posts.'],
  ['How big can my video be?', 'Up to 600 MB, MP4, MOV or M4V.'],
  ['Where do my files go?', 'They stay on your own server and are deleted after you download the result, or after one hour.']
];

/* ---------- app ---------- */

export default function App() {
  const [phase, setPhase] = useState('idle'); // idle | upload | paused | queued | process | done | error
  const [mode, setMode] = useState('hdr');
  const [pct, setPct] = useState(0);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState(() => lsGet('obitoKey') || '');
  const [needKey, setNeedKey] = useState(false);
  const [drag, setDrag] = useState(false);
  const [kept, setKept] = useState(null); // { id, pct, name } - progress kept after cancel
  const [dl, setDl] = useState({ state: 'idle', pct: 0 });
  const input = useRef(null);
  const xhrRef = useRef(null);
  const timer = useRef(null);
  const upId = useRef(null);
  const jobId = useRef(null);
  const fileRef = useRef(null);
  const flags = useRef({ pause: false, cancel: false });
  const keyRef = useRef(key);
  const modeRef = useRef(mode);
  const savedFile = useRef(null);
  keyRef.current = key;
  modeRef.current = mode;

  const headers = useCallback(() => (keyRef.current ? { 'x-access-token': keyRef.current } : {}), []);
  const withKey = useCallback((url) => (keyRef.current ? url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : url), []);
  useEffect(() => () => clearInterval(timer.current), []);

  const fail = useCallback((msg, askKey = false) => {
    clearInterval(timer.current);
    setError(msg); setNeedKey(askKey); setPhase('error');
  }, []);

  /* ----- job polling ----- */
  const poll = useCallback((id) => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const r = await fetch(withKey('/api/jobs/' + id), { headers: headers() });
        if (r.status === 401) return fail('Access key needed.', true);
        if (r.status === 404) return fail('This job expired. Choose the video again.');
        const job = await r.json();
        if (job.status === 'queued') setPhase('queued');
        else if (job.status === 'processing') { setPhase('process'); setPct(job.progress || 0); }
        else if (job.status === 'failed') fail(job.error || 'Something went wrong. Try again.');
        else if (job.status === 'done') {
          clearInterval(timer.current);
          setResult({ id, bytes: job.outputBytes || 0 }); setPct(100); setPhase('done');
        }
      } catch { fail('Lost connection to the server.'); }
    }, 1500);
  }, [fail, headers, withKey]);

  const startJob = useCallback(async (uploadId) => {
    setPhase('queued'); setPct(0);
    try {
      const r = await fetch(withKey('/api/uploads/' + uploadId + '/start'), {
        method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ mode: modeRef.current })
      });
      if (r.status === 401) return fail('Access key needed.', true);
      if (r.status === 404) { setKept(null); return fail('The saved upload expired. Choose the video again.'); }
      if (!r.ok) return fail('Could not start optimizing.');
      jobId.current = (await r.json()).id;
      poll(jobId.current);
    } catch { fail('Cannot reach the server.'); }
  }, [fail, headers, poll, withKey]);

  /* ----- resumable upload ----- */
  const ensureUpload = useCallback(async (f) => {
    const map = readMap(); const k = fileKey(f);
    const known = map[k];
    if (known) {
      const r = await fetch(withKey('/api/uploads/' + known), { headers: headers() });
      if (r.status === 401) throw Object.assign(new Error('key'), { key: true });
      if (r.ok) { const j = await r.json(); if (j.size === f.size) return { id: known, received: j.received }; }
    }
    const r = await fetch(withKey('/api/uploads'), {
      method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ name: f.name, size: f.size })
    });
    if (r.status === 401) throw Object.assign(new Error('key'), { key: true });
    if (!r.ok) { let m = 'Upload failed (' + r.status + ').'; try { m = (await r.json()).error || m; } catch { /* default */ } throw new Error(m); }
    const j = await r.json();
    map[k] = j.id; writeMap(map);
    return { id: j.id, received: 0 };
  }, [headers, withKey]);

  const putChunk = useCallback((id, offset, blob, onLoaded) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('PUT', withKey('/api/uploads/' + id + '?offset=' + offset));
    for (const [k, v] of Object.entries(headers())) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onLoaded(e.loaded); };
    xhr.onload = () => {
      let j = {}; try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status === 200) resolve(j.received);
      else if (xhr.status === 409 && typeof j.received === 'number') resolve(j.received); // resync
      else if (xhr.status === 401) reject(Object.assign(new Error('key'), { key: true }));
      else reject(new Error(j.error || 'Upload failed (' + xhr.status + ').'));
    };
    xhr.onerror = () => reject(Object.assign(new Error('network'), { network: true }));
    xhr.onabort = () => reject(Object.assign(new Error('abort'), { aborted: true }));
    xhr.send(blob);
  }), [headers, withKey]);

  const runUpload = useCallback(async () => {
    const f = fileRef.current; if (!f) return;
    flags.current = { pause: false, cancel: false };
    setPhase('upload'); setError(''); setNeedKey(false);
    try {
      const { id, received: start } = await ensureUpload(f);
      upId.current = id;
      let received = start;
      setPct((received / f.size) * 100);
      while (received < f.size) {
        if (flags.current.cancel) return;
        if (flags.current.pause) { setPhase('paused'); return; }
        const end = Math.min(received + CHUNK, f.size);
        const base = received;
        received = await putChunk(id, received, f.slice(received, end), (loaded) => setPct(((base + loaded) / f.size) * 100));
        setPct((received / f.size) * 100);
      }
      await startJob(id);
    } catch (e) {
      if (e.aborted) { if (flags.current.pause) setPhase('paused'); return; }
      if (e.key) return fail('Access key needed.', true);
      if (e.network) { setError('Connection lost. Tap Resume to continue.'); return setPhase('paused'); }
      fail(e.message || 'Upload failed.');
    }
  }, [ensureUpload, fail, putChunk, startJob]);

  const start = useCallback((f) => {
    if (!f) return;
    if (f.size > MAX_BYTES) { setFile(f); return fail('That file is over 600 MB.'); }
    if (f.type && !f.type.startsWith('video/')) return fail('Please choose a video file.');
    fileRef.current = f; setFile(f); setResult(null); setKept(null); setDl({ state: 'idle', pct: 0 }); savedFile.current = null;
    runUpload();
  }, [fail, runUpload]);

  const pause = useCallback(() => { flags.current.pause = true; try { xhrRef.current?.abort(); } catch { /* ignore */ } setPhase('paused'); }, []);
  const resume = useCallback(() => { setError(''); runUpload(); }, [runUpload]);

  const cancel = useCallback(async () => {
    flags.current.cancel = true;
    try { xhrRef.current?.abort(); } catch { /* ignore */ }
    clearInterval(timer.current);
    const wasJob = jobId.current && (phase === 'queued' || phase === 'process');
    if (wasJob) {
      try { await fetch(withKey('/api/jobs/' + jobId.current), { method: 'DELETE', headers: headers() }); } catch { /* ignore */ }
      jobId.current = null;
    }
    // keep the uploaded part so the same video continues instead of starting again
    const f = fileRef.current;
    setKept(upId.current && f ? { id: upId.current, pct: wasJob ? 100 : pct, name: f.name } : null);
    setPhase('idle'); setPct(0); setError('');
  }, [headers, pct, phase, withKey]);

  const continueKept = useCallback(() => {
    const f = fileRef.current;
    if (!f) return input.current?.click(); // page was reloaded: pick the same video, it resumes automatically
    setKept(null);
    runUpload();
  }, [runUpload]);

  const discardKept = useCallback(async () => {
    if (kept?.id) { try { await fetch(withKey('/api/uploads/' + kept.id), { method: 'DELETE', headers: headers() }); } catch { /* ignore */ } }
    const f = fileRef.current;
    if (f) { const m = readMap(); delete m[fileKey(f)]; writeMap(m); }
    fileRef.current = null; upId.current = null; setFile(null); setKept(null);
  }, [headers, kept, withKey]);

  const reset = useCallback(() => {
    clearInterval(timer.current);
    jobId.current = null; upId.current = null; fileRef.current = null; savedFile.current = null;
    setPhase('idle'); setFile(null); setResult(null); setError(''); setNeedKey(false); setPct(0); setKept(null);
    setDl({ state: 'idle', pct: 0 });
    if (input.current) input.current.value = '';
  }, []);

  /* ----- home-screen app download (fetch, then share sheet) ----- */
  const prepareFile = useCallback(async () => {
    if (!result) return;
    setDl({ state: 'loading', pct: 0 });
    try {
      const r = await fetch(withKey('/api/jobs/' + result.id + '/download'), { headers: headers() });
      if (!r.ok) throw new Error('status ' + r.status);
      const total = Number(r.headers.get('content-length')) || result.bytes || 0;
      const reader = r.body.getReader(); const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (total) setDl({ state: 'loading', pct: Math.min(99, (got / total) * 100) });
      }
      const base = (file?.name || 'video').replace(/\.[^.]+$/, '');
      savedFile.current = new File(chunks, base + '-optimized.mp4', { type: 'video/mp4' });
      setDl({ state: 'ready', pct: 100 });
    } catch { setDl({ state: 'error', pct: 0 }); }
  }, [file, headers, result, withKey]);

  const saveFile = useCallback(async () => {
    const f = savedFile.current; if (!f) return;
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: f.name }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const url = URL.createObjectURL(f); const a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, []);

  const onKey = (v) => { setKey(v); lsSet('obitoKey', v); };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (phase === 'idle') start(e.dataTransfer.files?.[0]); };

  const busy = phase === 'upload' || phase === 'queued' || phase === 'process';
  const beamOn = busy;
  const title = { idle: 'Upload your video', upload: 'Uploading', paused: 'Paused', queued: 'Getting ready', process: 'Optimizing', done: 'Your video is ready', error: 'Something went wrong' }[phase];
  const sub = {
    idle: 'MP4 or MOV · up to 600 MB',
    upload: file ? file.name : '', queued: file ? file.name : '', process: file ? file.name : '',
    paused: error || (Math.round(pct) + '% uploaded · tap Resume to continue'),
    done: result?.bytes ? fmt(result.bytes) : file?.name || '',
    error
  }[phase];

  const stage =
    phase === 'done' ? <Bot state="default" /> :
    phase === 'process' ? <Bot state="working" /> :
    phase === 'paused' ? <Bot state="sleeping" /> :
    phase === 'error' ? <div className="err-badge"><CloseIcon width={26} height={26} strokeWidth={2.4} /></div> :
    <Orb state={phase === 'upload' || phase === 'queued' ? 'connecting' : 'breathing'} />;

  return (
    <div className="app">
      <div className="cosmos" aria-hidden="true">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
        <span className="stars s1" /><span className="stars s2" /><span className="stars s3" />
      </div>
      <MenuBar />

      <main className="shell">
        <section className="hero">
          <h1>Your clips, <em>TikTok-ready.</em></h1>
          <p>Upload once. 60 and 120 fps videos keep their smoothness, quality stays untouched and HDR clips stay HDR. No re-encoding, no waiting around.</p>
        </section>

        <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={1} borderRadius={22} active={beamOn} className="beam">
          <Window title="OBITO STUDIO — Optimizer" id="optimizer" className={'main' + (drag ? ' drag' : '')}>
            <div className="drop"
              onDragOver={(e) => { e.preventDefault(); if (phase === 'idle') setDrag(true); }}
              onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              {stage}
              <h2 className="title" aria-live="polite">{title}</h2>
              <p className={'sub' + (phase === 'error' ? ' sub-err' : '')}>{sub}</p>

              {(busy || phase === 'paused') && (
                <div className="run">
                  <Progress value={phase === 'queued' ? 4 : pct} paused={phase === 'paused'} smooth={phase === 'process'} />
                  <div className="run-row">
                    <span>{phase === 'queued' ? 'Waiting' : Math.round(pct) + '%'}</span>
                    <button type="button" className="link" onClick={cancel}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {phase === 'upload' && (
              <button type="button" className="btn glass" onClick={pause}><PauseIcon /> Pause</button>
            )}
            {phase === 'paused' && (
              <button type="button" className="btn glass primary" onClick={resume}><PlayIcon /> Resume</button>
            )}

            {phase === 'idle' && (
              <>
                {kept && (
                  <div className="kept">
                    <div><b>{kept.name}</b><span>{Math.round(kept.pct)}% already uploaded</span></div>
                    <button type="button" className="chip" onClick={continueKept}>Continue</button>
                    <button type="button" className="chip ghost" onClick={discardKept} aria-label="Discard"><CloseIcon width={14} height={14} /></button>
                  </div>
                )}
                <ModeSelect value={mode} onChange={setMode} />
                <button type="button" className="btn glass primary" onClick={() => input.current?.click()}>
                  <UploadIcon /> Choose video
                </button>
              </>
            )}

            {phase === 'done' && result && (
              <>
                {!isStandalone() ? (
                  <a className="btn glass primary" href={withKey('/api/jobs/' + result.id + '/download')}><DownloadIcon /> Download</a>
                ) : dl.state === 'ready' ? (
                  <button type="button" className="btn glass primary" onClick={saveFile}><DownloadIcon /> Save to Files</button>
                ) : (
                  <button type="button" className="btn glass primary" onClick={prepareFile} disabled={dl.state === 'loading'}>
                    <DownloadIcon />{dl.state === 'loading' ? 'Preparing ' + Math.round(dl.pct) + '%' : dl.state === 'error' ? 'Try again' : 'Download'}
                  </button>
                )}
                <button type="button" className="btn glass soft" onClick={reset}>Optimize another</button>
              </>
            )}

            {phase === 'error' && <button type="button" className="btn glass soft" onClick={reset}>Try again</button>}

            {(needKey || phase === 'idle') && (
              <label className={'keyrow' + (needKey ? ' need' : '')}>
                <KeyIcon width={16} height={16} />
                <input type="password" placeholder="Access key" value={key} autoComplete="current-password" onChange={(e) => onKey(e.target.value)} />
              </label>
            )}
            <input ref={input} type="file" hidden accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" onChange={(e) => { start(e.target.files?.[0]); e.target.value = ''; }} />
          </Window>
        </BorderBeam>

        <Window title="What you get" id="features">
          <div className="features">
            {FEATURES.map(({ Icon, t, d }) => (
              <article className="feat" key={t}>
                <span className="feat-ico"><Icon width={20} height={20} /></span>
                <h3>{t}</h3><p>{d}</p>
              </article>
            ))}
          </div>
        </Window>

        <Window title="How it works" id="how">
          <ol className="steps">
            {STEPS.map(({ n, t, d }) => (
              <li key={n}><span className="step-n">{n}</span><div><h3>{t}</h3><p>{d}</p></div></li>
            ))}
          </ol>
        </Window>

        <Window title="FAQ" id="faq">
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}<ChevronIcon width={18} height={18} /></summary><p>{a}</p></details>
            ))}
          </div>
        </Window>

        <footer className="foot"><SparkIcon width={14} height={14} /> OBITO STUDIO · Files are deleted after download or 1 hour.</footer>
      </main>
    </div>
  );
}
