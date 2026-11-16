/**
 * Breeze — tiện ích Telegraph (tuỳ chọn).
 *
 * Bài dài được đăng lên telegra.ph, Telegram chỉ nhận 1 tin gồm tiêu đề, đoạn mở đầu
 * và link ⚡ Instant View.
 * Bài ngắn vẫn gửi thẳng như cũ.
 *
 * TẮT / ROLLBACK: xoá file này trong Apps Script (⋮ cạnh tên file → Delete),
 * hoặc đặt TELEGRAPH_ENABLED = false. Code.gs tự quay về cách gửi cũ.
 *
 * Tiêu đề trang: nếu dòng đầu tiên của bài ngắn (≤ 120 ký tự) thì dùng dòng đó làm
 * tiêu đề; nếu không thì lấy khoảng 80 ký tự đầu của bài.
 */

const TELEGRAPH_ENABLED = true;
const TELEGRAPH_MIN_LEN = 3800;      // bài dài hơn mức này mới đăng Telegraph; hạ xuống (vd 1500) nếu muốn
const TELEGRAPH_SHORT_NAME = 'Breeze';
const TEASER_LEN = 300;              // độ dài đoạn mở đầu hiện trong tin Telegram

/** Gửi thử bài DÀI NHẤT trong Sheet qua Telegraph (bắt buộc, bỏ qua ngưỡng). Không tính số lần gửi. */
function sendTestTelegraph() {
  const posts = readPosts_();
  if (!posts.length) throw new Error('Sheet "' + SHEET_NAME + '" chưa có bài nào.');
  const post = posts.reduce(function (a, b) { return b.content.length > a.content.length ? b : a; });
  telegraphMessages_(post, '🧪 <i>Gửi thử Telegraph</i>\n', true).forEach(function (m) { sendMessage_(m); });
  Logger.log('Đã gửi thử bài ở dòng ' + post.row + ' (' + post.content.length + ' ký tự) qua Telegraph.');
}

/**
 * Được Code.gs gọi. Trả về mảng tin nếu đăng Telegraph, hoặc null để Code.gs gửi kiểu cũ.
 * force = true: luôn đăng (dùng khi gửi thử), lỗi thì báo lỗi luôn.
 * force = false: chỉ đăng bài dài; nếu Telegraph lỗi thì trả null để vẫn gửi được bài.
 */
function telegraphMessages_(post, prefix, force) {
  if (!force && (!TELEGRAPH_ENABLED || post.content.length <= TELEGRAPH_MIN_LEN)) return null;
  try {
    const parts = splitTitle_(post.content);
    const url = createTelegraphPage_(parts.title, parts.body, post.author);
    const text = headLine_(prefix) +
      '<b>' + esc_(parts.title) + '</b>\n\n' +
      esc_(teaser_(parts.body)) + '\n\n' +
      '📖 <a href="' + url + '">Đọc toàn bài</a>' +
      authorLine_(post);
    return [{ text: text, previewUrl: url }];
  } catch (e) {
    if (force) throw e;
    Logger.log('Telegraph lỗi, chuyển sang gửi kiểu cũ: ' + e.message);
    return null;
  }
}

// ============ TELEGRAPH API ============

function createTelegraphPage_(title, body, author) {
  const content = JSON.stringify(toTelegraphNodes_(body));
  if (Utilities.newBlob(content).getBytes().length > 64 * 1024) {
    throw new Error('Bài vượt giới hạn 64 KB của Telegraph.');
  }
  const page = telegraphApi_('createPage', {
    access_token: telegraphToken_(),
    title: title.slice(0, 256),
    author_name: (author || TELEGRAPH_SHORT_NAME).slice(0, 128),
    content: content,
    return_content: 'false',
  });
  return page.url;
}

/** Lấy access_token Telegraph; lần đầu tự tạo tài khoản và lưu vào Script Properties. */
function telegraphToken_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('TELEGRAPH_TOKEN');
  if (!token) {
    token = telegraphApi_('createAccount', {
      short_name: TELEGRAPH_SHORT_NAME,
      author_name: TELEGRAPH_SHORT_NAME,
    }).access_token;
    props.setProperty('TELEGRAPH_TOKEN', token);
  }
  return token;
}

function telegraphApi_(method, params) {
  const res = UrlFetchApp.fetch('https://api.telegra.ph/' + method, {
    method: 'post',
    payload: params,            // gửi dạng form-urlencoded
    muteHttpExceptions: true,
  });
  let body;
  try { body = JSON.parse(res.getContentText()); }
  catch (e) { throw new Error('Telegraph ' + method + ' trả về ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200)); }
  if (!body.ok) throw new Error('Telegraph ' + method + ' lỗi: ' + body.error);
  return body.result;
}

// ============ CHUYỂN NỘI DUNG ============

/** Đoạn cách nhau bởi dòng trống → <p>; xuống dòng đơn trong đoạn → <br>. */
function toTelegraphNodes_(body) {
  return body.split(/\n\s*\n/)
    .map(function (p) { return p.trim(); })
    .filter(Boolean)
    .map(function (p) {
      const children = [];
      p.split('\n').forEach(function (line, i) {
        if (i) children.push({ tag: 'br' });
        children.push(line);
      });
      return { tag: 'p', children: children };
    });
}

function splitTitle_(content) {
  const nl = content.indexOf('\n');
  const first = (nl === -1 ? content : content.slice(0, nl)).trim();
  const rest = nl === -1 ? '' : content.slice(nl + 1).trim();
  if (first.length <= 120 && rest) return { title: first, body: rest };
  return { title: cutAtWord_(content.replace(/\s+/g, ' '), 80), body: content };
}

/**
 * Đoạn mở đầu: lấy đoạn đầu; nếu còn ngắn (< 2/3 TEASER_LEN) thì nối thêm đoạn sau,
 * cho tới khi đủ dài, rồi cắt ở ranh giới từ và thêm "…".
 */
function teaser_(body) {
  const paras = body.split(/\n\s*\n/)
    .map(function (p) { return p.replace(/\s+/g, ' ').trim(); })
    .filter(Boolean);
  let out = '';
  for (let i = 0; i < paras.length && out.length < TEASER_LEN * 2 / 3; i++) {
    out = out ? out + '\n\n' + paras[i] : paras[i];
  }
  return cutAtWord_(out, TEASER_LEN);
}

function cutAtWord_(s, max) {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(' ', max);
  return s.slice(0, cut > max / 2 ? cut : max).trim() + '…';
}
