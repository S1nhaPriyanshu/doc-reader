/**
 * Advanced Client-Side OCR Engine & Vision Studio.
 * Integrates Tesseract.js v7 with an adaptive Computer Vision preprocessing pipeline,
 * multi-language selection, PSM modes, interactive bounding box overlays, and direct export workflows.
 * @module services/ocr-service
 */
import { preprocessImage } from '../utils/image-preprocessor.js';
import { showToast } from '../components/toast.js';

/**
 * List of supported OCR languages.
 */
export const OCR_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish (Español)' },
  { code: 'fra', name: 'French (Français)' },
  { code: 'deu', name: 'German (Deutsch)' },
  { code: 'ita', name: 'Italian (Italiano)' },
  { code: 'por', name: 'Portuguese (Português)' },
  { code: 'hin', name: 'Hindi (हिन्दी)' },
  { code: 'chi_sim', name: 'Chinese Simplified (简体中文)' },
  { code: 'chi_tra', name: 'Chinese Traditional (繁體中文)' },
  { code: 'jpn', name: 'Japanese (日本語)' },
  { code: 'kor', name: 'Korean (한국어)' },
  { code: 'ara', name: 'Arabic (العربية)' },
  { code: 'rus', name: 'Russian (Русский)' },
  { code: 'nld', name: 'Dutch (Nederlands)' },
  { code: 'pol', name: 'Polish (Polski)' },
  { code: 'tur', name: 'Turkish (Türkçe)' },
  { code: 'vie', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'swe', name: 'Swedish (Svenska)' },
];

/**
 * Renders an image document and provides the Advanced Vision OCR Studio.
 * @param {ArrayBuffer} fileData - The image file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} Document render result.
 */
export async function renderImage(fileData, container, docMeta) {
  try {
    const blob = new Blob([fileData]);
    const originalUrl = URL.createObjectURL(blob);

    let activeUrl = originalUrl;
    let preprocessedResult = null;
    let ocrData = null;

    const langOptions = OCR_LANGUAGES.map(
      (l) => `<option value="${l.code}" ${l.code === 'eng' ? 'selected' : ''}>${l.name}</option>`
    ).join('');

    container.innerHTML = `
      <div class="ocr-studio">
        <!-- Control Header & Filter Bar -->
        <div class="ocr-toolbar card">
          <div class="ocr-toolbar-row">
            <div class="ocr-field">
              <label for="ocr-lang-select">Language</label>
              <select id="ocr-lang-select" class="select select-sm">
                ${langOptions}
              </select>
            </div>

            <div class="ocr-field">
              <label for="ocr-psm-select">Layout Mode</label>
              <select id="ocr-psm-select" class="select select-sm">
                <option value="3" selected>Auto Document</option>
                <option value="6">Single Text Block</option>
                <option value="11">Sparse Text / Receipts</option>
                <option value="7">Single Line</option>
              </select>
            </div>

            <button class="btn btn-primary" id="ocr-run-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Recognize Text
            </button>
          </div>

          <!-- Preprocessing Filters Accordion / Row -->
          <div class="ocr-filters-row">
            <span class="ocr-filter-label">AI Preprocessing:</span>
            <label class="ocr-checkbox-label">
              <input type="checkbox" id="ocr-filter-enhance" checked /> Contrast Stretch
            </label>
            <label class="ocr-checkbox-label">
              <input type="checkbox" id="ocr-filter-binarize" checked /> Otsu Binarize
            </label>
            <label class="ocr-checkbox-label">
              <input type="checkbox" id="ocr-filter-sharpen" checked /> Edge Sharpen
            </label>
            <label class="ocr-checkbox-label">
              <input type="checkbox" id="ocr-filter-invert" /> Invert Colors
            </label>
            <button class="btn btn-secondary btn-sm" id="ocr-toggle-preview-btn" style="display:none;">
              View Preprocessed
            </button>
          </div>
        </div>

        <!-- Progress Indicator Bar -->
        <div class="ocr-progress-container card" id="ocr-progress-box" style="display:none;">
          <div class="ocr-progress-header">
            <span id="ocr-progress-status">Initializing neural network...</span>
            <span id="ocr-progress-percent">0%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="ocr-progress-fill" style="width: 0%;"></div>
          </div>
        </div>

        <!-- Main Workspace (Dual View: Image & Overlay vs Recognized Output) -->
        <div class="ocr-workspace">
          <!-- Image Viewport with Bounding Box Overlay -->
          <div class="ocr-image-panel card">
            <div class="ocr-image-container" id="ocr-image-wrapper">
              <img id="ocr-display-img" src="${originalUrl}" alt="${docMeta.name}" />
              <div class="ocr-overlay-layer" id="ocr-overlay"></div>
            </div>
            <div class="ocr-image-footer">
              <label class="ocr-checkbox-label" id="ocr-toggle-boxes-label" style="display:none;">
                <input type="checkbox" id="ocr-toggle-boxes" checked /> Show Word Bounding Boxes
              </label>
            </div>
          </div>

          <!-- Recognized Text & Actions Panel -->
          <div class="ocr-text-panel card" id="ocr-text-panel" style="display:none;">
            <div class="ocr-panel-header">
              <div class="ocr-scorecard" id="ocr-scorecard">
                <span class="badge badge-success" id="ocr-confidence-badge">98% Accuracy</span>
                <span class="ocr-stat-item" id="ocr-word-count">0 words</span>
                <span class="ocr-stat-item" id="ocr-time-taken">0.0s</span>
              </div>
              <div class="ocr-actions">
                <button class="btn btn-secondary btn-sm" id="ocr-copy-btn" title="Copy to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </button>
                <button class="btn btn-secondary btn-sm" id="ocr-edit-btn" title="Edit in WYSIWYG editor">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button class="btn btn-secondary btn-sm" id="ocr-export-docx-btn" title="Export as DOCX">
                  DOCX
                </button>
                <button class="btn btn-secondary btn-sm" id="ocr-export-pdf-btn" title="Export as PDF">
                  PDF
                </button>
              </div>
            </div>

            <textarea id="ocr-result-text" class="ocr-textarea" spellcheck="false" placeholder="Recognized text will appear here..."></textarea>
          </div>
        </div>
      </div>
    `;

    // References
    const runBtn = container.querySelector('#ocr-run-btn');
    const displayImg = container.querySelector('#ocr-display-img');
    const overlay = container.querySelector('#ocr-overlay');
    const progressBox = container.querySelector('#ocr-progress-box');
    const progressStatus = container.querySelector('#ocr-progress-status');
    const progressPercent = container.querySelector('#ocr-progress-percent');
    const progressFill = container.querySelector('#ocr-progress-fill');
    const textPanel = container.querySelector('#ocr-text-panel');
    const resultTextArea = container.querySelector('#ocr-result-text');
    const togglePreviewBtn = container.querySelector('#ocr-toggle-preview-btn');
    const toggleBoxesInput = container.querySelector('#ocr-toggle-boxes');
    const toggleBoxesLabel = container.querySelector('#ocr-toggle-boxes-label');
    const confidenceBadge = container.querySelector('#ocr-confidence-badge');
    const wordCountSpan = container.querySelector('#ocr-word-count');
    const timeTakenSpan = container.querySelector('#ocr-time-taken');

    let isShowingPreprocessed = false;

    // Toggle between original and preprocessed image
    togglePreviewBtn.addEventListener('click', () => {
      if (!preprocessedResult) return;
      isShowingPreprocessed = !isShowingPreprocessed;
      if (isShowingPreprocessed) {
        displayImg.src = preprocessedResult.dataUrl;
        togglePreviewBtn.textContent = 'View Original';
      } else {
        displayImg.src = originalUrl;
        togglePreviewBtn.textContent = 'View Preprocessed';
      }
    });

    // Toggle bounding boxes overlay visibility
    toggleBoxesInput.addEventListener('change', () => {
      overlay.style.display = toggleBoxesInput.checked ? 'block' : 'none';
    });

    // Run OCR Click
    runBtn.addEventListener('click', async () => {
      const selectedLang = container.querySelector('#ocr-lang-select').value;
      const selectedPsm = parseInt(container.querySelector('#ocr-psm-select').value, 10);

      const enhance = container.querySelector('#ocr-filter-enhance').checked;
      const binarize = container.querySelector('#ocr-filter-binarize').checked;
      const sharpen = container.querySelector('#ocr-filter-sharpen').checked;
      const invert = container.querySelector('#ocr-filter-invert').checked;

      runBtn.disabled = true;
      progressBox.style.display = 'block';
      progressFill.style.width = '5%';
      progressStatus.textContent = 'Running Computer Vision enhancement...';
      progressPercent.textContent = '5%';

      const startTime = performance.now();

      try {
        // Step 1: Preprocess Image using Computer Vision
        preprocessedResult = preprocessImage(displayImg, {
          enhanceContrast: enhance,
          binarize: binarize,
          sharpen: sharpen,
          invert: invert,
          autoInvert: true,
        });

        togglePreviewBtn.style.display = 'inline-flex';

        progressFill.style.width = '20%';
        progressStatus.textContent = `Loading ${selectedLang.toUpperCase()} neural model...`;
        progressPercent.textContent = '20%';

        // Step 2: Initialize Tesseract.js Worker
        const { createWorker, PSM } = await import('tesseract.js');

        const worker = await createWorker(selectedLang, 1, {
          logger: (m) => {
            if (m.status) {
              const friendlyStatus = formatOcrStatus(m.status);
              const pct = Math.round((m.progress || 0) * 100);
              progressStatus.textContent = friendlyStatus;
              if (m.status === 'recognizing text') {
                const totalPct = 30 + Math.round(pct * 0.65);
                progressFill.style.width = `${totalPct}%`;
                progressPercent.textContent = `${totalPct}%`;
              }
            }
          },
        });

        if (selectedPsm) {
          await worker.setParameters({
            tessedit_pageseg_mode: selectedPsm,
          });
        }

        progressStatus.textContent = 'Analyzing text layout & characters...';

        // Step 3: Run recognition on preprocessed canvas
        const inputSource = binarize || enhance || sharpen ? preprocessedResult.canvas : displayImg;
        const result = await worker.recognize(inputSource);
        ocrData = result.data;

        await worker.terminate();

        const duration = ((performance.now() - startTime) / 1000).toFixed(1);

        // Step 4: Display Output
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressStatus.textContent = 'Recognition complete!';

        setTimeout(() => {
          progressBox.style.display = 'none';
        }, 1200);

        textPanel.style.display = 'flex';
        resultTextArea.value = ocrData.text || '';

        // Scoreboard metrics
        const conf = Math.round(ocrData.confidence || 0);
        confidenceBadge.textContent = `${conf}% Confidence`;
        confidenceBadge.className = `badge ${conf >= 85 ? 'badge-success' : conf >= 60 ? 'badge-warning' : 'badge-error'}`;

        const wordCount = (ocrData.words || []).length;
        wordCountSpan.textContent = `${wordCount} words detected`;
        timeTakenSpan.textContent = `${duration}s`;

        // Render interactive Bounding Box overlay
        renderBoundingBoxes(overlay, displayImg, ocrData.words || []);
        toggleBoxesLabel.style.display = 'flex';
        toggleBoxesInput.checked = true;
        overlay.style.display = 'block';

        showToast(`OCR finished in ${duration}s (${conf}% accuracy)`, 'success');
      } catch (err) {
        console.error('OCR Error:', err);
        progressStatus.textContent = 'Failed: ' + err.message;
        showToast('OCR Error: ' + err.message, 'error');
      } finally {
        runBtn.disabled = false;
      }
    });

    // Copy to Clipboard
    container.querySelector('#ocr-copy-btn')?.addEventListener('click', async () => {
      const text = resultTextArea.value;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
      } catch {
        resultTextArea.select();
        document.execCommand('copy');
        showToast('Copied to clipboard!', 'success');
      }
    });

    // Edit in Document Editor
    container.querySelector('#ocr-edit-btn')?.addEventListener('click', async () => {
      const text = resultTextArea.value;
      if (!text) return;
      const app = window.__docReaderApp;
      if (app && typeof app.editDocument === 'function') {
        const textDocMeta = {
          ...docMeta,
          name: docMeta.name.replace(/\.\w+$/, '') + '_ocr.txt',
          format: 'txt',
        };
        app.editDocument(textDocMeta, new TextEncoder().encode(text).buffer, { type: 'text', content: text });
      } else {
        showToast('Editor navigation unavailable', 'warning');
      }
    });

    // Direct Export to DOCX
    container.querySelector('#ocr-export-docx-btn')?.addEventListener('click', async () => {
      const text = resultTextArea.value;
      if (!text) return;
      try {
        const { convertDocument } = await import('./converter-service.js');
        const baseName = docMeta.name.replace(/\.\w+$/, '') + '_ocr';
        const textBuffer = new TextEncoder().encode(text).buffer;
        const result = await convertDocument({ format: 'txt', name: `${baseName}.txt` }, textBuffer, 'docx');
        downloadBlob(result.blob, result.fileName);
        showToast('Exported as Word DOCX!', 'success');
      } catch (e) {
        showToast('Export failed: ' + e.message, 'error');
      }
    });

    // Direct Export to PDF
    container.querySelector('#ocr-export-pdf-btn')?.addEventListener('click', async () => {
      const text = resultTextArea.value;
      if (!text) return;
      try {
        const { convertDocument } = await import('./converter-service.js');
        const baseName = docMeta.name.replace(/\.\w+$/, '') + '_ocr';
        const textBuffer = new TextEncoder().encode(text).buffer;
        const result = await convertDocument({ format: 'txt', name: `${baseName}.txt` }, textBuffer, 'pdf');
        downloadBlob(result.blob, result.fileName);
        showToast('Exported as PDF!', 'success');
      } catch (e) {
        showToast('Export failed: ' + e.message, 'error');
      }
    });

    return {
      type: 'image',
      content: displayImg,
      editable: true,
      getOcrText: () => resultTextArea.value,
    };
  } catch (error) {
    console.error('Error rendering image OCR studio:', error);
    throw error;
  }
}

/**
 * Draws interactive bounding boxes over the image with tooltips.
 * @param {HTMLElement} overlay - Overlay layer container.
 * @param {HTMLImageElement} img - Reference image element.
 * @param {Array} words - Array of recognized word objects with bbox.
 */
function renderBoundingBoxes(overlay, img, words) {
  overlay.innerHTML = '';
  if (!words || words.length === 0) return;

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  words.forEach((w) => {
    if (!w.bbox || !w.text.trim()) return;

    const { x0, y0, x1, y1 } = w.bbox;
    const left = (x0 / naturalWidth) * 100;
    const top = (y0 / naturalHeight) * 100;
    const width = ((x1 - x0) / naturalWidth) * 100;
    const height = ((y1 - y0) / naturalHeight) * 100;

    const conf = Math.round(w.confidence || 0);
    const confClass = conf >= 85 ? 'box-high' : conf >= 60 ? 'box-med' : 'box-low';

    const box = document.createElement('div');
    box.className = `ocr-bounding-box ${confClass}`;
    box.style.left = `${left}%`;
    box.style.top = `${top}%`;
    box.style.width = `${width}%`;
    box.style.height = `${height}%`;
    box.title = `"${w.text}" (${conf}% confidence)`;

    box.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast(`Word: "${w.text}" (${conf}% confidence)`, 'info', 1500);
    });

    overlay.appendChild(box);
  });
}

/**
 * Formats Tesseract logger status string into readable message.
 * @param {string} status
 * @returns {string}
 */
function formatOcrStatus(status) {
  const map = {
    'loading tesseract core': 'Loading WASM core...',
    'initializing tesseract': 'Initializing OCR engine...',
    'initialized tesseract': 'Engine ready',
    'loading language traineddata': 'Downloading language model...',
    'loaded language traineddata': 'Language model loaded',
    'initializing api': 'Configuring layout parameters...',
    'initialized api': 'Starting recognition...',
    'recognizing text': 'Scanning text lines & glyphs...',
  };
  return map[status] || status;
}

/**
 * Downloads a blob file.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
