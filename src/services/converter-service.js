/**
 * Universal Converter service — handles multi-format document conversion pipelines.
 * All conversions happen client-side in the browser.
 * @module services/converter-service
 */

/**
 * Converts a document from one format to another.
 * @param {Object} docMeta - Document metadata with format, name, etc.
 * @param {ArrayBuffer} fileData - Raw file data as ArrayBuffer.
 * @param {string} targetFormat - Target format identifier.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
export async function convertDocument(docMeta, fileData, targetFormat) {
  const sourceFormat = docMeta.format;
  const baseName = docMeta.name.substring(0, docMeta.name.lastIndexOf('.')) || docMeta.name;
  const toText = () => new TextDecoder('utf-8').decode(fileData);

  // ==========================================
  // 1. SOURCE: PDF
  // ==========================================
  if (sourceFormat === 'pdf') {
    if (targetFormat === 'txt' || targetFormat === 'md') {
      const { extractPdfText } = await import('./pdf-service.js');
      const text = await extractPdfText(fileData);
      return {
        blob: new Blob([text], { type: 'text/plain' }),
        fileName: `${baseName}.${targetFormat}`,
        mimeType: targetFormat === 'md' ? 'text/markdown' : 'text/plain',
      };
    }

    if (targetFormat === 'docx') {
      const { extractPdfText } = await import('./pdf-service.js');
      const text = await extractPdfText(fileData);
      return textToDocx(text, baseName);
    }

    if (targetFormat === 'html') {
      const { extractPdfText } = await import('./pdf-service.js');
      const text = await extractPdfText(fileData);
      const paragraphs = text
        .split('\n\n')
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
        .join('\n');
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:800px;margin:2rem auto;padding:0 1rem;color:#1e293b;}</style></head><body>${paragraphs}</body></html>`;
      return {
        blob: new Blob([fullHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }

    if (targetFormat === 'img' || targetFormat === 'png' || targetFormat === 'jpg' || targetFormat === 'zip') {
      return pdfToImages(fileData, targetFormat, baseName);
    }
  }

  // ==========================================
  // 2. SOURCE: DOCX / DOC
  // ==========================================
  if (sourceFormat === 'docx' || sourceFormat === 'doc') {
    const mammoth = await import('mammoth');

    if (targetFormat === 'pdf') {
      const result = await mammoth.convertToHtml({ arrayBuffer: fileData });
      return htmlToPdf(result.value, baseName);
    }

    if (targetFormat === 'txt') {
      const result = await mammoth.extractRawText({ arrayBuffer: fileData });
      return {
        blob: new Blob([result.value], { type: 'text/plain' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'md') {
      const result = await mammoth.convertToHtml({ arrayBuffer: fileData });
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      const markdown = td.turndown(result.value);
      return {
        blob: new Blob([markdown], { type: 'text/markdown' }),
        fileName: `${baseName}.md`,
        mimeType: 'text/markdown',
      };
    }

    if (targetFormat === 'html') {
      const result = await mammoth.convertToHtml({ arrayBuffer: fileData });
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:800px;margin:2rem auto;padding:0 1rem;color:#1e293b;}table{border-collapse:collapse;width:100%;margin:1rem 0;}th,td{border:1px solid #cbd5e1;padding:8px;}</style></head><body>${result.value}</body></html>`;
      return {
        blob: new Blob([fullHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }
  }

  // ==========================================
  // 3. SOURCE: HTML
  // ==========================================
  if (sourceFormat === 'html') {
    const htmlString = toText();

    if (targetFormat === 'pdf') {
      return htmlToPdf(htmlString, baseName);
    }

    if (targetFormat === 'docx') {
      return htmlToDocx(htmlString, baseName);
    }

    if (targetFormat === 'md') {
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      const markdown = td.turndown(htmlString);
      return {
        blob: new Blob([markdown], { type: 'text/markdown' }),
        fileName: `${baseName}.md`,
        mimeType: 'text/markdown',
      };
    }

    if (targetFormat === 'txt') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      return {
        blob: new Blob([text], { type: 'text/plain' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }
  }

  // ==========================================
  // 4. SOURCE: TXT
  // ==========================================
  if (sourceFormat === 'txt') {
    const text = toText();

    if (targetFormat === 'pdf') {
      const html = `<pre style="font-family:monospace;white-space:pre-wrap;line-height:1.5;">${escapeHtml(text)}</pre>`;
      return htmlToPdf(html, baseName);
    }

    if (targetFormat === 'docx') {
      return textToDocx(text, baseName);
    }

    if (targetFormat === 'md') {
      return {
        blob: new Blob([text], { type: 'text/markdown' }),
        fileName: `${baseName}.md`,
        mimeType: 'text/markdown',
      };
    }

    if (targetFormat === 'html') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:monospace;line-height:1.6;max-width:800px;margin:2rem auto;padding:0 1rem;white-space:pre-wrap;}</style></head><body>${escapeHtml(text)}</body></html>`;
      return {
        blob: new Blob([html], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }
  }

  // ==========================================
  // 5. SOURCE: MARKDOWN (MD)
  // ==========================================
  if (sourceFormat === 'md') {
    const rawMd = toText();
    const MarkdownIt = (await import('markdown-it')).default;
    const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
    const html = md.render(rawMd);

    if (targetFormat === 'pdf') {
      return htmlToPdf(html, baseName);
    }

    if (targetFormat === 'docx') {
      return htmlToDocx(html, baseName);
    }

    if (targetFormat === 'txt') {
      return {
        blob: new Blob([rawMd], { type: 'text/plain' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'html') {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:800px;margin:2rem auto;padding:0 1rem;color:#1e293b;}table{border-collapse:collapse;width:100%;margin:1rem 0;}th,td{border:1px solid #cbd5e1;padding:8px;}pre{background:#f1f5f9;padding:1rem;border-radius:6px;overflow-x:auto;}</style></head><body>${html}</body></html>`;
      return {
        blob: new Blob([fullHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }
  }

  // ==========================================
  // 6. SOURCE: EPUB
  // ==========================================
  if (sourceFormat === 'epub') {
    const { chapters, fullHtml, fullText } = await extractEpubContent(fileData);

    if (targetFormat === 'txt') {
      return {
        blob: new Blob([fullText], { type: 'text/plain' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'html') {
      const bookHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:Georgia,serif;line-height:1.8;max-width:750px;margin:2rem auto;padding:0 1.5rem;color:#222;}.chapter{margin-bottom:3rem;padding-bottom:2rem;border-bottom:1px solid #e2e8f0;}</style></head><body>${fullHtml}</body></html>`;
      return {
        blob: new Blob([bookHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }

    if (targetFormat === 'md') {
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      const mdContent = td.turndown(fullHtml);
      return {
        blob: new Blob([mdContent], { type: 'text/markdown' }),
        fileName: `${baseName}.md`,
        mimeType: 'text/markdown',
      };
    }

    if (targetFormat === 'docx') {
      return htmlToDocx(fullHtml, baseName);
    }

    if (targetFormat === 'pdf') {
      return htmlToPdf(fullHtml, baseName);
    }
  }

  // ==========================================
  // 7. SOURCE: RTF
  // ==========================================
  if (sourceFormat === 'rtf') {
    const { rtfToHtml } = await import('./rtf-service.js');
    const rtfContent = toText();
    const html = rtfToHtml(rtfContent);

    if (targetFormat === 'html') {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:800px;margin:2rem auto;padding:0 1rem;}</style></head><body>${html}</body></html>`;
      return {
        blob: new Blob([fullHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }

    if (targetFormat === 'txt') {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      return {
        blob: new Blob([temp.textContent || temp.innerText || ''], { type: 'text/plain' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'md') {
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({ headingStyle: 'atx' });
      const markdown = td.turndown(html);
      return {
        blob: new Blob([markdown], { type: 'text/markdown' }),
        fileName: `${baseName}.md`,
        mimeType: 'text/markdown',
      };
    }

    if (targetFormat === 'docx') {
      return htmlToDocx(html, baseName);
    }

    if (targetFormat === 'pdf') {
      return htmlToPdf(html, baseName);
    }
  }

  // ==========================================
  // 8. SOURCE: SPREADSHEETS (XLSX, XLS, CSV)
  // ==========================================
  if (sourceFormat === 'xlsx' || sourceFormat === 'xls' || sourceFormat === 'csv') {
    const XLSX = await import('xlsx');
    let workbook;

    if (sourceFormat === 'csv') {
      workbook = XLSX.read(toText(), { type: 'string' });
    } else {
      workbook = XLSX.read(fileData, { type: 'array' });
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    if (targetFormat === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(firstSheet);
      return {
        blob: new Blob([csv], { type: 'text/csv' }),
        fileName: `${baseName}.csv`,
        mimeType: 'text/csv',
      };
    }

    if (targetFormat === 'tsv') {
      const tsv = XLSX.utils.sheet_to_csv(firstSheet, { FS: '\t' });
      return {
        blob: new Blob([tsv], { type: 'text/tab-separated-values' }),
        fileName: `${baseName}.tsv`,
        mimeType: 'text/tab-separated-values',
      };
    }

    if (targetFormat === 'xlsx') {
      const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      return {
        blob: new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName: `${baseName}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    if (targetFormat === 'json') {
      const json = XLSX.utils.sheet_to_json(firstSheet);
      const jsonStr = JSON.stringify(json, null, 2);
      return {
        blob: new Blob([jsonStr], { type: 'application/json' }),
        fileName: `${baseName}.json`,
        mimeType: 'application/json',
      };
    }

    if (targetFormat === 'html') {
      const tableHtml = XLSX.utils.sheet_to_html(firstSheet);
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#1e293b;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left;}th{background:#f1f5f9;font-weight:600;}</style></head><body>${tableHtml}</body></html>`;
      return {
        blob: new Blob([fullHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }

    if (targetFormat === 'pdf') {
      const tableHtml = XLSX.utils.sheet_to_html(firstSheet);
      return htmlToPdf(tableHtml, baseName);
    }
  }

  // ==========================================
  // 9. SOURCE: JSON
  // ==========================================
  if (sourceFormat === 'json') {
    const rawJson = toText();
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('Invalid JSON content cannot be converted.');
    }

    const XLSX = await import('xlsx');
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    if (targetFormat === 'csv') {
      const sheet = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return {
        blob: new Blob([csv], { type: 'text/csv' }),
        fileName: `${baseName}.csv`,
        mimeType: 'text/csv',
      };
    }

    if (targetFormat === 'xlsx') {
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Data');
      const output = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return {
        blob: new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName: `${baseName}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    if (targetFormat === 'html') {
      let contentHtml;
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        const sheet = XLSX.utils.json_to_sheet(parsed);
        contentHtml = XLSX.utils.sheet_to_html(sheet);
      } else {
        contentHtml = `<pre><code>${escapeHtml(JSON.stringify(parsed, null, 2))}</code></pre>`;
      }
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#1e293b;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #cbd5e1;padding:8px 12px;}pre{background:#f8fafc;padding:1rem;border-radius:8px;}</style></head><body>${contentHtml}</body></html>`;
      return {
        blob: new Blob([fullHtml], { type: 'text/html' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }

    if (targetFormat === 'txt') {
      const pretty = JSON.stringify(parsed, null, 2);
      return {
        blob: new Blob([pretty], { type: 'text/plain' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'pdf') {
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        const sheet = XLSX.utils.json_to_sheet(parsed);
        return htmlToPdf(XLSX.utils.sheet_to_html(sheet), baseName);
      }
      return htmlToPdf(`<pre style="font-family:monospace;font-size:12px;">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`, baseName);
    }
  }

  // ==========================================
  // 10. SOURCE: IMAGES (PNG, JPG, JPEG, WEBP, SVG, BMP)
  // ==========================================
  if (sourceFormat === 'img') {
    // A. Direct visual PDF conversion (embeds full resolution image)
    if (targetFormat === 'pdf') {
      return imageToPdf(fileData, docMeta.type || 'image/png', baseName);
    }

    // B. Image-to-Image format transcoding (PNG <-> JPG <-> WebP)
    if (targetFormat === 'png' || targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'webp') {
      return convertImageFormat(fileData, targetFormat, baseName);
    }

    // C. Optical Character Recognition (OCR to text/docx)
    if (targetFormat === 'txt' || targetFormat === 'docx') {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const blob = new Blob([fileData]);
      const imgUrl = URL.createObjectURL(blob);
      const ret = await worker.recognize(imgUrl);
      const text = ret.data.text || '(No text detected)';
      URL.revokeObjectURL(imgUrl);
      await worker.terminate();

      if (targetFormat === 'txt') {
        return {
          blob: new Blob([text], { type: 'text/plain' }),
          fileName: `${baseName}.txt`,
          mimeType: 'text/plain',
        };
      }
      if (targetFormat === 'docx') {
        return textToDocx(text, baseName);
      }
    }
  }

  throw new Error(`Conversion from ${sourceFormat.toUpperCase()} to ${targetFormat.toUpperCase()} is not currently supported.`);
}

// ==========================================
// HELPER FUNCTIONS & ENGINES
// ==========================================

/**
 * Converts an HTML string into a formatted PDF Document with auto-paging.
 * @param {string} htmlString - Clean HTML content.
 * @param {string} baseName - Base filename.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
async function htmlToPdf(htmlString, baseName) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Create an offscreen render container for jsPDF html engine
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '555pt'; // Printable width on A4 (595 - 40 margin)
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.background = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.fontSize = '12pt';
  container.style.lineHeight = '1.6';
  container.innerHTML = htmlString;

  // Add basic table formatting for PDF
  container.querySelectorAll('table').forEach((tbl) => {
    tbl.style.width = '100%';
    tbl.style.borderCollapse = 'collapse';
    tbl.style.margin = '12pt 0';
  });
  container.querySelectorAll('th, td').forEach((cell) => {
    cell.style.border = '1pt solid #cbd5e1';
    cell.style.padding = '6pt 8pt';
    cell.style.fontSize = '10pt';
  });
  container.querySelectorAll('th').forEach((th) => {
    th.style.background = '#f1f5f9';
    th.style.fontWeight = 'bold';
  });

  document.body.appendChild(container);

  try {
    await doc.html(container, {
      x: 20,
      y: 20,
      width: 555,
      windowWidth: 740,
      autoPaging: 'text',
      margin: [20, 20, 20, 20],
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        logging: false,
      },
    });
  } catch (renderError) {
    console.warn('html2canvas doc.html failed, falling back to text engine:', renderError);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    const fallbackDoc = new jsPDF();
    const lines = fallbackDoc.splitTextToSize(text, 180);
    let y = 20;
    for (const line of lines) {
      if (y > 280) {
        fallbackDoc.addPage();
        y = 20;
      }
      fallbackDoc.text(line, 15, y);
      y += 7;
    }
    document.body.removeChild(container);
    return {
      blob: fallbackDoc.output('blob'),
      fileName: `${baseName}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  document.body.removeChild(container);

  return {
    blob: doc.output('blob'),
    fileName: `${baseName}.pdf`,
    mimeType: 'application/pdf',
  };
}

/**
 * Converts an HTML string into a genuine Microsoft Word (.docx) document.
 * Preserves headings, bold, italics, tables, and bullet/numbered lists.
 * @param {string} htmlString - HTML content.
 * @param {string} baseName - Base filename.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
async function htmlToDocx(htmlString, baseName) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = await import('docx');

  const parser = new DOMParser();
  const docDOM = parser.parseFromString(htmlString, 'text/html');
  const body = docDOM.body;

  const docChildren = [];

  // Helper to extract styled text runs from an element
  const extractRuns = (element) => {
    const runs = [];
    const walk = (node, isBold = false, isItalic = false, isUnderline = false, isStrike = false) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) {
          runs.push(
            new TextRun({
              text: node.textContent,
              bold: isBold,
              italics: isItalic,
              underline: isUnderline ? {} : undefined,
              strike: isStrike,
            })
          );
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const nextBold = isBold || tag === 'strong' || tag === 'b';
        const nextItalic = isItalic || tag === 'em' || tag === 'i';
        const nextUnderline = isUnderline || tag === 'u';
        const nextStrike = isStrike || tag === 'del' || tag === 's' || tag === 'strike';

        for (const child of node.childNodes) {
          walk(child, nextBold, nextItalic, nextUnderline, nextStrike);
        }
      }
    };
    walk(element);
    return runs.length > 0 ? runs : [new TextRun(element.textContent || '')];
  };

  // Traverse top-level body nodes
  for (const node of body.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        docChildren.push(new Paragraph({ children: [new TextRun(text)] }));
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = node.tagName.toLowerCase();

    // Headings
    if (tag === 'h1') {
      docChildren.push(new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
    } else if (tag === 'h2') {
      docChildren.push(new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    } else if (tag === 'h3') {
      docChildren.push(new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }));
    } else if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
      docChildren.push(new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 60 } }));
    }
    // Lists
    else if (tag === 'ul' || tag === 'ol') {
      const isOrdered = tag === 'ol';
      const items = node.querySelectorAll('li');
      items.forEach((li, idx) => {
        const runs = extractRuns(li);
        docChildren.push(
          new Paragraph({
            children: runs,
            bullet: isOrdered ? undefined : { level: 0 },
            numbering: isOrdered ? { reference: 'standard-numbering', level: 0 } : undefined,
          })
        );
      });
    }
    // Tables
    else if (tag === 'table') {
      const tableRows = [];
      const trElements = node.querySelectorAll('tr');
      trElements.forEach((tr) => {
        const cells = [];
        tr.querySelectorAll('th, td').forEach((cell) => {
          cells.push(
            new TableCell({
              children: [new Paragraph({ children: extractRuns(cell) })],
              width: { size: 100 / Math.max(1, tr.children.length), type: WidthType.PERCENTAGE },
            })
          );
        });
        if (cells.length > 0) {
          tableRows.push(new TableRow({ children: cells }));
        }
      });
      if (tableRows.length > 0) {
        docChildren.push(new Table({ rows: tableRows }));
      }
    }
    // Paragraphs / Divs / Blockquotes
    else {
      const runs = extractRuns(node);
      docChildren.push(new Paragraph({ children: runs, spacing: { after: 120 } }));
    }
  }

  const doc = new Document({
    sections: [
      {
        children: docChildren.length > 0 ? docChildren : [new Paragraph({ text: 'Empty Document' })],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return {
    blob,
    fileName: `${baseName}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

/**
 * Converts plain text to a DOCX blob.
 * @param {string} text - Raw text content.
 * @param {string} baseName - Base filename.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
async function textToDocx(text, baseName) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const paragraphs = text
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => new Paragraph({ children: [new TextRun(line)], spacing: { after: 100 } }));

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });
  const blob = await Packer.toBlob(doc);

  return {
    blob,
    fileName: `${baseName}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

/**
 * Converts a PDF document into image files (PNG/JPEG), or a ZIP file if multi-page.
 * @param {ArrayBuffer} fileData - PDF binary data.
 * @param {string} targetFormat - Target image format ('png', 'jpg', 'zip', 'img').
 * @param {string} baseName - Base filename.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
async function pdfToImages(fileData, targetFormat, baseName) {
  // Ensure the pdfjs worker is configured (covers code paths that never imported pdf-service)
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  if (!GlobalWorkerOptions.workerSrc) {
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    GlobalWorkerOptions.workerSrc = workerMod.default || workerMod;
  }
  const pdfjsLib = await import('pdfjs-dist');
  const JSZip = (await import('jszip')).default;
  const { cloneBuffer } = await import('../utils/file-utils.js');
  const loadingTask = pdfjsLib.getDocument({ data: cloneBuffer(fileData) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const zip = new JSZip();
  let firstPageBlob = null;
  const isJpg = targetFormat === 'jpg' || targetFormat === 'jpeg';
  const imgMime = isJpg ? 'image/jpeg' : 'image/png';
  const imgExt = isJpg ? 'jpg' : 'png';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x high resolution
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (isJpg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, imgMime, 0.95));

    if (pageNum === 1) {
      firstPageBlob = blob;
    }

    zip.file(`page-${pageNum}.${imgExt}`, blob);

    // Free canvas memory immediately
    canvas.width = 0;
    canvas.height = 0;
  }

  // If only 1 page and not explicitly requesting a zip, download image directly
  if (numPages === 1 && targetFormat !== 'zip') {
    return {
      blob: firstPageBlob,
      fileName: `${baseName}.${imgExt}`,
      mimeType: imgMime,
    };
  }

  // Multi-page: return a ZIP archive containing all pages
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipBlob,
    fileName: `${baseName}-pages.zip`,
    mimeType: 'application/zip',
  };
}

/**
 * Embeds an image file into a PDF preserving full native resolution and aspect ratio.
 * @param {ArrayBuffer} fileData - Image buffer.
 * @param {string} mimeType - Image mime type.
 * @param {string} baseName - Base filename.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
async function imageToPdf(fileData, mimeType, baseName) {
  const { jsPDF } = await import('jspdf');
  const blob = new Blob([fileData], { type: mimeType });
  const imgUrl = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgUrl;
  });

  const width = img.naturalWidth || img.width || 800;
  const height = img.naturalHeight || img.height || 600;
  const orientation = width > height ? 'landscape' : 'portrait';

  // Create PDF sized directly to image pixels
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: [width, height],
  });

  const imgType = mimeType.includes('png') ? 'PNG' : 'JPEG';
  doc.addImage(img, imgType, 0, 0, width, height);
  URL.revokeObjectURL(imgUrl);

  return {
    blob: doc.output('blob'),
    fileName: `${baseName}.pdf`,
    mimeType: 'application/pdf',
  };
}

/**
 * Transcodes an image between PNG, JPEG, and WebP using client-side canvas.
 * @param {ArrayBuffer} fileData - Image buffer.
 * @param {string} targetFormat - Target image format ('png', 'jpg', 'webp').
 * @param {string} baseName - Base filename.
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string}>}
 */
async function convertImageFormat(fileData, targetFormat, baseName) {
  const blob = new Blob([fileData]);
  const imgUrl = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');

  const isJpg = targetFormat === 'jpg' || targetFormat === 'jpeg';
  if (isJpg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(imgUrl);

  const mimeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  const mime = mimeMap[targetFormat] || 'image/png';
  const ext = isJpg ? 'jpg' : targetFormat;

  const resultBlob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));

  return {
    blob: resultBlob,
    fileName: `${baseName}.${ext}`,
    mimeType: mime,
  };
}

/**
 * Traverses an EPUB book spine and extracts chapter HTMLs and text.
 * @param {ArrayBuffer} fileData - EPUB buffer.
 * @returns {Promise<{chapters: Array, fullHtml: string, fullText: string}>}
 */
async function extractEpubContent(fileData) {
  const ePub = (await import('epubjs')).default;
  const book = ePub(fileData);
  await book.ready;
  const spine = await book.loaded.spine;

  const chapters = [];
  let fullText = '';
  let fullHtml = '';

  for (let i = 0; i < spine.items.length; i++) {
    const item = spine.items[i];
    try {
      const doc = await item.load(book.load.bind(book));
      if (doc) {
        const body = doc.body || doc.documentElement;
        const html = body ? body.innerHTML : '';
        const text = body ? body.innerText || body.textContent || '' : '';
        if (text.trim().length > 0) {
          chapters.push({ chapter: i + 1, html, text: text.trim() });
          fullText += `\n\n=== Chapter ${i + 1} ===\n\n${text.trim()}`;
          fullHtml += `<div class="chapter chapter-${i + 1}"><h2>Chapter ${i + 1}</h2>${html}</div>`;
        }
      }
    } catch (err) {
      console.warn(`Could not load EPUB spine item ${i}:`, err);
    }
  }

  return { chapters, fullHtml, fullText: fullText.trim() };
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
