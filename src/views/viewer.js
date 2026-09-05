/**
 * Document Viewer view — renders opened documents with toolbar and controls.
 * @module views/viewer
 */
import { routeDocument } from '../services/format-router.js';
import { showToast } from '../components/toast.js';

/** @type {Object|null} Current document state */
let currentDoc = null;

/**
 * Renders the document viewer for a given document.
 * @param {HTMLElement} container - The container to render into.
 * @param {Object} app - App controller reference.
 * @param {Object} docMeta - Document metadata.
 * @param {ArrayBuffer} fileData - Raw file data.
 */
export async function renderViewer(container, app, docMeta, fileData) {
  currentDoc = { meta: docMeta, data: fileData, result: null };

  container.innerHTML = `
    <div class="view viewer-view" id="viewer-view">
      <div class="viewer-toolbar" id="viewer-toolbar">
        <div class="toolbar-left">
          <button class="btn btn-icon" id="viewer-back-btn" aria-label="Go back" title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div class="toolbar-file-info">
            <span class="toolbar-filename" title="${docMeta.name}">${truncateName(docMeta.name, 28)}</span>
            <span class="badge badge-${docMeta.format}">${docMeta.label || docMeta.format.toUpperCase()}</span>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-icon" id="viewer-ocr-btn" aria-label="OCR Scanned Document" title="OCR Scan" style="display:none;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </button>
          <button class="btn btn-icon" id="viewer-edit-btn" aria-label="Edit document" title="Edit" style="display:none;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-icon" id="viewer-convert-btn" aria-label="Convert document" title="Convert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
              <line x1="4" y1="4" x2="9" y2="9"/>
            </svg>
          </button>
          <button class="btn btn-icon" id="viewer-download-btn" aria-label="Download" title="Download original">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="viewer-content" id="viewer-content">
        <div class="viewer-loading">
          <div class="skeleton skeleton-block"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text" style="width: 70%"></div>
        </div>
      </div>
    </div>
  `;

  bindViewerEvents(container, app, docMeta, fileData);

  // Render document
  const viewerContent = container.querySelector('#viewer-content');
  try {
    const result = await routeDocument(docMeta, fileData, viewerContent);
    currentDoc.result = result;

    // Show edit button if document is editable
    if (result.editable) {
      const editBtn = container.querySelector('#viewer-edit-btn');
      if (editBtn) editBtn.style.display = '';
    }

    // Show OCR button for PDF documents
    if (docMeta.format === 'pdf') {
      const ocrBtn = container.querySelector('#viewer-ocr-btn');
      if (ocrBtn) ocrBtn.style.display = '';
    }
  } catch (err) {
    console.error('Failed to render document:', err);
    viewerContent.innerHTML = `
      <div class="empty-state">
        <h2 class="empty-state-title">Rendering Failed</h2>
        <p class="empty-state-subtitle">${err.message || 'An unexpected error occurred while opening this document.'}</p>
      </div>
    `;
    showToast('Failed to render document', 'error');
  }
}

/**
 * Binds viewer toolbar events.
 * @param {HTMLElement} container - View container.
 * @param {Object} app - App controller.
 * @param {Object} docMeta - Document metadata.
 * @param {ArrayBuffer} fileData - Raw file data.
 */
function bindViewerEvents(container, app, docMeta, fileData) {
  // Back button
  container.querySelector('#viewer-back-btn')?.addEventListener('click', () => {
    app.navigate('home');
  });

  // OCR button
  container.querySelector('#viewer-ocr-btn')?.addEventListener('click', async () => {
    showToast('Starting Scanned PDF OCR...', 'info', 3000);
    try {
      const { ocrPdfDocument } = await import('../services/pdf-service.js');
      const ocrText = await ocrPdfDocument(fileData, 'eng', (p) => {
        showToast(p.status, 'info', 1500);
      });
      if (!ocrText) {
        showToast('No text detected in PDF pages.', 'warning');
        return;
      }
      showToast('OCR scan completed! Opening editor...', 'success');
      const textDocMeta = {
        ...docMeta,
        name: docMeta.name.replace(/\.pdf$/i, '') + '_ocr.txt',
        format: 'txt',
      };
      app.editDocument(textDocMeta, new TextEncoder().encode(ocrText).buffer, { type: 'text', content: ocrText });
    } catch (ocrErr) {
      console.error('PDF OCR Error:', ocrErr);
      showToast('OCR failed: ' + ocrErr.message, 'error');
    }
  });

  // Edit button
  container.querySelector('#viewer-edit-btn')?.addEventListener('click', () => {
    app.editDocument(docMeta, fileData, currentDoc?.result);
  });

  // Convert button
  container.querySelector('#viewer-convert-btn')?.addEventListener('click', () => {
    app.navigateToConvert(docMeta, fileData);
  });

  // Download original
  container.querySelector('#viewer-download-btn')?.addEventListener('click', () => {
    downloadOriginal(docMeta, fileData);
  });

  // Auto-hide toolbar on scroll
  const viewerContent = container.querySelector('#viewer-content');
  const toolbar = container.querySelector('#viewer-toolbar');
  let lastScrollTop = 0;

  if (viewerContent && toolbar) {
    viewerContent.addEventListener('scroll', () => {
      const scrollTop = viewerContent.scrollTop;
      if (scrollTop > lastScrollTop && scrollTop > 60) {
        toolbar.classList.add('toolbar-hidden');
      } else {
        toolbar.classList.remove('toolbar-hidden');
      }
      lastScrollTop = scrollTop;
    });

    // Tap to toggle toolbar
    viewerContent.addEventListener('click', (e) => {
      if (e.target === viewerContent || e.target.closest('.viewer-content')) {
        toolbar.classList.toggle('toolbar-hidden');
      }
    });
  }
}

/**
 * Downloads the original file.
 * @param {Object} docMeta - Document metadata.
 * @param {ArrayBuffer} fileData - Raw file data.
 */
function downloadOriginal(docMeta, fileData) {
  const blob = new Blob([fileData], { type: docMeta.type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = docMeta.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Download started', 'success');
}

/**
 * Truncates a filename for display.
 * @param {string} name - File name.
 * @param {number} maxLen - Maximum length.
 * @returns {string} Truncated name.
 */
function truncateName(name, maxLen) {
  if (name.length <= maxLen) return name;
  const ext = name.split('.').pop();
  const base = name.substring(0, maxLen - ext.length - 4);
  return `${base}...${ext}`;
}
