/**
 * Unit tests for src/utils/file-utils.js
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIMES,
  detectFormat,
  formatFileSize,
  generateDocId,
  validateFileSize,
  readFileAsArrayBuffer,
  readFileAsText,
} from '../../src/utils/file-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal File-like object compatible with detectFormat / validateFileSize / generateDocId.
 * Uses the real `File` constructor available in jsdom so that instanceof checks (if any) still pass.
 */
function makeFile(name, size, type, lastModified) {
  // Build a tiny blob so the File has the requested size metadata.
  // jsdom's File.size is derived from content length, so we pad with bytes if needed,
  // but most utils only read .size / .name / .type / .lastModified — override size explicitly.
  const content = new Uint8Array(Math.min(size, 1024)).buffer;
  const file = new File([content], name, { type: type || '', lastModified: lastModified ?? Date.now() });
  // File.size is read-only getter from Blob; override via defineProperty so we can test arbitrary sizes.
  Object.defineProperty(file, 'size', { value: size, writable: false, configurable: true });
  if (lastModified !== undefined) {
    Object.defineProperty(file, 'lastModified', { value: lastModified, writable: false, configurable: true });
  }
  // Ensure .type reflects what we passed (jsdom may normalise empty string)
  if (type !== undefined) {
    Object.defineProperty(file, 'type', { value: type, writable: false, configurable: true });
  }
  return file;
}

/**
 * Install a mock FileReader that captures the instance for assertion or
 * triggers success / error on demand.
 */
function mockFileReader({ result = 'mock-result', shouldError = false } = {}) {
  let captured = null;
  class MockFileReader {
    constructor() {
      captured = this;
      this.result = null;
      this.onload = null;
      this.onerror = null;
    }
    readAsArrayBuffer(file) {
      this._file = file;
      queueMicrotask(() => {
        if (shouldError) {
          if (this.onerror) this.onerror(new Error('mock error'));
        } else {
          this.result = result instanceof ArrayBuffer ? result : result;
          if (this.onload) this.onload();
        }
      });
    }
    readAsText(file) {
      this._file = file;
      queueMicrotask(() => {
        if (shouldError) {
          if (this.onerror) this.onerror(new Error('mock error'));
        } else {
          this.result = result;
          if (this.onload) this.onload();
        }
      });
    }
  }
  vi.stubGlobal('FileReader', MockFileReader);
  return {
    getInstance: () => captured,
  };
}

// ===========================================================================
// FORMAT_MAP / ACCEPTED_EXTENSIONS / ACCEPTED_MIMES
// ===========================================================================
describe('ACCEPTED_EXTENSIONS', () => {
  it('contains expected extensions with dot prefix', () => {
    const parts = ACCEPTED_EXTENSIONS.split(',');
    expect(parts).toContain('.pdf');
    expect(parts).toContain('.docx');
    expect(parts).toContain('.txt');
    expect(parts).toContain('.xlsx');
    expect(parts).toContain('.csv');
    expect(parts).toContain('.epub');
    expect(parts).toContain('.html');
    expect(parts).toContain('.json');
    expect(parts).toContain('.png');
    expect(parts).toContain('.jpg');
    expect(parts).toContain('.jpeg');
    expect(parts).toContain('.webp');
    expect(parts).toContain('.svg');
    expect(parts).toContain('.md');
    expect(parts).toContain('.htm');
    expect(parts).toContain('.xls');
    expect(parts).toContain('.rtf');
    expect(parts).toContain('.tsv');
    expect(parts).toContain('.doc');
  });

  it('every entry starts with a dot', () => {
    for (const ext of ACCEPTED_EXTENSIONS.split(',')) {
      expect(ext.startsWith('.')).toBe(true);
    }
  });

  it('has no duplicate entries', () => {
    const parts = ACCEPTED_EXTENSIONS.split(',');
    expect(new Set(parts).size).toBe(parts.length);
  });
});

describe('ACCEPTED_MIMES', () => {
  it('contains expected MIME types', () => {
    const mimes = ACCEPTED_MIMES.split(',');
    expect(mimes).toContain('application/pdf');
    expect(mimes).toContain('text/plain');
    expect(mimes).toContain('text/csv');
    expect(mimes).toContain('application/json');
    expect(mimes).toContain('image/png');
    expect(mimes).toContain('image/jpeg');
    expect(mimes).toContain('application/epub+zip');
  });

  it('deduplicates MIME types (e.g. jpg and jpeg share image/jpeg)', () => {
    const mimes = ACCEPTED_MIMES.split(',');
    expect(new Set(mimes).size).toBe(mimes.length);
  });

  it('does not contain duplicates for image/jpeg even though jpg/jpeg both map to it', () => {
    const mimes = ACCEPTED_MIMES.split(',');
    const jpegCount = mimes.filter((m) => m === 'image/jpeg').length;
    expect(jpegCount).toBe(1);
  });

  it('contains fewer MIME entries than extension entries due to deduplication', () => {
    const extCount = ACCEPTED_EXTENSIONS.split(',').length;
    const mimeCount = ACCEPTED_MIMES.split(',').length;
    expect(mimeCount).toBeLessThan(extCount);
  });
});

// ===========================================================================
// detectFormat
// ===========================================================================
describe('detectFormat', () => {
  // --- by extension ---
  it('detects pdf by extension', () => {
    const file = makeFile('document.pdf', 1000, 'application/pdf');
    const result = detectFormat(file);
    expect(result.format).toBe('pdf');
    expect(result.label).toBe('PDF');
    expect(result.mime).toBe('application/pdf');
    expect(result.icon).toBe('📄');
  });

  it('detects docx by extension', () => {
    const result = detectFormat(makeFile('report.docx', 500, ''));
    expect(result.format).toBe('docx');
    expect(result.label).toBe('DOCX');
  });

  it('detects doc by extension', () => {
    const result = detectFormat(makeFile('legacy.doc', 500, ''));
    expect(result.format).toBe('doc');
  });

  it('detects txt by extension', () => {
    const result = detectFormat(makeFile('notes.txt', 200, ''));
    expect(result.format).toBe('txt');
    expect(result.mime).toBe('text/plain');
  });

  it('detects md by extension', () => {
    const result = detectFormat(makeFile('README.md', 300, ''));
    expect(result.format).toBe('md');
    expect(result.label).toBe('Markdown');
  });

  it('detects xlsx by extension', () => {
    const result = detectFormat(makeFile('data.xlsx', 1000, ''));
    expect(result.format).toBe('xlsx');
  });

  it('detects xls by extension', () => {
    const result = detectFormat(makeFile('data.xls', 1000, ''));
    expect(result.format).toBe('xls');
  });

  it('detects csv by extension', () => {
    const result = detectFormat(makeFile('table.csv', 1000, ''));
    expect(result.format).toBe('csv');
    expect(result.mime).toBe('text/csv');
  });

  it('detects tsv as csv format', () => {
    const result = detectFormat(makeFile('table.tsv', 1000, ''));
    expect(result.format).toBe('csv');
    expect(result.label).toBe('TSV');
    expect(result.mime).toBe('text/tab-separated-values');
  });

  it('detects epub by extension', () => {
    const result = detectFormat(makeFile('book.epub', 1000, ''));
    expect(result.format).toBe('epub');
  });

  it('detects html by extension', () => {
    const result = detectFormat(makeFile('page.html', 1000, ''));
    expect(result.format).toBe('html');
    expect(result.mime).toBe('text/html');
  });

  it('detects htm as html format', () => {
    const result = detectFormat(makeFile('page.htm', 1000, ''));
    expect(result.format).toBe('html');
    expect(result.mime).toBe('text/html');
  });

  it('detects json by extension', () => {
    const result = detectFormat(makeFile('data.json', 1000, ''));
    expect(result.format).toBe('json');
  });

  it('detects rtf by extension', () => {
    const result = detectFormat(makeFile('doc.rtf', 1000, ''));
    expect(result.format).toBe('rtf');
  });

  it('detects png as img format', () => {
    const result = detectFormat(makeFile('photo.png', 1000, ''));
    expect(result.format).toBe('img');
    expect(result.label).toBe('PNG');
  });

  it('detects jpg as img format', () => {
    const result = detectFormat(makeFile('photo.jpg', 1000, ''));
    expect(result.format).toBe('img');
    expect(result.label).toBe('JPG');
  });

  it('detects jpeg as img format', () => {
    const result = detectFormat(makeFile('photo.jpeg', 1000, ''));
    expect(result.format).toBe('img');
    expect(result.label).toBe('JPEG');
  });

  it('detects webp as img format', () => {
    const result = detectFormat(makeFile('photo.webp', 1000, ''));
    expect(result.format).toBe('img');
    expect(result.label).toBe('WebP');
  });

  it('detects svg as img format', () => {
    const result = detectFormat(makeFile('icon.svg', 1000, ''));
    expect(result.format).toBe('img');
    expect(result.label).toBe('SVG');
  });

  // --- case insensitivity ---
  it('is case-insensitive for uppercase extension', () => {
    const result = detectFormat(makeFile('DOCUMENT.PDF', 1000, ''));
    expect(result.format).toBe('pdf');
  });

  it('is case-insensitive for mixed-case extension', () => {
    const result = detectFormat(makeFile('Photo.JpG', 1000, ''));
    expect(result.format).toBe('img');
  });

  it('handles uppercase DOCX', () => {
    const result = detectFormat(makeFile('REPORT.DOCX', 1000, ''));
    expect(result.format).toBe('docx');
  });

  // --- filenames with multiple dots ---
  it('uses the last extension segment for files with multiple dots', () => {
    const result = detectFormat(makeFile('my.report.final.pdf', 1000, ''));
    expect(result.format).toBe('pdf');
  });

  it('uses last segment for archive-like names', () => {
    const result = detectFormat(makeFile('data.backup.csv', 1000, ''));
    expect(result.format).toBe('csv');
  });

  // --- by MIME fallback ---
  it('falls back to MIME type when extension is unknown', () => {
    const file = makeFile('mystery.unknown', 500, 'application/pdf');
    const result = detectFormat(file);
    expect(result.format).toBe('pdf');
    expect(result.mime).toBe('application/pdf');
  });

  it('falls back to text/plain MIME for unknown extension', () => {
    const file = makeFile('file.xyz', 500, 'text/plain');
    const result = detectFormat(file);
    expect(result.format).toBe('txt');
  });

  it('falls back to image/png MIME', () => {
    const file = makeFile('file.xyz', 500, 'image/png');
    const result = detectFormat(file);
    expect(result.format).toBe('img');
    expect(result.label).toBe('PNG');
  });

  // --- unknown fallback ---
  it('returns unknown for completely unrecognized file', () => {
    const file = makeFile('file.xyz', 500, 'application/x-custom');
    const result = detectFormat(file);
    expect(result.format).toBe('unknown');
    expect(result.label).toBe('Unknown');
    expect(result.icon).toBe('📁');
    expect(result.mime).toBe('application/x-custom');
  });

  it('returns unknown with octet-stream when type is empty', () => {
    const file = makeFile('file.xyz', 500, '');
    const result = detectFormat(file);
    expect(result.format).toBe('unknown');
    expect(result.mime).toBe('application/octet-stream');
  });

  it('returns unknown icon for unknown format', () => {
    const file = makeFile('nope.abc', 100, 'chemical/x-xyz');
    expect(detectFormat(file).icon).toBe('📁');
  });

  // --- extension takes precedence over MIME ---
  it('prefers extension over MIME when both are present', () => {
    // .pdf extension but text/plain MIME — extension wins
    const file = makeFile('doc.pdf', 500, 'text/plain');
    const result = detectFormat(file);
    expect(result.format).toBe('pdf');
  });

  it('prefers extension even when MIME would map differently', () => {
    const file = makeFile('image.png', 500, 'application/pdf');
    const result = detectFormat(file);
    expect(result.format).toBe('img');
  });
});

// ===========================================================================
// formatFileSize
// ===========================================================================
describe('formatFileSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats single byte', () => {
    expect(formatFileSize(1)).toBe('1 B');
  });

  it('formats bytes under 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats exactly 1023 bytes as bytes', () => {
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  // KB
  it('formats exactly 1024 bytes as 1.0 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats 1536 bytes as 1.5 KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats 2048 bytes as 2.0 KB', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  // MB
  it('formats 1 MB (1048576 bytes)', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('formats 1.5 MB', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('formats 5 MB', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  // GB
  it('formats 1 GB (1073741824 bytes)', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });

  it('formats 2.5 GB', () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  // Boundary values
  it('formats 1023 bytes still as B (just under KB boundary)', () => {
    const result = formatFileSize(1023);
    expect(result).toContain('B');
    expect(result).not.toContain('KB');
  });

  it('formats 1048575 bytes as KB (just under MB boundary)', () => {
    const result = formatFileSize(1048575);
    expect(result).toContain('KB');
  });

  it('formats 1073741823 bytes as MB (just under GB boundary)', () => {
    const result = formatFileSize(1073741823);
    expect(result).toContain('MB');
  });

  it('uses one decimal place for KB and above', () => {
    // 1500 bytes => 1.5 KB should have one decimal
    expect(formatFileSize(1500)).toMatch(/^\d+\.\d KB$/);
  });

  it('uses no decimal places for bytes', () => {
    expect(formatFileSize(999)).toMatch(/^\d+ B$/);
  });
});

// ===========================================================================
// generateDocId / simpleHash (via generateDocId)
// ===========================================================================
describe('generateDocId', () => {
  it('returns a string starting with "doc_"', () => {
    const file = makeFile('hello.pdf', 1234, 'application/pdf', 1000000);
    expect(generateDocId(file)).toMatch(/^doc_/);
  });

  it('is deterministic for same inputs', () => {
    const f1 = makeFile('test.pdf', 100, 'application/pdf', 42);
    const f2 = makeFile('test.pdf', 100, 'application/pdf', 42);
    expect(generateDocId(f1)).toBe(generateDocId(f2));
  });

  it('produces different IDs for different file names', () => {
    const f1 = makeFile('a.pdf', 100, 'application/pdf', 42);
    const f2 = makeFile('b.pdf', 100, 'application/pdf', 42);
    expect(generateDocId(f1)).not.toBe(generateDocId(f2));
  });

  it('produces different IDs for different file sizes', () => {
    const f1 = makeFile('test.pdf', 100, 'application/pdf', 42);
    const f2 = makeFile('test.pdf', 200, 'application/pdf', 42);
    expect(generateDocId(f1)).not.toBe(generateDocId(f2));
  });

  it('produces different IDs for different lastModified values', () => {
    const f1 = makeFile('test.pdf', 100, 'application/pdf', 1000);
    const f2 = makeFile('test.pdf', 100, 'application/pdf', 2000);
    expect(generateDocId(f1)).not.toBe(generateDocId(f2));
  });

  it('hash portion is a hex string', () => {
    const file = makeFile('hello.pdf', 1234, 'application/pdf', 9999);
    const id = generateDocId(file);
    const hash = id.slice(4); // strip "doc_"
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('hash portion is non-empty', () => {
    const file = makeFile('x.txt', 0, 'text/plain', 0);
    const id = generateDocId(file);
    expect(id.length).toBeGreaterThan(4);
  });

  // simpleHash is not exported; we test its properties indirectly via generateDocId
  describe('simpleHash (indirect via generateDocId)', () => {
    it('returns consistent hex for same string input', () => {
      const f1 = makeFile('same.txt', 42, 'text/plain', 123);
      const f2 = makeFile('same.txt', 42, 'text/plain', 123);
      expect(generateDocId(f1)).toBe(generateDocId(f2));
    });

    it('returns different hash for different content', () => {
      const f1 = makeFile('alpha.txt', 10, 'text/plain', 1);
      const f2 = makeFile('beta.txt', 10, 'text/plain', 1);
      expect(generateDocId(f1)).not.toBe(generateDocId(f2));
    });

    it('handles empty name gracefully', () => {
      const file = makeFile('', 0, '', 0);
      const id = generateDocId(file);
      expect(id).toMatch(/^doc_[0-9a-f]+$/);
    });

    it('handles very long file names', () => {
      const longName = 'a'.repeat(500) + '.pdf';
      const file = makeFile(longName, 999, 'application/pdf', 12345);
      const id = generateDocId(file);
      expect(id).toMatch(/^doc_[0-9a-f]+$/);
    });
  });
});

// ===========================================================================
// validateFileSize
// ===========================================================================
describe('validateFileSize', () => {
  it('returns valid true for file under default 50 MB limit', () => {
    const file = makeFile('small.pdf', 1024 * 1024, 'application/pdf'); // 1 MB
    expect(validateFileSize(file)).toEqual({ valid: true });
  });

  it('returns valid true for file well under limit', () => {
    const file = makeFile('tiny.txt', 100, 'text/plain');
    expect(validateFileSize(file)).toEqual({ valid: true });
  });

  it('returns valid true for file exactly at default 50 MB limit', () => {
    const file = makeFile('exact.pdf', 50 * 1024 * 1024, 'application/pdf');
    expect(validateFileSize(file)).toEqual({ valid: true });
  });

  it('returns valid false for file over default 50 MB limit', () => {
    const file = makeFile('huge.pdf', 51 * 1024 * 1024, 'application/pdf');
    const result = validateFileSize(file);
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('includes formatted size in error message when over limit', () => {
    const file = makeFile('huge.pdf', 60 * 1024 * 1024, 'application/pdf');
    const result = validateFileSize(file);
    expect(result.message).toContain('60.0 MB');
  });

  it('includes max allowed in error message when over limit', () => {
    const file = makeFile('huge.pdf', 60 * 1024 * 1024, 'application/pdf');
    const result = validateFileSize(file);
    expect(result.message).toContain('50 MB');
  });

  it('respects custom limit - valid under custom limit', () => {
    const file = makeFile('doc.pdf', 5 * 1024 * 1024, 'application/pdf'); // 5 MB
    expect(validateFileSize(file, 10)).toEqual({ valid: true });
  });

  it('respects custom limit - invalid over custom limit', () => {
    const file = makeFile('doc.pdf', 5 * 1024 * 1024, 'application/pdf'); // 5 MB
    const result = validateFileSize(file, 2); // 2 MB limit
    expect(result.valid).toBe(false);
    expect(result.message).toContain('2 MB');
  });

  it('respects custom limit - valid exactly at custom limit', () => {
    const file = makeFile('doc.pdf', 10 * 1024 * 1024, 'application/pdf');
    expect(validateFileSize(file, 10)).toEqual({ valid: true });
  });

  it('returns valid false for file 1 byte over custom limit', () => {
    const file = makeFile('doc.pdf', 10 * 1024 * 1024 + 1, 'application/pdf');
    expect(validateFileSize(file, 10).valid).toBe(false);
  });

  it('handles 0 byte file as valid', () => {
    const file = makeFile('empty.txt', 0, 'text/plain');
    expect(validateFileSize(file)).toEqual({ valid: true });
  });

  it('handles 0 MB custom limit - any non-zero file is invalid', () => {
    const file = makeFile('doc.pdf', 1, 'application/pdf');
    expect(validateFileSize(file, 0).valid).toBe(false);
  });

  it('handles 0 MB custom limit - 0 byte file is valid', () => {
    const file = makeFile('empty.txt', 0, 'text/plain');
    expect(validateFileSize(file, 0)).toEqual({ valid: true });
  });

  it('error message starts with "File is too large"', () => {
    const file = makeFile('big.pdf', 100 * 1024 * 1024, 'application/pdf');
    const result = validateFileSize(file);
    expect(result.message).toMatch(/^File is too large/);
  });
});

// ===========================================================================
// readFileAsArrayBuffer
// ===========================================================================
describe('readFileAsArrayBuffer', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with ArrayBuffer content on success', async () => {
    const buffer = new ArrayBuffer(8);
    mockFileReader({ result: buffer });
    const file = makeFile('test.pdf', 8, 'application/pdf');
    const result = await readFileAsArrayBuffer(file);
    expect(result).toBe(buffer);
  });

  it('resolves with the reader result value', async () => {
    const fakeData = new Uint8Array([1, 2, 3]).buffer;
    mockFileReader({ result: fakeData });
    const file = makeFile('data.bin', 3, 'application/octet-stream');
    const result = await readFileAsArrayBuffer(file);
    expect(result).toBe(fakeData);
  });

  it('rejects with Error when FileReader fails', async () => {
    mockFileReader({ shouldError: true });
    const file = makeFile('bad.pdf', 100, 'application/pdf');
    await expect(readFileAsArrayBuffer(file)).rejects.toThrow('Failed to read file');
  });

  it('rejects with an Error instance', async () => {
    mockFileReader({ shouldError: true });
    const file = makeFile('bad.pdf', 100, 'application/pdf');
    await expect(readFileAsArrayBuffer(file)).rejects.toBeInstanceOf(Error);
  });

  it('calls readAsArrayBuffer on the FileReader', async () => {
    let calledWith = null;
    class TrackingReader {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      readAsArrayBuffer(file) {
        calledWith = file;
        queueMicrotask(() => {
          this.result = new ArrayBuffer(4);
          if (this.onload) this.onload();
        });
      }
      readAsText() {}
    }
    vi.stubGlobal('FileReader', TrackingReader);
    const file = makeFile('track.pdf', 4, 'application/pdf');
    await readFileAsArrayBuffer(file);
    expect(calledWith).toBe(file);
  });

  it('returns a Promise', () => {
    mockFileReader({ result: new ArrayBuffer(0) });
    const file = makeFile('test.pdf', 0, 'application/pdf');
    const result = readFileAsArrayBuffer(file);
    expect(result).toBeInstanceOf(Promise);
    // suppress unhandled rejection
    result.catch(() => {});
  });
});

// ===========================================================================
// readFileAsText
// ===========================================================================
describe('readFileAsText', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with text content on success', async () => {
    mockFileReader({ result: 'hello world' });
    const file = makeFile('notes.txt', 11, 'text/plain');
    const result = await readFileAsText(file);
    expect(result).toBe('hello world');
  });

  it('resolves with empty string for empty file', async () => {
    mockFileReader({ result: '' });
    const file = makeFile('empty.txt', 0, 'text/plain');
    const result = await readFileAsText(file);
    expect(result).toBe('');
  });

  it('resolves with multiline text', async () => {
    const content = 'line one\nline two\nline three';
    mockFileReader({ result: content });
    const file = makeFile('multi.txt', content.length, 'text/plain');
    const result = await readFileAsText(file);
    expect(result).toBe(content);
  });

  it('rejects with Error when FileReader fails', async () => {
    mockFileReader({ shouldError: true });
    const file = makeFile('bad.txt', 100, 'text/plain');
    await expect(readFileAsText(file)).rejects.toThrow('Failed to read file');
  });

  it('rejects with an Error instance', async () => {
    mockFileReader({ shouldError: true });
    const file = makeFile('bad.txt', 100, 'text/plain');
    await expect(readFileAsText(file)).rejects.toBeInstanceOf(Error);
  });

  it('calls readAsText on the FileReader', async () => {
    let calledWith = null;
    class TrackingReader {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      readAsArrayBuffer() {}
      readAsText(file) {
        calledWith = file;
        queueMicrotask(() => {
          this.result = 'tracked';
          if (this.onload) this.onload();
        });
      }
    }
    vi.stubGlobal('FileReader', TrackingReader);
    const file = makeFile('track.txt', 7, 'text/plain');
    await readFileAsText(file);
    expect(calledWith).toBe(file);
  });

  it('returns a Promise', () => {
    mockFileReader({ result: 'text' });
    const file = makeFile('test.txt', 4, 'text/plain');
    const result = readFileAsText(file);
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  it('preserves unicode content', async () => {
    const content = 'héllo 🌍 unicode';
    mockFileReader({ result: content });
    const file = makeFile('unicode.txt', content.length, 'text/plain');
    const result = await readFileAsText(file);
    expect(result).toBe(content);
  });
});
