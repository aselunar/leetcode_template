/**
 * In-Memory Database — Level 2 Tests
 * New ops: scan, scanByField, delete, topNKeys
 * Key: scan/scanByField return sorted alphabetical comma-separated strings
 * Key: topNKeys sorts by field count DESC then key ASC
 */
const InMemoryDatabase = require('./inMemoryDatabase');

let db;
beforeEach(() => { db = new InMemoryDatabase(); });

describe('scan', () => {
  test('returns keys matching prefix, sorted', () => {
    db.setField('user1', 'name', 'A');
    db.setField('user2', 'name', 'B');
    db.setField('admin1', 'role', 'x');
    expect(db.scan('user')).toBe('user1, user2');
  });

  test('empty prefix matches all keys', () => {
    db.setField('a', 'f', 'v');
    db.setField('b', 'f', 'v');
    expect(db.scan('')).toBe('a, b');
  });

  test('no match → ""', () => {
    db.setField('user1', 'name', 'A');
    expect(db.scan('xyz')).toBe('');
  });
});

describe('scanByField', () => {
  test('returns keys with matching field value', () => {
    db.setField('u1', 'role', 'admin');
    db.setField('u2', 'role', 'user');
    db.setField('u3', 'role', 'admin');
    expect(db.scanByField('role', 'admin')).toBe('u1, u3');
  });

  test('no match → ""', () => {
    db.setField('u1', 'role', 'admin');
    expect(db.scanByField('role', 'superuser')).toBe('');
  });
});

describe('delete', () => {
  test('removes existing key → "true"', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.delete('user1')).toBe('true');
    expect(db.get('user1')).toBe('');
  });

  test('missing key → "false"', () => {
    expect(db.delete('ghost')).toBe('false');
  });
});

describe('topNKeys', () => {
  test('sorts by field count DESC', () => {
    db.setField('u1', 'a', '1');
    db.setField('u1', 'b', '2');
    db.setField('u1', 'c', '3');
    db.setField('u2', 'a', '1');
    expect(db.topNKeys(2)).toBe('u1(3), u2(1)');
  });

  test('tie-break by key ASC', () => {
    db.setField('b', 'x', '1');
    db.setField('a', 'y', '2');
    expect(db.topNKeys(2)).toBe('a(1), b(1)');
  });

  test('n larger than key count returns all', () => {
    db.setField('u1', 'f', 'v');
    expect(db.topNKeys(10)).toBe('u1(1)');
  });
});
