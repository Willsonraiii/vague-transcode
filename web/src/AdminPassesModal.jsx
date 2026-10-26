import React, { useState, useEffect, useCallback } from 'react';
import { CloseIcon, CheckIcon, PremiumKeyIcon, SparkIcon } from './icons';

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

  const getAuthToken = useCallback(() => {
    return apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('obitoKey') : '') || '';
  }, [apiKey]);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

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
          code: newRefCode.trim(),
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal admin-passes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="admin-modal-title-row">
            <PremiumKeyIcon width={18} height={18} />
            <span className="modal-title">Access & Referral Pass Manager</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {error && <div className="admin-error-banner" role="alert">{error}</div>}

        <div className="admin-tab-bar">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'referrals' ? 'active' : ''}`}
            onClick={() => setActiveTab('referrals')}
          >
            Referral / Invite Codes ({referrals.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('clients')}
          >
            Registered Clients ({clients.length})
          </button>
        </div>

        {activeTab === 'referrals' && (
          <div className="admin-tab-content">
            {/* Create Referral Section */}
            <form className="admin-create-card" onSubmit={handleCreateReferral}>
              <h3 className="admin-card-heading">
                <SparkIcon width={14} height={14} /> Create New Referral Code
              </h3>
              <div className="admin-form-grid">
                <div className="admin-input-group">
                  <label>Referral Code</label>
                  <input
                    className="studio-input"
                    placeholder="e.g. VIP-FRIEND or PROMO50"
                    value={newRefCode}
                    onChange={(e) => setNewRefCode(e.target.value)}
                    required
                  />
                </div>
                <div className="admin-input-group">
                  <label>Max Redemptions</label>
                  <select
                    className="studio-input"
                    value={newRefMaxUses}
                    onChange={(e) => setNewRefMaxUses(e.target.value)}
                  >
                    <option value="1">1 time use</option>
                    <option value="3">3 times</option>
                    <option value="5">5 times</option>
                    <option value="10">10 times</option>
                    <option value="25">25 times</option>
                    <option value="unlimited">Unlimited uses</option>
                  </select>
                </div>
                <div className="admin-input-group full-width">
                  <label>Note / Recipient (Optional)</label>
                  <input
                    className="studio-input"
                    placeholder="e.g. For WhatsApp friend, VIP client"
                    value={newRefNote}
                    onChange={(e) => setNewRefNote(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary-hero admin-submit-btn" disabled={creatingRef}>
                {creatingRef ? 'Generating…' : '+ Add Referral Code'}
              </button>
            </form>

            {/* List of Referrals */}
            {/* List of Referrals */}
            <div className="admin-list-section">
              <div className="admin-section-sub-row">
                <h4 className="admin-section-sub">Active Referral Codes</h4>
                <span className="admin-section-caption">
                  Click 👥 Users on any code to monitor who redeemed it
                </span>
              </div>
              {loading ? (
                <div className="admin-empty-state">Loading passes…</div>
              ) : error ? (
                <div className="admin-empty-state admin-error-state">
                  <span>Failed to load referral passes: {error}</span>
                  <button type="button" className="btn-secondary" onClick={fetchMembers} style={{ marginTop: '8px' }}>Retry</button>
                </div>
              ) : referrals.length === 0 ? (
                <div className="admin-empty-state">No referral codes yet. Create one above!</div>
              ) : (
                <div className="admin-items-stack">
                  {referrals.map((ref) => {
                    const isExhausted = ref.maxUses !== null && ref.usedCount >= ref.maxUses;
                    const isExpanded = expandedRefCode === ref.code;
                    const redeemedClients = clients.filter(
                      (c) => (c.referralCode || '').toUpperCase() === ref.code.toUpperCase()
                    );
                    return (
                      <div key={ref.code} className="admin-referral-card-group">
                        <div className={`admin-item-row ${ref.status !== 'active' ? 'disabled' : ''}`}>
                          <div className="admin-item-info">
                            <div className="admin-item-badge-row">
                              <span className="admin-code-badge">{ref.code}</span>
                              <span className={`admin-status-pill ${ref.status === 'active' && !isExhausted ? 'active' : 'inactive'}`}>
                                {ref.status !== 'active' ? 'Disabled' : isExhausted ? 'Exhausted' : 'Active'}
                              </span>
                              <span className="admin-usage-count">
                                {ref.usedCount || 0} / {ref.maxUses === null ? '∞' : ref.maxUses} used
                              </span>
                            </div>
                            {ref.note && <p className="admin-item-note">{ref.note}</p>}
                          </div>
                          <div className="admin-item-actions">
                            <button
                              type="button"
                              className={`btn-secondary admin-action-btn ${isExpanded ? 'active-ref-btn' : ''}`}
                              onClick={() => setExpandedRefCode(isExpanded ? null : ref.code)}
                              title="Monitor users who redeemed this code"
                            >
                              👥 {redeemedClients.length} {redeemedClients.length === 1 ? 'user' : 'users'} {isExpanded ? '▲' : '▼'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary admin-action-btn"
                              onClick={() => copyToClipboard(ref.code, `ref_${ref.code}`)}
                              title="Copy Code"
                            >
                              {copiedKey === `ref_${ref.code}` ? 'Copied ✓' : 'Copy'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary admin-action-btn"
                              onClick={() => handleToggleReferral(ref.code)}
                            >
                              {ref.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary admin-action-btn danger"
                              onClick={() => handleDeleteReferral(ref.code)}
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Expandable Redeemed Users Drawer */}
                        {isExpanded && (
                          <div className="admin-redeemed-drawer">
                            <div className="admin-redeemed-drawer-header">
                              <span className="drawer-title">
                                Redeemed by <strong>{redeemedClients.length}</strong> {redeemedClients.length === 1 ? 'client' : 'clients'} for code <code>{ref.code}</code>
                              </span>
                              {redeemedClients.length > 0 && (
                                <button
                                  type="button"
                                  className="admin-link-btn"
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
                              <div className="admin-drawer-empty">No clients have redeemed this code yet.</div>
                            ) : (
                              <div className="admin-drawer-list">
                                {redeemedClients.map((c) => (
                                  <div key={c.clientId} className="admin-drawer-item">
                                    <div className="admin-drawer-item-main">
                                      <div className="drawer-user-title-row">
                                        <span className="drawer-user-name">{c.name || 'Referral User'}</span>
                                        <span className={`admin-status-pill ${c.status === 'active' ? 'active' : 'inactive'}`}>
                                          {c.status === 'active' ? 'Active' : 'Revoked'}
                                        </span>
                                      </div>
                                      <div className="drawer-user-sub">
                                        <span className="drawer-user-id">ID: <code>{c.clientId}</code></span>
                                        <span className="drawer-user-code">Code: <code>{c.accessCode}</code></span>
                                        {c.createdAt && (
                                          <span className="drawer-user-time">
                                            Redeemed: {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="admin-drawer-item-actions">
                                      <button
                                        type="button"
                                        className="btn-secondary admin-action-btn"
                                        onClick={() => copyToClipboard(`Client ID: ${c.clientId}\nAccess Code: ${c.accessCode}`, `cred_${c.clientId}`)}
                                        title="Copy Credentials"
                                      >
                                        {copiedKey === `cred_${c.clientId}` ? 'Copied ✓' : 'Copy'}
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn-secondary admin-action-btn ${c.status === 'active' ? 'danger' : ''}`}
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

        {activeTab === 'clients' && (
          <div className="admin-tab-content">
            {/* Manually Create Client Pass */}
            <form className="admin-create-card" onSubmit={handleCreateClient}>
              <h3 className="admin-card-heading">
                <SparkIcon width={14} height={14} /> Manually Create Client Pass
              </h3>
              <div className="admin-form-grid">
                <div className="admin-input-group">
                  <label>Client Name / Label</label>
                  <input
                    className="studio-input"
                    placeholder="e.g. Rohan Sharma"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    required
                  />
                </div>
                <div className="admin-input-group">
                  <label>Custom Client ID (optional)</label>
                  <input
                    className="studio-input"
                    placeholder="Leave blank to auto-generate"
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                  />
                </div>
                <div className="admin-input-group full-width">
                  <label>Custom Access Code (optional)</label>
                  <input
                    className="studio-input"
                    placeholder="Leave blank to auto-generate"
                    value={newClientCode}
                    onChange={(e) => setNewClientCode(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary-hero admin-submit-btn" disabled={creatingClient}>
                {creatingClient ? 'Generating…' : '+ Generate Client Pass'}
              </button>
            </form>

            {/* List of Clients with Filter & Search */}
            <div className="admin-list-section">
              <div className="admin-section-sub-row">
                <h4 className="admin-section-sub">Registered Client Credentials</h4>
                {clientFilterRef !== 'ALL' && (
                  <span className="admin-active-filter-indicator">
                    Filtered by: <strong>{clientFilterRef}</strong>
                  </span>
                )}
              </div>

              {/* Filter controls */}
              <div className="admin-clients-filter-bar">
                <input
                  type="text"
                  className="studio-input admin-filter-search"
                  placeholder="Search name, client ID, or code…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <select
                  className="studio-input admin-filter-select"
                  value={clientFilterRef}
                  onChange={(e) => setClientFilterRef(e.target.value)}
                >
                  <option value="ALL">All Sources ({clients.length})</option>
                  <option value="MANUAL">Manual Creation ({clients.filter((c) => !c.referralCode).length})</option>
                  <optgroup label="Filter by Referral Code">
                    {referrals.map((r) => {
                      const count = clients.filter((c) => (c.referralCode || '').toUpperCase() === r.code.toUpperCase()).length;
                      return (
                        <option key={r.code} value={r.code}>
                          Code: {r.code} ({count} redeemed)
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
                {(clientFilterRef !== 'ALL' || clientSearch.trim()) && (
                  <button
                    type="button"
                    className="btn-secondary admin-action-btn"
                    onClick={() => {
                      setClientFilterRef('ALL');
                      setClientSearch('');
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {loading ? (
                <div className="admin-empty-state">Loading clients…</div>
              ) : error ? (
                <div className="admin-empty-state admin-error-state">
                  <span>Failed to load clients: {error}</span>
                  <button type="button" className="btn-secondary" onClick={fetchMembers} style={{ marginTop: '8px' }}>Retry</button>
                </div>
              ) : clients.length === 0 ? (
                <div className="admin-empty-state">No registered clients yet.</div>
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
                      <div className="admin-empty-state">
                        No clients match the current filter or search criteria.
                      </div>
                    );
                  }

                  return (
                    <div className="admin-items-stack">
                      {filteredClients.map((c) => (
                        <div key={c.clientId} className={`admin-item-row ${c.status !== 'active' ? 'disabled' : ''}`}>
                          <div className="admin-item-info">
                            <div className="admin-item-badge-row">
                              <span className="admin-client-name">{c.name || 'Client'}</span>
                              <span className={`admin-status-pill ${c.status === 'active' ? 'active' : 'inactive'}`}>
                                {c.status === 'active' ? 'Active' : 'Revoked'}
                              </span>
                              {c.referralCode ? (
                                <span
                                  className="admin-ref-tag clickable"
                                  onClick={() => setClientFilterRef(c.referralCode)}
                                  title={`Filter all users who used ${c.referralCode}`}
                                >
                                  via {c.referralCode}
                                </span>
                              ) : (
                                <span className="admin-manual-tag">manual</span>
                              )}
                              {c.createdAt && (
                                <span className="admin-client-created">
                                  {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className="admin-creds-preview">
                              <span><strong>ID:</strong> {c.clientId}</span>
                              <span><strong>Code:</strong> <code>{c.accessCode}</code></span>
                            </div>
                          </div>
                          <div className="admin-item-actions">
                            <button
                              type="button"
                              className="btn-secondary admin-action-btn"
                              onClick={() => copyToClipboard(`Client ID: ${c.clientId}\nAccess Code: ${c.accessCode}`, `cred_${c.clientId}`)}
                              title="Copy ID & Code for WhatsApp"
                            >
                              {copiedKey === `cred_${c.clientId}` ? 'Copied ✓' : 'Copy Credentials'}
                            </button>
                            <button
                              type="button"
                              className={`btn-secondary admin-action-btn ${c.status === 'active' ? 'danger' : ''}`}
                              onClick={() => handleToggleClient(c.clientId)}
                            >
                              {c.status === 'active' ? 'Revoke' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary admin-action-btn danger"
                              onClick={() => handleDeleteClient(c.clientId)}
                              title="Delete"
                            >
                              ×
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
      </div>
    </div>
  );
}
