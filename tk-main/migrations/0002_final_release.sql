PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions(id,code,name) VALUES
('perm_member_view','member.view','Xem hồ sơ thành viên'),
('perm_member_edit','member.edit','Chỉnh sửa hồ sơ thành viên'),
('perm_org_manage','org.manage','Quản lý cơ cấu tổ chức'),
('perm_account_manage','account.manage','Quản lý tài khoản'),
('perm_role_manage','role.manage','Quản lý phân quyền'),
('perm_goal_manage','goal.manage','Quản lý mục tiêu'),
('perm_task_manage','task.manage','Quản lý công việc'),
('perm_activity_manage','activity.manage','Quản lý hoạt động'),
('perm_certificate_manage','certificate.manage','Quản lý chứng nhận'),
('perm_achievement_manage','achievement.manage','Quản lý thành tích'),
('perm_card_manage','card.manage','Quản lý thẻ'),
('perm_audit_view','audit.view','Xem nhật ký hệ thống'),
('perm_system_manage','system.manage','Quản lý hệ thống');

INSERT OR IGNORE INTO card_types(id,code,name,description) VALUES
('card_member','MEMBER','Thẻ Thành viên SFN','Thẻ nhận diện thành viên Mạng lưới'),
('card_executive','EXECUTIVE','Thẻ Ban Chấp hành','Thẻ dành cho thành viên Ban Chấp hành'),
('card_unit','UNIT','Thẻ Đơn vị trực thuộc','Thẻ theo đơn vị trực thuộc'),
('card_volunteer','VOLUNTEER','Thẻ Tình nguyện viên','Thẻ theo chương trình/dự án tình nguyện'),
('card_advisor','ADVISOR','Thẻ Cố vấn','Thẻ dành cho cố vấn'),
('card_alumni','ALUMNI','Thẻ Cựu thành viên','Thẻ ghi nhận cựu thành viên');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_super_admin', id FROM permissions;

INSERT OR IGNORE INTO schema_version(version) VALUES(2);
