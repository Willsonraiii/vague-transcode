import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIcon, CloseIcon, SearchIcon, TrashIcon } from './icons.jsx';

const fmtBytes = (n) => {
  if (!n) return '—';
  if (n > 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB';
  return (n / 1024 ** 2).toFixed(1) + ' MB';
};
const fmtDur = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : '—');
const hdr = (t) => (!t || t === 'unknown' || t === 'sdr' ? 'SDR' : t === 'smpte2084' ? 'HDR10' : t === 'arib-std-b67' ? 'HLG' : String(t).toUpperCase());

function ProbeTiles({ p }) {
  if (!p) return <span className="dim">Not available</span>;
  return (
    <div className="lib-tiles">
      <span>{p.w}×{p.h}</span>
      <span>{p.fps} fps{p.ts ? ` (1/${p.ts})` : ''}</span>
      <span>{(p.codec || '').toUpperCase()}</span>
      <span>{hdr(p.transfer)}</span>
      {p.dv ? <span className="hi">DV Profile {p.dv}</span> : null}
      <span>{p.audio} audio</span>
      <span>{fmtDur(p.dur)}</span>
      <span>{fmtBytes(p.size)}</span>
    </div>
  );
}

export default function Library({ apiKey }) {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const keyRef = useRef(apiKey);
  keyRef.current = apiKey;

  const headers = useCallback(() => (keyRef.current ? { 'x-access-token': keyRef.current } : {}), []);
  const withKey = useCallback((url) => (keyRef.current ? url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : url), []);

  const load = useCallback(() => {
    fetch(withKey('/api/library'), { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setEntries(j.entries || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [withKey, headers]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const clear = async () => {
    if (!clearing) {
      setClearing(true);
      return;
    }
    await fetch(withKey('/api/library/clear'), { method: 'POST', headers: headers() }).catch(() => {});
    setEntries([]);
    setClearing(false);
  };

  const tot = entries.reduce((a, e) => {
    a.n += 1;
    if (e.status === 'done') a.done += 1;
    if (e.in && e.in.transfer && e.in.transfer !== 'sdr' && e.in.transfer !== 'unknown') a.hdr += 1;
    if (e.in && e.in.dv) a.dv += 1;
    a.bytes += (e.in && e.in.size) || 0;
    return a;
  }, { n: 0, done: 0, hdr: 0, dv: 0, bytes: 0 });

  const filtered = entries.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (e.name || '').toLowerCase().includes(q) || (e.mode || '').toLowerCase().includes(q);
  });

  return (
    <div className="library">
      <div className="lib-dashboard">
        <div className="lib-metrics-grid">
          <div className="lib-stat-box">
            <span className="stat-num">{tot.n}</span>
            <span className="stat-label">Total Processed</span>
          </div>
          <div className="lib-stat-box">
            <span className="stat-num highlight-emerald">{tot.done}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="lib-stat-box">
            <span className="stat-num highlight-cyan">{tot.hdr}</span>
            <span className="stat-label">HDR Clips</span>
          </div>
          <div className="lib-stat-box">
            <span className="stat-num highlight-amber">{tot.dv}</span>
            <span className="stat-label">Dolby Vision</span>
          </div>
          <div className="lib-stat-box">
            <span className="stat-num">{fmtBytes(tot.bytes)}</span>
            <span className="stat-label">Staged Volume</span>
          </div>
        </div>

        <div className="lib-actions-bar">
          {entries.length > 0 && (
            <div className="lib-filter">
              <SearchIcon width={16} height={16} className="filter-icon" />
              <input
                value={query}
                placeholder="Filter history by filename or mode…"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="btn-filter-clear" onClick={() => setQuery('')} aria-label="Clear filter">
                  <CloseIcon width={14} height={14} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn-lib-clear"
            onClick={clear}
            disabled={!entries.length}
            title="Clear metadata log"
          >
            <TrashIcon width={14} height={14} />
            <span>{clearing ? 'Confirm Clear?' : 'Clear History'}</span>
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <div className="lib-empty-card">
          <p className="lib-empty-text">
            {loaded
              ? (entries.length ? 'No videos matching your search filter.' : 'Your history is clean — every optimized video records its container specs here.')
              : 'Connecting to storage…'}
          </p>
        </div>
      ) : (
        <div className="lib-list">
          {filtered.map((e) => (
            <article className="lib-card" key={e.id + '-' + e.at}>
              <header className="lib-card-header">
                <div className="lib-card-title">
                  <b>{e.name}</b>
                  <span className="lib-meta-time">
                    {new Date(e.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · Mode: {e.mode}
                  </span>
                </div>
                <span className={'pill ' + (e.status === 'done' ? 'ok' : e.status === 'failed' ? 'no' : 'warn')}>
                  {e.status === 'done' ? <CheckIcon width={12} height={12} strokeWidth={2.8} /> : null}
                  {e.status.toUpperCase()}
                </span>
              </header>

              {e.error && <div className="lib-err">{e.error}</div>}

              <div className="lib-cols">
                <div className="lib-col-block">
                  <h4 className="lib-col-head">Input Source</h4>
                  <ProbeTiles p={e.in} />
                </div>
                <div className="lib-col-block">
                  <h4 className="lib-col-head">Output Container</h4>
                  {e.out ? <ProbeTiles p={e.out} /> : <span className="dim">—</span>}
                </div>
              </div>

              {e.result && (
                <div className="lib-note">
                  {e.result.hadDolbyVision ? '✨ Dolby Vision layer stripped for TikTok' : 'No DV layer'} · {e.result.derived?.speed ? `${e.result.derived.speed}× timescale copy` : 'Stream copy'} · Pixels untouched
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="lib-note2">
        🔒 Uploaded videos auto-delete after 1 hour. This window stores lightweight metadata only on your own server.
      </p>
    </div>
  );
}
