/**
 * File Storage — Level 2 Tests
 * New op: fileSearch(prefix)
 * Key: top 10, sorted by size DESC then fileName ASC
 */
const FileStorage = require('./fileStorage');

let fs;
beforeEach(() => { fs = new FileStorage(); });

describe('fileSearch', () => {
  test('returns files matching prefix', () => {
    fs.fileUpload('file1.txt', 200);
    fs.fileUpload('file2.txt', 100);
    fs.fileUpload('other.csv', 300);
    const results = fs.fileSearch('file');
    expect(results).toEqual(['file1.txt(200)', 'file2.txt(100)']);
  });

  test('sorts by size DESC', () => {
    fs.fileUpload('b.txt', 100);
    fs.fileUpload('a.txt', 200);
    const results = fs.fileSearch('');
    expect(results[0]).toBe('a.txt(200)');
    expect(results[1]).toBe('b.txt(100)');
  });

  test('tie-break: smaller file name ASC', () => {
    fs.fileUpload('b.txt', 500);
    fs.fileUpload('a.txt', 500);
    const results = fs.fileSearch('');
    expect(results[0]).toBe('a.txt(500)');
    expect(results[1]).toBe('b.txt(500)');
  });

  test('returns at most 10 results', () => {
    for (let i = 1; i <= 15; i++) {
      fs.fileUpload(`file${i}.txt`, i * 10);
    }
    expect(fs.fileSearch('file').length).toBe(10);
  });

  test('no match returns empty array', () => {
    fs.fileUpload('readme.md', 100);
    expect(fs.fileSearch('xyz')).toEqual([]);
  });
});
