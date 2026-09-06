/**
 * File utility functions — MIME detection, size formatting, ID generation.
 * @module utils/file-utils
 */

/**
 * Mapping of file extensions to format metadata.
 */
const FORMAT_MAP = {
  pdf:  { format: 'pdf',  label: 'PDF',      mime: 'application/pdf',       icon: '📄' },
  docx: { format: 'docx', label: 'DOCX',     mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: '📝' },
  doc:  { format: 'doc',  label: 'DOC',      mime: 'application/msword',    icon: '📝' },
  txt:  { format: 'txt',  label: 'TXT',      mime: 'text/plain',            icon: '📃' },
  md:   { format: 'md',   label: 'Markdown',  mime: 'text/markdown',         icon: '📋' },
  xlsx: { format: 'xlsx', label: 'XLSX',     mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', icon: '📊' },
  xls:  { format: 'xls',  label: 'XLS',      mime: 'application/vnd.ms-excel', icon: '📊' },
  csv:  { format: 'csv',  label: 'CSV',      mime: 'text/csv',              icon: '📊' },
  epub: { format: 'epub', label: 'EPUB',     mime: 'application/epub+zip',  icon: '📖' },
  html: { format: 'html', label: 'HTML',     mime: 'text/html',             icon: '🌐' },
  htm:  { format: 'html', label: 'HTML',     mime: 'text/html',             icon: '🌐' },
  json: { format: 'json', label: 'JSON',     mime: 'application/json',     icon: '📦' },
  rtf:  { format: 'rtf',  label: 'RTF',      mime: 'application/rtf',      icon: '📄' },
  tsv:  { format: 'csv',  label: 'TSV',      mime: 'text/tab-separated-values', icon: '📊' },
  svg:  { format: 'img',  label: 'SVG',      mime: 'image/svg+xml',        icon: '🖼️' },
  png:  { format: 'img',  label: 'PNG',      mime: 'image/png',             icon: '🖼️' },
  jpg:  { format: 'img',  label: 'JPG',      mime: 'image/jpeg',            icon: '🖼️' },
  jpeg: { format: 'img',  label: 'JPEG',     mime: 'image/jpeg',            icon: '🖼️' },
  webp: { format: 'img',  label: 'WebP',     mime: 'image/webp',            icon: '🖼️' },
};

/**
 * All accepted file extensions for the file picker.
 */
export const ACCEPTED_EXTENSIONS = Object.keys(FORMAT_MAP).map((ext) => '.' + ext).join(',');

/**
 * Accepted MIME types for the file picker.
 */
export const ACCEPTED_MIMES = [...new Set(Object.values(FORMAT_MAP).map((f) => f.mime))].join(',');

/**
 * Detects the format of a file based on its name and MIME type.
 * @param {File} file - The file to detect.
 * @returns {Object} Format metadata { format, label, mime, icon }.
 */
export function detectFormat(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (FORMAT_MAP[ext]) {
    return FORMAT_MAP[ext];
  }

  // Fallback to MIME type matching
  for (const info of Object.values(FORMAT_MAP)) {
    if (file.type === info.mime) {
      return info;
    }
  }

  return { format: 'unknown', label: 'Unknown', mime: file.type || 'application/octet-stream', icon: '📁' };
}

/**
 * Formats a file size in bytes to a human-readable string.
 * @param {number} bytes - File size in bytes.
 * @returns {string} Formatted size (e.g. "1.2 MB").
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

/**
 * Generates a unique ID for a document based on name, size, and timestamp.
 * @param {File} file - The file.
 * @returns {string} Unique document ID.
 */
export function generateDocId(file) {
  const hash = simpleHash(file.name + file.size + file.lastModified);
  return `doc_${hash}`;
}

/**
 * Simple string hashing for ID generation.
 * @param {string} str - Input string.
 * @returns {string} Hex hash string.
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Validates that a file is within the size limit.
 * @param {File} file - The file to validate.
 * @param {number} [maxSizeMB=50] - Maximum file size in MB.
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateFileSize(file, maxSizeMB = 50) {
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      message: `File is too large (${formatFileSize(file.size)}). Maximum allowed: ${maxSizeMB} MB.`,
    };
  }
  return { valid: true };
}

/**
 * Reads a File object as an ArrayBuffer.
 * @param {File} file - File to read.
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a File object as text.
 * @param {File} file - File to read.
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Safely clones an ArrayBuffer or TypedArray view to prevent buffer detachment
 * when transferring data to Web Workers.
 * @param {ArrayBuffer|ArrayBufferView} buffer - Binary document buffer.
 * @returns {ArrayBuffer} Independent buffer clone.
 */
export function cloneBuffer(buffer) {
  if (!buffer) return buffer;
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(0);
  }
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  return buffer;
}

