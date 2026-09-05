import MarkdownIt from 'markdown-it';

/**
 * Renders plain text into a container.
 * @param {ArrayBuffer} fileData - The text file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderText(fileData, container, docMeta) {
  try {
    const decoder = new TextDecoder('utf-8');
    const textString = decoder.decode(fileData);
    
    const pre = document.createElement('pre');
    pre.className = 'text-content';
    pre.textContent = textString;
    
    container.innerHTML = '';
    container.appendChild(pre);
    
    return { type: 'text', content: textString, editable: true };
  } catch (error) {
    console.error('Error rendering text:', error);
    throw error;
  }
}

/**
 * Renders Markdown text into a container.
 * @param {ArrayBuffer} fileData - The Markdown file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderMarkdown(fileData, container, docMeta) {
  try {
    const decoder = new TextDecoder('utf-8');
    const mdString = decoder.decode(fileData);
    
    const md = new MarkdownIt();
    const htmlString = md.render(mdString);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'html-content markdown-content';
    wrapper.innerHTML = htmlString;
    
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    return { type: 'markdown', content: { raw: mdString, html: htmlString }, editable: true };
  } catch (error) {
    console.error('Error rendering markdown:', error);
    throw error;
  }
}
