const $ = (sel) => document.querySelector(sel);

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

  $("#lastRun").textContent = status.lastRunAt
    ? new Date(status.lastRunAt).toLocaleString("vi-VN")
    : "Chưa chạy lần nào";

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

  const errEl = $("#lastError");
  if (status.lastError) {
    errEl.textContent = status.lastError;
    errEl.style.display = "block";
  } else {
    errEl.style.display = "none";
  }

  if (status.intervalMinutes) {
    $("#interval").value = String(status.intervalMinutes);
  }
}

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

refreshStatus();
