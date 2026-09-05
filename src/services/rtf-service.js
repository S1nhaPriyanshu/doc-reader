/**
 * RTF parsing and rendering service.
 * Parses Rich Text Format files to clean semantic HTML.
 * @module services/rtf-service
 */
import DOMPurify from 'dompurify';

/**
 * Parses raw RTF text into semantic HTML.
 * @param {string} rtf - Raw RTF string.
 * @returns {string} Clean HTML string.
 */
export function rtfToHtml(rtf) {
  if (!rtf || typeof rtf !== 'string') return '';

  let html = '';
  let i = 0;
  const len = rtf.length;

  // Stack of formatting states
  const stateStack = [{
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: 'left',
    ignorable: false,
  }];

  const current = () => stateStack[stateStack.length - 1];

  let currentParagraph = '';
  const paragraphs = [];

  const flushParagraph = () => {
    if (currentParagraph.trim().length > 0) {
      paragraphs.push(`<p style="text-align:${current().align || 'left'}">${currentParagraph}</p>`);
    }
    currentParagraph = '';
  };

  while (i < len) {
    const ch = rtf[i];

    if (ch === '{') {
      // Push copy of state
      stateStack.push({ ...current() });
      i++;
    } else if (ch === '}') {
      // Pop state
      if (stateStack.length > 1) {
        stateStack.pop();
      }
      i++;
    } else if (ch === '\\') {
      i++;
      if (i >= len) break;

      const nextChar = rtf[i];

      // Escaped special characters
      if (nextChar === '\\' || nextChar === '{' || nextChar === '}') {
        if (!current().ignorable) currentParagraph += nextChar;
        i++;
        continue;
      }

      // Hex character: \'xx
      if (nextChar === "'") {
        i++;
        const hex = rtf.substring(i, i + 2);
        i += 2;
        if (!current().ignorable) {
          try {
            const charCode = parseInt(hex, 16);
            currentParagraph += String.fromCharCode(charCode);
          } catch {
            // ignore malformed hex
          }
        }
        continue;
      }

      // Read control word
      let word = '';
      while (i < len && /[a-zA-Z]/.test(rtf[i])) {
        word += rtf[i];
        i++;
      }

      // Read optional numeric parameter (including negative)
      let param = '';
      if (i < len && (/[0-9]/.test(rtf[i]) || rtf[i] === '-')) {
        param += rtf[i];
        i++;
        while (i < len && /[0-9]/.test(rtf[i])) {
          param += rtf[i];
          i++;
        }
      }

      // Delimiter space after control word
      if (i < len && rtf[i] === ' ') {
        i++;
      }

      // Handle control words
      const lowerWord = word.toLowerCase();
      const num = param !== '' ? parseInt(param, 10) : null;

      // Ignore destinations
      if (lowerWord === '*' || lowerWord === 'fonttbl' || lowerWord === 'colortbl' ||
          lowerWord === 'stylesheet' || lowerWord === 'info' || lowerWord === 'pict' ||
          lowerWord === 'header' || lowerWord === 'footer' || lowerWord === 'generator') {
        current().ignorable = true;
        continue;
      }

      if (current().ignorable) continue;

      switch (lowerWord) {
        case 'b':
          current().bold = num !== 0;
          currentParagraph += current().bold ? '<strong>' : '</strong>';
          break;
        case 'i':
          current().italic = num !== 0;
          currentParagraph += current().italic ? '<em>' : '</em>';
          break;
        case 'ul':
          current().underline = true;
          currentParagraph += '<u>';
          break;
        case 'ulnone':
          current().underline = false;
          currentParagraph += '</u>';
          break;
        case 'strike':
          current().strike = num !== 0;
          currentParagraph += current().strike ? '<del>' : '</del>';
          break;
        case 'par':
          flushParagraph();
          break;
        case 'line':
          currentParagraph += '<br/>';
          break;
        case 'tab':
          currentParagraph += '&emsp;';
          break;
        case 'qc':
          current().align = 'center';
          break;
        case 'ql':
          current().align = 'left';
          break;
        case 'qr':
          current().align = 'right';
          break;
        case 'qj':
          current().align = 'justify';
          break;
        case 'u':
          if (num !== null) {
            const code = num < 0 ? num + 65536 : num;
            currentParagraph += String.fromCharCode(code);
            // Optional trailing character (often a question mark or substitute)
            if (i < len && rtf[i] === '?') {
              i++;
            }
          }
          break;
        default:
          break;
      }
    } else if (ch === '\r' || ch === '\n') {
      // Ignored newline in RTF stream
      i++;
    } else {
      if (!current().ignorable) {
        if (ch === '<') currentParagraph += '&lt;';
        else if (ch === '>') currentParagraph += '&gt;';
        else if (ch === '&') currentParagraph += '&amp;';
        else currentParagraph += ch;
      }
      i++;
    }
  }

  flushParagraph();

  const fullHtml = paragraphs.length > 0 ? paragraphs.join('\n') : '<p></p>';
  if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(fullHtml);
  }
  if (typeof DOMPurify === 'function' && typeof window !== 'undefined') {
    return DOMPurify(window).sanitize(fullHtml);
  }
  return fullHtml;
}

/**
 * Extracts raw text from an RTF document.
 * @param {ArrayBuffer} fileData - The RTF file buffer.
 * @returns {string} Plain text content.
 */
export function extractRtfText(fileData) {
  const decoder = new TextDecoder('utf-8');
  const rtf = decoder.decode(fileData);
  const html = rtfToHtml(rtf);
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

/**
 * Renders an RTF document into a container.
 * @param {ArrayBuffer} fileData - The RTF file data.
 * @param {HTMLElement} container - The container element to render into.
 * @param {Object} docMeta - Document metadata.
 * @returns {Promise<Object>} Render result.
 */
export async function renderRtf(fileData, container, docMeta) {
  const decoder = new TextDecoder('utf-8');
  const rtf = decoder.decode(fileData);
  const html = rtfToHtml(rtf);

  const wrapper = document.createElement('div');
  wrapper.className = 'html-content rtf-content';
  wrapper.innerHTML = html;

  container.innerHTML = '';
  container.appendChild(wrapper);

  return { type: 'html', content: html, editable: true };
}
