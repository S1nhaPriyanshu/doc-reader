import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Map backing the idb-keyval mock — hoisted so vi.mock factory can close over it
const store = vi.hoisted(() => new Map());

vi.mock('idb-keyval', () => ({
  get: vi.fn((key) => Promise.resolve(store.get(key))),
  set: vi.fn((key, value) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key) => {
    store.delete(key);
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve([...store.keys()])),
  entries: vi.fn(() => Promise.resolve([...store.entries()])),
}));

import {
  saveRecentDocument,
  getRecentDocuments,
  getCachedFileData,
  removeRecentDocument,
  saveSetting,
  getSetting,
} from '../../src/utils/storage.js';
import * as idb from 'idb-keyval';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const RECENT_PREFIX = 'recent:';
const MAX_RECENT = 20;

function makeMeta(id, lastOpened, overrides = {}) {
  return {
    id: String(id),
    name: `${id}.pdf`,
    type: 'application/pdf',
    format: 'pdf',
    size: 1234,
    lastOpened,
    ...overrides,
  };
}

function makeBuffer(content = 'hello') {
  return new TextEncoder().encode(content).buffer;
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// saveRecentDocument
// ---------------------------------------------------------------------------
describe('saveRecentDocument', () => {
  it('stores meta and fileData under RECENT_PREFIX + id', async () => {
    const meta = makeMeta('doc1', Date.now());
    const data = makeBuffer('file-content');
    await saveRecentDocument(meta, data);

    expect(store.has(RECENT_PREFIX + 'doc1')).toBe(true);
    const entry = store.get(RECENT_PREFIX + 'doc1');
    expect(entry.meta).toEqual(meta);
    expect(entry.data).toBe(data);
  });

  it('stores with null data when fileData is omitted (defaults to null)', async () => {
    const meta = makeMeta('doc2', Date.now());
    await saveRecentDocument(meta);

    const entry = store.get(RECENT_PREFIX + 'doc2');
    expect(entry.meta).toEqual(meta);
    expect(entry.data).toBeNull();
  });

  it('explicitly passing null stores null data', async () => {
    const meta = makeMeta('doc3', Date.now());
    await saveRecentDocument(meta, null);

    expect(store.get(RECENT_PREFIX + 'doc3').data).toBeNull();
  });

  it('overwrites an existing entry with the same id', async () => {
    const meta1 = makeMeta('doc1', 1000);
    const meta2 = makeMeta('doc1', 2000, { name: 'updated.pdf' });
    await saveRecentDocument(meta1, makeBuffer('v1'));
    await saveRecentDocument(meta2, makeBuffer('v2'));

    expect(store.size).toBe(1);
    expect(store.get(RECENT_PREFIX + 'doc1').meta.name).toBe('updated.pdf');
    expect(store.get(RECENT_PREFIX + 'doc1').meta.lastOpened).toBe(2000);
  });

  it('calls idb-keyval set with correct key shape', async () => {
    const meta = makeMeta('abc-123', 9999);
    await saveRecentDocument(meta, makeBuffer());

    expect(idb.set).toHaveBeenCalledWith(RECENT_PREFIX + 'abc-123', expect.objectContaining({ meta, data: expect.anything() }));
  });

  it('handles ArrayBuffer fileData correctly', async () => {
    const meta = makeMeta('bin', Date.now());
    const buf = new Uint8Array([1, 2, 3, 255]).buffer;
    await saveRecentDocument(meta, buf);

    expect(store.get(RECENT_PREFIX + 'bin').data).toBe(buf);
  });

  it('trims oldest entries when saving past MAX_RECENT (21st triggers eviction)', async () => {
    const base = Date.now();
    // Insert 21 documents with increasing lastOpened (0 is oldest)
    for (let i = 0; i < 21; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i), makeBuffer(`data-${i}`));
    }

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    // Oldest (doc0, lastOpened = base+0) should have been evicted
    expect(docs.find((d) => d.id === 'doc0')).toBeUndefined();
    // Newest should still be present
    expect(docs.find((d) => d.id === 'doc20')).toBeDefined();
    expect(store.has(RECENT_PREFIX + 'doc0')).toBe(false);
  });

  it('does not trim when exactly MAX_RECENT documents are stored', async () => {
    const base = Date.now();
    for (let i = 0; i < MAX_RECENT; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    // No deletion should have occurred
    for (let i = 0; i < MAX_RECENT; i++) {
      expect(store.has(RECENT_PREFIX + `doc${i}`)).toBe(true);
    }
  });

  it('trims based on lastOpened order, not insertion order', async () => {
    const base = Date.now();
    // Insert 20 docs: doc0 newest, doc19 oldest (reverse lastOpened)
    for (let i = 0; i < MAX_RECENT; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + (MAX_RECENT - i)));
    }
    // Now add one more doc that is newer than all — should evict the true oldest (doc19, smallest lastOpened)
    await saveRecentDocument(makeMeta('newest', base + 100));

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    expect(docs.find((d) => d.id === 'doc19')).toBeUndefined();
    expect(docs.find((d) => d.id === 'newest')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getRecentDocuments
// ---------------------------------------------------------------------------
describe('getRecentDocuments', () => {
  it('returns empty array when no recent documents exist', async () => {
    expect(await getRecentDocuments()).toEqual([]);
  });

  it('returns empty array when store is empty and no keys match prefix', async () => {
    // Add only setting keys
    await saveSetting('theme', 'dark');
    expect(await getRecentDocuments()).toEqual([]);
  });

  it('returns all recent documents when under MAX_RECENT', async () => {
    await saveRecentDocument(makeMeta('a', 1000));
    await saveRecentDocument(makeMeta('b', 2000));
    await saveRecentDocument(makeMeta('c', 3000));

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(3);
  });

  it('returns documents sorted by lastOpened descending (newest first)', async () => {
    await saveRecentDocument(makeMeta('old', 1000));
    await saveRecentDocument(makeMeta('mid', 5000));
    await saveRecentDocument(makeMeta('new', 9000));

    const docs = await getRecentDocuments();
    expect(docs.map((d) => d.id)).toEqual(['new', 'mid', 'old']);
  });

  it('handles documents with missing lastOpened (treated as 0, sorted last)', async () => {
    const withTime = makeMeta('with', 5000);
    const noTime = { id: 'without', name: 'without.pdf', type: 'application/pdf', format: 'pdf', size: 100 };
    // no lastOpened property
    await saveRecentDocument(withTime);
    await saveRecentDocument(noTime);

    const docs = await getRecentDocuments();
    expect(docs[0].id).toBe('with');
    expect(docs[1].id).toBe('without');
  });

  it('filters out keys that do not start with RECENT_PREFIX', async () => {
    await saveRecentDocument(makeMeta('doc1', 1000));
    await saveSetting('theme', 'dark');
    // Manually inject a non-prefixed key and a similar but not matching prefix
    store.set('other:doc2', { meta: makeMeta('doc2', 2000), data: null });
    store.set('recent', { meta: makeMeta('doc3', 3000), data: null });

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc1');
  });

  it('skips entries where get returns undefined (deleted between keys() and get())', async () => {
    // Simulate race: keys() will return key but get returns undefined
    // We add a key then delete its backing entry manually before get reads it
    await saveRecentDocument(makeMeta('doc1', 1000));
    // Inject a key whose value is undefined/null in store — keys() returns it but get resolves undefined
    store.set(RECENT_PREFIX + 'ghost', undefined);

    const docs = await getRecentDocuments();
    // ghost should be skipped because entry is falsy
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc1');
  });

  it('skips entries where meta is missing', async () => {
    store.set(RECENT_PREFIX + 'bad1', { data: makeBuffer() }); // no meta
    store.set(RECENT_PREFIX + 'bad2', { meta: null, data: null });
    store.set(RECENT_PREFIX + 'bad3', null);
    await saveRecentDocument(makeMeta('good', 1000));

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('good');
  });

  it('handles String-coercion for non-string keys from idb-keyval', async () => {
    // idb-keyval keys() could theoretically return non-string keys; code does String(k).startsWith(...)
    // Simulate a numeric key that should not match prefix
    store.set(12345, { meta: makeMeta('numeric', 1000), data: null });
    await saveRecentDocument(makeMeta('real', 2000));

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('real');
  });

  it('returns a new sorted array without mutating stored data', async () => {
    await saveRecentDocument(makeMeta('a', 1000));
    await saveRecentDocument(makeMeta('b', 2000));
    const first = await getRecentDocuments();
    const second = await getRecentDocuments();
    expect(first).not.toBe(second);
    expect(first.map((d) => d.id)).toEqual(second.map((d) => d.id));
  });
});

// ---------------------------------------------------------------------------
// getCachedFileData
// ---------------------------------------------------------------------------
describe('getCachedFileData', () => {
  it('returns cached ArrayBuffer data when document exists', async () => {
    const buf = makeBuffer('cached-content');
    await saveRecentDocument(makeMeta('doc1', Date.now()), buf);

    const data = await getCachedFileData('doc1');
    expect(data).toBe(buf);
  });

  it('returns null when document id does not exist', async () => {
    expect(await getCachedFileData('nonexistent')).toBeNull();
  });

  it('returns null when entry exists but data is null', async () => {
    await saveRecentDocument(makeMeta('doc1', Date.now()), null);
    expect(await getCachedFileData('doc1')).toBeNull();
  });

  it('returns null when entry exists but data is undefined (missing data property)', async () => {
    store.set(RECENT_PREFIX + 'doc1', { meta: makeMeta('doc1', Date.now()) });
    expect(await getCachedFileData('doc1')).toBeNull();
  });

  it('returns null when entry itself is undefined', async () => {
    // No entry for this id
    expect(await getCachedFileData('missing-id')).toBeNull();
  });

  it('returns the correct data for the correct id among multiple docs', async () => {
    const buf1 = makeBuffer('data1');
    const buf2 = makeBuffer('data2');
    await saveRecentDocument(makeMeta('doc1', 1000), buf1);
    await saveRecentDocument(makeMeta('doc2', 2000), buf2);

    expect(await getCachedFileData('doc1')).toBe(buf1);
    expect(await getCachedFileData('doc2')).toBe(buf2);
  });

  it('calls idb-keyval get with the prefixed key', async () => {
    await saveRecentDocument(makeMeta('myid', 1000), makeBuffer());
    vi.clearAllMocks();
    await getCachedFileData('myid');
    expect(idb.get).toHaveBeenCalledWith(RECENT_PREFIX + 'myid');
  });

  it('returns null for empty string data (falsy) per || null semantics', async () => {
    // Edge: data = "" is falsy, so entry?.data || null yields null
    store.set(RECENT_PREFIX + 'doc1', { meta: makeMeta('doc1', 1000), data: '' });
    expect(await getCachedFileData('doc1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// removeRecentDocument
// ---------------------------------------------------------------------------
describe('removeRecentDocument', () => {
  it('deletes the document from storage', async () => {
    await saveRecentDocument(makeMeta('doc1', Date.now()), makeBuffer());
    expect(store.has(RECENT_PREFIX + 'doc1')).toBe(true);

    await removeRecentDocument('doc1');
    expect(store.has(RECENT_PREFIX + 'doc1')).toBe(false);
  });

  it('only deletes the targeted id, leaves others intact', async () => {
    await saveRecentDocument(makeMeta('doc1', 1000));
    await saveRecentDocument(makeMeta('doc2', 2000));
    await saveRecentDocument(makeMeta('doc3', 3000));

    await removeRecentDocument('doc2');

    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(2);
    expect(docs.find((d) => d.id === 'doc2')).toBeUndefined();
    expect(docs.find((d) => d.id === 'doc1')).toBeDefined();
    expect(docs.find((d) => d.id === 'doc3')).toBeDefined();
  });

  it('does not throw when removing a non-existent id', async () => {
    await expect(removeRecentDocument('ghost')).resolves.toBeUndefined();
  });

  it('calls idb-keyval del with the prefixed key', async () => {
    await removeRecentDocument('myid');
    expect(idb.del).toHaveBeenCalledWith(RECENT_PREFIX + 'myid');
  });

  it('subsequent getCachedFileData returns null after removal', async () => {
    await saveRecentDocument(makeMeta('doc1', Date.now()), makeBuffer('data'));
    await removeRecentDocument('doc1');
    expect(await getCachedFileData('doc1')).toBeNull();
  });

  it('subsequent getRecentDocuments excludes removed document', async () => {
    await saveRecentDocument(makeMeta('doc1', 1000));
    await saveRecentDocument(makeMeta('doc2', 2000));
    await removeRecentDocument('doc1');
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc2');
  });
});

// ---------------------------------------------------------------------------
// saveSetting / getSetting
// ---------------------------------------------------------------------------
describe('saveSetting and getSetting', () => {
  it('round-trip string value', async () => {
    await saveSetting('theme', 'dark');
    expect(await getSetting('theme')).toBe('dark');
  });

  it('round-trip number value', async () => {
    await saveSetting('fontSize', 16);
    expect(await getSetting('fontSize')).toBe(16);
  });

  it('round-trip boolean false', async () => {
    await saveSetting('notifications', false);
    expect(await getSetting('notifications')).toBe(false);
  });

  it('round-trip boolean true', async () => {
    await saveSetting('enabled', true);
    expect(await getSetting('enabled')).toBe(true);
  });

  it('round-trip object value', async () => {
    const obj = { a: 1, nested: { b: 2 } };
    await saveSetting('prefs', obj);
    expect(await getSetting('prefs')).toEqual(obj);
  });

  it('round-trip array value', async () => {
    const arr = [1, 2, 3];
    await saveSetting('list', arr);
    expect(await getSetting('list')).toEqual(arr);
  });

  it('round-trip null value (stored null is returned, not default)', async () => {
    await saveSetting('nullable', null);
    // get returns null (stored) rather than default, because val !== undefined check
    expect(await getSetting('nullable', 'fallback')).toBeNull();
  });

  it('returns defaultValue (null) when key does not exist and no default given', async () => {
    expect(await getSetting('missing')).toBeNull();
  });

  it('returns custom defaultValue when key does not exist', async () => {
    expect(await getSetting('missing', 'default-val')).toBe('default-val');
    expect(await getSetting('missing2', 42)).toBe(42);
    expect(await getSetting('missing3', false)).toBe(false);
  });

  it('returns stored falsy values instead of default (0, empty string, false)', async () => {
    await saveSetting('zero', 0);
    await saveSetting('empty', '');
    await saveSetting('flag', false);

    expect(await getSetting('zero', 999)).toBe(0);
    expect(await getSetting('empty', 'fallback')).toBe('');
    expect(await getSetting('flag', true)).toBe(false);
  });

  it('returns default when stored value is undefined (never set)', async () => {
    // Directly ensure that idb get returns undefined for missing key
    expect(await getSetting('neverSet', 'myDefault')).toBe('myDefault');
  });

  it('overwrites an existing setting', async () => {
    await saveSetting('theme', 'light');
    await saveSetting('theme', 'dark');
    expect(await getSetting('theme')).toBe('dark');
  });

  it('uses isolated keys (setting: prefix does not collide with recent: prefix)', async () => {
    await saveSetting('doc1', 'setting-value');
    await saveRecentDocument(makeMeta('doc1', 1000));

    expect(await getSetting('doc1')).toBe('setting-value');
    expect(await getCachedFileData('doc1')).toBeNull(); // no fileData
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(1);
  });

  it('calls idb-keyval set/get with prefixed key', async () => {
    await saveSetting('myKey', 'myVal');
    expect(idb.set).toHaveBeenCalledWith('setting:myKey', 'myVal');

    vi.clearAllMocks();
    await getSetting('myKey');
    expect(idb.get).toHaveBeenCalledWith('setting:myKey');
  });

  it('handles setting key with special characters', async () => {
    await saveSetting('key:with:colons', 'value');
    expect(await getSetting('key:with:colons')).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// trim edge cases (via saveRecentDocument -> trimRecentDocuments)
// ---------------------------------------------------------------------------
describe('trim edge cases', () => {
  it('empty store: saveRecentDocument does not throw and results in 1 entry', async () => {
    expect(await getRecentDocuments()).toHaveLength(0);
    await saveRecentDocument(makeMeta('first', Date.now()));
    expect(await getRecentDocuments()).toHaveLength(1);
  });

  it('exactly MAX_RECENT documents: no trimming occurs', async () => {
    const base = 1000;
    for (let i = 0; i < MAX_RECENT; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    expect(await getRecentDocuments()).toHaveLength(MAX_RECENT);
    // All 20 still present
    for (let i = 0; i < MAX_RECENT; i++) {
      expect(store.has(RECENT_PREFIX + `doc${i}`)).toBe(true);
    }
  });

  it('MAX_RECENT + 1 (21) documents: oldest single entry is removed', async () => {
    const base = 1000;
    for (let i = 0; i < MAX_RECENT + 1; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    // Oldest doc0 (smallest lastOpened) removed
    expect(store.has(RECENT_PREFIX + 'doc0')).toBe(false);
    expect(store.has(RECENT_PREFIX + 'doc20')).toBe(true);
    expect(docs.find((d) => d.id === 'doc0')).toBeUndefined();
  });

  it('25 documents: oldest 5 are removed, newest 20 retained', async () => {
    const base = 1000;
    for (let i = 0; i < 25; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    for (let i = 0; i < 5; i++) {
      expect(store.has(RECENT_PREFIX + `doc${i}`)).toBe(false);
    }
    for (let i = 5; i < 25; i++) {
      expect(store.has(RECENT_PREFIX + `doc${i}`)).toBe(true);
    }
    // Sorted check: newest first
    expect(docs[0].id).toBe('doc24');
    expect(docs[docs.length - 1].id).toBe('doc5');
  });

  it('trim respects lastOpened ordering regardless of insertion order', async () => {
    const base = 5000;
    // Insert 21 docs but shuffle lastOpened: insert in random order, lastOpened determines eviction
    const ids = Array.from({ length: 21 }, (_, i) => i);
    // Create docs with lastOpened = base + id (so id correlates to recency) but insert out of order
    const insertOrder = [10, 5, 0, 20, 15, 3, 8, 12, 1, 18, 7, 4, 11, 19, 2, 6, 9, 13, 14, 16, 17];
    for (const idx of insertOrder) {
      await saveRecentDocument(makeMeta(`doc${idx}`, base + idx));
    }
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    // Smallest lastOpened is doc0 -> should be evicted
    expect(docs.find((d) => d.id === 'doc0')).toBeUndefined();
    // All others should remain
    for (let i = 1; i <= 20; i++) {
      expect(docs.find((d) => d.id === `doc${i}`)).toBeDefined();
    }
  });

  it('removing a document then adding one does not cause extra trim', async () => {
    const base = 1000;
    for (let i = 0; i < MAX_RECENT; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    await removeRecentDocument('doc0');
    expect(await getRecentDocuments()).toHaveLength(19);

    await saveRecentDocument(makeMeta('newDoc', base + 999));
    expect(await getRecentDocuments()).toHaveLength(20);
    expect(store.has(RECENT_PREFIX + 'newDoc')).toBe(true);
    expect(store.has(RECENT_PREFIX + 'doc0')).toBe(false); // already removed
  });

  it('getRecentDocuments after trim is still sorted descending', async () => {
    const base = 1000;
    for (let i = 0; i < 25; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    const docs = await getRecentDocuments();
    for (let i = 0; i < docs.length - 1; i++) {
      expect(docs[i].lastOpened).toBeGreaterThanOrEqual(docs[i + 1].lastOpened);
    }
  });

  it('empty after bulk removal and re-insertion works correctly', async () => {
    const base = 1000;
    for (let i = 0; i < 5; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    for (let i = 0; i < 5; i++) {
      await removeRecentDocument(`doc${i}`);
    }
    expect(await getRecentDocuments()).toHaveLength(0);

    await saveRecentDocument(makeMeta('fresh', base + 999));
    expect(await getRecentDocuments()).toHaveLength(1);
    expect((await getRecentDocuments())[0].id).toBe('fresh');
  });

  it('storing duplicate id does not increase count beyond MAX_RECENT incorrectly', async () => {
    const base = 1000;
    for (let i = 0; i < MAX_RECENT; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    // Update existing doc0 to newest time — count stays 20, no eviction of wrong entry
    await saveRecentDocument(makeMeta('doc0', base + 9999));
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(MAX_RECENT);
    expect(docs[0].id).toBe('doc0'); // now newest
    // Oldest among the rest (doc1, lastOpened=1001) still present; nothing evicted beyond update
    expect(docs.find((d) => d.id === 'doc1')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: isolation between recent documents and settings
// ---------------------------------------------------------------------------
describe('isolation between recent documents and settings', () => {
  it('keys() filtering does not confuse setting: and recent: namespaces', async () => {
    await saveSetting('recent:fake', 'should-not-appear');
    await saveRecentDocument(makeMeta('real', 1000));
    // setting:recent:fake stored as literal key "setting:recent:fake" — does not start with "recent:" after String()?
    // Actually "setting:recent:fake" does NOT start with "recent:" so correctly filtered
    const docs = await getRecentDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('real');
    // Verify setting still retrievable
    expect(await getSetting('recent:fake')).toBe('should-not-appear');
  });

  it('trim does not delete setting entries', async () => {
    await saveSetting('keepMe', 'important');
    const base = 1000;
    for (let i = 0; i < 25; i++) {
      await saveRecentDocument(makeMeta(`doc${i}`, base + i));
    }
    expect(await getSetting('keepMe')).toBe('important');
    expect(store.has('setting:keepMe')).toBe(true);
  });
});
