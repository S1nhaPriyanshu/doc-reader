/**
 * Automated verification test suite for the Computer Vision OCR Preprocessor.
 */
import assert from 'node:assert';
import {
  toGrayscale,
  calculateOtsuThreshold,
  applyThreshold,
  contrastStretch,
  applySharpen,
  detectInversion,
  invertColors,
} from '../src/utils/image-preprocessor.js';
import { OCR_LANGUAGES } from '../src/services/ocr-service.js';

// Helper to create mock RGBA ImageData object
function createMockImageData(width, height, fillPixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = fillPixel(Math.floor((i / 4) % width), Math.floor(i / 4 / width));
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { width, height, data };
}

async function runOcrTests() {
  console.log('--- Starting Advanced OCR & Computer Vision Test Suite ---');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
    }
  }

  // 1. Language Support Test
  test('OCR_LANGUAGES contains over 15 major world languages', () => {
    assert(OCR_LANGUAGES.length >= 18, 'Expected at least 18 languages');
    const codes = OCR_LANGUAGES.map((l) => l.code);
    assert(codes.includes('eng'), 'Must support English');
    assert(codes.includes('spa'), 'Must support Spanish');
    assert(codes.includes('fra'), 'Must support French');
    assert(codes.includes('deu'), 'Must support German');
    assert(codes.includes('chi_sim'), 'Must support Chinese');
    assert(codes.includes('jpn'), 'Must support Japanese');
    assert(codes.includes('hin'), 'Must support Hindi');
    assert(codes.includes('ara'), 'Must support Arabic');
  });

  // 2. Grayscale Conversion Test
  test('toGrayscale calculates accurate luminance weights', () => {
    // Pure green: 0.587 weight -> should become ~150
    const img = createMockImageData(2, 2, () => [0, 255, 0, 255]);
    toGrayscale(img);
    const expected = Math.round(0.587 * 255);
    assert.strictEqual(Math.round(img.data[0]), expected);
    assert.strictEqual(img.data[0], img.data[1]);
    assert.strictEqual(img.data[1], img.data[2]);
  });

  // 3. Otsu Threshold Calculation Test
  test('calculateOtsuThreshold finds bimodal variance boundary', () => {
    // Create bimodal image: 50% dark pixels (value 40) and 50% bright pixels (value 210)
    const img = createMockImageData(10, 10, (x, y) => {
      const val = y < 5 ? 40 : 210;
      return [val, val, val, 255];
    });

    const threshold = calculateOtsuThreshold(img);
    assert(threshold >= 40 && threshold <= 210, `Threshold ${threshold} should be between 40 and 210`);
    console.log(`    (Calculated Otsu threshold: ${threshold})`);
  });

  // 4. Threshold Binarization Test
  test('applyThreshold binarizes to pure 0 or 255 values', () => {
    const img = createMockImageData(4, 1, (x) => {
      const val = x * 70; // 0, 70, 140, 210
      return [val, val, val, 255];
    });

    applyThreshold(img, 100);
    // Pixels below 100 -> 0; above 100 -> 255
    assert.strictEqual(img.data[0], 0);
    assert.strictEqual(img.data[4], 0);
    assert.strictEqual(img.data[8], 255);
    assert.strictEqual(img.data[12], 255);
  });

  // 5. Contrast Stretch Test
  test('contrastStretch expands dynamic range', () => {
    // Narrow range image from 100 to 150
    const img = createMockImageData(5, 5, (x, y) => {
      const val = 100 + ((x + y) % 50);
      return [val, val, val, 255];
    });

    contrastStretch(img, 0, 100);
    let min = 255;
    let max = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] < min) min = img.data[i];
      if (img.data[i] > max) max = img.data[i];
    }
    assert(min <= 10, 'Minimum should be stretched near 0');
    assert(max >= 240, 'Maximum should be stretched near 255');
  });

  // 6. Inversion Detection & Color Invert Test
  test('detectInversion accurately identifies dark mode documents', () => {
    // 80% dark background
    const darkDoc = createMockImageData(10, 10, (x, y) => {
      const val = y < 8 ? 20 : 230;
      return [val, val, val, 255];
    });
    assert.strictEqual(detectInversion(darkDoc), true, 'Should detect dark background');

    // 80% white paper
    const lightDoc = createMockImageData(10, 10, (x, y) => {
      const val = y < 8 ? 240 : 30;
      return [val, val, val, 255];
    });
    assert.strictEqual(detectInversion(lightDoc), false, 'Should detect light background');

    invertColors(darkDoc);
    assert(darkDoc.data[0] === 235, '20 inverted should become 235');
  });

  // 7. Sharpen Kernel Convolution Test
  test('applySharpen enhances edge contrast without corrupting data', () => {
    const img = createMockImageData(5, 5, (x, y) => {
      const val = x === 2 ? 200 : 50; // Edge at column 2
      return [val, val, val, 255];
    });

    applySharpen(img, 5, 5);
    // Center pixel at (2,2) with neighbors at 50 should be boosted
    const centerVal = img.data[(2 * 5 + 2) * 4];
    assert(centerVal > 200, `Sharpened edge value ${centerVal} should be greater than original 200`);
  });

  console.log(`\nResults: ${passed} / ${total} tests passed!`);
  if (passed === total) {
    console.log('✓ All Computer Vision & OCR features verified successfully!');
  } else {
    process.exit(1);
  }
}

runOcrTests().catch((e) => {
  console.error('Fatal error during OCR test run:', e);
  process.exit(1);
});
