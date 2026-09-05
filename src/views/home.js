/**
 * Home view — modern high-craft dashboard with quick actions and recent documents.
 * @module views/home
 */
import { getRecentDocuments, removeRecentDocument, getCachedFileData } from '../utils/storage.js';
import { formatFileSize } from '../utils/file-utils.js';

/**
 * Renders the home view into the given container.
 * @param {HTMLElement} container - The container to render into.
 * @param {Object} app - App controller reference for navigation.
 */
export async function renderHome(container, app) {
  const recentDocs = await getRecentDocuments();

  container.innerHTML = `
    <div class="view home-view" id="home-view">
      <!-- High-Craft Hero Header -->
      <section class="home-hero">
        <div class="home-hero-badge">
          <span class="hero-pill">
            <span class="pulse-dot"></span>
            100% Client-Side • Zero Cloud Upload
          </span>
        </div>
        <h2 class="home-hero-title">Read, Edit & Convert Any Document</h2>
        <p class="home-hero-subtitle">
          Next-generation document reader for mobile & web. Fast, private, and offline-ready with neural OCR.
        </p>
      </section>

      <!-- Bento Quick Action Grid -->
      <section class="home-bento-grid">
        <div class="card bento-card" id="bento-open-btn" role="button" tabindex="0">
          <div class="bento-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div class="bento-card-content">
            <h3 class="bento-title">Open Document</h3>
            <p class="bento-desc">Drop or browse PDF, DOCX, XLSX, EPUB, RTF, JSON, or images.</p>
          </div>
          <div class="bento-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        <div class="card bento-card" id="bento-convert-btn" role="button" tabindex="0">
          <div class="bento-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
              <line x1="4" y1="4" x2="9" y2="9"/>
            </svg>
          </div>
          <div class="bento-card-content">
            <h3 class="bento-title">Universal Converter</h3>
            <p class="bento-desc">Convert between 11+ document, spreadsheet, and image formats.</p>
          </div>
          <div class="bento-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </section>

      <!-- Format Capability Pills -->
      <div class="home-formats-row">
        <span class="badge badge-pdf">PDF</span>
        <span class="badge badge-docx">DOCX</span>
        <span class="badge badge-xlsx">XLSX</span>
        <span class="badge badge-csv">CSV</span>
        <span class="badge badge-epub">EPUB</span>
        <span class="badge badge-md">MARKDOWN</span>
        <span class="badge badge-html">HTML</span>
        <span class="badge badge-json">JSON</span>
        <span class="badge badge-rtf">RTF</span>
        <span class="badge badge-img">OCR IMAGE</span>
      </div>

      <!-- Recent Documents Section -->
      <section class="home-recents-section">
        <div class="section-header-row">
          <h3 class="section-title">Recent Documents</h3>
          <span class="section-badge">${recentDocs.length} file${recentDocs.length !== 1 ? 's' : ''}</span>
        </div>

        ${recentDocs.length > 0 ? `
          <div class="recent-list">
            ${recentDocs.map((doc) => renderRecentCard(doc)).join('')}
          </div>
        ` : `
          <div class="card empty-recent-card">
            <p class="empty-recent-text">No recently opened files. Tap <strong>Open Document</strong> above to begin.</p>
          </div>
        `}
      </section>
    </div>
  `;

  bindHomeEvents(container, app);
}

/**
 * Renders a single recent document card.
 * @param {Object} doc - Document metadata.
 * @returns {string} HTML string.
 */
function renderRecentCard(doc) {
  const timeAgo = getRelativeTime(doc.lastOpened);
  return `
    <div class="card recent-card" data-doc-id="${doc.id}" role="button" tabindex="0">
      <div class="recent-card-icon">
        <span class="badge badge-${doc.format}">${doc.format.toUpperCase()}</span>
      </div>
      <div class="recent-card-info">
        <h4 class="recent-card-name" title="${doc.name}">${doc.name}</h4>
        <p class="recent-card-meta">
          <span>${formatFileSize(doc.size)}</span>
          <span class="meta-dot">·</span>
          <span>${timeAgo}</span>
        </p>
      </div>
      <button class="btn btn-icon recent-card-remove" data-remove-id="${doc.id}" aria-label="Remove from recent" title="Remove">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

/**
 * Binds click events on home view elements.
 * @param {HTMLElement} container - The view container.
 * @param {Object} app - App controller.
 */
function bindHomeEvents(container, app) {
  // Bento button: Open
  container.querySelector('#bento-open-btn')?.addEventListener('click', () => {
    app.navigate('open');
  });

  // Bento button: Convert
  container.querySelector('#bento-convert-btn')?.addEventListener('click', () => {
    app.navigate('open');
  });

  // Recent document cards — open on click
  container.querySelectorAll('.recent-card').forEach((card) => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.recent-card-remove')) return;
      const docId = card.dataset.docId;
      const fileData = await getCachedFileData(docId);
      if (fileData) {
        const docs = await getRecentDocuments();
        const meta = docs.find((d) => d.id === docId);
        if (meta) {
          app.openDocument(meta, fileData);
        }
      }
    });
  });

  // Remove buttons
  container.querySelectorAll('.recent-card-remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.removeId;
      await removeRecentDocument(id);
      renderHome(container, app);
    });
  });
}

/**
 * Returns a human-readable relative time string.
 * @param {number} timestamp - Unix timestamp in ms.
 * @returns {string} Relative time.
 */
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
