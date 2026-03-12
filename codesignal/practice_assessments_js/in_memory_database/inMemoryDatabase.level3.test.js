/**
 * In-Memory Database — Level 3 Tests
 * New ops: setFieldAt, setFieldWithTTL, getFieldAt, getAt, deleteFieldAt, scanAt, scanByFieldAt
 *
 * Key TTL rule: field valid in [setTimestamp, setTimestamp + ttl)
 *   → expired AT timestamp + ttl (unavailable), valid AT timestamp + ttl - 1
 *
 * TRANSITION from L2: Level 1-2 ops remain; add *_AT / *_WITH_TTL variants.
 */
const InMemoryDatabase = require('./inMemoryDatabase');

let db;
beforeEach(() => { db = new InMemoryDatabase(); });

describe('setFieldAt / getFieldAt (no TTL)', () => {
  test('field without TTL lives forever', () => {
    db.setFieldAt(10, 'k1', 'f1', 'v1');
    expect(db.getFieldAt(9999, 'k1', 'f1')).toBe('v1');
  });
});

describe('setFieldWithTTL / getFieldAt', () => {
  test('field alive before expiry', () => {
    db.setFieldWithTTL(10, 'k1', 'f1', 'v1', 5); // expires at 15
    expect(db.getFieldAt(14, 'k1', 'f1')).toBe('v1');
  });

  test('field expired at exactly TTL boundary', () => {
    db.setFieldWithTTL(10, 'k1', 'f1', 'v1', 5); // expires at 15
    expect(db.getFieldAt(15, 'k1', 'f1')).toBe('');
  });

  test('field expired after TTL', () => {
    db.setFieldWithTTL(10, 'k1', 'f1', 'v1', 5);
    expect(db.getFieldAt(100, 'k1', 'f1')).toBe('');
  });
});

describe('getAt', () => {
  test('only includes alive fields', () => {
    db.setFieldAt(10, 'k1', 'perm', 'p');
    db.setFieldWithTTL(10, 'k1', 'temp', 't', 5); // expires at 15
    expect(db.getAt(14, 'k1')).toBe('perm(p), temp(t)');
    expect(db.getAt(15, 'k1')).toBe('perm(p)');
  });

  test('all fields expired → ""', () => {
    db.setFieldWithTTL(10, 'k1', 'f', 'v', 5); // expires at 15
    expect(db.getAt(20, 'k1')).toBe('');
  });
});

describe('deleteFieldAt', () => {
  test('deletes alive field → "true"', () => {
    db.setFieldAt(10, 'k1', 'f', 'v');
    expect(db.deleteFieldAt(15, 'k1', 'f')).toBe('true');
  });

  test('expired field → "false"', () => {
    db.setFieldWithTTL(10, 'k1', 'f', 'v', 5); // expires at 15
    expect(db.deleteFieldAt(20, 'k1', 'f')).toBe('false');
  });

  test('missing key → "false"', () => {
    expect(db.deleteFieldAt(1, 'ghost', 'f')).toBe('false');
  });
});

describe('scanAt', () => {
  test('excludes keys with all expired fields', () => {
    db.setFieldWithTTL(10, 'user1', 'f', 'v', 5); // expires at 15
    db.setFieldAt(10, 'user2', 'f', 'v');
    expect(db.scanAt(20, 'user')).toBe('user2');
  });
});

describe('scanByFieldAt', () => {
  test('only returns keys with alive matching field', () => {
    db.setFieldWithTTL(10, 'u1', 'role', 'admin', 5); // expires at 15
    db.setFieldAt(10, 'u2', 'role', 'admin');
    expect(db.scanByFieldAt(20, 'role', 'admin')).toBe('u2');
    expect(db.scanByFieldAt(10, 'role', 'admin')).toBe('u1, u2');
  });
});
