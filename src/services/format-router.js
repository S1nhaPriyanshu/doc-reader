/**
 * Format router — detects file type and dispatches to the correct service.
 * Dynamically imports services to keep initial bundle small.
 * @module services/format-router
 */

/**
 * Routes a document to the appropriate rendering service.
 * Returns rendered HTML content or a canvas element.
 * @param {Object} docMeta - Document metadata with format, name, etc.
 * @param {ArrayBuffer} fileData - Raw file data.
 * @param {HTMLElement} container - Container to render content into.
 * @returns {Promise<Object>} Result object { type: 'html'|'canvas'|'custom', content, editable }.
 */
export async function routeDocument(docMeta, fileData, container) {
  switch (docMeta.format) {
    case 'pdf': {
      const { renderPdf } = await import('./pdf-service.js');
      return renderPdf(fileData, container, docMeta);
    }
    case 'docx':
    case 'doc': {
      const { renderDocx } = await import('./docx-service.js');
      return renderDocx(fileData, container, docMeta);
    }
    case 'txt': {
      const { renderText } = await import('./text-service.js');
      return renderText(fileData, container, docMeta);
    }
    case 'md': {
      const { renderMarkdown } = await import('./text-service.js');
      return renderMarkdown(fileData, container, docMeta);
    }
    case 'xlsx':
    case 'xls':
    case 'csv': {
      const { renderSpreadsheet } = await import('./spreadsheet-service.js');
      return renderSpreadsheet(fileData, container, docMeta);
    }
    case 'epub': {
      const { renderEpub } = await import('./epub-service.js');
      return renderEpub(fileData, container, docMeta);
    }
    case 'html':
    case 'htm': {
      const { default: DOMPurify } = await import('dompurify');
      const text = new TextDecoder('utf-8').decode(fileData);
      const clean = DOMPurify.sanitize(text, { WHOLE_DOCUMENT: false });
      const wrapper = document.createElement('div');
      wrapper.className = 'html-content';
      wrapper.innerHTML = clean;
      container.innerHTML = '';
      container.appendChild(wrapper);
      return { type: 'html', content: clean, raw: text, editable: true };
    }
    case 'json': {
      const { renderJson } = await import('./json-service.js');
      return renderJson(fileData, container, docMeta);
    }
    case 'rtf': {
      const { renderRtf } = await import('./rtf-service.js');
      return renderRtf(fileData, container, docMeta);
    }
    case 'img': {
      const { renderImage } = await import('./ocr-service.js');
      return renderImage(fileData, container, docMeta);
    }
    default:
      container.innerHTML = `
        <div class="empty-state">
          <h2 class="empty-state-title">Unsupported Format</h2>
          <p class="empty-state-subtitle">The format "${docMeta.format}" is not yet supported.</p>
        </div>
      `;
      return { type: 'error', content: null, editable: false };
  }
}

/**
 * Returns the list of formats a given source format can convert to.
 * @param {string} sourceFormat - Source format identifier.
 * @returns {Array<{format: string, label: string}>} Available target formats.
 */
export function getConversionTargets(sourceFormat) {
  const matrix = {
    pdf:  ['txt', 'md', 'docx', 'html', 'img', 'zip'],
    docx: ['pdf', 'txt', 'md', 'html'],
    doc:  ['pdf', 'txt', 'md', 'html'],
    txt:  ['pdf', 'docx', 'md', 'html'],
    md:   ['pdf', 'docx', 'txt', 'html'],
    html: ['pdf', 'docx', 'md', 'txt'],
    epub: ['txt', 'md', 'html', 'docx', 'pdf'],
    rtf:  ['html', 'txt', 'md', 'docx', 'pdf'],
    xlsx: ['csv', 'tsv', 'json', 'html', 'pdf'],
    xls:  ['csv', 'tsv', 'json', 'html', 'pdf'],
    csv:  ['xlsx', 'tsv', 'json', 'html', 'pdf'],
    tsv:  ['xlsx', 'csv', 'json', 'html', 'pdf'],
    json: ['csv', 'xlsx', 'html', 'txt', 'pdf'],
    img:  ['png', 'jpg', 'webp', 'pdf', 'txt', 'docx'],
  };

  const targets = matrix[sourceFormat] || [];
  const labels = {
    pdf: 'PDF Document',
    docx: 'Word (DOCX)',
    doc: 'Word (DOCX)',
    txt: 'Plain Text (TXT)',
    md: 'Markdown (MD)',
    html: 'HTML Webpage',
    epub: 'EPUB E-book',
    rtf: 'Rich Text (RTF)',
    xlsx: 'Excel (XLSX)',
    csv: 'CSV Spreadsheet',
    tsv: 'TSV Spreadsheet',
    json: 'JSON Data',
    img: 'Image File',
    png: 'PNG Image',
    jpg: 'JPEG Image',
    webp: 'WebP Image',
    zip: 'ZIP (All Pages)',
  };

  return targets.map((f) => ({ format: f, label: labels[f] || f.toUpperCase() }));
}
