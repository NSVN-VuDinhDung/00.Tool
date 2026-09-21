# Trade History Archiver — Tài liệu kỹ thuật

Hệ thống lưu trữ và phân tích lịch sử trade từ xcrypto365.com.

Tài liệu này mô tả **hệ thống hoạt động thế nào**. Hướng dẫn cài đặt nằm ở
[`apps-script/README.md`](apps-script/README.md).

---

## 1. Bài toán

API `xcrypto365.com/api/v1/trade-history` chỉ giữ lịch sử trong một khoảng thời gian.
Lệnh cũ bị xoá khỏi hệ thống. Mục tiêu: **giữ lại vĩnh viễn** bản sao của mọi lệnh
đã đóng, và phân tích được chúng.

Ba ràng buộc định hình toàn bộ thiết kế:

1. **API cần cookie đăng nhập** → không crawl được từ ngoài trình duyệt (xem §8.1)
2. **Dữ liệu không được mất** → mọi đường ghi đều chỉ-thêm (xem §8.2)
3. **Không tốn tiền hạ tầng** → dùng Google Sheet làm kho (xem §8.3)

---

## 2. Kiến trúc tổng thể

```
┌────────────────────────┐
│  xcrypto365.com API    │
│  (cần cookie đăng nhập)│
└───────────┬────────────┘
            │  GET /api/v1/trade-history
            │  credentials: include     ← mượn cookie của trình duyệt
            ▼
┌────────────────────────────────────┐
│  CHROME EXTENSION (MV3)            │
│  trade-history-archiver-extension/ │
│                                    │
│  chrome.alarms ─→ runCrawl()       │
│                     │              │
│                     ├─→ Sheet      │  đường chính
│                     └─→ file .json │  đường cứu hộ (khi Sheet lỗi)
└─────────┬──────────────────────────┘
          │  POST {secret, trades}
          ▼
┌────────────────────────────────────┐
│  GOOGLE APPS SCRIPT WEB APP        │
│  apps-script/Code.gs               │
│  doPost → khử trùng → ghi Sheet    │
│  doGet  → đọc toàn bộ kho          │
└─────────┬──────────────────────────┘
          │  Google Sheet riêng tư — NGUỒN SỰ THẬT
          │
          │  GET ?k=SECRET
          ▼
┌────────────────────────────────────┐
│  DASHBOARD (1 file HTML tĩnh)      │
│  trade-dashboard.html              │
│  phân tích + biểu đồ, chạy cục bộ  │
└────────────────────────────────────┘
```

**Nguồn sự thật là Google Sheet.** File JSON trên đĩa và IndexedDB/localStorage của
trình duyệt đều là bản sao vứt bỏ được — mất thì nạp lại từ Sheet, không mất gì.

---

## 3. Thành phần

### 3.1 `crawl-trade-history.js` — script một lần

Dán vào DevTools Console của tab đã đăng nhập. Không phụ thuộc vào extension,
dùng khi cần lấy dữ liệu gấp hoặc để kiểm chứng API. Logic crawl giống hệt
extension nhưng kết thúc bằng tải file `.json`.

### 3.2 Extension (MV3) — bộ thu thập

| File | Vai trò |
|---|---|
| `manifest.json` | Quyền, icon, đăng ký service worker |
| `background.js` | Service worker: lịch chạy, crawl, đẩy Sheet, thông báo |
| `popup.html/js` | Giao diện: trạng thái, nhập SECRET, đổi lịch |
| `icons/` | PNG 16/48/128, **bắt buộc** cho `chrome.notifications` |

Quyền cần và lý do:

| Quyền | Dùng để |
|---|---|
| `alarms` | Lịch chạy định kỳ, sống sót qua lúc đóng Chrome |
| `downloads` | Ghi file JSON cứu hộ |
| `storage` | Lưu SECRET, cài đặt, trạng thái lần chạy |
| `notifications` | Cảnh báo khi hỏng (xem §7) |
| host `xcrypto365.com` | Crawl kèm cookie |
| host `script.google.com` | POST/GET tới Apps Script |
| host `script.googleusercontent.com` | **Bắt buộc** — đích của redirect 302 (xem §5.3) |

### 3.3 Apps Script — kho lưu trữ

`Code.gs` chạy trên hạ tầng Google, ghi vào một Google Sheet riêng tư.
Xem §5 cho mô hình thực thi.

### 3.4 Dashboard — bộ phân tích

`trade-dashboard.html`: một file HTML tĩnh, **không phụ thuộc thư viện ngoài**.
Biểu đồ SVG tự vẽ. Mọi tính toán chạy trong trình duyệt, không gửi dữ liệu đi đâu
ngoài chính request đọc Sheet.

---

## 4. Luồng dữ liệu

### 4.1 Thu thập (extension, theo lịch)

```
alarm đến hạn
 └─ runCrawl()                              background.js:220
     ├─ closed_by=all (thiếu tham số thì API chỉ trả system)
     │   └─ lặp page: GET trade-history?page=N&page_size=100
     │        ├─ 401/403 → ném AUTH_EXPIRED         ← dừng, KHÔNG ghi gì
     │        └─ gom vào allTrades, khử trùng theo id
     ├─ sort theo closed_at giảm dần
     ├─ syncToSheet(allTrades)               background.js:178
     │   └─ chia mẻ 500 → POST từng mẻ
     ├─ downloadBackup() nếu cần             background.js:339
     ├─ ghi trạng thái vào chrome.storage.local
     ├─ notify / clear thông báo
     └─ checkStale()                         background.js:85
```

Phân trang: vòng lặp chạy khi `(page-1) * pageSize < meta.total_count`,
và thoát sớm nếu một trang trả về 0 dòng.

### 4.2 Ghi vào kho (Apps Script)

```
doPost(e)
 ├─ JSON.parse(e.postData.contents)
 ├─ checkSecret()                → BAD_SECRET nếu sai
 ├─ LockService.waitLock(30s)    → BUSY nếu quá hạn chờ
 ├─ ensureSheet()                → tự tạo sheet + header nếu thiếu
 ├─ existingIdSet(sh)            → đọc 1 phát cả cột id  ★ điểm nóng
 ├─ lọc: bỏ mọi id đã tồn tại
 ├─ setValues(rows)              → ghi 1 phát tất cả dòng mới
 └─ releaseLock()                → finally, luôn chạy
```

### 4.3 Đọc và phân tích (dashboard)

```
mở trang
 └─ loadFromSheet({silent:true})           trade-dashboard.html:479
     ├─ chưa có SECRET → dừng im lặng, hiện màn hình trống
     ├─ GET /exec?k=SECRET
     ├─ extractList(json) → json.trades    :395
     ├─ ingest(list)      → Map theo id    :428
     └─ finishLoad()                       :440
         ├─ normalizeTrade() cho từng lệnh :344
         ├─ populateFilterOptions()
         └─ applyFilters() → render()      :600
```

Hai nguồn — file và Sheet — **đi chung** `ingest()` + `finishLoad()`, nên nạp lẫn
lộn cả hai vẫn gộp và khử trùng đúng.

---

## 5. Mô hình thực thi của Apps Script

Phần này khác trực giác nhất, cần nắm trước khi sửa `Code.gs`.

### 5.1 Không có `main()`

File chỉ định nghĩa hàm. Có đúng ba cửa vào:

| Hàm | Ai gọi | Kích hoạt bởi |
|---|---|---|
| `doGet(e)` | Hạ tầng Google | HTTP GET tới `/exec` |
| `doPost(e)` | Hạ tầng Google | HTTP POST tới `/exec` |
| `setup()`, `stats()` | Người dùng | Nút Run trong trình soạn thảo |

`doGet`/`doPost` là **tên bắt buộc** theo quy ước Apps Script. Đổi tên là Google
không tìm thấy. Mọi hàm còn lại chỉ chạy khi được ba hàm trên gọi.

### 5.2 Mỗi request chạy lại toàn bộ file

Mỗi lần gọi tạo môi trường JavaScript hoàn toàn mới: các `const` top-level
(`SECRET`, `COLUMNS`, `TEXT_COLUMNS`) chạy lại từ đầu, rồi mới tới hàm cửa vào.
Xong request thì môi trường bị vứt.

**Hệ quả:** không cache được gì giữa hai request. Đó là lý do `existingIdSet()`
buộc phải đọc lại nguyên cột `id` mỗi lần POST, và là lý do nó được gom thành
**một** lệnh `getRange` thay vì lặp từng dòng. Dữ liệu duy nhất sống qua các lần
chạy là chính cái Sheet.

### 5.3 POST đi qua một redirect, nhưng chỉ chạy một lần

```
POST /exec ──→ script.google.com
                 ├─ chạy Code.gs, gọi doPost(e) với e.postData
                 ├─ ghi Sheet
                 └─ CẤT kết quả, trả 302
                      ↓
        Location: script.googleusercontent.com/...?user_content_key=XXX
                      ↓
                 GET ──→ trả kết quả đã cất
```

`doPost` chạy **đúng một lần**, ở bước POST. Redirect chỉ đi lấy kết quả đã cất;
`user_content_key` là chìa khoá lấy kết quả đó, và **dùng được một lần** — gọi lại
cùng URL lần hai trả về rỗng.

Kiểm chứng: POST body là chuỗi không phải JSON → trả `BAD_JSON`, tức `JSON.parse`
đã ném lỗi, chỉ xảy ra được nếu `doPost` cầm đúng body đó. Nếu nó chạy ở bước
redirect (không còn body) thì `JSON.parse('{}')` sẽ thành công và trả `BAD_SECRET`.

**Hệ quả cho code gọi:** phải để `fetch` ở chế độ `redirect: "follow"` mặc định.
Chặn redirect là mất kết quả trả về — nhưng dữ liệu thì **vẫn đã ghi vào Sheet**.
Và phải khai báo host `script.googleusercontent.com`, thiếu là request chết với
thông báo rất khó hiểu.

### 5.4 Thứ tự hàm trong file không quan trọng

Khai báo `function` được hoisting, nên `doGet` ở dòng 35 gọi `ensureSheet` ở dòng
115 vẫn chạy bình thường. Chỉ các `const` top-level là bắt buộc nằm trên.

### 5.5 Deploy

Bấm Save trong trình soạn thảo **không** làm URL chạy code mới. Bắt buộc
**Deploy → Manage deployments → New version**. URL không đổi giữa các version.

---

## 6. Định dạng dữ liệu

### 6.1 Bản ghi thô từ API

```jsonc
{
  "id": 15760,                    // khoá khử trùng, duy nhất toàn hệ thống
  "symbol": "CELRUSDT",
  "side": "short",                // long | short
  "opened_at": "2026-09-20T07:16:14.809048+00:00",
  "closed_at": "2026-09-20T07:33:02.592624+00:00",
  "opened_by": "system",
  "closed_by": "system",          // system | manual | ... (crawl bằng closed_by=all)
  "entry_price": "0.00436600",    // CHUỖI, không phải số
  "exit_price":  "0.00410800",
  "dca_count": 0,
  "realized_pnl": "0.84624000",
  "total_fees":   "0.00673712",
  "funding_fee":  "0",
  "trades": [                     // chi tiết khớp lệnh
    { "action": "entry",      "price": "...", "quantity": "...", "fee": null, "pnl": null },
    { "action": "dca",        "..." : "..." },
    { "action": "sync_close", "..." : "..." }
  ]
}
```

Giá trị tiền/giá là **chuỗi** — luôn đi qua `parseFloat` trước khi tính.

Không có trường định danh cá nhân nào: không email, không ID tài khoản, không khoá API.

### 6.2 Schema Sheet

15 cột, thứ tự cố định trong hằng `COLUMNS`. **Không đổi thứ tự sau khi đã có dữ liệu.**

| # | Cột | Kiểu | Ghi chú |
|---|---|---|---|
| 1 | `id` | số | Khoá khử trùng |
| 2 | `symbol` | text | |
| 3 | `side` | text | |
| 4 | `opened_at` | **text** | Ép `@` để Sheets không tự parse ISO date |
| 5 | `closed_at` | **text** | như trên |
| 6 | `opened_by` | text | |
| 7 | `closed_by` | text | |
| 8-10 | `entry_price`, `exit_price`, `dca_count` | số | |
| 11-13 | `realized_pnl`, `total_fees`, `funding_fee` | số | |
| 14 | `net_pnl` | số | **Dẫn xuất** = realized − fees. Lưu sẵn để pivot ngay trong Sheet |
| 15 | `execs` | **text** | `trades[]` dạng chuỗi JSON |

Cột 4, 5, 15 phải ở định dạng text (`setNumberFormat('@')` lúc `ensureSheet`), nếu
không Sheets tự diễn giải chuỗi ISO thành ngày và làm hỏng dữ liệu.

### 6.3 Vòng đời và tính toàn vẹn

```
API (chuỗi) → toRow() → Sheet → rowToTrade() → normalizeTrade() → dashboard
```

Đã kiểm chứng trên 37 lệnh thật: **0 trường sai lệch**, giữ đủ 104 bản ghi khớp
lệnh con, tổng hợp khớp tới 6 chữ số thập phân.

Chỉ tiêu dẫn xuất tính trong `normalizeTrade()` (`trade-dashboard.html:344`):

| Chỉ tiêu | Công thức |
|---|---|
| `net_pnl` | `realized_pnl − total_fees` |
| `win` | `net_pnl > 0` — **đã trừ phí**, không phải lãi gộp |
| `duration_ms` | `closed_at − opened_at` |

`funding_fee` **không** bị trừ khỏi `net_pnl`; nó hiển thị riêng ở ô hero.

---

## 7. Xử lý lỗi

### 7.1 Ma trận lỗi

| Tình huống | Crawl | Đẩy Sheet | File cứu hộ | Thông báo | Badge |
|---|---|---|---|---|---|
| Bình thường | OK | OK | không | — (xoá thông báo cũ) | `✓` xanh |
| Phiên hết hạn 401/403 | **hỏng** | không chạy | không | `auth-expired` | `!` đỏ |
| Lỗi mạng / HTTP khác | **hỏng** | không chạy | không | `crawl-failed` | `!` đỏ |
| Sai/thiếu SECRET | OK | **hỏng** | **có** | `sync-failed` | `!` vàng |
| Quá 10 ngày không đẩy được | — | — | — | `archive-stale` | — |

Điểm cốt yếu: **crawl hỏng thì không ghi gì cả.** Kho giữ nguyên dữ liệu cũ, không
bao giờ bị ghi đè bằng kết quả rỗng. Lần chạy thành công kế tiếp đẩy lại toàn bộ
và tự vá đầy khoảng trống.

### 7.2 Thông báo

Dùng id cố định (`NOTIFY` tại `background.js:30`) nên thông báo **thay thế** nhau
chứ không chồng đống. `requireInteraction: true` để ở lại tới khi bấm. Bấm vào là
mở xcrypto365.com. Chạy được rồi thì thông báo cũ tự bị xoá.

`checkStale()` còn chạy ở `chrome.runtime.onStartup`, nên đi vắng dài ngày về mở
Chrome là biết ngay, không phải đợi tới lượt crawl.

### 7.3 Kịch bản mất dữ liệu duy nhất còn lại

Phiên đăng nhập hết hạn âm thầm **và** xcrypto365 xoá lệnh cũ trong cùng khoảng
thời gian đó. Cảnh báo `archive-stale` (ngưỡng `STALE_DAYS = 10`) là lưới an toàn
cho đúng kịch bản này. Đặt lịch chạy **hàng ngày** thu hẹp cửa sổ mù từ 7 ngày
xuống 1 ngày, và bản thân việc gọi API thường xuyên cũng có xu hướng gia hạn phiên.

---

## 8. Quyết định thiết kế

### 8.1 Vì sao vẫn phải là extension, không phải script chạy nền

API xác thực bằng cookie phiên của trình duyệt (`credentials: "include"`). Một
script Node chạy ngoài sẽ phải tự nuôi token, và nếu server dùng cookie phiên hạn
ngắn thì phải lấy lại bằng tay liên tục. Extension "ăn ké" phiên vốn tự được gia
hạn mỗi khi người dùng vào web — đây là lợi thế quyết định.

### 8.2 Chỉ-thêm, không bao giờ xoá

Trong toàn bộ `Code.gs` không có một lệnh xoá hay sửa dòng nào. Lệnh trùng `id` bị
bỏ qua chứ không ghi đè.

Đánh đổi: lộ URL + SECRET thì kẻ xấu chèn được rác, nhưng **không xoá được dữ liệu**.
Với một công cụ lưu trữ, mất dữ liệu tệ hơn nhiều so với có rác — rác thì lọc được.

### 8.3 Vì sao Apps Script, không phải Pantry/KVdb/Firebase

Yêu cầu là "chỉ cần link là đọc ghi được, không OAuth". Apps Script thoả điều đó
(deploy `Execute as: Me` + `Anyone`, script chạy dưới quyền chủ sở hữu nên tự ghi
được Sheet, còn Sheet vẫn riêng tư). Khác với các dịch vụ free nhỏ ở chỗ **dữ liệu
nằm trong Drive của chính người dùng**, không phụ thuộc một bên thứ ba có thể đóng cửa.

### 8.4 Mỗi lần đẩy gửi TOÀN BỘ, không chỉ phần mới

Apps Script tự bỏ qua id đã có nên chi phí không đáng kể. Đổi lại được hai thứ:
không phải giữ trạng thái "đã đẩy những gì" ở máy (một nguồn lỗi bị loại bỏ), và
**tự vá lại** nếu Sheet thiếu dòng do một lần chạy trước hỏng giữa chừng.

### 8.5 File JSON hạ cấp thành bản cứu hộ

Bản 1.0 tải file mỗi lần chạy, mà mỗi file là snapshot **toàn bộ** chứ không phải
phần tăng thêm. Sau 3 năm chạy hàng tuần: ~245 MB trên 156 file, trong khi dữ liệu
thật chỉ ~3 MB — lãng phí khoảng 80×. Từ bản 1.2, mặc định chỉ tải khi đẩy Sheet
hỏng.

### 8.6 SECRET không nằm trong repo

URL nằm trong code (vô hại nếu không có SECRET). SECRET thì nhập qua giao diện:
extension lưu ở `chrome.storage.local`, dashboard lưu ở `localStorage`. Repo commit
được bình thường.

### 8.7 Dashboard không dùng thư viện ngoài

Biểu đồ SVG tự vẽ. Mở bằng `file://` là chạy, không cần build, không cần server,
không sợ CDN chết. Đánh đổi: code vẽ biểu đồ dài hơn.

---

## 9. Giới hạn và ngưỡng

| Hạng mục | Giới hạn | Khi nào chạm |
|---|---|---|
| Sức chứa Sheet | 10 triệu ô ÷ 15 cột ≈ **660.000 lệnh** | ~480 năm ở nhịp 3,7 lệnh/ngày |
| Thời gian chạy Apps Script | 6 phút/lần | Không, nếu giữ mẫu 1-đọc-1-ghi |
| Ký tự mỗi ô | 50.000 | Cột `execs` thường ~450 byte |
| Mẻ POST | 500 lệnh | Hằng `SHEET.batchSize` |
| `chrome.storage.local` | 10 MB | Chỉ lưu cài đặt, không lưu lệnh |
| Kích thước bản ghi | ~775 B/lệnh (328 B nếu bỏ `execs`) | `execs` chiếm 58% dung lượng |
| Điểm vẽ biểu đồ | Lấy mẫu xuống 600 | `MAX_PLOT_POINTS` |
| Phân trang bảng log | 100 dòng | `LOG_PAGE_SIZE` |

**Cảnh báo hiệu năng:** `doPost` và `doGet` đều tải toàn bộ Sheet vào bộ nhớ. Ở
quy mô hàng trăm nghìn lệnh cần chuyển sang đọc theo trang. Chưa cần thiết ở quy mô
hiện tại.

---

## 10. Bảo mật

| Tài sản | Nơi lưu | Nếu lộ |
|---|---|---|
| Web App URL | Trong code, trong repo | Vô hại nếu không có SECRET |
| SECRET | `chrome.storage.local`, `localStorage` | Chèn được rác, **không xoá được** dữ liệu |
| Cookie xcrypto365 | Cookie jar của trình duyệt | Không do hệ thống này quản lý |
| Sheet | Drive riêng tư, không chia sẻ | — |

`Who has access: Anyone` khi deploy **không** có nghĩa Sheet công khai. Nó chỉ cho
phép *gọi* URL; việc ghi do script thực hiện dưới quyền chủ sở hữu nhờ
`Execute as: Me`. Ai có URL mà không có SECRET chỉ nhận `BAD_SECRET`.

Dữ liệu không chứa định danh cá nhân (§6.1). Rủi ro khi lộ là **lộ chiến lược giao
dịch và lãi/lỗ**, không phải mất tiền hay lộ danh tính.

---

## 11. Kiểm thử

Không có test tự động. Các cách kiểm chứng đã dùng, lặp lại được:

**Endpoint** — gọi trực tiếp, không cần SECRET đúng:
```bash
curl -sL "<URL>?k=sai"                     # kỳ vọng {"ok":false,"error":"BAD_SECRET"}
curl -sL -D - -o /dev/null "<URL>?k=sai" | grep -i access-control
                                           # kỳ vọng Access-Control-Allow-Origin: *
```

**Logic extension** — giả lập `chrome.*` rồi chạy thật `runCrawl()`. Nạp
`background.js` bằng `Module._compile` với đuôi `module.exports={runCrawl,checkStale}`,
stub `storage`/`notifications`/`downloads`/`action`/`fetch`, rồi chạy các kịch bản:
crawl OK, 401, Sheet từ chối, thiếu SECRET, kho bị bỏ quên.

**Dashboard** — dựng server giả trả đúng hình dạng `doGet`, trỏ `SHEET_URL` vào đó,
chụp màn hình bằng Chrome headless:
```bash
chrome --headless=new --window-size=1280,2000 --virtual-time-budget=8000 \
       --screenshot=out.png file:///.../trade-dashboard.html
```

**Toàn vẹn dữ liệu** — chạy `toRow` → `rowToTrade` → `normalizeTrade` trên dữ liệu
thật rồi so từng trường với bản gốc.

**Chống trùng** — bấm "Chạy ngay" hai lần liên tiếp. Lần hai phải báo
`Lệnh mới thêm: 0`. Đây là phép thử quan trọng nhất của cả hệ thống.

---

## 12. Gỡ rối

| Triệu chứng | Nguyên nhân |
|---|---|
| `SECRET_CHUA_DOI` | Chưa sửa hằng `SECRET`, hoặc sửa rồi nhưng **chưa Deploy version mới** |
| `BAD_SECRET` | SECRET hai đầu lệch nhau |
| Trang đăng nhập Google thay vì JSON | Deploy sai *Who has access*, phải là `Anyone` |
| Extension báo lỗi mạng khi đẩy | Thiếu host `script.googleusercontent.com` |
| Cột ngày thành số lạ trong Sheet | Sheet `trades` bị tạo tay, thiếu định dạng text. Xoá tab rồi chạy lại `setup()` |
| Dashboard không tự nạp | Chưa lưu SECRET ở `localStorage`, hoặc đã xoá dữ liệu duyệt web |
| Không thấy thông báo desktop | Windows → Cài đặt → Hệ thống → Thông báo, kiểm tra Chrome và Focus assist |
| Không sinh file backup nữa | Đúng thiết kế — mặc định `backupMode = "onerror"` |

Xem log service worker: `chrome://extensions` → Chi tiết → **Service worker**.
Xem log Apps Script: trình soạn thảo → **Executions**.

---

## 13. Lịch sử phiên bản

| Bản | Thay đổi |
|---|---|
| 1.0.0 | Crawl theo lịch, tải file JSON mỗi lần chạy |
| 1.1.0 | Đẩy lên Google Sheet; file JSON hạ cấp thành bản cứu hộ; dashboard đọc thẳng từ Sheet |
| 1.2.0 | Thông báo desktop, cảnh báo kho bị bỏ quên, bộ icon |
