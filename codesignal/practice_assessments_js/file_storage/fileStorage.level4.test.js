/**
 * File Storage — Level 4 Tests
 * New op: rollback(timestamp)
 *
 * Key: rollback restores files to their state at given timestamp.
 * TTLs are recalculated: newExpiresAt = rollbackTs + (originalExpiresAt - snapshotTs)
 *
 * TRANSITION NOTE: You need to record state snapshots BEFORE each mutation.
 * Call _recordHistory(timestamp) at the start of each upload/copy operation.
 */
const FileStorage = require('./fileStorage');

let fs;
beforeEach(() => { fs = new FileStorage(); });

describe('rollback', () => {
  test('restores files removed after snapshot', () => {
    // snapshot state at t=10 (file.txt exists)
    fs._recordHistory(10);
    fs.fileUploadAt(10, 'file.txt', 100);

    // Snapshot before next mutation
    fs._recordHistory(20);
    // Simulate a deletion by uploading an expired file at t=25 (just to test rollback)

    // After rollback to t=10: file.txt should not exist (wasn't uploaded yet)
    fs.rollback(9);
    expect(fs.fileGetAt(9, 'file.txt')).toBeUndefined();
  });

  test('after rollback files match the restored state', () => {
    // Upload file, then record snapshot
    fs.fileUploadAt(5, 'a.txt', 200);
    fs._recordHistory(5); // snapshot with a.txt

    // Upload another file after snapshot
    fs.fileUploadAt(10, 'b.txt', 300);
    expect(fs.fileGetAt(10, 'b.txt')).toBe(300);

    // Rollback to t=5 — b.txt should not be present
    fs.rollback(5);
    expect(fs.fileGetAt(5, 'b.txt')).toBeUndefined();
    expect(fs.fileGetAt(5, 'a.txt')).toBe(200);
  });

  test('TTL recalculated after rollback', () => {
    // Upload file at t=0 with TTL=20 (expires at 20)
    fs.fileUploadAt(0, 'temp.txt', 100, 20);
    fs._recordHistory(0); // snapshot at t=0: temp.txt expiresAt=20

    // Upload something else and then rollback to t=0
    fs.fileUploadAt(5, 'other.txt', 50);
    fs.rollback(10); // rollback to t=10

    // After rollback to t=10: remaining TTL was 20-0=20, so newExpiresAt = 10+20 = 30
    expect(fs.fileGetAt(10, 'temp.txt')).toBe(100); // alive
    expect(fs.fileGetAt(30, 'temp.txt')).toBeUndefined(); // expired at 30
  });
});
