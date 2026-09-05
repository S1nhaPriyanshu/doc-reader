/**
 * DocReader — Main entry point.
 * Initialises the application shell, router, and theme system.
 * @module main
 */
import { App } from './app.js';
import { initTheme } from './utils/theme.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const app = new App();
  app.init();
});
