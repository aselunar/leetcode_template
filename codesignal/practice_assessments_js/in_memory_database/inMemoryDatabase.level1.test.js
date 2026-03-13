/**
 * In-Memory Database — Level 1 Tests
 * Operations: setField, getField, deleteField, get
 * Edge cases: missing key, missing field, last field removes key, sorted output
 */
const InMemoryDatabase = require('./inMemoryDatabase');

let db;
beforeEach(() => { db = new InMemoryDatabase(); });

describe('setField', () => {
  test('creates key and sets field, returns value', () => {
    expect(db.setField('user1', 'name', 'Alice')).toBe('Alice');
  });

  test('overwrites existing field', () => {
    db.setField('user1', 'name', 'Alice');
    db.setField('user1', 'name', 'Bob');
    expect(db.getField('user1', 'name')).toBe('Bob');
  });
});

describe('getField', () => {
  test('returns value for existing key/field', () => {
    db.setField('user1', 'age', '30');
    expect(db.getField('user1', 'age')).toBe('30');
  });

  test('missing key → ""', () => {
    expect(db.getField('ghost', 'name')).toBe('');
  });

  test('missing field → ""', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.getField('user1', 'missing')).toBe('');
  });
});

describe('deleteField', () => {
  test('deletes existing field → "true"', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.deleteField('user1', 'name')).toBe('true');
  });

  test('missing key → "false"', () => {
    expect(db.deleteField('ghost', 'name')).toBe('false');
  });

  test('missing field → "false"', () => {
    db.setField('user1', 'name', 'Alice');
    expect(db.deleteField('user1', 'missing')).toBe('false');
  });

  test('deleting last field removes the key', () => {
    db.setField('user1', 'name', 'Alice');
    db.deleteField('user1', 'name');
    expect(db.getField('user1', 'name')).toBe('');
    expect(db.get('user1')).toBe('');
  });
});

describe('get', () => {
  test('returns alphabetically sorted fields', () => {
    db.setField('user1', 'city', 'NYC');
    db.setField('user1', 'age', '30');
    db.setField('user1', 'name', 'Alice');
    expect(db.get('user1')).toBe('age(30), city(NYC), name(Alice)');
  });

  test('missing key → ""', () => {
    expect(db.get('ghost')).toBe('');
  });

  test('single field', () => {
    db.setField('k1', 'f1', 'v1');
    expect(db.get('k1')).toBe('f1(v1)');
  });
});
