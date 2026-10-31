import { useCallback, useEffect, useRef, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import {
  CheckIcon, CloseIcon, InspectIcon, UploadIcon, FilmIcon,
  SearchIcon, AlertTriangleIcon, LightningIcon, TikTokIcon,
  ExternalLinkIcon, CopyIcon, GlobeIcon, UserIcon
} from './icons.jsx';

const MAX_BYTES = 600 * 1024 * 1024;
const frac = (s) => { if (!s) return 0; const [a, b] = String(s).split('/').map(Number); return b ? a / b : a; };
const fmtBytes = (b) => (b >= 1024 * 1024 * 1024 ? (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : b >= 1024 * 1024 ? (b / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const fmtRate = (b) => (b ? Math.round(Number(b) / 1000) + ' kbps' : '—');
const fmtDur = (s) => { const n = Number(s) || 0; const m = Math.floor(n / 60); return m + ':' + String(Math.round(n % 60)).padStart(2, '0'); };
const fmtCount = (n) => (n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
const dvi = (d) => d.dv_profile ?? '?';
const extractUser = (text) => {
  const m = /tiktok\.com\/@?([A-Za-z0-9_.]{2,24})/i.exec(text || '') || /@([A-Za-z0-9_.]{2,24})/.exec(text || '');
  return m ? '@' + m[1] : '';
};

function getRegionName(code) {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(upper);
    return name ? `${name} (${upper})` : upper;
  } catch {
    return upper;
  }
}

function parseProbe(probe, linkUser, page) {
  const streams = probe.streams || [];
  const v = streams.find((s) => s.codec_type === 'video') || null;
  const audio = streams.filter((s) => s.codec_type === 'audio');
  const f = probe.format || {};
  const tags = f.tags || {};
  const tagUser = extractUser(Object.values(tags).join(' '));
  const user = linkUser || (page?.author ? (page.author.startsWith('@') ? page.author : '@' + page.author) : null) || tagUser;
  const fps = v ? frac(v.r_frame_rate) : 0;
  const ts = v && v.time_base ? Number(String(v.time_base).split('/')[1]) : 0;
  const transfer = v?.color_transfer || '';
  const hdr = transfer === 'arib-std-b67' ? 'HLG (iPhone HDR)' : transfer === 'smpte2084' ? 'PQ (HDR10)' : 'SDR';
  const dovi = (v?.side_data_list || []).find((s) => /DOVI|Dolby/i.test(s.side_data_type || ''));
  const size = (page?.size && page.size > Number(f.size || 0)) ? page.size : Number(f.size || 0);
  const dur = f.duration || v?.duration || page?.duration;
  const bitRate = f.bit_rate || page?.bitrate;
  const mbps = bitRate ? (Number(bitRate) / 1e6).toFixed(1) : (dur > 0 && size > 0 ? ((size * 8) / (dur * 1e6)).toFixed(1) : null);

  // Deep pixel format & bit depth analysis
  const pixFmt = v?.pix_fmt || '';
  const bitDepth = v?.bits_per_raw_sample ? `${v.bits_per_raw_sample}-bit` : pixFmt.includes('10') ? '10-bit' : pixFmt ? '8-bit' : null;
  const pixInfo = pixFmt ? (bitDepth ? `${pixFmt} (${bitDepth})` : pixFmt) : null;

  // Color Primaries
  const primaries = v?.color_primaries ? (
    v.color_primaries === 'bt2020' ? 'BT.2020 (Wide Gamut)' :
    v.color_primaries === 'bt709' ? 'BT.709 (sRGB/Rec.709)' :
    v.color_primaries
  ) : null;

  // Audio specs
  const a0 = audio[0];
  const audioRate = a0?.sample_rate ? `${Number(a0.sample_rate).toLocaleString()} Hz` : null;
  const audioCh = a0?.channel_layout ? `${a0.channel_layout}` : (a0?.channels ? `${a0.channels} ch` : null);
  const audioDesc = audio.length
    ? `${audio.length} track${audio.length > 1 ? 's' : ''} (${a0.codec_name}${audioRate ? ' · ' + audioRate : ''}${audioCh ? ' · ' + audioCh : ''})`
    : 'None';

  // Region
  const regionCode = page?.region;
  const regionName = getRegionName(regionCode);

  // Aspect ratio
  let aspect = null;
  if (v?.width && v?.height) {
    const ratio = (v.width / v.height);
    if (Math.abs(ratio - 9/16) < 0.05) aspect = '9:16 Vertical';
    else if (Math.abs(ratio - 16/9) < 0.05) aspect = '16:9 Landscape';
    else if (Math.abs(ratio - 1) < 0.05) aspect = '1:1 Square';
    else aspect = `${v.width}:${v.height}`;
  } else if (page?.ratio) {
    aspect = page.ratio === '9:16' ? '9:16 Vertical' : page.ratio;
  }

  // Upload date
  const uploadDate = page?.createTime ? new Date(page.createTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : null;

  const tiles = [
    ['Creator', page?.authorName && user ? `${page.authorName} (${user})` : user || '—'],
    ['User Region', regionName || (regionCode ? regionCode.toUpperCase() : '—')],
    ['User ID (UID)', page?.authorId || '—'],
    ['Resolution', v ? `${v.width} × ${v.height}` : (page?.width && page?.height ? `${page.width} × ${page.height}` : '—')],
    ['Aspect Ratio', aspect || '9:16 Vertical'],
    ['Frame Rate', v ? (fps % 1 ? fps.toFixed(2) : fps) + ' fps' : '—'],
    ['Video Codec', v ? `${v.codec_name}${v.profile ? ' · ' + v.profile : ''}` : '—'],
    ['Pixel Format & Depth', pixInfo || '—'],
    ['Color Primaries', primaries || (hdr !== 'SDR' ? 'BT.2020' : 'BT.709')],
    ['Dynamic Range', hdr],
    ['Dolby Vision', dovi ? `Yes · Profile ${dvi(dovi)}` : 'None'],
    ['Audio Stream', audioDesc],
    ['Timescale Clock', ts ? `${ts} Hz` : '—'],
    ['Bitrate', mbps ? `${mbps} Mbps (Rec: 20–35 Mbps)` : fmtRate(bitRate)],
    ['Duration', fmtDur(dur)],
    ['File Size', size ? fmtBytes(size) : '—'],
    ['Container', (f.format_name || '—').split(',')[0]],
    ['Soundtrack', page?.music || '—'],
    ['Upload Date', uploadDate || '—']
  ];

  if (page?.stats) {
    tiles.push(
      ['Total Plays', fmtCount(page.stats.plays)],
      ['Likes', fmtCount(page.stats.likes)],
      ['Comments', fmtCount(page.stats.comments)],
      ['Shares', fmtCount(page.stats.shares)],
      ['Saves', fmtCount(page.stats.saves)]
    );
    if (page.stats.plays && (page.stats.likes || page.stats.comments)) {
      const eng = (((page.stats.likes || 0) + (page.stats.comments || 0) + (page.stats.shares || 0) + (page.stats.saves || 0)) / page.stats.plays) * 100;
      tiles.push(['Engagement Rate', `${eng.toFixed(1)}%`]);
    }
  }

  return {
    user,
    authorName: page?.authorName || null,
    authorId: page?.authorId || null,
    avatar: page?.avatar || null,
    region: regionName || regionCode || null,
    regionCode: regionCode || null,
    videoUrl: page?.url || null,
    tiles: tiles.filter(([_, val]) => val && val !== '—'),
    checks: [
      ['Audio Stream Intact', audio.length > 0],
      ['High Frame Rate (>30 fps)', fps > 30],
      ['Under 600 MB File Size', size > 0 && size <= MAX_BYTES],
      ['Container Clock Compatible', ts > 0 && (ts % 60 === 0 || 19200 % ts === 0)],
      ['Supported Container (MP4/MOV)', /mp4|mov|quicktime|m4v/i.test(f.format_name || 'mp4')],
      ['10-Bit Color Stream', bitDepth === '10-bit' || hdr !== 'SDR']
    ],
    hdr,
    dovi: !!dovi,
    fps
  };
}

function pageReport(page, linkUser) {
  const user = linkUser || (page?.author ? (page.author.startsWith('@') ? page.author : '@' + page.author) : null);
  const regionCode = page?.region;
  const regionName = getRegionName(regionCode);

  const uploadDate = page?.createTime ? new Date(page.createTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : null;

  const allTiles = [
    ['Creator', page?.authorName && user ? `${page.authorName} (${user})` : user || '—'],
    ['User Region', regionName || (regionCode ? regionCode.toUpperCase() : '—')],
    ['User ID (UID)', page?.authorId || '—'],
    ['Resolution', page?.width && page?.height ? `${page.width} × ${page.height}` : '1080 × 1920 (Standard HD)'],
    ['Aspect Ratio', page?.ratio === '9:16' ? '9:16 Vertical' : page?.ratio || '9:16 Vertical'],
    ['Duration', fmtDur(page?.duration)],
    ['Bitrate', page?.bitrate ? `${(Number(page.bitrate) / 1e6).toFixed(1)} Mbps (Rec: 20–35 Mbps)` : fmtRate(page?.bitrate)],
    ['File Size', page?.size ? fmtBytes(page.size) : '—'],
    ['Soundtrack', page?.music || '—'],
    ['Upload Date', uploadDate || '—'],
    ['Total Plays', fmtCount(page?.stats?.plays)],
    ['Likes', fmtCount(page?.stats?.likes)],
    ['Comments', fmtCount(page?.stats?.comments)],
    ['Shares', fmtCount(page?.stats?.shares)],
    ['Saves', fmtCount(page?.stats?.saves)]
  ];

  if (page?.stats?.plays && (page?.stats?.likes || page?.stats?.comments)) {
    const eng = (((page.stats.likes || 0) + (page.stats.comments || 0) + (page.stats.shares || 0) + (page.stats.saves || 0)) / page.stats.plays) * 100;
    allTiles.push(['Engagement Rate', `${eng.toFixed(1)}%`]);
  }

  return {
    user,
    authorName: page?.authorName || null,
    authorId: page?.authorId || null,
    avatar: page?.avatar || null,
    region: regionName || regionCode || null,
    regionCode: regionCode || null,
    videoUrl: page?.url || null,
    tiles: allTiles.filter(([_, v]) => v && v !== '—'),
    checks: [
      ['Valid TikTok Delivery CDN', !!(page?.url || user)],
      ['Standard Vertical Aspect (9:16)', page?.ratio === '9:16' || !page?.ratio],
      ['Duration Within Limits (<10 min)', page?.duration ? page.duration <= 600 : true]
    ],
    hdr: 'SDR',
    dovi: false
  };
}

export default function Inspector({ apiKey }) {
  const [tab, setTab] = useState('link'); // 'link' | 'file'
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
  const [copied, setCopied] = useState(false);
  const input = useRef(null);
  const keyRef = useRef(apiKey);
  keyRef.current = apiKey;

  const auth = () => ({ headers: keyRef.current ? { 'x-access-token': keyRef.current } : {} });
  const authQ = (u) => (keyRef.current ? u + (u.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : u);

  const handleCopyLink = useCallback(() => {
    const target = report?.videoUrl || link;
    if (!target) return;
    navigator.clipboard?.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [report, link]);

  const runLink = useCallback(async () => {
    const u = extractUser(link);
    if (u) setUser(u);
    if (!/^https?:\/\//i.test(link.trim())) {
      setError('Please paste a full valid TikTok link starting with http:// or https://');
      return setPhase('error');
    }
    setPhase('linking');
    setError('');
    setReport(null);
    setNote('');
    setStatus('Querying TikTok metadata…');
    try {
      const r = await fetch(authQ('/api/inspect-link'), {
        ...auth(),
        method: 'POST',
        headers: { ...auth().headers, 'content-type': 'application/json' },
        body: JSON.stringify({ url: link.trim() })
      });
      if (r.status === 401) { setError('Access key needed — enter it in the Optimizer window.'); return setPhase('error'); }
      if (r.status === 400) { setError((await r.json()).error || 'Invalid TikTok URL.'); return setPhase('error'); }
      setStatus('Analyzing video container and codec streams…');
      const j = await r.json();
      if (j.user) setUser(j.user);
      const pageData = j.page || (link ? { url: link.trim() } : null);
      if (j.probe) setReport(parseProbe(j.probe, j.user, pageData));
      else if (j.page) setReport(pageReport(j.page, j.user));
      else if (j.user) setReport({
        user: j.user,
        videoUrl: link.trim(),
        tiles: [['Creator', j.user], ['Caption', j.title || '—']],
        checks: [],
        hdr: 'SDR',
        dovi: false
      });
      else { setError('Nothing found for this link.'); setPhase('error'); return; }
      setNote(j.note || (!j.probe && !j.page ? 'TikTok blocked direct stream download from this network — creator fetched via official oEmbed.' : ''));
      setPhase('done');
    } catch {
      setError('Connection to studio server lost.');
      setPhase('error');
    }
  }, [link]);

  const runFile = useCallback((file) => {
    if (!file) return;
    setPhase('sending');
    setPct(0);
    setError('');
    setReport(null);
    setNote('');
    setFileName(file.name);
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('video', file);
    xhr.open('POST', authQ('/api/inspect'));
    for (const [k, v] of Object.entries(auth().headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct((e.loaded / e.total) * 100); };
    xhr.onload = () => {
      if (xhr.status === 401) { setError('Access key needed — enter it in the Optimizer window.'); return setPhase('error'); }
      if (xhr.status !== 200) {
        let m = 'Inspect failed (' + xhr.status + ').';
        try { m = JSON.parse(xhr.responseText).error || m; } catch { /* default */ }
        setError(m);
        return setPhase('error');
      }
      try {
        const j = JSON.parse(xhr.responseText);
        const r = parseProbe(j.probe || {}, null, null);
        if (r.user) setUser(r.user);
        setReport(r);
        setPhase('done');
      } catch {
        setError('Unexpected server response format.');
        setPhase('error');
      }
    };
    xhr.onerror = () => { setError('Network connection lost.'); setPhase('error'); };
    xhr.send(fd);
  }, []);

  const busy = phase === 'linking' || phase === 'sending';

  const inspTabsRef = useRef(null);
  const [inspPill, setInspPill] = useState({ left: 0, width: 0, ready: false });

  const updateInspPill = useCallback(() => {
    if (!inspTabsRef.current) return;
    const activeBtn = inspTabsRef.current.querySelector(`.insp-tab[data-insp-tab="${tab}"]`);
    if (activeBtn && activeBtn.offsetWidth > 0) {
      setInspPill({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth, ready: true });
    }
  }, [tab]);

  useEffect(() => {
    updateInspPill();

    let ro;
    if (typeof ResizeObserver !== 'undefined' && inspTabsRef.current) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            updateInspPill();
          }
        }
      });
      ro.observe(inspTabsRef.current);
    }

    window.addEventListener('resize', updateInspPill);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateInspPill);
    };
  }, [updateInspPill]);

  // Strict 1-step per swipe for Inspector tabs
  const inspTouchRef = useRef({ startX: 0, startY: 0, startTime: 0, hasSwiped: false, initialTab: 'link' });
  const suppressInspClickRef = useRef(false);

  const switchInspTabWithHaptic = useCallback((newTab) => {
    setTab((prev) => {
      if (prev !== newTab) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(10); } catch {}
        }
        return newTab;
      }
      return prev;
    });
  }, []);

  const onInspTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      const t = e.touches[0];
      inspTouchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        hasSwiped: false,
        initialTab: tab
      };
    }
  };

  const onInspTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - inspTouchRef.current.startX;
    const dy = t.clientY - inspTouchRef.current.startY;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Trigger exactly 1 step when threshold (28px) reached
      if (!inspTouchRef.current.hasSwiped && Math.abs(dx) >= 28) {
        inspTouchRef.current.hasSwiped = true;
        suppressInspClickRef.current = true;

        if (dx > 0 && inspTouchRef.current.initialTab === 'link') {
          // Swipe Right -> switch to file (to the right)
          switchInspTabWithHaptic('file');
        } else if (dx < 0 && inspTouchRef.current.initialTab === 'file') {
          // Swipe Left -> switch to link (to the left)
          switchInspTabWithHaptic('link');
        } else {
          if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(6); } catch {}
        }
      }
    }
  };

  const onInspTouchEnd = (e) => {
    if (inspTouchRef.current.hasSwiped) {
      suppressInspClickRef.current = true;
      setTimeout(() => { suppressInspClickRef.current = false; }, 350);
      return;
    }

    // Quick flick check
    if (e.changedTouches && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const dx = t.clientX - inspTouchRef.current.startX;
      const dy = t.clientY - inspTouchRef.current.startY;
      const dt = Date.now() - inspTouchRef.current.startTime;

      if (Math.abs(dx) >= 22 && Math.abs(dx) > Math.abs(dy) * 1.1 && dt < 320) {
        suppressInspClickRef.current = true;
        setTimeout(() => { suppressInspClickRef.current = false; }, 350);

        if (dx > 0 && inspTouchRef.current.initialTab === 'link') {
          switchInspTabWithHaptic('file');
        } else if (dx < 0 && inspTouchRef.current.initialTab === 'file') {
          switchInspTabWithHaptic('link');
        }
      }
    }
  };

  return (
    <div className="insp">
      <div
        className={`insp-tabs ${inspPill.ready && inspPill.width > 0 ? 'has-slider' : 'no-slider'}`}
        ref={inspTabsRef}
        role="tablist"
        onTouchStart={onInspTouchStart}
        onTouchMove={onInspTouchMove}
        onTouchEnd={onInspTouchEnd}
      >
        {/* Animated Clear Glass Sliding Pill */}
        {inspPill.ready && inspPill.width > 0 && (
          <div
            className="insp-tab-pill-slider"
            style={{
              transform: `translateX(${inspPill.left}px)`,
              width: `${inspPill.width}px`
            }}
          />
        )}

        <button
          type="button"
          role="tab"
          data-insp-tab="link"
          aria-selected={tab === 'link'}
          className={'insp-tab' + (tab === 'link' ? ' active' : '')}
          onClick={(e) => {
            if (suppressInspClickRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            switchInspTabWithHaptic('link');
          }}
        >
          <SearchIcon width={16} height={16} /> Inspect TikTok Link
        </button>
        <button
          type="button"
          role="tab"
          data-insp-tab="file"
          aria-selected={tab === 'file'}
          className={'insp-tab' + (tab === 'file' ? ' active' : '')}
          onClick={(e) => {
            if (suppressInspClickRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            switchInspTabWithHaptic('file');
          }}
        >
          <FilmIcon width={16} height={16} /> Inspect Video File
        </button>
      </div>

      {tab === 'link' ? (
        <div className="clean-dropzone insp-native-card">
          <div className="member-orb mb-3" aria-hidden="true">
            <ThinkingOrb state={phase === 'linking' ? 'searching' : 'breathing'} size={64} theme="dark" />
          </div>
          <div className="dropzone-text">
            <h2 className="dropzone-title">Inspect TikTok Link</h2>
            <p className="dropzone-sub">Paste any TikTok URL to check available video streams.</p>
          </div>
          <form className="insp-native-form" onSubmit={(e) => { e.preventDefault(); if (!busy) runLink(); }}>
            <label htmlFor="insp-url">TikTok video link</label>
            <input id="insp-url" className="studio-input" value={link} placeholder="https://www.tiktok.com/@creator/video/…" onChange={(e) => setLink(e.target.value)} inputMode="url" autoComplete="off" />
            <button type="submit" className="btn-primary-hero choose-file-label" disabled={busy}><SearchIcon width={17} height={17} /><span>{busy ? 'Inspecting…' : 'Inspect link'}</span></button>
          </form>
          {user && <span className="iu-chip">Creator · {user}</span>}
          {phase === 'linking' && <p className="dropzone-sub" role="status">{status}</p>}
        </div>
      ) : (
        <div className={'clean-dropzone insp-native-card' + (drag ? ' drag-over' : '')}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) runFile(e.dataTransfer.files?.[0]); }}>
          <div className="member-orb mb-3" aria-hidden="true">
            <ThinkingOrb state={phase === 'sending' ? 'working' : 'breathing'} size={64} theme="dark" />
          </div>
          <div className="dropzone-text">
            <h2 className="dropzone-title">Inspect Video File</h2>
            <p className="dropzone-sub">Analyze 4K resolution, 60fps/120fps cadence, and HDR color profile.</p>
          </div>
          {phase === 'sending' ? (
            <div className="insp-analyzing">
              <div className="insp-analyzing-head"><span className="terminal-indicator pulsing" /><b>Analyzing {fileName}…</b></div>
              <div className="progress-track-bar"><div className="progress-fill-bar" style={{ width: `${Math.max(4, pct)}%` }} /></div>
            </div>
          ) : (
            <button type="button" className="btn-primary-hero choose-file-label" onClick={() => input.current?.click()}><UploadIcon width={18} height={18} /><span>Choose video file</span></button>
          )}
        </div>
      )}

      <input
        ref={input}
        type="file"
        hidden
        accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        onChange={(e) => {
          runFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {phase === 'error' && (
        <p className="insp-err"><CloseIcon width={16} height={16} /> {error}</p>
      )}
      {note && phase === 'done' && (
        <p className="insp-err soft"><InspectIcon width={16} height={16} /> {note}</p>
      )}

      {report && (
        <div className="insp-report">
          {/* Creator Profile, User Region, and Direct TikTok Action Buttons */}
          {(report.user || report.videoUrl || report.region) && (
            <div className="insp-header-bar">
              <div className="insp-header-creator">
                {report.avatar ? (
                  <img src={report.avatar} alt={report.user || 'Creator'} className="insp-creator-avatar" />
                ) : (
                  <div className="insp-creator-avatar placeholder">
                    <UserIcon width={22} height={22} />
                  </div>
                )}
                <div className="insp-creator-info">
                  <div className="insp-creator-name-row">
                    <span className="insp-creator-name">{report.authorName || report.user || 'TikTok Creator'}</span>
                    {report.user && <span className="insp-creator-handle">{report.user}</span>}
                  </div>
                  <div className="insp-creator-meta-row">
                    {report.region && (
                      <div className="insp-region-badge">
                        <span className="insp-region-dot" />
                        <GlobeIcon width={12} height={12} />
                        <span>{report.region}</span>
                      </div>
                    )}
                    {report.authorId && (
                      <span className="insp-uid-badge" title="Permanent TikTok Account UID">
                        UID · {report.authorId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="insp-header-actions">
                {report.videoUrl && (
                  <a
                    href={report.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-insp-action primary"
                    title="Open video on TikTok in new tab"
                  >
                    <TikTokIcon width={15} height={15} />
                    <span>Open on TikTok</span>
                    <ExternalLinkIcon width={13} height={13} />
                  </a>
                )}
                {report.user && (
                  <a
                    href={`https://www.tiktok.com/${report.user.startsWith('@') ? report.user : '@' + report.user}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-insp-action secondary"
                    title="View creator profile on TikTok"
                  >
                    <UserIcon width={14} height={14} />
                    <span>Creator Profile</span>
                    <ExternalLinkIcon width={12} height={12} />
                  </a>
                )}
                {(report.videoUrl || link) && (
                  <button
                    type="button"
                    className="btn-insp-action secondary"
                    onClick={handleCopyLink}
                    title="Copy TikTok video link"
                  >
                    <CopyIcon width={14} height={14} />
                    <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="insp-summary">
            {[
              ['Master Resolution', report.tiles.find(([name]) => name === 'Resolution')?.[1]],
              ['Frame Rate', report.tiles.find(([name]) => name === 'Frame Rate')?.[1]],
              ['Dynamic Range', report.hdr !== 'SDR' ? report.hdr : report.tiles.find(([name]) => name === 'Pixel Format & Depth')?.[1] || 'SDR (Rec.709)'],
              ['Timescale Clock', report.tiles.find(([name]) => name === 'Timescale Clock')?.[1] || report.tiles.find(([name]) => name === 'Aspect Ratio')?.[1]]
            ].filter(([_, v]) => v && v !== '—').map(([key, val]) => (
              <div className="insp-summary-item" key={key}>
                <span>{key}</span>
                <strong>{val}</strong>
              </div>
            ))}
          </div>

          <div className={'insp-banner' + (report.dovi ? ' dv' : report.hdr !== 'SDR' ? ' hdr' : '')}>
            {report.dovi
              ? 'Dolby Vision Profile 8 Detected — Use FPS + Quality + HDR mode to prevent washed-out colors on TikTok.'
              : report.hdr !== 'SDR'
              ? 'Native HDR Detected — Use FPS + Quality + HDR mode to retain dynamic range in TikTok Studio.'
              : report.checks.length
              ? 'SDR Source — FPS + Quality mode will lock 60/120fps motion fluidity and container clock synchronization.'
              : 'TikTok video information retrieved.'}
          </div>

          <div className="insp-grid">
            {report.tiles.map(([k, v]) => (
              <div className="insp-tile" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>

          {report.checks.length > 0 && (
            <div className="insp-checks">
              {report.checks.map(([label, ok]) => (
                <span className={'pill' + (ok ? ' ok' : ' no')} key={label}>
                  {ok ? <CheckIcon width={13} height={13} strokeWidth={2.8} /> : <CloseIcon width={12} height={12} />}
                  {label}
                </span>
              ))}
            </div>
          )}

          <p className="insp-note">
            Read-only diagnostics. Original video pixels and audio remain completely untouched.
          </p>
        </div>
      )}
    </div>
  );
}
