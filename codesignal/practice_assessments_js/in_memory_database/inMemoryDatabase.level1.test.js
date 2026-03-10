const InMemoryDatabase = require('./inMemoryDatabase');

describe('In-Memory Database - Level 1: Basic Field Operations', () => {
  let db;
  beforeEach(() => { db = new InMemoryDatabase(); });

  test('set_field returns the value that was set', () => {
    expect(db.setField('user1', 'name', 'Alice')).toBe('Alice');
  });

  test('set_field creates key if not exists', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.getField('user1', 'name')).toBe('Alice');
  });

  test('set_field overwrites existing field', () => {
    db.setField('user1', 'name', 'Alice');
    db.setField('user1', 'name', 'Bob');
    expect(db.getField('user1', 'name')).toBe('Bob');
  });

  test('get_field returns empty string for non-existent key', () => {
    expect(db.getField('nope', 'name')).toBe('');
  });

  test('get_field returns empty string for non-existent field', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.getField('user1', 'age')).toBe('');
  });

  test('delete_field returns true and removes field', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.deleteField('user1', 'name')).toBe('true');
    expect(db.getField('user1', 'name')).toBe('');
  });

  test('delete_field removes key when last field is deleted', () => {
    db.setField('user1', 'name', 'Alice');
    db.deleteField('user1', 'name');
    // Key should be gone
    expect(db.get('user1')).toBe('');
  });

  test('delete_field returns false for non-existent key', () => {
    expect(db.deleteField('nope', 'name')).toBe('false');
  });

  test('delete_field returns false for non-existent field', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.deleteField('user1', 'age')).toBe('false');
  });

  test('get returns fields sorted alphabetically', () => {
    db.setField('user1', 'city', 'NYC');
    db.setField('user1', 'age', '30');
    db.setField('user1', 'name', 'Alice');
    expect(db.get('user1')).toBe('age(30), city(NYC), name(Alice)');
  });

  test('get returns empty string for non-existent key', () => {
    expect(db.get('nope')).toBe('');
  });

  test('simulate: level 1 combined scenario', () => {
    const result = db.simulate([
      ['SET_FIELD', 'u1', 'name', 'Alice'],
      ['SET_FIELD', 'u1', 'age', '30'],
      ['GET_FIELD', 'u1', 'name'],
      ['GET_FIELD', 'u1', 'missing'],
      ['GET', 'u1'],
      ['DELETE_FIELD', 'u1', 'age'],
      ['DELETE_FIELD', 'u1', 'age'],
      ['GET', 'u1'],
    ]);
    expect(result).toEqual(['Alice', '30', 'Alice', '', 'age(30), name(Alice)', 'true', 'false', 'name(Alice)']);
  });
});
