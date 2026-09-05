/**
 * Open/File-picker view — allows users to open documents via file input or drag-and-drop.
 * @module views/open
 */
import { ACCEPTED_EXTENSIONS, detectFormat, formatFileSize, validateFileSize, generateDocId } from '../utils/file-utils.js';
import { showToast } from '../components/toast.js';

/**
 * Renders the open/file-picker view.
 * @param {HTMLElement} container - The container to render into.
 * @param {Object} app - App controller reference.
 */
export function renderOpen(container, app) {
  container.innerHTML = `
    <div class="view open-view" id="open-view">
      <div class="open-header">
        <h2 class="section-title">Open Document</h2>
        <p class="section-subtitle">Select or drag a file to get started</p>
      </div>

      <div class="file-drop-zone" id="file-drop-zone">
        <div class="drop-zone-content">
          <div class="drop-zone-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p class="drop-zone-title">Drop your file here</p>
          <p class="drop-zone-subtitle">or tap to browse</p>
          <div class="drop-zone-formats">
            <span class="badge badge-pdf">PDF</span>
            <span class="badge badge-docx">DOCX</span>
            <span class="badge badge-txt">TXT</span>
            <span class="badge badge-md">MD</span>
            <span class="badge badge-html">HTML</span>
            <span class="badge badge-xlsx">XLSX</span>
            <span class="badge badge-csv">CSV</span>
            <span class="badge badge-json">JSON</span>
            <span class="badge badge-epub">EPUB</span>
            <span class="badge badge-rtf">RTF</span>
            <span class="badge badge-img">IMG</span>
          </div>
        </div>
        <input
          type="file"
          id="file-input"
          class="file-input-hidden"
          accept="${ACCEPTED_EXTENSIONS}"
          aria-label="Select a document file"
        />
      </div>

      <div class="open-info">
        <div class="info-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Files are processed locally — nothing leaves your device</span>
        </div>
        <div class="info-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Maximum file size: 50 MB</span>
        </div>
      </div>
    </div>
  `;

  bindOpenEvents(container, app);
}

/**
 * Binds file input, drag-drop, and click events.
 * @param {HTMLElement} container - The view container.
 * @param {Object} app - App controller.
 */
function bindOpenEvents(container, app) {
  const dropZone = container.querySelector('#file-drop-zone');
  const fileInput = container.querySelector('#file-input');

  // Click to open file dialog
  dropZone.addEventListener('click', (e) => {
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file, app);
    fileInput.value = ''; // Reset for re-selection
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drop-zone-active');
    e.dataTransfer.dropEffect = 'copy';
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drop-zone-active');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drop-zone-active');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file, app);
  });
}

/**
 * Processes a selected file: validates, detects format, and hands off to app.
 * @param {File} file - The selected file.
 * @param {Object} app - App controller.
 */
async function processFile(file, app) {
  // Validate size
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    showToast(sizeCheck.message, 'error');
    return;
  }

  // Detect format
  const formatInfo = detectFormat(file);
  if (formatInfo.format === 'unknown') {
    showToast('Unsupported file format. Please select a supported document.', 'error');
    return;
  }

  // Build document metadata
  const docMeta = {
    id: generateDocId(file),
    name: file.name,
    type: file.type || formatInfo.mime,
    format: formatInfo.format,
    label: formatInfo.label,
    size: file.size,
    lastOpened: Date.now(),
  };

  showToast(`Opening ${file.name}...`, 'info', 2000);

  try {
    const arrayBuffer = await file.arrayBuffer();
    app.openDocument(docMeta, arrayBuffer);
  } catch (err) {
    console.error('Failed to read file:', err);
    showToast('Failed to read file. Please try again.', 'error');
  }
}
