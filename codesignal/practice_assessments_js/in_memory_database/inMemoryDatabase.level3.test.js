const InMemoryDatabase = require('./inMemoryDatabase');

describe('In-Memory Database - Level 3: TTL Support', () => {
  let db;
  beforeEach(() => { db = new InMemoryDatabase(); });

  test('set_field_at stores field with no expiry', () => {
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    expect(db.getFieldAt(999, 'u1', 'name')).toBe('Alice');
  });

  test('set_field_with_ttl: field available before expiry', () => {
    db.setFieldWithTTL(10, 'u1', 'session', 'abc', 50); // expires at 60
    expect(db.getFieldAt(59, 'u1', 'session')).toBe('abc');
  });

  test('set_field_with_ttl: field unavailable at exact expiry (T+ttl)', () => {
    db.setFieldWithTTL(10, 'u1', 'session', 'abc', 50); // expires at 60
    expect(db.getFieldAt(60, 'u1', 'session')).toBe('');
  });

  test('set_field_with_ttl: field unavailable after expiry', () => {
    db.setFieldWithTTL(10, 'u1', 'session', 'abc', 50);
    expect(db.getFieldAt(100, 'u1', 'session')).toBe('');
  });

  test('get_at excludes expired fields, includes non-expired', () => {
    db.setFieldAt(10, 'u1', 'name', 'Alice');
    db.setFieldWithTTL(10, 'u1', 'token', 'xyz', 20); // expires at 30
    expect(db.getAt(25, 'u1')).toBe('name(Alice), token(xyz)');
    expect(db.getAt(30, 'u1')).toBe('name(Alice)');
  });

  test('get_at returns empty string if all fields expired', () => {
    db.setFieldWithTTL(10, 'u1', 'token', 'xyz', 20); // expires at 30
    expect(db.getAt(30, 'u1')).toBe('');
  });

  test('delete_field_at returns false for expired field', () => {
    db.setFieldWithTTL(10, 'u1', 'token', 'xyz', 20); // expires at 30
    expect(db.deleteFieldAt(30, 'u1', 'token')).toBe('false');
  });

  test('delete_field_at returns true for alive field', () => {
    db.setFieldWithTTL(10, 'u1', 'token', 'xyz', 50);
    expect(db.deleteFieldAt(20, 'u1', 'token')).toBe('true');
  });

  test('scan_at excludes keys where all fields are expired', () => {
    db.setFieldWithTTL(10, 'user1', 'token', 'abc', 20); // expires at 30
    db.setFieldAt(10, 'user2', 'name', 'Bob');
    expect(db.scanAt(25, 'user')).toBe('user1, user2');
    expect(db.scanAt(30, 'user')).toBe('user2');
  });

  test('scan_by_field_at only returns keys with alive matching field', () => {
    db.setFieldWithTTL(10, 'u1', 'role', 'admin', 20); // expires at 30
    db.setFieldAt(10, 'u2', 'role', 'admin');
    expect(db.scanByFieldAt(25, 'role', 'admin')).toBe('u1, u2');
    expect(db.scanByFieldAt(30, 'role', 'admin')).toBe('u2');
  });

  test('overwriting with set_field_with_ttl resets expiry', () => {
    db.setFieldWithTTL(10, 'u1', 'token', 'abc', 20); // expires at 30
    db.setFieldWithTTL(25, 'u1', 'token', 'new', 100); // expires at 125
    expect(db.getFieldAt(30, 'u1', 'token')).toBe('new');
    expect(db.getFieldAt(125, 'u1', 'token')).toBe('');
  });

  test('simulate: level 3 TTL scenario', () => {
    const result = db.simulate([
      ['SET_FIELD_AT', 10, 'u1', 'name', 'Alice'],
      ['SET_FIELD_WITH_TTL', 10, 'u1', 'session', 'tok', 50],
      ['GET_FIELD_AT', 50, 'u1', 'session'],   // alive (50 < 60)
      ['GET_FIELD_AT', 60, 'u1', 'session'],   // expired
      ['GET_AT', 55, 'u1'],
      ['SCAN_AT', 60, 'u'],
      ['DELETE_FIELD_AT', 30, 'u1', 'session'],
      ['GET_FIELD_AT', 30, 'u1', 'session'],   // deleted
    ]);
    expect(result[2]).toBe('tok');
    expect(result[3]).toBe('');
    expect(result[4]).toBe('name(Alice), session(tok)');
    expect(result[5]).toBe('u1'); // only 'name' field alive
    expect(result[6]).toBe('true');
    expect(result[7]).toBe('');
  });
});
