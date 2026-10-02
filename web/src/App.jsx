import { useCallback, useEffect, useRef, useState } from 'react';
import { BorderBeam } from 'border-beam';
import Logo from './Logo.jsx';
import Optimizer from './Optimizer.jsx';
import {
  CheckIcon, ChevronIcon, ControlIcon, FpsIcon, HdrIcon, HelpIcon, InspectIcon, LayersIcon, ListIcon,
  ShieldIcon, SparkIcon, SpeakerIcon, SunIcon, TailnetIcon, WifiIcon, WifiOffIcon
} from './icons.jsx';
import Inspector from './Inspector.jsx';

const BAR_H = 34;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }

/* ---------- content ---------- */

const FEATURES = [
  { Icon: FpsIcon, t: 'Built for 60 & 120 fps', d: 'Frame-rate timing is adjusted so TikTok is less likely to flatten fast footage to 30 fps.' },
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
  ['Does it re-encode my video?', 'No. Video and audio are copied as they are and only the container and timing are rewritten, so quality stays identical and it finishes quickly.'],
  ['What is the difference between the two buttons?', 'FPS + Quality fixes the frame-rate timing and keeps your quality. FPS + Quality + HDR does the same and also prepares HDR clips for TikTok. If your video is not HDR, either works.'],
  ['What if I pause or cancel an upload?', 'Nothing is thrown away. The part already uploaded stays on the server for an hour, so choosing the same video again, or tapping Continue, picks up where it stopped.'],
  ['Why does my gallery show no duration?', 'The optimized file is made for TikTok, and some players show no duration for it. Upload it through TikTok Studio to see how it posts.'],
  ['How big can my video be?', 'Up to 600 MB, MP4, MOV or M4V.'],
  ['Where do my files go?', 'They stay on your own server and are deleted after you download the result, or after one hour.']
];

const SECTIONS = [
  { id: 'optimizer', title: 'OBITO STUDIO — Optimizer' },
  { id: 'how', title: 'How it works' },
  { id: 'features', title: 'What you get' },
  { id: 'faq', title: 'FAQ' }
];

/* ---------- hooks ---------- */

function useOnOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) fn(); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [ref, fn]);
}

function useReveal(threshold = 0.16) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, shown };
}

/* ---------- terminal hero (typewriter) ---------- */

const TERM = [
  { cmd: true, t: 'obito --prepare your-clip.mp4' },
  { t: 'upload once.' },
  { t: '60 and 120 fps videos keep their smoothness.' },
  { t: 'quality stays untouched — no re-encoding.' },
  { t: 'HDR clips stay HDR.' },
  { cmd: true, t: 'ready for tiktok studio' }
];
const TERM_TOTAL = TERM.reduce((n, l) => n + l.t.length, 0);

function Terminal() {
  const { ref, shown: started } = useReveal(0.3);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started || count >= TERM_TOTAL) return;
    const t = setTimeout(() => setCount((c) => Math.min(TERM_TOTAL, c + 1)), 26);
    return () => clearTimeout(t);
  }, [started, count]);
  let left = count;
  return (
    <div className={'term reveal' + (started ? ' in' : '')} ref={ref} role="img" aria-label="Your clips, TikTok-ready. Upload once. 60 and 120 fps videos keep their smoothness, quality stays untouched and HDR clips stay HDR. No re-encoding.">
      <header className="term-bar">
        <span className="lights"><i className="l-r" /><i className="l-y" /><i className="l-g" /></span>
        <b>Your clips, TikTok‑ready.</b>
        <span className="lights-pad" />
      </header>
      <div className="term-body">
        {TERM.map((l, i) => {
          const take = Math.max(0, Math.min(l.t.length, left));
          left -= take;
          if (take === 0 && left <= 0 && count < TERM_TOTAL) return null;
          const current = take < l.t.length;
          return (
            <div className={'term-line' + (l.cmd ? ' cmd' : '')} key={i}>
              <span className="term-ps">{l.cmd ? 'obito@studio ~ %' : '➜'}</span>
              <span>{l.t.slice(0, take)}</span>
              {current && <i className="caret" />}
            </div>
          );
        })}
        {count >= TERM_TOTAL && <div className="term-line cmd"><span className="term-ps">obito@studio ~ %</span><span> </span><i className="caret blink" /></div>}
      </div>
    </div>
  );
}

/* ---------- menu bar + control centre ---------- */

function ControlCenter({ apiKey }) {
  const [open, setOpen] = useState(false);
  const [ssid, setSsid] = useState(null);
  const [wired, setWired] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [bright, setBright] = useState(() => Number(lsGet('obitoBright') || 100));
  const [vol, setVol] = useState(() => Number(lsGet('obitoVol') || 65));
  const ref = useRef(null);
  useOnOutside(ref, useCallback(() => setOpen(false), []));

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    if (!open) return;
    fetch('/api/network' + (apiKey ? '?token=' + encodeURIComponent(apiKey) : ''), { headers: apiKey ? { 'x-access-token': apiKey } : {} })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { setSsid(j.ssid); setWired(j.wired); } }).catch(() => { /* offline */ });
  }, [open, apiKey]);
  useEffect(() => {
    document.documentElement.style.setProperty('--dim', String((100 - bright) / 100 * 0.72));
    lsSet('obitoBright', String(bright));
  }, [bright]);
  useEffect(() => { lsSet('obitoVol', String(vol)); }, [vol]);

  return (
    <div className="mb-menu" ref={ref}>
      <button type="button" className={'mb-btn icon' + (open ? ' on' : '')} onClick={() => setOpen(!open)} aria-label="Control Centre" aria-expanded={open}>
        <ControlIcon width={15} height={15} />
      </button>
      {open && (
        <div className="cc" role="dialog" aria-label="Control Centre">
          <div className="cc-grid">
            <div className="cc-mod conn">
              <div className={'cc-tile' + (online ? ' hi' : '')}>
                <span className="cc-ico"><WifiIcon width={17} height={17} /></span>
                <div><b>Wi‑Fi</b><span>{online ? 'On' : 'Off'}</span></div>
              </div>
              <div className="cc-tile">
                <span className="cc-ico"><TailnetIcon width={17} height={17} /></span>
                <div><b>Tailnet</b><span>Private</span></div>
              </div>
            </div>
            <div className="cc-mod now">
              <b className="cc-title">Server network</b>
              <span className="cc-big">{ssid || (wired ? 'Wired' : online ? 'Studio server' : 'Offline')}</span>
              <span className="cc-sub">{online ? 'reachable on this tailnet' : 'no connection'}</span>
            </div>
            <label className="cc-mod slider">
              <span className="cc-ico"><SunIcon width={16} height={16} /></span>
              <input type="range" min="40" max="100" value={bright} onChange={(e) => setBright(Number(e.target.value))} aria-label="Brightness" />
            </label>
            <label className="cc-mod slider">
              <span className="cc-ico"><SpeakerIcon width={16} height={16} /></span>
              <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function WifiMenu({ apiKey }) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [info, setInfo] = useState(null);
  const [conn, setConn] = useState(null);
  const ref = useRef(null);
  useOnOutside(ref, useCallback(() => setOpen(false), []));

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const refresh = useCallback(async () => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    setConn(c ? { type: c.type, eff: c.effectiveType, down: c.downlink, rtt: c.rtt } : null);
    const t0 = performance.now();
    try {
      const r = await fetch('/api/network' + (apiKey ? '?token=' + encodeURIComponent(apiKey) : ''), { headers: apiKey ? { 'x-access-token': apiKey } : {} });
      const latency = Math.round(performance.now() - t0);
      if (r.status === 401) return setInfo({ error: 'Enter your access key to see the server network.', latency });
      if (!r.ok) return setInfo({ error: 'Server network unavailable.', latency });
      const j = await r.json();
      setInfo({ ssid: j.ssid, wired: j.wired, latency });
    } catch { setInfo({ error: 'Server unreachable.' }); }
  }, [apiKey]);

  const toggle = () => { const n = !open; setOpen(n); if (n) refresh(); };
  const Icon = online ? WifiIcon : WifiOffIcon;
  const typeLabel = conn?.type && conn.type !== 'unknown' ? ({ wifi: 'Wi-Fi', cellular: 'Cellular', ethernet: 'Ethernet' }[conn.type] || conn.type) : null;

  return (
    <div className="mb-menu" ref={ref}>
      <button type="button" className={'mb-btn icon' + (open ? ' on' : '')} onClick={toggle} aria-label="Wi-Fi status" aria-expanded={open}>
        <Icon width={16} height={16} />
      </button>
      {open && (
        <div className="drop-menu wifi" role="dialog" aria-label="Wi-Fi">
          <div className="dm-head"><b>Wi‑Fi</b><span className={'dm-pill' + (online ? ' ok' : '')}>{online ? 'Online' : 'Offline'}</span></div>
          <div className="dm-sec">Server network</div>
          {info?.ssid ? (
            <div className="dm-row net"><CheckIcon width={15} height={15} strokeWidth={2.6} /><b>{info.ssid}</b>{typeof info.latency === 'number' && <span>{info.latency} ms</span>}</div>
          ) : info?.wired ? (
            <div className="dm-row"><span className="dim">Connected by cable (no Wi-Fi name)</span>{typeof info.latency === 'number' && <span>{info.latency} ms</span>}</div>
          ) : info?.error ? (
            <div className="dm-row"><span className="dim">{info.error}</span></div>
          ) : info ? (
            <div className="dm-row"><span className="dim">Network name not available</span>{typeof info.latency === 'number' && <span>{info.latency} ms</span>}</div>
          ) : (
            <div className="dm-row"><span className="dim">Checking…</span></div>
          )}
          <div className="dm-sec">This device</div>
          <div className="dm-row"><span>{online ? 'Connected' : 'No connection'}{typeLabel ? ' · ' + typeLabel : ''}</span>{conn?.down ? <span>{conn.down} Mbps</span> : null}</div>
          {conn?.eff && <div className="dm-row"><span className="dim">Quality</span><span>{conn.eff.toUpperCase()}{conn.rtt ? ' · ' + conn.rtt + ' ms' : ''}</span></div>}
          <p className="dm-note">Websites cannot read your device&apos;s Wi-Fi name, so this shows the network of the computer running OBITO STUDIO.</p>
        </div>
      )}
    </div>
  );
}

function MenuBar({ apiKey }) {
  const [now, setNow] = useState(() => new Date());
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    setTilt({ x: Math.max(-1, Math.min(1, dx * 2)), y: Math.max(-1, Math.min(1, dy * 2)) });
  };
  const day = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <nav className="menubar" aria-label="Menu bar" onPointerMove={onMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
      <div className="mb-left">
        <b className="mb-app">OBITO STUDIO</b>
      </div>
      <button type="button" className="mb-logo" style={{ transform: `perspective(300px) rotateY(${tilt.x * 10}deg) rotateX(${-tilt.y * 8}deg)` }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="OBITO STUDIO — back to top">
        <Logo size={30} />
      </button>
      <div className="mb-right">
        <ControlCenter apiKey={apiKey} />
        <WifiMenu apiKey={apiKey} />
        <span className="mb-clock"><span className="cd">{day} </span>{time}</span>
      </div>
    </nav>
  );
}

/* ---------- dock: hidden, proximity + touch awake, macOS magnification ---------- */

const DOCK_APPS = [
  { id: 'optimizer', title: 'Optimizer', dock: <Logo size={34} /> },
  { id: 'inspect', title: 'TikTok Inspector', dock: <InspectIcon width={24} height={24} /> },
  { id: 'how', title: 'How it works', dock: <ListIcon width={24} height={24} /> },
  { id: 'features', title: 'What you get', dock: <SparkIcon width={24} height={24} /> },
  { id: 'faq', title: 'FAQ', dock: <HelpIcon width={24} height={24} /> }
];

function Dock() {
  const [shown, setShown] = useState(false);
  const [hover, setHover] = useState(null);
  const hideT = useRef(null);
  const dockRef = useRef(null);

  const poke = useCallback((near) => {
    clearTimeout(hideT.current);
    if (near) setShown(true);
    else hideT.current = setTimeout(() => setShown(false), 650);
  }, []);

  useEffect(() => {
    const mm = (e) => poke(e.clientY > window.innerHeight - 130);
    const tm = (e) => { const y = e.touches?.[0]?.clientY ?? 0; poke(y > window.innerHeight - 120); };
    window.addEventListener('pointermove', mm, { passive: true });
    window.addEventListener('touchmove', tm, { passive: true });
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('touchmove', tm); };
  }, [poke]);

  const magnify = (e) => {
    const items = dockRef.current?.querySelectorAll('.dock-item');
    if (!items) return;
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const s = 1 + 0.5 * Math.exp(-Math.pow(d / 105, 2));
      el.style.transform = `translateY(${(1 - s) * 26}px) scale(${s})`;
    });
  };
  const calm = () => {
    dockRef.current?.querySelectorAll('.dock-item').forEach((el) => { el.style.transform = ''; });
    setHover(null);
  };

  const tap = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: id === 'optimizer' ? 'center' : 'start' });

  return (
    <div className={'dock-zone' + (shown ? ' up' : '')}>
      <div className="dock" ref={dockRef} onPointerMove={magnify} onPointerLeave={calm} onPointerEnter={() => { clearTimeout(hideT.current); setShown(true); }}>
        {DOCK_APPS.map((a) => (
          <button type="button" key={a.id} className={'dock-item' + (a.id === 'optimizer' ? ' brand' : '')}
            onPointerEnter={() => setHover(a.id)} onClick={() => tap(a.id)} aria-label={a.title}>
            <span className="dock-ico">{a.dock}</span>
            {hover === a.id && <span className="dock-tip">{a.title}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- info sections ---------- */

function Features() {
  return (
    <div className="features">
      {FEATURES.map(({ Icon, t, d }) => (
        <article className="feat" key={t}>
          <span className="feat-ico"><Icon width={20} height={20} /></span>
          <div><h3>{t}</h3><p>{d}</p></div>
        </article>
      ))}
    </div>
  );
}
function Steps() {
  return (
    <ol className="steps">
      {STEPS.map(({ n, t, d }) => (
        <li key={n}><span className="step-n">{n}</span><div><h3>{t}</h3><p>{d}</p></div></li>
      ))}
    </ol>
  );
}
function Faq() {
  return (
    <div className="faq">
      {FAQ.map(([q, a]) => (
        <details key={q}><summary>{q}<ChevronIcon width={18} height={18} /></summary><p>{a}</p></details>
      ))}
    </div>
  );
}

function Section({ id, title, children, beam, beamActive }) {
  const { ref, shown } = useReveal();
  const section = (
    <section className={'win reveal' + (shown ? ' in' : '')} id={id} aria-label={title} ref={ref}>
      <header className="win-bar">
        <span className="lights"><i className="l-r" /><i className="l-y" /><i className="l-g" /></span>
        <b>{title}</b>
        <span className="lights-pad" />
      </header>
      <div className="win-body">{children}</div>
    </section>
  );
  return beam
    ? <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={1} borderRadius={14} active={beamActive} className="beam">{section}</BorderBeam>
    : section;
}

/* ---------- app ---------- */

export default function App() {
  const [apiKey, setApiKey] = useState(() => lsGet('obitoKey') || '');
  const [busy, setBusy] = useState(false);
  const onKeyChange = useCallback((v) => { setApiKey(v); lsSet('obitoKey', v); }, []);

  return (
    <div className="app">
      <div className="cosmos" aria-hidden="true">
        <span className="planet p1" /><span className="planet p2" /><span className="planet p3" />
        <span className="stars s1" /><span className="stars s2" />
      </div>
      <div className="dimmer" aria-hidden="true" />

      <MenuBar apiKey={apiKey} />
      <div className="top-fade" aria-hidden="true" />

      <main className="page">
        <Terminal />
        <Section id="optimizer" title="OBITO STUDIO — Optimizer" beam beamActive={busy}>
          <Optimizer apiKey={apiKey} onKeyChange={onKeyChange} onBusy={setBusy} />
        </Section>
        <Section id="inspect" title="TikTok Inspector">
          <Inspector apiKey={apiKey} />
        </Section>
        <Section id="how" title="How it works"><Steps /></Section>
        <Section id="features" title="What you get"><Features /></Section>
        <Section id="faq" title="FAQ"><Faq /></Section>
        <footer className="foot">OBITO STUDIO · your own server · no cloud, no card</footer>
      </main>

      <Dock />
    </div>
  );
}
