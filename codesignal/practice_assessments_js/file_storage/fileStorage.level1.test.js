/**
 * File Storage — Level 1 Tests
 * Operations: fileUpload, fileGet, fileCopy
 * Edge cases: duplicate upload throws, source missing throws, dest overwrite is OK
 */
const FileStorage = require('./fileStorage');

let fs;
beforeEach(() => { fs = new FileStorage(); });

describe('fileUpload', () => {
  test('uploads new file without error', () => {
    expect(() => fs.fileUpload('file.txt', 100)).not.toThrow();
  });

  test('duplicate upload throws', () => {
    fs.fileUpload('file.txt', 100);
    expect(() => fs.fileUpload('file.txt', 200)).toThrow();
  });
});

describe('fileGet', () => {
  test('returns size for existing file', () => {
    fs.fileUpload('file.txt', 4321);
    expect(fs.fileGet('file.txt')).toBe(4321);
  });

  test('returns undefined for missing file', () => {
    expect(fs.fileGet('missing.txt')).toBeUndefined();
  });
});

describe('fileCopy', () => {
  test('copies file to new location', () => {
    fs.fileUpload('a.txt', 500);
    fs.fileCopy('a.txt', 'b.txt');
    expect(fs.fileGet('b.txt')).toBe(500);
  });

  test('source missing throws', () => {
    expect(() => fs.fileCopy('missing.txt', 'dest.txt')).toThrow();
  });

  test('overwrites destination if it exists', () => {
    fs.fileUpload('a.txt', 500);
    fs.fileUpload('b.txt', 100);
    fs.fileCopy('a.txt', 'b.txt');
    expect(fs.fileGet('b.txt')).toBe(500);
  });

  test('original file still exists after copy', () => {
    fs.fileUpload('a.txt', 500);
    fs.fileCopy('a.txt', 'b.txt');
    expect(fs.fileGet('a.txt')).toBe(500);
  });
});
