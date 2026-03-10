const FileStorage = require('./fileStorage');

describe('File Storage - Level 4: Rollback', () => {
  let fs;
  beforeEach(() => { fs = new FileStorage(); });

  test('rollback restores files that existed at target timestamp', () => {
    fs.fileUploadAt(10, 'file1.txt', 100);
    fs.fileUploadAt(20, 'file2.txt', 200);
    fs.fileUploadAt(30, 'file3.txt', 300);
    fs.rollback(20); // rollback to ts=20
    expect(fs.fileGetAt(20, 'file1.txt')).toBe('100');
    expect(fs.fileGetAt(20, 'file2.txt')).toBe('200');
    expect(fs.fileGetAt(20, 'file3.txt')).toBe(''); // didn't exist at ts=20
  });

  test('rollback removes files added after target timestamp', () => {
    fs.fileUploadAt(10, 'old.txt', 100);
    fs.fileUploadAt(30, 'new.txt', 200);
    fs.rollback(20);
    expect(fs.fileGetAt(20, 'new.txt')).toBe('');
  });

  test('rollback excludes files expired at target timestamp', () => {
    fs.fileUploadAt(10, 'expired.txt', 100, 5); // expires at 15
    fs.rollback(20);
    expect(fs.fileGetAt(20, 'expired.txt')).toBe('');
  });

  test('rollback retains TTL from original upload', () => {
    fs.fileUploadAt(10, 'file.txt', 100, 100); // expires at 110
    fs.rollback(20);
    // After rollback to ts=20, file still has expiresAt=110
    expect(fs.fileGetAt(109, 'file.txt')).toBe('100');
    expect(fs.fileGetAt(110, 'file.txt')).toBe('');
  });

  test('rollback allows new uploads after rollback', () => {
    fs.fileUploadAt(10, 'file1.txt', 100);
    fs.fileUploadAt(20, 'file2.txt', 200);
    fs.rollback(10);
    // file2.txt was added after ts=10, so it's gone
    expect(fs.fileGetAt(10, 'file2.txt')).toBe('');
    // Can upload file2.txt again
    fs.fileUploadAt(15, 'file2.txt', 999);
    expect(fs.fileGetAt(15, 'file2.txt')).toBe('999');
  });

  test('rollback with copy: restores destination from most recent copy at target time', () => {
    fs.fileUploadAt(10, 'src.txt', 100);
    fs.fileCopyAt(15, 'src.txt', 'copy.txt');   // copy at ts=15, size=100
    fs.fileUploadAt(20, 'big.txt', 500);
    fs.fileCopyAt(25, 'big.txt', 'copy.txt');   // overwrite copy at ts=25, size=500
    fs.rollback(20);
    // At ts=20, copy.txt was set at ts=15 (size=100), not ts=25
    expect(fs.fileGetAt(20, 'copy.txt')).toBe('100');
  });

  test('simulate: level 4 rollback scenario', () => {
    const result = fs.simulate([
      ['FILE_UPLOAD_AT', 10, 'a.txt', 100],
      ['FILE_UPLOAD_AT', 20, 'b.txt', 200],
      ['FILE_UPLOAD_AT', 30, 'c.txt', 300],
      ['ROLLBACK', 20],
      ['FILE_GET_AT', 20, 'a.txt'],  // exists
      ['FILE_GET_AT', 20, 'b.txt'],  // exists
      ['FILE_GET_AT', 20, 'c.txt'],  // does not exist after rollback
    ]);
    expect(result[4]).toBe('100');
    expect(result[5]).toBe('200');
    expect(result[6]).toBe('');
  });
});
