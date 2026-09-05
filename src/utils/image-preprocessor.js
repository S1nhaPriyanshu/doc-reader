/**
 * Computer Vision Image Preprocessor for OCR.
 * Implements grayscale conversion, contrast stretching, Otsu adaptive binarization,
 * unsharp mask sharpening, and background inversion detection.
 * @module utils/image-preprocessor
 */

/**
 * Converts ImageData to grayscale in-place.
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function toGrayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  return imageData;
}

/**
 * Calculates optimal Otsu threshold for binarization.
 * Maximizes inter-class variance between foreground text and background paper.
 * @param {ImageData} imageData - Grayscale image data.
 * @returns {number} Optimal threshold value (0-255).
 */
export function calculateOtsuThreshold(imageData) {
  const data = imageData.data;
  const total = data.length / 4;
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.floor(data[i])]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    // Between-class variance
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Applies binarization to image data using a given threshold.
 * @param {ImageData} imageData
 * @param {number} threshold - Threshold value (0-255).
 * @returns {ImageData}
 */
export function applyThreshold(imageData, threshold) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] >= threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  return imageData;
}

/**
 * Enhances contrast by stretching histogram between low and high percentiles.
 * @param {ImageData} imageData
 * @param {number} [lowPercent=2]
 * @param {number} [highPercent=98]
 * @returns {ImageData}
 */
export function contrastStretch(imageData, lowPercent = 2, highPercent = 98) {
  const data = imageData.data;
  const total = data.length / 4;
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.floor(data[i])]++;
  }

  const lowCount = total * (lowPercent / 100);
  const highCount = total * (highPercent / 100);

  let acc = 0;
  let minVal = 0;
  let maxVal = 255;
  let minFound = false;

  for (let i = 0; i < 256; i++) {
    acc += histogram[i];
    if (!minFound && acc >= lowCount && histogram[i] > 0) {
      minVal = i;
      minFound = true;
    }
    if (acc >= highCount) {
      maxVal = i;
      break;
    }
  }

  if (maxVal <= minVal) return imageData;

  const scale = 255 / (maxVal - minVal);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const clamped = Math.max(minVal, Math.min(maxVal, data[i + c]));
      data[i + c] = Math.round((clamped - minVal) * scale);
    }
  }

  return imageData;
}

/**
 * Applies a 3x3 unsharp masking convolution kernel to sharpen text edges.
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {ImageData}
 */
export function applySharpen(imageData, width, height) {
  const src = imageData.data;
  const output = new Uint8ClampedArray(src.length);

  // Kernel: standard unsharp mask
  // [  0, -1,  0 ]
  // [ -1,  5, -1 ]
  // [  0, -1,  0 ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const top = src[((y - 1) * width + x) * 4 + c];
        const bottom = src[((y + 1) * width + x) * 4 + c];
        const left = src[(y * width + (x - 1)) * 4 + c];
        const right = src[(y * width + (x + 1)) * 4 + c];
        const center = src[idx + c];

        const sharpened = 5 * center - (top + bottom + left + right);
        output[idx + c] = Math.max(0, Math.min(255, sharpened));
      }
      output[idx + 3] = src[idx + 3]; // Alpha
    }
  }

  // Copy borders
  for (let i = 0; i < src.length; i++) {
    if (output[i] === 0 && src[i] !== 0) output[i] = src[i];
  }

  imageData.data.set(output);
  return imageData;
}

/**
 * Detects if the image is mostly dark background with light text.
 * @param {ImageData} imageData
 * @returns {boolean} True if background appears inverted.
 */
export function detectInversion(imageData) {
  const data = imageData.data;
  let darkPixels = 0;
  const total = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 128) darkPixels++;
  }

  return darkPixels / total > 0.6;
}

/**
 * Inverts grayscale image values in-place.
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function invertColors(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  return imageData;
}

/**
 * Full adaptive preprocessing pipeline for OCR.
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Input image or canvas.
 * @param {Object} [options={}] - Preprocessing flags.
 * @param {boolean} [options.enhanceContrast=true] - Auto-stretch contrast.
 * @param {boolean} [options.binarize=true] - Apply Otsu threshold binarization.
 * @param {boolean} [options.sharpen=true] - Apply unsharp masking.
 * @param {boolean} [options.invert=false] - Invert color palette.
 * @param {boolean} [options.autoInvert=true] - Automatically detect and invert dark-mode documents.
 * @returns {{ canvas: HTMLCanvasElement, dataUrl: string, threshold: number, wasInverted: boolean }}
 */
export function preprocessImage(sourceImage, options = {}) {
  const {
    enhanceContrast = true,
    binarize = true,
    sharpen = true,
    invert = false,
    autoInvert = true,
  } = options;

  const width = sourceImage.naturalWidth || sourceImage.width || 800;
  const height = sourceImage.naturalHeight || sourceImage.height || 600;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(sourceImage, 0, 0, width, height);

  let imgData = ctx.getImageData(0, 0, width, height);
  toGrayscale(imgData);

  if (enhanceContrast) {
    contrastStretch(imgData, 2, 98);
  }

  let wasInverted = false;
  if (invert || (autoInvert && detectInversion(imgData))) {
    invertColors(imgData);
    wasInverted = true;
  }

  if (sharpen) {
    applySharpen(imgData, width, height);
  }

  let threshold = 128;
  if (binarize) {
    threshold = calculateOtsuThreshold(imgData);
    applyThreshold(imgData, threshold);
  }

  ctx.putImageData(imgData, 0, 0);

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    threshold,
    wasInverted,
  };
}
