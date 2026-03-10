// File Storage System — all 4 levels in one file
// Key: Map for O(1) file lookup. For ROLLBACK, maintain event log with timestamps.

class FileStorage {
  constructor() {
    // fileName -> { size: number, uploadedAt: number, expiresAt: number|null }
    this.files = new Map();
    // LEVEL 4: ordered event log for ROLLBACK
    // { ts: number, name: string, size: number, expiresAt: number|null }
    this.events = [];
  }

  // === LEVEL 1: Initial Design & Basic Functions ===

  fileUpload(fileName, size) {
    if (this.files.has(fileName)) throw new Error('File already exists');
    const entry = { size: +size, uploadedAt: 0, expiresAt: null };
    this.files.set(fileName, entry);
    this._logEvent(0, fileName, +size, null);
    return String(size);
  }

  fileGet(fileName) {
    const f = this.files.get(fileName);
    if (!f) return '';
    return String(f.size);
  }

  fileCopy(source, dest) {
    const src = this.files.get(source);
    if (!src) throw new Error('Source file not found');
    const entry = { size: src.size, uploadedAt: src.uploadedAt, expiresAt: src.expiresAt };
    this.files.set(dest, entry);
    this._logEvent(0, dest, src.size, src.expiresAt);
    return String(src.size);
  }

  // === LEVEL 2: Data Structures & Data Processing ===

  fileSearch(prefix) {
    // Top 10 by size desc, then name asc for ties
    const matches = [];
    for (const [name, f] of this.files) {
      if (name.startsWith(prefix)) matches.push([name, f.size]);
    }
    matches.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return matches.slice(0, 10).map(([name]) => name).join(', ');
  }

  // === LEVEL 3: Refactoring & Encapsulation ===
  // TRANSITION L2→L3: refactor all checks to use _isAlive(name, timestamp)
  // For COPY, the copy inherits the source's expiresAt (same expiration time)
  // TTL in seconds: expiresAt = uploadedAt + ttl; alive when timestamp < expiresAt

  _isAlive(name, timestamp) {
    const f = this.files.get(name);
    if (!f) return false;
    return f.expiresAt === null || timestamp < f.expiresAt;
  }

  _logEvent(ts, name, size, expiresAt) {
    this.events.push({ ts, name, size, expiresAt });
  }

  fileUploadAt(timestamp, fileName, size, ttl = null) {
    if (this._isAlive(fileName, timestamp)) throw new Error('File already exists');
    const expiresAt = ttl !== null ? timestamp + Number(ttl) : null;
    const entry = { size: +size, uploadedAt: timestamp, expiresAt };
    this.files.set(fileName, entry);
    this._logEvent(timestamp, fileName, +size, expiresAt);
    return String(size);
  }

  fileGetAt(timestamp, fileName) {
    if (!this._isAlive(fileName, timestamp)) return '';
    return String(this.files.get(fileName).size);
  }

  fileCopyAt(timestamp, source, dest) {
    if (!this._isAlive(source, timestamp)) throw new Error('Source file not found or expired');
    const src = this.files.get(source);
    const entry = { size: src.size, uploadedAt: timestamp, expiresAt: src.expiresAt };
    this.files.set(dest, entry);
    this._logEvent(timestamp, dest, src.size, src.expiresAt);
    return String(src.size);
  }

  fileSearchAt(timestamp, prefix) {
    const matches = [];
    for (const [name, f] of this.files) {
      if (name.startsWith(prefix) && this._isAlive(name, timestamp)) {
        matches.push([name, f.size]);
      }
    }
    matches.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return matches.slice(0, 10).map(([name]) => name).join(', ');
  }

  // === LEVEL 4: Extending Design & Functionality ===
  // ROLLBACK: restore state at target timestamp from event log
  // TTL recalc: remaining = expiresAt - timestamp; new_expiresAt = timestamp + remaining = expiresAt (unchanged)
  // Effectively: restore files alive at timestamp, keeping their original expiresAt values
  // TRANSITION L3→L4: _logEvent() must be called on every write in L3 methods above

  rollback(timestamp) {
    // Build a map: most recent event at or before timestamp for each file
    const stateMap = new Map();
    for (const evt of this.events) {
      if (evt.ts <= timestamp) {
        stateMap.set(evt.name, evt);
      }
    }
    // Restore only files still alive at timestamp
    this.files.clear();
    for (const [name, evt] of stateMap) {
      if (evt.expiresAt === null || evt.expiresAt > timestamp) {
        this.files.set(name, { size: evt.size, uploadedAt: evt.ts, expiresAt: evt.expiresAt });
      }
    }
    // Truncate event log to rollback point so future ops build on correct history
    this.events = this.events.filter(e => e.ts <= timestamp);
    return '';
  }

  simulate(commands) {
    return commands.map(cmd => {
      const [op, ...a] = cmd;
      try {
        switch (op) {
          case 'FILE_UPLOAD': return this.fileUpload(a[0], a[1]);
          case 'FILE_GET': return this.fileGet(a[0]);
          case 'FILE_COPY': return this.fileCopy(a[0], a[1]);
          case 'FILE_SEARCH': return this.fileSearch(a[0]);
          case 'FILE_UPLOAD_AT':
            // optional ttl: cmd = ['FILE_UPLOAD_AT', ts, name, size] or [..., size, ttl]
            return this.fileUploadAt(+a[0], a[1], a[2], a[3] !== undefined ? +a[3] : null);
          case 'FILE_GET_AT': return this.fileGetAt(+a[0], a[1]);
          case 'FILE_COPY_AT': return this.fileCopyAt(+a[0], a[1], a[2]);
          case 'FILE_SEARCH_AT': return this.fileSearchAt(+a[0], a[1]);
          case 'ROLLBACK': return this.rollback(+a[0]);
          default: return '';
        }
      } catch (e) {
        return '';
      }
    });
  }
}

module.exports = FileStorage;
