import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

import { cloneBuffer } from '../utils/file-utils.js';
export { cloneBuffer };

/**
 * Renders a PDF document into a container.
 * @param {ArrayBuffer} fileData - The PDF file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Metadata about the document.
 * @returns {Promise<Object>} An object containing the document details.
 */
export async function renderPdf(fileData, container, docMeta) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: cloneBuffer(fileData) });
    const pdfDoc = await loadingTask.promise;

    const viewer = document.createElement('div');
    viewer.className = 'pdf-viewer';

    const pageCount = pdfDoc.numPages;
    const padding = 32;
    const rawWidth = container.clientWidth || window.innerWidth || 800;
    const containerWidth = Math.max(280, rawWidth - padding);

    // Clear initial loading skeleton and mount viewer immediately
    container.innerHTML = '';
    container.appendChild(viewer);

    // Helper to render a specific page onto its canvas
    const renderPageContent = async (pageNum, pageContainer) => {
      if (pageContainer.dataset.rendered === 'true') return;
      pageContainer.dataset.rendered = 'true';

      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Fill background with white paper color before rendering PDF vectors
      if (context) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      const placeholder = pageContainer.querySelector('.pdf-page-placeholder');
      if (placeholder) placeholder.remove();

      pageContainer.insertBefore(canvas, pageContainer.firstChild);
    };

    const initialPagesCount = Math.min(pageCount, 5);
    const hasIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;

    let observer = null;
    if (hasIntersectionObserver && pageCount > initialPagesCount) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target;
            const pNum = parseInt(target.dataset.pageNum, 10);
            if (pNum) {
              renderPageContent(pNum, target);
              observer.unobserve(target);
            }
          }
        });
      }, { rootMargin: '600px' });
    }

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page';
      pageContainer.dataset.pageNum = String(pageNum);
      pageContainer.style.marginBottom = '20px';
      pageContainer.style.position = 'relative';

      const label = document.createElement('div');
      label.className = 'pdf-page-label';
      label.textContent = `Page ${pageNum}`;
      pageContainer.appendChild(label);

      viewer.appendChild(pageContainer);

      if (pageNum <= initialPagesCount || !observer) {
        await renderPageContent(pageNum, pageContainer);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pdf-page-placeholder';
        placeholder.style.height = '400px';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = 'var(--text-muted, #94a3b8)';
        placeholder.style.fontSize = '12px';
        placeholder.textContent = `Loading Page ${pageNum}...`;
        pageContainer.insertBefore(placeholder, label);

        observer.observe(pageContainer);
      }
    }

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
    const loadingTask = pdfjsLib.getDocument({ data: cloneBuffer(fileData) });
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

    const loadingTask = pdfjsLib.getDocument({ data: cloneBuffer(fileData) });
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
