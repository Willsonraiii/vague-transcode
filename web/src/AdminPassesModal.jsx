import React, { useState, useEffect, useCallback } from 'react';
import { CloseIcon, CheckIcon, PremiumKeyIcon, KeyIcon } from './icons';

export default function AdminPassesModal({ apiKey, onClose }) {
  const [activeTab, setActiveTab] = useState('referrals'); // 'referrals' | 'clients'
  const [referrals, setReferrals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [expandedRefCode, setExpandedRefCode] = useState(null);
  const [clientFilterRef, setClientFilterRef] = useState('ALL');
  const [clientSearch, setClientSearch] = useState('');

  // New Referral Form
  const [newRefCode, setNewRefCode] = useState('');
  const [newRefMaxUses, setNewRefMaxUses] = useState('1');
  const [newRefNote, setNewRefNote] = useState('');
  const [creatingRef, setCreatingRef] = useState(false);

  // New Client Form
  const [newClientName, setNewClientName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Telemetry & Reviews State
  const [telemetryData, setTelemetryData] = useState({ totalOptimizations: 0, pipelineStats: {}, userLeaderboard: [], recentJobs: [] });
  const [reviewsData, setReviewsData] = useState([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [telemetrySearch, setTelemetrySearch] = useState('');

  const getAuthToken = useCallback(() => {
    return apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('obitoKey') : '') || '';
  }, [apiKey]);

  const fetchTelemetry = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      setLoadingTelemetry(true);
      const res = await fetch('/api/admin/optimizations', { headers: { 'x-access-token': token } });
      const data = await res.json();
      if (data?.ok) {
        setTelemetryData({
          totalOptimizations: data.totalOptimizations || 0,
          pipelineStats: data.pipelineStats || {},
          userLeaderboard: data.userLeaderboard || [],
          recentJobs: data.recentJobs || [],
        });
      }
    } catch {
      /* silent */
    } finally {
      setLoadingTelemetry(false);
    }
  }, [getAuthToken]);

  const fetchReviews = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      setLoadingReviews(true);
      const res = await fetch('/api/admin/reviews', { headers: { 'x-access-token': token } });
      const data = await res.json();
      if (data?.ok) {
        setReviewsData(data.reviews || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingReviews(false);
    }
  }, [getAuthToken]);

  const fetchMembers = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setError('Admin access token is missing. Please sign in as owner.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/members', {
        headers: { 'x-access-token': token }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load member passes');
      setReferrals(data.referrals || []);
      setClients(data.clients || []);
      fetchTelemetry();
      fetchReviews();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, fetchTelemetry, fetchReviews]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateReferral = async (e) => {
    e.preventDefault();
    if (!newRefCode.trim()) return;
    try {
      setCreatingRef(true);
      setError('');
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-token': getAuthToken() },
        body: JSON.stringify({
          code: newRefCode.trim().toUpperCase(),
          maxUses: newRefMaxUses === 'unlimited' ? null : parseInt(newRefMaxUses, 10) || 1,
          note: newRefNote.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not create referral code');
      setNewRefCode('');
      setNewRefNote('');
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingRef(false);
    }
  };

  const handleToggleReferral = async (code) => {
    try {
      setError('');
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(code)}/toggle`, {
        method: 'POST',
        headers: { 'x-access-token': getAuthToken() }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to toggle referral status');
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteReferral = async (code) => {
    if (!window.confirm(`Delete referral code "${code}"?`)) return;
    try {
      setError('');
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { 'x-access-token': getAuthToken() }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete referral');
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      setCreatingClient(true);
      setError('');
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-token': getAuthToken() },
        body: JSON.stringify({
          name: newClientName.trim(),
          customId: newClientId.trim(),
          customCode: newClientCode.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not create client');
      setNewClientName('');
      setNewClientId('');
      setNewClientCode('');
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleToggleClient = async (id) => {
    try {
      setError('');
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        headers: { 'x-access-token': getAuthToken() }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to toggle client status');
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm(`Delete client "${id}"?`)) return;
    try {
      setError('');
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-access-token': getAuthToken() }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete client');
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  // Quick stats calculations
  const activeReferralsCount = referrals.filter((r) => r.status === 'active').length;
  const activeClientsCount = clients.filter((c) => c.status === 'active').length;
  const redeemedTotalCount = clients.filter((c) => c.referralCode).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-xl overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[94svh] sm:max-h-[90svh] flex flex-col rounded-2xl sm:rounded-3xl border border-white/15 bg-[#090b11]/95 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-white/[0.08] bg-[#090b11]/90 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="size-8 sm:size-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <PremiumKeyIcon width={17} height={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-clash inframe-title font-medium text-sm sm:text-base text-white tracking-[-0.01em] truncate">
                  Owner Admin Dashboard
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-400 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Gist Synced
                </span>
              </div>
              <p className="font-sans text-[11px] sm:text-xs text-neutral-400 truncate">
                Manage referral passes, client logins &amp; private invite keys
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="size-8 sm:size-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
              onClick={onClose}
              aria-label="Close admin dashboard"
            >
              <CloseIcon width={15} height={15} />
            </button>
          </div>
        </div>

        {/* Executive Telemetry Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pt-3.5 pb-2 sm:px-6 sm:pt-4 sm:pb-3 border-b border-white/[0.06] bg-white/[0.015]">
          <div className="rounded-xl p-2 sm:p-2.5 bg-white/[0.025] border border-white/[0.06] text-center">
            <span className="block font-sans text-[10px] sm:text-[11px] text-neutral-400 uppercase tracking-wider">
              Referral Codes
            </span>
            <span className="block font-clash inframe-title font-medium text-xs sm:text-base text-amber-300 mt-0.5">
              {activeReferralsCount} <span className="text-[10px] text-neutral-400 font-normal">/ {referrals.length}</span>
            </span>
          </div>

          <div className="rounded-xl p-2 sm:p-2.5 bg-white/[0.025] border border-white/[0.06] text-center">
            <span className="block font-sans text-[10px] sm:text-[11px] text-neutral-400 uppercase tracking-wider">
              Clients
            </span>
            <span className="block font-clash inframe-title font-medium text-xs sm:text-base text-emerald-400 mt-0.5">
              {activeClientsCount} <span className="text-[10px] text-neutral-400 font-normal">/ {clients.length}</span>
            </span>
          </div>

          <div className="rounded-xl p-2 sm:p-2.5 bg-white/[0.025] border border-white/[0.06] text-center">
            <span className="block font-sans text-[10px] sm:text-[11px] text-neutral-400 uppercase tracking-wider">
              Total Optimizations
            </span>
            <span className="block font-clash inframe-title font-medium text-xs sm:text-base text-cyan-300 mt-0.5">
              {telemetryData.totalOptimizations || 0} <span className="text-[10px] text-neutral-400 font-normal">masters</span>
            </span>
          </div>

          <div className="rounded-xl p-2 sm:p-2.5 bg-white/[0.025] border border-white/[0.06] text-center">
            <span className="block font-sans text-[10px] sm:text-[11px] text-neutral-400 uppercase tracking-wider">
              Creator Reviews
            </span>
            <span className="block font-clash inframe-title font-medium text-xs sm:text-base text-purple-300 mt-0.5">
              {reviewsData.length} <span className="text-[10px] text-neutral-400 font-normal">feedback</span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Liquid-Glass Segmented Control) */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-b border-white/[0.06] bg-[#090b11] overflow-x-auto">
          <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] min-w-max sm:w-full">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'referrals'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
              onClick={() => setActiveTab('referrals')}
            >
              <span>Referrals</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'referrals' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-neutral-400'
              }`}>
                {referrals.length}
              </span>
            </button>

            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'clients'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
              onClick={() => setActiveTab('clients')}
            >
              <span>Clients</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'clients' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-neutral-400'
              }`}>
                {clients.length}
              </span>
            </button>

            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'telemetry'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
              onClick={() => setActiveTab('telemetry')}
            >
              <span>Optimizations &amp; Pipelines</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'telemetry' ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/10 text-neutral-400'
              }`}>
                {telemetryData.totalOptimizations || 0}
              </span>
            </button>

            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'reviews'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
              onClick={() => setActiveTab('reviews')}
            >
              <span>Reviews</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'reviews' ? 'bg-purple-400/20 text-purple-300' : 'bg-white/10 text-neutral-400'
              }`}>
                {reviewsData.length}
              </span>
            </button>
          </div>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="mx-4 mt-3 sm:mx-6 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-200">
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        )}

        {/* Scrollable Tab Content Container */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-5 space-y-4">
          {/* TAB 1: REFERRAL CODES */}
          {activeTab === 'referrals' && (
            <div className="space-y-4">
              {/* Create Referral Code Card */}
              <form onSubmit={handleCreateReferral} className="rounded-2xl p-4 sm:p-5 bg-white/[0.025] border border-white/[0.08] shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <KeyIcon width={14} height={14} className="text-amber-400" />
                  <h3 className="font-clash inframe-title font-medium text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
                    Create New Referral Code
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-neutral-400">Referral Code</label>
                    <input
                      className="h-10 px-3 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-xl focus:border-amber-400/60 focus:bg-white/[0.07] outline-none text-white font-mono uppercase transition-all"
                      placeholder="e.g. TIKTOK60 or VIP-NEPAL"
                      value={newRefCode}
                      onChange={(e) => setNewRefCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-neutral-400">Max Redemptions</label>
                    <select
                      className="h-10 px-3 text-xs sm:text-sm bg-neutral-900 border border-white/10 rounded-xl focus:border-amber-400/60 outline-none text-white transition-all cursor-pointer"
                      value={newRefMaxUses}
                      onChange={(e) => setNewRefMaxUses(e.target.value)}
                    >
                      <option value="1">1 time use</option>
                      <option value="3">3 times</option>
                      <option value="5">5 times</option>
                      <option value="10">10 times</option>
                      <option value="25">25 times</option>
                      <option value="unlimited">Unlimited uses (∞)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <label className="text-[11px] font-medium text-neutral-400">Note / Recipient (Optional)</label>
                    <input
                      className="h-10 px-3 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-xl focus:border-amber-400/60 focus:bg-white/[0.07] outline-none text-white transition-all"
                      placeholder="e.g. For WhatsApp friend, VIP creator"
                      value={newRefNote}
                      onChange={(e) => setNewRefNote(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingRef}
                  className="mt-3.5 w-full sm:w-auto h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-clash inframe-title font-semibold text-xs sm:text-[13px] shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {creatingRef ? 'Generating…' : '+ Add Referral Code'}
                </button>
              </form>

              {/* Referral Codes List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h4 className="font-clash inframe-title font-medium text-xs sm:text-[13px] text-neutral-300 uppercase tracking-wider">
                    Active Passes ({referrals.length})
                  </h4>
                  <span className="text-[11px] text-neutral-400">Tap Users to monitor claims</span>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-neutral-400 font-clash inframe-title">
                    Loading referral passes…
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 text-xs text-neutral-400">
                    No referral passes created yet. Create one above!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {referrals.map((ref) => {
                      const isExhausted = ref.maxUses !== null && ref.usedCount >= ref.maxUses;
                      const isExpanded = expandedRefCode === ref.code;
                      const redeemedClients = clients.filter(
                        (c) => (c.referralCode || '').toUpperCase() === ref.code.toUpperCase()
                      );

                      return (
                        <div
                          key={ref.code}
                          className="rounded-2xl bg-white/[0.025] border border-white/[0.08] hover:border-white/15 transition-all overflow-hidden"
                        >
                          <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs sm:text-sm text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                  {ref.code}
                                </span>

                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                  ref.status !== 'active'
                                    ? 'bg-neutral-800 text-neutral-400'
                                    : isExhausted
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}>
                                  {ref.status !== 'active' ? 'Disabled' : isExhausted ? 'Exhausted' : 'Active'}
                                </span>

                                <span className="text-[11px] text-neutral-400 font-mono">
                                  {ref.usedCount || 0} / {ref.maxUses === null ? '∞' : ref.maxUses} used
                                </span>
                              </div>

                              {ref.note && (
                                <p className="text-xs text-neutral-400 italic">
                                  "{ref.note}"
                                </p>
                              )}
                            </div>

                            {/* Responsive Action Toolbar */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0 shrink-0">
                              <button
                                type="button"
                                className={`h-8 px-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                  isExpanded
                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                    : 'bg-white/[0.05] text-neutral-300 border-white/10 hover:bg-white/[0.1] hover:text-white'
                                }`}
                                onClick={() => setExpandedRefCode(isExpanded ? null : ref.code)}
                                title="View clients who redeemed this code"
                              >
                                👥 {redeemedClients.length} {redeemedClients.length === 1 ? 'user' : 'users'} {isExpanded ? '▲' : '▼'}
                              </button>

                              <button
                                type="button"
                                className="h-8 px-2.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer"
                                onClick={() => copyToClipboard(ref.code, `ref_${ref.code}`)}
                                title="Copy Code to Clipboard"
                              >
                                {copiedKey === `ref_${ref.code}` ? 'Copied ✓' : 'Copy'}
                              </button>

                              <button
                                type="button"
                                className="h-8 px-2.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer"
                                onClick={() => handleToggleReferral(ref.code)}
                              >
                                {ref.status === 'active' ? 'Disable' : 'Enable'}
                              </button>

                              <button
                                type="button"
                                className="size-8 rounded-lg flex items-center justify-center text-xs font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                                onClick={() => handleDeleteReferral(ref.code)}
                                title="Delete Referral Code"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Expandable Redeemed Users Drawer */}
                          {isExpanded && (
                            <div className="px-3.5 py-3 sm:px-4 sm:py-3.5 bg-black/40 border-t border-white/[0.08] space-y-2.5">
                              <div className="flex items-center justify-between gap-2 text-xs text-neutral-300">
                                <span>
                                  Redeemed by <strong className="text-white">{redeemedClients.length}</strong> client{redeemedClients.length === 1 ? '' : 's'} with code <code className="text-cyan-400">{ref.code}</code>
                                </span>
                                {redeemedClients.length > 0 && (
                                  <button
                                    type="button"
                                    className="text-cyan-400 hover:text-cyan-300 text-xs font-medium underline cursor-pointer"
                                    onClick={() => {
                                      setClientFilterRef(ref.code);
                                      setActiveTab('clients');
                                    }}
                                  >
                                    Filter in Clients tab →
                                  </button>
                                )}
                              </div>

                              {redeemedClients.length === 0 ? (
                                <p className="text-xs text-neutral-500 py-2">
                                  No clients have claimed this pass code yet.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {redeemedClients.map((c) => (
                                    <div
                                      key={c.clientId}
                                      className="p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-xs sm:text-sm text-white">
                                            {c.name || 'Referral User'}
                                          </span>
                                          <span className={`px-1.5 py-0.2 rounded text-[9.5px] uppercase font-bold ${
                                            c.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                                          }`}>
                                            {c.status === 'active' ? 'Active' : 'Revoked'}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                                          <span>ID: <code className="text-white font-mono">{c.clientId}</code></span>
                                          <span>Code: <code className="text-amber-300 font-mono">{c.accessCode}</code></span>
                                          {c.createdAt && (
                                            <span className="text-neutral-500">
                                              {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                                        <button
                                          type="button"
                                          className="h-7 px-2.5 rounded-lg text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white transition-all cursor-pointer"
                                          onClick={() => copyToClipboard(`Client ID: ${c.clientId}\nAccess Code: ${c.accessCode}\nURL: https://obitostudio.willsonrai.com.np`, `cred_${c.clientId}`)}
                                        >
                                          {copiedKey === `cred_${c.clientId}` ? 'Copied ✓' : 'Copy Credentials'}
                                        </button>

                                        <button
                                          type="button"
                                          className={`h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                                            c.status === 'active'
                                              ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                          }`}
                                          onClick={() => handleToggleClient(c.clientId)}
                                        >
                                          {c.status === 'active' ? 'Revoke' : 'Activate'}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REGISTERED CLIENTS */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              {/* Manually Create Client Pass Card */}
              <form onSubmit={handleCreateClient} className="rounded-2xl p-4 sm:p-5 bg-white/[0.025] border border-white/[0.08] shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <KeyIcon width={14} height={14} className="text-emerald-400" />
                  <h3 className="font-clash inframe-title font-medium text-xs sm:text-sm text-emerald-300 uppercase tracking-wider">
                    Manually Create Client Pass
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-neutral-400">Client Name / Label</label>
                    <input
                      className="h-10 px-3 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-xl focus:border-emerald-400/60 focus:bg-white/[0.07] outline-none text-white transition-all"
                      placeholder="e.g. Rohan Sharma"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-neutral-400">Custom Client ID (optional)</label>
                    <input
                      className="h-10 px-3 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-xl focus:border-emerald-400/60 focus:bg-white/[0.07] outline-none text-white font-mono transition-all"
                      placeholder="Leave blank to auto-generate"
                      value={newClientId}
                      onChange={(e) => setNewClientId(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <label className="text-[11px] font-medium text-neutral-400">Custom Access Code (optional)</label>
                    <input
                      className="h-10 px-3 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-xl focus:border-emerald-400/60 focus:bg-white/[0.07] outline-none text-white font-mono transition-all"
                      placeholder="Leave blank to auto-generate"
                      value={newClientCode}
                      onChange={(e) => setNewClientCode(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingClient}
                  className="mt-3.5 w-full sm:w-auto h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-clash inframe-title font-semibold text-xs sm:text-[13px] shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {creatingClient ? 'Generating…' : '+ Generate Client Pass'}
                </button>
              </form>

              {/* Filter and Search Bar */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      className="h-10 px-3.5 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-xl focus:border-cyan-400/60 outline-none text-white flex-1 transition-all"
                      placeholder="Search name, client ID, or code…"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />

                    <select
                      className="h-10 px-3 text-xs sm:text-sm bg-neutral-900 border border-white/10 rounded-xl focus:border-cyan-400/60 outline-none text-white transition-all cursor-pointer sm:w-56"
                      value={clientFilterRef}
                      onChange={(e) => setClientFilterRef(e.target.value)}
                    >
                      <option value="ALL">All Sources ({clients.length})</option>
                      <option value="MANUAL">Manual Creation ({clients.filter((c) => !c.referralCode).length})</option>
                      {referrals.map((r) => {
                        const count = clients.filter((c) => (c.referralCode || '').toUpperCase() === r.code.toUpperCase()).length;
                        return (
                          <option key={r.code} value={r.code}>
                            via {r.code} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {clientFilterRef !== 'ALL' && (
                    <button
                      type="button"
                      className="h-9 px-3 rounded-lg text-xs font-medium text-cyan-400 hover:text-cyan-300 border border-cyan-400/30 bg-cyan-400/10 cursor-pointer self-start sm:self-center"
                      onClick={() => setClientFilterRef('ALL')}
                    >
                      Reset filter
                    </button>
                  )}
                </div>

                {/* Clients List */}
                {loading ? (
                  <div className="py-12 text-center text-xs text-neutral-400 font-clash inframe-title">
                    Loading clients…
                  </div>
                ) : clients.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 text-xs text-neutral-400">
                    No registered clients yet.
                  </div>
                ) : (
                  (() => {
                    const filteredClients = clients.filter((c) => {
                      if (clientFilterRef === 'MANUAL' && c.referralCode) return false;
                      if (clientFilterRef !== 'ALL' && clientFilterRef !== 'MANUAL') {
                        if ((c.referralCode || '').toUpperCase() !== clientFilterRef.toUpperCase()) return false;
                      }
                      if (clientSearch.trim()) {
                        const q = clientSearch.trim().toLowerCase();
                        const matchName = (c.name || '').toLowerCase().includes(q);
                        const matchId = (c.clientId || '').toLowerCase().includes(q);
                        const matchCode = (c.accessCode || '').toLowerCase().includes(q);
                        const matchRef = (c.referralCode || '').toLowerCase().includes(q);
                        if (!matchName && !matchId && !matchCode && !matchRef) return false;
                      }
                      return true;
                    });

                    if (filteredClients.length === 0) {
                      return (
                        <div className="py-10 text-center rounded-2xl border border-dashed border-white/10 text-xs text-neutral-400">
                          No clients match the current search or filter.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5">
                        {filteredClients.map((c) => (
                          <div
                            key={c.clientId}
                            className={`p-3.5 sm:p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              c.status !== 'active' ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-xs sm:text-sm text-white">
                                  {c.name || 'Client'}
                                </span>

                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  c.status === 'active'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                                }`}>
                                  {c.status === 'active' ? 'Active' : 'Revoked'}
                                </span>

                                {c.referralCode ? (
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all cursor-pointer"
                                    onClick={() => setClientFilterRef(c.referralCode)}
                                    title={`Filter all users who used ${c.referralCode}`}
                                  >
                                    via {c.referralCode}
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] text-neutral-400 bg-white/5 border border-white/10 font-mono">
                                    manual
                                  </span>
                                )}

                                {c.createdAt && (
                                  <span className="text-[11px] text-neutral-500">
                                    {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <span className="text-neutral-400">
                                  ID: <code className="text-white font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">{c.clientId}</code>
                                </span>
                                <span className="text-neutral-400">
                                  Code: <code className="text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">{c.accessCode}</code>
                                </span>
                              </div>
                            </div>

                            {/* Responsive Action Toolbar */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0 shrink-0">
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white transition-all cursor-pointer"
                                onClick={() => copyToClipboard(`Obito Studio Access Pass\nClient ID: ${c.clientId}\nAccess Code: ${c.accessCode}\nDirect Login: https://obitostudio.willsonrai.com.np`, `cred_${c.clientId}`)}
                                title="Copy WhatsApp formatted credentials"
                              >
                                {copiedKey === `cred_${c.clientId}` ? 'Copied ✓' : 'Copy Credentials'}
                              </button>

                              <button
                                type="button"
                                className={`h-8 px-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                  c.status === 'active'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                }`}
                                onClick={() => handleToggleClient(c.clientId)}
                              >
                                {c.status === 'active' ? 'Revoke' : 'Activate'}
                              </button>

                              <button
                                type="button"
                                className="size-8 rounded-lg flex items-center justify-center text-xs font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                                onClick={() => handleDeleteClient(c.clientId)}
                                title="Delete Client"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OPTIMIZATIONS & PIPELINES TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              {/* Pipeline Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl p-3.5 bg-white/[0.025] border border-white/[0.08] backdrop-blur-md">
                  <span className="block text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                    HDR Rec.2020 / HLG
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-clash inframe-title font-medium text-xl text-cyan-300">
                      {telemetryData.pipelineStats?.hdr || 0}
                    </span>
                    <span className="text-xs text-neutral-400">runs</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">Apple 10-bit &amp; Dolby Vision remux</span>
                </div>

                <div className="rounded-xl p-3.5 bg-white/[0.025] border border-white/[0.08] backdrop-blur-md">
                  <span className="block text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                    Standard Rec.709
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-clash inframe-title font-medium text-xl text-neutral-200">
                      {telemetryData.pipelineStats?.standard || 0}
                    </span>
                    <span className="text-xs text-neutral-400">runs</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">SDR Rec.709 60/120fps sync</span>
                </div>

                <div className="rounded-xl p-3.5 bg-white/[0.025] border border-white/[0.08] backdrop-blur-md">
                  <span className="block text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                    AVC1 Tagged
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-clash inframe-title font-medium text-xl text-purple-300">
                      {telemetryData.pipelineStats?.h264Tagged || 0}
                    </span>
                    <span className="text-xs text-neutral-400">runs</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">H.264 fourcc atom compatibility</span>
                </div>
              </div>

              {/* User Leaderboard: Which user did how many optimizes */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div>
                    <h3 className="font-clash inframe-title font-medium text-sm sm:text-base text-white">
                      Creator Optimization Breakdown
                    </h3>
                    <p className="font-sans text-xs text-neutral-400">
                      Check how many optimizations each user completed and their preferred pipeline.
                    </p>
                  </div>

                  <input
                    type="text"
                    value={telemetrySearch}
                    onChange={(e) => setTelemetrySearch(e.target.value)}
                    placeholder="Search by client ID or name…"
                    className="h-8 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400/50 w-full sm:w-60"
                  />
                </div>

                <div className="mt-4 space-y-2.5">
                  {(() => {
                    const filtered = (telemetryData.userLeaderboard || []).filter((u) => {
                      if (!telemetrySearch.trim()) return true;
                      const q = telemetrySearch.toLowerCase();
                      return u.clientId?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q);
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-6 text-center text-xs text-neutral-500 font-mono">
                          No client optimizations found matching query.
                        </div>
                      );
                    }

                    return filtered.map((u) => (
                      <div
                        key={u.clientId}
                        className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs sm:text-sm text-white">
                              {u.name || u.clientId}
                            </span>
                            <code className="text-[11px] font-mono text-neutral-400 bg-white/[0.05] px-1.5 py-0.2 rounded">
                              {u.clientId}
                            </code>
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono border ${
                              u.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {u.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-neutral-400">
                            <span>Primary: <strong className="text-neutral-300 font-normal">{u.primaryPipeline}</strong></span>
                            <span>•</span>
                            <span>Last Active: <strong className="text-neutral-300 font-normal">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : 'Never'}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-center min-w-24">
                            <span className="block font-clash inframe-title font-medium text-sm text-cyan-300">
                              {u.optimizationsCount}
                            </span>
                            <span className="block text-[10px] font-mono uppercase text-neutral-400">
                              Optimizations
                            </span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Recent Jobs Telemetry Stream */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5 backdrop-blur-xl">
                <h3 className="font-clash inframe-title font-medium text-sm sm:text-base text-white mb-1">
                  Recent Mastered Jobs Stream
                </h3>
                <p className="font-sans text-xs text-neutral-400 mb-3">
                  Audit log of recent container surgery runs across all users.
                </p>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {(telemetryData.recentJobs || []).length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-500 font-mono">
                      No jobs recorded yet.
                    </div>
                  ) : (
                    telemetryData.recentJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-2.5 rounded-lg bg-white/[0.015] border border-white/[0.05] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-neutral-200 truncate max-w-xs">
                              {job.fileName || 'video'}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                              {job.mode === 'standard' ? 'Std 709' : 'HDR HLG'}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              by <code className="text-neutral-400">{job.clientId}</code>
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-500 font-mono block">
                            {job.in ? `${job.in.w}x${job.in.h} @ ${job.in.fps}fps` : ''} · {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : ''} · {new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 uppercase ${
                          job.status === 'done' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CREATOR REVIEWS & FEEDBACK */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06] flex-wrap">
                  <div>
                    <h3 className="font-clash inframe-title font-medium text-sm sm:text-base text-white">
                      Creator Reviews &amp; Experience Ratings
                    </h3>
                    <p className="font-sans text-xs text-neutral-400">
                      Direct feedback submitted by creators on video optimization quality and site satisfaction.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchReviews}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 cursor-pointer"
                  >
                    ↻ Refresh Reviews
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {reviewsData.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <div className="text-2xl text-neutral-600">★</div>
                      <p className="font-sans text-xs text-neutral-400">No reviews submitted yet.</p>
                      <span className="text-[11px] text-neutral-500">Reviews submitted from the site feedback form will land here instantly.</span>
                    </div>
                  ) : (
                    reviewsData.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.06] space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-amber-400 font-mono text-sm tracking-wider">
                                {'★'.repeat(rev.rating || 5)}{'☆'.repeat(5 - (rev.rating || 5))}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                {rev.category}
                              </span>
                            </div>
                            <span className="font-sans text-xs font-medium text-white block">
                              {rev.name || 'Creator'} <span className="text-neutral-500 font-normal">({rev.clientId})</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {rev.contact && (
                              <a
                                href={`mailto:${rev.contact}?subject=Obito Studio Support`}
                                className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-cyan-300 transition-all"
                              >
                                Reply via Email
                              </a>
                            )}
                            <span className="text-[11px] text-neutral-500 font-mono">
                              {new Date(rev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <p className="font-sans text-xs text-neutral-300 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/[0.04]">
                          "{rev.message}"
                        </p>

                        {rev.contact && (
                          <div className="text-[11px] text-neutral-500 font-mono">
                            Contact: <code className="text-neutral-400">{rev.contact}</code>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
