# SBS House Downloader - Chrome Extension

Extension tải ảnh và thông tin dự án từ sbshouse.vn

## Cài đặt

1. Mở Chrome → Vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Nhấn **Load unpacked**
4. Chọn thư mục `sbs-downloader` này
5. Extension đã sẵn sàng 🎉

## Cách dùng

1. Mở trang dự án bất kỳ trên **sbshouse.vn**  
   Ví dụ: `https://sbshouse.vn/thuc-te-s-villa-biet-thu-vuon-dia-trung-hai/`
2. Click icon extension (🏠) trên thanh toolbar
3. Extension sẽ tự động quét tìm ảnh và thông tin
4. Nhấn **Download X ảnh + file txt**
5. File sẽ được lưu vào thư mục Downloads của Chrome

## Cấu trúc file tải về

```
Downloads/
└── sbs_house_thuc-te-s-villa-biet-thu-vuon-dia-trung-hai/
    ├── thong_tin_du_an.txt      ← Thông tin dự án
    ├── anh_001.jpg
    ├── anh_002.jpg
    └── ...
```

## Lưu ý

- Tên folder theo pattern: `sbs_house_` + slug URL (ví dụ: `sbs_house_thuc-te-s-villa`)
- File `thong_tin_du_an.txt` chứa đầy đủ: tên, diện tích, vị trí, chi phí, mô tả, danh sách ảnh
- Chrome sẽ hỏi vị trí lưu nếu bạn bật "Ask where to save each file" trong Settings Downloads
- Để tắt hỏi: Settings → Downloads → tắt "Ask where to save each file before downloading"
