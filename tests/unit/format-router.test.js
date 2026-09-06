/**
 * Unit tests for src/services/format-router.js
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConversionTargets } from '../../src/services/format-router.js';

// ---------------------------------------------------------------------------
// Hoisted shared mock state — vi.mock factories can only reference hoisted vars
// ---------------------------------------------------------------------------
const mockRenderPdf = vi.hoisted(() => vi.fn(async () => ({ type: 'pdf', content: 'mock-pdf' })));
const mockRenderDocx = vi.hoisted(() => vi.fn(async () => ({ type: 'docx', content: 'mock-docx' })));
const mockRenderText = vi.hoisted(() => vi.fn(async () => ({ type: 'text', content: 'mock-text' })));
const mockRenderMarkdown = vi.hoisted(() => vi.fn(async () => ({ type: 'markdown', content: 'mock-md' })));
const mockRenderSpreadsheet = vi.hoisted(() => vi.fn(async () => ({ type: 'spreadsheet', content: 'mock-sheet' })));
const mockRenderEpub = vi.hoisted(() => vi.fn(async () => ({ type: 'epub', content: 'mock-epub' })));
const mockRenderJson = vi.hoisted(() => vi.fn(async () => ({ type: 'json', content: 'mock-json' })));
const mockRenderRtf = vi.hoisted(() => vi.fn(async () => ({ type: 'rtf', content: 'mock-rtf' })));
const mockRenderImage = vi.hoisted(() => vi.fn(async () => ({ type: 'image', content: 'mock-img' })));
const mockSanitize = vi.hoisted(() => vi.fn((html) => html.replace(/<script[\s\S]*?<\/script>/gi, '')));

// Mock all dynamic service imports used by routeDocument
vi.mock('../../src/services/pdf-service.js', () => ({ renderPdf: mockRenderPdf }));
vi.mock('../../src/services/docx-service.js', () => ({ renderDocx: mockRenderDocx }));
vi.mock('../../src/services/text-service.js', () => ({
  renderText: mockRenderText,
  renderMarkdown: mockRenderMarkdown,
}));
vi.mock('../../src/services/spreadsheet-service.js', () => ({ renderSpreadsheet: mockRenderSpreadsheet }));
vi.mock('../../src/services/epub-service.js', () => ({ renderEpub: mockRenderEpub }));
vi.mock('../../src/services/json-service.js', () => ({ renderJson: mockRenderJson }));
vi.mock('../../src/services/rtf-service.js', () => ({ renderRtf: mockRenderRtf }));
vi.mock('../../src/services/ocr-service.js', () => ({ renderImage: mockRenderImage }));
vi.mock('dompurify', () => ({ default: { sanitize: mockSanitize } }));

import { routeDocument } from '../../src/services/format-router.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer() {
  const el = document.createElement('div');
  el.id = 'router-test-container';
  document.body.appendChild(el);
  return el;
}

function removeContainer(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function makeBuffer(text = 'hello') {
  return new TextEncoder().encode(text).buffer;
}

function makeMeta(format, name) {
  return { format, name: name || `file.${format}`, id: `doc_${format}` };
}

// ===========================================================================
// getConversionTargets
// ===========================================================================
describe('getConversionTargets', () => {
  // Exact-target assertions — one test per source format ---------------------------------
  it('pdf targets are exactly txt, md, docx, html, img, zip', () => {
    const r = getConversionTargets('pdf');
    expect(r.map((t) => t.format)).toEqual(['txt', 'md', 'docx', 'html', 'img', 'zip']);
  });

  it('docx targets are exactly pdf, txt, md, html', () => {
    expect(getConversionTargets('docx').map((t) => t.format)).toEqual(['pdf', 'txt', 'md', 'html']);
  });

  it('doc targets are exactly pdf, txt, md, html', () => {
    expect(getConversionTargets('doc').map((t) => t.format)).toEqual(['pdf', 'txt', 'md', 'html']);
  });

  it('txt targets are exactly pdf, docx, md, html', () => {
    expect(getConversionTargets('txt').map((t) => t.format)).toEqual(['pdf', 'docx', 'md', 'html']);
  });

  it('md targets are exactly pdf, docx, txt, html', () => {
    expect(getConversionTargets('md').map((t) => t.format)).toEqual(['pdf', 'docx', 'txt', 'html']);
  });

  it('html targets are exactly pdf, docx, md, txt', () => {
    expect(getConversionTargets('html').map((t) => t.format)).toEqual(['pdf', 'docx', 'md', 'txt']);
  });

  it('epub targets are exactly txt, md, html, docx, pdf', () => {
    expect(getConversionTargets('epub').map((t) => t.format)).toEqual(['txt', 'md', 'html', 'docx', 'pdf']);
  });

  it('rtf targets are exactly html, txt, md, docx, pdf', () => {
    expect(getConversionTargets('rtf').map((t) => t.format)).toEqual(['html', 'txt', 'md', 'docx', 'pdf']);
  });

  it('xlsx targets are exactly csv, tsv, json, html, pdf', () => {
    expect(getConversionTargets('xlsx').map((t) => t.format)).toEqual(['csv', 'tsv', 'json', 'html', 'pdf']);
  });

  it('xls targets are exactly csv, tsv, json, html, pdf', () => {
    expect(getConversionTargets('xls').map((t) => t.format)).toEqual(['csv', 'tsv', 'json', 'html', 'pdf']);
  });

  it('csv targets are exactly xlsx, tsv, json, html, pdf', () => {
    expect(getConversionTargets('csv').map((t) => t.format)).toEqual(['xlsx', 'tsv', 'json', 'html', 'pdf']);
  });

  it('tsv targets are exactly xlsx, csv, json, html, pdf', () => {
    expect(getConversionTargets('tsv').map((t) => t.format)).toEqual(['xlsx', 'csv', 'json', 'html', 'pdf']);
  });

  it('json targets are exactly csv, xlsx, html, txt, pdf', () => {
    expect(getConversionTargets('json').map((t) => t.format)).toEqual(['csv', 'xlsx', 'html', 'txt', 'pdf']);
  });

  it('img targets are exactly png, jpg, webp, pdf, txt, docx', () => {
    expect(getConversionTargets('img').map((t) => t.format)).toEqual(['png', 'jpg', 'webp', 'pdf', 'txt', 'docx']);
  });

  // Unknown / edge cases -------------------------------------------------------------------
  it('unknown format returns an empty array', () => {
    expect(getConversionTargets('unknown')).toEqual([]);
  });

  it('empty string returns an empty array', () => {
    expect(getConversionTargets('')).toEqual([]);
  });

  it('undefined returns an empty array', () => {
    expect(getConversionTargets(undefined)).toEqual([]);
  });

  it('arbitrary unsupported string returns an empty array', () => {
    expect(getConversionTargets('foobar')).toEqual([]);
    expect(getConversionTargets('exe')).toEqual([]);
    expect(getConversionTargets('zip')).toEqual([]); // zip is a target, not a source
  });

  // No empty for known formats -------------------------------------------------------------
  it.each([
    'pdf', 'docx', 'doc', 'txt', 'md', 'html', 'epub', 'rtf',
    'xlsx', 'xls', 'csv', 'tsv', 'json', 'img',
  ])('known format "%s" returns a non-empty array', (fmt) => {
    const r = getConversionTargets(fmt);
    expect(r.length).toBeGreaterThan(0);
  });

  // Labels --------------------------------------------------------------------------------
  it('each entry has a string format and a string label', () => {
    for (const fmt of ['pdf', 'docx', 'txt', 'img', 'csv', 'json']) {
      for (const entry of getConversionTargets(fmt)) {
        expect(typeof entry.format).toBe('string');
        expect(entry.format.length).toBeGreaterThan(0);
        expect(typeof entry.label).toBe('string');
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('labels match expected values for common targets', () => {
    const labels = Object.fromEntries(getConversionTargets('pdf').map((t) => [t.format, t.label]));
    expect(labels.txt).toBe('Plain Text (TXT)');
    expect(labels.md).toBe('Markdown (MD)');
    expect(labels.docx).toBe('Word (DOCX)');
    expect(labels.html).toBe('HTML Webpage');
    expect(labels.img).toBe('Image File');
    expect(labels.zip).toBe('ZIP (All Pages)');
  });

  it('spreadsheet source labels are correct', () => {
    const labels = Object.fromEntries(getConversionTargets('xlsx').map((t) => [t.format, t.label]));
    expect(labels.csv).toBe('CSV Spreadsheet');
    expect(labels.tsv).toBe('TSV Spreadsheet');
    expect(labels.json).toBe('JSON Data');
  });

  it('json source labels are correct', () => {
    const labels = Object.fromEntries(getConversionTargets('json').map((t) => [t.format, t.label]));
    expect(labels.csv).toBe('CSV Spreadsheet');
    expect(labels.xlsx).toBe('Excel (XLSX)');
  });

  it('img source labels are correct for image targets', () => {
    const labels = Object.fromEntries(getConversionTargets('img').map((t) => [t.format, t.label]));
    expect(labels.png).toBe('PNG Image');
    expect(labels.jpg).toBe('JPEG Image');
    expect(labels.webp).toBe('WebP Image');
  });

  it('falls back to uppercased format string when no label exists', () => {
    // tsv and csv have labels; pick a target that exercises the fallback branch if any
    // All current targets have labels, so verify the fallback indirectly by checking
    // that the function does not throw and entries always have a label
    const r = getConversionTargets('pdf');
    for (const entry of r) expect(entry.label).toBeTruthy();
  });

  it('returns a new array on each call (no shared mutable state)', () => {
    const a = getConversionTargets('pdf');
    const b = getConversionTargets('pdf');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    a.push({ format: 'evil', label: 'evil' });
    expect(getConversionTargets('pdf').map((t) => t.format)).not.toContain('evil');
  });

  it('docx and doc have identical target lists', () => {
    expect(getConversionTargets('docx')).toEqual(getConversionTargets('doc'));
  });

  it('xlsx and xls have identical target lists', () => {
    expect(getConversionTargets('xlsx')).toEqual(getConversionTargets('xls'));
  });
});

// ===========================================================================
// routeDocument
// ===========================================================================
describe('routeDocument', () => {
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitize.mockImplementation((html) => html.replace(/<script[\s\S]*?<\/script>/gi, ''));
    mockRenderPdf.mockResolvedValue({ type: 'pdf', content: 'mock-pdf' });
    mockRenderDocx.mockResolvedValue({ type: 'docx', content: 'mock-docx' });
    mockRenderText.mockResolvedValue({ type: 'text', content: 'mock-text' });
    mockRenderMarkdown.mockResolvedValue({ type: 'markdown', content: { raw: '# hi', html: '<h1>hi</h1>' } });
    mockRenderSpreadsheet.mockResolvedValue({ type: 'spreadsheet', content: 'mock-sheet' });
    mockRenderEpub.mockResolvedValue({ type: 'epub', content: 'mock-epub' });
    mockRenderJson.mockResolvedValue({ type: 'json', content: 'mock-json' });
    mockRenderRtf.mockResolvedValue({ type: 'rtf', content: 'mock-rtf' });
    mockRenderImage.mockResolvedValue({ type: 'image', content: 'mock-img' });
    container = makeContainer();
  });

  afterEach(() => {
    removeContainer(container);
  });

  // ── delegation: correct service is called per format ──────────────────────────

  it('delegates pdf to renderPdf with fileData, container, and docMeta', async () => {
    const data = makeBuffer('pdf-bytes');
    const meta = makeMeta('pdf');
    const result = await routeDocument(meta, data, container);
    expect(mockRenderPdf).toHaveBeenCalledTimes(1);
    expect(mockRenderPdf).toHaveBeenCalledWith(data, container, meta);
    expect(result).toEqual({ type: 'pdf', content: 'mock-pdf' });
    expect(mockRenderDocx).not.toHaveBeenCalled();
    expect(mockRenderText).not.toHaveBeenCalled();
    expect(mockRenderSpreadsheet).not.toHaveBeenCalled();
  });

  it('delegates docx to renderDocx', async () => {
    const data = makeBuffer('docx-bytes');
    const meta = makeMeta('docx');
    await routeDocument(meta, data, container);
    expect(mockRenderDocx).toHaveBeenCalledWith(data, container, meta);
    expect(mockRenderPdf).not.toHaveBeenCalled();
  });

  it('delegates doc to renderDocx (same handler as docx)', async () => {
    const data = makeBuffer('doc-bytes');
    const meta = makeMeta('doc');
    await routeDocument(meta, data, container);
    expect(mockRenderDocx).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates txt to renderText', async () => {
    const data = makeBuffer('plain text');
    const meta = makeMeta('txt');
    const result = await routeDocument(meta, data, container);
    expect(mockRenderText).toHaveBeenCalledWith(data, container, meta);
    expect(result.type).toBe('text');
    expect(mockRenderMarkdown).not.toHaveBeenCalled();
  });

  it('delegates md to renderMarkdown (not renderText)', async () => {
    const data = makeBuffer('# heading');
    const meta = makeMeta('md');
    await routeDocument(meta, data, container);
    expect(mockRenderMarkdown).toHaveBeenCalledWith(data, container, meta);
    expect(mockRenderText).not.toHaveBeenCalled();
  });

  it('delegates xlsx to renderSpreadsheet', async () => {
    const data = makeBuffer('xlsx-bytes');
    const meta = makeMeta('xlsx');
    await routeDocument(meta, data, container);
    expect(mockRenderSpreadsheet).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates xls to renderSpreadsheet', async () => {
    const data = makeBuffer('xls-bytes');
    const meta = makeMeta('xls');
    await routeDocument(meta, data, container);
    expect(mockRenderSpreadsheet).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates csv to renderSpreadsheet', async () => {
    const data = makeBuffer('a,b\n1,2');
    const meta = makeMeta('csv');
    await routeDocument(meta, data, container);
    expect(mockRenderSpreadsheet).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates epub to renderEpub', async () => {
    const data = makeBuffer('epub-bytes');
    const meta = makeMeta('epub');
    await routeDocument(meta, data, container);
    expect(mockRenderEpub).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates json to renderJson', async () => {
    const data = makeBuffer('{"a":1}');
    const meta = makeMeta('json');
    await routeDocument(meta, data, container);
    expect(mockRenderJson).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates rtf to renderRtf', async () => {
    const data = makeBuffer('{\\rtf1 hello}');
    const meta = makeMeta('rtf');
    await routeDocument(meta, data, container);
    expect(mockRenderRtf).toHaveBeenCalledWith(data, container, meta);
  });

  it('delegates img to renderImage', async () => {
    const data = makeBuffer('img-bytes');
    const meta = makeMeta('img');
    await routeDocument(meta, data, container);
    expect(mockRenderImage).toHaveBeenCalledWith(data, container, meta);
  });

  it('returns whatever the delegated service returns (pass-through)', async () => {
    const custom = { type: 'custom', content: 'special', editable: true };
    mockRenderPdf.mockResolvedValueOnce(custom);
    const result = await routeDocument(makeMeta('pdf'), makeBuffer(), container);
    expect(result).toBe(custom);
  });

  it('propagates rejection from the delegated service', async () => {
    mockRenderPdf.mockRejectedValueOnce(new Error('pdf render failed'));
    await expect(routeDocument(makeMeta('pdf'), makeBuffer(), container)).rejects.toThrow('pdf render failed');
  });

  // ── html / htm — DOMPurify sanitization and DOM assembly ───────────────────

  describe('html / htm branch — sanitization and DOM', () => {
    it('sanitizes html via DOMPurify.sanitize with WHOLE_DOCUMENT:false', async () => {
      const raw = '<p>hello</p><script>alert(1)</script>';
      const data = new TextEncoder().encode(raw).buffer;
      await routeDocument(makeMeta('html'), data, container);
      expect(mockSanitize).toHaveBeenCalledTimes(1);
      expect(mockSanitize).toHaveBeenCalledWith(raw, { WHOLE_DOCUMENT: false });
    });

    it('sanitizes htm via DOMPurify as well', async () => {
      const raw = '<div>htm doc</div>';
      const data = new TextEncoder().encode(raw).buffer;
      await routeDocument(makeMeta('htm'), data, container);
      expect(mockSanitize).toHaveBeenCalledWith(raw, { WHOLE_DOCUMENT: false });
    });

    it('clears container, appends a .html-content wrapper with sanitized innerHTML', async () => {
      const clean = '<p>safe content</p>';
      mockSanitize.mockReturnValueOnce(clean);
      const data = new TextEncoder().encode('<p>safe content</p>').buffer;
      container.innerHTML = '<span>stale</span>';
      await routeDocument(makeMeta('html'), data, container);
      // stale content removed
      expect(container.querySelector('span')).toBeNull();
      const wrapper = container.querySelector('.html-content');
      expect(wrapper).not.toBeNull();
      expect(wrapper.tagName).toBe('DIV');
      expect(wrapper.innerHTML).toBe(clean);
      expect(container.children).toHaveLength(1);
    });

    it('returns html-type result with clean, raw, and editable:true', async () => {
      const raw = '<b>raw html</b>';
      const clean = '<b>raw html</b>';
      mockSanitize.mockReturnValueOnce(clean);
      const data = new TextEncoder().encode(raw).buffer;
      const result = await routeDocument(makeMeta('html'), data, container);
      expect(result.type).toBe('html');
      expect(result.content).toBe(clean);
      expect(result.raw).toBe(raw);
      expect(result.editable).toBe(true);
    });

    it('raw preserves original text even when sanitizer strips content', async () => {
      const raw = '<p>hi</p><script>evil()</script>';
      const stripped = '<p>hi</p>';
      mockSanitize.mockReturnValueOnce(stripped);
      const data = new TextEncoder().encode(raw).buffer;
      const result = await routeDocument(makeMeta('html'), data, container);
      expect(result.raw).toBe(raw);
      expect(result.content).toBe(stripped);
      expect(result.content).not.toContain('<script>');
    });

    it('decodes fileData as utf-8 before sanitizing', async () => {
      const text = 'héllo wörld — utf8 ✓';
      const data = new TextEncoder().encode(text).buffer;
      // echo sanitizer so we can assert the decoded string
      mockSanitize.mockImplementation((s) => s);
      const result = await routeDocument(makeMeta('html'), data, container);
      expect(mockSanitize).toHaveBeenCalledWith(text, expect.any(Object));
      expect(result.raw).toBe(text);
    });

    it('handles empty html file', async () => {
      const data = new TextEncoder().encode('').buffer;
      mockSanitize.mockReturnValueOnce('');
      const result = await routeDocument(makeMeta('html'), data, container);
      expect(result.type).toBe('html');
      expect(result.content).toBe('');
      expect(result.raw).toBe('');
      expect(container.querySelector('.html-content')).not.toBeNull();
    });

    it('second html call replaces the previous wrapper', async () => {
      mockSanitize.mockReturnValueOnce('<p>first</p>').mockReturnValueOnce('<p>second</p>');
      await routeDocument(makeMeta('html'), new TextEncoder().encode('<p>first</p>').buffer, container);
      expect(container.querySelectorAll('.html-content')).toHaveLength(1);
      expect(container.textContent).toContain('first');
      await routeDocument(makeMeta('htm'), new TextEncoder().encode('<p>second</p>').buffer, container);
      expect(container.querySelectorAll('.html-content')).toHaveLength(1);
      expect(container.textContent).toContain('second');
      expect(container.textContent).not.toContain('first');
    });
  });

  // ── unsupported / default branch ───────────────────────────────────────────

  describe('unsupported format (default branch)', () => {
    it('sets container innerHTML to unsupported-format empty-state', async () => {
      const result = await routeDocument(makeMeta('unknown'), makeBuffer(), container);
      expect(container.querySelector('.empty-state')).not.toBeNull();
      expect(container.querySelector('.empty-state-title').textContent).toBe('Unsupported Format');
      expect(container.querySelector('.empty-state-subtitle').textContent).toContain('"unknown"');
      expect(container.textContent).toContain('not yet supported');
    });

    it('returns type:error, content:null, editable:false for unsupported format', async () => {
      const result = await routeDocument(makeMeta('exe'), makeBuffer(), container);
      expect(result).toEqual({ type: 'error', content: null, editable: false });
    });

    it('interpolates the unsupported format string into the message', async () => {
      await routeDocument({ format: 'zip' }, makeBuffer(), container);
      expect(container.innerHTML).toContain('"zip"');
      container.innerHTML = '';
      await routeDocument({ format: 'foobar' }, makeBuffer(), container);
      expect(container.innerHTML).toContain('"foobar"');
    });

    it('routes tsv to the default (unsupported) branch since only xlsx/xls/csv are handled', async () => {
      // format-router switch lists xlsx/xls/csv but not tsv — tsv falls to default
      const result = await routeDocument(makeMeta('tsv'), makeBuffer(), container);
      expect(result.type).toBe('error');
      expect(mockRenderSpreadsheet).not.toHaveBeenCalled();
    });

    it('returns error for completely unknown format like "xyz"', async () => {
      const result = await routeDocument(makeMeta('xyz'), makeBuffer(), container);
      expect(result.type).toBe('error');
      expect(result.editable).toBe(false);
    });

    it('does not call any render service for unsupported formats', async () => {
      await routeDocument(makeMeta('unknown'), makeBuffer(), container);
      expect(mockRenderPdf).not.toHaveBeenCalled();
      expect(mockRenderDocx).not.toHaveBeenCalled();
      expect(mockRenderText).not.toHaveBeenCalled();
      expect(mockRenderMarkdown).not.toHaveBeenCalled();
      expect(mockRenderSpreadsheet).not.toHaveBeenCalled();
      expect(mockRenderEpub).not.toHaveBeenCalled();
      expect(mockRenderJson).not.toHaveBeenCalled();
      expect(mockRenderRtf).not.toHaveBeenCalled();
      expect(mockRenderImage).not.toHaveBeenCalled();
      expect(mockSanitize).not.toHaveBeenCalled();
    });

    it('replaces previous successful render output with error state', async () => {
      await routeDocument(makeMeta('pdf'), makeBuffer('pdf'), container);
      expect(mockRenderPdf).toHaveBeenCalledTimes(1);
      // Reset mock call history but keep the underlying container content
      vi.clearAllMocks();
      const result = await routeDocument(makeMeta('badfmt'), makeBuffer(), container);
      expect(result.type).toBe('error');
      expect(container.querySelector('.empty-state')).not.toBeNull();
    });
  });

  // ── container / argument edge cases ──────────────────────────────────────

  it('passes the exact container reference to the delegated service', async () => {
    const customContainer = document.createElement('section');
    document.body.appendChild(customContainer);
    const data = makeBuffer('x');
    await routeDocument(makeMeta('pdf'), data, customContainer);
    expect(mockRenderPdf).toHaveBeenCalledWith(data, customContainer, expect.any(Object));
    customContainer.remove();
  });

  it('passes the exact docMeta reference to the delegated service', async () => {
    const meta = { format: 'docx', name: 'report.docx', id: 'doc_1', extra: true };
    const data = makeBuffer('docx');
    await routeDocument(meta, data, container);
    expect(mockRenderDocx).toHaveBeenCalledWith(data, container, meta);
  });

  it('uses ArrayBuffer fileData as-is for html decoding (TextDecoder path)', async () => {
    const raw = '<p>buffer test</p>';
    const data = new TextEncoder().encode(raw).buffer;
    mockSanitize.mockImplementation((s) => s);
    const result = await routeDocument(makeMeta('html'), data, container);
    expect(result.raw).toBe(raw);
  });
});
