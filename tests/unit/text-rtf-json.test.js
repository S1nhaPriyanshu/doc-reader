/**
 * Unit tests for:
 * - src/services/rtf-service.js  (rtfToHtml, extractRtfText, renderRtf)
 * - src/services/json-service.js (renderJson)
 * - src/services/text-service.js (renderText, renderMarkdown)
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rtfToHtml, extractRtfText, renderRtf } from '../../src/services/rtf-service.js';
import { renderJson } from '../../src/services/json-service.js';
import { renderText, renderMarkdown } from '../../src/services/text-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode string to ArrayBuffer via UTF-8 */
function strToAB(str) {
  const u8 = new TextEncoder().encode(str);
  // Slice to exact byte length (TextEncoder may share underlying buffer)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

/** Create a fresh container div (not attached to document) */
function freshContainer() {
  return document.createElement('div');
}

// ===========================================================================
// rtfToHtml
// ===========================================================================
describe('rtfToHtml', () => {
  // --- empty / invalid inputs ---
  describe('empty and invalid inputs', () => {
    it('returns empty string for empty string', () => {
      expect(rtfToHtml('')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(rtfToHtml(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(rtfToHtml(undefined)).toBe('');
    });

    it('returns empty string for a number', () => {
      expect(rtfToHtml(123)).toBe('');
    });

    it('returns empty string for an object', () => {
      expect(rtfToHtml({})).toBe('');
    });

    it('returns placeholder <p></p> for RTF with no paragraphs (only header)', () => {
      expect(rtfToHtml('{\\rtf1\\ansi}')).toBe('<p></p>');
    });

    it('returns placeholder <p></p> for RTF containing only \\par header', () => {
      expect(rtfToHtml('{\\rtf1\\ansi\\par}')).toBe('<p></p>');
    });

    it('returns placeholder <p></p> for RTF with only whitespace paragraphs', () => {
      expect(rtfToHtml('{\\rtf1\\ansi   \\par}')).toBe('<p></p>');
    });
  });

  // --- paragraphs ---
  describe('paragraphs', () => {
    it('wraps plain text in a paragraph with left alignment', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Hello World\\par}');
      expect(out).toContain('<p');
      expect(out).toContain('Hello World');
      expect(out).toContain('text-align:left');
    });

    it('produces multiple paragraphs for multiple \\par', () => {
      const out = rtfToHtml('{\\rtf1\\ansi First\\par Second\\par}');
      // Two <p> elements
      const count = (out.match(/<p/g) || []).length;
      expect(count).toBe(2);
      expect(out).toContain('First');
      expect(out).toContain('Second');
    });

    it('separates paragraphs with newline', () => {
      const out = rtfToHtml('{\\rtf1\\ansi A\\par B\\par}');
      expect(out).toContain('</p>\n<p');
    });

    it('flushes trailing content after loop (no trailing \\par)', () => {
      // Text after last \\par should still be wrapped
      const out = rtfToHtml('{\\rtf1\\ansi Hello World\\par trailing}');
      expect(out).toContain('Hello World');
      expect(out).toContain('trailing');
    });

    it('handles \\line as <br/> inside paragraph', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Line1\\line Line2\\par}');
      expect(out).toContain('<br');
      expect(out).toContain('Line1');
      expect(out).toContain('Line2');
    });

    it('handles \\tab as em-space', () => {
      const out = rtfToHtml('{\\rtf1\\ansi A\\tab B\\par}');
      // Implementation uses &emsp; which jsdom/DOMPurify may encode as literal em-space
      expect(out).toContain('A');
      expect(out).toContain('B');
      // Either &emsp; or its unicode equivalent indicates tab handling
      const hasTab = out.includes('&emsp;') || out.includes('\u2003') || out.includes(' ');
      expect(hasTab).toBe(true);
    });
  });

  // --- bold ---
  describe('bold', () => {
    it('emits <strong> for \\b', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\b Bold text\\b0} normal\\par}');
      expect(out).toContain('<strong>');
      expect(out).toContain('Bold text');
      expect(out).toContain('</strong>');
    });

    it('closes bold with \\b0', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\b Bold\\b0} after\\par}');
      expect(out).toContain('</strong>');
      expect(out).toContain('after');
      // Bold should not wrap "after"
      const strongSection = out.slice(out.indexOf('<strong>'), out.indexOf('</strong>') + 9);
      expect(strongSection).not.toContain('after');
    });

    it('supports \\b without numeric parameter as bold-on', () => {
      const out = rtfToHtml('{\\rtf1\\ansi \\b Bold\\b0\\par}');
      expect(out).toContain('<strong>');
    });
  });

  // --- italic ---
  describe('italic', () => {
    it('emits <em> for \\i', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\i Italic text\\i0} normal\\par}');
      expect(out).toContain('<em>');
      expect(out).toContain('Italic text');
      expect(out).toContain('</em>');
    });

    it('closes italic with \\i0', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\i Italic\\i0} after\\par}');
      const emSection = out.slice(out.indexOf('<em>'), out.indexOf('</em>') + 5);
      expect(emSection).not.toContain('after');
    });
  });

  // --- underline ---
  describe('underline', () => {
    it('emits <u> for \\ul and closes with \\ulnone', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\ul Underlined\\ulnone} normal\\par}');
      expect(out).toContain('<u>');
      expect(out).toContain('Underlined');
      expect(out).toContain('</u>');
    });
  });

  // --- strikethrough ---
  describe('strikethrough', () => {
    it('emits <del> for \\strike', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\strike Strike\\strike0}\\par}');
      expect(out).toContain('<del>');
      expect(out).toContain('Strike');
      expect(out).toContain('</del>');
    });

    it('closes strike with \\strike0', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\strike X\\strike0} Y\\par}');
      const delSection = out.slice(out.indexOf('<del>'), out.indexOf('</del>') + 6);
      expect(delSection).not.toContain('Y');
    });
  });

  // --- combined formatting via nested groups ---
  describe('nested formatting groups', () => {
    it('handles bold wrapping italic via nested groups', () => {
      const out = rtfToHtml('{\\rtf1\\ansi {\\b {\\i BoldItalic\\i0}\\b0}\\par}');
      expect(out).toContain('<strong>');
      expect(out).toContain('<em>');
      expect(out).toContain('BoldItalic');
    });

    it('isolates formatting to group scope', () => {
      const out = rtfToHtml('{\\rtf1\\ansi outer {\\b bold\\b0} end\\par}');
      expect(out).toContain('outer');
      expect(out).toContain('<strong>bold</strong>');
      expect(out).toContain('end');
      // "outer" and "end" must be outside <strong>
      expect(out.indexOf('outer')).toBeLessThan(out.indexOf('<strong>'));
      expect(out.indexOf('</strong>')).toBeLessThan(out.indexOf('end'));
    });

    it('handles deeply nested groups', () => {
      const out = rtfToHtml('{\\rtf1\\ansi a {b {c\\b d\\b0} e} f\\par}');
      expect(out).toContain('a');
      expect(out).toContain('f');
      expect(out).toContain('<strong>d</strong>');
    });
  });

  // --- alignment ---
  describe('alignment', () => {
    it('applies center alignment via \\qc', () => {
      const out = rtfToHtml('{\\rtf1\\ansi\\qc Centered text\\par}');
      expect(out).toContain('text-align:center');
      expect(out).toContain('Centered text');
    });

    it('applies right alignment via \\qr', () => {
      const out = rtfToHtml('{\\rtf1\\ansi\\qr Right\\par}');
      expect(out).toContain('text-align:right');
    });

    it('applies justify via \\qj', () => {
      const out = rtfToHtml('{\\rtf1\\ansi\\qj Justified\\par}');
      expect(out).toContain('text-align:justify');
    });

    it('resets to left via \\ql after center', () => {
      const out = rtfToHtml('{\\rtf1\\ansi\\qc Centered\\par\\ql Left\\par}');
      expect(out).toContain('text-align:center');
      expect(out).toContain('text-align:left');
      expect(out).toContain('Centered');
      expect(out).toContain('Left');
    });
  });

  // --- lists (implicit paragraph handling) ---
  describe('lists (paragraph-based)', () => {
    it('renders consecutive \\par items as separate paragraphs', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Item 1\\par Item 2\\par Item 3\\par}');
      const count = (out.match(/<p/g) || []).length;
      expect(count).toBe(3);
      expect(out).toContain('Item 1');
      expect(out).toContain('Item 2');
      expect(out).toContain('Item 3');
    });

    it('renders bullet-like paragraphs (RTF has no semantic list, uses paragraphs)', () => {
      // Common RTF bullet pattern: each bullet is a paragraph
      const out = rtfToHtml('{\\rtf1\\ansi - Bullet one\\par - Bullet two\\par}');
      expect(out).toContain('Bullet one');
      expect(out).toContain('Bullet two');
      expect((out.match(/<p/g) || []).length).toBe(2);
    });
  });

  // --- unicode ---
  describe('unicode', () => {
    it('decodes positive \\u codepoint', () => {
      // \\u1045 is U+0415 Cyrillic Е
      const out = rtfToHtml('{\\rtf1\\ansi \\u1045?\\par}');
      expect(out).toContain(String.fromCharCode(1045));
    });

    it('decodes negative \\u codepoint (wraps via +65536)', () => {
      // \\u-1234 => 65536-1234 = 64302
      const out = rtfToHtml('{\\rtf1\\ansi \\u-1234?\\par}');
      expect(out).toContain(String.fromCharCode(64302));
    });

    it('consumes trailing ? after \\u when present', () => {
      const out = rtfToHtml('{\\rtf1\\ansi \\u1045?rest\\par}');
      expect(out).toContain(String.fromCharCode(1045));
      // The substitution char ? should not appear
      // "rest" should follow immediately
      expect(out).toContain('rest');
      expect(out).not.toContain('?rest');
    });

    it('handles \\u without trailing ?', () => {
      const out = rtfToHtml('{\\rtf1\\ansi \\u1045 \\par}');
      expect(out).toContain(String.fromCharCode(1045));
    });

    it('handles multiple unicode escapes', () => {
      const out = rtfToHtml('{\\rtf1\\ansi \\u1045?\\u1046?\\par}');
      expect(out).toContain(String.fromCharCode(1045));
      expect(out).toContain(String.fromCharCode(1046));
    });
  });

  // --- hex escapes ---
  describe('hex escapes', () => {
    it("decodes \\'xx hex escapes", () => {
      // \'48=\'H\', \'65=\'e\' etc. => "Hello"
      const out = rtfToHtml("{\\rtf1\\ansi \\'48\\'65\\'6c\\'6c\\'6f\\par}");
      expect(out).toContain('Hello');
    });

    it("handles single hex escape", () => {
      const out = rtfToHtml("{\\rtf1\\ansi \\'41\\par}");
      expect(out).toContain('A');
    });
  });

  // --- escaped special characters ---
  describe('escaped special characters', () => {
    it('handles escaped backslash \\\\', () => {
      const out = rtfToHtml('{\\rtf1\\ansi \\\\test\\par}');
      expect(out).toContain('\\test');
    });

    it('handles escaped opening brace \\{', () => {
      const out = rtfToHtml('{\\rtf1\\ansi \\{brace\\par}');
      expect(out).toContain('{brace');
    });

    it('handles escaped closing brace \\}', () => {
      const out = rtfToHtml('{\\rtf1\\ansi brace\\}\\par}');
      expect(out).toContain('brace}');
    });
  });

  // --- HTML escaping / sanitization ---
  describe('HTML escaping and sanitization', () => {
    it('escapes < and > in text content', () => {
      const out = rtfToHtml('{\\rtf1\\ansi <b>tag</b>\\par}');
      // Raw <b> must not appear unescaped outside of formatting tags
      // The sanitizer will keep our own <strong>/<em> but escape literal angle brackets
      expect(out).toContain('&lt;');
      expect(out).toContain('&gt;');
    });

    it('escapes & in text content', () => {
      const out = rtfToHtml('{\\rtf1\\ansi A & B\\par}');
      expect(out).toContain('&amp;');
    });

    it('DOMPurify strips disallowed tags (e.g. script not injected)', () => {
      const out = rtfToHtml('{\\rtf1\\ansi <script>alert(1)</script>\\par}');
      // Should be escaped, not executable
      expect(out).not.toContain('<script>');
      expect(out).toContain('&lt;script&gt;');
    });
  });

  // --- ignorable destinations ---
  describe('ignorable destinations', () => {
    it('ignores fonttbl content', () => {
      const out = rtfToHtml('{\\rtf1\\ansi{\\fonttbl{\\f0\\fswiss Arial;}}Hello\\par}');
      expect(out).toContain('Hello');
      expect(out).not.toContain('Arial');
      expect(out).not.toContain('fonttbl');
    });

    it('ignores colortbl content', () => {
      const out = rtfToHtml('{\\rtf1\\ansi{\\colortbl;\\red255\\green0\\blue0;}Hello\\par}');
      expect(out).toContain('Hello');
      expect(out).not.toContain('255');
    });

    it('still renders text after ignorable destination', () => {
      const out = rtfToHtml('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}Before\\par After\\par}');
      expect(out).toContain('Before');
      expect(out).toContain('After');
    });

    it('ignores pict destination', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Before{\\pict data}After\\par}');
      expect(out).toContain('Before');
      expect(out).toContain('After');
      expect(out).not.toContain('pict');
    });

    it('ignores \\* destinations', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Hello{\\*\\generator test} World\\par}');
     expect(out).toContain('Hello');
      expect(out).toContain('World');
    });
  });

  // --- output structure ---
  describe('output structure', () => {
    it('produces valid paragraph HTML with closing tags', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Hello\\par}');
      expect(out).toMatch(/<p[^>]*>.*<\/p>/);
    });

    it('never produces empty inner paragraph when content exists', () => {
      const out = rtfToHtml('{\\rtf1\\ansi Content\\par}');
      expect(out).not.toBe('<p></p>');
      expect(out).toContain('Content');
    });
  });
});

// ===========================================================================
// extractRtfText
// ===========================================================================
describe('extractRtfText', () => {
  it('strips RTF formatting tags and returns plain text', () => {
    const rtf = '{\\rtf1\\ansi {\\b Bold\\b0} and {\\i italic\\i0}\\par Next line\\par}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    expect(text).toContain('Bold');
    expect(text).toContain('and');
    expect(text).toContain('italic');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('<em>');
    expect(text).not.toContain('\\b');
    expect(text).not.toContain('\\i');
  });

  it('strips HTML-like content and returns text without tags', () => {
    const rtf = '{\\rtf1\\ansi Hello <b>tag</b> & entity\\par}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    // Should contain the visible words but not RTF/HTML tag syntax
    expect(text).toContain('Hello');
    expect(text).toContain('tag');
    expect(text).not.toContain('\\par');
  });

  it('decodes unicode escapes into characters', () => {
    const rtf = '{\\rtf1\\ansi \\u1045?\\par}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    expect(text).toContain(String.fromCharCode(1045));
    expect(text).not.toContain('\\u1045');
  });

  it('strips bold/underline/strike markup fully', () => {
    const rtf = '{\\rtf1\\ansi {\\ul Underlined\\ulnone} and {\\strike Struck\\strike0}\\par}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    expect(text).toContain('Underlined');
    expect(text).toContain('Struck');
    expect(text).not.toContain('<u>');
    expect(text).not.toContain('<del>');
  });

  it('returns empty or whitespace for RTF with no visible text', () => {
    const rtf = '{\\rtf1\\ansi}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    expect(text.trim()).toBe('');
  });

  it('does not include ignorable destination content', () => {
    const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0\\fswiss Arial;}}Visible\\par}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    expect(text).toContain('Visible');
    expect(text).not.toContain('Arial');
  });

  it('preserves readable text across multiple paragraphs', () => {
    const rtf = '{\\rtf1\\ansi First paragraph\\par Second paragraph\\par}';
    const ab = strToAB(rtf);
    const text = extractRtfText(ab);
    expect(text).toContain('First paragraph');
    expect(text).toContain('Second paragraph');
  });
});

// ===========================================================================
// renderRtf
// ===========================================================================
describe('renderRtf', () => {
  it('renders HTML into container with html-content rtf-content wrapper', async () => {
    const rtf = '{\\rtf1\\ansi {\\b Hello\\b0} World\\par}';
    const ab = strToAB(rtf);
    const container = freshContainer();
    const result = await renderRtf(ab, container, {});

    expect(result.type).toBe('html');
    expect(result.editable).toBe(true);
    expect(result.content).toContain('Hello');
    expect(container.innerHTML).toContain('html-content');
    expect(container.innerHTML).toContain('rtf-content');
    // Bold should be in the rendered DOM
    expect(container.innerHTML).toContain('<strong>');
  });

  it('clears previous container content', async () => {
    const container = freshContainer();
    container.innerHTML = '<p>old content</p>';
    const rtf = '{\\rtf1\\ansi New\\par}';
    const ab = strToAB(rtf);
    await renderRtf(ab, container, {});
    expect(container.innerHTML).not.toContain('old content');
    expect(container.innerHTML).toContain('New');
  });

  it('returns content HTML string in result', async () => {
    const rtf = '{\\rtf1\\ansi Simple\\par}';
    const ab = strToAB(rtf);
    const container = freshContainer();
    const result = await renderRtf(ab, container, {});
    expect(result.content).toContain('Simple');
    expect(typeof result.content).toBe('string');
  });

  it('wrapper is appended as single child of container', async () => {
    const rtf = '{\\rtf1\\ansi Hello\\par}';
    const ab = strToAB(rtf);
    const container = freshContainer();
    await renderRtf(ab, container, {});
    expect(container.children.length).toBe(1);
    expect(container.firstElementChild.className).toContain('html-content');
    expect(container.firstElementChild.className).toContain('rtf-content');
  });

  it('handles empty RTF gracefully', async () => {
    const rtf = '{\\rtf1\\ansi\\par}';
    const ab = strToAB(rtf);
    const container = freshContainer();
    const result = await renderRtf(ab, container, {});
    expect(result.type).toBe('html');
    expect(container.firstElementChild).not.toBeNull();
  });
});

// ===========================================================================
// renderJson
// ===========================================================================
describe('renderJson', () => {
  it('formats simple JSON object as pretty-printed code', async () => {
    const data = { a: 1, b: 'hello' };
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    const result = await renderJson(ab, container, {});

    expect(result.type).toBe('json');
    expect(result.editable).toBe(true);
    expect(result.content).toEqual(data);
    expect(container.innerHTML).toContain('json-viewer');
    expect(container.innerHTML).toContain('json-code-content');
    // Pretty printed (2-space indent) — verify via textContent (innerHTML serializes quotes literally)
    const codeEl = container.querySelector('code');
    expect(codeEl.textContent).toContain('"a": 1');
    expect(codeEl.textContent).toContain('"b": "hello"');
  });

  it('escapes HTML characters in JSON values (e.g. <script>)', async () => {
    const data = { xss: '<script>alert(1)</script>' };
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('escapes HTML in JSON keys', async () => {
    const payload = JSON.stringify({ '<img src=x onerror=alert(1)>': 'evil' });
    const ab = strToAB(payload);
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('<img');
    expect(container.innerHTML).toContain('&lt;img');
  });

  it('throws for invalid JSON with descriptive message', async () => {
    const ab = strToAB('{ not: valid json }');
    const container = freshContainer();
    await expect(renderJson(ab, container, {})).rejects.toThrow(/Invalid JSON format/);
  });

  it('throws for truncated JSON', async () => {
    const ab = strToAB('{"a": 1,');
    const container = freshContainer();
    await expect(renderJson(ab, container, {})).rejects.toThrow(/Invalid JSON format/);
  });

  it('throws for empty input (not valid JSON)', async () => {
    const ab = strToAB('');
    const container = freshContainer();
    await expect(renderJson(ab, container, {})).rejects.toThrow(/Invalid JSON format/);
  });

  it('renders array-of-objects as dataset table', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    const result = await renderJson(ab, container, {});

    expect(result.type).toBe('json');
    expect(container.innerHTML).toContain('DATASET');
    expect(container.innerHTML).toContain('2 rows');
    expect(container.innerHTML).toContain('<table>');
    expect(container.innerHTML).toContain('<th>');
    expect(container.innerHTML).toContain('Alice');
    expect(container.innerHTML).toContain('Bob');
    expect(container.innerHTML).toContain('Raw JSON');
  });

  it('handles array-of-objects with varying keys (union of keys)', async () => {
    const data = [{ a: 1 }, { b: 2 }, { a: 3, b: 4 }];
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).toContain('<th>a</th>');
    expect(container.innerHTML).toContain('<th>b</th>');
    expect(container.innerHTML).toContain('3 rows');
  });

  it('does not render table for empty array', async () => {
    const ab = strToAB(JSON.stringify([]));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('DATASET');
    expect(container.innerHTML).not.toContain('<table>');
    expect(container.innerHTML).toContain('json-code-content');
  });

  it('does not render table for array of primitives', async () => {
    const ab = strToAB(JSON.stringify([1, 2, 3]));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('DATASET');
    expect(container.innerHTML).not.toContain('<table>');
  });

  it('does not render table for array with null first element', async () => {
    const ab = strToAB(JSON.stringify([null, { a: 1 }]));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('DATASET');
  });

  it('truncates large datasets to 100 rows and shows note', async () => {
    const data = Array.from({ length: 120 }, (_, i) => ({ id: i, val: `v${i}` }));
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).toContain('Showing first 100 rows of 120');
    // Row 101 should not be in the table body
    expect(container.innerHTML).not.toContain('<td>v100</td>');
    // But first row should
    expect(container.innerHTML).toContain('v0');
    expect(container.innerHTML).toContain('v99');
  });

  it('does not show truncation note for exactly 100 rows', async () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('Showing first 100');
  });

  it('handles nested JSON object (non-tabular)', async () => {
    const data = { outer: { inner: [1, 2, 3] }, flag: true };
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    const result = await renderJson(ab, container, {});
    expect(result.content).toEqual(data);
    // Not array-of-objects so no table
    expect(container.innerHTML).not.toContain('DATASET');
    expect(container.querySelector('code').textContent).toContain('"outer"');
  });

  it('handles JSON null and primitives without table', async () => {
    for (const val of ['null', '42', '"hello"', 'true']) {
      const ab = strToAB(val);
      const container = freshContainer();
      const result = await renderJson(ab, container, {});
      expect(result.type).toBe('json');
      expect(container.innerHTML).not.toContain('DATASET');
    }
  });

  it('escapes table cell values', async () => {
    const data = [{ name: '<b>bold</b>' }];
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('<b>bold</b>');
    expect(container.innerHTML).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('wraps content in json-viewer class', async () => {
    const ab = strToAB(JSON.stringify({ a: 1 }));
    const container = freshContainer();
    await renderJson(ab, container, {});
    expect(container.firstElementChild.className).toContain('json-viewer');
  });

  it('clears container before appending', async () => {
    const ab = strToAB(JSON.stringify({ a: 1 }));
    const container = freshContainer();
    container.innerHTML = '<p>old</p>';
    await renderJson(ab, container, {});
    expect(container.innerHTML).not.toContain('old');
  });

  it('returns raw text in result.raw', async () => {
    const raw = '{"a":1}';
    const ab = strToAB(raw);
    const container = freshContainer();
    const result = await renderJson(ab, container, {});
    expect(result.raw).toBe(raw);
  });

  it('preserves unicode in JSON values', async () => {
    const data = { greeting: 'héllo 🌍' };
    const ab = strToAB(JSON.stringify(data));
    const container = freshContainer();
    const result = await renderJson(ab, container, {});
    expect(result.content.greeting).toBe('héllo 🌍');
    expect(container.querySelector('code').textContent).toContain('héllo 🌍');
  });

  // Note: renderJson currently does not switch on dark/light mode;
  // styling is handled via CSS. The "dark/light" coverage here ensures the
  // rendering is not theme-dependent (no inline dark/light logic to break).
  it('renders identically regardless of document theme class', async () => {
    const payload = JSON.stringify({ a: 1 });
    const ab1 = strToAB(payload);
    const ab2 = strToAB(payload);
    const c1 = freshContainer();
    const c2 = freshContainer();
    // Simulate light theme
    document.documentElement.classList.remove('dark');
    await renderJson(ab1, c1, {});
    // Simulate dark theme
    document.documentElement.classList.add('dark');
    await renderJson(ab2, c2, {});
    // Cleanup
    document.documentElement.classList.remove('dark');
    // HTML structure should be identical (CSS handles theming)
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });
});

// ===========================================================================
// renderText
// ===========================================================================
describe('renderText', () => {
  it('renders text inside a <pre> with class text-content', async () => {
    const ab = strToAB('Hello World');
    const container = freshContainer();
    const result = await renderText(ab, container, {});
    expect(result.type).toBe('text');
    expect(result.editable).toBe(true);
    expect(result.content).toBe('Hello World');
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre.className).toContain('text-content');
  });

  it('escapes HTML (uses textContent, so <script> is inert)', async () => {
    const raw = '<script>alert(1)</script> & hello <b>bold</b>';
    const ab = strToAB(raw);
    const container = freshContainer();
    await renderText(ab, container, {});
    const pre = container.querySelector('pre');
    // textContent preserves raw string exactly
    expect(pre.textContent).toBe(raw);
    // innerHTML should have escaped versions
    expect(container.innerHTML).toContain('&lt;script&gt;');
    expect(container.innerHTML).toContain('&amp;');
    expect(container.innerHTML).toContain('&lt;b&gt;');
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('preserves whitespace, newlines and indentation', async () => {
    const raw = 'line 1\n  indented\n\t\ttabbed\n\nblank above';
    const ab = strToAB(raw);
    const container = freshContainer();
    await renderText(ab, container, {});
    const pre = container.querySelector('pre');
    expect(pre.textContent).toBe(raw);
  });

  it('handles empty file', async () => {
    const ab = strToAB('');
    const container = freshContainer();
    const result = await renderText(ab, container, {});
    expect(result.content).toBe('');
    expect(container.querySelector('pre').textContent).toBe('');
  });

  it('handles multiline with trailing newline', async () => {
    const raw = 'a\nb\nc\n';
    const ab = strToAB(raw);
    const container = freshContainer();
    await renderText(ab, container, {});
    expect(container.querySelector('pre').textContent).toBe(raw);
  });

  it('handles unicode and emoji', async () => {
    const raw = 'héllo 🌍 — test';
    const ab = strToAB(raw);
    const container = freshContainer();
    const result = await renderText(ab, container, {});
    expect(result.content).toBe(raw);
    expect(container.querySelector('pre').textContent).toBe(raw);
  });

  it('clears previous container content', async () => {
    const container = freshContainer();
    container.innerHTML = '<div>old</div>';
    const ab = strToAB('new');
    await renderText(ab, container, {});
    expect(container.innerHTML).not.toContain('old');
    expect(container.innerHTML).toContain('new');
  });

  it('appends exactly one <pre> child', async () => {
    const ab = strToAB('hello');
    const container = freshContainer();
    await renderText(ab, container, {});
    expect(container.children.length).toBe(1);
    expect(container.firstElementChild.tagName.toLowerCase()).toBe('pre');
  });

  it('handles very long text without truncation', async () => {
    const raw = 'x'.repeat(50000);
    const ab = strToAB(raw);
    const container = freshContainer();
    const result = await renderText(ab, container, {});
    expect(result.content.length).toBe(50000);
    expect(container.querySelector('pre').textContent.length).toBe(50000);
  });
});

// ===========================================================================
// renderMarkdown
// ===========================================================================
describe('renderMarkdown', () => {
  it('renders headings (h1, h2, h3) via markdown-it', async () => {
    const md = '# Title\n## Subtitle\n### Section\n';
    const ab = strToAB(md);
    const container = freshContainer();
    const result = await renderMarkdown(ab, container, {});
    expect(result.type).toBe('markdown');
    expect(result.editable).toBe(true);
    expect(result.content.raw).toBe(md);
    expect(container.innerHTML).toContain('<h1>Title</h1>');
    expect(container.innerHTML).toContain('<h2>Subtitle</h2>');
    expect(container.innerHTML).toContain('<h3>Section</h3>');
  });

  it('renders unordered lists', async () => {
    const md = '- item 1\n- item 2\n- item 3\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<ul>');
    expect(container.innerHTML).toContain('<li>item 1</li>');
    expect(container.innerHTML).toContain('<li>item 2</li>');
    expect(container.innerHTML).toContain('<li>item 3</li>');
    expect(container.innerHTML).toContain('</ul>');
  });

  it('renders ordered lists', async () => {
    const md = '1. first\n2. second\n3. third\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<ol>');
    expect(container.innerHTML).toContain('<li>first</li>');
    expect(container.innerHTML).toContain('<li>second</li>');
    expect(container.innerHTML).toContain('</ol>');
  });

  it('renders both bullet and ordered lists in same document', async () => {
    const md = '- a\n- b\n\n1. one\n2. two\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<ul>');
    expect(container.innerHTML).toContain('<ol>');
  });

  it('renders nested lists', async () => {
    const md = '- parent\n  - child\n  - child 2\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('parent');
    expect(container.innerHTML).toContain('child');
  });

  it('renders fenced code blocks with language class', async () => {
    const md = '```js\nconsole.log(1)\n```\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<pre>');
    expect(container.innerHTML).toContain('<code');
    expect(container.innerHTML).toContain('console.log(1)');
    expect(container.innerHTML).toContain('language-js');
  });

  it('renders code block without language', async () => {
    const md = '```\nplain code\n```\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('plain code');
    expect(container.innerHTML).toContain('<pre>');
  });

  it('renders inline code', async () => {
    const md = 'Use `code` here\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<code>code</code>');
  });

  it('renders inline bold and italic', async () => {
    const md = '**bold** *italic* `code`';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<strong>bold</strong>');
    expect(container.innerHTML).toContain('<em>italic</em>');
    expect(container.innerHTML).toContain('<code>code</code>');
  });

  it('renders tables (GFM) via markdown-it', async () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<table>');
    expect(container.innerHTML).toContain('<thead>');
    expect(container.innerHTML).toContain('<tbody>');
    expect(container.innerHTML).toContain('<th>a</th>');
    expect(container.innerHTML).toContain('<th>b</th>');
    expect(container.innerHTML).toContain('<td>1</td>');
    expect(container.innerHTML).toContain('<td>4</td>');
  });

  it('renders table with aligned columns', async () => {
    const md = '| left | center | right |\n|:-----|:------:|------:|\n| a | b | c |\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<table>');
    expect(container.innerHTML).toContain('left');
    expect(container.innerHTML).toContain('center');
  });

  it('renders blockquote', async () => {
    const md = '> quoted text\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<blockquote>');
    expect(container.innerHTML).toContain('quoted text');
  });

  it('renders horizontal rule', async () => {
    const md = '---\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<hr');
  });

  it('renders link', async () => {
    const md = '[click](https://example.com)\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<a href="https://example.com">');
    expect(container.innerHTML).toContain('click');
  });

  it('renders image', async () => {
    const md = '![alt](https://example.com/img.png)\n';
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<img');
    expect(container.innerHTML).toContain('alt="alt"');
  });

  it('wraps output in html-content markdown-content div', async () => {
    const ab = strToAB('# Hello');
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.firstElementChild.className).toContain('html-content');
    expect(container.firstElementChild.className).toContain('markdown-content');
  });

  it('returns both raw and html in result.content', async () => {
    const md = '# Title\n';
    const ab = strToAB(md);
    const container = freshContainer();
    const result = await renderMarkdown(ab, container, {});
    expect(result.content.raw).toBe(md);
    expect(result.content.html).toContain('<h1>Title</h1>');
  });

  it('handles empty markdown', async () => {
    const ab = strToAB('');
    const container = freshContainer();
    const result = await renderMarkdown(ab, container, {});
    expect(result.type).toBe('markdown');
    expect(container.firstElementChild).not.toBeNull();
  });

  it('clears previous container content', async () => {
    const container = freshContainer();
    container.innerHTML = '<p>old</p>';
    const ab = strToAB('# New');
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).not.toContain('old');
    expect(container.innerHTML).toContain('<h1>New</h1>');
  });

  it('handles complex mixed markdown document', async () => {
    const md = [
      '# Title',
      '',
      'Paragraph with **bold** and *italic*.',
      '',
      '- item 1',
      '- item 2',
      '',
      '| col1 | col2 |',
      '|------|------|',
      '| a    | b    |',
      '',
      '```python',
      'print("hello")',
      '```',
    ].join('\n');
    const ab = strToAB(md);
    const container = freshContainer();
    await renderMarkdown(ab, container, {});
    expect(container.innerHTML).toContain('<h1>Title</h1>');
    expect(container.innerHTML).toContain('<strong>bold</strong>');
    expect(container.innerHTML).toContain('<ul>');
    expect(container.innerHTML).toContain('<table>');
    expect(container.innerHTML).toContain('print');
  });
});

