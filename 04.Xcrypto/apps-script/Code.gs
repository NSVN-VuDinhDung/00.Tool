/**
 * TRADE HISTORY STORE — Google Apps Script Web App
 * ------------------------------------------------
 * Kho lưu trữ lịch sử trade, ghi/đọc chỉ bằng một URL (không cần OAuth, không cần GCP).
 *
 * THIẾT KẾ: CHỈ THÊM, KHÔNG BAO GIỜ XOÁ.
 * Không có hàm nào trong file này xoá hay sửa dòng đã có. Kể cả khi lộ URL,
 * thiệt hại tối đa là bị chèn rác — không mất dữ liệu cũ.
 *
 * Xem hướng dẫn cài đặt trong README.md cùng thư mục.
 */

/** ĐỔI CHUỖI NÀY trước khi deploy. Tự đặt, dài, không trùng mật khẩu nào khác. */
const SECRET = 'DOI-CHUOI-NAY-TRUOC-KHI-DEPLOY';

const SHEET_NAME = 'trades';

/** Thứ tự cột trong Sheet. KHÔNG đổi thứ tự sau khi đã có dữ liệu. */
const COLUMNS = [
  'id', 'symbol', 'side',
  'opened_at', 'closed_at', 'opened_by', 'closed_by',
  'entry_price', 'exit_price', 'dca_count',
  'realized_pnl', 'total_fees', 'funding_fee', 'net_pnl',
  'execs',
];

/** Các cột phải ép định dạng text, nếu không Sheets sẽ tự parse ISO date và làm hỏng. */
const TEXT_COLUMNS = ['opened_at', 'closed_at', 'execs'];

/* ============================================================
   ENDPOINT
============================================================ */

/** Đọc toàn bộ kho: GET <URL>?k=SECRET */
function doGet(e) {
  const guard = checkSecret((e && e.parameter && e.parameter.k) || '');
  if (guard) return guard;

  const sh = ensureSheet();
  const last = sh.getLastRow();
  if (last < 2) return json({ ok: true, exported_at: nowIso(), total: 0, trades: [] });

  const values = sh.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  const trades = values.map(rowToTrade);

  // Mới nhất -> cũ nhất, cùng quy ước với file JSON của extension.
  trades.sort(function (a, b) {
    if (a.closed_at < b.closed_at) return 1;
    if (a.closed_at > b.closed_at) return -1;
    return 0;
  });

  return json({ ok: true, exported_at: nowIso(), total: trades.length, trades: trades });
}

/** Ghi thêm: POST <URL>, body = { "secret": "...", "trades": [ ... ] } */
function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'BAD_JSON' });
  }

  const guard = checkSecret(body.secret || '');
  if (guard) return guard;

  const incoming = body.trades || [];
  if (!incoming.length) return json({ ok: true, added: 0, received: 0 });

  // Chặn hai lần chạy đè lên nhau (alarm + bấm "Chạy ngay" cùng lúc).
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json({ ok: false, error: 'BUSY' });
  }

  try {
    const sh = ensureSheet();
    const seen = existingIdSet(sh);
    const rows = [];

    for (var i = 0; i < incoming.length; i++) {
      const t = incoming[i];
      if (!t || t.id === undefined || t.id === null) continue;
      const key = String(t.id);
      if (seen.has(key)) continue;   // đã có -> bỏ qua, không ghi đè
      seen.add(key);                 // chặn trùng ngay trong cùng một payload
      rows.push(toRow(t));
    }

    if (rows.length) {
      // Ghi một phát duy nhất. Lặp appendRow từng dòng sẽ đụng trần 6 phút.
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, COLUMNS.length).setValues(rows);
    }

    return json({
      ok: true,
      added: rows.length,
      received: incoming.length,
      total: Math.max(0, sh.getLastRow() - 1),
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   SHEET
============================================================ */

function ensureSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    for (var i = 0; i < TEXT_COLUMNS.length; i++) {
      const col = COLUMNS.indexOf(TEXT_COLUMNS[i]) + 1;
      sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    }
  }
  return sh;
}

/** Đọc nguyên cột id trong 1 lần gọi — đây là chỗ quyết định tốc độ. */
function existingIdSet(sh) {
  const set = new Set();
  const last = sh.getLastRow();
  if (last < 2) return set;
  const vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) set.add(String(vals[i][0]));
  return set;
}

function toRow(t) {
  const realized = num(t.realized_pnl);
  const fees = num(t.total_fees);
  return [
    t.id,
    t.symbol || '',
    t.side || '',
    t.opened_at || '',
    t.closed_at || '',
    t.opened_by || '',
    t.closed_by || '',
    num(t.entry_price),
    num(t.exit_price),
    num(t.dca_count),
    realized,
    fees,
    num(t.funding_fee),
    realized - fees,                                  // net_pnl, tiện pivot ngay trong Sheet
    t.trades ? JSON.stringify(t.trades) : '',         // giữ nguyên chi tiết khớp lệnh
  ];
}

/** Dựng lại đúng hình dạng JSON mà dashboard đang hiểu. */
function rowToTrade(r) {
  const o = {};
  for (var i = 0; i < COLUMNS.length; i++) o[COLUMNS[i]] = r[i];

  var execs = [];
  if (o.execs) {
    try { execs = JSON.parse(o.execs); } catch (err) { execs = []; }
  }

  return {
    id: o.id,
    symbol: o.symbol,
    side: o.side,
    opened_at: String(o.opened_at),
    closed_at: String(o.closed_at),
    opened_by: o.opened_by,
    closed_by: o.closed_by,
    entry_price: o.entry_price,
    exit_price: o.exit_price,
    dca_count: o.dca_count,
    realized_pnl: o.realized_pnl,
    total_fees: o.total_fees,
    funding_fee: o.funding_fee,
    trades: execs,
  };
}

/* ============================================================
   HELPERS
============================================================ */

function checkSecret(given) {
  if (SECRET === 'DOI-CHUOI-NAY-TRUOC-KHI-DEPLOY') {
    return json({ ok: false, error: 'SECRET_CHUA_DOI — sửa hằng SECRET trong Code.gs rồi deploy lại' });
  }
  if (given !== SECRET) return json({ ok: false, error: 'BAD_SECRET' });
  return null;
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function nowIso() {
  return new Date().toISOString();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   CHẠY TAY TRONG TRÌNH SOẠN THẢO (không phải endpoint)
============================================================ */

/** Chạy hàm này 1 lần sau khi dán code, để tạo sheet + bật màn hình cấp quyền. */
function setup() {
  const sh = ensureSheet();
  Logger.log('Sheet "%s" sẵn sàng. Số lệnh hiện có: %s', SHEET_NAME, Math.max(0, sh.getLastRow() - 1));
}

/** Xem nhanh kho đang có bao nhiêu lệnh. */
function stats() {
  const sh = ensureSheet();
  const n = Math.max(0, sh.getLastRow() - 1);
  Logger.log('Tổng số lệnh trong kho: %s', n);
  return n;
}
