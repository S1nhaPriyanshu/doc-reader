/**
 * Comprehensive Node.js verification test for DocReader conversion pipelines.
 */
import assert from 'node:assert';
import { getConversionTargets } from '../src/services/format-router.js';
import { rtfToHtml, extractRtfText } from '../src/services/rtf-service.js';

// Setup DOM globals for Node testing environment
if (typeof document === 'undefined') {
  const { JSDOM } = await import('jsdom').catch(async () => {
    // If jsdom is not installed, install or provide minimal mock
    return { JSDOM: null };
  });

  if (JSDOM) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.DOMParser = dom.window.DOMParser;
    globalThis.Node = dom.window.Node;
  }
}

async function runTests() {
  console.log('--- Starting Universal Converter Test Suite ---');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
    }
  }

  // 1. Format Matrix Test
  test('format-router provides targets for all formats', () => {
    const formats = ['pdf', 'docx', 'txt', 'md', 'html', 'epub', 'rtf', 'xlsx', 'csv', 'tsv', 'json', 'img'];
    for (const f of formats) {
      const targets = getConversionTargets(f);
      assert(targets.length > 0, `Expected targets for format ${f}`);
    }
  });

  // 2. RTF Parser Test
  test('RTF service parses bold, italic, and paragraphs', () => {
    const sampleRtf = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Courier;}}\\b Hello\\b0 \\i World\\i0\\par Second paragraph.}';
    const html = rtfToHtml(sampleRtf);
    assert(html.includes('<strong>Hello</strong>'), 'Should have bold');
    assert(html.includes('<em>World</em>'), 'Should have italic');
    assert(html.includes('Second paragraph'), 'Should have second paragraph');
  });

  // 3. JSON to CSV / XLSX / HTML test
  await asyncTest('JSON to CSV and XLSX conversion', async () => {
    const XLSX = await import('xlsx');
    const records = [
      { id: 1, name: 'Alice', role: 'Engineer' },
      { id: 2, name: 'Bob', role: 'Designer' },
    ];
    const sheet = XLSX.utils.json_to_sheet(records);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    assert(csv.includes('Alice'), 'CSV must contain Alice');
    assert(csv.includes('Designer'), 'CSV must contain Designer');

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Data');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    assert(arrayBuffer.byteLength > 0, 'XLSX buffer should be non-empty');
  });

  // 4. CSV to JSON & TSV test
  await asyncTest('CSV to JSON and TSV conversion', async () => {
    const XLSX = await import('xlsx');
    const csvString = 'id,product,price\n101,Widget,9.99\n102,Gadget,19.99';
    const wb = XLSX.read(csvString, { type: 'string' });
    const sheet = wb.Sheets[wb.SheetNames[0]];

    const json = XLSX.utils.sheet_to_json(sheet);
    assert.strictEqual(json.length, 2, 'Should parse 2 records');
    assert.strictEqual(json[0].product, 'Widget');

    const tsv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
    assert(tsv.includes('\t'), 'TSV should be tab-separated');
  });

  // 5. Markdown to HTML test
  await asyncTest('Markdown rendering to HTML and Turndown reverse', async () => {
    const MarkdownIt = (await import('markdown-it')).default;
    const TurndownService = (await import('turndown')).default;

    const md = new MarkdownIt();
    const sourceMd = '# Chapter 1\n\nThis is **bold** and *italic* text.\n\n- Item 1\n- Item 2';
    const html = md.render(sourceMd);
    assert(html.includes('<h1>Chapter 1</h1>'), 'Should render H1');
    assert(html.includes('<strong>bold</strong>'), 'Should render strong');

    const td = new TurndownService();
    const backToMd = td.turndown(html);
    assert(backToMd.includes('Chapter 1'), 'Turndown should preserve heading');
    assert(backToMd.includes('**bold**'), 'Turndown should preserve bold');
  });

  // 6. DOCX Generation Test
  await asyncTest('DOCX generation from Text and Packer', async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: 'Main Title', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Formatted body paragraph with ', bold: false }),
                new TextRun({ text: 'bold text', bold: true }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    assert(buffer.length > 0, 'DOCX buffer should be non-empty');
  });

  // 7. JSZip multi-page archiving test
  await asyncTest('JSZip creates valid zip archives', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('page-1.png', 'dummy-data-1');
    zip.file('page-2.png', 'dummy-data-2');

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    assert(zipBuffer.length > 0, 'ZIP buffer should be non-empty');
    assert(zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4b, 'ZIP header magic number check (PK)');
  });

  console.log(`\nResults: ${passed} / ${total} tests passed!`);
  if (passed === total) {
    console.log('✓ All conversion engine components verified successfully!');
  } else {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
