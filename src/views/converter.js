/**
 * Converter view — UI for converting documents between formats.
 * @module views/converter
 */
import { getConversionTargets } from '../services/format-router.js';
import { formatFileSize } from '../utils/file-utils.js';
import { showToast } from '../components/toast.js';

/**
 * Renders the document converter view.
 * @param {HTMLElement} container - The container element to render in.
 * @param {Object} app - The main application instance.
 * @param {Object} docMeta - Metadata about the document.
 * @param {ArrayBuffer} fileData - The raw file data.
 */
export function renderConverter(container, app, docMeta, fileData) {
  const targets = getConversionTargets(docMeta.format) || [];

  const targetCards = targets.map((t) => `
    <button class="card convert-target-card" data-format="${t.format}">
      <div class="convert-target-badge">
        <span class="badge badge-${t.format}">${t.format.toUpperCase()}</span>
      </div>
      <span class="convert-target-label">${t.label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
  `).join('');

  container.innerHTML = `
    <div class="view converter-view" id="converter-view">
      <div class="viewer-toolbar" id="converter-toolbar">
        <div class="toolbar-left">
          <button class="btn btn-icon" id="converter-back-btn" aria-label="Go back" title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <span class="toolbar-filename">Convert Document</span>
        </div>
      </div>

      <div class="converter-content">
        <div class="card converter-source-card">
          <div class="converter-source-icon">
            <span class="badge badge-${docMeta.format}">${(docMeta.label || docMeta.format).toUpperCase()}</span>
          </div>
          <div class="converter-source-info">
            <h3 class="converter-source-name" title="${docMeta.name}">${docMeta.name}</h3>
            <p class="converter-source-meta">${formatFileSize(docMeta.size)}</p>
          </div>
        </div>

        <div class="converter-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>

        ${targets.length > 0 ? `
          <div class="convert-targets-header">
            <h3 class="section-title">Available Target Formats</h3>
            <p class="section-subtitle">Select the format you want to export your file to</p>
          </div>
          <div class="convert-targets-grid">
            ${targetCards}
          </div>
        ` : `
          <div class="empty-state">
            <h2 class="empty-state-title">No Conversions Available</h2>
            <p class="empty-state-subtitle">This format cannot be converted to other formats yet.</p>
          </div>
        `}
      </div>

      <!-- Progress overlay -->
      <div class="convert-progress-overlay" id="convert-progress" style="display:none;">
        <div class="convert-progress-content">
          <div class="spinner"></div>
          <p class="convert-progress-msg" id="convert-progress-msg">Converting...</p>
        </div>
      </div>
    </div>
  `;

  // Bind events
  container.querySelector('#converter-back-btn')?.addEventListener('click', () => {
    app.navigate('home');
  });

  container.querySelectorAll('.convert-target-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const targetFormat = card.dataset.format;
      const overlay = container.querySelector('#convert-progress');
      const msg = container.querySelector('#convert-progress-msg');

      overlay.style.display = 'flex';
      msg.textContent = `Converting to ${targetFormat.toUpperCase()}... Please wait.`;

      try {
        const { convertDocument } = await import('../services/converter-service.js');
        const result = await convertDocument(docMeta, fileData, targetFormat);

        // Download result
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Converted to ${targetFormat.toUpperCase()} successfully!`, 'success');
      } catch (err) {
        console.error('Conversion error:', err);
        showToast(`Conversion failed: ${err.message}`, 'error');
      } finally {
        overlay.style.display = 'none';
      }
    });
  });
}
