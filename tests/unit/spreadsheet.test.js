/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must be hoisted above the service import — Vitest hoists vi.mock calls.
// Using vi.fn() inside the factory is supported; the mock replaces the real
// `xlsx` module for every import in this file (including the transitive
// import inside spreadsheet-service.js).
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_html: vi.fn(),
  },
}));

import * as XLSX from 'xlsx';
import { renderSpreadsheet } from '../../src/services/spreadsheet-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeBuffer(label = 'fake') {
  return new TextEncoder().encode(label).buffer;
}

function fakeSheet(id = 's1') {
  return { '!ref': 'A1:B2', _id: id };
}

function fakeWorkbook(sheetNames, sheets) {
  return { SheetNames: sheetNames, Sheets: sheets };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('renderSpreadsheet', () => {
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    container.id = 'spreadsheet-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // CSV rendering to table
  // -------------------------------------------------------------------------

  describe('CSV rendering to table', () => {
    it('renders a CSV workbook as an HTML table inside spreadsheet-wrapper', async () => {
      const csvHtml =
        '<table><tr><td>Name</td><td>Age</td></tr><tr><td>Alice</td><td>30</td></tr></table>';
      const sheet = fakeSheet('csv');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue(csvHtml);

      const data = fakeBuffer('a,b\n1,2');
      const result = await renderSpreadsheet(data, container, { name: 'data.csv' });

      expect(XLSX.read).toHaveBeenCalledWith(data, { type: 'array' });
      expect(XLSX.utils.sheet_to_html).toHaveBeenCalledWith(sheet);

      const wrapper = container.querySelector('.spreadsheet-wrapper');
      expect(wrapper).not.toBeNull();
      expect(wrapper.style.overflowX).toBe('auto');
      const tableContainer = wrapper.querySelector('.spreadsheet-table');
      expect(tableContainer).not.toBeNull();
      // jsdom normalises <table><tr> → <table><tbody><tr>; compare via DOM text
      expect(tableContainer.querySelector('table')).not.toBeNull();
      expect(tableContainer.textContent).toContain('Name');
      expect(tableContainer.textContent).toContain('Alice');
      // Raw html string was assigned — verify key fragments survived parsing
      expect(tableContainer.innerHTML).toContain('Name');
      expect(tableContainer.innerHTML).toContain('Alice');

      expect(result.type).toBe('spreadsheet');
      expect(result.editable).toBe(true);
      expect(result.sheetNames).toEqual(['Sheet1']);
    });

    it('renders CSV cell values correctly in the table', async () => {
      const csvHtml =
        '<table><tr><td>city</td><td>country</td></tr><tr><td>Paris</td><td>France</td></tr><tr><td>Tokyo</td><td>Japan</td></tr></table>';
      const sheet = fakeSheet('csv2');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue(csvHtml);

      await renderSpreadsheet(fakeBuffer('city,country\nParis,France'), container, {
        name: 'cities.csv',
      });

      const cells = container.querySelectorAll('td');
      expect(cells[0].textContent).toBe('city');
      expect(cells[1].textContent).toBe('country');
      expect(cells[2].textContent).toBe('Paris');
      expect(cells[3].textContent).toBe('France');
    });

    it('renders CSV with quoted fields containing commas', async () => {
      const csvHtml =
        '<table><tr><td>a</td><td>b,c</td><td>d</td></tr><tr><td>1</td><td>2,3</td><td>4</td></tr></table>';
      const sheet = fakeSheet('csv-quoted');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue(csvHtml);

      await renderSpreadsheet(fakeBuffer('"a","b,c","d"'), container, {
        name: 'quoted.csv',
      });

      const cells = container.querySelectorAll('td');
      expect(cells[1].textContent).toBe('b,c');
      expect(cells[4].textContent).toBe('2,3');
    });

    it('clears previous container content before rendering CSV', async () => {
      const sheet = fakeSheet('csv-clear');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue('<table><tr><td>x</td></tr></table>');

      container.innerHTML = '<p>old content</p><div class="stale">stale</div>';
      await renderSpreadsheet(fakeBuffer('x'), container, { name: 'a.csv' });

      expect(container.querySelector('p')).toBeNull();
      expect(container.querySelector('.stale')).toBeNull();
      expect(container.querySelector('.spreadsheet-wrapper')).not.toBeNull();
    });

    it('handles CSV with special characters and HTML entities safely', async () => {
      const csvHtml =
        '<table><tr><td>&lt;script&gt;</td><td>a &amp; b</td></tr></table>';
      const sheet = fakeSheet('csv-special');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue(csvHtml);

      await renderSpreadsheet(fakeBuffer('<script>,a & b'), container, {
        name: 'special.csv',
      });

      expect(container.querySelector('script')).toBeNull();
      // jsdom injects <tbody>; check escaped content survived instead of exact innerHTML
      expect(container.querySelector('.spreadsheet-table').innerHTML).toContain('&lt;script&gt;');
      expect(container.querySelector('.spreadsheet-table').innerHTML).toContain('a &amp; b');
    });
  });

  // -------------------------------------------------------------------------
  // XLSX rendering (mock xlsx.read)
  // -------------------------------------------------------------------------

  describe('XLSX rendering (mock xlsx.read)', () => {
    it('calls XLSX.read with type array and XLSX.utils.sheet_to_html with the first sheet', async () => {
      const sheet = fakeSheet('xlsx');
      const workbook = fakeWorkbook(['Sheet1'], { Sheet1: sheet });
      XLSX.read.mockReturnValue(workbook);
      XLSX.utils.sheet_to_html.mockReturnValue('<table><tr><td>hello</td></tr></table>');

      const data = fakeBuffer('xlsx-bytes');
      const result = await renderSpreadsheet(data, container, { name: 'book.xlsx' });

      expect(XLSX.read).toHaveBeenCalledTimes(1);
      expect(XLSX.read).toHaveBeenCalledWith(data, { type: 'array' });
      expect(XLSX.utils.sheet_to_html).toHaveBeenCalledTimes(1);
      expect(XLSX.utils.sheet_to_html).toHaveBeenCalledWith(sheet);
      expect(result.content).toBe(workbook);
      expect(result.sheetNames).toEqual(['Sheet1']);
    });

    it('renders .xls file data via the same XLSX.read path', async () => {
      const sheet = fakeSheet('xls');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue('<table><tr><td>legacy</td></tr></table>');

      const data = fakeBuffer('xls-bytes');
      await renderSpreadsheet(data, container, { name: 'legacy.xls' });

      expect(XLSX.read).toHaveBeenCalledWith(data, { type: 'array' });
      expect(container.querySelector('table')).not.toBeNull();
      expect(container.textContent).toContain('legacy');
    });

    it('only renders the first sheet when workbook has multiple sheets', async () => {
      const s1 = fakeSheet('s1');
      const s2 = fakeSheet('s2');
      const s3 = fakeSheet('s3');
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Alpha', 'Beta', 'Gamma'], { Alpha: s1, Beta: s2, Gamma: s3 }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue('<table><tr><td>alpha</td></tr></table>');

      await renderSpreadsheet(fakeBuffer('multi'), container, { name: 'multi.xlsx' });

      expect(XLSX.utils.sheet_to_html).toHaveBeenCalledWith(s1);
      expect(XLSX.utils.sheet_to_html).not.toHaveBeenCalledWith(s2);
      expect(XLSX.utils.sheet_to_html).not.toHaveBeenCalledWith(s3);
      expect(container.textContent).toContain('alpha');
    });

    it('renders sheet tabs when workbook has multiple sheets', async () => {
      XLSX.read.mockReturnValue(
        fakeWorkbook(
          ['Summary', 'Details', 'Raw'],
          { Summary: fakeSheet('s1'), Details: fakeSheet('s2'), Raw: fakeSheet('s3') },
        ),
      );
      XLSX.utils.sheet_to_html.mockReturnValue('<table></table>');

      await renderSpreadsheet(fakeBuffer('tabs'), container, { name: 'tabs.xlsx' });

      const tabs = container.querySelector('.spreadsheet-tabs');
      expect(tabs).not.toBeNull();
      expect(tabs.style.marginTop).toBe('10px');
      const buttons = tabs.querySelectorAll('button');
      expect(buttons).toHaveLength(3);
      expect(buttons[0].textContent).toBe('Summary');
      expect(buttons[1].textContent).toBe('Details');
      expect(buttons[2].textContent).toBe('Raw');
      buttons.forEach((btn) => expect(btn.style.marginRight).toBe('5px'));
    });

    it('does not render sheet tabs for a single-sheet workbook', async () => {
      XLSX.read.mockReturnValue(fakeWorkbook(['Only'], { Only: fakeSheet('only') }));
      XLSX.utils.sheet_to_html.mockReturnValue('<table></table>');

      await renderSpreadsheet(fakeBuffer('single'), container, { name: 'single.xlsx' });

      expect(container.querySelector('.spreadsheet-tabs')).toBeNull();
    });

    it('returned object contains workbook, sheetNames, type and editable', async () => {
      const workbook = fakeWorkbook(['S1', 'S2'], {
        S1: fakeSheet('a'),
        S2: fakeSheet('b'),
      });
      XLSX.read.mockReturnValue(workbook);
      XLSX.utils.sheet_to_html.mockReturnValue('<table></table>');

      const result = await renderSpreadsheet(fakeBuffer('x'), container, {
        name: 'meta.xlsx',
      });

      expect(result).toEqual({
        type: 'spreadsheet',
        content: workbook,
        editable: true,
        sheetNames: ['S1', 'S2'],
      });
    });

    it('rethrows and logs when XLSX.read throws (corrupt file)', async () => {
      XLSX.read.mockImplementation(() => {
        throw new Error('Unsupported file 75');
      });

      await expect(
        renderSpreadsheet(fakeBuffer('bad'), container, { name: 'corrupt.xlsx' }),
      ).rejects.toThrow('Unsupported file 75');
      expect(console.error).toHaveBeenCalled();
    });

    it('rethrows and logs when XLSX.utils.sheet_to_html throws', async () => {
      XLSX.read.mockReturnValue(fakeWorkbook(['S1'], { S1: fakeSheet('s1') }));
      XLSX.utils.sheet_to_html.mockImplementation(() => {
        throw new Error('sheet_to_html failure');
      });

      await expect(
        renderSpreadsheet(fakeBuffer('x'), container, { name: 'fail.xlsx' }),
      ).rejects.toThrow('sheet_to_html failure');
      expect(console.error).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // TSV handling
  // -------------------------------------------------------------------------

  describe('TSV handling', () => {
    it('renders TSV data as a table via XLSX.read (type array)', async () => {
      const tsvHtml =
        '<table><tr><td>col1</td><td>col2</td></tr><tr><td>a</td><td>b</td></tr></table>';
      const sheet = fakeSheet('tsv');
      XLSX.read.mockReturnValue(fakeWorkbook(['Sheet1'], { Sheet1: sheet }));
      XLSX.utils.sheet_to_html.mockReturnValue(tsvHtml);

      const raw = 'col1\tcol2\na\tb';
      const data = new TextEncoder().encode(raw).buffer;
      const result = await renderSpreadsheet(data, container, { name: 'data.tsv' });

      expect(XLSX.read).toHaveBeenCalledWith(data, { type: 'array' });
      expect(XLSX.utils.sheet_to_html).toHaveBeenCalledWith(sheet);
      const cells = container.querySelectorAll('td');
      expect(cells[0].textContent).toBe('col1');
      expect(cells[1].textContent).toBe('col2');
      expect(cells[2].textContent).toBe('a');
      expect(result.type).toBe('spreadsheet');
    });

    it('renders TSV with many columns correctly', async () => {
      const tsvHtml =
        '<table><tr><td>h1</td><td>h2</td><td>h3</td><td>h4</td><td>h5</td></tr></table>';
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Sheet1'], { Sheet1: fakeSheet('tsv-wide') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue(tsvHtml);

      await renderSpreadsheet(fakeBuffer('h1\th2\th3\th4\th5'), container, {
        name: 'wide.tsv',
      });

      const cells = container.querySelectorAll('td');
      expect(cells).toHaveLength(5);
      expect(cells[4].textContent).toBe('h5');
    });

    it('TSV wrapper has same overflow and class structure as CSV/XLSX', async () => {
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Sheet1'], { Sheet1: fakeSheet('tsv-struct') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue('<table><tr><td>x</td></tr></table>');

      await renderSpreadsheet(fakeBuffer('x\ty'), container, { name: 's.tsv' });

      const wrapper = container.querySelector('.spreadsheet-wrapper');
      expect(wrapper).not.toBeNull();
      expect(wrapper.style.overflowX).toBe('auto');
      expect(wrapper.querySelector('.spreadsheet-table table')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Empty sheet
  // -------------------------------------------------------------------------

  describe('empty sheet', () => {
    it('throws "No sheets found in workbook" when SheetNames is empty', async () => {
      XLSX.read.mockReturnValue(fakeWorkbook([], {}));

      await expect(
        renderSpreadsheet(fakeBuffer('empty'), container, { name: 'empty.xlsx' }),
      ).rejects.toThrow('No sheets found in workbook');
    });

    it('logs the empty-workbook error via console.error', async () => {
      XLSX.read.mockReturnValue(fakeWorkbook([], {}));

      await expect(
        renderSpreadsheet(fakeBuffer('empty'), container, { name: 'empty.xlsx' }),
      ).rejects.toThrow();
      expect(console.error).toHaveBeenCalled();
    });

    it('renders an empty sheet (no rows) as an empty or minimal table without throwing', async () => {
      XLSX.read.mockReturnValue(
        fakeWorkbook(['EmptySheet'], { EmptySheet: fakeSheet('empty-sheet') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue('<table></table>');

      const result = await renderSpreadsheet(fakeBuffer('header-only'), container, {
        name: 'empty-sheet.xlsx',
      });

      expect(result.sheetNames).toEqual(['EmptySheet']);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table.querySelectorAll('tr')).toHaveLength(0);
    });

    it('renders a sheet with only headers and no data rows', async () => {
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Headers'], { Headers: fakeSheet('headers') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue(
        '<table><tr><td>Name</td><td>Score</td></tr></table>',
      );

      await renderSpreadsheet(fakeBuffer('Name,Score'), container, { name: 'h.csv' });

      const rows = container.querySelectorAll('tr');
      expect(rows).toHaveLength(1);
      expect(rows[0].querySelectorAll('td')).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Malformed CSV
  // -------------------------------------------------------------------------

  describe('malformed CSV', () => {
    it('rethrows when XLSX.read fails on malformed CSV bytes', async () => {
      XLSX.read.mockImplementation(() => {
        throw new Error('Invalid CSV: unmatched quote');
      });

      await expect(
        renderSpreadsheet(fakeBuffer('"unclosed quote,abc'), container, {
          name: 'bad.csv',
        }),
      ).rejects.toThrow('Invalid CSV: unmatched quote');
      expect(console.error).toHaveBeenCalled();
    });

    it('rethrows when sheet_to_html fails due to corrupt sheet structure', async () => {
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Sheet1'], { Sheet1: { '!corrupt': true } }),
      );
      XLSX.utils.sheet_to_html.mockImplementation(() => {
        throw new Error('Cannot convert corrupt sheet to HTML');
      });

      await expect(
        renderSpreadsheet(fakeBuffer('x'), container, { name: 'corrupt.csv' }),
      ).rejects.toThrow('Cannot convert corrupt sheet to HTML');
    });

    it('renders CSV with inconsistent column counts without throwing', async () => {
      const html =
        '<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td><td>5</td><td>6</td></tr></table>';
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Sheet1'], { Sheet1: fakeSheet('ragged') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue(html);

      const result = await renderSpreadsheet(fakeBuffer('a,b,c\n1,2\n3,4,5,6'), container, {
        name: 'ragged.csv',
      });

      expect(result.type).toBe('spreadsheet');
      expect(container.querySelectorAll('tr')).toHaveLength(3);
    });

    it('renders CSV with empty lines without throwing', async () => {
      const html =
        '<table><tr><td>a</td><td>b</td></tr><tr><td></td><td></td></tr><tr><td>1</td><td>2</td></tr></table>';
      XLSX.read.mockReturnValue(
        fakeWorkbook(['Sheet1'], { Sheet1: fakeSheet('empty-lines') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue(html);

      await expect(
        renderSpreadsheet(fakeBuffer('a,b\n\n1,2'), container, { name: 'gaps.csv' }),
      ).resolves.toBeDefined();
      expect(container.querySelectorAll('tr')).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Large sheet
  // -------------------------------------------------------------------------

  describe('large sheet', () => {
    it('renders a large sheet (1000 rows) without throwing', async () => {
      const rows = Array.from({ length: 1000 }, (_, i) => `<tr><td>${i}</td><td>val${i}</td></tr>`).join('');
      const largeHtml = `<table>${rows}</table>`;
      XLSX.read.mockReturnValue(
        fakeWorkbook(['BigSheet'], { BigSheet: fakeSheet('big') }),
      );
      XLSX.utils.sheet_to_html.mockReturnValue(largeHtml);

      const result = await renderSpreadsheet(fakeBuffer('big'), container, {
        name: 'big.xlsx',
      });

      expect(result.sheetNames).toEqual(['BigSheet']);
      expect(container.querySelectorAll('tr')).toHaveLength(1000);
      expect(container.querySelector('.spreadsheet-wrapper').style.overflowX).toBe('auto');
    });

    it('renders a large sheet with many columns (50 columns, 100 rows)', async () => {
      const headerCells = Array.from({ length: 50 }, (_, i) => `<td>H${i}</td>`).join('');
      const rowCells = Array.from({ length: 50 }, (_, i) => `<td>${i}</td>`).join('');
      const rows = [`<tr>${headerCells}</tr>`]
        .concat(Array.from({ length: 100 }, () => `<tr>${rowCells}</tr>`))
        .join('');
      const wideHtml = `<table>${rows}</table>`;

      XLSX.read.mockReturnValue(fakeWorkbook(['Wide'], { Wide: fakeSheet('wide') }));
      XLSX.utils.sheet_to_html.mockReturnValue(wideHtml);

      await renderSpreadsheet(fakeBuffer('wide'), container, { name: 'wide.xlsx' });

      const allRows = container.querySelectorAll('tr');
      expect(allRows).toHaveLength(101);
      expect(allRows[0].querySelectorAll('td')).toHaveLength(50);
      expect(allRows[1].querySelectorAll('td')).toHaveLength(50);
    });

    it('still renders tabs correctly on a large multi-sheet workbook', async () => {
      const sheets = {};
      const names = Array.from({ length: 10 }, (_, i) => `Sheet${i + 1}`);
      names.forEach((n) => (sheets[n] = fakeSheet(n)));
      const rows = Array.from({ length: 500 }, (_, i) => `<tr><td>${i}</td></tr>`).join('');
      XLSX.read.mockReturnValue(fakeWorkbook(names, sheets));
      XLSX.utils.sheet_to_html.mockReturnValue(`<table>${rows}</table>`);

      await renderSpreadsheet(fakeBuffer('many-sheets'), container, {
        name: 'many.xlsx',
      });

      expect(container.querySelectorAll('tr')).toHaveLength(500);
      expect(container.querySelector('.spreadsheet-tabs').querySelectorAll('button')).toHaveLength(10);
    });

    it('container wrapper contains exactly one spreadsheet-table child even for large data', async () => {
      const rows = Array.from({ length: 200 }, (_, i) => `<tr><td>${i}</td></tr>`).join('');
      XLSX.read.mockReturnValue(fakeWorkbook(['S1'], { S1: fakeSheet('s1') }));
      XLSX.utils.sheet_to_html.mockReturnValue(`<table>${rows}</table>`);

      await renderSpreadsheet(fakeBuffer('x'), container, { name: 'x.xlsx' });

      const wrapper = container.querySelector('.spreadsheet-wrapper');
      expect(wrapper.querySelectorAll('.spreadsheet-table')).toHaveLength(1);
      expect(wrapper.querySelectorAll('table')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // General contract / edge cases
  // -------------------------------------------------------------------------

  describe('general contract', () => {
    it('passes docMeta through without mutating container on failure', async () => {
      XLSX.read.mockImplementation(() => {
        throw new Error('boom');
      });
      container.innerHTML = '<p>original</p>';

      await expect(
        renderSpreadsheet(fakeBuffer('x'), container, { name: 'fail.xlsx' }),
      ).rejects.toThrow('boom');
      expect(container.innerHTML).toBe('<p>original</p>');
    });

    it('second render call replaces output of the first', async () => {
      const sheet = fakeSheet('s1');
      XLSX.read.mockReturnValue(fakeWorkbook(['S1'], { S1: sheet }));
      XLSX.utils.sheet_to_html
        .mockReturnValueOnce('<table><tr><td>first</td></tr></table>')
        .mockReturnValueOnce('<table><tr><td>second</td></tr></table>');

      await renderSpreadsheet(fakeBuffer('first'), container, { name: 'a.xlsx' });
      expect(container.textContent).toContain('first');

      await renderSpreadsheet(fakeBuffer('second'), container, { name: 'b.xlsx' });
      expect(container.textContent).toContain('second');
      expect(container.textContent).not.toContain('first');
      expect(container.querySelectorAll('.spreadsheet-wrapper')).toHaveLength(1);
      expect(XLSX.utils.sheet_to_html).toHaveBeenCalledTimes(2);
    });

    it('wrapper and table container have the expected class names', async () => {
      XLSX.read.mockReturnValue(fakeWorkbook(['S1'], { S1: fakeSheet('s1') }));
      XLSX.utils.sheet_to_html.mockReturnValue('<table></table>');

      await renderSpreadsheet(fakeBuffer('x'), container, { name: 'x.xlsx' });

      expect(container.querySelector('.spreadsheet-wrapper')).not.toBeNull();
      expect(container.querySelector('.spreadsheet-table')).not.toBeNull();
      expect(container.querySelector('table')).not.toBeNull();
    });
  });
});
