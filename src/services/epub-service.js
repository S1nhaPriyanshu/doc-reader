import ePub from 'epubjs';

/**
 * Renders an EPUB document into a container.
 * @param {ArrayBuffer} fileData - The EPUB file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderEpub(fileData, container, docMeta) {
  try {
    const readerContainer = document.createElement('div');
    readerContainer.className = 'epub-reader';
    readerContainer.style.position = 'relative';
    readerContainer.style.width = '100%';
    readerContainer.style.height = '100%';
    
    container.innerHTML = '';
    container.appendChild(readerContainer);
    
    const book = ePub(fileData);
    
    const rendition = book.renderTo(readerContainer, {
      width: '100%',
      height: '100%',
      spread: 'none'
    });
    
    await rendition.display();
    
    const navContainer = document.createElement('div');
    navContainer.className = 'epub-navigation';
    navContainer.style.display = 'flex';
    navContainer.style.justifyContent = 'space-between';
    navContainer.style.marginTop = '10px';
    
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.onclick = () => rendition.prev();
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => rendition.next();
    
    navContainer.appendChild(prevButton);
    navContainer.appendChild(nextButton);
    
    container.appendChild(navContainer);
    
    return { type: 'epub', content: book, editable: false };
  } catch (error) {
    console.error('Error rendering EPUB:', error);
    throw error;
  }
}
