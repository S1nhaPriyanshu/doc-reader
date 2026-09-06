/**
 * Theme utility — handles dark/light mode toggling and persistence.
 * @module utils/theme
 */

const THEME_KEY = 'docreader-theme';

/**
 * Applies the theme to the DOM and UI elements without modifying localStorage.
 * @param {'dark'|'light'} theme - Theme to apply.
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);

  // Update meta theme-color for browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
  }
}

/**
 * Initialises the theme from localStorage or system preference.
 */
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Sets the active theme and updates the icon.
 * @param {'dark'|'light'} theme - Theme to apply.
 */
export function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Toggles between dark and light theme.
 */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Updates the theme toggle button icon.
 * @param {'dark'|'light'} theme - Current theme.
 */
function updateThemeIcon(theme) {
  const iconPath = document.getElementById('theme-icon-path');
  if (!iconPath) return;

  if (theme === 'dark') {
    // Moon icon
    iconPath.setAttribute('d', 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
  } else {
    // Sun icon
    iconPath.setAttribute('d', 'M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z');
  }
}
