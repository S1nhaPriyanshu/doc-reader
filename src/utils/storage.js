/**
 * IndexedDB storage wrapper for DocReader.
 * Stores recent documents and user settings using idb-keyval.
 * @module utils/storage
 */
import { get, set, del, keys, entries } from 'idb-keyval';

const RECENT_PREFIX = 'recent:';
const MAX_RECENT = 20;

/**
 * Saves a document to recent files.
 * Stores metadata and optionally the file blob.
 * @param {Object} docMeta - Document metadata.
 * @param {string} docMeta.id - Unique document ID.
 * @param {string} docMeta.name - File name.
 * @param {string} docMeta.type - MIME type.
 * @param {string} docMeta.format - Format label (pdf, docx, etc).
 * @param {number} docMeta.size - File size in bytes.
 * @param {number} docMeta.lastOpened - Timestamp.
 * @param {ArrayBuffer} [fileData] - Raw file data for caching.
 */
export async function saveRecentDocument(docMeta, fileData = null) {
  const key = RECENT_PREFIX + docMeta.id;
  await set(key, { meta: docMeta, data: fileData });
  await trimRecentDocuments();
}

/**
 * Retrieves all recent documents, sorted by lastOpened descending.
 * @returns {Promise<Array<Object>>} Array of document metadata objects.
 */
export async function getRecentDocuments() {
  const allKeys = await keys();
  const recentKeys = allKeys.filter((k) => String(k).startsWith(RECENT_PREFIX));
  const results = [];

  for (const key of recentKeys) {
    const entry = await get(key);
    if (entry && entry.meta) {
      results.push(entry.meta);
    }
  }

  return results.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
}

/**
 * Retrieves a cached document's file data by ID.
 * @param {string} id - Document ID.
 * @returns {Promise<ArrayBuffer|null>} The file data or null.
 */
export async function getCachedFileData(id) {
  const entry = await get(RECENT_PREFIX + id);
  return entry?.data || null;
}

/**
 * Removes a document from recent files.
 * @param {string} id - Document ID.
 */
export async function removeRecentDocument(id) {
  await del(RECENT_PREFIX + id);
}

/**
 * Trims recent documents to MAX_RECENT, removing oldest entries.
 */
async function trimRecentDocuments() {
  const docs = await getRecentDocuments();
  if (docs.length > MAX_RECENT) {
    const toRemove = docs.slice(MAX_RECENT);
    for (const doc of toRemove) {
      await del(RECENT_PREFIX + doc.id);
    }
  }
}

/**
 * Saves a user setting.
 * @param {string} key - Setting key.
 * @param {*} value - Setting value.
 */
export async function saveSetting(key, value) {
  await set('setting:' + key, value);
}

/**
 * Retrieves a user setting.
 * @param {string} key - Setting key.
 * @param {*} defaultValue - Default value if not found.
 * @returns {Promise<*>} The setting value.
 */
export async function getSetting(key, defaultValue = null) {
  const val = await get('setting:' + key);
  return val !== undefined ? val : defaultValue;
}
