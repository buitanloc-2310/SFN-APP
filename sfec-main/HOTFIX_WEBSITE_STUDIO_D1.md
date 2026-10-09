# Website Studio D1 hotfix

Hotfix này xử lý hai nguyên nhân khiến `#admin/studio` đứng mãi ở **Đang tải…**:

1. Các Promise trong bộ định tuyến trang quản trị trước đây được `return` mà không `await`, nên lỗi API bất đồng bộ không đi vào `catch` và giao diện giữ nguyên trạng thái loading.
2. Website Studio phụ thuộc migration `0006_site_studio.sql`. Bản hotfix thêm cơ chế đảm bảo schema cho riêng `site_pages` / `site_page_revisions` khi mở Studio, vì vậy database production cũ chưa có migration 0006 vẫn có thể tự tạo các bảng cần thiết.

## Vẫn nên chạy migration chính thức

```bash
npm install
npm run db:migrate
npm run deploy
```

Cấu hình hiện tại dùng D1 binding `DB`, database `sfec-app-db`.
