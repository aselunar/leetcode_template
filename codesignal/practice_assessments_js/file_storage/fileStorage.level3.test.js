const FileStorage = require('./fileStorage');

describe('File Storage - Level 3: Time-Aware Operations with TTL', () => {
  let fs;
  beforeEach(() => { fs = new FileStorage(); });

  test('file_upload_at without TTL: file is always alive', () => {
    fs.fileUploadAt(10, 'file.txt', 100);
    expect(fs.fileGetAt(999, 'file.txt')).toBe('100');
  });

  test('file_upload_at with TTL: file alive before expiry', () => {
    fs.fileUploadAt(10, 'file.txt', 100, 50); // expires at 60
    expect(fs.fileGetAt(59, 'file.txt')).toBe('100');
  });

  test('file_upload_at with TTL: file not alive at exact expiry (ts === expiresAt)', () => {
    fs.fileUploadAt(10, 'file.txt', 100, 50); // expires at 60
    expect(fs.fileGetAt(60, 'file.txt')).toBe('');
  });

  test('file_upload_at with TTL: file not alive after expiry', () => {
    fs.fileUploadAt(10, 'file.txt', 100, 50); // expires at 60
    expect(fs.fileGetAt(100, 'file.txt')).toBe('');
  });

  test('file_upload_at throws if file already alive at that timestamp', () => {
    fs.fileUploadAt(10, 'file.txt', 100, 50);
    expect(() => fs.fileUploadAt(20, 'file.txt', 200)).toThrow();
  });

  test('file_upload_at allows re-upload after TTL expiry', () => {
    fs.fileUploadAt(10, 'file.txt', 100, 50); // expires at 60
    // Cannot re-upload while alive (ts=59 < expiresAt=60)
    expect(() => fs.fileUploadAt(59, 'file.txt', 200)).toThrow();
    // Can re-upload at expiry time (ts=60 is not alive: 60 < 60 is false)
    expect(fs.fileUploadAt(60, 'file.txt', 200)).toBe('200');
    // New upload has no TTL, alive at ts=60
    expect(fs.fileGetAt(60, 'file.txt')).toBe('200');
  });

  test('file_get_at returns empty for non-existent file', () => {
    expect(fs.fileGetAt(10, 'nope.txt')).toBe('');
  });

  test('file_copy_at copies alive file', () => {
    fs.fileUploadAt(10, 'src.txt', 200, 100); // expires at 110
    fs.fileCopyAt(20, 'src.txt', 'dst.txt');
    expect(fs.fileGetAt(50, 'dst.txt')).toBe('200');
  });

  test('file_copy_at copy inherits source expiry', () => {
    fs.fileUploadAt(10, 'src.txt', 200, 100); // expires at 110
    fs.fileCopyAt(20, 'src.txt', 'dst.txt');
    expect(fs.fileGetAt(109, 'dst.txt')).toBe('200');
    expect(fs.fileGetAt(110, 'dst.txt')).toBe('');
  });

  test('file_copy_at throws if source is expired', () => {
    fs.fileUploadAt(10, 'src.txt', 200, 50); // expires at 60
    expect(() => fs.fileCopyAt(60, 'src.txt', 'dst.txt')).toThrow();
  });

  test('file_search_at excludes expired files', () => {
    fs.fileUploadAt(10, 'doc_a.txt', 300, 50); // expires at 60
    fs.fileUploadAt(10, 'doc_b.txt', 200);      // no expiry
    expect(fs.fileSearchAt(59, 'doc')).toBe('doc_a.txt, doc_b.txt');
    expect(fs.fileSearchAt(60, 'doc')).toBe('doc_b.txt');
  });

  test('simulate: level 3 TTL scenario', () => {
    const result = fs.simulate([
      ['FILE_UPLOAD_AT', 10, 'file1.txt', 100, 50],  // expires 60
      ['FILE_UPLOAD_AT', 10, 'file2.txt', 200],       // no expiry
      ['FILE_GET_AT', 50, 'file1.txt'],                // alive
      ['FILE_GET_AT', 60, 'file1.txt'],                // expired
      ['FILE_SEARCH_AT', 60, 'file'],
      ['FILE_COPY_AT', 10, 'file1.txt', 'file3.txt'],
      ['FILE_GET_AT', 59, 'file3.txt'],                // alive (inherits expiry 60)
      ['FILE_GET_AT', 60, 'file3.txt'],                // expired
    ]);
    expect(result[2]).toBe('100');
    expect(result[3]).toBe('');
    expect(result[4]).toBe('file2.txt');
    expect(result[6]).toBe('100');
    expect(result[7]).toBe('');
  });
});
