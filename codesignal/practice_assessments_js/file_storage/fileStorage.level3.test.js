/**
 * File Storage — Level 3 Tests
 * New ops: fileUploadAt (with optional TTL), fileGetAt, fileCopyAt, fileSearchAt
 *
 * Key: expiresAt = uploadTimestamp + ttl (in seconds)
 * "Alive" = expiresAt === null OR timestamp < expiresAt
 * TRANSITION: All Level 1-2 ops still exist; Level 3 adds *_AT variants.
 */
const FileStorage = require('./fileStorage');

let fs;
beforeEach(() => { fs = new FileStorage(); });

describe('fileUploadAt without TTL', () => {
  test('uploaded file is alive indefinitely', () => {
    fs.fileUploadAt(1, 'file.txt', 100);
    expect(fs.fileGetAt(1000, 'file.txt')).toBe(100);
  });
});

describe('fileUploadAt with TTL', () => {
  test('file alive within TTL window', () => {
    fs.fileUploadAt(10, 'file.txt', 200, 5); // expires at t=15
    expect(fs.fileGetAt(14, 'file.txt')).toBe(200);
  });

  test('file expired at exactly TTL boundary', () => {
    fs.fileUploadAt(10, 'file.txt', 200, 5); // expires at t=15
    expect(fs.fileGetAt(15, 'file.txt')).toBeUndefined();
  });

  test('file expired after TTL', () => {
    fs.fileUploadAt(10, 'file.txt', 200, 5); // expires at t=15
    expect(fs.fileGetAt(20, 'file.txt')).toBeUndefined();
  });

  test('can upload same name after expiry', () => {
    fs.fileUploadAt(10, 'file.txt', 200, 5); // expires at t=15
    expect(() => fs.fileUploadAt(20, 'file.txt', 300)).not.toThrow();
    expect(fs.fileGetAt(20, 'file.txt')).toBe(300);
  });
});

describe('fileCopyAt', () => {
  test('copies alive file', () => {
    fs.fileUploadAt(10, 'src.txt', 500, 100);
    fs.fileCopyAt(20, 'src.txt', 'dest.txt');
    expect(fs.fileGetAt(20, 'dest.txt')).toBe(500);
  });

  test('copying expired file throws', () => {
    fs.fileUploadAt(10, 'src.txt', 500, 5); // expires at 15
    expect(() => fs.fileCopyAt(20, 'src.txt', 'dest.txt')).toThrow();
  });
});

describe('fileSearchAt', () => {
  test('excludes expired files', () => {
    fs.fileUploadAt(10, 'a.txt', 200, 5);  // expires at 15
    fs.fileUploadAt(10, 'b.txt', 100, 50); // expires at 60
    const results = fs.fileSearchAt(20, '');
    expect(results).toEqual(['b.txt(100)']);
  });

  test('includes files with no TTL', () => {
    fs.fileUploadAt(10, 'permanent.txt', 300);
    const results = fs.fileSearchAt(9999, 'permanent');
    expect(results).toEqual(['permanent.txt(300)']);
  });
});
