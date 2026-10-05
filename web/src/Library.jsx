import { useCallback, useEffect, useRef, useState } from 'react';

const fmtBytes = (n) => {
  if (!n) return '—';
  if (n > 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB';
  return (n / 1024 ** 2).toFixed(1) + ' MB';
};
const fmtDur = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : '—');
const hdr = (t) => (!t || t === 'unknown' || t === 'sdr' ? 'SDR' : t === 'smpte2084' ? 'HDR10' : String(t).toUpperCase());

export default function Library({ apiKey }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const keyRef = useRef(apiKey);
  keyRef.current = apiKey;
  const headers = useCallback(() => (keyRef.current ? { 'x-access-token': keyRef.current } : {}), []);
  const withKey = useCallback((url) => (keyRef.current ? url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(keyRef.current) : url), []);

  const load = useCallback(() => {
    fetch(withKey('/api/library'), { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setEntries(j.entries || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [withKey, headers]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const clear = async () => {
    await fetch(withKey('/api/library/clear'), { method: 'POST', headers: headers() }).catch(() => {});
    setEntries([]);
  };

  const tot = entries.reduce((a, e) => {
    a.n += 1;
    if (e.status === 'done') a.done += 1;
    if (e.in && e.in.transfer && e.in.transfer !== 'sdr' && e.in.transfer !== 'unknown') a.hdr += 1;
    if (e.in && e.in.dv) a.dv += 1;
    a.bytes += (e.in && e.in.size) || 0;
    return a;
  }, { n: 0, done: 0, hdr: 0, dv: 0, bytes: 0 });

  return (
    <div className="library">
      <div className="lib-counts">
        <div className="lib-c"><b>{tot.n}</b><span>processed</span></div>
        <div className="lib-c"><b>{tot.done}</b><span>finished</span></div>
        <div className="lib-c"><b>{tot.hdr}</b><span>HDR in</span></div>
        <div className="lib-c"><b>{tot.dv}</b><span>DV seen</span></div>
        <div className="lib-c"><b>{fmtBytes(tot.bytes)}</b><span>inspected</span></div>
        <button type="button" className="chip ghost" onClick={clear} disabled={!entries.length}>Clear history</button>
      </div>

      {!entries.length ? (
        <p className="lib-empty">{loaded ? 'Nothing here yet — every optimized video lands in this window with its full identity.' : 'Opening the shelf…'}</p>
      ) : (
        <div className="lib-list">
          {entries.map((e) => (
            <article className="lib-card" key={e.id + '-' + e.at}>
              <header>
                <b>{e.name}</b>
                <span className={'pill ' + e.status}>{e.status}</span>
              </header>
              <div className="lib-meta">{new Date(e.at).toLocaleString()} · mode {e.mode}</div>
              {e.error && <div className="lib-err">{e.error}</div>}
              <div className="lib-cols">
                <div>
                  <h4>Source</h4>
                  <Probe p={e.in} />
                </div>
                <div>
                  <h4>Output</h4>
                  {e.out ? <Probe p={e.out} /> : <span className="dim">—</span>}
                </div>
              </div>
              {e.result && (
                <div className="lib-note">
                  {e.result.hadDolbyVision ? 'Dolby Vision layer stripped for TikTok' : 'no DV layer found'} · {e.result.derived?.speed ? e.result.derived.speed + '× realtime' : 'stream copy'} · pixels untouched
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="lib-note2">Videos auto-delete after 1 hour · this shelf keeps metadata only, on your server.</p>
    </div>
  );
}

function Probe({ p }) {
  if (!p) return <span className="dim">not probed</span>;
  return (
    <div className="lib-tiles">
      <span>{p.w}×{p.h}</span>
      <span>{p.fps} fps{p.ts ? ` (1/${p.ts})` : ''}</span>
      <span>{(p.codec || '').toUpperCase()}</span>
      <span>{hdr(p.transfer)}</span>
      {p.dv ? <span className="hi">DV p{p.dv}</span> : null}
      <span>{p.audio} audio</span>
      <span>{fmtDur(p.dur)}</span>
      <span>{fmtBytes(p.size)}</span>
    </div>
  );
}
