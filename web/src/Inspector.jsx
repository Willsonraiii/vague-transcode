import { useCallback, useRef, useState } from 'react';
import { CheckIcon, CloseIcon, InspectIcon, UploadIcon } from './icons.jsx';

const MAX_BYTES = 600 * 1024 * 1024;
const frac = (s) => { if (!s) return 0; const [a, b] = String(s).split('/').map(Number); return b ? a / b : a; };
const fmtBytes = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const fmtRate = (b) => (b ? Math.round(Number(b) / 1000) + ' kbps' : '—');
const fmtDur = (s) => { const n = Number(s) || 0; const m = Math.floor(n / 60); return m + ':' + String(Math.round(n % 60)).padStart(2, '0'); };
const fmtCount = (n) => (n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
const dvi = (d) => d.dv_profile ?? '?';
const extractUser = (text) => {
  const m = /tiktok\.com\/@?([A-Za-z0-9_.]{2,24})/i.exec(text || '') || /@([A-Za-z0-9_.]{2,24})/.exec(text || '');
  return m ? '@' + m[1] : '';
};

function parseProbe(probe, linkUser, page) {
  const streams = probe.streams || [];
  const v = streams.find((s) => s.codec_type === 'video') || null;
  const audio = streams.filter((s) => s.codec_type === 'audio');
  const f = probe.format || {};
  const tags = f.tags || {};
  const tagUser = extractUser(Object.values(tags).join(' '));
  const user = linkUser || tagUser;
  const fps = v ? frac(v.r_frame_rate) : 0;
  const ts = v && v.time_base ? Number(String(v.time_base).split('/')[1]) : 0;
  const transfer = v?.color_transfer || '';
  const hdr = transfer === 'arib-std-b67' ? 'HLG · iPhone HDR' : transfer === 'smpte2084' ? 'PQ · HDR10' : 'SDR';
  const dovi = (v?.side_data_list || []).find((s) => /DOVI|Dolby/i.test(s.side_data_type || ''));
  const size = Number(f.size || 0);
  const tiles = [
    ['Creator', user || '—'],
    ['Resolution', v ? `${v.width} × ${v.height}` : '—'],
    ['Frame rate', v ? (fps % 1 ? fps.toFixed(2) : fps) + ' fps' : '—'],
    ['Video codec', v ? `${v.codec_name}${v.profile ? ' · ' + v.profile : ''}` : '—'],
    ['HDR', hdr],
    ['Dolby Vision', dovi ? `Yes · profile ${dvi(dovi)}` : 'No'],
    ['Audio', audio.length ? `${audio.length} track${audio.length > 1 ? 's' : ''} · ${audio[0].codec_name}` : 'None'],
    ['Duration', fmtDur(f.duration)],
    ['Size', fmtBytes(size)],
    ['Bitrate', fmtRate(f.bit_rate)],
    ['Timescale', ts || '—'],
    ['Container', f.format_name || '—']
  ];
  if (page?.stats) {
    tiles.push(['Plays', fmtCount(page.stats.plays)], ['Likes', fmtCount(page.stats.likes)], ['Comments', fmtCount(page.stats.comments)], ['Shares', fmtCount(page.stats.shares)]);
  }
  return {
    user,
    tiles,
    checks: [
      ['Has audio', audio.length > 0],
      ['Above 30 fps', fps > 30],
      ['Under 600 MB', size > 0 && size <= MAX_BYTES],
      ['Timescale fits (÷ 19200)', ts > 0 && 19200 % ts === 0],
      ['MP4 / MOV', /mp4|mov|quicktime|m4v/i.test(f.format_name || '')]
    ],
    hdr, dovi: !!dovi
  };
}

function pageReport(page, user) {
  return {
    user,
    tiles: [
      ['Creator', user || '—'],
      ['Resolution', page.width && page.height ? `${page.width} × ${page.height}` : '—'],
      ['Frame rate', '—'],
      ['Video codec', page.ratio || '—'],
      ['HDR', '—'],
      ['Dolby Vision', '—'],
      ['Audio', '—'],
      ['Duration', fmtDur(page.duration)],
      ['Size', '—'],
      ['Bitrate', fmtRate(page.bitrate)],
      ['Plays', fmtCount(page.stats?.plays)],
      ['Likes', fmtCount(page.stats?.likes)]
    ],
    checks: [],
    hdr: 'SDR', dovi: false
  };
}

export default function Inspector({ apiKey }) {
  const [user, setUser] = useState('');
  const [link, setLink] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | linking | sending | done | error
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const keyRef = useRef(apiKey);
  keyRef.current = apiKey;
  const auth = () => ({ headers: keyRef.current ? { 'x-access-token': keyRef.current } : {} });
  const authQ = (u) => (keyRef.current ? u + (u.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : u);

  const runLink = useCallback(async () => {
    const u = extractUser(link);
    if (u) setUser(u);
    if (!/^https?:\/\//i.test(link.trim())) { setError('Paste the full TikTok link first.'); return setPhase('error'); }
    setPhase('linking'); setError(''); setReport(null); setNote('');
    setStatus('contacting tiktok…');
    try {
      const r = await fetch(authQ('/api/inspect-link'), { ...auth(), method: 'POST', headers: { ...auth().headers, 'content-type': 'application/json' }, body: JSON.stringify({ url: link.trim() }) });
      if (r.status === 401) { setError('Access key needed — enter it in the Optimizer window.'); return setPhase('error'); }
      if (r.status === 400) { setError((await r.json()).error || 'Bad link.'); return setPhase('error'); }
      setStatus('reading video details…');
      const j = await r.json();
      if (j.user) setUser(j.user);
      if (j.probe) setReport(parseProbe(j.probe, j.user, j.page));
      else if (j.page) setReport(pageReport(j.page, j.user));
      else if (j.user) setReport({ user: j.user, tiles: [['Creator', j.user], ['Caption', j.title || '—']], checks: [], hdr: 'SDR', dovi: false });
      else { setError('Nothing found for this link.'); setPhase('error'); return; }
      setNote(j.note || (!j.probe && !j.page ? 'TikTok blocked the detail read from this network — creator fetched via official oEmbed.' : ''));
      setPhase('done');
    } catch { setError('Connection lost.'); setPhase('error'); }
  }, [link]);

  const runFile = useCallback((file) => {
    if (!file) return;
    setPhase('sending'); setPct(0); setError(''); setReport(null); setNote(''); setFileName(file.name);
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('video', file);
    xhr.open('POST', authQ('/api/inspect'));
    for (const [k, v] of Object.entries(auth().headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct((e.loaded / e.total) * 100); };
    xhr.onload = () => {
      if (xhr.status === 401) { setError('Access key needed — enter it in the Optimizer window.'); return setPhase('error'); }
      if (xhr.status !== 200) { let m = 'Inspect failed (' + xhr.status + ').'; try { m = JSON.parse(xhr.responseText).error || m; } catch { /* default */ } setError(m); return setPhase('error'); }
      try {
        const j = JSON.parse(xhr.responseText);
        const r = parseProbe(j.probe || {}, null, null);
        if (r.user) setUser(r.user);
        setReport(r); setPhase('done');
      } catch { setError('Unexpected response.'); setPhase('error'); }
    };
    xhr.onerror = () => { setError('Connection lost.'); setPhase('error'); };
    xhr.send(fd);
  }, []);

  const busy = phase === 'linking' || phase === 'sending';

  return (
    <div className="insp">
      <label className="insp-user">
        <span className="iu-lbl">TikTok creator</span>
        <input value={user} placeholder="Auto-detected from the link"
          onChange={(e) => { const t = e.target.value; setUser(extractUser(t) || t.replace(/\s/g, '').slice(0, 40)); }} />
        {user && <span className="iu-chip">{user}</span>}
      </label>

      <div className="insp-link">
        <input value={link} placeholder="https://www.tiktok.com/@name/video/…" onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) runLink(); }} inputMode="url" autoComplete="off" />
        <button type="button" className="btn glass primary" disabled={busy} onClick={runLink}><InspectIcon width={18} height={18} /> Inspect link</button>
      </div>

      <div className={'insp-drop' + (drag ? ' hot' : '')}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) runFile(e.dataTransfer.files?.[0]); }}>
        {phase === 'sending' ? (
          <>
            <b>Reading {fileName}…</b>
            <div className="progress"><i style={{ width: Math.max(3, pct) + '%' }} /></div>
            <span className="insp-sub">uploaded only for probing, deleted right after</span>
          </>
        ) : phase === 'linking' ? (
          <>
            <span className="insp-ico pulse"><InspectIcon width={26} height={26} /></span>
            <b>{status}</b>
            <span className="insp-sub">username → page data → stream probe</span>
          </>
        ) : (
          <>
            <span className="insp-ico"><InspectIcon width={26} height={26} /></span>
            <b>…or drop a saved video file</b>
            <span className="insp-sub">fallback if TikTok ever blocks a link</span>
            <button type="button" className="btn glass soft" onClick={() => input.current?.click()}><UploadIcon /> Choose video</button>
          </>
        )}
      </div>
      <input ref={input} type="file" hidden accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        onChange={(e) => { runFile(e.target.files?.[0]); e.target.value = ''; }} />

      {phase === 'error' && <p className="insp-err"><CloseIcon width={14} height={14} /> {error}</p>}
      {note && phase === 'done' && <p className="insp-err soft"><InspectIcon width={14} height={14} /> {note}</p>}

      {report && (
        <div className="insp-report">
          <div className={'insp-banner' + (report.dovi ? ' dv' : report.hdr !== 'SDR' ? ' hdr' : '')}>
            {report.dovi ? 'Dolby Vision source — use FPS + Quality + HDR' : report.hdr !== 'SDR' ? 'HDR source — use FPS + Quality + HDR' : report.checks.length ? 'SDR source — FPS + Quality is enough' : 'Link info — stream details hidden by TikTok'}
          </div>
          <div className="insp-grid">
            {report.tiles.map(([k, v]) => (
              <div className="insp-tile" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          {report.checks.length > 0 && (
            <div className="insp-checks">
              {report.checks.map(([label, ok]) => (
                <span className={'pill' + (ok ? ' ok' : ' no')} key={label}>
                  {ok ? <CheckIcon width={13} height={13} strokeWidth={2.8} /> : <CloseIcon width={12} height={12} />}{label}
                </span>
              ))}
            </div>
          )}
          <p className="insp-note">Read-only inspection — nothing is kept or modified.</p>
        </div>
      )}
    </div>
  );
}
