import { readFile, writeFile, mkdir, rename, copyFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PERSISTENT_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '/home/willson', '.obito-studio-data');
const MEMBERS_FILE = path.join(PERSISTENT_DIR, 'members.json');
const BACKUP_FILE = path.join(PERSISTENT_DIR, 'members.backup.json');
const SNAPSHOTS_DIR = path.join(PERSISTENT_DIR, 'snapshots');
const LEGACY_FILE = path.join(ROOT, 'members.json');

// Cloud Gist persistence configuration — guarantees survival across cloud container rebuilds.
// SECRETS COME FROM THE ENVIRONMENT ONLY. Never hard-code a token here: this repo is public.
const GIST_ID = process.env.MEMBERS_GIST_ID || '';
const GIST_TOKEN = process.env.MEMBERS_GIST_TOKEN || '';
if (GIST_ID && !GIST_TOKEN) {
  console.warn('[members-store] MEMBERS_GIST_ID is set but MEMBERS_GIST_TOKEN is missing — cloud sync disabled.');
}

async function fetchGistStore() {
  if (!GIST_ID) return null;
  try {
    const headers = { 'User-Agent': 'ObitoStudio' };
    if (GIST_TOKEN) headers['Authorization'] = `token ${GIST_TOKEN}`;
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const body = await res.json();
    const file = body?.files?.['members.json'] || Object.values(body?.files || {})[0];
    if (file && file.content) {
      const data = JSON.parse(file.content);
      if (Array.isArray(data.referrals)) {
        if (!Array.isArray(data.clients)) data.clients = [];
        if (!Array.isArray(data.optimizations)) data.optimizations = [];
        if (!Array.isArray(data.reviews)) data.reviews = [];
        return data;
      }
    }
  } catch (err) {
    console.warn('[members-store] Gist fetch error (non-fatal):', err.message);
  }
  return null;
}

async function syncGistStore(data) {
  if (!GIST_ID || !GIST_TOKEN) return;
  try {
    const serialized = JSON.stringify(data, null, 2);
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'User-Agent': 'ObitoStudio',
        'Authorization': `token ${GIST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'members.json': { content: serialized }
        }
      }),
      signal: AbortSignal.timeout(6000)
    });
  } catch (err) {
    console.warn('[members-store] Gist sync error (non-fatal):', err.message);
  }
}

const DEFAULT_STORE = {
  referrals: [
    {
      code: 'OBITO-VIP',
      maxUses: 10,
      usedCount: 0,
      status: 'active',
      note: 'Default starter referral code',
      createdAt: Date.now()
    }
  ],
  clients: [],
  optimizations: [],
  reviews: [],
  totalOptimizationsCount: 0,
  totalBytesProcessed: 0
};

// In-process lock queue to prevent race conditions during concurrent requests
let ioLock = Promise.resolve();
function withLock(fn) {
  const next = ioLock.then(fn, fn);
  ioLock = next.catch(() => {});
  return next;
}

/**
 * Read the current members store with zero-data-loss fallback.
 * Multi-tier recovery:
 *   Tier 1: Primary MEMBERS_FILE (~/.obito-studio-data/members.json)
 *   Tier 2: Redundant BACKUP_FILE (~/.obito-studio-data/members.backup.json)
 *   Tier 3: Latest timestamped snapshot in SNAPSHOTS_DIR
 *   Tier 4: Remote Cloud Gist (guarantees survival across ephemeral container rebuilds)
 *   Tier 5: Baked-in repo members.json
 * NEVER resets to default if any of the above stores exist.
 */
function ensureStoreArrays(data) {
  if (!data || typeof data !== 'object') return JSON.parse(JSON.stringify(DEFAULT_STORE));
  if (!Array.isArray(data.referrals)) data.referrals = [];
  if (!Array.isArray(data.clients)) data.clients = [];
  if (!Array.isArray(data.optimizations)) data.optimizations = [];
  if (!Array.isArray(data.reviews)) data.reviews = [];
  if (typeof data.totalOptimizationsCount !== 'number') data.totalOptimizationsCount = data.optimizations.length;
  if (typeof data.totalBytesProcessed !== 'number') data.totalBytesProcessed = 0;
  return data;
}

export async function getMembersStore() {
  await mkdir(PERSISTENT_DIR, { recursive: true });
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  // 1. Try primary storage
  if (existsSync(MEMBERS_FILE)) {
    try {
      const raw = await readFile(MEMBERS_FILE, 'utf8');
      if (raw && raw.trim().length > 0) {
        return ensureStoreArrays(JSON.parse(raw));
      }
    } catch (err) {
      console.error('[members-store] Failed to parse primary members.json, attempting backup recovery:', err);
    }
  }

  // 2. Try backup storage if primary was corrupt or unreadable
  if (existsSync(BACKUP_FILE)) {
    try {
      const backupRaw = await readFile(BACKUP_FILE, 'utf8');
      if (backupRaw && backupRaw.trim().length > 0) {
        const data = ensureStoreArrays(JSON.parse(backupRaw));
        await atomicWriteFile(MEMBERS_FILE, JSON.stringify(data, null, 2));
        console.warn('[members-store] Successfully recovered members store from backup file.');
        return data;
      }
    } catch (err) {
      console.error('[members-store] Backup file also unreadable:', err);
    }
  }

  // 3. Try latest snapshot from snapshots directory
  try {
    if (existsSync(SNAPSHOTS_DIR)) {
      const snapFiles = (await readdir(SNAPSHOTS_DIR)).filter(f => f.startsWith('members_') && f.endsWith('.json')).sort();
      if (snapFiles.length > 0) {
        const latestSnap = path.join(SNAPSHOTS_DIR, snapFiles[snapFiles.length - 1]);
        const snapRaw = await readFile(latestSnap, 'utf8');
        if (snapRaw && snapRaw.trim().length > 0) {
          const data = ensureStoreArrays(JSON.parse(snapRaw));
          const serialized = JSON.stringify(data, null, 2);
          await atomicWriteFile(MEMBERS_FILE, serialized);
          await atomicWriteFile(BACKUP_FILE, serialized);
          console.warn(`[members-store] Successfully recovered members store from snapshot: ${latestSnap}`);
          return data;
        }
      }
    }
  } catch (err) {
    console.error('[members-store] Snapshot recovery error:', err);
  }

  // 4. Try Remote Cloud Sync (GitHub Gist) - guarantees persistence across container rebuilds/deploys on Suga Cloud
  const gistData = await fetchGistStore();
  if (gistData) {
    console.warn('[members-store] Successfully recovered members store from remote cloud Gist.');
    const data = ensureStoreArrays(gistData);
    const serialized = JSON.stringify(data, null, 2);
    await atomicWriteFile(MEMBERS_FILE, serialized);
    await atomicWriteFile(BACKUP_FILE, serialized);
    return data;
  }

  // 5. Check baked-in file in repo root
  if (existsSync(LEGACY_FILE)) {
    try {
      const legacyRaw = await readFile(LEGACY_FILE, 'utf8');
      if (legacyRaw && legacyRaw.trim().length > 0) {
        const data = ensureStoreArrays(JSON.parse(legacyRaw));
        const serialized = JSON.stringify(data, null, 2);
        await atomicWriteFile(MEMBERS_FILE, serialized);
        await atomicWriteFile(BACKUP_FILE, serialized);
        return data;
      }
    } catch {
      /* ignore legacy parse error */
    }
  }

  // 6. Genuine first run initialization only
  const initial = JSON.parse(JSON.stringify(DEFAULT_STORE));
  await saveMembersStore(initial);
  return initial;
}

/**
 * Write a file atomically using a temporary file and rename.
 * Prevents race condition partial reads in Linux.
 */
async function atomicWriteFile(targetPath, content) {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.tmp_${path.basename(targetPath)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, targetPath);
}

/**
 * Internal raw save: writes atomically to primary & backups, syncs to Gist and writes snapshot.
 */
async function _saveStore(data) {
  try {
    await mkdir(PERSISTENT_DIR, { recursive: true });
    await mkdir(SNAPSHOTS_DIR, { recursive: true });

    const serialized = JSON.stringify(data, null, 2);

    // Write atomically to primary
    await atomicWriteFile(MEMBERS_FILE, serialized);

    // Write atomically to secondary backup
    await atomicWriteFile(BACKUP_FILE, serialized);

    // Write to workspace root file if writable
    await atomicWriteFile(LEGACY_FILE, serialized).catch(() => {});

    // Asynchronously sync to remote cloud Gist
    syncGistStore(data).catch(() => {});

    // Periodic rolling snapshot
    const snapshotPath = path.join(SNAPSHOTS_DIR, `members_${Date.now()}.json`);
    await writeFile(snapshotPath, serialized, 'utf8').catch(() => {});

    // Keep up to 20 newest snapshots, prune older ones
    try {
      const snaps = (await readdir(SNAPSHOTS_DIR)).filter(f => f.startsWith('members_') && f.endsWith('.json')).sort();
      if (snaps.length > 20) {
        const toDelete = snaps.slice(0, snaps.length - 20);
        for (const f of toDelete) {
          await unlink(path.join(SNAPSHOTS_DIR, f)).catch(() => {});
        }
      }
    } catch {}
  } catch (err) {
    console.error('[members-store] CRITICAL failed to save members store:', err);
    throw err;
  }
}

/**
 * Persist the members store safely to disk with atomic operations & rolling snapshots.
 */
export async function saveMembersStore(data) {
  return withLock(() => _saveStore(data));
}

/**
 * Perform an atomic read-modify-write transaction on the members store.
 * Eliminates race condition overwrites between concurrent requests.
 */
export async function updateMembersStore(mutator) {
  return withLock(async () => {
    const store = await getMembersStore();
    const result = await mutator(store);
    await _saveStore(store);
    return result;
  });
}

/**
 * Generate a friendly unique client ID: e.g. "cli_9f2b"
 */
export function generateClientId(prefix = 'client') {
  return `${prefix}_${randomBytes(3).toString('hex')}`;
}

/**
 * Generate a strong access code: e.g. "OBT-8A2F-9C1D"
 */
export function generateAccessCode() {
  const p1 = randomBytes(2).toString('hex').toUpperCase();
  const p2 = randomBytes(2).toString('hex').toUpperCase();
  return `OBT-${p1}-${p2}`;
}

/**
 * Validate a client login attempt against members.json.
 * Returns client object if valid and active, else null.
 */
export async function authenticateClient(clientId, accessCode) {
  if (!accessCode) return null;
  const store = await getMembersStore();
  const token = accessCode.trim();
  const normalizedId = String(clientId || '').trim().toLowerCase();

  const client = store.clients.find((c) => {
    if (c.accessCode !== token) return false;
    if (c.status !== 'active') return false;
    if (c.expiresAt && Date.now() > c.expiresAt) return false;
    if (!normalizedId) return true;
    return (
      c.clientId.toLowerCase() === normalizedId ||
      (c.name && c.name.toLowerCase() === normalizedId)
    );
  });
  return client || null;
}

/**
 * Check if an accessCode is active for any registered client.
 */
export async function findActiveClientByCode(accessCode) {
  if (!accessCode) return null;
  const store = await getMembersStore();
  const token = accessCode.trim();
  return store.clients.find(
    (c) => c.accessCode === token && c.status === 'active' && (!c.expiresAt || Date.now() <= c.expiresAt)
  ) || null;
}

/**
 * Redeem a referral code to issue a new client pass.
 */
export async function redeemReferralCode(referralCode, clientName = '') {
  if (!referralCode) throw new Error('Referral code is required.');
  const normalized = referralCode.trim().toUpperCase();

  return updateMembersStore(async (store) => {
    const ref = store.referrals.find((r) => r.code.toUpperCase() === normalized);
    if (!ref) {
      throw new Error('Referral code is invalid or does not exist.');
    }
    if (ref.status !== 'active') {
      throw new Error('This referral code has been deactivated.');
    }
    if (ref.maxUses !== null && ref.maxUses !== undefined && ref.usedCount >= ref.maxUses) {
      throw new Error('This referral code has reached its maximum usage limit.');
    }

    // Create new client credentials
    const sanitizedName = clientName.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
    const clientId = generateClientId(sanitizedName || 'user');
    const accessCode = generateAccessCode();

    const newClient = {
      clientId,
      accessCode,
      name: clientName.trim() || 'Referral User',
      source: 'referral',
      referralCode: ref.code,
      status: 'active',
      createdAt: Date.now(),
      expiresAt: null
    };

    ref.usedCount = (ref.usedCount || 0) + 1;
    store.clients.unshift(newClient);

    return {
      clientId: newClient.clientId,
      accessCode: newClient.accessCode,
      name: newClient.name,
      referralCode: ref.code
    };
  });
}

/**
 * Admin: Add a new referral code.
 */
export async function createReferral({ code, maxUses = 1, note = '' }) {
  if (!code) throw new Error('Code is required');
  const normalized = code.trim().toUpperCase();

  return updateMembersStore(async (store) => {
    if (store.referrals.some((r) => r.code.toUpperCase() === normalized)) {
      throw new Error('A referral code with this name already exists.');
    }
    const parsedMax = maxUses === 'unlimited' || maxUses === null ? null : Math.max(1, parseInt(maxUses, 10) || 1);
    const newRef = {
      code: normalized,
      maxUses: parsedMax,
      usedCount: 0,
      status: 'active',
      note: note.trim(),
      createdAt: Date.now()
    };
    store.referrals.unshift(newRef);
    return newRef;
  });
}

/**
 * Admin: Toggle or remove referral.
 */
export async function toggleReferralStatus(code) {
  return updateMembersStore(async (store) => {
    const ref = store.referrals.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!ref) throw new Error('Referral code not found');
    ref.status = ref.status === 'active' ? 'disabled' : 'active';
    return ref;
  });
}

export async function deleteReferral(code) {
  return updateMembersStore(async (store) => {
    store.referrals = store.referrals.filter((r) => r.code.toUpperCase() !== code.trim().toUpperCase());
    return true;
  });
}

/**
 * Admin: Manually create a client ID and pass.
 */
export async function createClientManually({ name = '', customCode = '', customId = '' }) {
  return updateMembersStore(async (store) => {
    const clientId = customId ? customId.trim() : generateClientId('client');
    const accessCode = customCode ? customCode.trim() : generateAccessCode();
    
    if (store.clients.some((c) => c.clientId.toLowerCase() === clientId.toLowerCase())) {
      throw new Error('Client ID already exists.');
    }

    const client = {
      clientId,
      accessCode,
      name: name.trim() || 'Manual Client',
      source: 'manual',
      status: 'active',
      createdAt: Date.now(),
      expiresAt: null
    };
    store.clients.unshift(client);
    return client;
  });
}

/**
 * Admin: Revoke or toggle a client.
 */
export async function toggleClientStatus(clientId) {
  return updateMembersStore(async (store) => {
    const client = store.clients.find((c) => c.clientId.toLowerCase() === clientId.trim().toLowerCase());
    if (!client) throw new Error('Client not found');
    client.status = client.status === 'active' ? 'revoked' : 'active';
    return client;
  });
}

export async function deleteClient(clientId) {
  return updateMembersStore(async (store) => {
    store.clients = store.clients.filter((c) => c.clientId.toLowerCase() !== clientId.trim().toLowerCase());
    return true;
  });
}

/**
 * Record a completed or failed optimization job into persistent telemetry.
 */
export async function recordOptimization(optData) {
  return updateMembersStore(async (store) => {
    if (!Array.isArray(store.optimizations)) store.optimizations = [];
    const id = optData.id || ('opt_' + randomBytes(8).toString('hex'));
    const entry = {
      id,
      clientId: optData.clientId || 'guest',
      clientName: optData.clientName || 'Guest Creator',
      fileName: optData.fileName || 'video.mp4',
      mode: optData.mode || 'hdr',
      ensureH264: Boolean(optData.ensureH264),
      status: optData.status || 'done',
      error: optData.error || null,
      inputBytes: Number(optData.inputBytes || 0),
      outputBytes: Number(optData.outputBytes || 0),
      in: optData.in || null,
      out: optData.out || null,
      durationMs: Number(optData.durationMs || 0),
      timestamp: optData.timestamp || Date.now()
    };
    store.optimizations.unshift(entry);
    if (store.optimizations.length > 500) {
      store.optimizations = store.optimizations.slice(0, 500);
    }
    store.totalOptimizationsCount = (store.totalOptimizationsCount || 0) + 1;
    store.totalBytesProcessed = (store.totalBytesProcessed || 0) + (entry.inputBytes || 0);

    // Update client-level optimization counter
    if (optData.clientId && optData.clientId !== 'guest' && Array.isArray(store.clients)) {
      const client = store.clients.find((c) => c.clientId.toLowerCase() === optData.clientId.toLowerCase());
      if (client) {
        client.optimizationsCount = (client.optimizationsCount || 0) + 1;
        client.lastActiveAt = Date.now();
        if (!client.pipelineUsage) client.pipelineUsage = {};
        const modeKey = optData.mode || 'hdr';
        client.pipelineUsage[modeKey] = (client.pipelineUsage[modeKey] || 0) + 1;
      }
    }
    return entry;
  });
}

/**
 * Get personal optimization history for a client.
 */
export async function getOptimizationsHistory({ clientId = null, limit = 50 } = {}) {
  const store = await getMembersStore();
  let items = store.optimizations || [];
  if (clientId && clientId !== 'owner') {
    items = items.filter((o) => o.clientId && o.clientId.toLowerCase() === clientId.toLowerCase());
  }
  const userItems = items.slice(0, limit);

  // Compute breakdown
  const modeCounts = {};
  for (const it of items) {
    const m = it.mode || 'hdr';
    modeCounts[m] = (modeCounts[m] || 0) + 1;
  }
  let favoritePipeline = 'HDR Rec.2020 / HLG';
  let maxCount = 0;
  for (const [k, v] of Object.entries(modeCounts)) {
    if (v > maxCount) {
      maxCount = v;
      favoritePipeline = k === 'standard' ? 'Standard 709' : 'HDR Rec.2020 / HLG';
    }
  }

  return {
    items: userItems,
    userStats: {
      total: items.length,
      favoritePipeline,
      lastOptimizedAt: items[0]?.timestamp || null
    }
  };
}

/**
 * Admin: Get comprehensive breakdown of all optimizations across users and pipelines.
 */
export async function getAdminOptimizationsBreakdown() {
  const store = await getMembersStore();
  const opts = store.optimizations || [];
  const clients = store.clients || [];

  const pipelineStats = {
    hdr: 0,
    standard: 0,
    h264Tagged: 0,
    total: store.totalOptimizationsCount || opts.length
  };

  for (const o of opts) {
    if (o.mode === 'standard') pipelineStats.standard++;
    else pipelineStats.hdr++;
    if (o.ensureH264) pipelineStats.h264Tagged++;
  }

  // User leaderboard
  const userLeaderboard = clients.map((c) => {
    const userOpts = opts.filter((o) => o.clientId && o.clientId.toLowerCase() === c.clientId.toLowerCase());
    const userCount = c.optimizationsCount || userOpts.length;
    return {
      clientId: c.clientId,
      name: c.name || c.clientId,
      status: c.status,
      optimizationsCount: userCount,
      lastActiveAt: c.lastActiveAt || userOpts[0]?.timestamp || c.createdAt,
      primaryPipeline: userOpts.some((o) => o.mode === 'standard') ? 'Standard 709' : 'HDR Rec.2020'
    };
  }).sort((a, b) => b.optimizationsCount - a.optimizationsCount);

  return {
    totalOptimizations: store.totalOptimizationsCount || opts.length,
    totalBytesProcessed: store.totalBytesProcessed || 0,
    pipelineStats,
    userLeaderboard,
    recentJobs: opts.slice(0, 100)
  };
}

/**
 * Record a user satisfaction review / feedback.
 */
export async function recordReview({ rating, category, message, contact = '', name = '', clientId = 'guest' }) {
  return updateMembersStore(async (store) => {
    if (!Array.isArray(store.reviews)) store.reviews = [];
    const review = {
      id: 'rev_' + randomBytes(6).toString('hex'),
      clientId: clientId || 'guest',
      name: (name || '').trim() || (clientId !== 'guest' ? clientId : 'Verified Creator'),
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      category: (category || 'Video Optimization Quality').trim(),
      message: (message || '').trim(),
      contact: (contact || '').trim(),
      createdAt: Date.now(),
      status: 'new'
    };
    store.reviews.unshift(review);
    if (store.reviews.length > 200) {
      store.reviews = store.reviews.slice(0, 200);
    }
    return review;
  });
}

/**
 * Get all submitted reviews for the Admin dashboard.
 */
export async function getReviews() {
  const store = await getMembersStore();
  return store.reviews || [];
}

/**
 * Public platform stats for telemetry section.
 */
export async function getGlobalPlatformStats() {
  const store = await getMembersStore();
  const clientsCount = Array.isArray(store.clients) ? store.clients.length : 0;
  const totalOpts = Math.max(store.totalOptimizationsCount || 0, Array.isArray(store.optimizations) ? store.optimizations.length : 0);
  const reviews = store.reviews || [];
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length) * 10) / 10
    : 5.0;

  return {
    registeredUsers: clientsCount,
    totalOptimizations: totalOpts,
    totalBytesProcessed: store.totalBytesProcessed || 0,
    averageRating: avgRating,
    reviewCount: reviews.length,
    losslessRetention: '100%',
    timescaleBase: 19200
  };
}

