# Đồng bộ Google Sheet "QUẢN LÝ HỒ SƠ KHOA" → website (mục Hồ sơ Khoa)

Làm **một lần** bằng tài khoản Google **khoaduocxn2021@gmail.com** (chủ dự án Firebase).
Nếu Sheet thuộc tài khoản khác, hãy chia sẻ Sheet cho tài khoản này với quyền *Người chỉnh sửa*
rồi đăng nhập bằng khoaduocxn2021@gmail.com để làm các bước dưới.

1. Mở Google Sheet → **Tiện ích mở rộng → Apps Script**.
2. Xóa nội dung trong `Code.gs`, dán toàn bộ nội dung file **DongBoHoSoKhoa.gs**.
3. Bấm biểu tượng bánh răng **Cài đặt dự án** → tích **Hiển thị tệp kê khai "appsscript.json"**.
   Quay lại **Trình chỉnh sửa**, mở `appsscript.json`, thay toàn bộ bằng nội dung file **appsscript.json**.
4. Bấm **Lưu** (Ctrl+S). Chọn hàm **caiDat** ở thanh trên → bấm **Chạy**.
5. Google hỏi quyền → chọn tài khoản → **Nâng cao → Đi tới … (không an toàn)** → **Cho phép**.
   (Cảnh báo này xuất hiện với mọi script tự viết, không phải lỗi.)
6. Đợi khoảng 1 phút. Mở https://khoaduocxncmc.id.vn/ho-so-khoa.html để kiểm tra.

Sau khi cài:
- Sửa bất kỳ ô nào trong Sheet → website cập nhật sau khoảng **1–2 phút**.
- Menu **🌐 Website → Đồng bộ ngay** để cập nhật tức thì.
- Mỗi đêm 1 giờ sáng tự đồng bộ lại toàn bộ.
- Thêm trang tính mới → tự xuất hiện trên web trong nhóm "Khác" (muốn xếp vào nhóm khác: sửa bảng `CAU_HINH` đầu file).
- Ẩn một trang tính → trang đó không còn hiện trên web.
- Trang tính **GV Cơ Hữu, GV Thỉnh giảng, Thi đua** chỉ Admin xem được (`riengTu: true`).
- Mật khẩu ghi trong ô dạng "MK: …" được tự động che thành "MK: ••••••" trên web.

Ai được xem: Admin chọn trong trang Hồ sơ Khoa → **Quản trị → Phân quyền xem**.
