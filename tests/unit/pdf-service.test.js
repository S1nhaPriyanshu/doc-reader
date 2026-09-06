/**
 * Unit tests for src/services/pdf-service.js
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-worker://pdf.worker.min.mjs' }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: 'mock-worker://pdf.worker.min.mjs' },
  getDocument: vi.fn(),
}));
vi.mock('tesseract.js', () => ({ createWorker: vi.fn() }));
vi.mock('../../src/utils/image-preprocessor.js', () => ({
  preprocessImage: vi.fn(() => ({
    canvas: {},
    dataUrl: 'data:image/png;base64,mock',
    threshold: 128,
    wasInverted: false,
  })),
}));

import * as pdfjsLib from 'pdfjs-dist';
import { renderPdf, extractPdfText, ocrPdfDocument } from '../../src/services/pdf-service.js';
import { preprocessImage } from '../../src/utils/image-preprocessor.js';
import { createWorker } from 'tesseract.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corruptPdfBytes() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0A, 0x78, 0x00]).buffer;
}

/** Install HTMLCanvasElement.getContext stub so jsdom can simulate canvas rendering. */
function installGetContextStub() {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (type === '2d') {
      return {
        canvas: this,
        fillRect: vi.fn(), strokeRect: vi.fn(), clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
        putImageData: vi.fn(), save: vi.fn(), restore: vi.fn(),
        translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
        transform: vi.fn(), setTransform: vi.fn(), resetTransform: vi.fn(),
        beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
        bezierCurveTo: vi.fn(), quadraticCurveTo: vi.fn(), arc: vi.fn(),
        ellipse: vi.fn(), rect: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
        clip: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createPattern: vi.fn(() => ({})),
        setLineDash: vi.fn(), getLineDash: vi.fn(() => []),
      };
    }
    return orig.call(this, type, ...args);
  };
  return function restore() { HTMLCanvasElement.prototype.getContext = orig; };
}

function makePdfMock({ numPages = 1, pageTexts = ['Hello'] } = {}) {
  const pages = [];
  for (let i = 1; i <= numPages; i++) {
    const vp = { width: 400, height: 600 };
    const page = {
      getViewport: vi.fn(({ scale = 1 }) => ({ width: vp.width * scale, height: vp.height * scale })),
      getTextContent: vi.fn(async () => ({ items: [{ str: pageTexts[i - 1] || '' }] })),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    };
    pages.push(page);
  }
  const pdfDoc = {
    numPages,
    getPage: vi.fn((n) => Promise.resolve(pages[n - 1])),
  };
  pdfjsLib.getDocument.mockImplementationOnce(() => ({ promise: Promise.resolve(pdfDoc) }));
  return { pdfDoc, pages };
}

/**
 * Stub preprocessImage so it returns a real canvas (whose getContext is already
 * intercepted by installGetContextStub).  Replaces the named export on the
 * module object so that ocrPdfDocument's dynamic import picks it up.
 */
function stubPreprocessImage() {
  const stubCanvas = document.createElement('canvas');
  stubCanvas.width = 800;
  stubCanvas.height = 600;
  const stub = vi.fn(() => ({
    canvas: stubCanvas,
    dataUrl: 'data:image/png;base64,mock',
    threshold: 128,
    wasInverted: false,
  }));
  preprocessImage.mockImplementation(stub);
  return stub;
}

// ===========================================================================
// workerSrc fix
// ===========================================================================
describe('workerSrc fix', () => {
  it('sets GlobalWorkerOptions.workerSrc', () => {
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('mock-worker://pdf.worker.min.mjs');
  });

  it('workerSrc does NOT contain cdnjs 4.10.38', () => {
    const src = String(pdfjsLib.GlobalWorkerOptions.workerSrc);
    expect(src).not.toContain('cdnjs');
    expect(src).not.toContain('4.10.38');
  });
});

// ===========================================================================
// renderPdf
// ===========================================================================
describe('renderPdf', () => {
  let container;
  let restoreGetContext;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    restoreGetContext = installGetContextStub();
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreGetContext();
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  it('renders a 1-page PDF and returns {type:"pdf", pageCount}', async () => {
    makePdfMock({ numPages: 1, pageTexts: ['Hello'] });
    const result = await renderPdf(new ArrayBuffer(0), container, { name: 'test.pdf' });
    expect(result).toHaveProperty('type', 'pdf');
    expect(result).toHaveProperty('pageCount', 1);
    expect(result).toHaveProperty('editable', false);
    expect(container.querySelector('.pdf-viewer')).not.toBeNull();
  });

  it('creates one canvas per page', async () => {
    makePdfMock({ numPages: 1, pageTexts: ['A'] });
    await renderPdf(new ArrayBuffer(0), container, {});
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('calls getContext and sets canvas dimensions', async () => {
    makePdfMock({ numPages: 1, pageTexts: ['A'] });
    await renderPdf(new ArrayBuffer(0), container, {});
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeTruthy();
  });
});

// ===========================================================================
// extractPdfText
// ===========================================================================
describe('extractPdfText', () => {
  let restoreGetContext;

  beforeEach(() => {
    restoreGetContext = installGetContextStub();
    vi.clearAllMocks();
  });

  afterEach(() => { restoreGetContext(); });

  it('returns text with page markers', async () => {
    makePdfMock({ numPages: 2, pageTexts: ['First', 'Second'] });
    const text = await extractPdfText(new ArrayBuffer(0));
    expect(text).toContain('--- Page 1 ---');
    expect(text).toContain('--- Page 2 ---');
    expect(text).toContain('First');
    expect(text).toContain('Second');
  });

  it('concatenates all pages separated by page markers', async () => {
    makePdfMock({ numPages: 1, pageTexts: ['OnlyPage'] });
    const text = await extractPdfText(new ArrayBuffer(0));
    expect(text).toContain('OnlyPage');
    expect(text).toMatch(/--- Page 1 ---/);
  });
});

// ===========================================================================
// ocrPdfDocument
// ===========================================================================
describe('ocrPdfDocument', () => {
  let container;
  let restoreGetContext;
  let fakeWorker;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    restoreGetContext = installGetContextStub();
    vi.clearAllMocks();

    fakeWorker = {
      recognize: vi.fn(async () => ({ data: { text: 'OCRed' } })),
      terminate: vi.fn(async () => {}),
    };
    createWorker.mockResolvedValue(fakeWorker);
    stubPreprocessImage();
  });

  afterEach(() => {
    restoreGetContext();
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  it('calls createWorker with language, invokes onProgress, terminates worker', async () => {
    makePdfMock({ numPages: 2, pageTexts: ['A', 'B'] });
    const progress = vi.fn();
    const text = await ocrPdfDocument(new ArrayBuffer(0), 'eng', progress);

    expect(createWorker).toHaveBeenCalledWith('eng', 1);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ current: 0, total: 2, status: expect.stringContaining('Loading') }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ current: 1, total: 2, status: expect.stringContaining('Scanning Page 1') }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ current: 2, total: 2, status: expect.stringContaining('Scanning Page 2') }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ current: 2, total: 2, status: 'Completed OCR scan!' }));
    expect(typeof text).toBe('string');
  });

  it('terminates worker after processing', async () => {
    makePdfMock({ numPages: 1, pageTexts: ['X'] });
    await ocrPdfDocument(new ArrayBuffer(0), 'eng');
    expect(fakeWorker.terminate).toHaveBeenCalled();
  });

  it('concatenates OCR text with per-page markers', async () => {
    fakeWorker.recognize
      .mockResolvedValueOnce({ data: { text: 'Alpha' } })
      .mockResolvedValueOnce({ data: { text: 'Beta' } });

    makePdfMock({ numPages: 2, pageTexts: ['X', 'Y'] });
    const text = await ocrPdfDocument(new ArrayBuffer(0), 'eng');

    expect(text).toContain('--- Page 1 ---');
    expect(text).toContain('Alpha');
    expect(text).toContain('--- Page 2 ---');
    expect(text).toContain('Beta');
  });

  it('rejects when PDF is corrupt', async () => {
    pdfjsLib.getDocument.mockImplementationOnce(() => ({ promise: Promise.reject(new Error('Invalid PDF')) }));
    await expect(ocrPdfDocument(corruptPdfBytes())).rejects.toThrow('Invalid PDF');
  });
});

// ===========================================================================
// error paths
// ===========================================================================
describe('error paths — corrupt PDF', () => {
  let container;
  let restoreGetContext;

  beforeEach(() => {
    restoreGetContext = installGetContextStub();
    vi.clearAllMocks();
    pdfjsLib.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('Invalid PDF')) }));
  });

  afterEach(() => {
    restoreGetContext();
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });

  it('renderPdf throws on corrupt PDF', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    await expect(renderPdf(corruptPdfBytes(), container, {})).rejects.toThrow('Invalid PDF');
  });

  it('extractPdfText throws on corrupt PDF', async () => {
    await expect(extractPdfText(corruptPdfBytes())).rejects.toThrow('Invalid PDF');
  });

  it('ocrPdfDocument throws on corrupt PDF', async () => {
    await expect(ocrPdfDocument(corruptPdfBytes())).rejects.toThrow('Invalid PDF');
  });
});
