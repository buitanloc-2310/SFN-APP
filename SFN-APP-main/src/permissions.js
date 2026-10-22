export const ROLE_PERMISSIONS = {
  owner:["*"],
  super_admin:["*"],
  system_admin:[
    "dashboard.view","submission.view","submission.manage","people.view","people.manage",
    "form.view","form.manage","module.manage","settings.manage","user.view","user.manage",
    "role.manage_lower","class.manage","event.manage","news.manage","unit.view","unit.manage",
    "document.view","document.manage","document.version_manage",
    "certificate.view","certificate.request","certificate.approve","certificate.issue",
    "approval.view","approval.manage","approval.decide","approval.request",
    "ticket.manage","file.manage","search.use","export.use","task.manage","privacy.manage",
    "backup.create","audit.view","email.view","email.manage","email.send_test",
    "sponsorship.view","sponsorship.manage","sponsorship.approve",
    "safety.view","safety.manage",
    "cms.view","cms.edit","cms.submit_review","cms.approve","cms.publish","cms.template_manage",
    "website.view","website.manage"
  ],
  network_secretary:[
    "dashboard.view","submission.view","people.view","certificate.view","certificate.approve",
    "approval.view","approval.decide","document.view","audit.view",
    "sponsorship.view","sponsorship.approve","cms.view","cms.approve","cms.publish","website.view"
  ],
  content_admin:[
    "dashboard.view","news.manage","form.view","form.manage","settings.manage","module.manage",
    "document.view","document.manage","document.version_manage","file.manage","search.use",
    "cms.view","cms.edit","cms.submit_review","cms.approve","cms.publish","cms.template_manage",
    "website.view","email.view"
  ],
  certificate_manager:[
    "dashboard.view","certificate.view","certificate.request","certificate.issue",
    "approval.view","approval.request","file.manage","search.use"
  ],
  reviewer:[
    "dashboard.view","submission.view","certificate.view","approval.view","approval.decide",
    "audit.view","cms.view","cms.approve","sponsorship.view"
  ],
  case_manager:[
    "dashboard.view","submission.view","submission.manage","people.view","file.manage",
    "search.use","export.use","safety.view","safety.manage"
  ],
  editor:[
    "dashboard.view","news.manage","document.view","document.manage","file.manage",
    "cms.view","cms.edit","cms.submit_review"
  ],
  office:[
    "dashboard.view","submission.view","submission.manage","people.view","people.manage",
    "document.view","document.manage","document.version_manage","certificate.view","certificate.issue",
    "approval.view","ticket.manage","file.manage","task.manage","export.use",
    "sponsorship.view","sponsorship.manage","safety.view","safety.manage","email.view"
  ],
  hr:[
    "dashboard.view","submission.view","submission.manage","people.view","people.manage",
    "interview.manage","evaluation.manage","certificate.view","certificate.request",
    "approval.view","approval.request","file.manage","task.manage","export.use"
  ],
  communications:[
    "dashboard.view","news.manage","file.manage","task.manage",
    "cms.view","cms.edit","cms.submit_review","sponsorship.view"
  ],
  external_events:[
    "dashboard.view","submission.view","event.manage","ticket.manage","unit.view","task.manage",
    "file.manage","sponsorship.view","sponsorship.manage"
  ],
  unit_admin:[
    "dashboard.view","submission.view","people.view","class.manage","event.manage","unit.view",
    "file.manage","task.manage","cms.view","cms.edit","cms.submit_review"
  ],
  handler:[
    "dashboard.view","submission.view","submission.manage_assigned","ticket.manage_assigned",
    "task.manage","safety.view"
  ],
  member:["portal.member","file.own","request.internal","notification.own","certificate.own"],
  volunteer:["portal.member","file.own","request.internal","notification.own","certificate.own"],
  student:["portal.student","file.own","notification.own","certificate.own"]
};

export function roleLevel(role){
  const levels={
    owner:1000,super_admin:100,system_admin:90,network_secretary:80,content_admin:75,
    office:70,hr:70,certificate_manager:70,reviewer:65,case_manager:65,
    communications:60,external_events:60,editor:55,unit_admin:50,handler:40,member:20,volunteer:20,student:10
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

export function hasAnyPermission(user, permissions=[]){
  if(!user) return false;
  return permissions.some(p=>hasPermission(user,p));
}

export function highestRoleLevel(user){
  return Math.max(0,...(user?.roles||[]).map(r=>roleLevel(r.role_id)));
}

export function allowedScopesForUser(user){
  if(!user) return new Set();
  const roles = user.roles || [];
  if(roles.some(r=>["owner","super_admin","system_admin","network_secretary","content_admin","office"].includes(r.role_id) || !r.scope_unit_code)){
    return null; // null means global scope across units/websites
  }
  return new Set(roles.map(r=>String(r.scope_unit_code||"").trim().toUpperCase()).filter(Boolean));
}

export function canAccessScope(user, targetScope=""){
  if(!user) return false;
  const scopes = allowedScopesForUser(user);
  if(scopes === null) return true;
  if(!targetScope) return true;
  const norm = String(targetScope).trim().toUpperCase().replace(/^SF-/, "");
  for (const s of scopes) {
    const cleanS = s.replace(/^SF-/, "");
    if (cleanS === norm || cleanS === "ALL" || cleanS === "*") return true;
  }
  return false;
}
