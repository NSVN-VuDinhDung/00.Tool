# Kho lịch sử trade trên Google Sheet

Web App của Apps Script làm kho lưu trữ: extension **ghi** vào, dashboard **đọc** ra,
cả hai chỉ cần một URL — không OAuth, không Google Cloud project.

Sheet để **riêng tư**. Không chia sẻ cho ai. Script chạy dưới danh nghĩa tài khoản
của bạn nên nó tự có quyền ghi.

> Tài liệu này là **hướng dẫn cài đặt**. Muốn hiểu hệ thống hoạt động thế nào —
> kiến trúc, luồng dữ liệu, mô hình thực thi của Apps Script, các quyết định thiết
> kế — xem [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## Cài đặt (khoảng 10 phút, toàn bấm chuột)

### 1. Tạo Sheet

Mở <https://sheets.new>. Đặt tên gì cũng được, ví dụ `Trade History Store`.
Không cần tạo cột — script tự tạo.

### 2. Mở trình soạn thảo Apps Script

Trong Sheet: menu **Tiện ích mở rộng → Apps Script** (*Extensions → Apps Script*).

Một tab mới mở ra với file `Code.gs` chứa hàm `myFunction` rỗng.

### 3. Dán code

Xoá sạch nội dung có sẵn, dán toàn bộ nội dung file [`Code.gs`](Code.gs) vào.

### 4. Đổi SECRET  ← đừng bỏ qua bước này

Dòng đầu file:

```js
const SECRET = 'DOI-CHUOI-NAY-TRUOC-KHI-DEPLOY';
```

Đổi thành chuỗi của riêng bạn — dài, ngẫu nhiên, **không trùng mật khẩu nào khác**
vì nó sẽ nằm trong code extension. Ví dụ `tr4de-9kQz7mNvX2pLdR8w`.

Script từ chối hoạt động nếu bạn chưa đổi, nên không sợ quên.

Bấm biểu tượng đĩa mềm để lưu.

### 5. Chạy `setup` một lần

Trên thanh công cụ, chọn hàm `setup` trong dropdown rồi bấm **Run**.

Lần đầu Google sẽ hỏi cấp quyền:

1. **Review permissions** → chọn tài khoản của bạn
2. Hiện màn hình **"Google hasn't verified this app"** → bấm **Advanced**
   → **Go to ... (unsafe)**
3. **Allow**

> Màn hình cảnh báo đó trông đáng sợ nhưng đây là script của chính bạn, vừa tự tay
> dán vào, chạy trong tài khoản của bạn. Google hiện nó cho mọi script chưa qua
> thẩm định thương mại.

Chạy xong, quay lại Sheet sẽ thấy một tab tên `trades` với hàng tiêu đề.

### 6. Deploy thành Web App

**Deploy → New deployment** → bấm bánh răng cạnh *Select type* → **Web app**.

Điền đúng như sau:

| Trường | Giá trị |
|---|---|
| Description | gì cũng được |
| **Execute as** | **Me (email của bạn)** |
| **Who has access** | **Anyone** |

Bấm **Deploy**, rồi copy **Web app URL**. Dạng:

```
https://script.google.com/macros/s/AKfycb..................../exec
```

Đây là URL duy nhất bạn cần. Giữ nó như giữ mật khẩu.

> **Vì sao phải chọn "Anyone"?** Đó chỉ là cho phép *gọi* URL. Việc ghi Sheet do
> script thực hiện dưới quyền tài khoản bạn (nhờ *Execute as: Me*). Sheet vẫn riêng
> tư tuyệt đối. Ai có URL mà không có SECRET thì chỉ nhận về `BAD_SECRET`.

### 7. Kiểm tra

Dán vào trình duyệt (thay `SECRET_CUA_BAN`):

```
https://script.google.com/macros/s/AKfycb.../exec?k=SECRET_CUA_BAN
```

Đúng thì trả về:

```json
{"ok":true,"exported_at":"...","total":0,"trades":[]}
```

Thử bỏ tham số `k` đi, phải nhận `{"ok":false,"error":"BAD_SECRET"}`.
Nếu được như vậy là kho đã sẵn sàng.

---

## Nối extension và dashboard

Sau khi có URL ở bước 6, URL đã được điền sẵn trong `background.js` và
`trade-dashboard.html`. **SECRET thì không** — nó không nằm trong bất kỳ file nào
của repo, để còn commit được mà không lộ.

### Extension

1. Vào `chrome://extensions` → bật **Chế độ dành cho nhà phát triển** → bấm **Tải lại**
   trên Trade History Auto-Archiver.
   Bản 1.1.0 xin thêm quyền truy cập `script.google.com`, nếu Chrome không tự cấp
   thì gỡ ra rồi **Tải tiện ích đã giải nén** lại.
2. Bấm vào icon extension → dán SECRET vào ô → **Lưu & kiểm tra kết nối**.
   Đúng thì hiện `✓ Kết nối được. Kho đang có N lệnh.`
3. Bấm **Chạy ngay** để đẩy mẻ đầu tiên lên.

SECRET lưu trong `chrome.storage.local`, chỉ nhập một lần.

### Dashboard

Mở `trade-dashboard.html` → bấm **Tải từ Google Sheet** → nhập SECRET một lần.
Từ lần sau mở lên là có số liệu ngay, không phải chọn file.

SECRET lưu trong `localStorage` của trình duyệt. Xoá dữ liệu duyệt web thì nhập lại,
không mất gì vì kho nằm trên Sheet.

### Thông báo khi hỏng

Extension không còn báo lỗi âm thầm bằng mỗi cái badge nữa. Từ bản 1.2.0 nó bắn
thông báo desktop, ở lại tới khi bạn bấm (bấm vào là mở thẳng xcrypto365.com):

| Thông báo | Khi nào | Có tải file backup không |
|---|---|---|
| **Phiên đăng nhập xcrypto365 đã hết hạn** | API trả 401/403 | Không — crawl hỏng nên chẳng có gì để lưu |
| **Lấy lịch sử trade thất bại** | Lỗi mạng hoặc HTTP khác | Không |
| **Không đẩy được lên Google Sheet** | Sai SECRET, chưa nhập SECRET, Sheet bận | **Có** — file JSON là bản cứu hộ |
| **Kho lưu trữ đang bị bỏ quên** | Quá 10 ngày (`STALE_DAYS`) không đẩy được lệnh nào | — |

Cảnh báo "bị bỏ quên" là lưới an toàn cho kịch bản tệ nhất: phiên hết hạn âm thầm
hàng tháng trong khi xcrypto365 xoá dần lệnh cũ. Nó còn chạy lúc mở Chrome
(`onStartup`), nên đi vắng về là biết ngay chứ không phải đợi tới lượt crawl.
Popup cũng hiện cùng cảnh báo đó ở đầu.

Chạy được rồi thì các thông báo cũ tự biến mất.

> Nếu không thấy thông báo nào: kiểm tra Windows **Cài đặt → Hệ thống → Thông báo**
> xem Chrome có đang bị tắt hoặc đang bật Focus assist không.

### Chế độ tải file backup

Trong popup có mục **Tải file JSON về máy**:

| Lựa chọn | Ý nghĩa |
|---|---|
| **Chỉ khi đẩy lên Sheet lỗi** (mặc định) | Thư mục `TradeHistoryArchive` không phình nữa. File chỉ sinh ra khi Sheet hỏng — đúng lúc cần bản cứu hộ |
| Mỗi lần chạy | Như bản 1.0 |
| Không bao giờ | Sheet là kho duy nhất |

---

## API

| | |
|---|---|
| **Đọc** | `GET <URL>?k=<SECRET>` → `{ ok, exported_at, total, trades: [...] }` |
| **Ghi** | `POST <URL>` body `{ "secret": "<SECRET>", "trades": [...] }` → `{ ok, added, received, total }` |

`trades` nhận vào đúng định dạng thô của API xcrypto365, trả ra cũng vậy — dashboard
dùng lại được ngay không cần đổi gì.

**Chỉ thêm, không xoá.** Lệnh có `id` đã tồn tại bị bỏ qua chứ không ghi đè. Trong
toàn bộ `Code.gs` không có một lệnh xoá hay sửa dòng nào. Lộ URL thì rủi ro tối đa
là bị chèn rác, không mất dữ liệu.

---

## Cập nhật code về sau

Sửa `Code.gs` xong phải **Deploy → Manage deployments → bút chì → Version: New version
→ Deploy**. Chỉ bấm Save trong trình soạn thảo là *không* đủ — URL vẫn chạy code cũ.

URL không đổi khi deploy version mới, nên không phải sửa lại extension.

---

## Giới hạn cần biết

| | |
|---|---|
| Sức chứa Sheet | 10 triệu ô ÷ 15 cột ≈ **660.000 lệnh** |
| Thời gian mỗi lần chạy | 6 phút — code đã gom thành 1 lệnh đọc + 1 lệnh ghi nên không lo |
| Dung lượng mỗi ô | 50.000 ký tự (cột `execs` xa ngưỡng này) |

---

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| `SECRET_CHUA_DOI` | Chưa làm bước 4, hoặc đã sửa nhưng chưa deploy version mới |
| `BAD_SECRET` | SECRET trong extension khác SECRET trong Code.gs |
| Trang đăng nhập Google thay vì JSON | *Who has access* không phải **Anyone** |
| Ghi được nhưng cột ngày thành số lạ | Sheet `trades` bị tạo tay. Xoá tab đó rồi chạy lại `setup` |
| Extension báo lỗi mạng | Thiếu `script.googleusercontent.com` trong `host_permissions` |
