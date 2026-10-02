import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BorderBeam } from 'border-beam';
import Logo from './Logo.jsx';
import Optimizer from './Optimizer.jsx';
import {
  CheckIcon, ChevronIcon, FpsIcon, HdrIcon, HelpIcon, LayersIcon, ListIcon, ShieldIcon, SparkIcon, WifiIcon, WifiOffIcon
} from './icons.jsx';

const DOCK_H = 92;      // space reserved for the dock
const BAR_H = 30;       // menu bar height
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

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

const APPS = [
  { id: 'optimizer', title: 'Optimizer', win: 'OBITO STUDIO — Optimizer', w: 520, dock: <Logo size={40} /> },
  { id: 'features', title: 'What you get', win: 'What you get', w: 340, dock: <SparkIcon width={22} height={22} /> },
  { id: 'how', title: 'How it works', win: 'How it works', w: 340, dock: <ListIcon width={22} height={22} /> },
  { id: 'faq', title: 'FAQ', win: 'FAQ', w: 340, dock: <HelpIcon width={22} height={22} /> }
];

function layoutFor(vw) {
  const cx = Math.round((vw - 520) / 2);
  const left = Math.max(16, cx - 340 - 24);
  const right = Math.min(vw - 340 - 16, cx + 520 + 24);
  return {
    optimizer: { x: cx, y: BAR_H + 22 },
    how: { x: left, y: BAR_H + 22 },
    faq: { x: left, y: BAR_H + 22 + 312 },
    features: { x: right, y: BAR_H + 22 }
  };
}

/* ---------- menu bar ---------- */

function useOnOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) fn(); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [ref, fn]);
}

function WifiMenu({ apiKey }) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [info, setInfo] = useState(null); // { ssid, latency, error }
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
      <button type="button" className={'mb-btn' + (open ? ' on' : '')} onClick={toggle} aria-label="Wi-Fi status" aria-expanded={open}>
        <Icon width={17} height={17} />
      </button>
      {open && (
        <div className="drop-menu wifi" role="dialog" aria-label="Wi-Fi">
          <div className="dm-head"><b>Wi-Fi</b><span className={'dm-pill' + (online ? ' ok' : '')}>{online ? 'Online' : 'Offline'}</span></div>
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

function MenuBar({ wins, focused, onOpen, onReset, apiKey }) {
  const [now, setNow] = useState(() => new Date());
  const [menu, setMenu] = useState(null);
  const ref = useRef(null);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useOnOutside(ref, useCallback(() => setMenu(null), []));
  const day = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const pick = (fn) => () => { setMenu(null); fn(); };
  return (
    <nav className="menubar" aria-label="Menu bar" ref={ref}>
      <div className="mb-left">
        <div className="mb-menu">
          <button type="button" className={'mb-btn logo-btn' + (menu === 'apple' ? ' on' : '')} onClick={() => setMenu(menu === 'apple' ? null : 'apple')} aria-label="OBITO STUDIO menu"><Logo size={17} /></button>
          {menu === 'apple' && (
            <div className="drop-menu">
              <button type="button" onClick={pick(() => onOpen('features'))}>About OBITO STUDIO</button>
              <hr />
              <button type="button" onClick={pick(onReset)}>Reset window layout</button>
            </div>
          )}
        </div>
        <b className="mb-app">OBITO STUDIO</b>
        <div className="mb-menu">
          <button type="button" className={'mb-btn' + (menu === 'window' ? ' on' : '')} onClick={() => setMenu(menu === 'window' ? null : 'window')}>Window</button>
          {menu === 'window' && (
            <div className="drop-menu">
              {APPS.map((a) => (
                <button type="button" key={a.id} onClick={pick(() => onOpen(a.id))}>
                  <span className="tick">{wins[a.id].open && !wins[a.id].min ? <CheckIcon width={13} height={13} strokeWidth={2.8} /> : null}</span>{a.title}
                </button>
              ))}
              <hr />
              <button type="button" onClick={pick(onReset)}>Arrange windows</button>
            </div>
          )}
        </div>
        <div className="mb-menu">
          <button type="button" className={'mb-btn' + (menu === 'help' ? ' on' : '')} onClick={() => setMenu(menu === 'help' ? null : 'help')}>Help</button>
          {menu === 'help' && (
            <div className="drop-menu">
              <button type="button" onClick={pick(() => onOpen('faq'))}>Questions (FAQ)</button>
              <button type="button" onClick={pick(() => onOpen('how'))}>How it works</button>
            </div>
          )}
        </div>
      </div>
      <div className="mb-right">
        <WifiMenu apiKey={apiKey} />
        <span className="mb-clock"><span className="cd">{day} </span>{time}</span>
      </div>
    </nav>
  );
}

/* ---------- window ---------- */

function Window({ app, st, desktop, focused, beam, beamActive, vh, onFocus, onClose, onMin, onZoom, onMove, children }) {
  const drag = useRef(null);
  const down = (e) => {
    onFocus();
    if (!desktop || st.max || e.target.closest('.lights')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, x: st.x, y: st.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    onMove(drag.current.x + e.clientX - drag.current.sx, drag.current.y + e.clientY - drag.current.sy);
  };
  const up = () => { drag.current = null; };

  const geom = desktop
    ? (st.max
      ? { left: 0, top: BAR_H, width: '100vw', height: `calc(100vh - ${BAR_H}px - ${DOCK_H - 14}px)` }
      : { left: st.x, top: st.y, width: app.w, maxHeight: Math.max(260, vh - st.y - DOCK_H + 6) })
    : {};
  const cls = ['winwrap', st.max ? 'is-max' : '', !st.open ? 'is-closed' : '', st.min ? 'is-min' : '', focused ? 'is-focus' : '', st.anim ? 'anim' : '']
    .filter(Boolean).join(' ');
  const style = { ...geom, zIndex: st.max ? 900 + st.z : 10 + st.z, '--ox': st.ox + 'px', '--oy': st.oy + 'px' };

  const section = (
    <section className="win" id={app.id} aria-label={app.title}>
      <header className="win-bar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={onZoom}>
        <span className="lights">
          <button type="button" className="l-r" aria-label={'Close ' + app.title} onClick={onClose}><svg viewBox="0 0 10 10"><path d="M2.6 2.6l4.8 4.8M7.4 2.6 2.6 7.4" /></svg></button>
          <button type="button" className="l-y" aria-label={'Minimize ' + app.title} onClick={onMin}><svg viewBox="0 0 10 10"><path d="M2.2 5h5.6" /></svg></button>
          <button type="button" className="l-g" aria-label={(st.max ? 'Exit full size ' : 'Zoom ') + app.title} onClick={onZoom}><svg viewBox="0 0 10 10"><path d={st.max ? 'M3 7V4.2M3 7h2.8M7 3v2.8M7 3H4.2' : 'M2.6 7.4V4.6M2.6 7.4h2.8M7.4 2.6v2.8M7.4 2.6H4.6'} /></svg></button>
        </span>
        <b>{app.win}</b>
        <span className="lights-pad" />
      </header>
      <div className="win-body">{children}</div>
    </section>
  );
  return (
    <div className={cls} style={style} onPointerDown={onFocus}>
      {beam ? <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={1} borderRadius={14} active={beamActive} className="beam">{section}</BorderBeam> : section}
    </div>
  );
}

/* ---------- dock ---------- */

function Dock({ wins, focused, onTap }) {
  const [hover, setHover] = useState(null);
  const idx = APPS.findIndex((a) => a.id === hover);
  return (
    <div className="dock-wrap">
      <div className="dock" onMouseLeave={() => setHover(null)}>
        {APPS.map((a, i) => {
          const d = idx < 0 ? 99 : Math.abs(i - idx);
          const scale = d === 0 ? 1.38 : d === 1 ? 1.16 : 1;
          const w = wins[a.id];
          return (
            <button type="button" key={a.id} id={'dock-' + a.id} className={'dock-item' + (a.id === 'optimizer' ? ' brand' : '')}
              style={{ transform: `translateY(${(1 - scale) * 14}px) scale(${scale})` }}
              onMouseEnter={() => setHover(a.id)} onClick={() => onTap(a.id)} aria-label={a.title}>
              <span className="dock-ico">{a.dock}</span>
              {hover === a.id && <span className="dock-tip">{a.title}</span>}
              <i className={'dock-dot' + (w.open ? ' on' : '') + (w.min ? ' min' : '')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- desktop ---------- */

const initialWin = (pos, i) => ({ open: true, min: false, max: false, x: pos.x, y: pos.y, z: i, ox: 0, oy: 0, anim: false });

export default function App() {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
  const [desktop, setDesktop] = useState(mq ? mq.matches : false);
  const [vw, setVw] = useState(typeof window === 'undefined' ? 1280 : window.innerWidth);
  const [vh, setVh] = useState(typeof window === 'undefined' ? 800 : window.innerHeight);
  const [apiKey, setApiKey] = useState(() => lsGet('obitoKey') || '');
  const [busy, setBusy] = useState(false);
  const zRef = useRef(4);
  const [focused, setFocused] = useState('optimizer');
  const [wins, setWins] = useState(() => {
    const L = layoutFor(typeof window === 'undefined' ? 1280 : window.innerWidth);
    return Object.fromEntries(APPS.map((a, i) => [a.id, initialWin(L[a.id], i)]));
  });

  useLayoutEffect(() => {
    const on = () => { setDesktop(window.matchMedia('(min-width: 900px)').matches); setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const onKeyChange = useCallback((v) => { setApiKey(v); lsSet('obitoKey', v); }, []);
  const patch = useCallback((id, p) => setWins((w) => ({ ...w, [id]: { ...w[id], ...p } })), []);
  const focus = useCallback((id) => { zRef.current += 1; setFocused(id); patch(id, { z: zRef.current }); }, [patch]);

  const dockPoint = (id, st) => {
    const el = document.getElementById('dock-' + id);
    const wrap = document.getElementById(id)?.parentElement;
    if (!el || !wrap) return { ox: 0, oy: 0 };
    const d = el.getBoundingClientRect(); const r = wrap.getBoundingClientRect();
    return { ox: d.left + d.width / 2 - r.left, oy: d.top + d.height / 2 - r.top, st };
  };

  const flashAnim = useCallback((id) => { patch(id, { anim: true }); setTimeout(() => patch(id, { anim: false }), 420); }, [patch]);

  const close = (id) => { patch(id, { open: false, max: false }); };
  const minimize = (id) => { const { ox, oy } = dockPoint(id); patch(id, { ox, oy, min: true }); };
  const zoom = (id) => { flashAnim(id); patch(id, { max: !wins[id].max, min: false }); focus(id); };
  const openApp = useCallback((id) => {
    const el = document.getElementById('dock-' + id);
    const wrap = document.getElementById(id)?.parentElement;
    if (el && wrap && !wins[id].open) {
      const d = el.getBoundingClientRect(); const r = wrap.getBoundingClientRect();
      patch(id, { ox: d.left + d.width / 2 - r.left, oy: d.top + d.height / 2 - r.top });
    }
    patch(id, { open: true, min: false });
    requestAnimationFrame(() => focus(id));
  }, [focus, patch, wins]);
  const dockTap = (id) => {
    const w = wins[id];
    if (!w.open || w.min) openApp(id); else focus(id);
    if (!desktop) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const move = (id, x, y) => patch(id, {
    x: Math.min(Math.max(x, 60 - APPS.find((a) => a.id === id).w), vw - 60),
    y: Math.min(Math.max(y, BAR_H), vh - DOCK_H)
  });
  const resetLayout = () => {
    const L = layoutFor(window.innerWidth);
    setWins(Object.fromEntries(APPS.map((a, i) => [a.id, { ...initialWin(L[a.id], i), max: false }])));
    setFocused('optimizer');
  };

  return (
    <div className={'app ' + (desktop ? 'is-desktop' : 'is-mobile')}>
      <div className="cosmos" aria-hidden="true">
        <span className="planet p1" /><span className="planet p2" /><span className="planet p3" />
        <span className="stars s1" /><span className="stars s2" />
      </div>

      <MenuBar wins={wins} focused={focused} onOpen={openApp} onReset={resetLayout} apiKey={apiKey} />

      <main className="desk">
        {!desktop && (
          <section className="hero">
            <h1>Your clips, <em>TikTok‑ready.</em></h1>
            <p>Upload once. 60 and 120 fps videos keep their smoothness, quality stays untouched and HDR clips stay HDR. No re-encoding.</p>
          </section>
        )}
        {APPS.map((a) => (
          <Window key={a.id} app={a} st={wins[a.id]} desktop={desktop} vh={vh} focused={focused === a.id}
            beam={a.id === 'optimizer'} beamActive={busy}
            onFocus={() => focus(a.id)} onClose={() => close(a.id)} onMin={() => minimize(a.id)} onZoom={() => zoom(a.id)}
            onMove={(x, y) => move(a.id, x, y)}>
            {a.id === 'optimizer' && <Optimizer apiKey={apiKey} onKeyChange={onKeyChange} onBusy={setBusy} />}
            {a.id === 'features' && <Features />}
            {a.id === 'how' && <Steps />}
            {a.id === 'faq' && <Faq />}
          </Window>
        ))}
      </main>

      <Dock wins={wins} focused={focused} onTap={dockTap} />
    </div>
  );
}
