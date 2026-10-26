import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SectionHeader } from './primitives';

export const VideoComparison = () => {
  const [sliderPos, setSliderPos] = useState(50);
  const [demoBroken, setDemoBroken] = useState(false); // shipped demo clips failed to load → canvas fallback
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  const demoLowVideoRef = useRef(null);
  const demoHighVideoRef = useRef(null);

  const canvasLowRef = useRef(null);
  const canvasHighRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(0);
  const lastLowDrawTime = useRef(0);

  const attachHighVideo = useCallback((el) => {
    demoHighVideoRef.current = el;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.setAttribute('muted', '');
      if (el.readyState >= 2 && el.paused && !document.hidden) {
        el.play().catch(() => {});
      }
    }
  }, []);

  const attachLowVideo = useCallback((el) => {
    demoLowVideoRef.current = el;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.setAttribute('muted', '');
    }
  }, []);

  // Any user gesture lifts autoplay restrictions — ensure master starts/resumes
  useEffect(() => {
    const resume = () => {
      const hi = demoHighVideoRef.current;
      const lo = demoLowVideoRef.current;
      if (hi && hi.paused && hi.readyState >= 1) {
        hi.muted = true;
        hi.play().then(() => {
          if (lo) {
            lo.muted = true;
            lo.currentTime = hi.currentTime;
            lo.play().catch(() => {});
          }
        }).catch(() => {});
      }
    };
    document.addEventListener('touchstart', resume, { passive: true });
    document.addEventListener('pointerdown', resume, { passive: true });
    document.addEventListener('keydown', resume);
    window.addEventListener('scroll', resume, { passive: true });
    const handleVis = () => { if (!document.hidden) resume(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('touchstart', resume);
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
      window.removeEventListener('scroll', resume);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, []);

  const rafIdRef = useRef(0);
  const pendingXRef = useRef(null);

  // Shipped real footage demo: same source pixels, 60fps HDR master vs 30fps clamped SDR re-encode.
  const DEMO_HIGH_URL = '/media/portfolio/compare-master-60fps.mp4';
  const DEMO_LOW_URL = '/media/portfolio/compare-tiktok-30fps.mp4';
  const demoActive = !demoBroken;

  // Keep-alive: assert master video continues playing when page is active
  useEffect(() => {
    const assert = () => {
      if (document.hidden) return;
      const hi = demoHighVideoRef.current;
      if (hi && hi.paused && hi.readyState >= 2) {
        hi.muted = true;
        hi.play().catch(() => {});
      }
    };
    const t = setInterval(assert, 1200);
    return () => clearInterval(t);
  }, [demoActive]);

  // Master clock lockstep synchronization:
  // - High video is the master clock (60fps).
  // - Low video strictly mirrors High video playback state and time.
  // - Minor drift (0.02s - 0.25s) is compensated via smooth lo.playbackRate nudges (no decoder stalls).
  // - Large drift (> 0.25s, loop wrap, or user seek) snaps lo.currentTime.
  useEffect(() => {
    const hi = demoHighVideoRef.current;
    const lo = demoLowVideoRef.current;
    if (!hi || !lo) return;

    let rafId = 0;

    const syncFrames = () => {
      if (hi && lo && !hi.paused && !lo.paused) {
        const diff = hi.currentTime - lo.currentTime;
        // Minor drift: smoothly adjust follower playbackRate to avoid seeking micro-stutters
        if (Math.abs(diff) <= 0.02) {
          if (lo.playbackRate !== 1.0) lo.playbackRate = 1.0;
        } else if (diff > 0.02 && diff <= 0.25) {
          // lo is slightly behind -> gently accelerate lo
          lo.playbackRate = 1.08;
        } else if (diff < -0.02 && diff >= -0.25) {
          // lo is slightly ahead -> gently decelerate lo
          lo.playbackRate = 0.92;
        } else {
          // Significant drift (>250ms), seeking, or loop wrap -> hard snap
          lo.currentTime = hi.currentTime;
          lo.playbackRate = 1.0;
        }
      }
      rafId = requestAnimationFrame(syncFrames);
    };
    rafId = requestAnimationFrame(syncFrames);

    const onHiPlay = () => {
      if (lo) {
        if (Math.abs(hi.currentTime - lo.currentTime) > 0.2) {
          lo.currentTime = hi.currentTime;
        }
        lo.play().catch(() => {});
      }
    };

    const onHiPause = () => {
      if (lo && !lo.paused) {
        lo.pause();
      }
    };

    const onHiWaiting = () => {
      // Master is buffering/waiting -> follower pauses to remain frame-locked
      if (lo && !lo.paused) {
        lo.pause();
      }
    };

    const onHiPlaying = () => {
      if (lo) {
        if (Math.abs(hi.currentTime - lo.currentTime) > 0.15) {
          lo.currentTime = hi.currentTime;
        }
        if (lo.paused) {
          lo.play().catch(() => {});
        }
      }
    };

    const onHiSeeked = () => {
      if (lo) {
        lo.currentTime = hi.currentTime;
        lo.playbackRate = 1.0;
      }
    };

    const onHiCanPlay = () => {
      if (hi.paused && !document.hidden) {
        hi.play().then(() => {
          if (lo && lo.paused) lo.play().catch(() => {});
        }).catch(() => {});
      }
    };

    hi.addEventListener('play', onHiPlay);
    hi.addEventListener('pause', onHiPause);
    hi.addEventListener('waiting', onHiWaiting);
    hi.addEventListener('playing', onHiPlaying);
    hi.addEventListener('seeking', onHiSeeked);
    hi.addEventListener('seeked', onHiSeeked);
    hi.addEventListener('canplay', onHiCanPlay);

    // Initial check: if hi is already playing or ready
    if (!hi.paused && lo.paused) {
      lo.currentTime = hi.currentTime;
      lo.play().catch(() => {});
    } else if (hi.readyState >= 2 && hi.paused && !document.hidden) {
      hi.play().catch(() => {});
    }

    return () => {
      cancelAnimationFrame(rafId);
      hi.removeEventListener('play', onHiPlay);
      hi.removeEventListener('pause', onHiPause);
      hi.removeEventListener('waiting', onHiWaiting);
      hi.removeEventListener('playing', onHiPlaying);
      hi.removeEventListener('seeking', onHiSeeked);
      hi.removeEventListener('seeked', onHiSeeked);
      hi.removeEventListener('canplay', onHiCanPlay);
    };
  }, [demoActive]);

  const applySlider = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setSliderPos((x / rect.width) * 100);
  }, []);

  // Coalesce slider moves into one render per animation frame (buttery drag)
  const scheduleSlider = useCallback((clientX) => {
    pendingXRef.current = clientX;
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      if (pendingXRef.current !== null) {
        applySlider(pendingXRef.current);
        pendingXRef.current = null;
      }
    });
  }, [applySlider]);

  const handlePointerDown = (e) => {
    e.preventDefault(); // stop the browser hijacking the gesture for scrolling
    isDragging.current = true;
    try { containerRef.current?.setPointerCapture(e.pointerId); } catch { /* older engines */ }
    applySlider(e.clientX);
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (isDragging.current) scheduleSlider(e.clientX);
    };
    const handlePointerUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointerup', handlePointerUp);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [scheduleSlider]);

  useEffect(() => {
    let active = true;

    const render = (timestamp) => {
      if (!active) return;
      timeRef.current += 0.024;
      const t = timeRef.current;

      // 1. High Quality 60 FPS Fluid Canvas
      const cHigh = canvasHighRef.current;
      if (cHigh) {
        const ctx = cHigh.getContext('2d');
        const w = cHigh.width;
        const h = cHigh.height;

        ctx.fillStyle = '#07080a';
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        for (let x = 0; x < w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        const cx = w / 2;
        const cy = h / 2;
        for (let i = 0; i < 5; i++) {
          const r = 40 + i * 36;
          const angle = t * (i % 2 === 0 ? 1.4 : -1.4) + (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.arc(cx, cy, r, angle, angle + Math.PI * 1.3);
          ctx.strokeStyle = i === 2 ? '#38bdf8' : i === 4 ? '#22c55e' : '#f8fafc';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        const scanX = cx + Math.sin(t * 2.8) * (w * 0.38);
        const scanY = cy + Math.cos(t * 3.4) * (h * 0.28);
        ctx.beginPath();
        ctx.arc(scanX, scanY, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 2. Low Quality 30 FPS Clamped Stutter Canvas
      const cLow = canvasLowRef.current;
      if (cLow) {
        if (timestamp - lastLowDrawTime.current >= 33.3) {
          lastLowDrawTime.current = timestamp;
          const ctx = cLow.getContext('2d');
          const w = cLow.width;
          const h = cLow.height;

          ctx.fillStyle = '#101116';
          ctx.fillRect(0, 0, w, h);

          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          for (let x = 0; x < w; x += 48) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 48) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          const cx = w / 2;
          const cy = h / 2;
          for (let i = 0; i < 5; i++) {
            const r = 40 + i * 36;
            const angle = t * (i % 2 === 0 ? 1.4 : -1.4) + (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.arc(cx, cy, r, angle, angle + Math.PI * 1.3);
            ctx.strokeStyle = 'rgba(160, 165, 175, 0.4)';
            ctx.lineWidth = 4;
            ctx.stroke();
          }

          const scanX = cx + Math.sin(t * 2.8) * (w * 0.38);
          const scanY = cy + Math.cos(t * 3.4) * (h * 0.28);
          ctx.beginPath();
          ctx.arc(scanX, scanY, 18, 0, Math.PI * 2);
          ctx.fillStyle = '#64748b';
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Dynamic in-frame telemetry prominence based on wipe position:
  // - At midpoint (sliderPos = 50), both HUD tags show balanced (~0.85 opacity).
  // - Whichever clip is in majority reaches full 1.0 prominence.
  // - The minority clip gracefully dims and fades out to 0 before the wipe line reaches it.
  const tiktokOpacity = sliderPos >= 50
    ? Math.min(1, 0.85 + 0.15 * ((sliderPos - 50) / 20))
    : Math.max(0, 0.85 * ((sliderPos - 18) / 32));

  const obitoShare = 100 - sliderPos;
  const obitoOpacity = obitoShare >= 50
    ? Math.min(1, 0.85 + 0.15 * ((obitoShare - 50) / 20))
    : Math.max(0, 0.85 * ((obitoShare - 18) / 32));

  return (
    <section id="compare" className="section-hirael scroll-anchor bg-[hsl(var(--bg))]">
      <div className="container-hirael">
        <SectionHeader
          lead="The"
          accent="Comparison"
          subtext="Same frame, two pipelines. Left is TikTok's 720p 30fps clamped ingestion. Right is Obito Studio 4K 120fps master — bit-for-bit lossless."
          className="mb-6 sm:mb-10"
        />

        <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true, margin: '0px' }}
              className="mt-4 sm:mt-6"
            >
              {/* Labels — TIKTOK SERVING vs OBITO STUDIO PATCHED */}
              <div className="grid grid-cols-2 gap-4 mb-2.5 px-1">
                <span className="text-center font-clash inframe-title font-medium text-xs sm:text-[13.5px] tracking-[0.16em] text-white/80 uppercase">
                  TIKTOK SERVING
                </span>
                <span className="text-center font-clash inframe-title font-medium text-xs sm:text-[13.5px] tracking-[0.16em] text-white uppercase">
                  OBITO STUDIO PATCHED
                </span>
              </div>

              {/* Video — own frame, tiny curved bezel, nearly all of the space */}
              <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                className="relative w-full aspect-[16/9] rounded-xl bg-black border border-white/10 overflow-hidden cursor-ew-resize select-none touch-none shadow-2xl"
              >
                {/* Practical Studio OSD: 720P 30FPS (TikTok) */}
                <div
                  className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-30 pointer-events-none transition-opacity duration-150 ease-out"
                  style={{ opacity: tiktokOpacity }}
                >
                  <div className="rounded-md px-2 py-0.5 sm:px-2.5 sm:py-0.5 border border-white/20 bg-black/85 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]">
                    <span
                      className="font-clash inframe-title font-medium text-[9.5px] sm:text-[10.5px] tracking-[0.14em] uppercase text-white select-none"
                      style={{ textShadow: '0 1px 2px #000, 0 0 4px rgba(0,0,0,0.95)' }}
                    >
                      720P 30FPS
                    </span>
                  </div>
                </div>

                {/* Practical Studio OSD: 4K 120FPS (Obito) */}
                <div
                  className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-30 pointer-events-none transition-opacity duration-150 ease-out"
                  style={{ opacity: obitoOpacity }}
                >
                  <div className="rounded-md px-2 py-0.5 sm:px-2.5 sm:py-0.5 border border-white/20 bg-black/85 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]">
                    <span
                      className="font-clash inframe-title font-medium text-[9.5px] sm:text-[10.5px] tracking-[0.14em] uppercase text-white select-none"
                      style={{ textShadow: '0 1px 2px #000, 0 0 4px rgba(0,0,0,0.95)' }}
                    >
                      4K 120FPS
                    </span>
                  </div>
                </div>
            {/* High Quality Layer */}
            <div className="absolute inset-0 size-full">
              {!demoBroken ? (
                <video
                  ref={attachHighVideo}
                  src={DEMO_HIGH_URL}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="size-full object-cover"
                  onError={() => setDemoBroken(true)}
                  onCanPlay={() => {
                    const hi = demoHighVideoRef.current;
                    if (hi && hi.paused && !document.hidden) {
                      hi.play().catch(() => {});
                    }
                  }}
                />
              ) : (
                <canvas ref={canvasHighRef} width={1280} height={720} className="size-full object-cover" />
              )}
            </div>

            {/* Low Quality Clipped Layer */}
            <div
              className="absolute inset-0 size-full overflow-hidden"
              style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
            >
              {!demoBroken ? (
                <video
                  ref={attachLowVideo}
                  src={DEMO_LOW_URL}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="size-full object-cover"
                  onError={() => setDemoBroken(true)}
                />
              ) : (
                <canvas ref={canvasLowRef} width={1280} height={720} className="size-full object-cover" />
              )}
            </div>

            {/* Slider Wipe Handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_12px_rgba(255,255,255,0.7)] pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg font-bold text-xs select-none pointer-events-none">
                ↔
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </section>
  );
};
