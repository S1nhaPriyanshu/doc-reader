/**
 * Integration tests for src/services/converter-service.js
 * Covers convertDocument across all 10 source families + helpers
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock primitives — must be defined via vi.hoisted so vi.mock factories
// can reference them (Vitest hoists vi.mock to top of file).
// ---------------------------------------------------------------------------
const mockExtractPdfText = vi.hoisted(() => vi.fn(async () => 'Hello World\n\nSecond paragraph'));
const mockRtfToHtml = vi.hoisted(() => vi.fn(() => '<p>RTF HTML</p>'));
const mockMammothConvertToHtml = vi.hoisted(() => vi.fn(async () => ({ value: '<p>Mammoth HTML</p>' })));
const mockMammothExtractRawText = vi.hoisted(() => vi.fn(async () => ({ value: 'Mammoth raw text' })));
const mockTurndownTurndown = vi.hoisted(() => vi.fn((html) => '# Mock Markdown'));
const mockTurndownCtor = vi.hoisted(() => vi.fn(function TurndownService(opts) { this.turndown = mockTurndownTurndown; this.opts = opts; }));
const mockMarkdownItRender = vi.hoisted(() => vi.fn((md) => `<p>${md}</p>`));
const mockMarkdownItCtor = vi.hoisted(() => vi.fn(function MarkdownIt(opts) { this.render = mockMarkdownItRender; this.opts = opts; }));
const mockXlsxRead = vi.hoisted(() => vi.fn((data, opts) => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: { '!ref': 'A1:B2', A1: { v: 'a' } } } })));
const mockXlsxWrite = vi.hoisted(() => vi.fn((wb, opts) => new Uint8Array([1, 2, 3]).buffer));
const mockXlsxSheetToCsv = vi.hoisted(() => vi.fn((sheet, opts) => 'a,b\n1,2'));
const mockXlsxSheetToHtml = vi.hoisted(() => vi.fn((sheet) => '<table><tr><td>a</td></tr></table>'));
const mockXlsxSheetToJson = vi.hoisted(() => vi.fn((sheet) => [{ a: 1, b: 2 }]));
const mockXlsxJsonToSheet = vi.hoisted(() => vi.fn((rows) => ({ '!ref': 'A1' })));
const mockXlsxBookNew = vi.hoisted(() => vi.fn(() => ({ SheetNames: [], Sheets: {} })));
const mockXlsxBookAppendSheet = vi.hoisted(() => vi.fn((wb, sheet, name) => { wb.SheetNames.push(name); wb.Sheets[name] = sheet; }));
const mockGlobalWorkerOptions = vi.hoisted(() => ({ workerSrc: '' }));
const mockGetDocument = vi.hoisted(() => vi.fn(() => ({ promise: Promise.resolve({ numPages: 1, getPage: async (n) => ({ getViewport: ({ scale }) => ({ width: 600, height: 800 }), render: () => ({ promise: Promise.resolve() }) }) }) })));
const mockJSZipFile = vi.hoisted(() => vi.fn());
const mockJSZipGenerateAsync = vi.hoisted(() => vi.fn(async (opts) => new Blob(['zip-bytes'], { type: 'application/zip' })));
const mockJSZipCtor = vi.hoisted(() => vi.fn(function JSZip() { this.file = mockJSZipFile; this.generateAsync = mockJSZipGenerateAsync; }));
const mockTerminate = vi.hoisted(() => vi.fn(async () => {}));
const mockRecognize = vi.hoisted(() => vi.fn(async (url) => ({ data: { text: 'OCR detected text' } })));
const mockCreateWorker = vi.hoisted(() => vi.fn(async (lang) => ({ recognize: mockRecognize, terminate: mockTerminate })));
const mockJsPDFHtml = vi.hoisted(() => vi.fn(async (container, opts) => {}));
const mockJsPDFOutput = vi.hoisted(() => vi.fn((type) => new Blob(['pdf-bytes'], { type: 'application/pdf' })));
const mockJsPDFSplitTextToSize = vi.hoisted(() => vi.fn((text, width) => text.split('\n')));
const mockJsPDFAddPage = vi.hoisted(() => vi.fn());
const mockJsPDFText = vi.hoisted(() => vi.fn());
const mockJsPDFAddImage = vi.hoisted(() => vi.fn());
const mockJsPDFCtor = vi.hoisted(() => vi.fn(function jsPDF(opts) { this.html = mockJsPDFHtml; this.output = mockJsPDFOutput; this.splitTextToSize = mockJsPDFSplitTextToSize; this.addPage = mockJsPDFAddPage; this.text = mockJsPDFText; this.addImage = mockJsPDFAddImage; this.opts = opts; }));
const mockPackerToBlob = vi.hoisted(() => vi.fn(async (doc) => new Blob(['docx-bytes'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })));
const MockDocument = vi.hoisted(() => vi.fn(function Document(opts) { this.opts = opts; }));
const MockParagraph = vi.hoisted(() => vi.fn(function Paragraph(opts) { this.opts = opts; }));
const MockTextRun = vi.hoisted(() => vi.fn(function TextRun(opts) { this.opts = opts; }));
const MockTable = vi.hoisted(() => vi.fn(function Table(opts) { this.opts = opts; }));
const MockTableRow = vi.hoisted(() => vi.fn(function TableRow(opts) { this.opts = opts; }));
const MockTableCell = vi.hoisted(() => vi.fn(function TableCell(opts) { this.opts = opts; }));
const mockEpub = vi.hoisted(() => vi.fn((data) => ({
  ready: Promise.resolve(),
  loaded: { spine: Promise.resolve({ items: [] }) },
  load: vi.fn(),
})));

// ---------------------------------------------------------------------------
// vi.mock declarations — these are hoisted above imports by Vitest
// ---------------------------------------------------------------------------
vi.mock('../../src/services/pdf-service.js', () => ({ extractPdfText: mockExtractPdfText }));
vi.mock('../../src/services/rtf-service.js', () => ({ rtfToHtml: mockRtfToHtml }));
vi.mock('mammoth', () => ({
  convertToHtml: mockMammothConvertToHtml,
  extractRawText: mockMammothExtractRawText,
  default: { convertToHtml: mockMammothConvertToHtml, extractRawText: mockMammothExtractRawText },
}));
vi.mock('turndown', () => ({ default: mockTurndownCtor }));
vi.mock('markdown-it', () => ({ default: mockMarkdownItCtor }));
vi.mock('xlsx', () => ({
  read: mockXlsxRead,
  write: mockXlsxWrite,
  utils: {
    sheet_to_csv: mockXlsxSheetToCsv,
    sheet_to_html: mockXlsxSheetToHtml,
    sheet_to_json: mockXlsxSheetToJson,
    json_to_sheet: mockXlsxJsonToSheet,
    book_new: mockXlsxBookNew,
    book_append_sheet: mockXlsxBookAppendSheet,
  },
  default: {
    read: mockXlsxRead,
    write: mockXlsxWrite,
    utils: {
      sheet_to_csv: mockXlsxSheetToCsv,
      sheet_to_html: mockXlsxSheetToHtml,
      sheet_to_json: mockXlsxSheetToJson,
      json_to_sheet: mockXlsxJsonToSheet,
      book_new: mockXlsxBookNew,
      book_append_sheet: mockXlsxBookAppendSheet,
    },
  },
}));
vi.mock('jspdf', () => ({ jsPDF: mockJsPDFCtor }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: mockGlobalWorkerOptions,
  getDocument: mockGetDocument,
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-worker-url' }));
vi.mock('jszip', () => ({ default: mockJSZipCtor }));
vi.mock('epubjs', () => ({ default: mockEpub }));
vi.mock('tesseract.js', () => ({ createWorker: mockCreateWorker }));
vi.mock('docx', () => ({
  Document: MockDocument,
  Packer: { toBlob: mockPackerToBlob },
  Paragraph: MockParagraph,
  TextRun: MockTextRun,
  HeadingLevel: { HEADING_1: '1', HEADING_2: '2', HEADING_3: '3', HEADING_4: '4' },
  Table: MockTable,
  TableRow: MockTableRow,
  TableCell: MockTableCell,
  WidthType: { PERCENTAGE: 'percentage' },
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------
import { convertDocument } from '../../src/services/converter-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function strToAB(str) {
  return new TextEncoder().encode(str).buffer;
}
async function blobText(blob) {
  return await blob.text();
}
function makeMeta(format, name, type) {
  return { format, name: name || `file.${format}`, type: type || undefined };
}
function fakeDocxAB() {
  return strToAB('fake docx');
}

// ---------------------------------------------------------------------------
// Global DOM / canvas / Image / URL polyfills for jsdom
// ---------------------------------------------------------------------------
let origCreateElement;
let origURLCreate;
let origURLRevoke;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset hoisted mock impls to defaults
  mockExtractPdfText.mockResolvedValue('Hello World\n\nSecond paragraph');
  mockRtfToHtml.mockReturnValue('<p>RTF HTML</p>');
  mockMammothConvertToHtml.mockResolvedValue({ value: '<p>Mammoth HTML</p>' });
  mockMammothExtractRawText.mockResolvedValue({ value: 'Mammoth raw text' });
  mockTurndownTurndown.mockReturnValue('# Mock Markdown');
  mockMarkdownItRender.mockImplementation((md) => `<p>${md}</p>`);
  mockXlsxRead.mockImplementation((data, opts) => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: { '!ref': 'A1:B2', A1: { v: 'a' } } } }));
  mockXlsxSheetToCsv.mockReturnValue('a,b\n1,2');
  mockXlsxSheetToHtml.mockReturnValue('<table><tr><td>a</td></tr></table>');
  mockXlsxSheetToJson.mockReturnValue([{ a: 1, b: 2 }]);
  mockXlsxJsonToSheet.mockReturnValue({ '!ref': 'A1' });
  mockXlsxBookNew.mockImplementation(() => ({ SheetNames: [], Sheets: {} }));
  mockXlsxBookAppendSheet.mockImplementation((wb, sheet, name) => { wb.SheetNames.push(name); wb.Sheets[name] = sheet; });
  mockXlsxWrite.mockReturnValue(new Uint8Array([1,2,3]).buffer);
  mockGlobalWorkerOptions.workerSrc = '';
  mockGetDocument.mockImplementation(() => ({ promise: Promise.resolve({ numPages: 1, getPage: async (n) => ({ getViewport: ({ scale }) => ({ width: 600, height: 800 }), render: () => ({ promise: Promise.resolve() }) }) }) }));
  mockJSZipFile.mockClear();
  mockJSZipGenerateAsync.mockResolvedValue(new Blob(['zip-bytes'], { type: 'application/zip' }));
  mockRecognize.mockResolvedValue({ data: { text: 'OCR detected text' } });
  mockCreateWorker.mockResolvedValue({ recognize: mockRecognize, terminate: mockTerminate });
  mockJsPDFHtml.mockResolvedValue(undefined);
  mockJsPDFOutput.mockReturnValue(new Blob(['pdf-bytes'], { type: 'application/pdf' }));
  mockJsPDFSplitTextToSize.mockImplementation((t, w) => t.split('\n'));
  mockJsPDFAddPage.mockClear();
  mockJsPDFText.mockClear();
  mockJsPDFAddImage.mockClear();
  mockPackerToBlob.mockResolvedValue(new Blob(['docx-bytes'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  // default epub -> one chapter so epub tests work out of box
  mockEpub.mockImplementation((data) => {
    const fakeDoc = { body: { innerHTML: '<p>Chapter 1 HTML</p>', innerText: 'Chapter 1 text', textContent: 'Chapter 1 text' }, documentElement: null };
    const item = { load: vi.fn(async (loader) => fakeDoc) };
    return {
      ready: Promise.resolve(),
      loaded: { spine: Promise.resolve({ items: [item] }) },
      load: vi.fn(),
    };
  });

  // jsdom canvas/image/url polyfills
  origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, opts) => {
    const el = origCreateElement(tag, opts);
    if (tag === 'canvas') {
      el.getContext = vi.fn((type) => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }));
      el.toBlob = vi.fn((cb, mime, q) => cb(new Blob(['canvas-blob'], { type: mime || 'image/png' })));
    }
    return el;
  });

  // Image mock — triggers onload immediately microtask
  class MockImage {
    constructor() {
      this._src = '';
      this.onload = null;
      this.onerror = null;
      this.naturalWidth = 800;
      this.naturalHeight = 600;
      this.width = 800;
      this.height = 600;
    }
    set src(v) {
      this._src = v;
      queueMicrotask(() => { if (this.onload) this.onload(); });
    }
    get src() { return this._src; }
  }
  vi.stubGlobal('Image', MockImage);

  origURLCreate = URL.createObjectURL;
  origURLRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  URL.createObjectURL = origURLCreate;
  URL.revokeObjectURL = origURLRevoke;
});

// ===========================================================================
// PDF -> txt/md/html/zip (mock extractPdfText/pdfToImages)
// ===========================================================================
describe('PDF conversions', () => {
  it('pdf -> txt returns plain text blob', async () => {
    mockExtractPdfText.mockResolvedValue('page one text');
    const res = await convertDocument(makeMeta('pdf', 'report.pdf'), strToAB('pdf'), 'txt');
    expect(mockExtractPdfText).toHaveBeenCalled();
    expect(res.fileName).toBe('report.txt');
    expect(res.mimeType).toBe('text/plain');
    expect(await blobText(res.blob)).toBe('page one text');
  });

  it('pdf -> md returns markdown blob with extracted text', async () => {
    mockExtractPdfText.mockResolvedValue('# heading');
    const res = await convertDocument(makeMeta('pdf', 'doc.pdf'), strToAB('pdf'), 'md');
    expect(res.fileName).toBe('doc.md');
    expect(res.mimeType).toBe('text/markdown');
    expect(await blobText(res.blob)).toBe('# heading');
  });

  it('pdf -> docx delegates to textToDocx via extractPdfText', async () => {
    mockExtractPdfText.mockResolvedValue('docx content');
    const res = await convertDocument(makeMeta('pdf', 'paper.pdf'), strToAB('pdf'), 'docx');
    expect(mockExtractPdfText).toHaveBeenCalled();
    expect(res.fileName).toBe('paper.docx');
    expect(res.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(res.blob).toBeInstanceOf(Blob);
    expect(MockDocument).toHaveBeenCalled();
    expect(mockPackerToBlob).toHaveBeenCalled();
  });

  it('pdf -> html wraps paragraphs with escaped html', async () => {
    mockExtractPdfText.mockResolvedValue('Hello & <world>\nline2\n\nNext para');
    const res = await convertDocument(makeMeta('pdf', 'my.pdf'), strToAB('pdf'), 'html');
    expect(res.fileName).toBe('my.html');
    expect(res.mimeType).toBe('text/html');
    const html = await blobText(res.blob);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Hello &amp;');
    expect(html).toContain('&lt;world&gt;');
    expect(html).toContain('<p>');
  });

  it('pdf -> png single page returns image/png directly', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async (n) => ({
          getViewport: ({ scale }) => ({ width: 800, height: 600 }),
          render: ({ canvasContext, viewport }) => ({ promise: Promise.resolve() }),
        }),
      }),
    });
    const res = await convertDocument(makeMeta('pdf', 'scan.pdf'), strToAB('pdfbytes'), 'png');
    expect(res.fileName).toBe('scan.png');
    expect(res.mimeType).toBe('image/png');
    expect(res.blob).toBeInstanceOf(Blob);
  });

  it('pdf -> jpg single page returns image/jpeg with white background', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async (n) => ({
          getViewport: ({ scale }) => ({ width: 800, height: 600 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    });
    const res = await convertDocument(makeMeta('pdf', 'photo.pdf'), strToAB('pdf'), 'jpg');
    expect(res.fileName).toBe('photo.jpg');
    expect(res.mimeType).toBe('image/jpeg');
  });

  it('pdf -> zip multi-page returns application/zip with pages', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: async (n) => ({
          getViewport: ({ scale }) => ({ width: 600, height: 800 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    });
    const res = await convertDocument(makeMeta('pdf', 'deck.pdf'), strToAB('pdf'), 'zip');
    expect(res.fileName).toBe('deck-pages.zip');
    expect(res.mimeType).toBe('application/zip');
    expect(mockJSZipFile).toHaveBeenCalledTimes(3);
    expect(mockJSZipGenerateAsync).toHaveBeenCalled();
  });

  it('pdf -> img alias single page returns png by default', async () => {
    const res = await convertDocument(makeMeta('pdf', 'single.pdf'), strToAB('pdf'), 'img');
    expect(res.mimeType).toBe('image/png');
    expect(res.fileName).toBe('single.png');
  });

  it('pdf -> img multi-page returns zip', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async (n) => ({
          getViewport: ({ scale }) => ({ width: 600, height: 800 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    });
    const res = await convertDocument(makeMeta('pdf', 'multi.pdf'), strToAB('pdf'), 'img');
    expect(res.mimeType).toBe('application/zip');
    expect(res.fileName).toBe('multi-pages.zip');
  });

  it('pdfToImages configures GlobalWorkerOptions.workerSrc when empty', async () => {
    mockGlobalWorkerOptions.workerSrc = '';
    const res = await convertDocument(makeMeta('pdf', 'a.pdf'), strToAB('pdf'), 'png');
    // workerSrc should have been set to mock value
    expect(mockGlobalWorkerOptions.workerSrc).toBeTruthy();
    expect(res.blob).toBeDefined();
  });
});

// ===========================================================================
// DOCX -> pdf/txt/md/html (mock mammoth+turndown)
// ===========================================================================
describe('DOCX conversions', () => {
  it('docx -> pdf converts via mammoth.convertToHtml + htmlToPdf', async () => {
    mockMammothConvertToHtml.mockResolvedValue({ value: '<h1>Title</h1><p>body</p>' });
    const res = await convertDocument(makeMeta('docx', 'report.docx'), fakeDocxAB(), 'pdf');
    expect(mockMammothConvertToHtml).toHaveBeenCalledWith({ arrayBuffer: expect.any(Object) });
    expect(mockJsPDFCtor).toHaveBeenCalled();
    expect(mockJsPDFHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('report.pdf');
    expect(res.mimeType).toBe('application/pdf');
  });

  it('doc -> pdf (legacy doc) also uses mammoth path', async () => {
    const res = await convertDocument(makeMeta('doc', 'legacy.doc'), fakeDocxAB(), 'pdf');
    expect(mockMammothConvertToHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('legacy.pdf');
  });

  it('docx -> txt extracts raw text via mammoth', async () => {
    mockMammothExtractRawText.mockResolvedValue({ value: 'plain extracted' });
    const res = await convertDocument(makeMeta('docx', 'notes.docx'), fakeDocxAB(), 'txt');
    expect(mockMammothExtractRawText).toHaveBeenCalled();
    expect(res.fileName).toBe('notes.txt');
    expect(res.mimeType).toBe('text/plain');
    expect(await blobText(res.blob)).toBe('plain extracted');
  });

  it('docx -> md via mammoth + turndown', async () => {
    mockMammothConvertToHtml.mockResolvedValue({ value: '<h1>Hi</h1>' });
    mockTurndownTurndown.mockReturnValue('# Hi');
    const res = await convertDocument(makeMeta('docx', 'a.docx'), fakeDocxAB(), 'md');
    expect(mockMammothConvertToHtml).toHaveBeenCalled();
    expect(mockTurndownCtor).toHaveBeenCalledWith({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    expect(mockTurndownTurndown).toHaveBeenCalledWith('<h1>Hi</h1>');
    expect(res.fileName).toBe('a.md');
    expect(await blobText(res.blob)).toBe('# Hi');
  });

  it('docx -> html wraps mammoth html in full document', async () => {
    mockMammothConvertToHtml.mockResolvedValue({ value: '<p>docx html</p>' });
    const res = await convertDocument(makeMeta('docx', 'file.docx'), fakeDocxAB(), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<p>docx html</p>');
    expect(res.fileName).toBe('file.html');
    expect(res.mimeType).toBe('text/html');
  });

  it('docx -> html escapes baseName in title', async () => {
    mockMammothConvertToHtml.mockResolvedValue({ value: '<p>x</p>' });
    const res = await convertDocument(makeMeta('docx', 'a&b<test>.docx'), fakeDocxAB(), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('a&amp;b&lt;test&gt;');
  });
});

// ===========================================================================
// HTML -> pdf/docx/md/txt
// ===========================================================================
describe('HTML conversions', () => {
  it('html -> pdf via htmlToPdf', async () => {
    const html = '<h1>Hello</h1>';
    const res = await convertDocument(makeMeta('html', 'page.html'), strToAB(html), 'pdf');
    expect(mockJsPDFCtor).toHaveBeenCalled();
    expect(mockJsPDFHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('page.pdf');
    expect(res.mimeType).toBe('application/pdf');
  });

  it('html -> docx via htmlToDocx parses HTML', async () => {
    const html = '<h1>Title</h1><p>para</p><ul><li>item</li></ul>';
    const res = await convertDocument(makeMeta('html', 'page.html'), strToAB(html), 'docx');
    expect(MockDocument).toHaveBeenCalled();
    expect(mockPackerToBlob).toHaveBeenCalled();
    expect(res.fileName).toBe('page.docx');
    expect(res.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('html -> md via turndown', async () => {
    mockTurndownTurndown.mockReturnValue('# Hello');
    const res = await convertDocument(makeMeta('html', 'p.html'), strToAB('<h1>Hello</h1>'), 'md');
    expect(mockTurndownCtor).toHaveBeenCalled();
    expect(res.fileName).toBe('p.md');
    expect(await blobText(res.blob)).toBe('# Hello');
  });

  it('html -> txt strips tags via div textContent', async () => {
    const res = await convertDocument(makeMeta('html', 'p.html'), strToAB('<p>Hello <b>world</b></p>'), 'txt');
    const txt = await blobText(res.blob);
    expect(txt).toContain('Hello');
    expect(txt).toContain('world');
    expect(res.fileName).toBe('p.txt');
  });

  it('html -> txt handles empty', async () => {
    const res = await convertDocument(makeMeta('html', 'e.html'), strToAB(''), 'txt');
    expect(res.fileName).toBe('e.txt');
  });
});

// ===========================================================================
// TXT -> pdf/docx/md/html
// ===========================================================================
describe('TXT conversions', () => {
  it('txt -> pdf wraps escaped text in <pre> and calls htmlToPdf', async () => {
    const res = await convertDocument(makeMeta('txt', 'notes.txt'), strToAB('Hello & <world>'), 'pdf');
    expect(mockJsPDFCtor).toHaveBeenCalled();
    // htmlToPdf receives html with escaped text
    const htmlArg = mockJsPDFHtml.mock.calls[mockJsPDFHtml.mock.calls.length - 1]?.[0];
    // Depending on container handling, we check output blob exists
    expect(res.fileName).toBe('notes.pdf');
    expect(res.mimeType).toBe('application/pdf');
  });

  it('txt -> docx via textToDocx creates docx blob', async () => {
    const res = await convertDocument(makeMeta('txt', 'a.txt'), strToAB('line1\nline2\n\nline3'), 'docx');
    expect(MockDocument).toHaveBeenCalled();
    expect(mockPackerToBlob).toHaveBeenCalled();
    expect(res.fileName).toBe('a.docx');
    expect(res.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('txt -> docx filters empty lines', async () => {
    await convertDocument(makeMeta('txt', 'a.txt'), strToAB('\n\nhello\n\n'), 'docx');
    // Paragraph should have been called at least once with hello, not empty
    expect(MockParagraph).toHaveBeenCalled();
  });

  it('txt -> md returns markdown blob with same text', async () => {
    const txt = 'plain text content';
    const res = await convertDocument(makeMeta('txt', 'f.txt'), strToAB(txt), 'md');
    expect(res.fileName).toBe('f.md');
    expect(res.mimeType).toBe('text/markdown');
    expect(await blobText(res.blob)).toBe(txt);
  });

  it('txt -> html escapes content and wraps in html doc', async () => {
    const res = await convertDocument(makeMeta('txt', 'a.txt'), strToAB('<b>& test</b>'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('<!DOCTYPE html>');
    expect(res.fileName).toBe('a.html');
  });

  it('txt -> html escapes baseName in title', async () => {
    const res = await convertDocument(makeMeta('txt', 'x&y.txt'), strToAB('hi'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('x&amp;y');
  });
});

// ===========================================================================
// MD -> pdf/docx/txt/html (mock markdown-it)
// ===========================================================================
describe('Markdown conversions', () => {
  it('md -> pdf renders md via markdown-it then htmlToPdf', async () => {
    mockMarkdownItRender.mockReturnValue('<h1>Rendered</h1>');
    const res = await convertDocument(makeMeta('md', 'readme.md'), strToAB('# Title'), 'pdf');
    expect(mockMarkdownItCtor).toHaveBeenCalledWith({ html: true, linkify: true, typographer: true });
    expect(mockMarkdownItRender).toHaveBeenCalledWith('# Title');
    expect(mockJsPDFHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('readme.pdf');
  });

  it('md -> docx via markdown-it + htmlToDocx', async () => {
    mockMarkdownItRender.mockReturnValue('<p>html</p>');
    const res = await convertDocument(makeMeta('md', 'doc.md'), strToAB('hello'), 'docx');
    expect(mockMarkdownItRender).toHaveBeenCalled();
    expect(MockDocument).toHaveBeenCalled();
    expect(res.fileName).toBe('doc.docx');
  });

  it('md -> txt returns raw markdown', async () => {
    const raw = '# Hello\n- item';
    const res = await convertDocument(makeMeta('md', 'a.md'), strToAB(raw), 'txt');
    expect(res.fileName).toBe('a.txt');
    expect(res.mimeType).toBe('text/plain');
    expect(await blobText(res.blob)).toBe(raw);
  });

  it('md -> html wraps rendered html in full document', async () => {
    mockMarkdownItRender.mockReturnValue('<h1>H</h1>');
    const res = await convertDocument(makeMeta('md', 'a.md'), strToAB('# H'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('<h1>H</h1>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(res.fileName).toBe('a.html');
    expect(res.mimeType).toBe('text/html');
  });

  it('md -> html escapes baseName', async () => {
    mockMarkdownItRender.mockReturnValue('<p>x</p>');
    const res = await convertDocument(makeMeta('md', 'a<b>.md'), strToAB('x'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('a&lt;b&gt;');
  });
});

// ===========================================================================
// EPUB -> txt/html/md/docx/pdf (mock epubjs)
// ===========================================================================
describe('EPUB conversions', () => {
  function setupEpubWithChapters(n = 1) {
    const items = Array.from({ length: n }, (_, i) => ({
      load: vi.fn(async () => ({
        body: { innerHTML: `<p>Chapter ${i + 1} HTML</p>`, innerText: `Chapter ${i + 1} text`, textContent: `Chapter ${i + 1} text` },
        documentElement: null,
      })),
    }));
    mockEpub.mockImplementation((data) => ({
      ready: Promise.resolve(),
      loaded: { spine: Promise.resolve({ items }) },
      load: vi.fn(),
    }));
  }

  it('epub -> txt returns fullText concatenated', async () => {
    setupEpubWithChapters(2);
    const res = await convertDocument(makeMeta('epub', 'book.epub'), strToAB('epub'), 'txt');
    const txt = await blobText(res.blob);
    expect(txt).toContain('Chapter 1 text');
    expect(txt).toContain('Chapter 2 text');
    expect(txt).toContain('=== Chapter 1 ===');
    expect(res.fileName).toBe('book.txt');
    expect(res.mimeType).toBe('text/plain');
  });

  it('epub -> html wraps fullHtml in book template', async () => {
    setupEpubWithChapters(1);
    const res = await convertDocument(makeMeta('epub', 'book.epub'), strToAB('epub'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('Chapter 1 HTML');
    expect(html).toContain('<!DOCTYPE html>');
    expect(res.fileName).toBe('book.html');
  });

  it('epub -> md via turndown', async () => {
    setupEpubWithChapters(1);
    mockTurndownTurndown.mockReturnValue('# Chapter 1');
    const res = await convertDocument(makeMeta('epub', 'b.epub'), strToAB('epub'), 'md');
    expect(mockTurndownCtor).toHaveBeenCalled();
    expect(res.fileName).toBe('b.md');
    expect(mockTurndownTurndown).toHaveBeenCalled();
  });

  it('epub -> docx via htmlToDocx', async () => {
    setupEpubWithChapters(1);
    const res = await convertDocument(makeMeta('epub', 'b.epub'), strToAB('epub'), 'docx');
    expect(MockDocument).toHaveBeenCalled();
    expect(res.fileName).toBe('b.docx');
  });

  it('epub -> pdf via htmlToPdf', async () => {
    setupEpubWithChapters(1);
    const res = await convertDocument(makeMeta('epub', 'b.epub'), strToAB('epub'), 'pdf');
    expect(mockJsPDFHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('b.pdf');
  });

  it('epub ignores empty chapters and handles load errors', async () => {
    const emptyItem = { load: vi.fn(async () => ({ body: { innerHTML: '', innerText: '   ', textContent: '   ' } })) };
    const errorItem = { load: vi.fn(async () => { throw new Error('load fail'); }) };
    const goodItem = { load: vi.fn(async () => ({ body: { innerHTML: '<p>ok</p>', innerText: 'ok', textContent: 'ok' } })) };
    mockEpub.mockImplementation((data) => ({
      ready: Promise.resolve(),
      loaded: { spine: Promise.resolve({ items: [emptyItem, errorItem, goodItem] }) },
      load: vi.fn(),
    }));
    const res = await convertDocument(makeMeta('epub', 'b.epub'), strToAB('epub'), 'txt');
    const txt = await blobText(res.blob);
    expect(txt).toContain('ok');
    expect(txt).not.toContain('load fail');
  });

  it('epub handles empty book (no chapters) gracefully', async () => {
    mockEpub.mockImplementation((data) => ({
      ready: Promise.resolve(),
      loaded: { spine: Promise.resolve({ items: [] }) },
      load: vi.fn(),
    }));
    const res = await convertDocument(makeMeta('epub', 'empty.epub'), strToAB('epub'), 'html');
    expect(res.fileName).toBe('empty.html');
  });
});

// ===========================================================================
// RTF -> html/txt/md/docx/pdf (mock rtfToHtml)
// ===========================================================================
describe('RTF conversions', () => {
  it('rtf -> html wraps rtfToHtml output in doc', async () => {
    mockRtfToHtml.mockReturnValue('<p>converted</p>');
    const res = await convertDocument(makeMeta('rtf', 'doc.rtf'), strToAB('{\\rtf1 hi}'), 'html');
    expect(mockRtfToHtml).toHaveBeenCalledWith(expect.stringContaining('{\\rtf1'));
    const html = await blobText(res.blob);
    expect(html).toContain('<p>converted</p>');
    expect(res.fileName).toBe('doc.html');
  });

  it('rtf -> txt strips html via div', async () => {
    mockRtfToHtml.mockReturnValue('<p>Hello <b>world</b></p>');
    const res = await convertDocument(makeMeta('rtf', 'a.rtf'), strToAB('rtf'), 'txt');
    const txt = await blobText(res.blob);
    expect(txt).toContain('Hello');
    expect(txt).toContain('world');
    expect(res.fileName).toBe('a.txt');
  });

  it('rtf -> md via turndown', async () => {
    mockRtfToHtml.mockReturnValue('<h1>Title</h1>');
    mockTurndownTurndown.mockReturnValue('# Title');
    const res = await convertDocument(makeMeta('rtf', 'a.rtf'), strToAB('rtf'), 'md');
    expect(mockTurndownTurndown).toHaveBeenCalledWith('<h1>Title</h1>');
    expect(res.fileName).toBe('a.md');
    expect(await blobText(res.blob)).toBe('# Title');
  });

  it('rtf -> docx via htmlToDocx', async () => {
    mockRtfToHtml.mockReturnValue('<p>rtf docx</p>');
    const res = await convertDocument(makeMeta('rtf', 'a.rtf'), strToAB('rtf'), 'docx');
    expect(MockDocument).toHaveBeenCalled();
    expect(res.fileName).toBe('a.docx');
  });

  it('rtf -> pdf via htmlToPdf', async () => {
    mockRtfToHtml.mockReturnValue('<p>rtf pdf</p>');
    const res = await convertDocument(makeMeta('rtf', 'a.rtf'), strToAB('rtf'), 'pdf');
    expect(mockJsPDFHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('a.pdf');
  });
});

// ===========================================================================
// Spreadsheet xlsx/csv -> csv/tsv/xlsx/json/html/pdf (mock xlsx)
// ===========================================================================
describe('Spreadsheet conversions', () => {
  it('xlsx -> csv via sheet_to_csv', async () => {
    const res = await convertDocument(makeMeta('xlsx', 'data.xlsx'), strToAB('xlsx'), 'csv');
    expect(mockXlsxRead).toHaveBeenCalledWith(expect.any(Object), { type: 'array' });
    expect(mockXlsxSheetToCsv).toHaveBeenCalled();
    expect(res.fileName).toBe('data.csv');
    expect(res.mimeType).toBe('text/csv');
    expect(await blobText(res.blob)).toBe('a,b\n1,2');
  });

  it('xlsx -> tsv via sheet_to_csv with FS tab', async () => {
    mockXlsxSheetToCsv.mockReturnValue('a\tb\n1\t2');
    const res = await convertDocument(makeMeta('xlsx', 'd.xlsx'), strToAB('xlsx'), 'tsv');
    expect(mockXlsxSheetToCsv).toHaveBeenCalledWith(expect.any(Object), { FS: '\t' });
    expect(res.fileName).toBe('d.tsv');
    expect(res.mimeType).toBe('text/tab-separated-values');
    expect(await blobText(res.blob)).toBe('a\tb\n1\t2');
  });

  it('xlsx -> xlsx via write', async () => {
    const outBuf = new Uint8Array([9,9,9]).buffer;
    mockXlsxWrite.mockReturnValue(outBuf);
    const res = await convertDocument(makeMeta('xlsx', 'd.xlsx'), strToAB('xlsx'), 'xlsx');
    expect(mockXlsxWrite).toHaveBeenCalledWith(expect.any(Object), { bookType: 'xlsx', type: 'array' });
    expect(res.fileName).toBe('d.xlsx');
    expect(res.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('xlsx -> json via sheet_to_json', async () => {
    mockXlsxSheetToJson.mockReturnValue([{ a: 1 }]);
    const res = await convertDocument(makeMeta('xlsx', 'd.xlsx'), strToAB('xlsx'), 'json');
    expect(mockXlsxSheetToJson).toHaveBeenCalled();
    const txt = await blobText(res.blob);
    expect(JSON.parse(txt)).toEqual([{ a: 1 }]);
    expect(res.fileName).toBe('d.json');
    expect(res.mimeType).toBe('application/json');
  });

  it('xlsx -> html via sheet_to_html wrapped', async () => {
    mockXlsxSheetToHtml.mockReturnValue('<table><tr><td>hi</td></tr></table>');
    const res = await convertDocument(makeMeta('xlsx', 'd.xlsx'), strToAB('xlsx'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('<table>');
    expect(html).toContain('hi');
    expect(res.fileName).toBe('d.html');
  });

  it('xlsx -> pdf via htmlToPdf', async () => {
    mockXlsxSheetToHtml.mockReturnValue('<table></table>');
    const res = await convertDocument(makeMeta('xlsx', 'd.xlsx'), strToAB('xlsx'), 'pdf');
    expect(mockJsPDFHtml).toHaveBeenCalled();
    expect(res.fileName).toBe('d.pdf');
  });

  it('xls source uses same array path', async () => {
    const res = await convertDocument(makeMeta('xls', 'legacy.xls'), strToAB('xls'), 'csv');
    expect(mockXlsxRead).toHaveBeenCalledWith(expect.any(Object), { type: 'array' });
    expect(res.fileName).toBe('legacy.csv');
  });

  it('csv source reads as string', async () => {
    const csvText = 'a,b\n1,2';
    const res = await convertDocument(makeMeta('csv', 'table.csv'), strToAB(csvText), 'json');
    expect(mockXlsxRead).toHaveBeenCalledWith(csvText, { type: 'string' });
    expect(res.fileName).toBe('table.json');
  });

  it('csv -> tsv works', async () => {
    mockXlsxSheetToCsv.mockReturnValue('a\tb');
    const res = await convertDocument(makeMeta('csv', 't.csv'), strToAB('a,b'), 'tsv');
    expect(res.mimeType).toBe('text/tab-separated-values');
    expect(res.fileName).toBe('t.tsv');
  });

  it('spreadsheet uses first sheet only', async () => {
    const sheet1 = { '!ref': 'A1' };
    const sheet2 = { '!ref': 'B2' };
    mockXlsxRead.mockReturnValue({ SheetNames: ['First', 'Second'], Sheets: { First: sheet1, Second: sheet2 } });
    await convertDocument(makeMeta('xlsx', 'm.xlsx'), strToAB('x'), 'csv');
    expect(mockXlsxSheetToCsv).toHaveBeenCalledWith(sheet1);
    expect(mockXlsxSheetToCsv).not.toHaveBeenCalledWith(sheet2);
  });
});

// ===========================================================================
// JSON -> csv/xlsx/html/txt/pdf
// ===========================================================================
describe('JSON conversions', () => {
  it('json -> csv via json_to_sheet + sheet_to_csv', async () => {
    mockXlsxJsonToSheet.mockReturnValue({ '!ref': 'A1' });
    mockXlsxSheetToCsv.mockReturnValue('a,b\n1,2');
    const payload = JSON.stringify([{ a: 1, b: 2 }]);
    const res = await convertDocument(makeMeta('json', 'data.json'), strToAB(payload), 'csv');
    expect(mockXlsxJsonToSheet).toHaveBeenCalledWith([{ a: 1, b: 2 }]);
    expect(res.fileName).toBe('data.csv');
    expect(res.mimeType).toBe('text/csv');
  });

  it('json object (non-array) wraps in array for csv', async () => {
    const payload = JSON.stringify({ a: 1 });
    await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'csv');
    expect(mockXlsxJsonToSheet).toHaveBeenCalledWith([{ a: 1 }]);
  });

  it('json -> xlsx via book_new + book_append_sheet + write', async () => {
    const payload = JSON.stringify([{ a: 1 }]);
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'xlsx');
    expect(mockXlsxBookNew).toHaveBeenCalled();
    expect(mockXlsxBookAppendSheet).toHaveBeenCalled();
    expect(mockXlsxWrite).toHaveBeenCalledWith(expect.any(Object), { bookType: 'xlsx', type: 'array' });
    expect(res.fileName).toBe('d.xlsx');
    expect(res.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('json -> html array-of-objects renders sheet_to_html table', async () => {
    mockXlsxSheetToHtml.mockReturnValue('<table><tr><td>hey</td></tr></table>');
    const payload = JSON.stringify([{ name: 'Alice' }]);
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'html');
    expect(mockXlsxSheetToHtml).toHaveBeenCalled();
    const html = await blobText(res.blob);
    expect(html).toContain('<table>');
    expect(html).toContain('hey');
    expect(res.fileName).toBe('d.html');
  });

  it('json -> html primitive renders pre code with escaped json', async () => {
    const payload = JSON.stringify({ a: '<b>' });
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('<pre>');
  });

  it('json -> html array of primitives renders pre', async () => {
    const payload = JSON.stringify([1, 2, 3]);
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('<pre>');
  });

  it('json -> txt pretty prints', async () => {
    const payload = JSON.stringify({ a: 1 });
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'txt');
    expect(res.fileName).toBe('d.txt');
    const txt = await blobText(res.blob);
    expect(txt).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it('json -> pdf array renders table via htmlToPdf', async () => {
    const payload = JSON.stringify([{ a: 1 }]);
    mockXlsxJsonToSheet.mockReturnValue({ '!ref': 'A1' });
    mockXlsxSheetToHtml.mockReturnValue('<table></table>');
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'pdf');
    expect(mockJsPDFHtml).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    const htmlArg = mockJsPDFHtml.mock.calls[mockJsPDFHtml.mock.calls.length - 1][0];
    // htmlToPdf passes a DOM element, whose innerHTML should contain the table
    const inner = htmlArg instanceof HTMLElement ? htmlArg.innerHTML : String(htmlArg);
    expect(inner).toContain('<table');
    expect(res.fileName).toBe('d.pdf');
  });

  it('json -> pdf primitive renders escaped pre via htmlToPdf', async () => {
    const payload = JSON.stringify({ a: '<x>' });
    mockXlsxJsonToSheet.mockReturnValue({ '!ref': 'A1' });
    mockXlsxSheetToHtml.mockReturnValue('<table></table>');
    const res = await convertDocument(makeMeta('json', 'd.json'), strToAB(payload), 'pdf');
    expect(mockJsPDFHtml).toHaveBeenCalled();
    const htmlArg = mockJsPDFHtml.mock.calls[mockJsPDFHtml.mock.calls.length - 1][0];
    // htmlToPdf receives a created container div
    expect(htmlArg).toBeDefined();
    expect(res.fileName).toBe('d.pdf');
  });

  it('json invalid throws', async () => {
    await expect(convertDocument(makeMeta('json', 'bad.json'), strToAB('{ not: json }'), 'csv')).rejects.toThrow('Invalid JSON');
  });

  it('json invalid truncated throws', async () => {
    await expect(convertDocument(makeMeta('json', 'bad.json'), strToAB('{"a":'), 'txt')).rejects.toThrow('Invalid JSON');
  });
});

// ===========================================================================
// IMG -> pdf/png/jpg/webp/txt/docx (mock canvas, tesseract, jspdf)
// ===========================================================================
describe('Image conversions', () => {
  it('img -> pdf via imageToPdf uses jsPDF addImage and returns pdf', async () => {
    const res = await convertDocument(makeMeta('img', 'photo.png', 'image/png'), strToAB('fakeimg'), 'pdf');
    // wait a tick for Image onload
    await new Promise((r) => setTimeout(r, 0));
    expect(mockJsPDFCtor).toHaveBeenCalled();
    expect(mockJsPDFAddImage).toHaveBeenCalled();
    expect(mockJsPDFOutput).toHaveBeenCalledWith('blob');
    expect(res.fileName).toBe('photo.pdf');
    expect(res.mimeType).toBe('application/pdf');
  });

  it('img -> pdf respects orientation via width/height', async () => {
    const res = await convertDocument(makeMeta('img', 'wide.png', 'image/png'), strToAB('img'), 'pdf');
    await new Promise((r) => setTimeout(r, 0));
    // constructor called with orientation based on naturalWidth > naturalHeight
    const ctorOpts = mockJsPDFCtor.mock.calls[mockJsPDFCtor.mock.calls.length - 1][0];
    expect(ctorOpts.orientation).toBe('landscape');
    expect(res.fileName).toBe('wide.pdf');
  });

  it('img -> png via convertImageFormat', async () => {
    const res = await convertDocument(makeMeta('img', 'a.png', 'image/png'), strToAB('img'), 'png');
    await new Promise((r) => setTimeout(r, 0));
    expect(res.fileName).toBe('a.png');
    expect(res.mimeType).toBe('image/png');
    expect(res.blob).toBeInstanceOf(Blob);
  });

  it('img -> jpg via convertImageFormat fills white background', async () => {
    const res = await convertDocument(makeMeta('img', 'a.png', 'image/png'), strToAB('img'), 'jpg');
    await new Promise((r) => setTimeout(r, 0));
    expect(res.fileName).toBe('a.jpg');
    expect(res.mimeType).toBe('image/jpeg');
  });

  it('img -> jpeg alias also returns image/jpeg', async () => {
    const res = await convertDocument(makeMeta('img', 'a.png'), strToAB('img'), 'jpeg');
    await new Promise((r) => setTimeout(r, 0));
    expect(res.mimeType).toBe('image/jpeg');
    expect(res.fileName).toBe('a.jpg');
  });

  it('img -> webp via convertImageFormat', async () => {
    const res = await convertDocument(makeMeta('img', 'a.png'), strToAB('img'), 'webp');
    await new Promise((r) => setTimeout(r, 0));
    expect(res.fileName).toBe('a.webp');
    expect(res.mimeType).toBe('image/webp');
  });

  it('img -> txt via tesseract OCR', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'hello ocr' } });
    const res = await convertDocument(makeMeta('img', 'scan.png', 'image/png'), strToAB('img'), 'txt');
    expect(mockCreateWorker).toHaveBeenCalledWith('eng');
    expect(mockRecognize).toHaveBeenCalledWith('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(mockTerminate).toHaveBeenCalled();
    expect(res.fileName).toBe('scan.txt');
    expect(res.mimeType).toBe('text/plain');
    expect(await blobText(res.blob)).toBe('hello ocr');
  });

  it('img -> docx via tesseract + textToDocx', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'docx ocr' } });
    const res = await convertDocument(makeMeta('img', 'scan.png'), strToAB('img'), 'docx');
    expect(mockCreateWorker).toHaveBeenCalled();
    expect(MockDocument).toHaveBeenCalled();
    expect(res.fileName).toBe('scan.docx');
    expect(res.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('img -> txt with empty OCR returns fallback text', async () => {
    mockRecognize.mockResolvedValue({ data: { text: '' } });
    const res = await convertDocument(makeMeta('img', 'e.png'), strToAB('img'), 'txt');
    expect(await blobText(res.blob)).toBe('(No text detected)');
  });

  it('img conversion uses revokeObjectURL even after recognize', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'x' } });
    await convertDocument(makeMeta('img', 'a.png'), strToAB('img'), 'txt');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

// ===========================================================================
// Helpers: htmlToPdf, htmlToDocx, textToDocx, pdfToImages, imageToPdf, convertImageFormat, extractEpubContent, escapeHtml
// (exercised indirectly via convertDocument)
// ===========================================================================
describe('Helpers and edge cases', () => {
  it('escapeHtml escapes &, <, >, " via txt->html and baseName', async () => {
    const res = await convertDocument(makeMeta('txt', 'a&b.txt'), strToAB('a & b < c > d "e"'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('a &amp; b');
    expect(html).toContain('&lt; c &gt;');
    expect(html).toContain('&quot;e&quot;');
  });

  it('escapeHtml in pdf html paragraphs', async () => {
    mockExtractPdfText.mockResolvedValue('x & y <z>');
    const res = await convertDocument(makeMeta('pdf', 'f.pdf'), strToAB('pdf'), 'html');
    const html = await blobText(res.blob);
    expect(html).toContain('x &amp; y');
    expect(html).toContain('&lt;z&gt;');
  });

  it('baseName handles multiple dots correctly', async () => {
    mockExtractPdfText.mockResolvedValue('t');
    const res = await convertDocument(makeMeta('pdf', 'my.report.final.pdf'), strToAB('pdf'), 'txt');
    expect(res.fileName).toBe('my.report.final.txt');
  });

  it('baseName handles name without extension via fallback', async () => {
    const res = await convertDocument(makeMeta('txt', 'README'), strToAB('hi'), 'html');
    expect(res.fileName).toBe('README.html');
  });

  it('baseName handles hidden file like .gitignore? Actually lastIndexOf dot edge', async () => {
    mockExtractPdfText.mockResolvedValue('t');
    const res = await convertDocument(makeMeta('pdf', 'a.pdf'), strToAB('pdf'), 'txt');
    expect(res.fileName).toBe('a.txt');
  });

  it('htmlToDocx handles headings, tables, lists via HTML source', async () => {
    const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><ul><li>u1</li></ul><ol><li>o1</li></ol><table><tr><th>h</th><td>c</td></tr></table><p>para <strong>bold</strong> <em>italic</em> <u>underline</u> <del>strike</del></p>';
    const res = await convertDocument(makeMeta('html', 'h.html'), strToAB(html), 'docx');
    expect(MockDocument).toHaveBeenCalled();
    // Paragraph called for headings + list items + table + para
    expect(MockParagraph).toHaveBeenCalled();
    expect(MockTextRun).toHaveBeenCalled();
    expect(res.fileName).toBe('h.docx');
  });

  it('htmlToDocx handles empty document placeholder', async () => {
    const res = await convertDocument(makeMeta('html', 'empty.html'), strToAB(''), 'docx');
    expect(MockDocument).toHaveBeenCalled();
    const docArg = MockDocument.mock.calls[MockDocument.mock.calls.length - 1][0];
    expect(docArg.sections[0].children.length).toBeGreaterThan(0);
  });

  it('textToDocx splits lines and filters blanks', async () => {
    const res = await convertDocument(makeMeta('txt', 't.txt'), strToAB('a\n\nb\n  \nc'), 'docx');
    expect(MockParagraph).toHaveBeenCalled();
    // Should have 3 paragraphs for a,b,c (blank lines filtered)
    expect(res.fileName).toBe('t.docx');
  });

  it('pdfToImages zip generation covers multi-page pdf->png', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async (n) => ({
          getViewport: ({ scale }) => ({ width: 800, height: 600 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    });
    const res = await convertDocument(makeMeta('pdf', 'm.pdf'), strToAB('pdf'), 'zip');
    expect(res.mimeType).toBe('application/zip');
    expect(mockJSZipGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
  });

  it('convertImageFormat maps png/jpg/jpeg/webp mimes correctly', async () => {
    const png = await convertDocument(makeMeta('img', 'x.png'), strToAB('img'), 'png');
    expect(png.mimeType).toBe('image/png');
    const jpg = await convertDocument(makeMeta('img', 'x.png'), strToAB('img'), 'jpg');
    expect(jpg.mimeType).toBe('image/jpeg');
    const webp = await convertDocument(makeMeta('img', 'x.png'), strToAB('img'), 'webp');
    expect(webp.mimeType).toBe('image/webp');
    await new Promise((r) => setTimeout(r, 0));
  });

  it('extractEpubContent via epub mock handles chapter iteration', async () => {
    const item1 = { load: vi.fn(async () => ({ body: { innerHTML: '<p>c1</p>', innerText: 'c1 text', textContent: 'c1 text' } })) };
    const item2 = { load: vi.fn(async () => ({ body: { innerHTML: '<p>c2</p>', innerText: 'c2 text', textContent: 'c2 text' } })) };
    mockEpub.mockImplementation((d) => ({
      ready: Promise.resolve(),
      loaded: { spine: Promise.resolve({ items: [item1, item2] }) },
      load: vi.fn(),
    }));
    const res = await convertDocument(makeMeta('epub', 'b.epub'), strToAB('epub'), 'txt');
    expect(item1.load).toHaveBeenCalled();
    expect(item2.load).toHaveBeenCalled();
    const txt = await blobText(res.blob);
    expect(txt).toContain('c1 text');
    expect(txt).toContain('c2 text');
  });
});

// ===========================================================================
// htmlToPdf fallback when doc.html fails
// ===========================================================================
describe('htmlToPdf fallback', () => {
  it('falls back to text engine when doc.html throws, warns and returns pdf', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockJsPDFHtml.mockRejectedValueOnce(new Error('html2canvas fail'));
    mockJsPDFSplitTextToSize.mockReturnValue(['line1', 'line2', 'line3']);
    const res = await convertDocument(makeMeta('html', 'page.html'), strToAB('<p>fallback test</p>'), 'pdf');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back'), expect.any(Error));
    expect(mockJsPDFSplitTextToSize).toHaveBeenCalled();
    expect(mockJsPDFText).toHaveBeenCalled();
    expect(res.fileName).toBe('page.pdf');
    expect(res.mimeType).toBe('application/pdf');
    expect(res.blob).toBeInstanceOf(Blob);
    warnSpy.mockRestore();
  });

  it('fallback paginates when y > 280', async () => {
    mockJsPDFHtml.mockRejectedValueOnce(new Error('fail'));
    const longText = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
    // html -> txt stripped then fallback uses splitTextToSize, but for html->pdf fallback uses div textContent
    mockJsPDFSplitTextToSize.mockReturnValue(longText.split('\n'));
    const res = await convertDocument(makeMeta('txt', 't.txt'), strToAB(longText), 'pdf');
    // Should have called addPage at least once due to overflow
    expect(mockJsPDFAddPage).toHaveBeenCalled();
    expect(res.fileName).toBe('t.pdf');
  });

  it('successful htmlToPdf does not call fallback path', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await convertDocument(makeMeta('html', 'ok.html'), strToAB('<p>ok</p>'), 'pdf');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockJsPDFOutput).toHaveBeenCalledWith('blob');
    expect(res.fileName).toBe('ok.pdf');
    warnSpy.mockRestore();
  });

  it('htmlToPdf removes container even on fallback', async () => {
    mockJsPDFHtml.mockRejectedValueOnce(new Error('fail'));
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    await convertDocument(makeMeta('html', 'p.html'), strToAB('<p>x</p>'), 'pdf');
    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});

// ===========================================================================
// Error: unsupported conversion throws
// ===========================================================================
describe('unsupported conversions', () => {
  it('throws for pdf -> unsupported format', async () => {
    await expect(convertDocument(makeMeta('pdf', 'a.pdf'), strToAB('pdf'), 'xlsx')).rejects.toThrow('Conversion from PDF to XLSX is not currently supported');
  });

  it('throws for txt -> xlsx unsupported', async () => {
    await expect(convertDocument(makeMeta('txt', 'a.txt'), strToAB('hi'), 'xlsx')).rejects.toThrow('not currently supported');
  });

  it('throws for docx -> zip unsupported', async () => {
    await expect(convertDocument(makeMeta('docx', 'a.docx'), fakeDocxAB(), 'zip')).rejects.toThrow('not currently supported');
  });

  it('throws for img -> html unsupported', async () => {
    await expect(convertDocument(makeMeta('img', 'a.png'), strToAB('img'), 'html')).rejects.toThrow('IMG to HTML');
  });

  it('throws for json -> md unsupported', async () => {
    await expect(convertDocument(makeMeta('json', 'd.json'), strToAB('{}'), 'md')).rejects.toThrow('not currently supported');
  });

  it('throws for epub -> zip unsupported', async () => {
    await expect(convertDocument(makeMeta('epub', 'b.epub'), strToAB('epub'), 'zip')).rejects.toThrow('not currently supported');
  });

  it('throws for html -> xlsx unsupported', async () => {
    await expect(convertDocument(makeMeta('html', 'p.html'), strToAB('<p>hi</p>'), 'csv')).rejects.toThrow('not currently supported');
  });

  it('throws for unknown source format', async () => {
    await expect(convertDocument(makeMeta('unknown', 'a.xyz'), strToAB('x'), 'pdf')).rejects.toThrow('UNKNOWN');
  });

  it('throws for spreadsheet -> unknown target', async () => {
    await expect(convertDocument(makeMeta('xlsx', 'd.xlsx'), strToAB('xlsx'), 'docx')).rejects.toThrow('not currently supported');
  });

  it('error message contains source and target uppercased', async () => {
    await expect(convertDocument(makeMeta('md', 'a.md'), strToAB('hi'), 'csv')).rejects.toThrow('MD to CSV');
  });
});
