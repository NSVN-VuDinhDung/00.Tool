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

const SHEET = {
  // Web App URL của Apps Script (xem apps-script/README.md).
  url: "https://script.google.com/macros/s/AKfycbz051ONLI5_jXv3ncphlK7FxM9pXg96TGdqX6XDyGi1bUEQrD6CzAzu_BuCHvvzZxff/exec",
  // SECRET KHÔNG nằm trong file này — nhập ở popup, lưu trong chrome.storage.local,
  // để không bị commit lên git.
  batchSize: 500,
};

// Khi nào tải file JSON về máy:
//   "onerror" (mặc định) — chỉ khi đẩy lên Sheet thất bại, tức là bản cứu hộ
//   "always"             — mỗi lần chạy, như bản 1.0
//   "never"              — không bao giờ, Sheet là kho duy nhất
const DEFAULT_BACKUP_MODE = "onerror";

// Bao nhiêu ngày không đẩy được lên Sheet thì coi là kho đang bị bỏ quên.
// Đặt rộng hơn chu kỳ 1 tuần để một lần lỡ nhịp chưa vội báo động.
const STALE_DAYS = 10;

const NOTIFY = {
  auth: "auth-expired",
  crawl: "crawl-failed",
  sync: "sync-failed",
  stale: "archive-stale",
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["intervalMinutes", "backupMode"]);
  const period = stored.intervalMinutes || CONFIG.defaultIntervalMinutes;
  chrome.alarms.create(CONFIG.alarmName, { periodInMinutes: period, delayInMinutes: 1 });
  await chrome.storage.local.set({
    intervalMinutes: period,
    backupMode: stored.backupMode || DEFAULT_BACKUP_MODE,
  });
});

// Nếu Chrome bị đóng khi alarm đến hạn, alarm sẽ tự chạy ngay khi Chrome mở lại.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONFIG.alarmName) runCrawl();
});

// Mở Chrome sau một thời gian dài không dùng thì báo ngay, không đợi tới lượt crawl.
chrome.runtime.onStartup.addListener(() => {
  checkStale();
});

/* ============================================================
   THÔNG BÁO
============================================================ */

function notify(id, title, message) {
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2,
    requireInteraction: true, // ở lại tới khi bấm, không tự biến mất
  });
}

chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  // Cả ba trường hợp đều xử lý bằng cách vào lại web đăng nhập.
  if (id === NOTIFY.auth || id === NOTIFY.stale || id === NOTIFY.crawl) {
    chrome.tabs.create({ url: "https://xcrypto365.com/trade-history" });
  }
});

/**
 * Cảnh báo khi đã quá lâu không đẩy được lệnh nào lên Sheet.
 * Đây là lưới an toàn cho kịch bản tệ nhất: phiên hết hạn âm thầm hàng tháng,
 * trong khi xcrypto365 xoá dần lệnh cũ.
 */
async function checkStale() {
  const { lastSyncAt } = await chrome.storage.local.get("lastSyncAt");
  if (!lastSyncAt) return;

  const days = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 86400000);
  if (days >= STALE_DAYS) {
    notify(
      NOTIFY.stale,
      "Kho lưu trữ đang bị bỏ quên",
      `Đã ${days} ngày không đẩy được lệnh nào lên Google Sheet. ` +
        `Bấm vào đây để mở xcrypto365.com đăng nhập lại, rồi bấm "Chạy ngay" trong extension.`
    );
  } else {
    chrome.notifications.clear(NOTIFY.stale);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "RUN_NOW") {
    runCrawl().then(sendResponse);
    return true;
  }
  if (msg?.type === "GET_STATUS") {
    chrome.storage.local
      .get([
        "lastRunAt", "lastRunStatus", "lastRunCount", "lastError", "intervalMinutes",
        "backupMode", "sheetSecret", "lastSyncAt", "lastSyncAdded", "lastSyncTotal", "lastSyncError",
      ])
      .then((s) =>
        sendResponse({
          ...s,
          sheetSecret: undefined, // không đẩy secret ra ngoài service worker
          hasSecret: !!s.sheetSecret,
          sheetUrl: SHEET.url,
          staleDays: STALE_DAYS,
        })
      );
    return true;
  }
  if (msg?.type === "SET_INTERVAL") {
    chrome.alarms.create(CONFIG.alarmName, { periodInMinutes: msg.minutes, delayInMinutes: 1 });
    chrome.storage.local.set({ intervalMinutes: msg.minutes }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "SET_BACKUP_MODE") {
    chrome.storage.local.set({ backupMode: msg.mode }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "SET_SECRET") {
    chrome.storage.local.set({ sheetSecret: msg.secret || "" }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "TEST_SHEET") {
    testSheet().then(sendResponse);
    return true;
  }
});

function buildUrl(page, closedBy) {
  const params = new URLSearchParams({ page: String(page), page_size: String(CONFIG.pageSize) });
  if (closedBy) params.set("closed_by", closedBy);
  return `${CONFIG.baseUrl}?${params.toString()}`;
}

/* ============================================================
   GOOGLE SHEET
============================================================ */

async function getSecret() {
  const { sheetSecret } = await chrome.storage.local.get("sheetSecret");
  return sheetSecret || "";
}

/** Kiểm tra kết nối: gọi doGet, không ghi gì. */
async function testSheet() {
  const secret = await getSecret();
  if (!secret) return { ok: false, error: "Chưa nhập SECRET." };
  try {
    const res = await fetch(`${SHEET.url}?k=${encodeURIComponent(secret)}`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    if (!json.ok) return { ok: false, error: sheetErrorText(json.error) };
    return { ok: true, total: json.total };
  } catch (err) {
    return { ok: false, error: `Không gọi được URL: ${err.message}` };
  }
}

/**
 * Đẩy toàn bộ lệnh lên Sheet. Gửi tất cả chứ không chỉ phần mới:
 * Apps Script tự bỏ qua id đã có, nên cách này không phải giữ trạng thái ở máy,
 * và tự vá lại nếu Sheet thiếu dòng do một lần chạy trước hỏng giữa chừng.
 */
async function syncToSheet(allTrades) {
  const secret = await getSecret();
  if (!secret) return { skipped: true, error: "Chưa nhập SECRET." };

  let added = 0;
  let total = 0;

  for (let i = 0; i < allTrades.length; i += SHEET.batchSize) {
    const batch = allTrades.slice(i, i + SHEET.batchSize);
    const res = await fetch(SHEET.url, {
      method: "POST",
      // text/plain để tránh preflight; Apps Script đọc raw body nên không ảnh hưởng.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, trades: batch }),
    });

    if (!res.ok) throw new Error(`Sheet trả HTTP ${res.status}`);

    const json = await res.json();
    if (!json.ok) throw new Error(sheetErrorText(json.error));

    added += json.added || 0;
    total = json.total ?? total;
  }

  return { added, total, sent: allTrades.length };
}

function sheetErrorText(code) {
  if (code === "BAD_SECRET") return "SECRET không khớp với Code.gs trên Apps Script.";
  if (code === "BUSY") return "Sheet đang bận vì một lần chạy khác, thử lại sau.";
  if (code === "BAD_JSON") return "Apps Script không đọc được dữ liệu gửi lên.";
  if (typeof code === "string" && code.indexOf("SECRET_CHUA_DOI") === 0) {
    return "Code.gs chưa đổi hằng SECRET, hoặc đã đổi nhưng chưa Deploy version mới.";
  }
  return String(code);
}

/* ============================================================
   CRAWL
============================================================ */

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

    // --- đẩy lên Sheet ---
    let sync = null;
    let syncError = null;
    try {
      const result = await syncToSheet(allTrades);
      if (result.skipped) syncError = result.error;
      else sync = result;
    } catch (err) {
      syncError = err.message;
    }

    // --- tải file backup về máy ---
    const { backupMode } = await chrome.storage.local.get("backupMode");
    const mode = backupMode || DEFAULT_BACKUP_MODE;
    const shouldDownload = mode === "always" || (mode === "onerror" && syncError);
    if (shouldDownload) await downloadBackup(allTrades);

    await chrome.storage.local.set({
      lastRunAt: new Date().toISOString(),
      lastRunStatus: "ok",
      lastRunCount: allTrades.length,
      lastError: null,
      lastSyncAt: sync ? new Date().toISOString() : null,
      lastSyncAdded: sync ? sync.added : null,
      lastSyncTotal: sync ? sync.total : null,
      lastSyncError: syncError || null,
    });

    // Crawl chạy được nghĩa là phiên đăng nhập còn sống.
    chrome.notifications.clear(NOTIFY.auth);
    chrome.notifications.clear(NOTIFY.crawl);

    // Crawl xong nhưng chưa lên được Sheet thì vẫn là cảnh báo, không phải thành công.
    if (syncError) {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#e8b95b" });
      notify(NOTIFY.sync, "Không đẩy được lên Google Sheet", syncError);
    } else {
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#3ddc84" });
      chrome.notifications.clear(NOTIFY.sync);
    }

    await checkStale();
    return { ok: true, count: allTrades.length, sync, syncError };
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

    if (err.message === "AUTH_EXPIRED") {
      notify(
        NOTIFY.auth,
        "Phiên đăng nhập xcrypto365 đã hết hạn",
        'Extension không lấy được lệnh mới. Bấm vào đây để mở xcrypto365.com và đăng nhập lại — ' +
          'sau đó nó tự chạy tiếp, không mất dữ liệu đã lưu.'
      );
    } else {
      notify(NOTIFY.crawl, "Lấy lịch sử trade thất bại", message);
    }

    await checkStale();
    return { ok: false, error: message };
  }
}

async function downloadBackup(allTrades) {
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
}
