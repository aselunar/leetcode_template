const InMemoryDatabase = require('./inMemoryDatabase');

describe('In-Memory Database - Level 4: Backup & Restore', () => {
  let db;
  beforeEach(() => { db = new InMemoryDatabase(); });

  test('backup returns sequential id starting from backup_1', () => {
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    expect(db.backup(10)).toBe('backup_1');
    expect(db.backup(20)).toBe('backup_2');
  });

  test('backup only captures alive fields at snapshot time', () => {
    db.setFieldWithTTL(10, 'u1', 'token', 'abc', 20); // expires at 30
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    const id = db.backup(30); // at ts=30, 'token' is expired
    db.restore(30, id);
    expect(db.getFieldAt(30, 'u1', 'name')).toBe('Alice');
    expect(db.getFieldAt(30, 'u1', 'token')).toBe('');
  });

  test('restore replaces entire db with backup data', () => {
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    const id = db.backup(10);
    db.setFieldAt(20, 'u2', 'name', 'Bob');
    db.restore(20, id); // restores only u1
    expect(db.getFieldAt(20, 'u1', 'name')).toBe('Alice');
    expect(db.getFieldAt(20, 'u2', 'name')).toBe('');
  });

  test('restore returns count of restored keys', () => {
    db.setFieldAt(10, 'u1', 'a', '1');
    db.setFieldAt(10, 'u2', 'b', '2');
    const id = db.backup(10);
    expect(db.restore(10, id)).toBe('2');
  });

  test('restore returns empty string for non-existent backup', () => {
    expect(db.restore(10, 'backup_99')).toBe('');
  });

  test('restore recalculates TTL: remaining from backup time shifted to restore time', () => {
    // Field set at ts=10 with TTL=100 (expiresAt=110)
    db.setFieldWithTTL(10, 'u1', 'token', 'abc', 100);
    const id = db.backup(10); // backup at ts=10, token has expiresAt=110
    // Restore at ts=50: remaining = 110-10=100, new expiresAt = 50+100=150
    db.restore(50, id);
    expect(db.getFieldAt(149, 'u1', 'token')).toBe('abc');
    expect(db.getFieldAt(150, 'u1', 'token')).toBe('');
  });

  test('compare returns empty string when backups are identical', () => {
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    const id1 = db.backup(10);
    const id2 = db.backup(10);
    expect(db.compare(id1, id2)).toBe('');
  });

  test('compare returns keys that differ', () => {
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    db.setFieldAt(10, 'u2', 'name', 'Bob');
    const id1 = db.backup(10);
    db.setFieldAt(20, 'u1', 'name', 'Changed'); // modify u1
    db.setFieldAt(20, 'u3', 'name', 'Carol');   // add u3
    const id2 = db.backup(20);
    // u2 exists in id2 with same value -> not different
    // u1 value changed -> different
    // u3 only in id2 -> different
    const result = db.compare(id1, id2);
    expect(result).toContain('u1');
    expect(result).toContain('u3');
    expect(result).not.toContain('u2');
  });

  test('compare returns empty string for non-existent backup', () => {
    db.setFieldAt(10, 'u1', 'a', '1');
    const id1 = db.backup(10);
    expect(db.compare(id1, 'backup_99')).toBe('');
  });

  test('get_backup_info returns correct counts', () => {
    db.setFieldAt(10, 'u1', 'a', '1');
    db.setFieldAt(10, 'u1', 'b', '2');
    db.setFieldAt(10, 'u2', 'x', 'val');
    const id = db.backup(10);
    expect(db.getBackupInfo(id)).toBe('keys:2,fields:3,timestamp:10');
  });

  test('get_backup_info returns empty string for non-existent backup', () => {
    expect(db.getBackupInfo('backup_99')).toBe('');
  });

  test('simulate: level 4 backup/restore scenario', () => {
    const result = db.simulate([
      ['SET_FIELD_AT', 10, 'u1', 'name', 'Alice'],
      ['SET_FIELD_AT', 10, 'u2', 'name', 'Bob'],
      ['BACKUP', 10],
      ['SET_FIELD_AT', 20, 'u1', 'name', 'Changed'],
      ['SET_FIELD_AT', 20, 'u3', 'name', 'Carol'],
      ['BACKUP', 20],
      ['COMPARE', 'backup_1', 'backup_2'],
      ['RESTORE', 30, 'backup_1'],
      ['GET_FIELD_AT', 30, 'u1', 'name'],
      ['GET_FIELD_AT', 30, 'u3', 'name'],
      ['GET_BACKUP_INFO', 'backup_1'],
    ]);
    expect(result[2]).toBe('backup_1');
    expect(result[5]).toBe('backup_2');
    expect(result[6]).toBe('u1, u3'); // u1 changed, u3 only in backup_2
    expect(result[7]).toBe('2');       // 2 keys restored
    expect(result[8]).toBe('Alice');
    expect(result[9]).toBe('');
    expect(result[10]).toBe('keys:2,fields:2,timestamp:10');
  });
});
