/**
 * Editor view — WYSIWYG editing using Quill.js.
 * Supports editing DOCX, TXT, and Markdown content with export capabilities.
 * @module views/editor
 */
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { showToast } from '../components/toast.js';

/**
 * Renders the editor view with Quill.js WYSIWYG editor.
 * @param {HTMLElement} container - The container element to render in.
 * @param {Object} app - The main application instance.
 * @param {Object} docMeta - Metadata about the document.
 * @param {ArrayBuffer} fileData - The raw file data.
 * @param {Object} renderResult - The result from the document renderer.
 */
export function renderEditor(container, app, docMeta, fileData, renderResult) {
  container.innerHTML = `
    <div class="view editor-view" id="editor-view">
      <div class="viewer-toolbar" id="editor-toolbar">
        <div class="toolbar-left">
          <button class="btn btn-icon" id="editor-back-btn" aria-label="Go back" title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div class="toolbar-file-info">
            <span class="toolbar-filename">Editing: ${docMeta.name}</span>
            <span class="badge badge-${docMeta.format}">${docMeta.format.toUpperCase()}</span>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary btn-sm" id="editor-save-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2 2h11l5 5v11z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
          </button>
          <div class="export-dropdown-wrapper" style="position:relative;">
            <button class="btn btn-secondary btn-sm" id="editor-export-btn">
              Export ▾
            </button>
            <div class="dropdown" id="editor-export-menu" style="display:none;">
              <button class="dropdown-item" data-export="pdf">Export as PDF</button>
              <button class="dropdown-item" data-export="docx">Export as DOCX</button>
              <button class="dropdown-item" data-export="md">Export as Markdown</button>
              <button class="dropdown-item" data-export="txt">Export as TXT</button>
              <button class="dropdown-item" data-export="html">Export as HTML</button>
            </div>
          </div>
        </div>
      </div>

      <div class="editor-container" id="editor-quill-container">
        <div id="editor-quill"></div>
      </div>
    </div>
  `;

  // Initialize Quill
  const quill = new Quill('#editor-quill', {
    theme: 'snow',
    placeholder: 'Start editing your document...',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean'],
      ],
    },
  });

  // Load content from render result
  if (renderResult) {
    if (renderResult.type === 'html' || renderResult.type === 'markdown') {
      const html = typeof renderResult.content === 'object'
        ? renderResult.content.html || ''
        : renderResult.content || '';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      quill.root.innerHTML = tempDiv.innerHTML;
    } else if (renderResult.type === 'text') {
      quill.setText(renderResult.content || '');
    }
  }

  // Back button
  container.querySelector('#editor-back-btn')?.addEventListener('click', () => {
    app.openDocument(docMeta, fileData);
  });

  // Save button — downloads in original format
  container.querySelector('#editor-save-btn')?.addEventListener('click', () => {
    try {
      const ext = docMeta.name.split('.').pop().toLowerCase();
      let blob;
      let filename = `edited_${docMeta.name}`;

      if (ext === 'txt' || ext === 'md') {
        blob = new Blob([quill.getText()], { type: 'text/plain' });
      } else {
        blob = new Blob([quill.root.innerHTML], { type: 'text/html' });
        filename = filename.replace(/\.\w+$/, '.html');
      }

      downloadBlob(blob, filename);
      showToast('Document saved!', 'success');
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save document', 'error');
    }
  });

  // Export dropdown toggle
  const exportBtn = container.querySelector('#editor-export-btn');
  const exportMenu = container.querySelector('#editor-export-menu');

  exportBtn?.addEventListener('click', () => {
    exportMenu.style.display = exportMenu.style.display === 'none' ? 'flex' : 'none';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-dropdown-wrapper')) {
      exportMenu.style.display = 'none';
    }
  });

  // Export actions
  container.querySelectorAll('.dropdown-item[data-export]').forEach((item) => {
    item.addEventListener('click', async () => {
      const format = item.dataset.export;
      exportMenu.style.display = 'none';

      try {
        showToast(`Exporting as ${format.toUpperCase()}...`, 'info', 2000);

        const { convertDocument } = await import('../services/converter-service.js');
        const html = quill.root.innerHTML;
        const htmlBuffer = new TextEncoder().encode(html).buffer;
        const tempMeta = { ...docMeta, format: 'html' };

        const result = await convertDocument(tempMeta, htmlBuffer, format);
        downloadBlob(result.blob, result.fileName);
        showToast(`Exported as ${format.toUpperCase()}!`, 'success');
      } catch (err) {
        console.error('Export error:', err);
        showToast(`Export failed: ${err.message}`, 'error');
      }
    });
  });
}

/**
 * Downloads a Blob as a file.
 * @param {Blob} blob - The blob to download.
 * @param {string} filename - The filename for the download.
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
