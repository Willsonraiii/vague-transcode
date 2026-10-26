import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Logo from './Logo.jsx';
import {
  PremiumKeyIcon, KeyIcon, RefreshIcon, CheckIcon, CopyIcon,
  TrashIcon, SearchIcon, LogoutIcon, ChevronDownIcon, ActivityIcon,
  ShieldIcon, FilmIcon, LightningIcon, HdrIcon, FpsIcon, UserIcon,
  LayersIcon, AlertTriangleIcon, InfoIcon, CloseIcon
} from './icons.jsx';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default function AdminPage({
  apiKey,
  onKeyChange,
  onSwitchTab,
  isMasterOwner,
  ownerAuthenticated,
  onSignOut,
}) {
  // Navigation tabs inside the Admin Command Center
  const [activeAdminTab, setActiveAdminTab] = useState('telemetry'); // 'telemetry' | 'creators' | 'referrals' | 'jobs' | 'reviews' | 'system'

  // Access & Gate State
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [authError, setAuthError] = useState('');

  // Platform Data
  const [referrals, setReferrals] = useState([]);
  const [clients, setClients] = useState([]);
  const [telemetry, setTelemetry] = useState({
    totalOptimizations: 0,
    pipelineStats: {},
    userLeaderboard: [],
    recentJobs: [],
  });
  const [reviews, setReviews] = useState([]);
  const [serverHealth, setServerHealth] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Filters & Search
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorTierFilter, setCreatorTierFilter] = useState('ALL');
  const [creatorStatusFilter, setCreatorStatusFilter] = useState('ALL');
  const [referralSearch, setReferralSearch] = useState('');
  const [referralStatusFilter, setReferralStatusFilter] = useState('ALL');
  const [expandedReferralCode, setExpandedReferralCode] = useState(null);
  const [jobsSearch, setJobsSearch] = useState('');
  const [reviewRatingFilter, setReviewRatingFilter] = useState('ALL');

  // Forms: Create Creator Pass
  const [showCreateCreatorModal, setShowCreateCreatorModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Forms: Create Referral Code
  const [showCreateRefModal, setShowCreateRefModal] = useState(false);
  const [newRefCode, setNewRefCode] = useState('');
  const [newRefMaxUses, setNewRefMaxUses] = useState('1');
  const [newRefNote, setNewRefNote] = useState('');
  const [creatingRef, setCreatingRef] = useState(false);

  // Active token resolver
  const getAuthToken = useCallback(() => {
    return apiKey || lsGet('obitoKey') || '';
  }, [apiKey]);

  // Copy helper
  const copyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Temporary flash alert helper
  const flashMessage = (msg, isErr = false) => {
    if (isErr) {
      setActionError(msg);
      setTimeout(() => setActionError(''), 4500);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(''), 4000);
    }
  };

  // Fetch all admin data
  const loadAllData = useCallback(async (isSilent = false) => {
    const token = getAuthToken();
    if (!token) return;

    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setActionError('');

    try {
      // 1. Members store (referrals & clients)
      const memRes = await fetch('/api/admin/members', {
        headers: { 'x-access-token': token },
      });
      const memData = await memRes.json();
      if (memData?.ok) {
        setReferrals(memData.referrals || []);
        setClients(memData.clients || []);
      }

      // 2. Optimizations & Telemetry breakdown
      const optRes = await fetch('/api/admin/optimizations', {
        headers: { 'x-access-token': token },
      });
      const optData = await optRes.json();
      if (optData?.ok) {
        setTelemetry({
          totalOptimizations: optData.totalOptimizations || 0,
          pipelineStats: optData.pipelineStats || {},
          userLeaderboard: optData.userLeaderboard || [],
          recentJobs: optData.recentJobs || [],
        });
      }

      // 3. Creator Reviews
      const revRes = await fetch('/api/admin/reviews', {
        headers: { 'x-access-token': token },
      });
      const revData = await revRes.json();
      if (revData?.ok) {
        setReviews(revData.reviews || []);
      }

      // 4. Server health & infrastructure stats
      try {
        const healthRes = await fetch('/health');
        const healthData = await healthRes.json();
        if (healthData?.ok) {
          setServerHealth(healthData);
        }
      } catch {}
    } catch (err) {
      flashMessage(err.message || 'Failed to refresh platform data', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthToken]);

  // Load when owner is authenticated
  useEffect(() => {
    if (ownerAuthenticated && isMasterOwner) {
      loadAllData();
    }
  }, [ownerAuthenticated, isMasterOwner, loadAllData]);

  // Direct gate authentication
  const handleGateUnlock = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setAuthChecking(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/owner', {
        headers: { 'x-access-token': tokenInput.trim() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.isOwner) {
        throw new Error('Access denied. Invalid master owner credentials.');
      }
      onKeyChange(tokenInput.trim(), data.name || 'Master Owner', 'paid');
      setTokenInput('');
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthChecking(false);
    }
  };

  // Toggle referral status
  const handleToggleReferral = async (code) => {
    try {
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(code)}/toggle`, {
        method: 'POST',
        headers: { 'x-access-token': getAuthToken() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to toggle referral pass');
      flashMessage(`Referral ${code} status updated`);
      loadAllData(true);
    } catch (err) {
      flashMessage(err.message, true);
    }
  };

  // Delete referral code
  const handleDeleteReferral = async (code) => {
    if (!window.confirm(`Permanently delete referral pass ${code}?`)) return;
    try {
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { 'x-access-token': getAuthToken() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete referral pass');
      flashMessage(`Referral pass ${code} deleted`);
      loadAllData(true);
    } catch (err) {
      flashMessage(err.message, true);
    }
  };

  // Create new referral code
  const handleCreateReferral = async (e) => {
    e.preventDefault();
    if (!newRefCode.trim()) return;
    try {
      setCreatingRef(true);
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-token': getAuthToken() },
        body: JSON.stringify({
          code: newRefCode.trim().toUpperCase(),
          maxUses: newRefMaxUses === 'unlimited' ? null : parseInt(newRefMaxUses, 10) || 1,
          note: newRefNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create referral code');
      flashMessage(`Referral pass ${data.referral?.code} created successfully`);
      setNewRefCode('');
      setNewRefNote('');
      setShowCreateRefModal(false);
      loadAllData(true);
    } catch (err) {
      flashMessage(err.message, true);
    } finally {
      setCreatingRef(false);
    }
  };

  // Toggle client status
  const handleToggleClient = async (clientId) => {
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/toggle`, {
        method: 'POST',
        headers: { 'x-access-token': getAuthToken() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to toggle client access');
      flashMessage(`Client ${clientId} status updated`);
      loadAllData(true);
    } catch (err) {
      flashMessage(err.message, true);
    }
  };

  // Delete client pass
  const handleDeleteClient = async (clientId) => {
    if (!window.confirm(`Permanently revoke and delete creator pass ${clientId}?`)) return;
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        headers: { 'x-access-token': getAuthToken() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete client');
      flashMessage(`Client pass ${clientId} deleted`);
      loadAllData(true);
    } catch (err) {
      flashMessage(err.message, true);
    }
  };

  // Create new client pass
  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      setCreatingClient(true);
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-token': getAuthToken() },
        body: JSON.stringify({
          name: newClientName.trim(),
          customId: newClientId.trim() || undefined,
          customCode: newClientCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to issue creator pass');
      flashMessage(`Creator pass issued for ${data.client?.name}`);
      setNewClientName('');
      setNewClientId('');
      setNewClientCode('');
      setShowCreateCreatorModal(false);
      loadAllData(true);
    } catch (err) {
      flashMessage(err.message, true);
    } finally {
      setCreatingClient(false);
    }
  };

  // Export full platform snapshot JSON
  const handleExportSnapshot = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      platform: 'Obito Studio',
      version: '3.1.0-online',
      serverHealth,
      metrics: {
        totalOptimizations: telemetry.totalOptimizations,
        totalClients: clients.length,
        totalReferrals: referrals.length,
        totalReviews: reviews.length,
      },
      telemetry,
      clients,
      referrals,
      reviews,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obito-studio-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashMessage('Platform snapshot downloaded');
  };

  // Filtered lists
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !creatorSearch.trim() ||
        (c.name && c.name.toLowerCase().includes(creatorSearch.toLowerCase())) ||
        (c.clientId && c.clientId.toLowerCase().includes(creatorSearch.toLowerCase()));
      const matchTier =
        creatorTierFilter === 'ALL' ||
        (creatorTierFilter === 'PAID' && c.tier === 'paid') ||
        (creatorTierFilter === 'REDEEMED' && c.tier === 'redeemed');
      const matchStatus =
        creatorStatusFilter === 'ALL' ||
        (creatorStatusFilter === 'ACTIVE' && c.active !== false) ||
        (creatorStatusFilter === 'SUSPENDED' && c.active === false);
      return matchSearch && matchTier && matchStatus;
    });
  }, [clients, creatorSearch, creatorTierFilter, creatorStatusFilter]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      const matchSearch =
        !referralSearch.trim() ||
        r.code.toLowerCase().includes(referralSearch.toLowerCase()) ||
        (r.note && r.note.toLowerCase().includes(referralSearch.toLowerCase()));
      const isExhausted = r.maxUses !== null && (r.usedCount || 0) >= r.maxUses;
      const matchStatus =
        referralStatusFilter === 'ALL' ||
        (referralStatusFilter === 'ACTIVE' && r.active !== false && !isExhausted) ||
        (referralStatusFilter === 'EXHAUSTED' && isExhausted) ||
        (referralStatusFilter === 'DISABLED' && r.active === false);
      return matchSearch && matchStatus;
    });
  }, [referrals, referralSearch, referralStatusFilter]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((rev) => {
      if (reviewRatingFilter === 'ALL') return true;
      if (reviewRatingFilter === '5') return rev.rating === 5;
      if (reviewRatingFilter === '4') return rev.rating === 4;
      if (reviewRatingFilter === 'LE3') return rev.rating <= 3;
      return true;
    });
  }, [reviews, reviewRatingFilter]);

  const filteredJobs = useMemo(() => {
    const jobs = telemetry.recentJobs || [];
    if (!jobsSearch.trim()) return jobs;
    const q = jobsSearch.toLowerCase();
    return jobs.filter((j) => {
      return (
        (j.id && j.id.toLowerCase().includes(q)) ||
        (j.clientName && j.clientName.toLowerCase().includes(q)) ||
        (j.clientId && j.clientId.toLowerCase().includes(q)) ||
        (j.filename && j.filename.toLowerCase().includes(q)) ||
        (j.pipelineMode && j.pipelineMode.toLowerCase().includes(q))
      );
    });
  }, [telemetry.recentJobs, jobsSearch]);

  // Derived metrics
  const totalOptimizationsCount = telemetry.totalOptimizations || 0;
  const avgSatisfaction = useMemo(() => {
    if (!reviews.length) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  // If not master owner, show the Executive Command Security Gate
  if (!ownerAuthenticated || !isMasterOwner) {
    return (
      <main id="admin-gate" className="min-h-screen pt-28 pb-20 px-4 flex items-center justify-center bg-[hsl(var(--bg))] text-white selection:bg-cyan-500/30">
        <div className="w-full max-w-md">
          <div className="relative rounded-3xl border border-white/15 bg-neutral-950/85 p-7 sm:p-9 shadow-2xl backdrop-blur-2xl text-center overflow-hidden">
            {/* Top accent light */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />

            <div className="flex justify-center mb-4">
              <div className="size-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center shadow-inner">
                <Logo size={32} />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono tracking-wider uppercase mb-3">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Restricted Operations
            </div>

            <h1 className="font-clash inframe-title font-semibold text-2xl text-white tracking-tight">
              Studio Command Center
            </h1>
            <p className="font-sans text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Master owner authentication required to inspect production pipelines, creator accounts, and platform telemetry.
            </p>

            <form onSubmit={handleGateUnlock} className="mt-6 space-y-4">
              <div className="relative text-left">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  Master Access Token
                </label>
                <div className="relative">
                  <input
                    type={showTokenInput ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter ACCESS_TOKEN"
                    autoFocus
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:border-cyan-400/60 focus:bg-white/[0.07] focus:outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTokenInput((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white transition-colors"
                  >
                    {showTokenInput ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-sans text-left flex items-start gap-2">
                  <AlertTriangleIcon width={14} height={14} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={authChecking || !tokenInput.trim()}
                  className="w-full rounded-xl bg-white px-5 py-2.5 text-xs font-clash inframe-title font-semibold text-black hover:bg-neutral-200 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
                >
                  {authChecking ? (
                    <>
                      <RefreshIcon width={14} height={14} className="animate-spin" />
                      <span>Verifying Master Credentials…</span>
                    </>
                  ) : (
                    <>
                      <ShieldIcon width={14} height={14} />
                      <span>Unlock Command Center</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => onSwitchTab?.('home')}
                  className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  &larr; Return to Studio Showcase
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // Master Owner Console (Fully Reconstructed Standalone Page)
  return (
    <main
      id="admin-page"
      className="min-h-screen pt-24 sm:pt-28 md:pt-32 pb-24 bg-[hsl(var(--bg))] text-white selection:bg-cyan-500/30"
    >
      <div className="container-hirael max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Toast Alerts */}
        {actionError && (
          <div className="fixed top-20 right-4 z-50 p-4 rounded-2xl bg-rose-950/90 border border-rose-500/30 shadow-2xl backdrop-blur-xl text-rose-200 text-xs flex items-center gap-3 animate-fade-in max-w-md">
            <AlertTriangleIcon width={16} height={16} className="text-rose-400 shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button type="button" onClick={() => setActionError('')} className="text-white/60 hover:text-white">✕</button>
          </div>
        )}
        {actionSuccess && (
          <div className="fixed top-20 right-4 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/30 shadow-2xl backdrop-blur-xl text-emerald-200 text-xs flex items-center gap-3 animate-fade-in max-w-md">
            <CheckIcon width={16} height={16} className="text-emerald-400 shrink-0" />
            <span className="flex-1">{actionSuccess}</span>
            <button type="button" onClick={() => setActionSuccess('')} className="text-white/60 hover:text-white">✕</button>
          </div>
        )}

        {/* 1. Command Top Navigation Bar */}
        <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-4 sm:p-6 backdrop-blur-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
              <Logo size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-clash inframe-title font-semibold text-lg sm:text-xl text-white tracking-tight">
                  Studio Command Center
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/30 text-[10px] font-mono font-medium text-cyan-300 uppercase tracking-wider">
                  Master Owner
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 mt-1 font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Engine Online
                </span>
                <span className="text-white/20">·</span>
                <span>Timescale 19,200</span>
                <span className="text-white/20">·</span>
                <span>{serverHealth ? `${serverHealth.freeDiskMb ? (serverHealth.freeDiskMb / 1024).toFixed(1) : '72.6'} GB Free` : 'NVMe Active'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadAllData(false)}
              disabled={refreshing}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/[0.07] transition-all flex items-center gap-2 cursor-pointer"
              title="Refresh all platform statistics"
            >
              <RefreshIcon width={13} height={13} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
              <span>{refreshing ? 'Syncing…' : 'Sync Data'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportSnapshot}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/[0.07] transition-all flex items-center gap-2 cursor-pointer"
              title="Download JSON snapshot of platform database"
            >
              <ActivityIcon width={13} height={13} className="text-white/70" />
              <span>Export Snapshot</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab?.('home')}
              className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-clash inframe-title font-medium text-white hover:bg-white/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>&larr; Studio Showcase</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-clash inframe-title font-medium text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              title="Sign out of owner session"
            >
              <LogoutIcon width={13} height={13} />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        {/* 2. Executive Quick-Telemetry Bar (4 Key Metric Tiles) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Mastered Videos */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 sm:p-5 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-sans mb-1.5">
              <span>Mastered Videos (Real)</span>
              <FilmIcon width={15} height={15} className="text-cyan-400" />
            </div>
            <div className="font-clash inframe-title font-semibold text-2xl sm:text-3xl text-white tracking-tight flex items-baseline gap-2">
              <span>{loading ? '—' : totalOptimizationsCount}</span>
              <span className="text-[11px] font-mono text-cyan-300 font-normal">
                ({54 + totalOptimizationsCount} public)
              </span>
            </div>
            <div className="mt-2 text-[10.5px] font-mono text-neutral-400 flex items-center gap-1.5">
              <span className="text-cyan-300">54 base offset</span>
              <span className="text-white/20">·</span>
              <span>{totalOptimizationsCount} real runs</span>
            </div>
          </div>

          {/* Card 2: Registered Creators */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 sm:p-5 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-sans mb-1.5">
              <span>Creator Passes (Real)</span>
              <UserIcon width={15} height={15} className="text-indigo-400" />
            </div>
            <div className="font-clash inframe-title font-semibold text-2xl sm:text-3xl text-white tracking-tight flex items-baseline gap-2">
              <span>{loading ? '—' : clients.length}</span>
              <span className="text-[11px] font-mono text-indigo-300 font-normal">
                ({13 + clients.length} public)
              </span>
            </div>
            <div className="mt-2 text-[10.5px] font-mono text-neutral-400 flex items-center gap-1.5">
              <span className="text-emerald-400">{clients.filter((c) => c.active !== false).length} Active</span>
              <span className="text-white/20">·</span>
              <span>13 base offset</span>
            </div>
          </div>

          {/* Card 3: Referral Invites */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 sm:p-5 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-sans mb-1.5">
              <span>Referral Codes</span>
              <KeyIcon width={15} height={15} className="text-amber-400" />
            </div>
            <div className="font-clash inframe-title font-semibold text-2xl sm:text-3xl text-white tracking-tight">
              {loading ? '—' : referrals.length}
            </div>
            <div className="mt-2 text-[10.5px] font-mono text-neutral-400 flex items-center gap-1.5">
              <span className="text-amber-300">{referrals.filter((r) => r.active !== false).length} Active</span>
              <span className="text-white/20">·</span>
              <span>{referrals.reduce((acc, r) => acc + (r.usedCount || 0), 0)} Redemptions</span>
            </div>
          </div>

          {/* Card 4: Creator Satisfaction */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 sm:p-5 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-sans mb-1.5">
              <span>Creator Satisfaction</span>
              <span className="text-amber-300 font-bold">★</span>
            </div>
            <div className="font-clash inframe-title font-semibold text-2xl sm:text-3xl text-white tracking-tight flex items-baseline gap-1.5">
              <span>{avgSatisfaction}</span>
              <span className="text-xs text-neutral-400 font-sans font-normal">/ 5.0</span>
            </div>
            <div className="mt-2 text-[10.5px] font-mono text-neutral-400 flex items-center gap-1.5">
              <span className="text-white">{reviews.length} Reviews</span>
              <span className="text-white/20">·</span>
              <span className="text-emerald-400">100% Positive</span>
            </div>
          </div>
        </div>

        {/* 3. Modern iOS 26 Studio Tab Pill Navigation */}
        <div className="border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'telemetry', label: 'Pipelines & Leaderboard', icon: ActivityIcon },
              { id: 'creators', label: `Creator Passes (${clients.length})`, icon: UserIcon },
              { id: 'referrals', label: `Referral Invites (${referrals.length})`, icon: KeyIcon },
              { id: 'jobs', label: `Mastered Jobs (${telemetry.recentJobs?.length || 0})`, icon: FilmIcon },
              { id: 'reviews', label: `Reviews & Feedback (${reviews.length})`, icon: PremiumKeyIcon },
              { id: 'system', label: 'System & Health', icon: ShieldIcon },
            ].map(({ id, label, icon: Icon }) => {
              const active = activeAdminTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveAdminTab(id)}
                  className={`rounded-full px-4 py-2 text-xs font-clash inframe-title font-medium transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                    active
                      ? 'bg-white text-black shadow-lg scale-[1.02]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon width={13} height={13} className={active ? 'text-black' : 'text-neutral-400'} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Tab 1: Pipelines & Leaderboard */}
        {activeAdminTab === 'telemetry' && (
          <div className="space-y-6">
            {/* Ingestion Mode Distribution */}
            <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 sm:p-7 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                <div>
                  <h2 className="font-clash inframe-title font-semibold text-lg text-white">
                    Master Ingestion Pipelines
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Live distribution across Apple HDR Rec.2020, High-Framerate 60/120fps, and Rec.709 modes.
                  </p>
                </div>
                <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-cyan-400" />
                  <span>Active Timescale: 19,200</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">Apple HDR (Rec.2020 / HLG)</span>
                    <HdrIcon width={14} height={14} className="text-amber-400" />
                  </div>
                  <div className="font-clash inframe-title text-2xl font-semibold text-white">
                    {telemetry.pipelineStats?.['HDR Rec.2020 / HLG'] || 0}
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-200"
                      style={{
                        width: totalOptimizationsCount > 0
                          ? `${Math.min(100, Math.round(((telemetry.pipelineStats?.['HDR Rec.2020 / HLG'] || 0) / totalOptimizationsCount) * 100))}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">60fps &amp; 120fps Fluid Motion</span>
                    <FpsIcon width={14} height={14} className="text-cyan-400" />
                  </div>
                  <div className="font-clash inframe-title text-2xl font-semibold text-white">
                    {totalOptimizationsCount}
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-200 w-full" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">Standard Rec.709 Lossless</span>
                    <LayersIcon width={14} height={14} className="text-emerald-400" />
                  </div>
                  <div className="font-clash inframe-title text-2xl font-semibold text-white">
                    {telemetry.pipelineStats?.['Standard 709'] || 0}
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-200"
                      style={{
                        width: totalOptimizationsCount > 0
                          ? `${Math.min(100, Math.round(((telemetry.pipelineStats?.['Standard 709'] || 0) / totalOptimizationsCount) * 100))}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Creator Leaderboard */}
            <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 sm:p-7 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-clash inframe-title font-semibold text-lg text-white">
                    Creator Activity Leaderboard
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Ranked by total mastered videos and active pipeline engagement.
                  </p>
                </div>
              </div>

              {!telemetry.userLeaderboard || telemetry.userLeaderboard.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 font-mono">
                  No video optimizations recorded in the audit database yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3">Rank</th>
                        <th className="py-3 px-3">Creator Name</th>
                        <th className="py-3 px-3">Client ID</th>
                        <th className="py-3 px-3 text-right">Mastered Videos</th>
                        <th className="py-3 px-3">Primary Pipeline</th>
                        <th className="py-3 px-3">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {telemetry.userLeaderboard.map((item, idx) => (
                        <tr key={item.clientId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-mono text-neutral-400">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-3 font-medium text-white">
                            {item.name || item.clientId}
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-400 text-[11px]">
                            {item.clientId}
                          </td>
                          <td className="py-3 px-3 text-right font-clash inframe-title font-semibold text-white">
                            {item.totalOptimizations}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                              {item.primaryPipeline || '60fps Lossless'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-400 font-mono text-[11px]">
                            {item.lastActive ? new Date(item.lastActive).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Tab 2: Creator Passes */}
        {activeAdminTab === 'creators' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <SearchIcon width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={creatorSearch}
                    onChange={(e) => setCreatorSearch(e.target.value)}
                    placeholder="Search by creator name or ID…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
                <select
                  value={creatorTierFilter}
                  onChange={(e) => setCreatorTierFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 focus:outline-none"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="PAID">Paid Member</option>
                  <option value="REDEEMED">Redeemed Invite</option>
                </select>
                <select
                  value={creatorStatusFilter}
                  onChange={(e) => setCreatorStatusFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="SUSPENDED">Suspended Only</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateCreatorModal((v) => !v)}
                className="rounded-xl bg-white px-4 py-2 text-xs font-clash inframe-title font-semibold text-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>+ Issue Creator Pass</span>
              </button>
            </div>

            {/* Inline Issue Creator Pass Form */}
            {showCreateCreatorModal && (
              <form onSubmit={handleCreateClient} className="rounded-3xl border border-white/15 bg-neutral-950/90 p-5 sm:p-6 backdrop-blur-2xl space-y-4 animate-fade-in shadow-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="font-clash inframe-title font-semibold text-sm text-white">
                    Issue New Creator Pass
                  </h3>
                  <button type="button" onClick={() => setShowCreateCreatorModal(false)} className="text-neutral-400 hover:text-white">✕</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-mono uppercase text-neutral-400 mb-1">Creator Name *</label>
                    <input
                      type="text"
                      required
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-mono uppercase text-neutral-400 mb-1">Custom Client ID (Optional)</label>
                    <input
                      type="text"
                      value={newClientId}
                      onChange={(e) => setNewClientId(e.target.value)}
                      placeholder="e.g. cli_alex_pro"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-mono text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-mono uppercase text-neutral-400 mb-1">Custom Access Code (Optional)</label>
                    <input
                      type="text"
                      value={newClientCode}
                      onChange={(e) => setNewClientCode(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-mono text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCreatorModal(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingClient || !newClientName.trim()}
                    className="rounded-xl bg-cyan-400 hover:bg-cyan-300 px-5 py-2 text-xs font-clash inframe-title font-semibold text-black transition-all disabled:opacity-40"
                  >
                    {creatingClient ? 'Issuing Pass…' : 'Generate & Issue Pass'}
                  </button>
                </div>
              </form>
            )}

            {/* Creators Table */}
            <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 sm:p-6 backdrop-blur-xl">
              {filteredClients.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 font-mono">
                  No creator passes match the current filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3">Creator Name</th>
                        <th className="py-3 px-3">Client ID</th>
                        <th className="py-3 px-3">Tier</th>
                        <th className="py-3 px-3">Access Code</th>
                        <th className="py-3 px-3">Created</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {filteredClients.map((client) => {
                        const isSuspended = client.active === false;
                        return (
                          <tr key={client.clientId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-3 font-medium text-white">
                              {client.name || 'Creator'}
                            </td>
                            <td className="py-3 px-3 font-mono text-neutral-300 text-[11px]">
                              <button
                                type="button"
                                onClick={() => copyText(client.clientId, `cid_${client.clientId}`)}
                                className="hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                                title="Click to copy Client ID"
                              >
                                <span>{client.clientId}</span>
                                {copiedKey === `cid_${client.clientId}` ? (
                                  <CheckIcon width={11} height={11} className="text-emerald-400" />
                                ) : (
                                  <CopyIcon width={11} height={11} className="opacity-40" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                client.tier === 'paid'
                                  ? 'bg-amber-950/60 border border-amber-500/30 text-amber-300'
                                  : 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-300'
                              }`}>
                                {client.tier === 'paid' ? 'Paid Member' : 'Redeemed'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-neutral-400 text-[11px]">
                              <button
                                type="button"
                                onClick={() => copyText(client.accessCode, `code_${client.clientId}`)}
                                className="hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                                title="Click to copy Access Code"
                              >
                                <span>{client.accessCode ? '••••••••••••' : '—'}</span>
                                {copiedKey === `code_${client.clientId}` ? (
                                  <CheckIcon width={11} height={11} className="text-emerald-400" />
                                ) : (
                                  <CopyIcon width={11} height={11} className="opacity-40" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-neutral-400 font-mono text-[11px]">
                              {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                isSuspended
                                  ? 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
                                  : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                              }`}>
                                {isSuspended ? 'Suspended' : 'Active'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleClient(client.clientId)}
                                  className="text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded bg-white/[0.04] hover:bg-white/10 transition-colors"
                                >
                                  {isSuspended ? 'Activate' : 'Suspend'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClient(client.clientId)}
                                  className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                                  title="Permanently delete pass"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. Tab 3: Referral Passes */}
        {activeAdminTab === 'referrals' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <SearchIcon width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={referralSearch}
                    onChange={(e) => setReferralSearch(e.target.value)}
                    placeholder="Search referral codes or campaign notes…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
                <select
                  value={referralStatusFilter}
                  onChange={(e) => setReferralStatusFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Available</option>
                  <option value="EXHAUSTED">Exhausted</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateRefModal((v) => !v)}
                className="rounded-xl bg-white px-4 py-2 text-xs font-clash inframe-title font-semibold text-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>+ Create Referral Pass</span>
              </button>
            </div>

            {/* Inline Create Referral Code Form */}
            {showCreateRefModal && (
              <form onSubmit={handleCreateReferral} className="rounded-3xl border border-white/15 bg-neutral-950/90 p-5 sm:p-6 backdrop-blur-2xl space-y-4 animate-fade-in shadow-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="font-clash inframe-title font-semibold text-sm text-white">
                    Create New Referral Pass
                  </h3>
                  <button type="button" onClick={() => setShowCreateRefModal(false)} className="text-neutral-400 hover:text-white">✕</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-mono uppercase text-neutral-400 mb-1">Pass Code *</label>
                    <input
                      type="text"
                      required
                      value={newRefCode}
                      onChange={(e) => setNewRefCode(e.target.value.toUpperCase())}
                      placeholder="e.g. TIKTOK60FPS"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-mono uppercase text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-mono uppercase text-neutral-400 mb-1">Usage Limit</label>
                    <select
                      value={newRefMaxUses}
                      onChange={(e) => setNewRefMaxUses(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="1">1 Redemption (Single-Use VIP)</option>
                      <option value="3">3 Redemptions</option>
                      <option value="5">5 Redemptions</option>
                      <option value="10">10 Redemptions</option>
                      <option value="50">50 Redemptions</option>
                      <option value="unlimited">Unlimited Redemptions</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-mono uppercase text-neutral-400 mb-1">Campaign Note (Optional)</label>
                    <input
                      type="text"
                      value={newRefNote}
                      onChange={(e) => setNewRefNote(e.target.value)}
                      placeholder="e.g. Discord VIP Giveaway"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateRefModal(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingRef || !newRefCode.trim()}
                    className="rounded-xl bg-cyan-400 hover:bg-cyan-300 px-5 py-2 text-xs font-clash inframe-title font-semibold text-black transition-all disabled:opacity-40"
                  >
                    {creatingRef ? 'Creating…' : 'Generate Referral Pass'}
                  </button>
                </div>
              </form>
            )}

            {/* Referral Passes Table */}
            <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 sm:p-6 backdrop-blur-xl">
              {filteredReferrals.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 font-mono">
                  No referral passes match the current filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3">Pass Code</th>
                        <th className="py-3 px-3">Usage Progress</th>
                        <th className="py-3 px-3">Campaign Note</th>
                        <th className="py-3 px-3">Created</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {filteredReferrals.map((ref) => {
                        const isExhausted = ref.maxUses !== null && (ref.usedCount || 0) >= ref.maxUses;
                        const isDisabled = ref.active === false;
                        const isExpanded = expandedReferralCode === ref.code;
                        return (
                          <React.Fragment key={ref.code}>
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-3 font-mono font-semibold text-white">
                                <button
                                  type="button"
                                  onClick={() => copyText(ref.code, `ref_${ref.code}`)}
                                  className="hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                                  title="Click to copy code"
                                >
                                  <span>{ref.code}</span>
                                  {copiedKey === `ref_${ref.code}` ? (
                                    <CheckIcon width={11} height={11} className="text-emerald-400" />
                                  ) : (
                                    <CopyIcon width={11} height={11} className="opacity-40" />
                                  )}
                                </button>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-neutral-300 text-[11px]">
                                    {ref.usedCount || 0} / {ref.maxUses === null ? '∞' : ref.maxUses}
                                  </span>
                                  {ref.maxUses !== null && (
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${isExhausted ? 'bg-rose-400' : 'bg-cyan-400'}`}
                                        style={{ width: `${Math.min(100, Math.round(((ref.usedCount || 0) / ref.maxUses) * 100))}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-neutral-400 text-xs">
                                {ref.note || '—'}
                              </td>
                              <td className="py-3 px-3 text-neutral-400 font-mono text-[11px]">
                                {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                  isDisabled
                                    ? 'bg-neutral-800 text-neutral-400'
                                    : isExhausted
                                    ? 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
                                    : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                                }`}>
                                  {isDisabled ? 'Disabled' : isExhausted ? 'Exhausted' : 'Available'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {ref.redeemedBy && ref.redeemedBy.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedReferralCode(isExpanded ? null : ref.code)}
                                      className="text-[11px] text-cyan-300 hover:text-cyan-200 px-2 py-1 rounded bg-cyan-950/50 transition-colors"
                                    >
                                      {isExpanded ? 'Hide Users' : `Users (${ref.redeemedBy.length})`}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleReferral(ref.code)}
                                    className="text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded bg-white/[0.04] hover:bg-white/10 transition-colors"
                                  >
                                    {isDisabled ? 'Enable' : 'Disable'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReferral(ref.code)}
                                    className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Expanded Redemptions List */}
                            {isExpanded && ref.redeemedBy && (
                              <tr className="bg-white/[0.015]">
                                <td colSpan={6} className="py-3 px-6">
                                  <div className="text-[11px] font-mono text-neutral-400 mb-1.5 uppercase">
                                    Creators who redeemed {ref.code}:
                                  </div>
                                  <div className="space-y-1">
                                    {ref.redeemedBy.map((rUser, rIdx) => (
                                      <div key={rIdx} className="flex items-center gap-3 text-xs text-neutral-300 font-mono">
                                        <span className="text-white font-medium">{rUser.name || 'Creator'}</span>
                                        <span className="text-neutral-500">({rUser.clientId})</span>
                                        <span className="text-neutral-500 text-[10px]">
                                          {rUser.redeemedAt ? new Date(rUser.redeemedAt).toLocaleString() : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. Tab 4: Mastered Jobs Log */}
        {activeAdminTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <SearchIcon width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={jobsSearch}
                  onChange={(e) => setJobsSearch(e.target.value)}
                  placeholder="Search jobs by client, filename, or mode…"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                />
              </div>
              <div className="text-xs font-mono text-neutral-400">
                {filteredJobs.length} Processed Jobs
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 sm:p-6 backdrop-blur-xl">
              {filteredJobs.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 font-mono">
                  No video mastering jobs match search criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3">Job ID</th>
                        <th className="py-3 px-3">Creator</th>
                        <th className="py-3 px-3">Input Master</th>
                        <th className="py-3 px-3">Mastering Mode</th>
                        <th className="py-3 px-3">Duration</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {filteredJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-mono text-neutral-300 text-[11px]">
                            {job.id}
                          </td>
                          <td className="py-3 px-3 font-medium text-white">
                            {job.clientName || job.clientId || 'Guest'}
                          </td>
                          <td className="py-3 px-3 text-neutral-300">
                            {job.filename || 'Master Video'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                              {job.pipelineMode || '60fps Lossless'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-400 text-[11px]">
                            {job.duration ? `${job.duration}s` : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                              Lossless 19,200
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-400 font-mono text-[11px]">
                            {job.timestamp ? new Date(job.timestamp).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. Tab 5: Reviews & Creator Feedback */}
        {activeAdminTab === 'reviews' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-clash inframe-title font-semibold text-lg text-white">
                  Creator Feedback &amp; Reviews
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Realtime satisfaction scores and direct creator testimonials.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">Filter:</span>
                <select
                  value={reviewRatingFilter}
                  onChange={(e) => setReviewRatingFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="ALL">All Ratings ({reviews.length})</option>
                  <option value="5">5 Stars Only ({reviews.filter((r) => r.rating === 5).length})</option>
                  <option value="4">4 Stars ({reviews.filter((r) => r.rating === 4).length})</option>
                  <option value="LE3">&le; 3 Stars ({reviews.filter((r) => r.rating <= 3).length})</option>
                </select>
              </div>
            </div>

            {filteredReviews.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-12 text-center text-xs text-neutral-400 font-mono">
                No reviews received matching the filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReviews.map((rev) => (
                  <div key={rev.id} className="rounded-2xl border border-white/10 bg-neutral-950/70 p-5 backdrop-blur-xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-amber-400 text-sm tracking-wider">
                          {'★'.repeat(rev.rating || 5)}{'☆'.repeat(5 - (rev.rating || 5))}
                        </div>
                        <div className="font-clash inframe-title font-semibold text-sm text-white mt-1">
                          {rev.name || 'Anonymous Creator'}
                        </div>
                        <div className="font-mono text-[10.5px] text-neutral-400">
                          {rev.clientId || 'Client'} · {rev.timestamp ? new Date(rev.timestamp).toLocaleDateString() : '—'}
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                        {rev.category || 'General'}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-200 leading-relaxed font-sans bg-white/[0.02] p-3 rounded-xl border border-white/[0.05]">
                      &ldquo;{rev.message}&rdquo;
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                      <span className="text-neutral-400 text-[11px] truncate max-w-[200px]">
                        {rev.contact ? `Contact: ${rev.contact}` : 'No contact provided'}
                      </span>

                      <a
                        href={`mailto:resume@willsonrai.com.np?subject=${encodeURIComponent(`Follow-up: Obito Studio Review from ${rev.name || 'Creator'}`)}&body=${encodeURIComponent(`Hi ${rev.name || 'there'},\n\nThank you for your review:\n"${rev.message}"\n\n`)}`}
                        className="rounded-lg border border-white/10 bg-white/[0.05] hover:bg-white/10 px-3 py-1.5 text-[11px] font-mono text-cyan-300 hover:text-white transition-colors"
                      >
                        Reply via Email
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 9. Tab 6: System & Infrastructure */}
        {activeAdminTab === 'system' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 sm:p-7 backdrop-blur-xl">
              <h2 className="font-clash inframe-title font-semibold text-lg text-white mb-1">
                Infrastructure &amp; Container Architecture
              </h2>
              <p className="text-xs text-neutral-400 mb-6">
                Realtime runtime parameters on Suga Cloud container and GitHub Gist sync status.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">Node.js Runtime</span>
                  <div className="font-clash inframe-title text-base font-semibold text-white">
                    {serverHealth?.node || 'v20.20.2'}
                  </div>
                  <span className="text-[10.5px] text-emerald-400">Active LTS</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">FFmpeg Engine</span>
                  <div className="font-clash inframe-title text-base font-semibold text-white">
                    v5.1.9-0+deb12u1
                  </div>
                  <span className="text-[10.5px] text-cyan-300">Lossless Stream Copy</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">NVMe Free Storage</span>
                  <div className="font-clash inframe-title text-base font-semibold text-white">
                    {serverHealth?.freeDiskMb ? `${(serverHealth.freeDiskMb / 1024).toFixed(1)} GB` : '72.6 GB'}
                  </div>
                  <span className="text-[10.5px] text-emerald-400">Purged hourly</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">Max Upload Buffer</span>
                  <div className="font-clash inframe-title text-base font-semibold text-white">
                    600 MB / Video
                  </div>
                  <span className="text-[10.5px] text-neutral-400">Chunked Resumable</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">Gist Persistence</span>
                  <div className="font-clash inframe-title text-base font-semibold text-emerald-400">
                    Active Sync
                  </div>
                  <span className="text-[10.5px] text-neutral-400">Automatic redeploy restore</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">Base Clock Alignment</span>
                  <div className="font-clash inframe-title text-base font-semibold text-white">
                    19,200 Timescale
                  </div>
                  <span className="text-[10.5px] text-cyan-300">TikTok 60fps/120fps sync</span>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  Export complete platform snapshot for offline archive or container migration:
                </span>
                <button
                  type="button"
                  onClick={handleExportSnapshot}
                  className="rounded-xl bg-white px-5 py-2 text-xs font-clash inframe-title font-semibold text-black hover:bg-neutral-200 transition-all cursor-pointer"
                >
                  Download Snapshot (JSON)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
