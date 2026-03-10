const FileStorage = require('./fileStorage');

describe('File Storage - Level 2: Data Structures & Data Processing', () => {
  let fs;
  beforeEach(() => { fs = new FileStorage(); });

  test('file_search returns matching files sorted by size desc', () => {
    fs.fileUpload('doc_a.txt', 300);
    fs.fileUpload('doc_b.txt', 100);
    fs.fileUpload('doc_c.txt', 200);
    expect(fs.fileSearch('doc')).toBe('doc_a.txt, doc_c.txt, doc_b.txt');
  });

  test('file_search tie-breaking by name ascending', () => {
    fs.fileUpload('file_a.txt', 100);
    fs.fileUpload('file_b.txt', 100);
    fs.fileUpload('file_c.txt', 100);
    expect(fs.fileSearch('file')).toBe('file_a.txt, file_b.txt, file_c.txt');
  });

  test('file_search returns at most 10 results', () => {
    for (let i = 0; i < 15; i++) {
      fs.fileUpload(`report_${String(i).padStart(2, '0')}.txt`, i * 10 + 1);
    }
    const result = fs.fileSearch('report');
    expect(result.split(', ').length).toBe(10);
  });

  test('file_search returns empty string when no match', () => {
    fs.fileUpload('doc.txt', 100);
    expect(fs.fileSearch('xyz')).toBe('');
  });

  test('file_search prefix must be exact start', () => {
    fs.fileUpload('abc.txt', 100);
    fs.fileUpload('xabc.txt', 200);
    expect(fs.fileSearch('abc')).toBe('abc.txt');
  });

  test('simulate: level 2 search scenario', () => {
    const result = fs.simulate([
      ['FILE_UPLOAD', 'img_a.png', 500],
      ['FILE_UPLOAD', 'img_b.png', 300],
      ['FILE_UPLOAD', 'img_c.png', 400],
      ['FILE_UPLOAD', 'doc.txt', 1000],
      ['FILE_SEARCH', 'img'],
    ]);
    expect(result[4]).toBe('img_a.png, img_c.png, img_b.png');
  });
});
