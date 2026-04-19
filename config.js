/**
 * Extension configuration and feature flags.
 *
 * Loaded by the service worker via importScripts(), by content scripts via
 * the manifest content_scripts array, and by the popup via a <script> tag.
 * All values are exposed as properties of the CONFIG global object.
 *
 * chrome.storage.sync is the runtime store; CONFIG.defaults supplies the
 * values written on first install and used as fallbacks on every storage read.
 */
const CONFIG = {
  baseUrl: 'https://www.argos.co.uk/',

  // DOM selector for the out-of-stock indicator — update if Argos changes their markup
  oosSelector: '[data-test="component-product-card-availabilityIcon-oos"]',

  // Milliseconds to wait after a DOM mutation before re-running the filter
  debounceMs: 150,

  // Milliseconds to wait after DOMContentLoaded before a second filter pass (React hydration)
  hydrationDelayMs: 500,

  // Milliseconds between popup status refreshes
  popupPollMs: 1000,

  // Badge colours
  badgeColorOn:  '#22c55e',
  badgeColorOff: '#9ca3af',

  defaults: {
    /** Whether the in-stock filter is active when the extension is first installed. */
    enabled: false,
  },
};
