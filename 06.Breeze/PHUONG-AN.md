# Breeze — mỗi sáng 7h15 một bài viết hay gửi về Telegram

> ✅ **Đã chọn phương án A**, hướng dẫn cài đặt xem [`README.md`](README.md). File này giữ lại để biết vì sao chọn A.

Yêu cầu: miễn phí, không phải tự hosting, thêm bài dần dần cho dễ, gửi đúng 7h15 giờ Việt Nam.

Đã có: bot Telegram (token) và danh sách bài viết.

---

## Phương án A — Google Sheet + Apps Script  ⭐ khuyến nghị

```
Google Sheet (kho bài)  ──►  Apps Script (trigger 7h15)  ──►  Telegram Bot API  ──►  điện thoại
```

**Cách chạy**

1. Sheet có các cột: `id | noi_dung | tac_gia | da_gui_luc`.
2. Mỗi ngày Apps Script tự chạy, lấy **bài đầu tiên chưa gửi** (`da_gui_luc` trống),
   gọi `sendMessage` của Telegram, rồi ghi ngày giờ đã gửi vào `da_gui_luc`.
3. Khi gửi hết bài thì quay lại từ đầu (hoặc dừng, tuỳ bạn chọn).
4. Muốn thêm bài: mở Google Sheet (cả trên app điện thoại) và gõ thêm một dòng.

**Gửi đúng 7h15:** trigger theo ngày của Apps Script chỉ chọn được khung 1 tiếng
(7h–8h). Mẹo xử lý: một trigger chạy khoảng 6h–7h sẽ hẹn thêm một trigger chạy
**một lần đúng 7h15**, nên giờ gửi lệch không quá khoảng 1 phút.

| Ưu điểm | Nhược điểm |
|---|---|
| Hoàn toàn miễn phí, không bao giờ bị tạm dừng | Giờ gửi lệch khoảng ±1 phút (thường chỉ vài chục giây) |
| Sửa bài trên Sheet, tiện cả trên điện thoại | Giới hạn 6 phút mỗi lần chạy, 90 phút/ngày — thừa cho việc này |
| Giống Xcrypto, bạn đã quen | |
| Token để trong Script Properties, không nằm trong code | |
| Cài đặt khoảng 10 phút, toàn bấm chuột | |

---

## Phương án B — Supabase (Postgres + pg_cron + pg_net)

```
Bảng `posts` (Postgres)  ──►  pg_cron '15 0 * * *' (UTC)  ──►  pg_net HTTP POST  ──►  Telegram
```

**Cách chạy**

1. Tạo bảng `posts(id, noi_dung, tac_gia, da_gui_luc)`.
2. Viết một hàm SQL `send_daily_post()`: chọn bài chưa gửi, dùng `net.http_post` gọi
   Telegram, rồi cập nhật `da_gui_luc`.
3. Dùng `pg_cron` lên lịch `15 0 * * *` (00:15 UTC tức 07:15 giờ Việt Nam).
4. Token bot cất trong Supabase Vault.
5. Thêm bài qua Table Editor trên web của Supabase.

| Ưu điểm | Nhược điểm |
|---|---|
| Giờ gửi chính xác đến từng phút | ⚠️ **Gói free bị tạm dừng nếu project không có hoạt động trong 7 ngày.** Cron chạy bên trong database chưa chắc được tính là có hoạt động, nên có thể phải thêm một nguồn ping từ bên ngoài |
| Database thật, sau này dễ mở rộng (thêm tag, gửi ngẫu nhiên, nhiều kênh…) | Thêm bài trên điện thoại không tiện bằng Sheet |
| | Phải viết SQL, debug khó hơn (xem log ở `cron.job_run_details`, `net._http_response`) |

---

## So sánh nhanh

| Tiêu chí | A. Sheet + Apps Script | B. Supabase |
|---|---|---|
| Chi phí | 0đ | 0đ (gói free) |
| Hosting | Không | Không |
| Độ chính xác giờ gửi | khoảng ±1 phút | chính xác |
| Thêm/sửa bài | Rất dễ (Sheet, app điện thoại) | Trung bình (web dashboard) |
| Rủi ro ngừng chạy | Gần như không | Có thể bị tạm dừng sau 7 ngày không có hoạt động |
| Độ khó cài đặt | Dễ | Trung bình |
| Khả năng mở rộng | Đủ dùng | Tốt hơn |

**Khuyến nghị: phương án A.** Với nhu cầu mỗi ngày một bài, Sheet tiện hơn hẳn,
không có rủi ro bị tạm dừng như gói free của Supabase, và giống Xcrypto mà bạn đã quen.

---

## Phần chung cho cả hai phương án

**Lấy `chat_id`:**
- Gửi về chat riêng: nhắn bot một tin bất kỳ, rồi mở
  `https://api.telegram.org/bot<TOKEN>/getUpdates` và tìm `"chat":{"id": ...}`.
- Gửi vào channel hoặc group: thêm bot làm admin. `chat_id` là `@ten_channel`
  hoặc số dạng `-100xxxxxxxxxx`.

**Định dạng tin nhắn:** dùng `parse_mode: HTML` (in đậm tên tác giả, in nghiêng câu
trích…). Mỗi tin Telegram tối đa 4096 ký tự, bài dài hơn sẽ được tự cắt thành nhiều tin.
