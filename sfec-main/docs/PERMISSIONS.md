# PHÂN QUYỀN SFEC

## Tầng quyền

| Role | Mức | Phạm vi chính |
|---|---:|---|
| super_admin | 100 | Toàn hệ thống; tài khoản gốc được bảo vệ |
| system_admin | 90 | Hệ thống, tài khoản, modules, settings; không được can thiệp Super Admin gốc |
| club_secretary | 80 | Phê duyệt nghiệp vụ/GCN theo thẩm quyền |
| office | 70 | Văn phòng, hồ sơ, văn bản, phát hành GCN/GXN |
| hr | 70 | Tuyển dụng, hồ sơ nhân sự, phỏng vấn, đánh giá |
| communications | 60 | Tin tức/CMS/truyền thông |
| external_events | 60 | Đối ngoại, sự kiện, ticket liên quan |
| unit_admin | 50 | Quản trị trong phạm vi đơn vị trực thuộc |
| handler | 40 | Xử lý hồ sơ/ticket được giao |
| member | 20 | Thành viên SFEC |
| volunteer | 20 | Tình nguyện viên |
| student | 10 | Học sinh/Học viên |

## Quy tắc quan trọng

- Người tự đăng ký tài khoản chỉ nhận role `student`.
- Quyền `member`, `volunteer`, Admin phải do SFEC cấp.
- Admin cấp thấp không được tự nâng mình lên role ngang/cao hơn thẩm quyền.
- Chỉ Super Admin được cấp `super_admin` cho tài khoản khác.
- Tài khoản gốc `sfec.englishclub@gmail.com` không thể bị Admin khác khóa hoặc gỡ quyền Super Admin.
- Mọi thay đổi quyền đều ghi Audit Log.
