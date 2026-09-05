import mammoth from 'mammoth';

/**
 * Renders a DOCX document into a container.
 * @param {ArrayBuffer} fileData - The DOCX file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderDocx(fileData, container, docMeta) {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: fileData });
    if (result.messages && result.messages.length > 0) {
      console.warn('Mammoth warnings:', result.messages);
    }
    
    const htmlString = result.value;
    const wrapper = document.createElement('div');
    wrapper.className = 'html-content';
    
    // Basic sanitization by using a detached div
    const sanitizer = document.createElement('div');
    sanitizer.innerHTML = htmlString;
    
    // Remove script tags to avoid arbitrary execution
    const scripts = sanitizer.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    wrapper.appendChild(sanitizer);
    
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    return { type: 'html', content: htmlString, editable: true };
  } catch (error) {
    console.error('Error rendering DOCX:', error);
    throw error;
  }
}

/**
 * Extracts plain text from a DOCX document.
 * @param {ArrayBuffer} fileData - The DOCX file data.
 * @returns {Promise<string>} The extracted plain text.
 */
export async function extractDocxText(fileData) {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: fileData });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw error;
  }
}
