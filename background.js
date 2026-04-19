importScripts('config.js');

const ICON_ON  = { 16: 'icons/icon-on-16.png',  48: 'icons/icon-on-48.png',  128: 'icons/icon-on-128.png'  };
const ICON_OFF = { 16: 'icons/icon-off-16.png', 48: 'icons/icon-off-48.png', 128: 'icons/icon-off-128.png' };


/** Per-tab hidden-item counts (cleared when tab navigates or closes) */
const tabCounts = new Map();

/** Returns true for pages on www.argos.co.uk */
function isArgosUrl(url) {
  return typeof url === 'string' && url.startsWith(CONFIG.baseUrl);
}

/** Swap the toolbar icon to reflect enabled state */
function setIcon(enabled) {
  chrome.action.setIcon({ path: enabled ? ICON_ON : ICON_OFF });
}

/**
 * Update badge text, colour, and tooltip for a single tab.
 * @param {number} tabId
 * @param {boolean} enabled
 * @param {number} count
 */
function refreshBadge(tabId, enabled, count) {
  const text = enabled && count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: enabled ? CONFIG.badgeColorOn : CONFIG.badgeColorOff });
  chrome.action.setTitle({
    tabId,
    title: enabled
      ? `Argos In-Stock Filter — ON${count > 0 ? ` (${count} hidden)` : ''}`
      : 'Argos In-Stock Filter — OFF'
  });
}

/** Clear badge and reset tooltip for non-Argos tabs */
function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '' });
  chrome.action.setTitle({ tabId, title: 'Argos In-Stock Filter' });
}

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(CONFIG.defaults, result => {
    if (result.enabled === undefined) chrome.storage.sync.set(CONFIG.defaults);
    setIcon(result.enabled === true);
  });
});

// --- Storage change: propagate icon + badge updates to all open tabs ---

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !('enabled' in changes)) return;
  const enabled = changes.enabled.newValue;
  setIcon(enabled);

  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (!isArgosUrl(tab.url)) { clearBadge(tab.id); return; }
      refreshBadge(tab.id, enabled, tabCounts.get(tab.id) ?? 0);
    });
  });
});

// --- Tab activation: refresh badge when user switches tabs ---

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) return;
    if (!isArgosUrl(tab.url)) { clearBadge(tabId); return; }
    chrome.storage.sync.get(CONFIG.defaults, ({ enabled }) => {
      refreshBadge(tabId, enabled, tabCounts.get(tabId) ?? 0);
    });
  });
});

// --- Tab navigation: reset count on new page load ---

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isArgosUrl(tab.url)) { clearBadge(tabId); return; }
  if (changeInfo.status === 'loading') {
    tabCounts.delete(tabId);
    chrome.storage.sync.get(CONFIG.defaults, ({ enabled }) => {
      refreshBadge(tabId, enabled, 0);
    });
  }
});

// --- Tab close: free memory ---

chrome.tabs.onRemoved.addListener(tabId => tabCounts.delete(tabId));

// --- Messages from content scripts ---

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'updateHiddenCount' || !sender.tab) return;
  const { id: tabId, url } = sender.tab;
  tabCounts.set(tabId, message.count);
  if (!isArgosUrl(url)) return;
  chrome.storage.sync.get(CONFIG.defaults, ({ enabled }) => {
    refreshBadge(tabId, enabled, message.count);
  });
});
