import * as XLSX from 'xlsx';

/**
 * Renders a spreadsheet document into a container.
 * @param {ArrayBuffer} fileData - The spreadsheet file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderSpreadsheet(fileData, container, docMeta) {
  try {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const sheetNames = workbook.SheetNames;
    
    if (sheetNames.length === 0) {
      throw new Error('No sheets found in workbook');
    }
    
    const firstSheetName = sheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    
    const htmlString = XLSX.utils.sheet_to_html(sheet);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'spreadsheet-wrapper';
    wrapper.style.overflowX = 'auto';
    
    const tableContainer = document.createElement('div');
    tableContainer.className = 'spreadsheet-table';
    tableContainer.innerHTML = htmlString;
    
    wrapper.appendChild(tableContainer);
    
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    if (sheetNames.length > 1) {
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'spreadsheet-tabs';
      tabsContainer.style.marginTop = '10px';
      
      sheetNames.forEach(name => {
        const tab = document.createElement('button');
        tab.textContent = name;
        tab.style.marginRight = '5px';
        tabsContainer.appendChild(tab);
      });
      
      container.appendChild(tabsContainer);
    }
    
    return { type: 'spreadsheet', content: workbook, editable: true, sheetNames };
  } catch (error) {
    console.error('Error rendering spreadsheet:', error);
    throw error;
  }
}
