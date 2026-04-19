const HIDDEN_CLASS = 'argos-filter-hidden';
const STYLE_ID = 'argos-filter-style';

let enabled = true;
let hiddenCount = 0;
let debounceTimer = null;

/** Inject a single stylesheet so toggling is clean (one class remove restores layout) */
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.${HIDDEN_CLASS} { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Walk up from an OOS indicator to the product card grid tile that should be hidden.
 *
 * Argos renders each product tile as a `ds-c-grid-item` that is a *direct child*
 * of the results grid container (which has `ds-c-grid` but NOT `ds-c-grid-item`).
 * Inner layout wrappers inside the card also carry `ds-c-grid-item`, so we must
 * skip those and return the outermost one at the product-card level.
 */
function findCard(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const cls = typeof node.className === 'string' ? node.className : '';
    if (cls.includes('ds-c-grid-item')) {
      const parentCls = typeof node.parentElement?.className === 'string'
        ? node.parentElement.className : '';
      // Accept this grid-item only when its parent is a grid container,
      // not another grid-item — i.e. we are at the top-level product tile.
      if (parentCls.includes('ds-c-grid') && !parentCls.includes('ds-c-grid-item')) {
        return node;
      }
    }
    node = node.parentElement;
  }

  // Fallback: li that is a direct child of a multi-item ul/ol and contains a link
  node = el.parentElement;
  while (node && node !== document.body) {
    if (node.tagName === 'LI') {
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')
          && parent.children.length > 1
          && node.querySelector('a[href]')) {
        return node;
      }
    }
    node = node.parentElement;
  }

  return el.closest('article, [class*="ProductCard"]');
}

/** Hide all OOS product cards and report the count */
function runFilter() {
  if (!enabled) return;

  const oosEls = document.querySelectorAll(CONFIG.oosSelector);
  const cards = new Set();
  oosEls.forEach(el => {
    const card = findCard(el);
    if (card) cards.add(card);
  });

  // Reset then re-apply so removed cards become visible again
  document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => el.classList.remove(HIDDEN_CLASS));
  cards.forEach(card => card.classList.add(HIDDEN_CLASS));

  hiddenCount = cards.size;
  reportCount();
}

/** Remove all hidden classes and zero the count */
function clearFilter() {
  document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => el.classList.remove(HIDDEN_CLASS));
  hiddenCount = 0;
  reportCount();
}

// Set to true when the extension is reloaded and this content script becomes stale
let contextInvalidated = false;

/** Send current hidden count to the background service worker */
function reportCount() {
  if (contextInvalidated) return;
  try {
    chrome.runtime.sendMessage({ type: 'updateHiddenCount', count: hiddenCount }).catch(() => {});
  } catch {
    contextInvalidated = true;
  }
}

/** Debounce wrapper — at most one filter pass per DEBOUNCE_MS */
function scheduleFilter() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runFilter, CONFIG.debounceMs);
}

// --- Boot sequence ---

injectStyle();

// Read initial enabled state, then run immediately + after hydration delay
chrome.storage.sync.get(CONFIG.defaults, result => {
  enabled = result.enabled;
  if (!enabled) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      runFilter();
      setTimeout(runFilter, CONFIG.hydrationDelayMs);
    });
  } else {
    runFilter();
    setTimeout(runFilter, CONFIG.hydrationDelayMs);
  }
});

// --- MutationObserver for infinite scroll / SPA card injection ---

const observer = new MutationObserver(() => {
  if (contextInvalidated) { observer.disconnect(); return; }
  if (enabled) scheduleFilter();
});

observer.observe(document.body, { subtree: true, childList: true });

// --- SPA navigation detection ---

function onRouteChange() {
  if (!contextInvalidated && enabled) scheduleFilter();
}

const _pushState = history.pushState.bind(history);
const _replaceState = history.replaceState.bind(history);

history.pushState = function (...args) { _pushState(...args); onRouteChange(); };
history.replaceState = function (...args) { _replaceState(...args); onRouteChange(); };
window.addEventListener('popstate', onRouteChange);

// --- React to toggle changes in real time (all open Argos tabs) ---

chrome.storage.onChanged.addListener(changes => {
  if (contextInvalidated || !('enabled' in changes)) return;
  enabled = changes.enabled.newValue;
  if (enabled) {
    runFilter();
  } else {
    clearFilter();
  }
});

// --- Message handler for popup count queries ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getHiddenCount') {
    sendResponse({ count: hiddenCount });
  }
  return true;
});

console.log('[Argos In-Stock Filter] active');
