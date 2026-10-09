PRAGMA foreign_keys = ON;

-- Network Admin: full operational administration, excluding only the system-bootstrap privilege.
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_network_admin', id FROM permissions WHERE code <> 'system.manage';

-- Scoped Admin: member operations only. API additionally enforces assigned org scope + descendants.
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_scope_admin', id FROM permissions
WHERE code IN (
 'member.view','member.edit','account.manage','goal.manage','task.manage',
 'activity.manage','certificate.manage','achievement.manage','card.manage'
);

-- Approval of new account requests remains network-level only.
DELETE FROM role_permissions
WHERE role_id='role_scope_admin'
  AND permission_id IN (SELECT id FROM permissions WHERE code IN ('request.manage','org.manage','role.manage','audit.view','system.manage'));

INSERT OR IGNORE INTO schema_version(version) VALUES(5);
