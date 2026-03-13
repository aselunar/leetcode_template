/**
 * In-Memory Database — Level 4 Tests
 * New ops: backup, restore, compare, getBackupInfo
 *
 * Key: backup snapshots alive fields only
 * Key: restore recalculates expiresAt: newExpiry = restoreTs + (origExpiry - backupTs)
 * Key: compare returns differing keys (exists in one but not other, OR different field values)
 */
const InMemoryDatabase = require('./inMemoryDatabase');

let db;
beforeEach(() => { db = new InMemoryDatabase(); });

describe('backup', () => {
  test('returns sequential backup IDs', () => {
    db.setField('k1', 'f', 'v');
    expect(db.backup(10)).toBe('backup_1');
    expect(db.backup(20)).toBe('backup_2');
  });

  test('backup captures current alive state', () => {
    db.setFieldAt(10, 'k1', 'f1', 'v1');
    db.setFieldWithTTL(10, 'k1', 'f2', 'v2', 5); // expires at 15
    const bid = db.backup(10); // both alive at t=10
    const info = db.getBackupInfo(bid);
    expect(info).toContain('fields:2');
  });

  test('backup only includes alive fields at snapshot time', () => {
    db.setFieldWithTTL(10, 'k1', 'f', 'v', 5); // expires at 15
    const bid = db.backup(20); // field expired
    const info = db.getBackupInfo(bid);
    expect(info).toContain('keys:0');
  });
});

describe('restore', () => {
  test('restores keys from backup', () => {
    db.setField('k1', 'f', 'v');
    const bid = db.backup(10);
    db.delete('k1');
    expect(db.restore(20, bid)).toBe('1');
    expect(db.getField('k1', 'f')).toBe('v');
  });

  test('invalid backupId → ""', () => {
    expect(db.restore(10, 'backup_999')).toBe('');
  });

  test('TTL recalculated after restore', () => {
    // Field set at t=10 with TTL=20 → expires at 30
    db.setFieldWithTTL(10, 'k1', 'f', 'v', 20);
    const bid = db.backup(10); // backup at t=10, field expiresAt=30

    // Restore at t=50: remaining TTL = 30-10 = 20; newExpiry = 50+20 = 70
    db.restore(50, bid);
    expect(db.getFieldAt(60, 'k1', 'f')).toBe('v');  // alive
    expect(db.getFieldAt(70, 'k1', 'f')).toBe('');   // expired at 70
  });
});

describe('compare', () => {
  test('identical backups → ""', () => {
    db.setField('k1', 'f', 'v');
    const b1 = db.backup(10);
    const b2 = db.backup(10);
    expect(db.compare(b1, b2)).toBe('');
  });

  test('key in b1 not in b2 → listed', () => {
    db.setField('k1', 'f', 'v');
    const b1 = db.backup(10);
    db.delete('k1');
    const b2 = db.backup(20);
    expect(db.compare(b1, b2)).toBe('k1');
  });

  test('different field values → listed', () => {
    db.setField('k1', 'f', 'v1');
    const b1 = db.backup(10);
    db.setField('k1', 'f', 'v2');
    const b2 = db.backup(20);
    expect(db.compare(b1, b2)).toBe('k1');
  });

  test('invalid backupId → ""', () => {
    db.setField('k1', 'f', 'v');
    const b1 = db.backup(10);
    expect(db.compare(b1, 'backup_999')).toBe('');
  });
});

describe('getBackupInfo', () => {
  test('returns correct format', () => {
    db.setField('k1', 'f1', 'v');
    db.setField('k1', 'f2', 'v');
    db.setField('k2', 'f1', 'v');
    const bid = db.backup(42);
    expect(db.getBackupInfo(bid)).toBe('keys:2,fields:3,timestamp:42');
  });

  test('invalid backup → ""', () => {
    expect(db.getBackupInfo('backup_999')).toBe('');
  });
});
