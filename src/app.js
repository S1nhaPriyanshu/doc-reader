/**
 * App controller — manages views, navigation, and document lifecycle.
 * @module app
 */
import { renderHome } from './views/home.js';
import { renderOpen } from './views/open.js';
import { renderViewer } from './views/viewer.js';
import { saveRecentDocument } from './utils/storage.js';
import { showToast } from './components/toast.js';

/**
 * Main application controller.
 * Handles view routing, navigation state, and document opening flow.
 */
export class App {
  constructor() {
    /** @type {string} Current active view name */
    this.currentView = 'home';
    /** @type {HTMLElement} Main content container */
    this.contentEl = null;
    /** @type {Object|null} Currently open document metadata */
    this.currentDocMeta = null;
    /** @type {ArrayBuffer|null} Currently open document data */
    this.currentDocData = null;
  }

  /**
   * Initialises the application — renders default view and binds nav events.
   */
  init() {
    this.contentEl = document.getElementById('app-content');
    this.bindNavigation();
    this.navigate('home');
  }

  /**
   * Binds bottom navigation tab click events.
   */
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) this.navigate(view);
      });
    });
  }

  /**
   * Navigates to a named view.
   * @param {string} viewName - The view to navigate to (home, open, convert, viewer, editor).
   */
  async navigate(viewName) {
    this.currentView = viewName;
    this.updateNavActive(viewName);
    this.contentEl.classList.add('view-exit');

    // Small delay for exit animation
    await new Promise((r) => setTimeout(r, 100));
    this.contentEl.classList.remove('view-exit');

    switch (viewName) {
      case 'home':
        this.showNav();
        await renderHome(this.contentEl, this);
        break;
      case 'open':
        this.showNav();
        renderOpen(this.contentEl, this);
        break;
      case 'convert':
        this.showNav();
        await this.renderConvertView();
        break;
      case 'viewer':
        // Handled via openDocument method
        break;
      case 'editor':
        // Handled via editDocument method
        break;
      default:
        await renderHome(this.contentEl, this);
    }
  }

  /**
   * Opens a document in the viewer.
   * @param {Object} docMeta - Document metadata.
   * @param {ArrayBuffer} fileData - Raw file data.
   */
  async openDocument(docMeta, fileData) {
    this.currentDocMeta = docMeta;
    this.currentDocData = fileData;
    this.currentView = 'viewer';
    this.hideNav();
    this.updateNavActive('');

    // Save to recent
    try {
      await saveRecentDocument(docMeta, fileData);
    } catch (err) {
      console.warn('Failed to save to recent:', err);
    }

    await renderViewer(this.contentEl, this, docMeta, fileData);
  }

  /**
   * Opens the editor for a document.
   * @param {Object} docMeta - Document metadata.
   * @param {ArrayBuffer} fileData - Raw file data.
   * @param {Object} renderResult - Previous render result with content.
   */
  async editDocument(docMeta, fileData, renderResult) {
    this.currentView = 'editor';
    this.hideNav();

    try {
      const { renderEditor } = await import('./views/editor.js');
      await renderEditor(this.contentEl, this, docMeta, fileData, renderResult);
    } catch (err) {
      console.error('Failed to load editor:', err);
      showToast('Editor failed to load', 'error');
    }
  }

  /**
   * Navigates to converter with a pre-selected source document.
   * @param {Object} docMeta - Document metadata.
   * @param {ArrayBuffer} fileData - Raw file data.
   */
  async navigateToConvert(docMeta, fileData) {
    this.currentDocMeta = docMeta;
    this.currentDocData = fileData;
    this.currentView = 'convert';
    this.hideNav();

    try {
      const { renderConverter } = await import('./views/converter.js');
      await renderConverter(this.contentEl, this, docMeta, fileData);
    } catch (err) {
      console.error('Failed to load converter:', err);
      showToast('Converter failed to load', 'error');
    }
  }

  /**
   * Renders the convert view (without a pre-selected document).
   */
  async renderConvertView() {
    if (this.currentDocMeta && this.currentDocData) {
      try {
        const { renderConverter } = await import('./views/converter.js');
        await renderConverter(this.contentEl, this, this.currentDocMeta, this.currentDocData);
      } catch (err) {
        console.error('Failed to load converter:', err);
        showToast('Converter failed to load', 'error');
      }
    } else {
      this.contentEl.innerHTML = `
        <div class="view convert-view">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
                <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
                <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
                <line x1="4" y1="4" x2="9" y2="9"/>
              </svg>
            </div>
            <h2 class="empty-state-title">No Document Selected</h2>
            <p class="empty-state-subtitle">Open a document first, then you can convert it to another format.</p>
            <button class="btn btn-primary" id="convert-open-btn">
              Open a Document
            </button>
          </div>
        </div>
      `;

      this.contentEl.querySelector('#convert-open-btn')?.addEventListener('click', () => {
        this.navigate('open');
      });
    }
  }

  /**
   * Updates the active state of bottom navigation items.
   * @param {string} viewName - Active view name.
   */
  updateNavActive(viewName) {
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
  }

  /**
   * Hides the bottom navigation bar.
   */
  hideNav() {
    const nav = document.getElementById('bottom-nav');
    const header = document.getElementById('app-header');
    if (nav) nav.classList.add('nav-hidden');
    if (header) header.classList.add('header-hidden');
  }

  /**
   * Shows the bottom navigation bar.
   */
  showNav() {
    const nav = document.getElementById('bottom-nav');
    const header = document.getElementById('app-header');
    if (nav) nav.classList.remove('nav-hidden');
    if (header) header.classList.remove('header-hidden');
  }
}
