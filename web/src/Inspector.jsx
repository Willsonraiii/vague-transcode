import { useCallback, useRef, useState } from 'react';
import { CheckIcon, CloseIcon, InspectIcon, KeyIcon, UploadIcon } from './icons.jsx';

const MAX_BYTES = 600 * 1024 * 1024;
const frac = (s) => { if (!s) return 0; const [a, b] = String(s).split('/').map(Number); return b ? a / b : a; };
const fmtBytes = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const fmtRate = (b) => (b ? Math.round(Number(b) / 1000) + ' kbps' : '—');
const fmtDur = (s) => { const n = Number(s) || 0; const m = Math.floor(n / 60); return m + ':' + String(Math.round(n % 60)).padStart(2, '0'); };
const extractUser = (text) => {
  const m = /tiktok\.com\/@?([A-Za-z0-9_.]{2,24})/i.exec(text || '') || /@([A-Za-z0-9_.]{2,24})/.exec(text || '');
  return m ? '@' + m[1] : '';
};

function parseProbe(probe) {
  const streams = probe.streams || [];
  const v = streams.find((s) => s.codec_type === 'video') || null;
  const audio = streams.filter((s) => s.codec_type === 'audio');
  const f = probe.format || {};
  const tags = f.tags || {};
  const tagText = Object.values(tags).join(' ');
  const tagUser = extractUser(tagText);
  const fps = v ? frac(v.r_frame_rate) : 0;
  const ts = v && v.time_base ? Number(String(v.time_base).split('/')[1]) : 0;
  const transfer = v?.color_transfer || '';
  const hdr = transfer === 'arib-std-b67' ? 'HLG · iPhone HDR' : transfer === 'smpte2084' ? 'PQ · HDR10' : 'SDR';
  const dovi = (v?.side_data_list || []).find((s) => /DOVI|Dolby/i.test(s.side_data_type || ''));
  const size = Number(f.size || 0);
  return {
    user: tagUser,
    tiles: [
      ['Creator', tagUser || '—'],
      ['Resolution', v ? `${v.width} × ${v.height}` : '—'],
      ['Frame rate', v ? (fps % 1 ? fps.toFixed(2) : fps) + ' fps' : '—'],
      ['Video codec', v ? `${v.codec_name}${v.profile ? ' · ' + v.profile : ''}` : '—'],
      ['HDR', hdr],
      ['Dolby Vision', dovi ? `Yes · profile ${dovi.dv_profile ?? '?'}` : 'No'],
      ['Audio', audio.length ? `${audio.length} track${audio.length > 1 ? 's' : ''} · ${audio[0].codec_name}` : 'None'],
      ['Duration', fmtDur(f.duration)],
      ['Size', fmtBytes(size)],
      ['Bitrate', fmtRate(f.bit_rate)],
      ['Timescale', ts || '—'],
      ['Container', f.format_name || '—']
    ],
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

export default function Inspector({ apiKey }) {
  const [user, setUser] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | sending | done | error
  const [pct, setPct] = useState(0);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const keyRef = useRef(apiKey);
  keyRef.current = apiKey;

  const run = useCallback((file) => {
    if (!file) return;
    setPhase('sending'); setPct(0); setError(''); setReport(null); setFileName(file.name);
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('video', file);
    xhr.open('POST', '/api/inspect' + (keyRef.current ? '?token=' + encodeURIComponent(keyRef.current) : ''));
    if (keyRef.current) xhr.setRequestHeader('x-access-token', keyRef.current);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct((e.loaded / e.total) * 100); };
    xhr.onload = () => {
      if (xhr.status === 401) { setError('Access key needed — enter it in the Optimizer window.'); return setPhase('error'); }
      if (xhr.status !== 200) { let m = 'Inspect failed (' + xhr.status + ').'; try { m = JSON.parse(xhr.responseText).error || m; } catch { /* default */ } setError(m); return setPhase('error'); }
      try {
        const j = JSON.parse(xhr.responseText);
        const r = parseProbe(j.probe || {});
        if (r.user) setUser(r.user);
        setReport(r); setPhase('done');
      } catch { setError('Unexpected response.'); setPhase('error'); }
    };
    xhr.onerror = () => { setError('Connection lost.'); setPhase('error'); };
    xhr.send(fd);
  }, []);

  return (
    <div className="insp">
      <label className="insp-user">
        <span className="iu-lbl">TikTok creator</span>
        <input value={user} placeholder="Paste a TikTok link or @username"
          onChange={(e) => { const t = e.target.value; setUser(extractUser(t) || t.replace(/\s/g, '').slice(0, 40)); }} />
        {user && <span className="iu-chip">{user}</span>}
      </label>

      <div className={'insp-drop' + (drag ? ' hot' : '')}
        onDragOver={(e) => { e.preventDefault(); if (phase !== 'sending') setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (phase !== 'sending') run(e.dataTransfer.files?.[0]); }}>
        <span className="insp-ico"><InspectIcon width={26} height={26} /></span>
        {phase === 'sending' ? (
          <>
            <b>Reading {fileName}…</b>
            <div className="progress"><i style={{ width: Math.max(3, pct) + '%' }} /></div>
            <span className="insp-sub">uploaded only for probing, deleted right after</span>
          </>
        ) : (
          <>
            <b>Drop a TikTok video here</b>
            <span className="insp-sub">resolution · fps · HDR · Dolby · audio · bitrate · creator</span>
            <button type="button" className="btn glass primary" onClick={() => input.current?.click()}><UploadIcon /> Choose video</button>
          </>
        )}
      </div>
      <input ref={input} type="file" hidden accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        onChange={(e) => { run(e.target.files?.[0]); e.target.value = ''; }} />

      {phase === 'error' && <p className="insp-err"><CloseIcon width={14} height={14} /> {error}</p>}

      {report && (
        <div className="insp-report">
          <div className={'insp-banner' + (report.dovi ? ' dv' : report.hdr !== 'SDR' ? ' hdr' : '')}>
            {report.dovi ? 'Dolby Vision source — use FPS + Quality + HDR' : report.hdr !== 'SDR' ? 'HDR source — use FPS + Quality + HDR' : 'SDR source — FPS + Quality is enough'}
          </div>
          <div className="insp-grid">
            {report.tiles.map(([k, v]) => (
              <div className="insp-tile" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          <div className="insp-checks">
            {report.checks.map(([label, ok]) => (
              <span className={'pill' + (ok ? ' ok' : ' no')} key={label}>
                {ok ? <CheckIcon width={13} height={13} strokeWidth={2.8} /> : <CloseIcon width={12} height={12} />}{label}
              </span>
            ))}
          </div>
          <p className="insp-note">Read-only inspection — your file is never kept or modified.</p>
        </div>
      )}
    </div>
  );
}
