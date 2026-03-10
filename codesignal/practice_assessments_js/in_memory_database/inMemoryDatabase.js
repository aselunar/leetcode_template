// In-Memory Database — all 4 levels in one file
//
// READING THIS FILE: This is the final, all-levels-done implementation.
// On the actual OA you build incrementally:
//   L1 — write setField/getField/deleteField/get
//   L2 — add delete/scan/scanByField/topNKeys (no TTL, no structural changes to L1)
//   L3 — add _alive helper; add setFieldAt/setFieldWithTTL and _AT variants of
//        read/delete/scan — L1/L2 "timeless" methods do NOT change at this phase
//   L4 — add backup/restore/compare/getBackupInfo
//
// YES — the incremental approach works for CodeSignal:
//   • Each method is only as complex as the current phase requires.
//   • You never write (or call) anything until the phase that needs it.
//   • "TRANSITION" comments on each method show exactly what lines to add at each phase.
//   • CodeSignal re-runs all prior-level tests at each new level, so additive changes
//     to existing methods (tracked by TRANSITION comments) keep everything passing.
//
// Key: nested Map<key, Map<field, {value, expiresAt}>>
// TTL: field valid at timestamp T if T < expiresAt (unavailable at exactly T+ttl)

class InMemoryDatabase {
  constructor() {
    // LEVEL 1: key -> Map<field, { value: string, expiresAt: number|null }>
    // Forward-compatible design: storing { value, expiresAt } from L1 means no
    // structural refactor is needed when L3 adds TTL support (expiresAt stays null
    // for non-TTL fields and is set to a timestamp for TTL fields).
    this.db = new Map();
    // LEVEL 4: backupId -> { timestamp, snapshot: Map<key, Map<field, {value, expiresAt}>> }
    // TRANSITION L3→L4: add this.backups and this.backupSeq
    this.backups = new Map();
    this.backupSeq = 0;
  }

  // === LEVEL 1: Initial Design & Basic Functions ===

  setField(key, field, value) {
    if (!this.db.has(key)) this.db.set(key, new Map());
    this.db.get(key).set(field, { value, expiresAt: null });
    return value;
  }

  getField(key, field) {
    const fields = this.db.get(key);
    if (!fields) return '';
    const f = fields.get(field);
    if (!f) return '';
    return f.value;
  }

  deleteField(key, field) {
    const fields = this.db.get(key);
    if (!fields || !fields.has(field)) return 'false';
    fields.delete(field);
    if (fields.size === 0) this.db.delete(key); // clean up empty key
    return 'true';
  }

  get(key) {
    const fields = this.db.get(key);
    if (!fields || fields.size === 0) return '';
    // Sort fields alphabetically
    const entries = [...fields.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([f, v]) => `${f}(${v.value})`).join(', ');
  }

  // === LEVEL 2: Filtering & Querying ===
  // TRANSITION L1→L2: add delete(), scan(), scanByField(), topNKeys()

  delete(key) {
    if (!this.db.has(key)) return 'false';
    this.db.delete(key);
    return 'true';
  }

  scan(prefix) {
    const keys = [...this.db.keys()].filter(k => k.startsWith(prefix)).sort();
    return keys.join(', ');
  }

  scanByField(field, value) {
    const keys = [];
    for (const [key, fields] of this.db) {
      const f = fields.get(field);
      if (f && f.value === value) keys.push(key);
    }
    return keys.sort().join(', ');
  }

  topNKeys(n) {
    // Sort by field count desc, then key name asc for ties
    const list = [...this.db.entries()].map(([k, v]) => [k, v.size]);
    list.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return list.slice(0, n).map(([k, cnt]) => `${k}(${cnt})`).join(', ');
  }

  // === LEVEL 3: Time-To-Live (TTL) Support ===
  // TRANSITION L2→L3: all reads must call _alive(f, ts) to check expiry
  // SET_FIELD_WITH_TTL: expiresAt = timestamp + ttl
  // Field valid when timestamp < expiresAt (unavailable at exactly expiresAt)

  _alive(fieldEntry, timestamp) {
    return fieldEntry.expiresAt === null || timestamp < fieldEntry.expiresAt;
  }

  setFieldAt(timestamp, key, field, value) {
    if (!this.db.has(key)) this.db.set(key, new Map());
    this.db.get(key).set(field, { value, expiresAt: null });
    return value;
  }

  setFieldWithTTL(timestamp, key, field, value, ttl) {
    if (!this.db.has(key)) this.db.set(key, new Map());
    this.db.get(key).set(field, { value, expiresAt: timestamp + ttl });
    return value;
  }

  getFieldAt(timestamp, key, field) {
    const fields = this.db.get(key);
    if (!fields) return '';
    const f = fields.get(field);
    if (!f || !this._alive(f, timestamp)) return '';
    return f.value;
  }

  getAt(timestamp, key) {
    const fields = this.db.get(key);
    if (!fields) return '';
    const entries = [...fields.entries()]
      .filter(([, v]) => this._alive(v, timestamp))
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) return '';
    return entries.map(([f, v]) => `${f}(${v.value})`).join(', ');
  }

  deleteFieldAt(timestamp, key, field) {
    const fields = this.db.get(key);
    if (!fields) return 'false';
    const f = fields.get(field);
    if (!f || !this._alive(f, timestamp)) return 'false';
    fields.delete(field);
    if (fields.size === 0) this.db.delete(key);
    return 'true';
  }

  scanAt(timestamp, prefix) {
    const keys = [];
    for (const [key, fields] of this.db) {
      if (!key.startsWith(prefix)) continue;
      // Only include key if it has at least one alive field
      if ([...fields.values()].some(f => this._alive(f, timestamp))) keys.push(key);
    }
    return keys.sort().join(', ');
  }

  scanByFieldAt(timestamp, field, value) {
    const keys = [];
    for (const [key, fields] of this.db) {
      const f = fields.get(field);
      if (f && f.value === value && this._alive(f, timestamp)) keys.push(key);
    }
    return keys.sort().join(', ');
  }

  // === LEVEL 4: Backup & Restore ===
  // TRANSITION L3→L4: snapshot must deep-copy {value, expiresAt} for each alive field
  // RESTORE TTL formula: new expiresAt = restoreTs + (original expiresAt - backupTs)
  // COMPARE: keys differ if missing from one backup OR same key has different field values

  backup(timestamp) {
    this.backupSeq++;
    const id = `backup_${this.backupSeq}`;
    const snapshot = new Map();
    for (const [key, fields] of this.db) {
      const aliveFields = new Map();
      for (const [f, v] of fields) {
        if (this._alive(v, timestamp)) aliveFields.set(f, { value: v.value, expiresAt: v.expiresAt });
      }
      if (aliveFields.size > 0) snapshot.set(key, aliveFields);
    }
    this.backups.set(id, { timestamp, snapshot });
    return id;
  }

  restore(timestamp, backupId) {
    const bk = this.backups.get(backupId);
    if (!bk) return '';
    this.db.clear();
    let count = 0;
    for (const [key, fields] of bk.snapshot) {
      const newFields = new Map();
      for (const [field, v] of fields) {
        // Recalculate TTL: remaining at backup time, shifted to restore time
        const newExpiresAt = v.expiresAt !== null
          ? timestamp + (v.expiresAt - bk.timestamp)
          : null;
        newFields.set(field, { value: v.value, expiresAt: newExpiresAt });
      }
      this.db.set(key, newFields);
      count++;
    }
    return String(count);
  }

  compare(backupId1, backupId2) {
    const bk1 = this.backups.get(backupId1);
    const bk2 = this.backups.get(backupId2);
    if (!bk1 || !bk2) return '';
    const diff = new Set();
    for (const [key, fields1] of bk1.snapshot) {
      if (!bk2.snapshot.has(key)) {
        diff.add(key);
      } else if (!this._fieldsMatch(fields1, bk2.snapshot.get(key))) {
        diff.add(key);
      }
    }
    for (const key of bk2.snapshot.keys()) {
      if (!bk1.snapshot.has(key)) diff.add(key);
    }
    return [...diff].sort().join(', ');
  }

  _fieldsMatch(m1, m2) {
    if (m1.size !== m2.size) return false;
    for (const [f, v] of m1) {
      const v2 = m2.get(f);
      if (!v2 || v2.value !== v.value) return false;
    }
    return true;
  }

  getBackupInfo(backupId) {
    const bk = this.backups.get(backupId);
    if (!bk) return '';
    let totalFields = 0;
    for (const fields of bk.snapshot.values()) totalFields += fields.size;
    return `keys:${bk.snapshot.size},fields:${totalFields},timestamp:${bk.timestamp}`;
  }

  simulate(commands) {
    return commands.map(cmd => {
      const [op, ...a] = cmd;
      switch (op) {
        case 'SET_FIELD': return this.setField(a[0], a[1], a[2]);
        case 'GET_FIELD': return this.getField(a[0], a[1]);
        case 'DELETE_FIELD': return this.deleteField(a[0], a[1]);
        case 'GET': return this.get(a[0]);
        case 'DELETE': return this.delete(a[0]);
        case 'SCAN': return this.scan(a[0]);
        case 'SCAN_BY_FIELD': return this.scanByField(a[0], a[1]);
        case 'TOP_N_KEYS': return this.topNKeys(+a[0]);
        case 'SET_FIELD_AT': return this.setFieldAt(+a[0], a[1], a[2], a[3]);
        case 'SET_FIELD_WITH_TTL': return this.setFieldWithTTL(+a[0], a[1], a[2], a[3], +a[4]);
        case 'GET_FIELD_AT': return this.getFieldAt(+a[0], a[1], a[2]);
        case 'GET_AT': return this.getAt(+a[0], a[1]);
        case 'DELETE_FIELD_AT': return this.deleteFieldAt(+a[0], a[1], a[2]);
        case 'SCAN_AT': return this.scanAt(+a[0], a[1]);
        case 'SCAN_BY_FIELD_AT': return this.scanByFieldAt(+a[0], a[1], a[2]);
        case 'BACKUP': return this.backup(+a[0]);
        case 'RESTORE': return this.restore(+a[0], a[1]);
        case 'COMPARE': return this.compare(a[0], a[1]);
        case 'GET_BACKUP_INFO': return this.getBackupInfo(a[0]);
        default: return '';
      }
    });
  }
}

module.exports = InMemoryDatabase;
