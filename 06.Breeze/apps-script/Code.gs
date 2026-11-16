/**
 * Breeze — mỗi sáng gửi một bài viết hay (chọn ngẫu nhiên) từ Google Sheet về Telegram.
 *
 * Cài đặt: xem ../README.md
 *
 * Cách chọn bài: chỉ bốc ngẫu nhiên trong các bài có "Số lần gửi" nhỏ nhất.
 *   - Mọi bài được gửi hết một lượt rồi mới lặp lại.
 *   - Bài mới thêm vào (số lần = 0) được ưu tiên ngay.
 *   - Không gửi trùng bài của hôm trước.
 *
 * Cách hẹn giờ: trigger hằng ngày `scheduleToday` chạy khoảng 5h–6h sáng, hẹn một
 * trigger chạy một lần đúng 7h15 để gọi `sendDaily`. (Trigger theo ngày của Apps
 * Script chỉ chọn được khung 1 tiếng, nên phải làm 2 bước như vậy.)
 */

// ============ CẤU HÌNH ============
const SHEET_NAME = 'BaiViet';
const TZ = 'Asia/Ho_Chi_Minh';
const SEND_HOUR = 7;
const SEND_MINUTE = 15;
const SCHEDULER_HOUR = 5;                    // giờ chạy trigger hẹn giờ, phải trước SEND_HOUR
const HEADER = '🌿 <b>Breeze</b> · {date}';  // dòng đầu tin nhắn; đặt '' nếu không muốn
const MAX_LEN = 3800;                        // Telegram giới hạn 4096 ký tự/tin
const HEADERS = ['Nội dung', 'Tác giả', 'Số lần gửi', 'Gửi lần cuối'];
// Token & chat_id KHÔNG để ở đây — để trong Project Settings → Script Properties:
//   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID

// ============ HÀM CHẠY TAY ============

/** Chạy 1 lần sau khi dán code: tạo sheet, kiểm tra cấu hình, tạo trigger. */
function setup() {
  requireChatId_();
  const posts = readPosts_();

  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('scheduleToday')
    .timeBased().atHour(SCHEDULER_HOUR).everyDays(1).inTimezone(TZ)
    .create();

  const target = sendTimeToday_();
  if (target.getTime() > Date.now() + 60 * 1000) {
    ScriptApp.newTrigger('sendDaily').timeBased().at(target).create();
    Logger.log('Đã hẹn gửi lúc ' + fmt_(target) + ' hôm nay.');
  } else {
    Logger.log('Đã qua ' + pad_(SEND_HOUR) + ':' + pad_(SEND_MINUTE) + ' hôm nay — bắt đầu gửi từ sáng mai.');
  }
  Logger.log('OK. Sheet "' + SHEET_NAME + '" đang có ' + posts.length + ' bài.');
}

/** Gửi thử 1 bài ngẫu nhiên ngay bây giờ — KHÔNG tính vào số lần gửi. */
function sendTest() {
  const posts = readPosts_();
  if (!posts.length) throw new Error('Sheet "' + SHEET_NAME + '" chưa có bài nào.');
  const post = posts[Math.floor(Math.random() * posts.length)];
  buildMessages_(post, '🧪 <i>Gửi thử</i>\n').forEach(function (text) { sendMessage_(text); });
  Logger.log('Đã gửi thử bài ở dòng ' + post.row + '.');
}

/** In ra chat_id của những ai/nhóm vừa nhắn cho bot. Nhắn bot 1 tin trước rồi chạy. */
function findChatId() {
  const updates = telegram_('getUpdates', {});
  if (!updates.length) {
    Logger.log('Chưa thấy tin nào. Hãy nhắn cho bot 1 tin (hoặc đăng 1 bài trong channel có bot làm admin) rồi chạy lại.');
    return;
  }
  const seen = {};
  updates.forEach(function (u) {
    const m = u.message || u.channel_post || u.my_chat_member || {};
    const c = m.chat;
    if (c && !seen[c.id]) {
      seen[c.id] = true;
      Logger.log('chat_id = ' + c.id + '   (' + c.type + ': ' + (c.title || c.username || c.first_name || '') + ')');
    }
  });
}

// ============ TRIGGER ============

/** Chạy mỗi sáng ~5h: dọn trigger cũ và hẹn gửi đúng giờ. */
function scheduleToday() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'sendDaily'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });

  const target = sendTimeToday_();
  if (target.getTime() > Date.now() + 60 * 1000) {
    ScriptApp.newTrigger('sendDaily').timeBased().at(target).create();
  } else {
    sendDaily(); // trigger chạy trễ quá giờ gửi → gửi luôn
  }
}

/** Gửi bài của hôm nay. Mỗi ngày chỉ gửi 1 lần dù bị gọi nhiều lần. */
function sendDaily() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    if (props.getProperty('LAST_SENT_DATE') === today) {
      Logger.log('Hôm nay đã gửi rồi, bỏ qua.');
      return;
    }

    const posts = readPosts_();
    if (!posts.length) throw new Error('Sheet "' + SHEET_NAME + '" chưa có bài nào.');
    const post = pickRandom_(posts);

    buildMessages_(post, '').forEach(function (text) { sendMessage_(text); });

    ensureSheet_().getRange(post.row, 3, 1, 2).setValues([[post.count + 1, new Date()]]);
    props.setProperty('LAST_SENT_DATE', today);
    Logger.log('Đã gửi bài ở dòng ' + post.row + '.');
  } finally {
    lock.releaseLock();
  }
}

// ============ CHỌN BÀI ============

function readPosts_() {
  const sh = ensureSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .map(function (r, i) {
      return {
        row: i + 2,
        content: String(r[0]).trim(),
        author: String(r[1]).trim(),
        count: Number(r[2]) || 0,
        lastSent: r[3] instanceof Date ? r[3].getTime() : 0,
      };
    })
    .filter(function (p) { return p.content; });
}

function pickRandom_(posts) {
  const min = Math.min.apply(null, posts.map(function (p) { return p.count; }));
  let pool = posts.filter(function (p) { return p.count === min; });

  // Sang lượt mới thì pool có thể chứa bài vừa gửi hôm qua → loại ra cho khỏi trùng.
  if (pool.length > 1) {
    const newest = Math.max.apply(null, posts.map(function (p) { return p.lastSent; }));
    const rest = pool.filter(function (p) { return p.lastSent !== newest; });
    if (newest && rest.length) pool = rest;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============ TELEGRAM ============

function buildMessages_(post, prefix) {
  const date = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');
  const head = prefix + (HEADER ? HEADER.replace('{date}', date) + '\n\n' : '');
  const tail = post.author ? '\n\n— <i>' + esc_(post.author) + '</i>' : '';
  const chunks = splitText_(post.content, MAX_LEN);
  return chunks.map(function (c, i) {
    return (i === 0 ? head : '') + esc_(c) + (i === chunks.length - 1 ? tail : '');
  });
}

function sendMessage_(text) {
  return telegram_('sendMessage', {
    chat_id: requireChatId_(),
    text: text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/** Gọi Telegram Bot API, thử lại tối đa 3 lần nếu lỗi mạng / 5xx / 429. */
function telegram_(method, payload) {
  const url = 'https://api.telegram.org/bot' + getConfig_().token + '/' + method;
  for (let attempt = 1; ; attempt++) {
    let code = 0;
    let body;
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      code = res.getResponseCode();
      try { body = JSON.parse(res.getContentText()); }
      catch (e) { body = { ok: false, description: res.getContentText().slice(0, 200) }; }
    } catch (e) {
      body = { ok: false, description: e.message }; // lỗi mạng
    }
    if (body.ok) return body.result;

    if (code === 401 || code === 404) {
      throw new Error('Telegram từ chối token (' + code + ' ' + body.description + '). ' +
        'Token "' + mask_(getConfig_().token) + '" không đúng hoặc đã bị revoke — lấy lại token từ @BotFather.');
    }
    const retryable = code === 0 || code === 429 || code >= 500;
    if (!retryable || attempt >= 3) {
      throw new Error('Telegram ' + method + ' lỗi ' + code + ': ' + body.description);
    }
    Utilities.sleep(5000 * attempt);
  }
}

// ============ TIỆN ÍCH ============

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const token = (p.getProperty('TELEGRAM_TOKEN') || '')
    .replace(/\s+/g, '')          // khoảng trắng, xuống dòng
    .replace(/^["']+|["']+$/g, '') // dấu nháy
    .replace(/^bot/i, '');         // lỡ dán cả chữ "bot" ở đầu
  const chatId = (p.getProperty('TELEGRAM_CHAT_ID') || '').replace(/\s+/g, '').replace(/^["']+|["']+$/g, '');
  if (!token) throw new Error('Thiếu TELEGRAM_TOKEN trong Project Settings → Script Properties.');
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
    throw new Error('TELEGRAM_TOKEN sai định dạng (đang là "' + mask_(token) + '"). ' +
      'Token đúng có dạng 123456789:AAH... — copy lại từ @BotFather.');
  }
  return { token: token, chatId: chatId };
}

function requireChatId_() {
  const chatId = getConfig_().chatId;
  if (!chatId) throw new Error('Thiếu TELEGRAM_CHAT_ID trong Script Properties. Chạy hàm findChatId để lấy.');
  return chatId;
}

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (!sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 520);
    sh.setColumnWidth(2, 160);
    sh.getRange('A:A').setWrap(true).setVerticalAlignment('top');
    sh.getRange('D:D').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  return sh;
}

function sendTimeToday_() {
  const ymd = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return new Date(ymd + 'T' + pad_(SEND_HOUR) + ':' + pad_(SEND_MINUTE) + ':00+07:00');
}

function splitText_(text, max) {
  const out = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Che bớt token khi in ra log: 123456789:AAH…xYz */
function mask_(t) {
  return t.length > 16 ? t.slice(0, t.indexOf(':') + 4) + '…' + t.slice(-3) : t;
}

function pad_(n) { return (n < 10 ? '0' : '') + n; }

function fmt_(d) { return Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm'); }
