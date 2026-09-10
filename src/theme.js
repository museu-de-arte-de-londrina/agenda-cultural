/**
 * Theme toggle.
 *
 * Loaded from <head> without defer so the stored choice is applied before the
 * first paint, since deferring it would flash the wrong theme on every load.
 * It is
 * an external file rather than an inline script so the CSP can stay at
 * script-src 'self' with no 'unsafe-inline'.
 *
 * The button ships hidden and is revealed here: without JavaScript it would do
 * nothing, and a dead control is worse than no control.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var root = document.documentElement;
  var query = window.matchMedia('(prefers-color-scheme: dark)');

  function readStored() {
    // Throws outright in some privacy modes, so never let it break the page.
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function store(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* The toggle still works for this page view. */
    }
  }

  var stored = readStored();
  if (stored === 'light' || stored === 'dark') {
    root.setAttribute('data-theme', stored);
  }

  /** What the reader is actually seeing right now. */
  function effectiveTheme() {
    var forced = root.getAttribute('data-theme');
    if (forced === 'light' || forced === 'dark') return forced;
    return query.matches ? 'dark' : 'light';
  }

  function syncButton(button) {
    var isDark = effectiveTheme() === 'dark';
    button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    // Labels come from the template so the interface text stays in one place.
    button.setAttribute('aria-label', isDark ? button.dataset.labelLight : button.dataset.labelDark);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('theme-toggle');
    if (!button) return;

    button.hidden = false;
    syncButton(button);

    button.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store(next);
      syncButton(button);
    });

    query.addEventListener('change', function () {
      if (!root.hasAttribute('data-theme')) syncButton(button);
    });
  });
})();
