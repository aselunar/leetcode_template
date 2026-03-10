const InMemoryDatabase = require('./inMemoryDatabase');

describe('In-Memory Database - Level 2: Filtering & Querying', () => {
  let db;
  beforeEach(() => { db = new InMemoryDatabase(); });

  test('scan returns keys with prefix sorted alphabetically', () => {
    db.setField('user1', 'name', 'Alice');
    db.setField('user2', 'name', 'Bob');
    db.setField('admin1', 'role', 'admin');
    expect(db.scan('user')).toBe('user1, user2');
  });

  test('scan returns empty string when no matches', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.scan('xyz')).toBe('');
  });

  test('scan_by_field returns matching keys sorted alphabetically', () => {
    db.setField('user1', 'role', 'admin');
    db.setField('user2', 'role', 'user');
    db.setField('user3', 'role', 'admin');
    expect(db.scanByField('role', 'admin')).toBe('user1, user3');
  });

  test('scan_by_field returns empty string when no matches', () => {
    db.setField('user1', 'role', 'admin');
    expect(db.scanByField('role', 'superuser')).toBe('');
  });

  test('delete removes entire key', () => {
    db.setField('user1', 'name', 'Alice');
    db.setField('user1', 'age', '30');
    expect(db.delete('user1')).toBe('true');
    expect(db.get('user1')).toBe('');
  });

  test('delete returns false for non-existent key', () => {
    expect(db.delete('nope')).toBe('false');
  });

  test('top_n_keys returns keys by field count desc', () => {
    db.setField('user1', 'a', '1');
    db.setField('user1', 'b', '2');
    db.setField('user1', 'c', '3');
    db.setField('user2', 'a', '1');
    db.setField('user2', 'b', '2');
    db.setField('user3', 'a', '1');
    expect(db.topNKeys(3)).toBe('user1(3), user2(2), user3(1)');
  });

  test('top_n_keys tie-breaking by key name ascending', () => {
    db.setField('z_key', 'a', '1');
    db.setField('a_key', 'a', '1');
    db.setField('m_key', 'a', '1');
    // All have 1 field, sorted by key name asc
    expect(db.topNKeys(3)).toBe('a_key(1), m_key(1), z_key(1)');
  });

  test('top_n_keys with n greater than number of keys returns all', () => {
    db.setField('user1', 'a', '1');
    db.setField('user2', 'a', '1');
    expect(db.topNKeys(10)).toBe('user1(1), user2(1)');
  });

  test('scan excludes deleted keys', () => {
    db.setField('user1', 'name', 'Alice');
    db.setField('user2', 'name', 'Bob');
    db.delete('user1');
    expect(db.scan('user')).toBe('user2');
  });

  test('simulate: level 2 combined scenario', () => {
    const result = db.simulate([
      ['SET_FIELD', 'u1', 'role', 'admin'],
      ['SET_FIELD', 'u2', 'role', 'user'],
      ['SET_FIELD', 'u3', 'role', 'admin'],
      ['SET_FIELD', 'u1', 'dept', 'eng'],
      ['SCAN', 'u'],
      ['SCAN_BY_FIELD', 'role', 'admin'],
      ['TOP_N_KEYS', 2],
      ['DELETE', 'u2'],
      ['SCAN', 'u'],
    ]);
    expect(result[4]).toBe('u1, u2, u3');
    expect(result[5]).toBe('u1, u3');
    expect(result[6]).toBe('u1(2), u2(1)');
    expect(result[7]).toBe('true');
    expect(result[8]).toBe('u1, u3');
  });
});
