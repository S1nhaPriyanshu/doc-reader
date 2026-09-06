/**
 * Unit tests for src/utils/theme.js
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTheme, setTheme, toggleTheme } from '../../src/utils/theme.js';

function makeMatchMedia(matches) {
  const listeners = new Set();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener(event, cb) { if (event === 'change') listeners.add(cb); },
    removeEventListener(event, cb) { if (event === 'change') listeners.delete(cb); },
    addListener(cb) { listeners.add(cb); },
    removeListener(cb) { listeners.delete(cb); },
    dispatchEvent(event) { listeners.forEach((cb) => cb(event)); return true; },
    _emit(nextMatches) {
      mql.matches = nextMatches;
      for (const cb of listeners) cb({ matches: nextMatches });
    },
  };
  return mql;
}

describe('theme', () => {
  let mql;
  let metaEl;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.head.innerHTML = '<meta name="theme-color" content="#0f172a">';
    metaEl = document.querySelector('meta[name="theme-color"]');

    mql = makeMatchMedia(false);
    // jsdom may not expose matchMedia as a spy-able function
    window.matchMedia = vi.fn().mockReturnValue(mql);

    if (!document.getElementById('theme-icon-path')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.id = 'theme-icon-path';
      svg.appendChild(path);
      document.body.appendChild(svg);
    }
  });

  afterEach(() => {
    // Each beforeEach re-installs window.matchMedia; nothing to restore.
    localStorage.clear();
  });

  describe('setTheme', () => {
    it('sets data-theme attribute and persists to localStorage', () => {
      setTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('docreader-theme')).toBe('light');
    });

    it('updates meta theme-color for dark and light', () => {
      setTheme('dark');
      expect(metaEl.getAttribute('content')).toBe('#0f172a');
      setTheme('light');
      expect(metaEl.getAttribute('content')).toBe('#f8fafc');
    });

    it('updates icon path for dark (moon) and light (sun)', () => {
      setTheme('dark');
      expect(document.getElementById('theme-icon-path').getAttribute('d')).toContain('M21 12.79');
      setTheme('light');
      expect(document.getElementById('theme-icon-path').getAttribute('d')).toContain('M12 3v1');
    });

    it('is safe when meta or icon elements are absent', () => {
      document.head.innerHTML = '';
      document.getElementById('theme-icon-path')?.remove();
      expect(() => setTheme('dark')).not.toThrow();
    });
  });

  describe('toggleTheme', () => {
    it('toggles dark -> light and light -> dark', () => {
      setTheme('dark');
      toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('defaults to dark when no attribute present then toggles to light', () => {
      document.documentElement.removeAttribute('data-theme');
      toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('initTheme', () => {
    it('uses saved localStorage value when present', () => {
      localStorage.setItem('docreader-theme', 'light');
      mql.matches = true; // system prefers dark, but saved wins
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('falls back to system preference when no saved value (dark)', () => {
      mql.matches = true;
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('falls back to system preference when no saved value (light)', () => {
      mql.matches = false;
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('wires click handler on #btn-theme when present', () => {
      const btn = document.createElement('button');
      btn.id = 'btn-theme';
      document.body.appendChild(btn);
      initTheme();
      // Click should toggle
      setTheme('dark');
      btn.click();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      btn.remove();
    });

    it('does not throw when #btn-theme is absent', () => {
      document.getElementById('btn-theme')?.remove();
      expect(() => initTheme()).not.toThrow();
    });

    it('system change listener updates theme only when no saved preference', () => {
      localStorage.clear();
      document.documentElement.removeAttribute('data-theme');
      initTheme(); // installs listener; no saved value, mql is false initially
      // System change to dark should apply
      mql._emit(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      // Save preference; further changes should not override
      setTheme('light');
      mql._emit(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });
});
