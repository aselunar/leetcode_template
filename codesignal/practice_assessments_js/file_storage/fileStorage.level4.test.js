/**
 * File Storage — Level 4 Tests
 * New op: rollback(timestamp)
 *
 * Key: rollback restores files to their state at given timestamp.
 * TTLs are recalculated: newExpiresAt = rollbackTs + (originalExpiresAt - snapshotTs)
 *
 * IMPORTANT: fileUploadAt and fileCopyAt must call _recordHistory internally.
 * The tests in "rollback without manual _recordHistory" verify this integration —
 * they would have failed on commit 862adef (before the fix) because those methods
 * did not yet call _recordHistory themselves.
 */
const FileStorage = require('./fileStorage');

let fs;
beforeEach(() => { fs = new FileStorage(); });

// These tests use manual _recordHistory calls (kept for historical context).
// They passed even before the fix because they orchestrate history themselves.
describe('rollback (manual _recordHistory)', () => {
  test('restores files removed after snapshot', () => {
    // snapshot state at t=10 (file.txt does not exist yet)
    fs._recordHistory(10);
    fs.fileUploadAt(10, 'file.txt', 100);

    // After rollback to before t=10: file.txt should not exist
    fs.rollback(9);
    expect(fs.fileGetAt(9, 'file.txt')).toBeUndefined();
  });

  test('after rollback files match the restored state', () => {
    // fileUploadAt now auto-records, so the manual call below adds a second snapshot
    fs.fileUploadAt(5, 'a.txt', 200);
    fs._recordHistory(5); // snapshot with a.txt present

    fs.fileUploadAt(10, 'b.txt', 300);
    expect(fs.fileGetAt(10, 'b.txt')).toBe(300);

    // Rollback to t=5 — most recent snapshot at t=5 has a.txt; b.txt not yet uploaded
    fs.rollback(5);
    expect(fs.fileGetAt(5, 'b.txt')).toBeUndefined();
    expect(fs.fileGetAt(5, 'a.txt')).toBe(200);
  });
});

// These tests do NOT call _recordHistory manually.
// They rely on fileUploadAt / fileCopyAt recording history automatically.
// They would have FAILED on commit 862adef (before _recordHistory was wired in).
//
// Key insight: when there is NO history, rollback() clears ALL files (no entry found).
// With auto-recording, rollback to the timestamp of a mutation finds the snapshot
// taken just before that mutation, so files uploaded before that point are preserved.
describe('rollback without manual _recordHistory', () => {
  test('fileUploadAt auto-records: earlier upload survives rollback of later upload', () => {
    fs.fileUploadAt(5, 'a.txt', 200);   // auto-records {} at t=5, then adds a.txt
    fs.fileUploadAt(10, 'b.txt', 300);  // auto-records {a.txt} at t=10, then adds b.txt

    // rollback(10): finds snapshot at t=10 → {a.txt}; b.txt is rolled back
    fs.rollback(10);
    expect(fs.fileGetAt(10, 'a.txt')).toBe(200);        // a.txt preserved
    expect(fs.fileGetAt(10, 'b.txt')).toBeUndefined();  // b.txt rolled back
    // On pre-fix code: no history → rollback clears all → a.txt would be undefined → FAIL
  });

  test('fileCopyAt auto-records: source survives rollback of copy', () => {
    fs.fileUploadAt(5, 'src.txt', 500);          // auto-records {} at t=5
    fs.fileCopyAt(10, 'src.txt', 'dst.txt');     // auto-records {src.txt} at t=10

    // rollback(10): finds snapshot at t=10 → {src.txt}; dst.txt copy is rolled back
    fs.rollback(10);
    expect(fs.fileGetAt(10, 'src.txt')).toBe(500);       // source preserved
    expect(fs.fileGetAt(10, 'dst.txt')).toBeUndefined(); // copy rolled back
    // On pre-fix code: no history → rollback clears all → src.txt would be undefined → FAIL
  });

  test('fileUploadAt auto-records: TTL recalculated correctly after rollback', () => {
    // auto-records {} at t=0, then adds temp.txt (expiresAt = 0+20 = 20)
    fs.fileUploadAt(0, 'temp.txt', 100, 20);
    // auto-records {temp.txt} at t=5, then adds other.txt
    fs.fileUploadAt(5, 'other.txt', 50);

    // rollback(10): finds snapshot at t=5 → {temp.txt, expiresAt=20}
    // TTL recalc: remaining = 20 - 5 = 15; newExpiresAt = 10 + 15 = 25
    fs.rollback(10);
    expect(fs.fileGetAt(10, 'temp.txt')).toBe(100);        // alive at t=10
    expect(fs.fileGetAt(24, 'temp.txt')).toBe(100);        // alive at t=24
    expect(fs.fileGetAt(25, 'temp.txt')).toBeUndefined();  // expired at t=25
    expect(fs.fileGetAt(10, 'other.txt')).toBeUndefined(); // rolled back
    // On pre-fix code: no history → rollback clears all → temp.txt would be undefined → FAIL
  });
});
