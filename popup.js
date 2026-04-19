const toggle = /** @type {HTMLInputElement} */ (document.getElementById('filter-toggle'));
const status = document.getElementById('status');
let refreshInterval = null;

/**
 * Query the active Argos tab for its current hidden-item count.
 * Returns null if the active tab is not on argos.co.uk.
 * @returns {Promise<number|null>}
 */
async function getHiddenCount() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith(CONFIG.baseUrl)) return null;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'getHiddenCount' });
    return res?.count ?? null;
  } catch {
    return null;
  }
}

/**
 * Render the status line below the toggle.
 * @param {boolean} enabled
 * @param {number|null} count  null means "not on an Argos tab"
 */
function renderStatus(enabled, count) {
  if (!enabled) {
    status.textContent = 'Filter is off';
  } else if (count === null) {
    status.textContent = 'Open argos.co.uk to filter';
  } else if (count === 0) {
    status.textContent = 'All items in stock';
  } else if (count === 1) {
    status.textContent = 'Hiding 1 item on this page';
  } else {
    status.textContent = `Hiding ${count} items on this page`;
  }
}

/** Read storage + content-script state and update the UI */
async function refresh() {
  try {
    const { enabled } = await chrome.storage.sync.get(CONFIG.defaults);
    const count = enabled ? await getHiddenCount() : null;
    renderStatus(enabled, count);
  } catch {}
}

// --- Initialise ---

(async () => {
  const { enabled } = await chrome.storage.sync.get(CONFIG.defaults);
  toggle.checked = enabled;
  await refresh();
  refreshInterval = setInterval(refresh, CONFIG.popupPollMs);
})();

// --- Toggle handler ---

toggle.addEventListener('change', async () => {
  await chrome.storage.sync.set({ enabled: toggle.checked });
  await refresh();
});

// --- Clean up interval on close ---

window.addEventListener('unload', () => clearInterval(refreshInterval));
