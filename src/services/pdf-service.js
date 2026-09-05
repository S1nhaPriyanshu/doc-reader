import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

/**
 * Renders a PDF document into a container.
 * @param {ArrayBuffer} fileData - The PDF file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderPdf(fileData, container, docMeta) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: fileData });
    const pdfDoc = await loadingTask.promise;
    
    const viewer = document.createElement('div');
    viewer.className = 'pdf-viewer';
    viewer.style.overflow = 'auto';
    viewer.style.height = '100%';
    
    const pageCount = pdfDoc.numPages;
    const containerWidth = container.clientWidth || window.innerWidth;
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 });
      
      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page';
      pageContainer.style.marginBottom = '20px';
      pageContainer.style.position = 'relative';
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      const label = document.createElement('div');
      label.textContent = `Page ${pageNum}`;
      label.style.textAlign = 'center';
      label.style.marginTop = '5px';
      label.style.fontSize = '12px';
      
      pageContainer.appendChild(canvas);
      pageContainer.appendChild(label);
      viewer.appendChild(pageContainer);
    }
    
    container.innerHTML = '';
    container.appendChild(viewer);
    
    return { type: 'pdf', content: pdfDoc, editable: false, pageCount };
  } catch (error) {
    console.error('Error rendering PDF:', error);
    throw error;
  }
}

/**
 * Extracts text from a PDF document.
 * @param {ArrayBuffer} fileData - The PDF file data.
 * @returns {Promise<string>} The extracted text.
 */
export async function extractPdfText(fileData) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: fileData });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n--- Page ' + pageNum + ' ---\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Runs OCR across all pages of a scanned PDF document.
 * @param {ArrayBuffer} fileData - The PDF file data.
 * @param {string} [language='eng'] - Target language code.
 * @param {Function} [onProgress] - Optional progress callback ({ current, total, status }).
 * @returns {Promise<string>} Combined OCR text from all pages.
 */
export async function ocrPdfDocument(fileData, language = 'eng', onProgress = null) {
  try {
    const { createWorker } = await import('tesseract.js');
    const { preprocessImage } = await import('../utils/image-preprocessor.js');

    const loadingTask = pdfjsLib.getDocument({ data: fileData });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    if (onProgress) onProgress({ current: 0, total: pageCount, status: `Loading ${language.toUpperCase()} OCR worker...` });

    const worker = await createWorker(language, 1);
    let fullOcrText = '';

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (onProgress) onProgress({ current: pageNum, total: pageCount, status: `Scanning Page ${pageNum} of ${pageCount}...` });

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High-res 2x
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Preprocess canvas with Otsu binarization and contrast stretch
      const preprocessed = preprocessImage(canvas, {
        enhanceContrast: true,
        binarize: true,
        sharpen: true,
      });

      const result = await worker.recognize(preprocessed.canvas);
      const pageText = result.data?.text || '';

      fullOcrText += `\n\n--- Page ${pageNum} ---\n\n` + pageText;

      canvas.width = 0;
      canvas.height = 0;
    }

    await worker.terminate();

    if (onProgress) onProgress({ current: pageCount, total: pageCount, status: 'Completed OCR scan!' });
    return fullOcrText.trim();
  } catch (error) {
    console.error('Error running OCR on PDF:', error);
    throw error;
  }
}
