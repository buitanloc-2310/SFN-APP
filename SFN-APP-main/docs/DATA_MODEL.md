# DATA MODEL — TÓM TẮT

Các nhóm bảng chính:

- Auth: `users`, `roles`, `user_roles`, `sessions`, `auth_tokens`
- Config: `settings`, `modules`, `terms`, `forms`, `counters`
- Hồ sơ: `submissions`, `files`
- Nhân sự: `people`, `people_history`, `teaching_scopes`, `internal_requests`
- Tổ chức: `units`, `unit_members`
- Giáo dục: `classes`, `class_enrollments`, `attendance`
- Sự kiện: `events`, `event_registrations`
- CMS: `news`, `documents`
- GCN/GXN: `certificates`, `certificate_history`, `approvals`
- Tuyển dụng: `interviews`, `evaluations`
- Support: `tickets`, `ticket_messages`
- Nội bộ: `notifications`, `tasks`
- Email: `email_templates`, `email_logs`
- Privacy/Backup/Audit: `data_requests`, `backups`, `audit_log`, `rate_limits`

Mỗi submission lưu `form_version` + `form_snapshot_json` + `terms_snapshot_json`, vì vậy việc Admin sửa form/điều khoản sau này không làm mất phiên bản mà người nộp đã sử dụng.
