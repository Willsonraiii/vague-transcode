import React from 'react';

/*
 * "How Obito Studio Works" — a pinned cinematic stage.
 * The section holds one frame at a time; scrolling advances the chapter.
 * One scroll, one scene: the current frame lifts away, the next rises in.
 * Everything shown is true of the shipped pipeline: moov-only reads,
 * -c copy, 19,200 timescale, dual AAC, HDR atoms preserved, zero re-encoded frames.
 */

const STAGES = [
  {
    n: '01',
    kind: 'ingest',
    kicker: 'Source',
    title: 'Master in',
    desc: 'Your editor export, exactly as rendered — 4K, 10-bit, HDR.',
    proof: '4.1 GB',
    proofLabel: 'source master',
  },
  {
    n: '02',
    kind: 'probe',
    kicker: 'Probe',
    title: 'Instant inspection',
    desc: 'Obito reads the master metadata instantly. Your heavy video file never touches cloud memory.',
    proof: '~150 KB',
    proofLabel: 'read into memory',
  },
  {
    n: '03',
    kind: 'surgery',
    kicker: 'Mastering',
    title: 'Lossless mastering',
    desc: 'Video packets are copied, not decoded. 60/120fps motion, HDR color, and dual audio survive intact.',
    proof: '0',
    proofLabel: 'frames re-encoded',
  },
  {
    n: '04',
    kind: 'delivery',
    kicker: 'Delivery',
    title: 'TikTok ready',
    desc: 'The master lands at 60 or 120 fps with its HDR grade untouched.',
    proof: '60 / 120',
    proofLabel: 'fps preserved',
  },
];

const PACKETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const WAVE = [
  18, 42, 30, 58, 36, 72, 48, 64, 28, 52, 80, 44, 26, 60, 38, 70,
  54, 32, 66, 46, 74, 40, 24, 56, 82, 50, 34, 62, 44, 76, 38, 58,
  30, 68, 48, 72, 36, 54, 26, 64, 42, 78, 50, 34, 60, 46, 70, 40,
];

function IngestVisual() {
  return (
    <div className="wf-visual wf-ingest">
      <div className="wf-file-block">
        <div className="wf-file-head">
          <span className="wf-file-name">master_60p_hlg.mov</span>
          <span className="wf-value">4.1 GB</span>
        </div>

        <div className="wf-spec">
          <span>3840 × 2160</span>
          <span>60.000 fps</span>
          <span>10-bit</span>
          <span>HLG · Rec.2020</span>
        </div>
      </div>

      <div className="wf-timeline">
        <div className="wf-wave" aria-hidden="true">
          {WAVE.map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>

        <div className="wf-scrub" aria-hidden="true">
          <span className="wf-scrub-fill" />
          <span className="wf-scrub-head" />
        </div>

        <div className="wf-foot-row">
          <span className="wf-mono">V1 · HEVC</span>
          <span className="wf-mono">A1 · A2 · AAC</span>
        </div>
      </div>
    </div>
  );
}

function ProbeVisual() {
  return (
    <div className="wf-visual wf-probe">
      <div className="wf-bytebar" aria-hidden="true">
        <span className="wf-byte wf-byte-ftyp" style={{ width: '7%' }} />
        <span className="wf-byte wf-byte-moov" style={{ width: '19%' }}>
          <span className="wf-scan" />
        </span>
        <span className="wf-byte wf-byte-mdat" style={{ width: '74%' }} />
      </div>

      <div className="wf-legend">
        <span><i className="wf-dot wf-dot-ftyp" />ftyp</span>
        <span><i className="wf-dot wf-dot-moov" />moov</span>
        <span><i className="wf-dot wf-dot-mdat" />mdat</span>
      </div>

      <div className="wf-readout">
        <span className="wf-label">Header read</span>
        <span className="wf-value wf-value--hi">~150 KB</span>
      </div>
      <div className="wf-readout">
        <span className="wf-label">Peak memory</span>
        <span className="wf-value">under 15 MB</span>
      </div>
      <div className="wf-readout">
        <span className="wf-label">Payload</span>
        <span className="wf-value">streamed disk → disk</span>
      </div>
    </div>
  );
}

function SurgeryVisual() {
  return (
    <div className="wf-visual wf-surgery">
      <div className="wf-lanes" aria-hidden="true">
        {['V1', 'A1', 'A2'].map((label, lane) => (
          <div className="wf-lane" key={label}>
            <span className="wf-mono wf-lane-label">{label}</span>
            <span className="wf-packets">
              {PACKETS.map((i) => (
                <i key={i} style={{ '--i': i, '--lane': lane }} />
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="wf-copy">
        <span className="wf-code">Lossless Stream</span>
        <span className="wf-value">60 / 120 FPS Fluid</span>
      </div>

      <div className="wf-readout">
        <span className="wf-label">Color profile</span>
        <span className="wf-value wf-value--hi">HLG · PQ preserved</span>
      </div>
      <div className="wf-readout">
        <span className="wf-label">Audio</span>
        <span className="wf-value">2 AAC tracks kept</span>
      </div>
    </div>
  );
}

function DeliveryVisual() {
  return (
    <div className="wf-visual wf-delivery">
      <div className="wf-phone" aria-hidden="true">
        <div className="wf-phone-screen">
          <span className="wf-phone-play" />
          <span className="wf-phone-bar" />
        </div>
      </div>

      <div className="wf-recv">
        <div className="wf-readout">
          <span className="wf-label">Cadence</span>
          <span className="wf-value wf-value--hi">60.000 fps</span>
        </div>
        <div className="wf-readout">
          <span className="wf-label">Color</span>
          <span className="wf-value wf-value--hi">HLG · PQ</span>
        </div>
        <div className="wf-readout">
          <span className="wf-label">Status</span>
          <span className="wf-value wf-value--ok">Master ready</span>
        </div>
      </div>
    </div>
  );
}

const VISUALS = {
  ingest: IngestVisual,
  probe: ProbeVisual,
  surgery: SurgeryVisual,
  delivery: DeliveryVisual,
};

function Frame({ stage }) {
  const Visual = VISUALS[stage.kind];
  return (
    <article className="wf-frame liquid-glass-frame">
      <div className="wf-frame-inner">
        <div className="wf-frame-copy">
          <div className="wf-kicker">
            <span className="wf-kicker-num">{stage.n}</span>
          </div>

          <h3 className="wf-frame-title">{stage.title}</h3>
          <p className="wf-frame-desc">{stage.desc}</p>

          <div className="wf-proof">
            <span className="wf-proof-value">{stage.proof}</span>
            <span className="wf-proof-label">{stage.proofLabel}</span>
          </div>
        </div>

        <div className="wf-monitor">
          <Visual />
        </div>
      </div>
    </article>
  );
}

export default function WorkflowSignalPath() {
  const sectionRef = React.useRef(null);
  const stickyRef = React.useRef(null);
  const fillRef = React.useRef(null);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return undefined;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const stickyTop = parseFloat(window.getComputedStyle(sticky).top) || 0;
      const travel = Math.max(1, section.offsetHeight - sticky.offsetHeight);
      const progress = Math.min(1, Math.max(0, (stickyTop - rect.top) / travel));
      const next = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));

      setActive((prev) => (prev === next ? prev : next));
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      className="wf-cinema"
      style={{ '--wf-steps': STAGES.length }}
    >
      <div ref={stickyRef} className="wf-cinema-sticky">
        <div className="wf-stage-area">
          {STAGES.map((stage, index) => {
            const state = index === active
              ? 'is-active'
              : index < active
                ? 'is-before'
                : 'is-after';
            return (
              <div className={`wf-scene ${state}`} key={stage.n}>
                <Frame stage={stage} />
              </div>
            );
          })}
        </div>

        <div className="wf-cinema-rail" aria-hidden="true">
          <div className="wf-cinema-track">
            <span ref={fillRef} />
          </div>
          <div className="wf-cinema-labels">
            {STAGES.map((stage, index) => (
              <span
                key={stage.n}
                className={`wf-cinema-label ${index === active ? 'is-active' : ''}`}
              >
                <b>{stage.n}</b>
                {stage.kicker}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
