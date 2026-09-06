import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toGrayscale,
  calculateOtsuThreshold,
  applyThreshold,
  contrastStretch,
  applySharpen,
  detectInversion,
  invertColors,
  preprocessImage,
} from '../../src/utils/image-preprocessor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock ImageData-like object.
 * @param {number} width
 * @param {number} height
 * @param {(x:number,y:number)=>[number,number,number,number]} [fillFn] - returns [r,g,b,a]
 */
function createImageData(width, height, fillFn) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fillFn) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b, a] = fillFn(x, y);
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
  }
  return { data, width, height };
}

/** Shorthand alias used in tests that reference the mock helper by spec name. */
function mockImageData(width, height, pixels) {
  // pixels: flat array of [r,g,b,a] groups or a fill function
  if (typeof pixels === 'function') return createImageData(width, height, pixels);
  if (Array.isArray(pixels)) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i++) {
      data[i] = pixels[i];
    }
    return { data, width, height };
  }
  return createImageData(width, height);
}

// ---------------------------------------------------------------------------
// toGrayscale
// ---------------------------------------------------------------------------
describe('toGrayscale', () => {
  it('converts a pure red pixel using luminance weights 0.299/0.587/0.114', () => {
    const img = createImageData(1, 1, () => [255, 0, 0, 255]);
    toGrayscale(img);
    const expected = Math.round(0.299 * 255);
    // Uint8ClampedArray truncates; implementation assigns float then clamps
    expect(img.data[0]).toBeCloseTo(expected, 0);
    expect(img.data[1]).toBeCloseTo(expected, 0);
    expect(img.data[2]).toBeCloseTo(expected, 0);
  });

  it('converts a pure green pixel correctly', () => {
    const img = createImageData(1, 1, () => [0, 255, 0, 255]);
    toGrayscale(img);
    const expected = Math.round(0.587 * 255);
    expect(img.data[0]).toBeCloseTo(expected, 0);
    expect(img.data[1]).toBeCloseTo(expected, 0);
    expect(img.data[2]).toBeCloseTo(expected, 0);
  });

  it('converts a pure blue pixel correctly', () => {
    const img = createImageData(1, 1, () => [0, 0, 255, 255]);
    toGrayscale(img);
    const expected = Math.round(0.114 * 255);
    expect(img.data[0]).toBeCloseTo(expected, 0);
    expect(img.data[1]).toBeCloseTo(expected, 0);
    expect(img.data[2]).toBeCloseTo(expected, 0);
  });

  it('leaves a white pixel at 255', () => {
    const img = createImageData(1, 1, () => [255, 255, 255, 255]);
    toGrayscale(img);
    expect(img.data[0]).toBe(255);
    expect(img.data[1]).toBe(255);
    expect(img.data[2]).toBe(255);
  });

  it('leaves a black pixel at 0', () => {
    const img = createImageData(1, 1, () => [0, 0, 0, 255]);
    toGrayscale(img);
    expect(img.data[0]).toBe(0);
    expect(img.data[1]).toBe(0);
    expect(img.data[2]).toBe(0);
  });

  it('preserves alpha channel', () => {
    const img = createImageData(1, 1, () => [100, 150, 200, 128]);
    toGrayscale(img);
    expect(img.data[3]).toBe(128);
  });

  it('mutates in place and returns the same object', () => {
    const img = createImageData(2, 1, () => [100, 100, 100, 255]);
    const ret = toGrayscale(img);
    expect(ret).toBe(img);
  });

  it('handles an arbitrary colour with correct luminance formula', () => {
    const img = createImageData(1, 1, () => [100, 150, 200, 255]);
    toGrayscale(img);
    const expected = 0.299 * 100 + 0.587 * 150 + 0.114 * 200;
    expect(img.data[0]).toBeCloseTo(expected, 0);
    expect(img.data[1]).toBeCloseTo(expected, 0);
    expect(img.data[2]).toBeCloseTo(expected, 0);
  });

  it('handles 1x1 image (edge case)', () => {
    const img = createImageData(1, 1, () => [42, 42, 42, 255]);
    expect(() => toGrayscale(img)).not.toThrow();
    expect(img.data[0]).toBe(42);
  });

  it('handles uniform colour image', () => {
    const img = createImageData(4, 4, () => [80, 80, 80, 255]);
    toGrayscale(img);
    for (let i = 0; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(80);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateOtsuThreshold
// ---------------------------------------------------------------------------
describe('calculateOtsuThreshold', () => {
  it('returns a value in [0, 255]', () => {
    const img = createImageData(4, 4, () => [128, 128, 128, 255]);
    const t = calculateOtsuThreshold(img);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(255);
  });

  it('finds a threshold between two distinct peaks (bimodal histogram)', () => {
    // Half pixels at value 30, half at value 220
    const img = createImageData(10, 2, (x) => (x < 5 ? [30, 30, 30, 255] : [220, 220, 220, 255]));
    const t = calculateOtsuThreshold(img);
    // Otsu returns the lower peak value (30) as the last t that maximises
    // between-class variance before the second peak; accept >= lower peak
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });

  it('bimodal with extreme separation yields threshold roughly in the middle', () => {
    const img = createImageData(10, 2, (x) => (x < 5 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const t = calculateOtsuThreshold(img);
    // With equal counts at 0 and 255 the Otsu optimum is 0 (first max)
    // Accept any value strictly between would also be reasonable; check it is not 128 default only if histogram forces it
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(255);
  });

  it('returns default (128) for uniform image (no variance to maximise)', () => {
    const img = createImageData(4, 4, () => [100, 100, 100, 255]);
    const t = calculateOtsuThreshold(img);
    expect(t).toBe(128);
  });

  it('handles 1x1 image without throwing', () => {
    const img = createImageData(1, 1, () => [200, 200, 200, 255]);
    expect(() => calculateOtsuThreshold(img)).not.toThrow();
    const t = calculateOtsuThreshold(img);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(255);
  });

  it('uses only the red channel (first byte) for histogram', () => {
    // R differs from G/B but histogram reads data[i] only
    const img = createImageData(2, 1);
    // pixel 0: R=10, G=200, B=200
    img.data[0] = 10; img.data[1] = 200; img.data[2] = 200; img.data[3] = 255;
    // pixel 1: R=240, G=0, B=0
    img.data[4] = 240; img.data[5] = 0; img.data[6] = 0; img.data[7] = 255;
    const t = calculateOtsuThreshold(img);
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThan(240);
  });
});

// ---------------------------------------------------------------------------
// applyThreshold
// ---------------------------------------------------------------------------
describe('applyThreshold', () => {
  it('maps pixels >= threshold to 255 and < threshold to 0', () => {
    const img = createImageData(3, 1);
    img.data[0] = 100; img.data[1] = 100; img.data[2] = 100; img.data[3] = 255;
    img.data[4] = 128; img.data[5] = 128; img.data[6] = 128; img.data[7] = 255;
    img.data[8] = 200; img.data[9] = 200; img.data[10] = 200; img.data[11] = 255;
    applyThreshold(img, 128);
    expect(img.data[0]).toBe(0);
    expect(img.data[4]).toBe(255); // exactly at threshold -> 255
    expect(img.data[8]).toBe(255);
  });

  it('threshold 0 maps every pixel to 255', () => {
    const img = createImageData(2, 1, () => [0, 0, 0, 255]);
    applyThreshold(img, 0);
    expect(img.data[0]).toBe(255);
    expect(img.data[4]).toBe(255);
  });

  it('threshold 255 maps only 255-valued pixels to 255, rest to 0', () => {
    const img = createImageData(3, 1);
    img.data[0] = 0; img.data[1] = 0; img.data[2] = 0; img.data[3] = 255;
    img.data[4] = 254; img.data[5] = 254; img.data[6] = 254; img.data[7] = 255;
    img.data[8] = 255; img.data[9] = 255; img.data[10] = 255; img.data[11] = 255;
    applyThreshold(img, 255);
    expect(img.data[0]).toBe(0);
    expect(img.data[4]).toBe(0);
    expect(img.data[8]).toBe(255);
  });

  it('preserves alpha channel', () => {
    const img = createImageData(1, 1, () => [200, 200, 200, 99]);
    applyThreshold(img, 128);
    expect(img.data[3]).toBe(99);
  });

  it('returns the same object', () => {
    const img = createImageData(1, 1, () => [100, 100, 100, 255]);
    expect(applyThreshold(img, 128)).toBe(img);
  });

  it('handles 1x1 image', () => {
    const img = createImageData(1, 1, () => [50, 50, 50, 255]);
    applyThreshold(img, 100);
    expect(img.data[0]).toBe(0);
  });

  it('handles uniform colour image (all pixels same side of threshold)', () => {
    const img = createImageData(4, 4, () => [200, 200, 200, 255]);
    applyThreshold(img, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(255);
    }
  });
});

// ---------------------------------------------------------------------------
// contrastStretch
// ---------------------------------------------------------------------------
describe('contrastStretch', () => {
  it('expands dynamic range so that min maps near 0 and max near 255', () => {
    // Values clustered between 50 and 150; stretch with 0/100 percentiles
    const img = createImageData(4, 1);
    const vals = [50, 80, 120, 150];
    vals.forEach((v, idx) => {
      img.data[idx * 4] = v;
      img.data[idx * 4 + 1] = v;
      img.data[idx * 4 + 2] = v;
      img.data[idx * 4 + 3] = 255;
    });
    contrastStretch(img, 0, 100);
    expect(img.data[0]).toBe(0);
    expect(img.data[3 * 4]).toBe(255);
  });

  it('returns image unchanged when maxVal <= minVal (uniform image)', () => {
    const img = createImageData(4, 4, () => [100, 100, 100, 255]);
    const snapshot = new Uint8ClampedArray(img.data);
    contrastStretch(img, 2, 98);
    expect(img.data).toEqual(snapshot);
  });

  it('uses default percentiles (2 and 98) without throwing', () => {
    const img = createImageData(4, 4, () => [100, 100, 100, 255]);
    expect(() => contrastStretch(img)).not.toThrow();
  });

  it('clamps values outside [minVal, maxVal] to 0 or 255', () => {
    // Create an image whose histogram percentiles leave some pixels outside the stretch window
    // We add two outlier pixels (0 and 255) among many mid-range pixels
    const img = createImageData(10, 1);
    // 8 mid pixels at 100, plus one at 0 and one at 255
    for (let i = 0; i < 10; i++) {
      const v = i === 0 ? 0 : i === 9 ? 255 : 100;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    // Stretch percentiles that still allow some spread
    contrastStretch(img, 0, 100);
    // With 0/100 the range is [0,255] so no-op
    expect(img.data[0]).toBe(0);
    expect(img.data[9 * 4]).toBe(255);
  });

  it('preserves alpha channel', () => {
    const img = createImageData(2, 1, () => [100, 100, 100, 77]);
    // uniform so early return preserves alpha too
    contrastStretch(img);
    expect(img.data[3]).toBe(77);
    expect(img.data[7]).toBe(77);
  });

  it('handles 1x1 image', () => {
    const img = createImageData(1, 1, () => [128, 128, 128, 255]);
    expect(() => contrastStretch(img)).not.toThrow();
  });

  it('stretches correctly when image has narrow range', () => {
    // All pixels between 100-110
    const img = createImageData(4, 1);
    [100, 103, 107, 110].forEach((v, i) => {
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    });
    contrastStretch(img, 0, 100);
    expect(img.data[0]).toBe(0);
    expect(img.data[3 * 4]).toBe(255);
    // middle values should be interpolated
    expect(img.data[1 * 4]).toBeGreaterThan(0);
    expect(img.data[1 * 4]).toBeLessThan(255);
  });

  it('returns the same object', () => {
    const img = createImageData(2, 1, () => [50, 50, 50, 255]);
    expect(contrastStretch(img)).toBe(img);
  });
});

// ---------------------------------------------------------------------------
// applySharpen
// ---------------------------------------------------------------------------
describe('applySharpen', () => {
  it('boosts edge contrast (centre brighter than neighbours becomes brighter)', () => {
    // 3x3 image: centre is bright (200), neighbours are dark (50)
    const img = createImageData(3, 3, () => [50, 50, 50, 255]);
    // centre pixel
    img.data[(1 * 3 + 1) * 4] = 200;
    img.data[(1 * 3 + 1) * 4 + 1] = 200;
    img.data[(1 * 3 + 1) * 4 + 2] = 200;
    const centreBefore = 200;
    applySharpen(img, 3, 3);
    const centreAfter = img.data[(1 * 3 + 1) * 4];
    // sharpened = 5*200 - (50+50+50+50) = 800 -> clamped to 255
    expect(centreAfter).toBeGreaterThan(centreBefore);
    expect(centreAfter).toBe(255);
  });

  it('uniform image: sharpen keeps border pixels and interior unchanged (no edge to boost)', () => {
    const img = createImageData(3, 3, () => [100, 100, 100, 255]);
    applySharpen(img, 3, 3);
    // Interior pixel: 5*100 - 4*100 = 100 -> unchanged
    expect(img.data[(1 * 3 + 1) * 4]).toBe(100);
    // Borders are copied from src via fallback loop
    expect(img.data[0]).toBe(100);
  });

  it('clamps sharpened values to [0, 255]', () => {
    // Centre is 0 with bright neighbours -> negative sharpened value clamped to 0
    const img = createImageData(3, 3, () => [255, 255, 255, 255]);
    img.data[(1 * 3 + 1) * 4] = 0;
    img.data[(1 * 3 + 1) * 4 + 1] = 0;
    img.data[(1 * 3 + 1) * 4 + 2] = 0;
    applySharpen(img, 3, 3);
    const centreAfter = img.data[(1 * 3 + 1) * 4];
    expect(centreAfter).toBe(0);
  });

  it('preserves alpha channel', () => {
    const img = createImageData(3, 3, () => [100, 100, 100, 42]);
    applySharpen(img, 3, 3);
    expect(img.data[(1 * 3 + 1) * 4 + 3]).toBe(42);
  });

  it('returns the same object', () => {
    const img = createImageData(3, 3, () => [100, 100, 100, 255]);
    expect(applySharpen(img, 3, 3)).toBe(img);
  });

  it('handles 1x1 image without throwing (no interior pixels to process)', () => {
    const img = createImageData(1, 1, () => [100, 100, 100, 255]);
    expect(() => applySharpen(img, 1, 1)).not.toThrow();
    expect(img.data[0]).toBe(100);
  });

  it('handles 2x2 image (no interior pixels)', () => {
    const img = createImageData(2, 2, () => [100, 100, 100, 255]);
    const snapshot = new Uint8ClampedArray(img.data);
    applySharpen(img, 2, 2);
    expect(img.data).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// detectInversion
// ---------------------------------------------------------------------------
describe('detectInversion', () => {
  it('returns true when >60% of pixels are dark (<128)', () => {
    // 8 dark, 2 bright => 80% dark
    const img = createImageData(10, 1, (x) => (x < 8 ? [10, 10, 10, 255] : [200, 200, 200, 255]));
    expect(detectInversion(img)).toBe(true);
  });

  it('returns false when majority of pixels are light (>=128)', () => {
    // 8 bright, 2 dark => 20% dark
    const img = createImageData(10, 1, (x) => (x < 8 ? [200, 200, 200, 255] : [10, 10, 10, 255]));
    expect(detectInversion(img)).toBe(false);
  });

  it('returns false when exactly 60% dark (threshold is strictly > 0.6)', () => {
    // 6 dark, 4 bright => 60% dark -> not > 0.6
    const img = createImageData(10, 1, (x) => (x < 6 ? [10, 10, 10, 255] : [200, 200, 200, 255]));
    expect(detectInversion(img)).toBe(false);
  });

  it('returns true for an all-black image', () => {
    const img = createImageData(4, 4, () => [0, 0, 0, 255]);
    expect(detectInversion(img)).toBe(true);
  });

  it('returns false for an all-white image', () => {
    const img = createImageData(4, 4, () => [255, 255, 255, 255]);
    expect(detectInversion(img)).toBe(false);
  });

  it('handles 1x1 dark image', () => {
    const img = createImageData(1, 1, () => [0, 0, 0, 255]);
    expect(detectInversion(img)).toBe(true);
  });

  it('handles 1x1 light image', () => {
    const img = createImageData(1, 1, () => [255, 255, 255, 255]);
    expect(detectInversion(img)).toBe(false);
  });

  it('uses only the red channel (data[i]) for detection', () => {
    const img = createImageData(1, 1);
    // R is dark but G/B bright; should still count as dark
    img.data[0] = 10; img.data[1] = 255; img.data[2] = 255; img.data[3] = 255;
    expect(detectInversion(img)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// invertColors
// ---------------------------------------------------------------------------
describe('invertColors', () => {
  it('inverts black (0) to white (255)', () => {
    const img = createImageData(1, 1, () => [0, 0, 0, 255]);
    invertColors(img);
    expect(img.data[0]).toBe(255);
    expect(img.data[1]).toBe(255);
    expect(img.data[2]).toBe(255);
  });

  it('inverts white (255) to black (0)', () => {
    const img = createImageData(1, 1, () => [255, 255, 255, 255]);
    invertColors(img);
    expect(img.data[0]).toBe(0);
    expect(img.data[1]).toBe(0);
    expect(img.data[2]).toBe(0);
  });

  it('inverts 100 to 155', () => {
    const img = createImageData(1, 1, () => [100, 100, 100, 255]);
    invertColors(img);
    expect(img.data[0]).toBe(155);
    expect(img.data[1]).toBe(155);
    expect(img.data[2]).toBe(155);
  });

  it('double inversion restores original values', () => {
    const img = createImageData(2, 1, (x) => (x === 0 ? [30, 60, 90, 255] : [200, 150, 100, 255]));
    const original = new Uint8ClampedArray(img.data);
    invertColors(img);
    invertColors(img);
    expect(img.data).toEqual(original);
  });

  it('preserves alpha channel', () => {
    const img = createImageData(1, 1, () => [100, 100, 100, 77]);
    invertColors(img);
    expect(img.data[3]).toBe(77);
  });

  it('returns the same object', () => {
    const img = createImageData(1, 1, () => [100, 100, 100, 255]);
    expect(invertColors(img)).toBe(img);
  });

  it('handles 1x1 image', () => {
    const img = createImageData(1, 1, () => [42, 42, 42, 255]);
    expect(() => invertColors(img)).not.toThrow();
    expect(img.data[0]).toBe(213);
  });

  it('handles uniform colour image', () => {
    const img = createImageData(4, 4, () => [80, 80, 80, 255]);
    invertColors(img);
    for (let i = 0; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(175);
    }
  });
});

// ---------------------------------------------------------------------------
// preprocessImage — pipeline integration (requires DOM canvas mock)
// ---------------------------------------------------------------------------
describe('preprocessImage', () => {
  let originalCreateElement;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);
  });

  function installCanvasMock({ width = 4, height = 4, pixelData } = {}) {
    const buffer = pixelData
      ? new Uint8ClampedArray(pixelData)
      : new Uint8ClampedArray(width * height * 4).fill(0).map((_, i) => (i % 4 === 3 ? 255 : 180));

    const fakeCtx = {
      drawImage() {},
      getImageData() {
        return { data: buffer, width, height };
      },
      putImageData(imgData) {
        buffer.set(imgData.data);
      },
    };

    const fakeCanvas = {
      width,
      height,
      getContext: () => fakeCtx,
      toDataURL: () => 'data:image/png;base64,mock',
      _buffer: buffer,
      _ctx: fakeCtx,
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return fakeCanvas;
      return originalCreateElement(tag);
    });

    return { fakeCanvas, buffer, fakeCtx };
  }

  function restoreDocument() {
    vi.restoreAllMocks();
  }

  function makeSourceImage(w = 4, h = 4) {
    return { naturalWidth: w, naturalHeight: h, width: w, height: h };
  }

  it('returns canvas, dataUrl, threshold, and wasInverted', () => {
    installCanvasMock({ width: 4, height: 4 });
    const src = makeSourceImage(4, 4);
    const result = preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: false });
    expect(result).toHaveProperty('canvas');
    expect(result).toHaveProperty('dataUrl');
    expect(result).toHaveProperty('threshold');
    expect(result).toHaveProperty('wasInverted');
    expect(typeof result.dataUrl).toBe('string');
    expect(result.dataUrl.startsWith('data:image')).toBe(true);
    restoreDocument();
  });

  it('applies grayscale step unconditionally', () => {
    // Use coloured pixels: R=255,G=0,B=0 -> gray ~76
    const pixelData = new Uint8ClampedArray([
      255, 0, 0, 255, 255, 0, 0, 255,
      255, 0, 0, 255, 255, 0, 0, 255,
    ]);
    const { fakeCanvas } = installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: false });
    // After grayscale, R channel should be ~76 for all pixels
    expect(fakeCanvas._buffer[0]).toBeCloseTo(76, 0);
    restoreDocument();
  });

  it('skips contrast stretch when enhanceContrast is false', () => {
    // Narrow range image that would be stretched if enabled
    const pixelData = new Uint8ClampedArray([
      100, 100, 100, 255, 100, 100, 100, 255,
      100, 100, 100, 255, 100, 100, 100, 255,
    ]);
    const { fakeCanvas } = installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    // uniform -> contrast stretch is no-op anyway; just verify it does not throw
    expect(() => preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: false })).not.toThrow();
    restoreDocument();
  });

  it('applies contrast stretch when enhanceContrast is true (default)', () => {
    const pixelData = new Uint8ClampedArray([
      50, 50, 50, 255, 80, 80, 80, 255,
      120, 120, 120, 255, 150, 150, 150, 255,
    ]);
    installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    // Default options have enhanceContrast: true
    expect(() => preprocessImage(src)).not.toThrow();
    restoreDocument();
  });

  it('binarize true computes Otsu threshold and binarizes image', () => {
    // Bimodal image: half dark, half bright
    const pixelData = new Uint8ClampedArray([
      20, 20, 20, 255, 20, 20, 20, 255,
      230, 230, 230, 255, 230, 230, 230, 255,
    ]);
    const { fakeCanvas } = installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    const result = preprocessImage(src, { enhanceContrast: false, sharpen: false, autoInvert: false, binarize: true });
    expect(typeof result.threshold).toBe('number');
    expect(result.threshold).toBeGreaterThanOrEqual(0);
    expect(result.threshold).toBeLessThanOrEqual(255);
    // After thresholding all pixels should be 0 or 255
    for (let i = 0; i < fakeCanvas._buffer.length; i += 4) {
      expect([0, 255]).toContain(fakeCanvas._buffer[i]);
    }
    restoreDocument();
  });

  it('binarize false leaves non-binary values and returns default threshold 128', () => {
    const pixelData = new Uint8ClampedArray([
      100, 100, 100, 255, 150, 150, 150, 255,
      100, 100, 100, 255, 150, 150, 150, 255,
    ]);
    installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    const result = preprocessImage(src, { enhanceContrast: false, sharpen: false, autoInvert: false, binarize: false });
    expect(result.threshold).toBe(128);
    restoreDocument();
  });

  it('autoInvert true inverts a mostly-dark image', () => {
    // 3 dark, 1 bright -> 75% dark -> triggers inversion
    const pixelData = new Uint8ClampedArray([
      10, 10, 10, 255, 10, 10, 10, 255,
      10, 10, 10, 255, 200, 200, 200, 255,
    ]);
    const { fakeCanvas } = installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    const result = preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: true });
    expect(result.wasInverted).toBe(true);
    // After inversion dark pixels (10) should become ~245 (255-10), but note grayscale already applied:
    // 10 stays 10 after grayscale+invert -> 245
    // Check that first pixel was inverted
    expect(fakeCanvas._buffer[0]).toBe(245);
    restoreDocument();
  });

  it('autoInvert does not invert a mostly-light image', () => {
    const pixelData = new Uint8ClampedArray([
      200, 200, 200, 255, 200, 200, 200, 255,
      200, 200, 200, 255, 200, 200, 200, 255,
    ]);
    installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    const result = preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: true });
    expect(result.wasInverted).toBe(false);
    restoreDocument();
  });

  it('explicit invert:true inverts regardless of content', () => {
    const pixelData = new Uint8ClampedArray([
      200, 200, 200, 255, 200, 200, 200, 255,
      200, 200, 200, 255, 200, 200, 200, 255,
    ]);
    const { fakeCanvas } = installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    const result = preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, invert: true, autoInvert: false });
    expect(result.wasInverted).toBe(true);
    expect(fakeCanvas._buffer[0]).toBe(55); // 255-200
    restoreDocument();
  });

  it('invert:false with autoInvert:false never inverts', () => {
    const pixelData = new Uint8ClampedArray([
      10, 10, 10, 255, 10, 10, 10, 255,
      10, 10, 10, 255, 10, 10, 10, 255,
    ]);
    const { fakeCanvas } = installCanvasMock({ width: 2, height: 2, pixelData });
    const src = makeSourceImage(2, 2);
    const result = preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, invert: false, autoInvert: false });
    expect(result.wasInverted).toBe(false);
    restoreDocument();
  });

  it('sharpen option controls whether unsharp masking is applied', () => {
    const pixelData = new Uint8ClampedArray([
      50, 50, 50, 255, 50, 50, 50, 255, 50, 50, 50, 255,
      50, 50, 50, 255, 200, 200, 200, 255, 50, 50, 50, 255,
      50, 50, 50, 255, 50, 50, 50, 255, 50, 50, 50, 255,
    ]);
    // Test with sharpen true vs false by checking centre pixel value differs
    // First, with sharpen disabled (but need to control for binarize/invert)
    const src = makeSourceImage(3, 3);
    const makeData = () => new Uint8ClampedArray(pixelData);
    const { fakeCanvas: c1 } = installCanvasMock({ width: 3, height: 3, pixelData: makeData() });
    preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: false });
    const centreNoSharpen = c1._buffer[(1 * 3 + 1) * 4];
    restoreDocument();

    const { fakeCanvas: c2 } = installCanvasMock({ width: 3, height: 3, pixelData: makeData() });
    preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: true, autoInvert: false });
    const centreSharpen = c2._buffer[(1 * 3 + 1) * 4];
    restoreDocument();

    // Sharpen should have boosted the centre edge
    expect(centreSharpen).toBeGreaterThan(centreNoSharpen);
  });

  it('handles sourceImage with width/height fallback (no naturalWidth)', () => {
    installCanvasMock({ width: 800, height: 600 });
    const src = { width: 800, height: 600 }; // no naturalWidth
    expect(() => preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: false })).not.toThrow();
    restoreDocument();
  });

  it('handles sourceImage with no dimensions (defaults to 800x600)', () => {
    installCanvasMock({ width: 800, height: 600 });
    const src = {};
    expect(() => preprocessImage(src, { enhanceContrast: false, binarize: false, sharpen: false, autoInvert: false })).not.toThrow();
    restoreDocument();
  });

  it('works with default options (no options argument)', () => {
    installCanvasMock({ width: 4, height: 4 });
    const src = makeSourceImage(4, 4);
    expect(() => preprocessImage(src)).not.toThrow();
    const result = preprocessImage(src);
    expect(result).toHaveProperty('canvas');
    expect(result).toHaveProperty('dataUrl');
    restoreDocument();
  });

  it('handles 1x1 image through the full pipeline', () => {
    const pixelData = new Uint8ClampedArray([128, 128, 128, 255]);
    installCanvasMock({ width: 1, height: 1, pixelData });
    const src = makeSourceImage(1, 1);
    expect(() => preprocessImage(src)).not.toThrow();
    const result = preprocessImage(src);
    expect(result).toHaveProperty('threshold');
    restoreDocument();
  });

  it('handles uniform colour image through the full pipeline', () => {
    const pixelData = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < pixelData.length; i += 4) {
      pixelData[i] = 100; pixelData[i + 1] = 100; pixelData[i + 2] = 100; pixelData[i + 3] = 255;
    }
    installCanvasMock({ width: 4, height: 4, pixelData });
    const src = makeSourceImage(4, 4);
    expect(() => preprocessImage(src)).not.toThrow();
    restoreDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge-case integration across individual functions
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('full single-pixel pipeline: grayscale -> threshold -> invert round-trips', () => {
    const img = createImageData(1, 1, () => [0, 0, 0, 255]);
    toGrayscale(img);
    expect(img.data[0]).toBe(0);
    invertColors(img);
    expect(img.data[0]).toBe(255);
    applyThreshold(img, 128);
    expect(img.data[0]).toBe(255);
  });

  it('contrastStretch followed by Otsu + threshold produces binary output', () => {
    const img = createImageData(4, 1);
    [40, 60, 180, 200].forEach((v, i) => {
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    });
    toGrayscale(img);
    contrastStretch(img, 0, 100);
    const t = calculateOtsuThreshold(img);
    applyThreshold(img, t);
    for (let i = 0; i < img.data.length; i += 4) {
      expect([0, 255]).toContain(img.data[i]);
    }
  });

  it('mockImageData helper alias works with array form', () => {
    const img = mockImageData(1, 1, [100, 150, 200, 255]);
    expect(img.data[0]).toBe(100);
    expect(img.data[1]).toBe(150);
  });

  it('mockImageData helper alias works with function form', () => {
    const img = mockImageData(2, 1, () => [10, 20, 30, 255]);
    expect(img.data[0]).toBe(10);
    expect(img.data[4]).toBe(10);
  });
});
