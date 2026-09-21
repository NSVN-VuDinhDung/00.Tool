/**
 * CRAWL LỊCH SỬ TRADE - xcrypto365.com
 * ------------------------------------
 * CÁCH DÙNG:
 * 1. Mở https://xcrypto365.com/trade-history (đã đăng nhập)
 * 2. Mở DevTools (F12) -> tab Console
 * 3. Copy toàn bộ file này, dán vào Console, nhấn Enter
 * 4. Đợi log chạy xong, trình duyệt sẽ tự tải về 1 file .json
 *    (chấp nhận cho phép tải nhiều file nếu Chrome hỏi)
 *
 * Có thể chỉnh 2 biến CONFIG bên dưới nếu cần.
 */
(async function crawlTradeHistory() {
  const CONFIG = {
    baseUrl: "https://xcrypto365.com/api/v1/trade-history",
    pageSize: 100, // càng lớn càng ít request, API có vẻ chấp nhận page_size tùy ý
    // Trang mẫu bạn gửi lọc theo closed_by=system. Nếu muốn lấy TẤT CẢ (kể cả
    // trade đóng thủ công), để mảng này gồm cả 'system' và 'user'.
    // Nếu để [null] script sẽ gọi API KHÔNG kèm tham số closed_by.
    closedByValues: ["system", "user"],
    delayMsBetweenRequests: 250,
  };

  const seenIds = new Set();
  const allTrades = [];

  function buildUrl(page, closedBy) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(CONFIG.pageSize),
    });
    if (closedBy) params.set("closed_by", closedBy);
    return `${CONFIG.baseUrl}?${params.toString()}`;
  }

  async function fetchPage(page, closedBy) {
    const res = await fetch(buildUrl(page, closedBy), {
      method: "GET",
      credentials: "include", // gửi kèm cookie đăng nhập của tab hiện tại
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} khi tải trang ${page} (closed_by=${closedBy})`);
    }
    return res.json();
  }

  for (const closedBy of CONFIG.closedByValues) {
    let page = 1;
    let totalCount = Infinity;
    console.log(`\n=== Bắt đầu crawl closed_by=${closedBy ?? "(không lọc)"} ===`);

    while ((page - 1) * CONFIG.pageSize < totalCount) {
      let json;
      try {
        json = await fetchPage(page, closedBy);
      } catch (err) {
        console.error("Lỗi, dừng vòng lặp cho closed_by =", closedBy, err);
        break;
      }

      const rows = json.data || [];
      totalCount = json.meta?.total_count ?? rows.length;

      let added = 0;
      for (const trade of rows) {
        if (!seenIds.has(trade.id)) {
          seenIds.add(trade.id);
          allTrades.push(trade);
          added++;
        }
      }

      console.log(
        `[${closedBy ?? "all"}] trang ${page} -> nhận ${rows.length}, mới ${added}, tổng đã gom ${allTrades.length}/${totalCount}`
      );

      if (rows.length === 0) break;
      page++;
      await new Promise((r) => setTimeout(r, CONFIG.delayMsBetweenRequests));
    }
  }

  // Sắp xếp mới nhất -> cũ nhất theo thời gian đóng lệnh
  allTrades.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));

  console.log(`\n✅ HOÀN TẤT: tổng cộng ${allTrades.length} trade đã gom được.`);

  // Tải xuống file JSON
  const payload = {
    exported_at: new Date().toISOString(),
    source: CONFIG.baseUrl,
    total: allTrades.length,
    trades: allTrades,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log(`📥 Đã tải file: ${a.download}`);
  return payload;
})();
