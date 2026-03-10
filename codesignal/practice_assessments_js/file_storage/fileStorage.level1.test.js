const FileStorage = require('./fileStorage');

describe('File Storage - Level 1: Basic Operations', () => {
  let fs;
  beforeEach(() => { fs = new FileStorage(); });

  test('file_upload returns size as string', () => {
    expect(fs.fileUpload('file1.txt', 100)).toBe('100');
  });

  test('file_upload throws (returns empty string in simulate) if file exists', () => {
    fs.fileUpload('file1.txt', 100);
    expect(() => fs.fileUpload('file1.txt', 200)).toThrow();
  });

  test('file_get returns size for existing file', () => {
    fs.fileUpload('file1.txt', 100);
    expect(fs.fileGet('file1.txt')).toBe('100');
  });

  test('file_get returns empty string for non-existent file', () => {
    expect(fs.fileGet('nope.txt')).toBe('');
  });

  test('file_copy returns size of copied file', () => {
    fs.fileUpload('src.txt', 250);
    expect(fs.fileCopy('src.txt', 'dst.txt')).toBe('250');
  });

  test('file_copy makes the dest accessible', () => {
    fs.fileUpload('src.txt', 250);
    fs.fileCopy('src.txt', 'dst.txt');
    expect(fs.fileGet('dst.txt')).toBe('250');
  });

  test('file_copy overwrites existing destination', () => {
    fs.fileUpload('src.txt', 300);
    fs.fileUpload('dst.txt', 100);
    fs.fileCopy('src.txt', 'dst.txt');
    expect(fs.fileGet('dst.txt')).toBe('300');
  });

  test('file_copy throws if source does not exist', () => {
    expect(() => fs.fileCopy('nope.txt', 'dst.txt')).toThrow();
  });

  test('simulate: level 1 combined scenario', () => {
    const result = fs.simulate([
      ['FILE_UPLOAD', 'file1.txt', 100],
      ['FILE_GET', 'file1.txt'],
      ['FILE_GET', 'nope.txt'],
      ['FILE_COPY', 'file1.txt', 'file2.txt'],
      ['FILE_GET', 'file2.txt'],
      ['FILE_UPLOAD', 'file1.txt', 200], // should fail -> ''
    ]);
    expect(result).toEqual(['100', '100', '', '100', '100', '']);
  });
});
