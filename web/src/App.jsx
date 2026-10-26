import { useCallback, useEffect, useRef, useState } from 'react';
import PortfolioView from './portfolio/PortfolioView.jsx';
import Logo from './Logo.jsx';
import Optimizer, { BotStage } from './Optimizer.jsx';
import { ThinkingOrb } from 'thinking-orbs';
import Inspector from './Inspector.jsx';
import Dashboard from './Dashboard.jsx';
import AdminPassesModal from './AdminPassesModal.jsx';
import { ShaderAnimation } from '@/components/ui/shader-animation';
import Guide from './Guide.jsx';
import {
  ChevronIcon, FpsIcon, HdrIcon, HelpIcon,
  InspectIcon, LayersIcon, LightningIcon, ShieldIcon, FilmIcon,
  PremiumKeyIcon, UserIcon, LogoutIcon, ChevronDownIcon, BookOpenIcon, DashboardIcon
} from './icons.jsx';
import { ShutterText } from '@/components/ui/hero-shutter-text.jsx';
import { AnimatedText } from '@/components/ui/animated-text.jsx';
import { CreatorReviewModal } from './components/CreatorReviewModal.jsx';
import { UpdateBanner } from './components/UpdateBanner.jsx';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'guide', label: 'Guide', Icon: BookOpenIcon },
  { id: 'optimizer', label: 'Optimizer', Icon: LightningIcon },
  { id: 'inspect', label: 'Inspector', Icon: InspectIcon },
  { id: 'specs', label: 'Specs & FAQ', Icon: LayersIcon },
];

/* ---------- Technical Architecture Content ---------- */
const ARCH_PILLARS = [
  {
    Icon: FpsIcon,
    title: '60fps & 120fps Motion Fluidity',
    subtitle: 'High-Framerate Cadence Lock',
    desc: 'Standard transcoders downsample smooth high-framerate footage to choppy 30fps. Obito Studio locks in 60fps and 120fps cadence so your videos render with silky-smooth ProMotion fluidity on TikTok.'
  },
  {
    Icon: LayersIcon,
    title: 'Zero Generational Loss',
    subtitle: 'Bit-for-Bit 4K Master Preservation',
    desc: 'Standard transcoders re-compress footage with lossy encoders, destroying fine textures and crisp lines. Obito Studio never recompresses video or audio packets, preserving 100% of your 4K master bitrate (recommended 20–35 Mbps) and clarity.'
  },
  {
    Icon: HdrIcon,
    title: 'Native 4K Apple HDR Preservation',
    subtitle: 'Full Dynamic Range · Rec.2020 HLG',
    desc: 'iPhone and cinema HDR videos often become washed-out or blown-out on TikTok. Obito Studio translates HDR color primaries into native HLG so peak highlights, deep contrast, and vibrant colors survive.'
  },
  {
    Icon: ShieldIcon,
    title: 'Self-Hosted Sovereign Security',
    subtitle: 'Zero Cloud Storage · Immediate Purge',
    desc: 'Your creative masters never leave your private machine or network. Temporary container remuxing operates in-memory or on local NVMe, and files are automatically purged immediately after download or within one hour of inactivity.'
  }
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    name: 'Master Video Selection',
    detail: 'Import any MP4 or MOV master up to 600 MB (recommended bitrate: 20–35 Mbps). Instant on-device analysis verifies 4K resolution, 60fps/120fps frame-rate, and native Apple HDR metadata.'
  },
  {
    step: '02',
    name: 'Lossless Studio Remuxing',
    detail: 'Resumable chunked ingestion streams to your studio engine. The lossless pipeline locks 4K clarity, interleaves dual audio, and guarantees 60fps & 120fps recognition.'
  },
  {
    step: '03',
    name: 'Publish via TikTok Studio',
    detail: 'Download the verified master MP4 and publish directly through TikTok Studio (Desktop or Web). TikTok acknowledges the native high-framerate container and delivers full 60fps & HDR playback.'
  }
];

const FAQ_ITEMS = [
  [
    'Does Obito Studio re-encode or compress my footage?',
    'Never. Obito Studio strictly executes lossless stream copying. Video and audio remain bit-for-bit identical to your export master. Zero generational degradation occurs.'
  ],
  [
    'Does Obito work with iPhone HDR and Dolby Vision?',
    'Yes. iPhone Dolby Vision Profile 8.4 metadata is converted to native HLG Rec.2020, so HDR playback survives the TikTok upload.'
  ],
  [
    'Can I download the file and post it myself?',
    'Yes. Download the optimized master and upload it through tiktok.com/upload or the Files app. Official 1-click in-app TikTok posting is currently in developer review with TikTok and launching in a couple of days.'
  ],
  [
    'When will Official 1-Click TikTok Direct Posting launch?',
    'Our direct integration with TikTok\'s Content Posting API is fully developed and currently undergoing final review with the TikTok Developer Team. It will launch globally in a couple of days once developer clearance completes.'
  ],
  [
    'What happens if my connection drops during upload?',
    'Uploads are chunked and completely resumable. Received data chunks remain safely cached on your server for up to one hour. Re-selecting the file or tapping Resume continues instantly without restarting.'
  ],
  [
    'Why do some local video players display 00:00 duration?',
    'The master contains specialized dual-audio sync engineered specifically for TikTok\'s high-framerate ingestion pipeline. Some legacy desktop media players show 00:00, but TikTok\'s mobile app and TikTok Studio parse and play it with 100% precision.'
  ],
  [
    'What are the supported file sizes and formats?',
    'MP4 and MOV video files up to 600 MB. 4K, 60 fps, and 120 fps portrait (9:16) and landscape masters are fully supported. Recommended export bitrate: 20–35 Mbps (HEVC/H.265) for ideal visual clarity.'
  ],
  [
    'Are my video files stored on remote servers?',
    'No. Obito Studio operates on your self-hosted instance. Files are never sent to third-party cloud services and are deleted automatically as soon as you download the result.'
  ]
];

const HERO_MESSAGES = [
  {
    title: 'TIKTOK LOSSLESS MASTER',
    sub: 'Preserve native high FPS (60fps, 120fps+) & HDR with zero TikTok compression.'
  },
  {
    title: '60FPS NATIVE FLUIDITY',
    sub: 'Never let TikTok downgrade your high frame-rate mobile edits to 30fps.'
  },
  {
    title: '100% BIT-FOR-BIT LOSSLESS',
    sub: 'Pure stream-copy remuxing — video packets and audio streams stay untouched.'
  },
  {
    title: 'APPLE HDR & DOLBY VISION',
    sub: 'Original 10-bit color gamut intact for crystal-clear smartphone playback.'
  },
  {
    title: 'PRO HARDWARE REMUX',
    sub: 'Engineered container architecture for native high frame-rate mobile playback.'
  }
];

const CURRENT_UPDATE_VER = 'v3.1.0-zero-buffering';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.slice(1);
      if (['home', 'optimizer', 'compare', 'inspect', 'dashboard', 'guide', 'specs', 'faq', 'admin'].includes(h)) {
        return h;
      }
    }
    return 'home';
  });

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.slice(1);
      if (['home', 'optimizer', 'compare', 'inspect', 'dashboard', 'guide', 'specs', 'faq', 'admin'].includes(h)) {
        setActiveTab(h);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [apiKey, setApiKey] = useState(() => lsGet('obitoKey') || '');
  const [busy, setBusy] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const dismissUpdateModal = useCallback(() => {
    setShowUpdateModal(false);
    try {
      lsSet('vague_update_seen_ver', CURRENT_UPDATE_VER);
    } catch {}
  }, []);

  // Owner sign-in uses the site's existing server access code.
  const memberPreview = true;
  const [ownerAuthenticated, setOwnerAuthenticated] = useState(false);
  const [isMasterOwner, setIsMasterOwner] = useState(false);
  const [currentUserName, setCurrentUserName] = useState(() => lsGet('obitoUserName') || '');
  const [userTier, setUserTier] = useState(() => lsGet('obitoUserTier') || '');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberModalMode, setMemberModalMode] = useState('login'); // 'login' | 'referral' | 'referral_success'
  const [demoClientId, setDemoClientId] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralNameInput, setReferralNameInput] = useState('');
  const [referralRedeemedCreds, setReferralRedeemedCreds] = useState(null);
  const [referralError, setReferralError] = useState('');
  const [redeemingRef, setRedeemingRef] = useState(false);
  const [focusedMemberField, setFocusedMemberField] = useState(null);
  const memberOrbState = !demoClientId.trim() && !demoCode.trim()
    ? 'breathing' // The package's calm idle state; it does not provide a "thinking" state.
    : demoClientId.trim() && demoCode.trim()
    ? 'solving' // Both fields completed; real credential validity is not checked in this UI preview.
    : focusedMemberField === 'code' ? 'searching' : 'working';
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [now, setNow] = useState(() => new Date());
  const [heroMsgIndex, setHeroMsgIndex] = useState(0);
  const [brandKey, setBrandKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroMsgIndex((prev) => (prev + 1) % HERO_MESSAGES.length);
    }, 4800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const onKeyChange = useCallback((v, userName = '', tier = '') => {
    setApiKey(v);
    lsSet('obitoKey', v);
    if (userName) {
      setCurrentUserName(userName);
      lsSet('obitoUserName', userName);
    } else if (!v) {
      setCurrentUserName('');
      lsSet('obitoUserName', '');
    }
    if (tier) {
      setUserTier(tier);
      lsSet('obitoUserTier', tier);
    } else if (!v) {
      setUserTier('free');
      lsSet('obitoUserTier', 'free');
    }
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setOwnerAuthenticated(false);
      setIsMasterOwner(false);
      setUserTier('free');
      setAuthChecking(false);
      return;
    }
    const controller = new AbortController();
    setAuthChecking(true);
    fetch('/api/auth/owner', { headers: { 'x-access-token': apiKey }, signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          const ok = data && data.ok === true;
          setOwnerAuthenticated(ok);
          setIsMasterOwner(Boolean(data?.isOwner));
          if (ok) {
            const detectedTier = data?.isOwner ? 'paid' : (data?.tier || lsGet('obitoUserTier') || 'paid');
            setUserTier(detectedTier);
            lsSet('obitoUserTier', detectedTier);
          } else {
            setUserTier('free');
          }
          if (data?.name || data?.clientId) {
            const displayName = data.name || data.clientId;
            setCurrentUserName(displayName);
            lsSet('obitoUserName', displayName);
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setOwnerAuthenticated(false);
          setIsMasterOwner(false);
          setUserTier('free');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setAuthChecking(false); });
    return () => controller.abort();
  }, [apiKey]);

  const signInOwner = async (e) => {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setLoginError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId: demoClientId.trim(), accessCode: demoCode.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setLoginError(data.error || 'Client ID or access code is incorrect.');
        return;
      }
      const displayName = data.name || data.clientId || demoClientId.trim();
      const detectedTier = data.isOwner ? 'paid' : (data.tier || (data.clientId?.startsWith('cli_') ? 'redeemed' : 'paid'));
      setUserTier(detectedTier);
      lsSet('obitoUserTier', detectedTier);
      onKeyChange(demoCode.trim(), displayName, detectedTier);
      setOwnerAuthenticated(true);
      setIsMasterOwner(Boolean(data.isOwner));
      setDemoCode('');
      setDemoClientId('');
      setShowMemberModal(false);
    } catch {
      setLoginError('Could not reach the server. Try again.');
    }
  };

  const redeemReferral = async (e) => {
    e.preventDefault();
    setReferralError('');
    if (!referralCodeInput.trim()) return;
    try {
      setRedeemingRef(true);
      const res = await fetch('/api/auth/redeem-referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          referralCode: referralCodeInput.trim(),
          name: referralNameInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to redeem referral code');
      setReferralRedeemedCreds(data);
      setUserTier('redeemed');
      lsSet('obitoUserTier', 'redeemed');
      setMemberModalMode('referral_success');
    } catch (err) {
      setReferralError(err.message || 'Could not redeem referral code.');
    } finally {
      setRedeemingRef(false);
    }
  };

  // 3D perspective mouse tracking over topbar
  const onTopbarMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setTilt({
      x: Math.max(-1, Math.min(1, dx)),
      y: Math.max(-1, Math.min(1, dy))
    });
  };

  const onTopbarLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Ref to the dock container and active pill slider
  const dockBarRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, ready: false });
  const [dragOffset, setDragOffset] = useState(0);

  // Measure and align sliding glass pill indicator
  const [hoveredTab, setHoveredTab] = useState(null);

  // Measure and align sliding glass pill indicator
  const updatePill = useCallback(() => {
    if (!dockBarRef.current) return;
    const targetTab = hoveredTab || activeTab;
    const activeBtn = dockBarRef.current.querySelector(`.ios-dock-item[data-tab-id="${targetTab}"]`);
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        ready: true,
        dragging: !!hoveredTab
      });
    }
  }, [activeTab, hoveredTab]);

  useEffect(() => {
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  const suppressClickRef = useRef(false);

  const switchTabWithHaptic = useCallback((tabId) => {
    setActiveTab((prev) => {
      if (prev !== tabId) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(12); } catch {}
        try {
          if (window.location.hash.slice(1) !== tabId) {
            window.history.pushState(null, '', `#${tabId}`);
          }
        } catch {}
        return tabId;
      }
      return prev;
    });
  }, []);

  const onDockTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      const t = e.touches[0];
      if (dockBarRef.current) {
        const rect = dockBarRef.current.getBoundingClientRect();
        const clientX = t.clientX;
        const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setDragOffset(relativeX);

        // Map touch position directly to tab index across all tabs
        const tabWidth = rect.width / TABS.length;
        const tabIdx = Math.max(0, Math.min(Math.floor(relativeX / tabWidth), TABS.length - 1));
        const targetTab = TABS[tabIdx]?.id;
        if (targetTab) {
          setHoveredTab(targetTab);
        }
      }
    }
  };

  const onDockTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0];
    if (dockBarRef.current) {
      const rect = dockBarRef.current.getBoundingClientRect();
      const clientX = t.clientX;
      const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setDragOffset(relativeX);

      // Freely track which tab the finger is over along the entire width (1st to 6th)
      const tabWidth = rect.width / TABS.length;
      const tabIdx = Math.max(0, Math.min(Math.floor(relativeX / tabWidth), TABS.length - 1));
      const targetTab = TABS[tabIdx]?.id;
      if (targetTab && targetTab !== hoveredTab) {
        setHoveredTab(targetTab);
        if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(8); } catch {}
      }
    }
  };

  const onDockTouchEnd = (e) => {
    // Commit the hovered tab directly when releasing anywhere on the dock bar
    if (hoveredTab) {
      switchTabWithHaptic(hoveredTab);
      suppressClickRef.current = true;
      setTimeout(() => suppressClickRef.current = false, 300);
    }
    setHoveredTab(null);
    setDragOffset(0);
  };

  const dayStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="relative min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text))]">
      <PortfolioView
        activeTab={activeTab}
        onSwitchTab={switchTabWithHaptic}
        apiKey={apiKey}
        onKeyChange={onKeyChange}
        busy={busy}
        setBusy={setBusy}
        memberPreview={memberPreview}
        authChecking={authChecking}
        ownerAuthenticated={ownerAuthenticated}
        currentUserName={currentUserName}
        userName={currentUserName || (ownerAuthenticated ? (isMasterOwner ? 'Owner' : 'Member') : 'Guest')}
        userTier={ownerAuthenticated ? (userTier || 'paid') : 'free'}
        isMasterOwner={isMasterOwner}
        onOpenSignIn={() => setShowMemberModal(true)}
        onOpenAdmin={() => switchTabWithHaptic('admin')}
        onOpenReview={() => setShowReviewModal(true)}
        onSignOut={() => {
          onKeyChange("", "", "free");
          setUserTier("free");
          lsSet("obitoUserTier", "free");
          setOwnerAuthenticated(false);
          setIsMasterOwner(false);
          setActiveTab("home");
        }}
        archPillars={ARCH_PILLARS}
        workflowSteps={WORKFLOW_STEPS}
        faqItems={FAQ_ITEMS}
      />

      {/* Admin Passes Management Modal */}
      {showAdminModal && (
        <AdminPassesModal apiKey={apiKey || lsGet("obitoKey") || ""} onClose={() => setShowAdminModal(false)} />
      )}

      {/* Access Key Popover Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={() => setShowKeyModal(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-neutral-950/95 p-6 sm:p-8 shadow-2xl text-white backdrop-blur-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-base">Server Access Token</span>
              <button type="button" className="text-white/60 hover:text-white" onClick={() => setShowKeyModal(false)}>✕</button>
            </div>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              If your self-hosted Obito Studio instance requires authentication, enter your access token here.
            </p>
            <input
              type="password"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none transition-colors mb-4"
              placeholder="Enter server access token"
              value={apiKey}
              onChange={(e) => onKeyChange(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end">
              <button type="button" className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors" onClick={() => setShowKeyModal(false)}>
                Save Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Engine Update Announcement Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={dismissUpdateModal}>
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-950/95 p-6 sm:p-8 shadow-2xl text-white backdrop-blur-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">Live Update Deployed</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white font-mono font-semibold">v3.1.0</span>
              </div>
              <button type="button" className="text-white/60 hover:text-white" onClick={dismissUpdateModal}>✕</button>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Zero-Buffering Engine &amp; Ingestion Hardening</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              A major platform update has been deployed to eliminate TikTok CDN buffering underruns and ingestion stalls.
            </p>

            <div className="space-y-2.5 mb-6">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <LightningIcon width={16} height={16} className="text-white/70 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Lossless 1:1 Packet Interleaving</div>
                  <div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                    Audio and video packets are positioned tightly adjacent (~6 bytes apart) to stop all HTTP Range CDN playback starvation stalls.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <ShieldIcon width={16} height={16} className="text-white/70 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Clean Lossless Stream Packaging</div>
                  <div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                    Data streams are cleanly structured with zero orphaned bytes, permanently fixing the &ldquo;Post is processing forever&rdquo; hang.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <FilmIcon width={16} height={16} className="text-white/70 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">100% Native 4K 60fps &amp; 10-bit HLG HDR</div>
                  <div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                    Lossless video mastering with zero frame re-encoding. 100% master bitrate, fluid 60fps cadence, and BT.2020 dynamic range preserved.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-[10px] text-neutral-500">Shown once per update</span>
              <button
                type="button"
                className="rounded-full bg-white px-6 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
                onClick={dismissUpdateModal}
              >
                Got it, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Member Sign-In & Referral Modal */}
      {showMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={() => setShowMemberModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-white/15 bg-neutral-950/95 p-6 sm:p-8 shadow-2xl text-white backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-5 top-5 size-8 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setShowMemberModal(false)}
              aria-label="Close modal"
            >
              ✕
            </button>

            {memberModalMode === "referral" ? (
              <div>
                <div className="flex justify-center mb-4">
                  <ThinkingOrb state={redeemingRef ? "working" : "searching"} size={64} theme="dark" />
                </div>
                <h3 className="text-xl sm:text-2xl font-clash font-bold text-center text-white mb-1">
                  Redeem Referral Code
                </h3>
                <p className="text-xs text-neutral-400 text-center mb-6">
                  Enter the invite or referral code you received.
                </p>
                <form onSubmit={redeemReferral} className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1.5 font-medium">Referral / Invite Code</label>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="e.g. OBITO-VIP or VIP-CODE"
                      value={referralCodeInput}
                      onChange={(e) => { setReferralCodeInput(e.target.value); setReferralError(""); }}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1.5 font-medium">Your Name / Handle (Optional)</label>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="e.g. Alex"
                      value={referralNameInput}
                      onChange={(e) => setReferralNameInput(e.target.value)}
                    />
                  </div>
                  {referralError && <p className="text-xs text-rose-400 text-center">{referralError}</p>}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      disabled={redeemingRef}
                      className="flex-1 rounded-full bg-white py-2.5 text-xs sm:text-sm font-semibold text-black hover:bg-neutral-200 transition-colors shadow-lg disabled:opacity-50"
                    >
                      {redeemingRef ? "Activating…" : "Redeem Pass →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMemberModalMode("login"); setReferralError(""); }}
                      className="rounded-full border border-white/15 px-4 py-2.5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </div>
            ) : memberModalMode === "referral_success" && referralRedeemedCreds ? (
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <ThinkingOrb state="solving" size={64} theme="dark" />
                </div>
                <h3 className="text-xl sm:text-2xl font-clash font-bold text-white mb-1">
                  Pass Activated
                </h3>
                <p className="text-xs text-neutral-400 mb-6">
                  Your client credentials have been generated.
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Client ID:</span>
                    <span className="font-mono text-white font-medium">{referralRedeemedCreds.clientId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Access Code:</span>
                    <span className="font-mono text-emerald-400 font-bold">{referralRedeemedCreds.accessCode}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-full bg-white py-3 text-xs sm:text-sm font-semibold text-black hover:bg-neutral-200 transition-colors shadow-xl"
                  onClick={() => {
                    const displayName = referralRedeemedCreds.name || referralRedeemedCreds.clientId;
                    setUserTier('redeemed');
                    lsSet('obitoUserTier', 'redeemed');
                    onKeyChange(referralRedeemedCreds.accessCode, displayName, 'redeemed');
                    setOwnerAuthenticated(true);
                    setShowMemberModal(false);
                    setMemberModalMode("login");
                    setReferralRedeemedCreds(null);
                  }}
                >
                  Enter Studio &amp; Save Pass →
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-center mb-4">
                  <ThinkingOrb state={memberOrbState} size={64} theme="dark" />
                </div>
                <h3 className="text-xl sm:text-2xl font-clash font-bold text-center text-white mb-1">
                  Sign in to Obito Studio
                </h3>
                <p className="text-xs text-neutral-400 text-center mb-6">
                  Enter your personal Client ID &amp; Access code.
                </p>
                <form onSubmit={signInOwner} className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1.5 font-medium">
                      Client ID <span className="text-[10px] text-neutral-500">(Optional for Master Owner)</span>
                    </label>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="e.g. owner or user_xxxxx"
                      autoComplete="off"
                      value={demoClientId}
                      onFocus={() => setFocusedMemberField("id")}
                      onBlur={() => setFocusedMemberField(null)}
                      onChange={(e) => setDemoClientId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1.5 font-medium">Access Code</label>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="Your access code or server token"
                      autoComplete="off"
                      value={demoCode}
                      onFocus={() => setFocusedMemberField("code")}
                      onBlur={() => setFocusedMemberField(null)}
                      onChange={(e) => setDemoCode(e.target.value)}
                      required
                    />
                  </div>
                  {loginError && <p className="text-xs text-rose-400 text-center">{loginError}</p>}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-white py-2.5 text-xs sm:text-sm font-semibold text-black hover:bg-neutral-200 transition-colors shadow-lg"
                    >
                      Continue →
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMemberModal(false); setDemoCode(""); }}
                      className="rounded-full border border-white/15 px-4 py-2.5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="pt-3 border-t border-white/10 space-y-2 text-center text-xs">
                    <div>
                      <button
                        type="button"
                        onClick={() => { setMemberModalMode("referral"); setReferralError(""); }}
                        className="text-neutral-400 hover:text-white underline underline-offset-4 decoration-white/20 transition-colors"
                      >
                        Have a referral or invite code? Redeem pass →
                      </button>
                    </div>
                    <div>
                      <a
                        href="https://wa.me/9779813952103?text=Hi%2C%20I%20would%20like%20to%20request%20an%20access%20code%20for%20Obito%20Studio."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        Don&rsquo;t have a code? Request access via WhatsApp ↗
                      </a>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Creator Satisfaction Review Modal */}
      <CreatorReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        currentUserName={currentUserName}
        apiKey={apiKey}
      />

      {/* Post-Update Premium Banner for Signed Users */}
      <UpdateBanner
        isSignedUser={Boolean(ownerAuthenticated || (userTier && userTier !== 'free') || apiKey)}
        onSwitchTab={switchTabWithHaptic}
      />
    </div>
  );
}