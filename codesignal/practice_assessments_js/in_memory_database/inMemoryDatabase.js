/**
 * In-Memory Database — Levels 1–4
 *
 * State shape (build it up per level):
 *   db: Map<key, Map<field, { value, expiresAt: null|number }>>
 *     expiresAt: null = no TTL | number = timestamp when field expires (exclusive)
 *     A field is "alive" if expiresAt === null OR timestamp < expiresAt
 *
 * Level 3 note: TTL in milliseconds. expiresAt = timestamp + ttl
 *   Field valid from [timestamp, timestamp+ttl) — expired AT timestamp+ttl
 *
 * Level 4: BACKUP / RESTORE / COMPARE / GET_BACKUP_INFO
 *   backups: Map<backupId, { timestamp, data: Map<key, Map<field,{value,expiresAt}>> }>
 *   backupCounter: number
 */
class InMemoryDatabase {
  constructor() {
    // db: Map<key, Map<field, { value, expiresAt: null|number }>>
    this.db = new Map();

    // Level 4
    this.backups = new Map();
    this.backupCounter = 0;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  _isAlive(fieldMeta, timestamp) {
    return fieldMeta.expiresAt === null || timestamp < fieldMeta.expiresAt;
  }

  // Get only alive fields for a key at a timestamp
  _getAliveFields(key, timestamp) {
    const fields = this.db.get(key);
    if (!fields) return null;
    const alive = new Map();
    for (const [f, meta] of fields) {
      if (this._isAlive(meta, timestamp)) alive.set(f, meta);
    }
    return alive.size > 0 ? alive : null;
  }

  // Format alive fields as sorted "field1(val1), field2(val2)"
  _formatFields(aliveFields) {
    return [...aliveFields.entries()]
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([f, m]) => `${f}(${m.value})`)
      .join(', ');
  }

  // ─── Level 1: SET_FIELD, GET_FIELD, DELETE_FIELD, GET ─────────────────────

  setField(key, field, value) {
    if (!this.db.has(key)) this.db.set(key, new Map());
    this.db.get(key).set(field, { value, expiresAt: null });
    return value;
  }

  getField(key, field) {
    const fields = this.db.get(key);
    if (!fields) return '';
    const meta = fields.get(field);
    if (!meta) return '';
    return meta.value;
  }

  deleteField(key, field) {
    const fields = this.db.get(key);
    if (!fields || !fields.has(field)) return 'false';
    fields.delete(field);
    if (fields.size === 0) this.db.delete(key); // remove empty key
    return 'true';
  }

  get(key) {
    const fields = this.db.get(key);
    if (!fields || fields.size === 0) return '';
    return this._formatFields(fields);
  }

  // ─── Level 2: SCAN, SCAN_BY_FIELD, DELETE, TOP_N_KEYS ─────────────────────
  // TRANSITION: just add these; no changes to Level 1 methods needed.

  scan(prefix) {
    const keys = [...this.db.keys()]
      .filter(k => k.startsWith(prefix))
      .sort();
    return keys.join(', ');
  }

  scanByField(field, value) {
    const keys = [...this.db.entries()]
      .filter(([, fields]) => {
        const meta = fields.get(field);
        return meta && meta.value === value;
      })
      .map(([k]) => k)
      .sort();
    return keys.join(', ');
  }

  delete(key) {
    if (!this.db.has(key)) return 'false';
    this.db.delete(key);
    return 'true';
  }

  topNKeys(n) {
    // Sort: field count DESC → key ASC
    const sorted = [...this.db.entries()]
      .sort(([aKey, aFields], [bKey, bFields]) => {
        if (bFields.size !== aFields.size) return bFields.size - aFields.size;
        return aKey < bKey ? -1 : 1;
      })
      .slice(0, n);
    return sorted.map(([k, f]) => `${k}(${f.size})`).join(', ');
  }

  // ─── Level 3: TTL-AWARE VARIANTS ──────────────────────────────────────────
  // TRANSITION: Add *_AT / *_WITH_TTL methods. Keep Level 1-2 as-is.
  // expiresAt = timestamp + ttl (field invalid AT timestamp+ttl, valid at timestamp+ttl-1)

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
    const meta = fields.get(field);
    if (!meta || !this._isAlive(meta, timestamp)) return '';
    return meta.value;
  }

  getAt(timestamp, key) {
    const alive = this._getAliveFields(key, timestamp);
    if (!alive) return '';
    return this._formatFields(alive);
  }

  deleteFieldAt(timestamp, key, field) {
    const fields = this.db.get(key);
    if (!fields) return 'false';
    const meta = fields.get(field);
    if (!meta || !this._isAlive(meta, timestamp)) return 'false';
    fields.delete(field);
    if (fields.size === 0) this.db.delete(key);
    return 'true';
  }

  scanAt(timestamp, prefix) {
    const keys = [...this.db.entries()]
      .filter(([k, fields]) => {
        if (!k.startsWith(prefix)) return false;
        // Key only included if at least one alive field
        return [...fields.values()].some(m => this._isAlive(m, timestamp));
      })
      .map(([k]) => k)
      .sort();
    return keys.join(', ');
  }

  scanByFieldAt(timestamp, field, value) {
    const keys = [...this.db.entries()]
      .filter(([, fields]) => {
        const meta = fields.get(field);
        return meta && meta.value === value && this._isAlive(meta, timestamp);
      })
      .map(([k]) => k)
      .sort();
    return keys.join(', ');
  }

  // ─── Level 4: BACKUP / RESTORE / COMPARE / GET_BACKUP_INFO ───────────────
  // TRANSITION: Snapshot current alive state → backups map.
  // On RESTORE: replace db, recalculate expiresAt.

  backup(timestamp) {
    this.backupCounter++;
    const backupId = `backup_${this.backupCounter}`;
    // Snapshot only alive fields at timestamp
    const data = new Map();
    for (const [key, fields] of this.db) {
      const snap = new Map();
      for (const [f, meta] of fields) {
        if (this._isAlive(meta, timestamp)) {
          snap.set(f, { value: meta.value, expiresAt: meta.expiresAt });
        }
      }
      if (snap.size > 0) data.set(key, snap);
    }
    this.backups.set(backupId, { timestamp, data });
    return backupId;
  }

  restore(timestamp, backupId) {
    const backup = this.backups.get(backupId);
    if (!backup) return '';

    this.db = new Map();
    let keyCount = 0;

    for (const [key, fields] of backup.data) {
      const newFields = new Map();
      for (const [f, meta] of fields) {
        let newExpiresAt = null;
        if (meta.expiresAt !== null) {
          // Recalculate: remaining TTL at backup time, re-anchor to restore time
          const remaining = meta.expiresAt - backup.timestamp;
          newExpiresAt = timestamp + remaining;
          if (newExpiresAt <= timestamp) continue; // would be already expired
        }
        newFields.set(f, { value: meta.value, expiresAt: newExpiresAt });
      }
      if (newFields.size > 0) {
        this.db.set(key, newFields);
        keyCount++;
      }
    }

    return String(keyCount);
  }

  compare(backupId1, backupId2) {
    const b1 = this.backups.get(backupId1);
    const b2 = this.backups.get(backupId2);
    if (!b1 || !b2) return '';

    const allKeys = new Set([...b1.data.keys(), ...b2.data.keys()]);
    const different = [];

    for (const key of allKeys) {
      const fields1 = b1.data.get(key);
      const fields2 = b2.data.get(key);

      if (!fields1 || !fields2) {
        different.push(key);
        continue;
      }

      // Check if fields differ
      if (fields1.size !== fields2.size) {
        different.push(key);
        continue;
      }

      let differs = false;
      for (const [f, meta1] of fields1) {
        const meta2 = fields2.get(f);
        if (!meta2 || meta2.value !== meta1.value) {
          differs = true;
          break;
        }
      }
      if (differs) different.push(key);
    }

    return different.sort().join(', ');
  }

  getBackupInfo(backupId) {
    const backup = this.backups.get(backupId);
    if (!backup) return '';
    const keys = backup.data.size;
    let totalFields = 0;
    for (const fields of backup.data.values()) {
      totalFields += fields.size;
    }
    return `keys:${keys},fields:${totalFields},timestamp:${backup.timestamp}`;
  }
}

module.exports = InMemoryDatabase;
