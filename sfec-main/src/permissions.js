
export const ROLE_PERMISSIONS = {
  super_admin:["*"],
  system_admin:[
    "dashboard.view","submission.view","submission.manage","people.view","people.manage",
    "form.view","form.manage","module.manage","settings.manage","user.view","user.manage",
    "role.manage_lower","class.manage","event.manage","news.manage","unit.manage","document.manage",
    "certificate.view","certificate.request","certificate.issue","approval.view","approval.manage",
    "ticket.manage","file.manage","search.use","export.use","task.manage","privacy.manage",
    "backup.create","audit.view","email.manage"
  ],
  club_secretary:[
    "dashboard.view","submission.view","people.view","certificate.view","certificate.approve",
    "approval.view","approval.decide","document.view","audit.view"
  ],
  office:[
    "dashboard.view","submission.view","submission.manage","people.view","people.manage",
    "document.manage","certificate.view","certificate.issue","approval.view",
    "ticket.manage","file.manage","task.manage","export.use"
  ],
  hr:[
    "dashboard.view","submission.view","submission.manage","people.view","people.manage",
    "interview.manage","evaluation.manage","certificate.view","certificate.request",
    "approval.view","approval.request","file.manage","task.manage","export.use"
  ],
  communications:[
    "dashboard.view","news.manage","file.manage","task.manage"
  ],
  external_events:[
    "dashboard.view","submission.view","event.manage","ticket.manage","unit.view","task.manage","file.manage"
  ],
  unit_admin:[
    "dashboard.view","submission.view","people.view","class.manage","event.manage","unit.view","file.manage","task.manage"
  ],
  handler:[
    "dashboard.view","submission.view","submission.manage_assigned","ticket.manage_assigned","task.manage"
  ],
  member:["portal.member","file.own","request.internal","notification.own","certificate.own"],
  volunteer:["portal.member","file.own","request.internal","notification.own","certificate.own"],
  student:["portal.student","file.own","notification.own","certificate.own"]
};

export function roleLevel(role){
  const levels={
    super_admin:100,system_admin:90,club_secretary:80,office:70,hr:70,
    communications:60,external_events:60,unit_admin:50,handler:40,member:20,volunteer:20,student:10
  };
  return levels[role]||0;
}

export function permissionsForRoles(roles=[]){
  const out=new Set();
  for(const r of roles){
    for(const p of ROLE_PERMISSIONS[r.role_id]||[]) out.add(p);
  }
  return out;
}

export function hasPermission(user, permission){
  if(!user) return false;
  const perms=permissionsForRoles(user.roles||[]);
  return perms.has("*")||perms.has(permission);
}

export function highestRoleLevel(user){
  return Math.max(0,...(user?.roles||[]).map(r=>roleLevel(r.role_id)));
}
