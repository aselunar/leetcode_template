/**
 * File Storage System — Levels 1–4
 *
 * State shape (build it up per level):
 *   files: Map<name, { size, expiresAt }>
 *     expiresAt: null = live forever | number = timestamp when it expires (exclusive)
 *
 * Level 3 note: ALL operations gain a timestamp param; TTL is in seconds.
 *   expiresAt = timestamp + ttl  (where timestamp and ttl are both in seconds)
 *   A file is "alive" if expiresAt === null OR timestamp < expiresAt
 *
 * Level 4: ROLLBACK requires keeping a history of snapshots.
 *   snapshots: [{ timestamp, files: Map<name,{size,ttl,uploadedAt}> }]
 *   On rollback: restore files, recalculate expiresAt based on original TTL remaining
 */
class FileStorage {
  constructor() {
    // Map<fileName, { size, expiresAt: null|number, uploadedAt, ttl: null|number }>
    this.files = new Map();

    // Level 4: state history for ROLLBACK
    // Each entry: { timestamp, snapshot: Map<name,{size,expiresAt,uploadedAt,ttl}> }
    this.history = [];
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  _isAlive(file, timestamp) {
    return file.expiresAt === null || timestamp < file.expiresAt;
  }

  // Deep-clone current files map for history snapshot
  _snapshot(timestamp) {
    const snap = new Map();
    for (const [name, f] of this.files) {
      snap.set(name, { ...f });
    }
    this.history.push({ timestamp, snapshot: snap });
  }

  // ─── Level 1: FILE_UPLOAD, FILE_GET, FILE_COPY ────────────────────────────
  // No timestamp in L1 — add the timestamp wrapper in L3 (FILE_UPLOAD_AT etc.)

  fileUpload(fileName, size) {
    if (this.files.has(fileName)) throw new Error(`File already exists: ${fileName}`);
    this.files.set(fileName, { size, expiresAt: null, uploadedAt: null, ttl: null });
  }

  fileGet(fileName) {
    const f = this.files.get(fileName);
    return f ? f.size : undefined;
  }

  fileCopy(source, dest) {
    const src = this.files.get(source);
    if (!src) throw new Error(`Source file not found: ${source}`);
    // Overwrite dest if it exists; copy size (and TTL resets — new file)
    this.files.set(dest, { size: src.size, expiresAt: null, uploadedAt: null, ttl: null });
  }

  // ─── Level 2: FILE_SEARCH ─────────────────────────────────────────────────
  // Sort: size DESC → fileName ASC (lexicographic tie-break); top 10 only

  fileSearch(prefix) {
    const matches = [...this.files.entries()]
      .filter(([name]) => name.startsWith(prefix))
      .sort(([aName, aData], [bName, bData]) => {
        if (bData.size !== aData.size) return bData.size - aData.size;
        return aName < bName ? -1 : 1;
      })
      .slice(0, 10)
      .map(([name, d]) => `${name}(${d.size})`);
    return matches;
  }

  // ─── Level 3: TIME-AWARE VARIANTS ─────────────────────────────────────────
  // TRANSITION NOTE: existing L1/L2 ops stay; add *_AT variants that accept timestamp.
  // TTL is in seconds. expiresAt = uploadTimestamp + ttl

  fileUploadAt(timestamp, fileName, size, ttl = null) {
    this._recordHistory(timestamp);
    // Alive file cannot be overwritten (treat same as L1)
    const existing = this.files.get(fileName);
    if (existing && this._isAlive(existing, timestamp)) {
      throw new Error(`File already exists: ${fileName}`);
    }
    const expiresAt = ttl !== null ? timestamp + ttl : null;
    this.files.set(fileName, { size, expiresAt, uploadedAt: timestamp, ttl });
  }

  fileGetAt(timestamp, fileName) {
    const f = this.files.get(fileName);
    if (!f || !this._isAlive(f, timestamp)) return undefined;
    return f.size;
  }

  fileCopyAt(timestamp, source, dest) {
    this._recordHistory(timestamp);
    const src = this.files.get(source);
    if (!src || !this._isAlive(src, timestamp)) throw new Error(`Source not found: ${source}`);
    // Copy keeps the original TTL relative to its upload time — or copy with no TTL?
    // Spec says "copy"; safest interpretation: new file has no TTL (permanent copy).
    // Overwrites dest unconditionally (alive or expired) — same behaviour as fileCopy.
    this.files.set(dest, { size: src.size, expiresAt: null, uploadedAt: timestamp, ttl: null });
  }

  fileSearchAt(timestamp, prefix) {
    // Only include alive files
    const matches = [...this.files.entries()]
      .filter(([name, f]) => name.startsWith(prefix) && this._isAlive(f, timestamp))
      .sort(([aName, aData], [bName, bData]) => {
        if (bData.size !== aData.size) return bData.size - aData.size;
        return aName < bName ? -1 : 1;
      })
      .slice(0, 10)
      .map(([name, d]) => `${name}(${d.size})`);
    return matches;
  }

  // ─── Level 4: ROLLBACK ────────────────────────────────────────────────────
  // TRANSITION NOTE: Before each mutating operation, record state to history.
  // On rollback: restore snapshot and recalculate expiresAt.
  //
  // Recalculation formula:
  //   If a file had TTL and was uploaded at T_upload with expiry at T_exp,
  //   remaining TTL at rollback time T_rb = T_exp - T_rb
  //   (if negative, file should not exist in restored state)
  //
  // Simplest interpretation of spec: restore files as they were at that timestamp.
  // The history array stores the state BEFORE each operation at a given timestamp.

  rollback(timestamp) {
    // Find the most recent history entry with entry.timestamp <= rollback timestamp
    // (i.e., restore to the state just BEFORE the first operation after `timestamp`)
    const entry = [...this.history]
      .reverse()
      .find(e => e.timestamp <= timestamp);

    if (!entry) {
      // Nothing to rollback to — clear all files
      this.files = new Map();
      return;
    }

    // Restore snapshot and adjust TTL expirations
    this.files = new Map();
    for (const [name, f] of entry.snapshot) {
      if (f.expiresAt === null) {
        this.files.set(name, { ...f });
      } else {
        // Recalculate: if file was alive in snapshot it may or may not still be alive now
        // Keep it with same expiresAt (absolute expiry doesn't change on rollback per spec:
        // "All ttls should be recalculated accordingly.")
        // New expiresAt = rollback_timestamp + (original_expiresAt - snapshot_timestamp)
        const remaining = f.expiresAt - entry.timestamp;
        const newExpiresAt = timestamp + remaining;
        if (newExpiresAt > timestamp) {
          this.files.set(name, { ...f, expiresAt: newExpiresAt });
        }
      }
    }
  }

  // Records a snapshot of current state before a mutating operation.
  // Called automatically at the start of fileUploadAt and fileCopyAt.
  _recordHistory(timestamp) {
    this._snapshot(timestamp);
  }
}

module.exports = FileStorage;
