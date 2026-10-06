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
      <div className="lib-counts">
        <div className="lib-c"><b>{tot.n}</b><span>Processed</span></div>
        <div className="lib-c"><b>{tot.done}</b><span>Completed</span></div>
        <div className="lib-c"><b>{tot.hdr}</b><span>HDR Clips</span></div>
        <div className="lib-c"><b>{tot.dv}</b><span>Dolby Vision</span></div>
        <div className="lib-c"><b>{fmtBytes(tot.bytes)}</b><span>Total Size</span></div>
        <button
          type="button"
          className="chip ghost"
          onClick={clear}
          disabled={!entries.length}
          title="Clear metadata log"
        >
          <TrashIcon width={14} height={14} />
          {clearing ? 'Confirm Clear?' : 'Clear History'}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="lib-filter">
          <SearchIcon width={16} height={16} />
          <input
            value={query}
            placeholder="Filter optimized videos by filename or mode…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="chip ghost" onClick={() => setQuery('')} style={{ padding: '2px 6px' }}>
              <CloseIcon width={12} height={12} />
            </button>
          )}
        </div>
      )}

      {!filtered.length ? (
        <p className="lib-empty">
          {loaded
            ? (entries.length ? 'No videos matching your filter.' : 'Your history is clean — every optimized video records its container specs here.')
            : 'Connecting to library…'}
        </p>
      ) : (
        <div className="lib-list">
          {filtered.map((e) => (
            <article className="lib-card" key={e.id + '-' + e.at}>
              <header>
                <b>{e.name}</b>
                <span className={'pill ' + (e.status === 'done' ? 'ok' : e.status === 'failed' ? 'no' : 'warn')}>
                  {e.status === 'done' ? <CheckIcon width={12} height={12} strokeWidth={2.8} /> : null}
                  {e.status}
                </span>
              </header>
              <div className="lib-meta">
                {new Date(e.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · Mode: {e.mode}
              </div>
              {e.error && <div className="lib-err">{e.error}</div>}
              <div className="lib-cols">
                <div>
                  <h4>Input Source</h4>
                  <ProbeTiles p={e.in} />
                </div>
                <div>
                  <h4>Output Container</h4>
                  {e.out ? <ProbeTiles p={e.out} /> : <span className="dim">—</span>}
                </div>
              </div>
              {e.result && (
                <div className="lib-note">
                  {e.result.hadDolbyVision ? '✨ Dolby Vision layer stripped for TikTok' : 'No DV layer'} · {e.result.derived?.speed ? `${e.result.derived.speed}× realtime copy` : 'Stream copy'} · Pixels untouched
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
