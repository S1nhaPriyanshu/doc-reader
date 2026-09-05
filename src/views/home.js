/**
 * Home view — displays recent documents and a welcome state.
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

  if (recentDocs.length === 0) {
    container.innerHTML = renderEmptyState();
  } else {
    container.innerHTML = renderRecentList(recentDocs);
  }

  // Bind events
  bindHomeEvents(container, app);
}

/**
 * Renders the empty state when no documents have been opened.
 * @returns {string} HTML string.
 */
function renderEmptyState() {
  return `
    <div class="view home-view" id="home-view">
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <h2 class="empty-state-title">No Documents Yet</h2>
        <p class="empty-state-subtitle">Open a file to start reading, editing, or converting your documents.</p>
        <button class="btn btn-primary" id="empty-open-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Open a Document
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the recent documents list.
 * @param {Array<Object>} docs - Recent document metadata.
 * @returns {string} HTML string.
 */
function renderRecentList(docs) {
  const cards = docs.map((doc) => {
    const timeAgo = getRelativeTime(doc.lastOpened);
    return `
      <div class="card recent-card" data-doc-id="${doc.id}" role="button" tabindex="0">
        <div class="recent-card-icon">
          <span class="badge badge-${doc.format}">${doc.format.toUpperCase()}</span>
        </div>
        <div class="recent-card-info">
          <h3 class="recent-card-name" title="${doc.name}">${doc.name}</h3>
          <p class="recent-card-meta">
            <span>${formatFileSize(doc.size)}</span>
            <span class="meta-dot">·</span>
            <span>${timeAgo}</span>
          </p>
        </div>
        <button class="btn btn-icon recent-card-remove" data-remove-id="${doc.id}" aria-label="Remove from recent" title="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="view home-view" id="home-view">
      <div class="home-header">
        <h2 class="section-title">Recent Documents</h2>
        <p class="section-subtitle">${docs.length} document${docs.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="recent-list">
        ${cards}
      </div>
    </div>
  `;
}

/**
 * Binds click events on home view elements.
 * @param {HTMLElement} container - The view container.
 * @param {Object} app - App controller.
 */
function bindHomeEvents(container, app) {
  // "Open a Document" button in empty state
  const openBtn = container.querySelector('#empty-open-btn');
  if (openBtn) {
    openBtn.addEventListener('click', () => app.navigate('open'));
  }

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
 * @returns {string} Relative time (e.g. "2 hours ago").
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
