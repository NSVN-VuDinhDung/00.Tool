const $ = (sel) => document.querySelector(sel);

const timeFmt = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN") : null);

function showMsg(el, text, kind) {
  if (!text) {
    el.style.display = "none";
    return;
  }
  el.textContent = text;
  el.className = "msg " + kind;
  el.style.display = "block";
}

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

  /* ---------- crawl ---------- */
  $("#lastRun").textContent = timeFmt(status.lastRunAt) || "Chưa chạy lần nào";

  const statusEl = $("#lastStatus");
  if (status.lastRunStatus === "ok") {
    statusEl.textContent = "✓ Thành công";
    statusEl.className = "ok";
  } else if (status.lastRunStatus === "error") {
    statusEl.textContent = "✗ Lỗi";
    statusEl.className = "err";
  } else {
    statusEl.textContent = "—";
    statusEl.className = "";
  }

  $("#lastCount").textContent = status.lastRunCount ?? "—";
  showMsg($("#lastError"), status.lastError, "bad");

  /* ---------- sheet ---------- */
  $("#syncRun").textContent = timeFmt(status.lastSyncAt) || "Chưa đẩy lần nào";
  $("#syncAdded").textContent = status.lastSyncAdded ?? "—";
  $("#syncTotal").textContent = status.lastSyncTotal ?? "—";
  showMsg($("#syncError"), status.lastSyncError, "bad");

  // Cảnh báo kho bị bỏ quên — ngưỡng lấy từ background để hai nơi không lệch nhau.
  let stale = null;
  if (status.lastSyncAt) {
    const days = Math.floor((Date.now() - new Date(status.lastSyncAt).getTime()) / 86400000);
    if (days >= (status.staleDays ?? 10)) {
      stale =
        `⚠ Đã ${days} ngày không đẩy được lệnh nào lên Google Sheet. ` +
        `Mở xcrypto365.com đăng nhập lại rồi bấm "Chạy ngay".`;
    }
  }
  showMsg($("#staleWarn"), stale, "warn");

  if (status.hasSecret) $("#secret").placeholder = "••••••••  (đã lưu)";

  /* ---------- cài đặt ---------- */
  if (status.intervalMinutes) $("#interval").value = String(status.intervalMinutes);
  if (status.backupMode) $("#backupMode").value = status.backupMode;
}

/* ============================================================
   HÀNH ĐỘNG
============================================================ */

$("#testBtn").addEventListener("click", async () => {
  const btn = $("#testBtn");
  const input = $("#secret");
  const typed = input.value.trim();

  btn.disabled = true;
  btn.textContent = "Đang kiểm tra...";
  showMsg($("#testMsg"), "", "");

  // Bỏ trống = giữ SECRET đã lưu, chỉ kiểm tra lại.
  if (typed) await chrome.runtime.sendMessage({ type: "SET_SECRET", secret: typed });

  const res = await chrome.runtime.sendMessage({ type: "TEST_SHEET" });

  if (res.ok) {
    showMsg($("#testMsg"), `✓ Kết nối được. Kho đang có ${res.total} lệnh.`, "good");
    input.value = "";
    input.placeholder = "••••••••  (đã lưu)";
  } else {
    showMsg($("#testMsg"), "✗ " + res.error, "bad");
  }

  btn.disabled = false;
  btn.textContent = "Lưu & kiểm tra kết nối";
  await refreshStatus();
});

$("#runNow").addEventListener("click", async () => {
  const btn = $("#runNow");
  btn.disabled = true;
  btn.textContent = "Đang chạy...";
  await chrome.runtime.sendMessage({ type: "RUN_NOW" });
  btn.disabled = false;
  btn.textContent = "Chạy ngay";
  await refreshStatus();
});

$("#interval").addEventListener("change", async (e) => {
  const minutes = parseInt(e.target.value, 10);
  await chrome.runtime.sendMessage({ type: "SET_INTERVAL", minutes });
});

$("#backupMode").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({ type: "SET_BACKUP_MODE", mode: e.target.value });
});

refreshStatus();
