/**
 * JSON document viewing and handling service.
 * @module services/json-service
 */

/**
 * Renders a JSON document into a container with pretty formatting.
 * If data is an array of objects, renders both table and code view.
 * @param {ArrayBuffer} fileData - The raw JSON data.
 * @param {HTMLElement} container - Container to render into.
 * @param {Object} docMeta - Document metadata.
 * @returns {Promise<Object>} Render result.
 */
export async function renderJson(fileData, container, docMeta) {
  try {
    const text = new TextDecoder('utf-8').decode(fileData);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      throw new Error('Invalid JSON format: ' + parseErr.message);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'json-viewer';

    const isArrayOfObjects = Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null;

    let html = '';

    if (isArrayOfObjects) {
      const keys = Array.from(new Set(parsed.flatMap((item) => Object.keys(item))));
      html += `
        <div class="json-table-preview-header">
          <span class="badge badge-json">DATASET</span>
          <span class="json-summary">${parsed.length} rows, ${keys.length} columns</span>
        </div>
        <div class="spreadsheet-wrapper">
          <div class="spreadsheet-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  ${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${parsed.slice(0, 100).map((row, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    ${keys.map((k) => `<td>${escapeHtml(row[k] !== undefined ? String(row[k]) : '')}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ${parsed.length > 100 ? `<p class="table-note">Showing first 100 rows of ${parsed.length}</p>` : ''}
        <h4 class="json-raw-heading">Raw JSON</h4>
      `;
    }

    const formatted = JSON.stringify(parsed, null, 2);
    html += `<pre class="text-content json-code-content"><code>${escapeHtml(formatted)}</code></pre>`;

    wrapper.innerHTML = html;
    container.innerHTML = '';
    container.appendChild(wrapper);

    return { type: 'json', content: parsed, raw: text, editable: true };
  } catch (error) {
    console.error('Error rendering JSON:', error);
    throw error;
  }
}

/**
 * Escapes HTML characters.
 * @param {string} str - Raw string.
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
