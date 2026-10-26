import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckIcon, TrashIcon, TikTokIcon,
  UserIcon, ShieldIcon
} from './icons.jsx';

const scrollBlurCard = {
  initial: { opacity: 0.2, filter: 'blur(10px)', y: 24 },
  whileInView: { opacity: 1, filter: 'blur(0px)', y: 0 },
  viewport: { once: false, amount: 0.15, margin: "-10px 0px -40px 0px" },
  transition: { duration: 0.52, ease: [0.16, 1, 0.3, 1] }
};

const scrollBlurButton = {
  initial: { opacity: 0.25, filter: 'blur(8px)', y: 14 },
  whileInView: { opacity: 1, filter: 'blur(0px)', y: 0 },
  viewport: { once: false, amount: 0.2 },
  transition: { duration: 0.44, ease: [0.16, 1, 0.3, 1] }
};

export default function Dashboard({
  onSwitchTab,
  apiKey,
  onKeyChange,
  onSignOut,
  userName = 'Guest',
  userTier = 'free',
  ownerAuthenticated = false,
  isMasterOwner = false,
  onOpenSignIn,
}) {
  // ---------- Connected accounts (TikTok) ----------
  const [tt, setTt] = useState(null);      // /api/tiktok/me payload
  const [ttBusy, setTtBusy] = useState(false);
  const [ttErr, setTtErr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [keepNotice, setKeepNotice] = useState(false);
  const ttPopup = useRef(null);

  // ---------- Personal Optimization History & Pipelines ----------
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({ total: 0, favoritePipeline: 'HDR Rec.2020 / HLG' });
  const [loadingHistory, setLoadingHistory] = useState(true);

  const ttHeaders = useCallback(
    () => ({ 'content-type': 'application/json', ...(apiKey ? { 'x-access-token': apiKey } : {}) }),
    [apiKey]
  );

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/user/optimizations', { headers: ttHeaders() });
      if (!r.ok) return;
      const j = await r.json();
      if (j.ok) {
        setHistory(j.items || []);
        if (j.userStats) setHistoryStats(j.userStats);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingHistory(false);
    }
  }, [ttHeaders]);

  const loadTikTok = useCallback(async () => {
    try {
      const r = await fetch('/api/tiktok/me', { headers: ttHeaders() });
      if (!r.ok) return;
      const j = await r.json();
      setTt(j);
      if (j.connected) setTtErr('');
    } catch { /* dashboard is informational — stay quiet on network errors */ }
  }, [ttHeaders]);

  useEffect(() => {
    loadTikTok();
    loadHistory();
    const interval = setInterval(() => {
      loadTikTok();
      loadHistory();
    }, 20000);
    const onMsg = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'obito-tiktok') return;
      if (e.data.ok) {
        loadTikTok();
        setConfirmDelete(false);
      } else {
        setTtErr(e.data.reason || 'TikTok sign-in was cancelled.');
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      clearInterval(interval);
      window.removeEventListener('message', onMsg);
    };
  }, [loadTikTok]);

  const connectTikTok = async () => {
    setTtErr('');
    setTtBusy(true);
    const touchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 1;
    ttPopup.current = touchDevice ? null : window.open('about:blank', 'obito-tiktok-auth', 'popup=yes,width=520,height=720');
    try {
      const r = await fetch('/api/tiktok/connect', { headers: ttHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not start TikTok sign-in.');
      if (ttPopup.current && !ttPopup.current.closed) {
        ttPopup.current.location = j.url;
        setTtBusy(false);
      } else {
        window.location.href = j.url;
      }
    } catch (e) {
      ttPopup.current?.close();
      setTtErr(e.message || 'Could not start TikTok sign-in.');
      setTtBusy(false);
    }
  };

  const disconnectTikTok = async () => {
    setTtBusy(true);
    setTtErr('');
    setConfirmDelete(false);
    await fetch('/api/tiktok/disconnect', { method: 'POST', headers: ttHeaders() }).catch(() => {});
    await loadTikTok();
    setTtBusy(false);
  };

  const onKeepAccount = () => {
    setKeepNotice(true);
    setConfirmDelete(false);
    if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(8); } catch {}
    setTimeout(() => setKeepNotice(false), 3200);
  };

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else if (onKeyChange) {
      onKeyChange('', '', 'free');
    }
  };

  const cleanUser = userName || (ownerAuthenticated ? (isMasterOwner ? 'Owner' : 'Member') : 'Guest');
  const normalizedTier = (userTier || 'free').toLowerCase();
  const tierDisplay = normalizedTier === 'redeemed'
    ? 'Studio Pass (Redeemed)'
    : normalizedTier === 'paid'
    ? (isMasterOwner ? 'Studio Owner (VIP)' : 'Studio Member (Paid)')
    : 'Free Creator Preview';

  return (
    <div className="studio-dashboard">
      {/* ---------- User Profile Hero Card ---------- */}
      <motion.div
        className="dash-hero-card"
        initial={{ opacity: 0.3, filter: 'blur(12px)', y: 20 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="dash-hero-top">
          <div className="dash-hero-brand">
            <span className="dash-hero-badge">CREATOR DASHBOARD</span>
            <span className="dash-beta-pill">@{cleanUser}</span>
          </div>
          <div className="dash-engine-status ready">
            <span className="dash-status-dot" />
            <span className="dash-status-text">{tierDisplay.toUpperCase()}</span>
          </div>
        </div>

        <div className="dash-hero-content">
          <h1 className="dash-hero-title">Welcome back, {cleanUser}</h1>
          <p className="dash-hero-subtitle">
            Manage your connected TikTok publishing accounts, studio pass, and personal account settings.
          </p>
        </div>

        <div className="dash-hero-actions">
          {!ownerAuthenticated && onOpenSignIn && (
            <motion.button
              type="button"
              className="btn-dash-hero primary"
              onClick={onOpenSignIn}
              {...scrollBlurButton}
            >
              <UserIcon width={16} height={16} />
              <span>Sign In with Studio Pass</span>
            </motion.button>
          )}
          {ownerAuthenticated && (
            <motion.button
              type="button"
              className="btn-dash-hero secondary"
              onClick={handleSignOut}
              {...scrollBlurButton}
            >
              <UserIcon width={16} height={16} />
              <span>Sign Out</span>
            </motion.button>
          )}
          {!tt?.connected ? (
            <motion.button
              type="button"
              className="btn-dash-hero secondary"
              onClick={connectTikTok}
              disabled={ttBusy}
              {...scrollBlurButton}
              transition={{ ...scrollBlurButton.transition, delay: 0.08 }}
            >
              <TikTokIcon width={16} height={16} />
              <span>{ttBusy ? 'Connecting…' : 'Connect TikTok Channel'}</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              className="btn-dash-hero secondary"
              onClick={onKeepAccount}
              {...scrollBlurButton}
              transition={{ ...scrollBlurButton.transition, delay: 0.08 }}
            >
              <CheckIcon width={15} height={15} />
              <span>Keep TikTok Active</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ---------- Connected Publishing Channels (TikTok) ---------- */}
      <div className="dash-accounts-section">
        <motion.div className="dash-section-header" {...scrollBlurCard}>
          <h2 className="dash-section-title font-clash font-bold">Connected Accounts</h2>
          <span className="dash-section-sub">Manage your linked TikTok publishing accounts. Official Direct Post API is currently in developer review with TikTok and launching in a couple of days.</span>
        </motion.div>

        <motion.div className="dash-accounts-card" {...scrollBlurCard} transition={{ ...scrollBlurCard.transition, delay: 0.04 }}>
          {tt?.connected ? (
            <>
              <div className="dash-account-row">
                {tt.account?.avatar_url ? (
                  <img className="dash-account-avatar" src={tt.account.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <div className="dash-account-avatar placeholder">
                    {(tt.account?.display_name || tt.account?.username || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="dash-account-id">
                  <span className="dash-account-name">
                    {tt.account?.display_name || tt.creator?.creator_nickname || tt.account?.username || 'TikTok Account'}
                  </span>
                  <span className="dash-account-handle">
                    {tt.account?.username ? `@${tt.account.username}` : (tt.account?.open_id || 'Connected creator')}
                  </span>
                  <div className="dash-scope-tags">
                    <span className="dash-scope-tag">TikTok Connected</span>
                    <span className="dash-scope-tag text-cyan-300 border border-cyan-400/30 bg-cyan-500/10 font-medium">Official API · In Review (Coming Soon)</span>
                    <span className="dash-scope-tag">Account Linked</span>
                  </div>
                </div>

                <div className="dash-account-actions">
                  <button
                    type="button"
                    className="dash-account-btn keep"
                    onClick={onKeepAccount}
                    title="Keep this account connected and active for TikTok direct posting"
                  >
                    <CheckIcon width={14} height={14} />
                    <span>Keep Account</span>
                  </button>
                  <button
                    type="button"
                    className="dash-account-btn delete"
                    disabled={ttBusy}
                    onClick={() => setConfirmDelete((prev) => !prev)}
                    title="Remove or disconnect this TikTok account"
                  >
                    <TrashIcon width={14} height={14} />
                    <span>Delete Connection</span>
                  </button>
                </div>
              </div>

              {confirmDelete && (
                <div className="dash-confirm-delete-box">
                  <div className="dash-confirm-delete-msg">
                    <TrashIcon width={16} height={16} />
                    <span>Remove <b>@{tt.account?.username || 'this account'}</b> from Obito Studio? You can re-link anytime.</span>
                  </div>
                  <div className="dash-confirm-delete-btns">
                    <button type="button" className="dash-account-btn" onClick={() => setConfirmDelete(false)}>
                      Cancel &amp; Keep
                    </button>
                    <button type="button" className="dash-account-btn delete" disabled={ttBusy} onClick={disconnectTikTok}>
                      {ttBusy ? 'Deleting…' : 'Yes, Delete Account'}
                    </button>
                  </div>
                </div>
              )}

              {keepNotice && (
                <div className="dash-keep-notice">
                  <CheckIcon width={14} height={14} />
                  <span>Account is active and ready for one-click TikTok Direct Posting (launching once developer review completes).</span>
                </div>
              )}

              <p className="dash-account-note">
                Official TikTok Direct Posting is currently in final developer review with TikTok. Once approved, mastered videos can be published directly to your feed with one tap. Deleting your connection revokes studio posting access at TikTok.
              </p>
            </>
          ) : (
            <div className="dash-account-row">
              <div className="dash-account-avatar placeholder" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <TikTokIcon width={22} height={22} />
              </div>
              <div className="dash-account-id">
                <span className="dash-account-name">No TikTok account connected</span>
                <span className="dash-account-handle">
                  {tt?.reconnect
                    ? 'Your TikTok session expired — reconnect to prepare for official direct posting.'
                    : 'Connect your TikTok account to get ready for official 1-click direct posting (in developer review, launching in a couple of days).'}
                </span>
              </div>
              <div className="dash-account-actions">
                <button type="button" className="dash-account-btn primary" disabled={ttBusy} onClick={connectTikTok}>
                  {ttBusy ? 'Opening TikTok…' : tt?.reconnect ? 'Reconnect TikTok' : 'Connect TikTok Account'}
                </button>
              </div>
            </div>
          )}
          {ttErr && <p className="dash-account-note err">{ttErr}</p>}
        </motion.div>
      </div>

      {/* ---------- User Account Overview Cards ---------- */}
      <div className="dash-telemetry-grid user-grid">
        <motion.div className="dash-stat-card" {...scrollBlurCard} transition={{ ...scrollBlurCard.transition, delay: 0.02 }}>
          <div className="dash-stat-header">
            <span className="dash-stat-label">MEMBERSHIP TIER</span>
          </div>
          <div className="dash-stat-val inframe-title font-clash font-medium">{tierDisplay}</div>
          <div className="dash-stat-desc">
            Personal studio access for high-framerate processing and video export.
          </div>
          {!ownerAuthenticated && onOpenSignIn ? (
            <button type="button" className="dash-card-inline-action" onClick={onOpenSignIn}>
              Redeem Studio Pass →
            </button>
          ) : (
            <span className="dash-card-inline-status">✓ Active Access</span>
          )}
        </motion.div>

        <motion.div className="dash-stat-card" {...scrollBlurCard} transition={{ ...scrollBlurCard.transition, delay: 0.06 }}>
          <div className="dash-stat-header">
            <span className="dash-stat-label">TIKTOK CHANNEL</span>
          </div>
          <div className="dash-stat-val inframe-title font-clash font-medium">
            {tt?.connected ? `@${tt.account?.username || 'Connected'}` : 'No Channel Linked'}
          </div>
          <div className="dash-stat-desc">
            {tt?.connected
              ? 'Authorized for one-click direct publishing to your TikTok feed.'
              : 'Link your TikTok account to enable direct publishing.'}
          </div>
          {tt?.connected ? (
            <button type="button" className="dash-card-inline-action" onClick={onKeepAccount}>
              Keep Active ✓
            </button>
          ) : (
            <button type="button" className="dash-card-inline-action" onClick={connectTikTok} disabled={ttBusy}>
              Link TikTok →
            </button>
          )}
        </motion.div>

        <motion.div className="dash-stat-card" {...scrollBlurCard} transition={{ ...scrollBlurCard.transition, delay: 0.1 }}>
          <div className="dash-stat-header">
            <span className="dash-stat-label">SECURITY &amp; STORAGE</span>
          </div>
          <div className="dash-stat-val inframe-title font-clash font-medium">Sovereign &amp; Local</div>
          <div className="dash-stat-desc">
            Zero cloud media storage. Master video packets are processed in temporary memory and never stored.
          </div>
          <span className="dash-card-inline-status">Zero Data Retention</span>
        </motion.div>
      </div>

      {/* ---------- Personal Optimization History & Pipelines Section ---------- */}
      <div className="dash-accounts-section">
        <motion.div className="dash-section-header" {...scrollBlurCard}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="dash-section-title font-clash font-bold">Optimization History &amp; Pipelines</h2>
              <span className="dash-section-sub">
                Verified stream telemetry, pipeline modes, and output cadence from your recent master jobs.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/[0.04] border border-white/10 text-neutral-300">
                {historyStats.total} Mastered
              </span>
              <button
                type="button"
                onClick={loadHistory}
                className="size-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all text-xs cursor-pointer"
                title="Refresh history"
              >
                ↻
              </button>
            </div>
          </div>
        </motion.div>

        {/* History Overview Quick Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <motion.div className="rounded-xl p-3 bg-white/[0.025] border border-white/[0.06] backdrop-blur-md" {...scrollBlurCard}>
            <span className="block text-[10px] uppercase font-mono text-neutral-400 tracking-wider">Total Optimizations</span>
            <span className="font-clash inframe-title font-medium text-base text-white mt-0.5 block">
              {loadingHistory ? '—' : `${historyStats.total} Videos`}
            </span>
          </motion.div>
          <motion.div className="rounded-xl p-3 bg-white/[0.025] border border-white/[0.06] backdrop-blur-md" {...scrollBlurCard}>
            <span className="block text-[10px] uppercase font-mono text-neutral-400 tracking-wider">Primary Pipeline</span>
            <span className="font-clash inframe-title font-medium text-base text-cyan-300 mt-0.5 block truncate">
              {loadingHistory ? '—' : historyStats.favoritePipeline}
            </span>
          </motion.div>
          <motion.div className="rounded-xl p-3 bg-white/[0.025] border border-white/[0.06] backdrop-blur-md" {...scrollBlurCard}>
            <span className="block text-[10px] uppercase font-mono text-neutral-400 tracking-wider">Output Clock</span>
            <span className="font-clash inframe-title font-medium text-base text-purple-300 mt-0.5 block">
              19,200 Timescale Sync
            </span>
          </motion.div>
        </div>

        {/* History List or Studio Empty State */}
        <motion.div className="dash-accounts-card" {...scrollBlurCard} transition={{ ...scrollBlurCard.transition, delay: 0.04 }}>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((job) => {
                const isDone = job.status === 'done';
                const dateStr = job.timestamp ? new Date(job.timestamp).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Recent';
                const modeLabel = job.mode === 'standard' ? 'Standard 709' : 'HDR Rec.2020 / HLG';

                return (
                  <div
                    key={job.id}
                    className="p-3 sm:p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs sm:text-sm text-white truncate max-w-xs sm:max-w-md">
                            {job.fileName || 'Master Video'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                            job.mode === 'standard'
                              ? 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20'
                              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                          }`}>
                            {modeLabel}
                            {job.ensureH264 ? ' · AVC1' : ''}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-neutral-400 block">
                          {dateStr} · ID: <code className="text-neutral-400 bg-white/[0.04] px-1 py-0.2 rounded font-mono">{job.id.slice(0, 12)}…</code>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold border ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-red-500/10 text-red-400 border-red-500/25'
                        }`}>
                          {isDone ? 'Completed ✓' : 'Failed'}
                        </span>
                      </div>
                    </div>

                    {/* Telemetry specs row */}
                    <div className="pt-2 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase font-mono">Input Source</span>
                        <span className="text-neutral-300 font-mono">
                          {job.in ? `${job.in.w}x${job.in.h} · ${job.in.fps}fps` : '1080p Master'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase font-mono">Output Cadence</span>
                        <span className="text-cyan-300 font-mono">
                          {job.out ? `${job.out.w}x${job.out.h} · 19200 ts` : '19200 Base Clock'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase font-mono">Audio &amp; Codec</span>
                        <span className="text-neutral-300 font-mono">
                          {job.out ? `${job.out.codec} · 2-Track AAC` : 'Dual AAC Lossless'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase font-mono">Remux Duration</span>
                        <span className="text-emerald-400 font-mono">
                          {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : '< 1s'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 px-4 space-y-3">
              <div className="size-10 mx-auto rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-400 text-sm">
                ⏱
              </div>
              <div className="space-y-1">
                <h4 className="font-clash inframe-title font-medium text-sm text-white">
                  No Mastering History Yet
                </h4>
                <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">
                  Run your first 60fps or HDR clip through the optimizer. Your container surgery records, audio cadences, and timestamps will be saved here.
                </p>
              </div>
              {onSwitchTab && (
                <button
                  type="button"
                  onClick={() => onSwitchTab('optimizer')}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white transition-all cursor-pointer"
                >
                  <span>Open Video Optimizer</span>
                  <span className="text-cyan-400">→</span>
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ---------- Account & Pass Security Settings ---------- */}
      <div className="dash-accounts-section">
        <motion.div className="dash-section-header" {...scrollBlurCard}>
          <h2 className="dash-section-title font-clash font-bold">Account &amp; Session Security</h2>
          <span className="dash-section-sub">Manage your access credentials and local permissions.</span>
        </motion.div>

        <motion.div className="dash-accounts-card" {...scrollBlurCard} transition={{ ...scrollBlurCard.transition, delay: 0.04 }}>
          <div className="dash-settings-row">
            <div className="dash-settings-meta">
              <span className="dash-settings-label">Studio Access Key</span>
              <span className="dash-settings-sub">
                {apiKey
                  ? `Active Pass Key: ••••••••${typeof apiKey === 'string' && apiKey.length >= 4 ? apiKey.slice(-4) : '••••'}`
                  : 'No pass key configured — running in Free Creator Preview mode.'}
              </span>
            </div>
            <div className="dash-settings-actions">
              {apiKey ? (
                <button type="button" className="dash-account-btn" onClick={handleSignOut}>
                  Sign Out / Remove Key
                </button>
              ) : onOpenSignIn ? (
                <button type="button" className="dash-account-btn primary" onClick={onOpenSignIn}>
                  Enter Key / Redeem Pass
                </button>
              ) : null}
            </div>
          </div>

          <div className="dash-settings-row">
            <div className="dash-settings-meta">
              <span className="dash-settings-label">TikTok Authorization Status</span>
              <span className="dash-settings-sub">
                {tt?.connected
                  ? 'Authorized scopes: Login Kit & Content Posting API. Obito Studio never accesses private messages or drafts.'
                  : 'No TikTok account currently authorized.'}
              </span>
            </div>
            <div className="dash-settings-actions">
              {tt?.connected ? (
                <button
                  type="button"
                  className="dash-account-btn delete"
                  disabled={ttBusy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Revoke TikTok Access
                </button>
              ) : (
                <button
                  type="button"
                  className="dash-account-btn"
                  disabled={ttBusy}
                  onClick={connectTikTok}
                >
                  Authorize Channel
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
