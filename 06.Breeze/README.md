# Breeze — 7h15 mỗi sáng một bài viết hay gửi về Telegram

```
Google Sheet (kho bài)  ──►  Apps Script (tự chạy 7h15)  ──►  Telegram Bot  ──►  điện thoại
```

Miễn phí, không cần server. Bạn chỉ việc thêm bài vào Google Sheet.
Vì sao chọn cách này: xem [`PHUONG-AN.md`](PHUONG-AN.md).

**Cách chọn bài:** chọn ngẫu nhiên, nhưng chỉ bốc trong các bài có *số lần gửi ít nhất*.

- Bài nào cũng được gửi hết một lượt rồi mới quay vòng ngẫu nhiên lại.
- Bài mới thêm vào được ưu tiên trong lượt hiện tại.
- Không bao giờ gửi cùng một bài 2 ngày liền.

---

## Cài đặt (khoảng 10 phút)

### 1. Tạo Google Sheet

Mở <https://sheets.new>, đặt tên, ví dụ `Breeze`.

Vào **Tệp → Cài đặt** (*File → Settings*) và chọn múi giờ **(GMT+07:00) Bangkok/Hà Nội**,
để cột "Gửi lần cuối" hiển thị đúng giờ.

### 2. Dán code

Trong Sheet, mở menu **Tiện ích mở rộng → Apps Script**. Xoá hết code có sẵn, dán toàn bộ
nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) vào, rồi bấm 💾 để lưu.

### 3. Nhập token bot

Trong trình soạn thảo Apps Script, bấm ⚙️ **Project Settings** (thanh bên trái). Kéo xuống
**Script Properties** và chọn **Add script property**:

| Property | Value |
|---|---|
| `TELEGRAM_TOKEN` | token của bot, dạng `123456789:AAH...` |

Bấm **Save script properties**.

> Token để ở đây chứ không để trong code, nên lỡ có chia sẻ code cũng không bị lộ.

### 4. Lấy chat_id

1. Mở Telegram và nhắn cho bot một tin bất kỳ, ví dụ `hi`.
   - Nếu muốn gửi vào **channel/group**: thêm bot vào làm **admin**, rồi đăng một tin trong đó.
2. Quay lại Apps Script, chọn hàm **`findChatId`** trong ô chọn hàm và bấm **Run**.
3. Lần chạy đầu tiên Google sẽ hỏi cấp quyền: **Review permissions** → chọn tài khoản →
   **Advanced** → **Go to ... (unsafe)** → **Allow**. Đây là script của chính bạn nên yên tâm.
4. Mở **Execution log** để xem dòng `chat_id = ...`. Chat riêng là một số dương; group hoặc
   channel là số âm dạng `-100...`.
5. Thêm property thứ hai vào Script Properties:

| Property | Value |
|---|---|
| `TELEGRAM_CHAT_ID` | số vừa lấy được |

> Nếu chạy `findChatId` mà báo lỗi `409 Conflict`, nghĩa là bot đang được nơi khác dùng qua
> webhook (ví dụ n8n). Gỡ webhook bằng cách mở
> `https://api.telegram.org/bot<TOKEN>/deleteWebhook`, hoặc lấy chat_id từ nơi đang dùng bot đó.

### 5. Chạy `setup` một lần

Chọn hàm **`setup`** và bấm **Run**. Hàm này sẽ:

- tạo tab `BaiViet` với 4 cột: **Nội dung | Tác giả | Số lần gửi | Gửi lần cuối**
- tạo trigger chạy hằng ngày

Nếu log báo `OK` là xong.

### 6. Nhập bài viết

Mở tab `BaiViet` và nhập bài từ dòng 2:

- **Nội dung** (bắt buộc): bài có xuống dòng thì bấm `Ctrl+Enter` (hoặc `Alt+Enter`) bên trong ô.
- **Tác giả** (không bắt buộc): sẽ hiện ở cuối bài dạng *— Tác giả*.
- **Số lần gửi** và **Gửi lần cuối**: để trống, script tự điền.

Nếu đã có sẵn danh sách trong file Excel/CSV: vào **Tệp → Nhập** (*File → Import*) → chọn file
→ **Thêm vào trang tính hiện tại** (*Append to current sheet*). Lưu ý chọn đúng tab `BaiViet` và
xếp cột cho khớp thứ tự trên.

### 7. Gửi thử

Chọn hàm **`sendTest`** và bấm **Run**. Telegram sẽ nhận một bài ngẫu nhiên có ghi 🧪 *Gửi thử*.
Lần gửi thử này **không** được tính vào số lần gửi.

Từ giờ mỗi sáng khoảng 7h15 bài sẽ tự gửi về Telegram.

---

## Tin nhắn trông thế nào

```
🌿 Breeze · 14/11/2026

Hạnh phúc không phải là đích đến, mà là hành trình.

— Ai đó
```

Muốn đổi dòng đầu thì sửa hằng số `HEADER` ở đầu file code (đặt `''` nếu muốn bỏ dòng đầu).
Bài dài hơn khoảng 3800 ký tự sẽ tự được cắt thành nhiều tin liên tiếp.

---

## Tuỳ chọn: bài dài đăng lên Telegraph

Bài dài hơn 3800 ký tự sẽ được đăng lên **telegra.ph**. Telegram chỉ nhận **1 tin** gồm tiêu đề,
đoạn mở đầu và link **⚡ Instant View** để đọc toàn bài ngay trong app. Bài ngắn vẫn gửi thẳng như cũ.

**Bật:**

1. Trong Apps Script, bấm **＋** cạnh mục *Files* → **Script** → đặt tên `Telegraph`.
2. Dán nội dung file [`apps-script/Telegraph.gs`](apps-script/Telegraph.gs) vào rồi lưu.
3. Đồng thời dán lại `Code.gs` bản mới nhất (có thêm chỗ nối sang Telegraph).
4. Chạy hàm **`sendTestTelegraph`**: hàm này lấy **bài dài nhất** trong Sheet, đăng lên Telegraph
   và gửi thử (không tính vào số lần gửi).
   - Lần đầu chạy, script tự tạo tài khoản Telegraph và lưu `TELEGRAPH_TOKEN` vào Script Properties.

**Tiêu đề trang:** nếu dòng đầu của bài ngắn (từ 120 ký tự trở xuống), dòng đó được dùng làm
tiêu đề. Nếu không, tiêu đề là khoảng 80 ký tự đầu của bài.

**Tắt hoặc quay về bản cũ:** chọn một trong hai cách.

- Xoá file `Telegraph.gs` trong Apps Script (⋮ cạnh tên file → **Delete**). `Code.gs` tự quay về
  cách cắt thành nhiều tin.
- Hoặc sửa thành `TELEGRAPH_ENABLED = false` trong `Telegraph.gs`.

**Khi Telegraph bị lỗi** lúc gửi hằng ngày: script tự chuyển sang cách cắt nhiều tin, nên hôm đó
vẫn có bài.

**Đổi ngưỡng:** muốn bài vừa vừa (ví dụ trên 1500 ký tự) cũng đăng Telegraph thì sửa
`TELEGRAPH_MIN_LEN`.

> Trang Telegraph là **công khai**: ai có link đều xem được, và không xoá được qua API.

---

## Cách hoạt động & tuỳ chỉnh

| Thứ | Ở đâu |
|---|---|
| Đổi giờ gửi | `SEND_HOUR`, `SEND_MINUTE` ở đầu file → lưu → chạy lại `setup` |
| Xem các lần chạy, lỗi | Apps Script → **Executions** (thanh bên trái) |
| Xem trigger | Apps Script → **Triggers** ⏰ |
| Gửi lại từ đầu | Xoá trắng 2 cột *Số lần gửi* và *Gửi lần cuối* |
| Ngừng gửi một bài | Xoá dòng đó, hoặc gõ số lần gửi thật lớn, ví dụ `999` |

**Vì sao cần 2 trigger:** trigger hằng ngày của Apps Script chỉ đặt được khung 1 tiếng (ví dụ
7h–8h), không chọn được đúng phút. Vì vậy:

1. Trigger `scheduleToday` chạy khoảng 5h–6h sáng và hẹn thêm một trigger chạy **một lần**
   đúng 7h15.
2. Trigger chạy một lần đó gọi `sendDaily` để gửi bài, thường chỉ lệch vài chục giây.

**Chống gửi trùng:** `sendDaily` ghi nhớ ngày đã gửi, nên dù có bị gọi 2 lần thì mỗi ngày
cũng chỉ gửi 1 bài.

**Khi có lỗi** (token sai, mất mạng…): Google tự gửi email báo lỗi về Gmail của bạn. Script tự
thử lại 3 lần với lỗi mạng hoặc lỗi phía Telegram. Bài chỉ được đánh dấu đã gửi khi Telegram
xác nhận gửi thành công.

**Giới hạn của gói free:** mỗi lần chạy tối đa 6 phút, trigger chạy tối đa 90 phút mỗi ngày.
Mỗi lần gửi chỉ mất khoảng 1–2 giây nên còn thừa rất nhiều.
