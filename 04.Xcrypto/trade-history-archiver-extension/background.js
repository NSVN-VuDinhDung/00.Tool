const CONFIG = {
  baseUrl: "https://xcrypto365.com/api/v1/trade-history",
  pageSize: 100,
  // Lấy cả lệnh đóng tự động (system) và đóng thủ công (user).
  closedByValues: ["system", "user"],
  delayMs: 250,
  alarmName: "weeklyTradeCrawl",
  defaultIntervalMinutes: 10080, // 7 ngày
  downloadFolder: "TradeHistoryArchive",
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get("intervalMinutes");
  const period = stored.intervalMinutes || CONFIG.defaultIntervalMinutes;
  chrome.alarms.create(CONFIG.alarmName, { periodInMinutes: period, delayInMinutes: 1 });
  await chrome.storage.local.set({ intervalMinutes: period });
});

// Nếu Chrome bị đóng khi alarm đến hạn, alarm sẽ tự chạy ngay khi Chrome mở lại.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONFIG.alarmName) runCrawl();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "RUN_NOW") {
    runCrawl().then(sendResponse);
    return true;
  }
  if (msg?.type === "GET_STATUS") {
    chrome.storage.local
      .get(["lastRunAt", "lastRunStatus", "lastRunCount", "lastError", "intervalMinutes"])
      .then(sendResponse);
    return true;
  }
  if (msg?.type === "SET_INTERVAL") {
    chrome.alarms.create(CONFIG.alarmName, { periodInMinutes: msg.minutes, delayInMinutes: 1 });
    chrome.storage.local.set({ intervalMinutes: msg.minutes }).then(() => sendResponse({ ok: true }));
    return true;
  }
});

function buildUrl(page, closedBy) {
  const params = new URLSearchParams({ page: String(page), page_size: String(CONFIG.pageSize) });
  if (closedBy) params.set("closed_by", closedBy);
  return `${CONFIG.baseUrl}?${params.toString()}`;
}

async function runCrawl() {
  try {
    chrome.action.setBadgeText({ text: "..." });
    chrome.action.setBadgeBackgroundColor({ color: "#e8b95b" });

    const seenIds = new Set();
    const allTrades = [];

    for (const closedBy of CONFIG.closedByValues) {
      let page = 1;
      let totalCount = Infinity;

      while ((page - 1) * CONFIG.pageSize < totalCount) {
        const res = await fetch(buildUrl(page, closedBy), {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) throw new Error("AUTH_EXPIRED");
          throw new Error(`HTTP_${res.status}`);
        }

        const json = await res.json();
        const rows = json.data || [];
        totalCount = json.meta?.total_count ?? rows.length;

        for (const trade of rows) {
          if (!seenIds.has(trade.id)) {
            seenIds.add(trade.id);
            allTrades.push(trade);
          }
        }

        if (rows.length === 0) break;
        page++;
        await new Promise((r) => setTimeout(r, CONFIG.delayMs));
      }
    }

    allTrades.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));

    const payload = {
      exported_at: new Date().toISOString(),
      source: CONFIG.baseUrl,
      total: allTrades.length,
      trades: allTrades,
    };

    const jsonStr = JSON.stringify(payload);
    // Chuyển JSON -> base64 data URL để dùng trực tiếp với chrome.downloads
    // (service worker không có Blob URL ổn định cho downloads API).
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const dataUrl = "data:application/json;base64," + base64;

    const dateStr = new Date().toISOString().slice(0, 10);
    await chrome.downloads.download({
      url: dataUrl,
      filename: `${CONFIG.downloadFolder}/trade-history-${dateStr}.json`,
      conflictAction: "uniquify",
      saveAs: false,
    });

    await chrome.storage.local.set({
      lastRunAt: new Date().toISOString(),
      lastRunStatus: "ok",
      lastRunCount: allTrades.length,
      lastError: null,
    });

    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#3ddc84" });
    return { ok: true, count: allTrades.length };
  } catch (err) {
    const message =
      err.message === "AUTH_EXPIRED"
        ? "Phiên đăng nhập đã hết hạn — mở xcrypto365.com và đăng nhập lại, extension sẽ tự chạy được ở lần sau."
        : `Lỗi khi crawl: ${err.message}`;

    await chrome.storage.local.set({
      lastRunAt: new Date().toISOString(),
      lastRunStatus: "error",
      lastError: message,
    });

    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff6a5f" });
    return { ok: false, error: message };
  }
}
