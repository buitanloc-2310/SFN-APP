
const app=document.getElementById("app");
const modalRoot=document.getElementById("modalRoot");
const accountBtn=document.getElementById("accountBtn");
const themeBtn=document.getElementById("themeBtn");

const state={
  config:null,user:null,portal:null,forms:{},admin:{},
  currentForm:null,turnstileToken:"",formBuilder:null
};

const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const J=x=>{try{return typeof x==="string"?JSON.parse(x):x}catch{return {}}};
const fmt=d=>d?new Date(d).toLocaleString("vi-VN"):"—";
const rolesOf=u=>(u?.roles||[]).map(r=>r.role_id);
const isAdmin=u=>(u?.roles||[]).some(r=>Number(r.level)>=40||["super_admin","system_admin","network_secretary","office","hr","communications","external_events","unit_admin","handler"].includes(r.role_id));
const isMember=u=>(u?.roles||[]).some(r=>["member","volunteer","handler","unit_admin","communications","external_events","hr","office","network_secretary","system_admin","super_admin"].includes(r.role_id));

async function api(path,options={}){
  const o={credentials:"same-origin",...options,headers:{...(options.headers||{})}};
  if(o.body&&!(o.body instanceof FormData)&&typeof o.body!=="string"){
    o.headers["content-type"]="application/json";o.body=JSON.stringify(o.body);
  }
  const r=await fetch(path,o);
  const ct=r.headers.get("content-type")||"";
  const data=ct.includes("application/json")?await r.json():await r.text();
  if(!r.ok){const err=new Error(data?.error||data?.message||`HTTP ${r.status}`);err.data=data;err.status=r.status;throw err}
  return data;
}

function toast(msg,type="good"){
  const el=document.createElement("div");
  el.className=`notice ${type}`;
  el.style.cssText="position:fixed;right:18px;bottom:18px;z-index:200;max-width:420px;box-shadow:0 15px 50px #0003";
  el.innerHTML=E(msg);document.body.appendChild(el);setTimeout(()=>el.remove(),4200);
}
function modal(html){
  modalRoot.innerHTML=`<div class="modal-bg" id="modalBg"><div class="modal">${html}</div></div>`;
  document.getElementById("modalBg").addEventListener("click",e=>{if(e.target.id==="modalBg")closeModal()});
}
function closeModal(){modalRoot.innerHTML=""}
window.closeModal=closeModal;

async function loadConfig(){
  state.config=await api("/api/config");
}
async function loadMe(){
  try{state.user=(await api("/api/auth/me")).user}catch{state.user=null}
  accountBtn.textContent=state.user?(state.user.full_name||state.user.email):"Đăng nhập";
}
function moduleEnabled(key){
  const m=(state.config?.modules||[]).find(x=>x.key===key);
  return !m||!!m.enabled;
}
function setTheme(t){
  document.body.classList.toggle("dark",t==="dark");localStorage.setItem("sfn_theme",t);
}
themeBtn.onclick=()=>setTheme(document.body.classList.contains("dark")?"light":"dark");
setTheme(localStorage.getItem("sfn_theme")||"light");
accountBtn.onclick=()=>{if(state.user) location.hash=isAdmin(state.user)?"admin/dashboard":"portal"; else location.hash="login"};

function hero(){
  return `<section class="hero">
    <div class="hero-copy"><span class="pill white">SKY FIRST NETWORK • SFN</span>
      <h1>${E(state.config?.hero_title||"Kết nối giáo dục. Phát triển cộng đồng.")}</h1>
      <p>${E(state.config?.hero_text||"Một cổng chung cho Thành viên, Core Team, Tình nguyện viên, Học sinh/Học viên, lớp học, hoạt động, hồ sơ, GCN/GXN và quản trị Sky First Network.")}</p>
      <p><b>${E(state.config?.slogan||"Kết nối tri thức – Lan tỏa giá trị – Kiến tạo tương lai.")}</b></p>
      <div class="actions"><a class="primary" href="#forms">Đăng ký tham gia</a><a class="secondary" style="background:transparent;border-color:#ffffff77;color:#fff" href="#login">Đăng nhập hệ thống</a></div>
    </div>
    <img src="${E(state.config?.hero_cover_url||"/assets/sfn-cover.png")}" alt="Sky First Network">
  </section>`;
}
async function renderHome(){
  app.innerHTML=hero()+`<h2 class="section-title">Truy cập nhanh</h2>
  <div class="grid4">
   ${quickCard("👥","Thành viên & Core Team","Đăng ký và theo dõi hồ sơ nhân sự.","#forms")}
   ${quickCard("🤝","Tình nguyện viên","TNV chung và TNV dạy học theo phạm vi chuyên môn.","#form/volunteer")}
   ${quickCard("📚","Lớp học SFEC","Lớp 9–12, Cơ bản, Giao tiếp, IELTS.","#classes")}
   ${quickCard("🏅","GCN & GXN","Tra cứu giấy chứng nhận/giấy xác nhận.","#lookup")}
  </div><h2 class="section-title">Tin mới</h2><div class="grid" id="homeNews"></div>`;
  try{
    const d=await api("/api/public/news");
    document.getElementById("homeNews").innerHTML=(d.items||[]).slice(0,3).map(newsCard).join("")||`<div class="card muted">Chưa có tin.</div>`;
  }catch{}
}
function quickCard(icon,title,desc,href){return `<div class="card"><div style="font-size:31px">${icon}</div><h3>${E(title)}</h3><p class="muted">${E(desc)}</p><a class="primary" href="${href}">Mở</a></div>`}
function newsCard(n){return `<article class="card"><span class="pill">${E((n.published_at||"").slice(0,10))}</span><h3>${E(n.title)}</h3><p class="muted">${E(n.body)}</p></article>`}

async function renderForms(){
  const forms=state.config?.forms||[];
  app.innerHTML=`<h1>Đăng ký & Biểu mẫu</h1><p class="muted">Mỗi biểu mẫu có bộ câu hỏi, điều khoản, mã hồ sơ và quy trình xử lý riêng.</p>
  <div class="grid">${forms.map(f=>`<div class="card"><span class="pill">${E(f.prefix)}</span><h3>${E(f.name)}</h3><p class="muted">${E(f.description)}</p><p class="small">${f.min_age?`Yêu cầu: từ đủ ${f.min_age} tuổi`:""}</p><a class="primary" href="#form/${encodeURIComponent(f.id)}">Mở biểu mẫu</a></div>`).join("")}</div>`;
}
function conditionOk(cond,answers){
  if(!cond)return true;if("equals" in cond)return answers[cond.key]===cond.equals;if("not_equals" in cond)return answers[cond.key]!==cond.not_equals;return true;
}
function fieldHtml(f){
  const req=f.required?" *":"",attrs=`data-key="${E(f.key)}" ${f.required?"required":""}`;
  if(f.type==="textarea")return `<div class="field"><label>${E(f.label)}${req}</label><textarea ${attrs}></textarea></div>`;
  if(f.type==="select")return `<div class="field"><label>${E(f.label)}${req}</label><select ${attrs}><option value="">-- Chọn --</option>${(f.options||[]).map(x=>`<option>${E(x)}</option>`).join("")}</select></div>`;
  if(f.type==="checkbox")return `<div class="check"><input type="checkbox" ${attrs}><label>${E(f.label)}${req}</label></div>`;
  if(f.type==="file")return `<div class="field"><label>${E(f.label)}${req}</label><input type="file" ${attrs} ${f.accept?`accept="${E(f.accept.join(","))}"`:""}><div class="small muted">Tệp được lưu bảo mật trong hệ thống.</div></div>`;
  return `<div class="field"><label>${E(f.label)}${req}</label><input type="${E(f.type||"text")}" ${attrs}></div>`;
}
function collectFormValues(formEl,config,validate=true){
  const answers={},files={};let firstBad=null;
  for(const section of config.sections||[]){
    if(!conditionOk(section.condition,answers)) continue;
    for(const f of section.fields||[]){
      if(!conditionOk(f.condition,answers))continue;
      const el=formEl.querySelector(`[data-key="${CSS.escape(f.key)}"]`);if(!el)continue;
      let val=el.type==="checkbox"?el.checked:el.type==="file"?"":el.value.trim();
      if(el.type==="file"&&el.files?.[0])files[f.key]=el.files[0];
      answers[f.key]=val;
      if(validate&&f.required&&((el.type==="checkbox"&&!val)||(el.type!=="checkbox"&&el.type!=="file"&&!val)||(el.type==="file"&&!files[f.key]))&&!firstBad)firstBad={el,label:f.label};
    }
  }
  return {answers,files,firstBad};
}
function applyConditions(config){
  const form=document.getElementById("dynamicForm");if(!form)return;
  const {answers}=collectFormValues(form,config,false);
  [...form.querySelectorAll("[data-section]")].forEach((sec,i)=>{
    const s=config.sections[i];sec.classList.toggle("hidden",!conditionOk(s.condition,answers));
  });
  for(const f of config.sections.flatMap(s=>s.fields||[])){
    const wrap=form.querySelector(`[data-field-wrap="${CSS.escape(f.key)}"]`);if(wrap)wrap.classList.toggle("hidden",!conditionOk(f.condition,answers));
  }
}
async function renderForm(idForm){
  app.innerHTML=`<div class="loading">Đang tải biểu mẫu…</div>`;
  try{
    const d=await api(`/api/forms/${encodeURIComponent(idForm)}`);state.currentForm=d;
    const c=d.form.config;
    app.innerHTML=`<div class="form-wrap"><a class="ghost" href="#forms">← Quay lại</a><div class="card">
      <span class="pill">${E(d.form.prefix)}</span><h1>${E(d.form.name)}</h1><p class="muted">${E(d.form.description)}</p>
      ${(d.terms||[]).map(t=>`<details class="term"><summary>${E(t.code)} — ${E(t.name)} (${E(t.version)})</summary><pre>${E(t.body)}</pre></details>`).join("")}
      <form id="dynamicForm">${(c.sections||[]).map((s,i)=>`<section data-section="${i}"><h2>${E(s.title)}</h2>${(s.fields||[]).map(f=>`<div data-field-wrap="${E(f.key)}">${fieldHtml(f)}</div>`).join("")}</section>`).join("")}
      <div id="turnstileSlot"></div><div class="actions"><button class="primary" type="submit">Gửi hồ sơ</button><a class="secondary" href="#forms">Hủy</a></div></form>
    </div></div>`;
    const form=document.getElementById("dynamicForm");
    form.addEventListener("change",()=>applyConditions(c));applyConditions(c);
    if(state.config.turnstile_site_key) await mountTurnstile();
    form.addEventListener("submit",async e=>{
      e.preventDefault();const {answers,files,firstBad}=collectFormValues(form,c,true);
      if(firstBad){toast("Vui lòng hoàn thành: "+firstBad.label,"bad");firstBad.el.focus();return}
      const fd=new FormData();fd.append("payload",JSON.stringify({answers,turnstile_token:state.turnstileToken}));
      for(const [k,f] of Object.entries(files))fd.append(`file:${k}`,f);
      const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Đang gửi…";
      try{
        const r=await api(`/api/forms/${encodeURIComponent(idForm)}/submit`,{method:"POST",body:fd});
        form.innerHTML=`<div class="notice good"><h2>Hồ sơ đã được tiếp nhận</h2><p><b>Mã hồ sơ: ${E(r.code)}</b></p><p>Hãy lưu mã này để tra cứu. Hệ thống cũng gửi email xác nhận nếu email gửi đi đã được cấu hình.</p><div class="actions"><a class="primary" href="#lookup">Tra cứu hồ sơ</a><a class="secondary" href="#home">Trang chủ</a></div></div>`;
      }catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Gửi hồ sơ"}
    });
  }catch(err){app.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`}
}
async function mountTurnstile(){
  if(!window.turnstile){
    await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  }
  window.turnstile.render("#turnstileSlot",{sitekey:state.config.turnstile_site_key,callback:t=>state.turnstileToken=t});
}

async function renderClasses(){
  const d=await api("/api/public/classes");app.innerHTML=`<h1>Lớp học & Chương trình giáo dục</h1><div class="grid">${(d.items||[]).map(c=>`<div class="card"><span class="pill">${E(c.unit_code)}</span><h3>${E(c.title)}</h3><p>${E(c.level||"")}</p><span class="status">${E(c.status)}</span><div class="actions"><a class="primary" href="#form/class">Đăng ký</a></div></div>`).join("")||"<div class='card'>Chưa có lớp học.</div>"}</div>`;
}
async function renderEvents(){
  const d=await api("/api/public/events");app.innerHTML=`<h1>Hoạt động & Sự kiện</h1><div class="grid">${(d.items||[]).map(x=>`<div class="card"><span class="pill">${E(x.unit_code)}</span><h3>${E(x.title)}</h3><p class="muted">${fmt(x.start_at)}</p><span class="status">${E(x.status)}</span><div class="actions"><a class="primary" href="#form/event">Đăng ký</a></div></div>`).join("")||"<div class='card'>Chưa có sự kiện.</div>"}</div>`;
}
async function renderUnits(){
  const d=await api("/api/public/units");app.innerHTML=`<h1>Đơn vị trực thuộc</h1><div class="grid">${(d.items||[]).map(u=>`<div class="card"><span class="pill">${E(u.code)}</span><h3>${E(u.name)}</h3><p>${E(u.unit_type||"")}</p><p class="muted">Phụ trách: ${E(u.manager_name||"—")}<br>${E(u.email||"")}</p><span class="status">${E(u.status)}</span></div>`).join("")}</div>`;
}
async function renderNews(){
  const d=await api("/api/public/news");app.innerHTML=`<h1>Tin tức & Cập nhật</h1><div class="grid">${(d.items||[]).map(newsCard).join("")||"<div class='card'>Chưa có tin.</div>"}</div>`;
}
function renderLookup(){
  app.innerHTML=`<div class="form-wrap"><h1>Tra cứu</h1><div class="grid2">
  <div class="card"><h2>Tra cứu hồ sơ</h2><form id="lookupRecord"><div class="field"><label>Mã hồ sơ</label><input name="code" required placeholder="SFN-TNV-2026-0001"></div><div class="field"><label>Email đã đăng ký</label><input name="email" type="email" required></div><button class="primary">Tra cứu</button></form><div id="recordResult"></div></div>
  <div class="card"><h2>Xác thực GCN/GXN</h2><form id="lookupCert"><div class="field"><label>Mã GCN/GXN</label><input name="code" required placeholder="001/GCN-SFN/2026"></div><button class="primary">Xác thực</button></form><div id="certResult"></div></div></div></div>`;
  document.getElementById("lookupRecord").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api(`/api/lookup/submission?code=${encodeURIComponent(f.get("code"))}&email=${encodeURIComponent(f.get("email"))}`);document.getElementById("recordResult").innerHTML=`<div class="notice good"><b>${E(d.item.code)}</b><br>Loại: ${E(d.item.form_id)}<br>Trạng thái: <b>${E(d.item.status)}</b><br>Cập nhật: ${fmt(d.item.updated_at)}</div>`}catch{document.getElementById("recordResult").innerHTML="<div class='notice bad'>Không tìm thấy hồ sơ phù hợp.</div>"}};
  document.getElementById("lookupCert").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api(`/api/lookup/certificate?code=${encodeURIComponent(f.get("code"))}`);const c=d.item;document.getElementById("certResult").innerHTML=`<div class="notice good"><b>${E(c.code)}</b><br>${E(c.cert_type)}<br>Người được cấp: <b>${E(c.full_name)}</b><br>${E(c.content)}<br>Trạng thái: ${E(c.status)}</div>`}catch{document.getElementById("certResult").innerHTML="<div class='notice bad'>Không tìm thấy mã GCN/GXN.</div>"}};
  const auto=new URLSearchParams(location.search).get("cert_lookup");if(auto){document.querySelector('#lookupCert [name="code"]').value=auto;document.getElementById("lookupCert").requestSubmit();}
}

function renderLogin(){
  app.innerHTML=`<h1>Đăng nhập Sky First</h1><p class="muted">Chọn khu vực phù hợp. Quyền Thành viên và Quản trị viên chỉ do SFN cấp.</p>
  <div class="role-grid">
   <button class="role-card" onclick="showLogin('student')"><h3>🎓 Bạn là Học sinh/Học viên?</h3><p class="muted">Lớp học, hồ sơ, thông báo, GCN/GXN.</p></button>
   <button class="role-card" onclick="showLogin('member')"><h3>👥 Bạn là Thành viên?</h3><p class="muted">Hồ sơ nhân sự, hoạt động, nhiệm vụ và thủ tục nội bộ.</p></button>
   <button class="role-card" onclick="showLogin('admin')"><h3>⚙️ Bạn là Quản trị viên?</h3><p class="muted">Chỉ tài khoản đã được cấp quyền quản trị.</p></button>
  </div><div id="loginPanel" style="max-width:650px;margin:18px auto"></div>`;
}
window.showLogin=function(portal){
  state.portal=portal;
  const title=portal==="student"?"Học sinh/Học viên":portal==="member"?"Thành viên":"Quản trị viên";
  const reg=portal==="student"?`<button class="ghost" onclick="showRegister()">Chưa có tài khoản? Tạo tài khoản Học sinh/Học viên</button>`:"";
  document.getElementById("loginPanel").innerHTML=`<div class="card"><h2>Đăng nhập ${title}</h2>
   <form id="loginForm"><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mật khẩu</label><input name="password" type="password" required></div>
   <button class="primary">Đăng nhập</button></form>
   ${state.config.google_oauth?`<div class="actions"><button class="secondary" onclick="googleLogin('${portal}')">Tiếp tục với Google</button></div>`:""}
   <div class="actions">${reg}<button class="ghost" onclick="showForgot()">Quên mật khẩu?</button></div></div>`;
  document.getElementById("loginForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target);
    try{
      const d=await api("/api/auth/login",{method:"POST",body:{email:f.get("email"),password:f.get("password"),portal}});
      if(d.needs_2fa)return show2FA(d.challenge);
      state.user=d.user;accountBtn.textContent=state.user.full_name||state.user.email;
      if(d.must_change_password)return forcePasswordChange(f.get("password"));
      location.hash=portal==="admin"?"admin/dashboard":"portal";
    }catch(err){toast(errorText(err),"bad")}
  };
}
window.googleLogin=portal=>location.href=`/api/auth/google/start?portal=${encodeURIComponent(portal)}`;
window.showRegister=function(){
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Tạo tài khoản Học sinh/Học viên</h2>
  <p class="muted">Tài khoản tự tạo chỉ có quyền người học. Quyền Thành viên SFN phải được SFN cấp sau khi duyệt.</p>
  <form id="registerForm"><div class="field"><label>Họ và tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mật khẩu (ít nhất 10 ký tự)</label><input name="password" type="password" minlength="10" required></div><button class="primary">Tạo tài khoản</button></form>`);
  document.getElementById("registerForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/auth/register",{method:"POST",body:Object.fromEntries(f)});closeModal();toast("Đã tạo tài khoản. Kiểm tra email để xác minh.")}catch(err){toast(errorText(err),"bad")}};
}
window.showForgot=function(){
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Quên mật khẩu</h2><form id="forgotForm"><div class="field"><label>Email</label><input name="email" type="email" required></div><button class="primary">Gửi liên kết đặt lại</button></form>`);
  document.getElementById("forgotForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api("/api/auth/forgot",{method:"POST",body:{email:f.get("email")}}).catch(()=>{});closeModal();toast("Nếu email tồn tại, hệ thống đã gửi hướng dẫn.")};
}
function show2FA(challenge){
  modal(`<h2>Xác minh 2 bước</h2><form id="twofaForm"><div class="field"><label>Mã 6 số từ ứng dụng xác thực</label><input name="code" inputmode="numeric" maxlength="6" required></div><button class="primary">Xác minh</button></form>`);
  document.getElementById("twofaForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/auth/login-2fa",{method:"POST",body:{challenge,code:f.get("code")}});closeModal();state.user=d.user;if(d.must_change_password)return forcePasswordChange("");location.hash=isAdmin(state.user)?"admin/dashboard":"portal"}catch(err){toast(errorText(err),"bad")}};
}
function forcePasswordChange(currentPassword=""){
  modal(`<h2>Đổi mật khẩu lần đầu</h2><div class="notice warn">Tài khoản này phải đổi mật khẩu trước khi tiếp tục.</div>
  <form id="changeFirst"><div class="field"><label>Mật khẩu hiện tại</label><input name="current_password" type="password" value="${E(currentPassword)}" required></div><div class="field"><label>Mật khẩu mới (ít nhất 10 ký tự)</label><input name="new_password" type="password" minlength="10" required></div><button class="primary">Đổi mật khẩu</button></form>`);
  document.getElementById("changeFirst").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/auth/change-password",{method:"POST",body:Object.fromEntries(f)});closeModal();toast("Đã đổi mật khẩu.");location.hash=isAdmin(state.user)?"admin/dashboard":"portal"}catch(err){toast(errorText(err),"bad")}};
}
async function logout(){await api("/api/auth/logout",{method:"POST"}).catch(()=>{});state.user=null;accountBtn.textContent="Đăng nhập";location.hash="home"}
window.logout=logout;

async function renderPortal(){
  if(!state.user){location.hash="login";return}
  const d=await api("/api/me/portal");
  const member=isMember(state.user);
  const menu=[
    ["overview","Tổng quan"],["records","Hồ sơ đăng ký"],["classes","Lớp học"],["events","Sự kiện"],["certs","GCN/GXN"],["notifications","Thông báo"],
    ...(member?[["profile","Hồ sơ thành viên"],["requests","Yêu cầu nội bộ"],["privacy","Quyền riêng tư"]]:[]),
    ["security","Bảo mật tài khoản"]
  ];
  const route=(location.hash.split("/")[1]||"overview");
  app.innerHTML=`<div class="dashboard"><aside class="sidebar">${menu.map(m=>`<button class="${route===m[0]?"active":""}" onclick="location.hash='portal/${m[0]}'">${m[1]}</button>`).join("")}<button onclick="logout()">↩ Đăng xuất</button></aside><div id="portalMain"></div></div>`;
  const main=document.getElementById("portalMain");
  if(route==="overview")main.innerHTML=`<h1>Hồ sơ của tôi</h1><div class="kpis"><div class="kpi"><b>${d.records.length}</b>Hồ sơ</div><div class="kpi"><b>${d.classes.length}</b>Lớp học</div><div class="kpi"><b>${d.certificates.length}</b>GCN/GXN</div><div class="kpi"><b>${d.notifications.filter(n=>!n.read_at).length}</b>Thông báo mới</div></div>${d.person?`<div class="card" style="margin-top:14px"><h3>${E(d.person.full_name)}</h3><p>${E(d.person.position||"")} • ${E(d.person.unit_code||"SFN")}</p><span class="status">${E(d.person.status)}</span></div>`:""}`;
  if(route==="records")main.innerHTML=listCards("Hồ sơ đăng ký",d.records,r=>`<b>${E(r.code)}</b> — ${E(r.form_id)} <span class="status">${E(r.status)}</span><br><span class="small muted">${fmt(r.created_at)}</span>`);
  if(route==="classes")main.innerHTML=listCards("Lớp học của tôi",d.classes,r=>`<b>${E(r.title)}</b> — ${E(r.status)}<br><span class="small muted">${E(r.class_status)}</span>`);
  if(route==="events")main.innerHTML=listCards("Sự kiện của tôi",d.events,r=>`<b>${E(r.title)}</b> — ${E(r.status)}<br><span class="small muted">${fmt(r.start_at)}</span>`);
  if(route==="certs")main.innerHTML=listCards("GCN/GXN của tôi",d.certificates,r=>`<b>${E(r.code||"Đang chờ cấp số")}</b> — ${E(r.cert_type)}<br>${E(r.content)}<br><span class="status">${E(r.status)}</span>`);
  if(route==="notifications"){main.innerHTML=listCards("Thông báo",d.notifications,r=>`<b>${E(r.title)}</b><br>${E(r.body||"")}<br><span class="small muted">${fmt(r.created_at)}</span>`)+`<button class="secondary" onclick="markAllRead()">Đánh dấu tất cả đã đọc</button>`}
  if(route==="profile")main.innerHTML=`<h1>Hồ sơ thành viên</h1>${d.person?`<div class="card"><h2>${E(d.person.full_name)}</h2><p>Email: ${E(d.person.email||state.user.email)}</p><p>Đơn vị: ${E(d.person.unit_code||"SFN")}</p><p>Chức danh/Vai trò: ${E(d.person.position||"")}</p><p>Ngày gia nhập: ${E(d.person.joined_at||"")}</p><span class="status">${E(d.person.status)}</span></div>`:`<div class="notice warn">Tài khoản đã đăng nhập nhưng chưa có hồ sơ nhân sự điện tử liên kết.</div>`}`;
  if(route==="requests")main.innerHTML=`<h1>Yêu cầu & Thủ tục nội bộ</h1><div class="grid">${["Cập nhật thông tin nhân sự","Điều chuyển vị trí/đơn vị","Tạm ngừng hoạt động","Thôi nhiệm vụ/rút khỏi SFN","Đề nghị xác nhận quá trình tham gia","Đề nghị GCN/GXN","Bàn giao nhiệm vụ"].map(x=>`<button class="role-card" onclick="internalRequest('${E(x)}')"><b>${E(x)}</b></button>`).join("")}</div><h2 class="section-title">Lịch sử yêu cầu</h2>${listCards("",d.internal_requests,r=>`<b>${E(r.code)}</b> — ${E(r.request_type)} <span class="status">${E(r.status)}</span>`)}`;
  if(route==="privacy")main.innerHTML=`<h1>Trung tâm Quyền riêng tư</h1><div class="card"><p>Bạn có thể yêu cầu cập nhật, đính chính, xuất hoặc xem xét xóa dữ liệu cá nhân.</p><div class="actions">${["Cập nhật dữ liệu","Đính chính dữ liệu","Yêu cầu xuất dữ liệu cá nhân","Yêu cầu xem xét xóa dữ liệu"].map(x=>`<button class="secondary" onclick="privacyRequest('${E(x)}')">${E(x)}</button>`).join("")}</div></div>`;
  if(route==="security")renderSecurity(main);
}
function listCards(title,items,renderer){return `${title?`<h1>${E(title)}</h1>`:""}${items?.length?items.map(x=>`<div class="card" style="margin:9px 0">${renderer(x)}</div>`).join(""):`<div class="notice">Chưa có dữ liệu.</div>`}`}
window.markAllRead=async()=>{await api("/api/me/notifications/read",{method:"POST",body:{}});toast("Đã đánh dấu đã đọc.");renderPortal()}
window.internalRequest=type=>{modal(`<h2>${E(type)}</h2><form id="reqForm"><div class="field"><label>Nội dung</label><textarea name="content" required></textarea></div><button class="primary">Gửi yêu cầu</button></form>`);document.getElementById("reqForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/me/internal-requests",{method:"POST",body:{request_type:type,content:f.get("content")}});closeModal();toast("Đã gửi: "+d.code);location.hash="portal/requests";renderPortal()}catch(err){toast(errorText(err),"bad")}}}
window.privacyRequest=type=>{const note=prompt("Ghi chú thêm (nếu có):")||"";api("/api/me/data-requests",{method:"POST",body:{request_type:type,note}}).then(()=>toast("Đã tiếp nhận yêu cầu.")).catch(e=>toast(errorText(e),"bad"))}
async function renderSecurity(main){
  let sessions=[];try{sessions=(await api("/api/me/sessions")).sessions||[]}catch{}
  main.innerHTML=`<h1>Bảo mật tài khoản</h1><div class="grid2">
  <div class="card"><h2>Đổi mật khẩu</h2><form id="changePw"><div class="field"><label>Mật khẩu hiện tại</label><input name="current_password" type="password" required></div><div class="field"><label>Mật khẩu mới</label><input name="new_password" type="password" minlength="10" required></div><button class="primary">Đổi mật khẩu</button></form></div>
  <div class="card"><h2>Xác minh 2 bước (2FA)</h2><p>Trạng thái: <b>${state.user.totp_enabled?"Đang bật":"Chưa bật"}</b></p>${state.user.totp_enabled?`<button class="danger" onclick="disable2fa()">Tắt 2FA</button>`:`<button class="primary" onclick="setup2fa()">Thiết lập 2FA</button>`}</div></div>
  <h2 class="section-title">Phiên đăng nhập</h2><div class="card">${sessions.map(s=>`<p><b>${E((s.user_agent||"Thiết bị").slice(0,120))}</b><br><span class="small muted">Hoạt động: ${fmt(s.last_seen_at)} • Hết hạn: ${fmt(s.expires_at)}</span></p>`).join("")}<button class="danger" onclick="revokeAllSessions()">Đăng xuất tất cả thiết bị</button></div>`;
  document.getElementById("changePw").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/auth/change-password",{method:"POST",body:Object.fromEntries(f)});toast("Đã đổi mật khẩu.")}catch(err){toast(errorText(err),"bad")}};
}
window.setup2fa=async()=>{try{const d=await api("/api/me/2fa/setup",{method:"POST"});modal(`<h2>Thiết lập 2FA</h2><p>Thêm tài khoản trong ứng dụng xác thực bằng secret:</p><pre class="card">${E(d.secret)}</pre><p class="small muted">URI: ${E(d.otpauth_uri)}</p><form id="enable2fa"><div class="field"><label>Nhập mã 6 số hiện tại</label><input name="code" required maxlength="6"></div><button class="primary">Bật 2FA</button></form>`);document.getElementById("enable2fa").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/me/2fa/enable",{method:"POST",body:{code:f.get("code")}});closeModal();await loadMe();toast("Đã bật 2FA.");renderPortal()}catch(err){toast(errorText(err),"bad")}}}catch(err){toast(errorText(err),"bad")}}
window.disable2fa=()=>{const pw=prompt("Nhập mật khẩu để tắt 2FA:");if(!pw)return;api("/api/me/2fa/disable",{method:"POST",body:{password:pw}}).then(async()=>{await loadMe();toast("Đã tắt 2FA.");renderPortal()}).catch(e=>toast(errorText(e),"bad"))}
window.revokeAllSessions=()=>api("/api/me/sessions/revoke-all",{method:"POST"}).then(()=>{state.user=null;location.hash="login"}).catch(e=>toast(errorText(e),"bad"));

const adminMenu=[
 ["dashboard","📊 Tổng quan"],["approvals","✅ Trung tâm phê duyệt"],["submissions","📥 Hồ sơ đăng ký"],
 ["users","🔐 Tài khoản & Phân quyền"],["people","👥 Hồ sơ nhân sự"],["recruitment","🧭 Tuyển dụng & Đánh giá"],
 ["forms","🧾 Form Builder"],["terms","📜 Điều khoản & Chính sách"],["teaching","🧑‍🏫 Phạm vi TNV Dạy học"],["classes","📚 Lớp học & Điểm danh"],["events","🎯 Sự kiện & Check-in"],
 ["certificates","🏅 GCN & GXN"],["documents","📑 Kho văn bản"],["units","🏢 Đơn vị trực thuộc"],
 ["news","📰 Tin tức & CMS"],["tickets","🛟 Hỗ trợ & Ticket"],["privacy","🛡 Quyền riêng tư"],["files","📎 File & Minh chứng"],
 ["tasks","☑ Nhiệm vụ"],["email","✉ Email"],["modules","🧩 Modules"],["settings","⚙ Cài đặt"],
 ["search","🔎 Tìm kiếm"],["audit","🧭 Audit Log"],["backup","💾 Sao lưu & Phục hồi"]
];
async function renderAdmin(){
  if(!state.user||!isAdmin(state.user)){location.hash="login";return}
  const section=location.hash.split("/")[1]||"dashboard";
  app.innerHTML=`<div class="dashboard"><aside class="sidebar">${adminMenu.map(m=>`<button class="${section===m[0]?"active":""}" onclick="location.hash='admin/${m[0]}'">${m[1]}</button>`).join("")}<button onclick="logout()">↩ Đăng xuất</button></aside><section id="adminMain"><div class="loading">Đang tải…</div></section></div>`;
  const main=document.getElementById("adminMain");
  try{
    if(section==="dashboard")return adminDashboard(main);
    if(section==="approvals")return adminApprovals(main);
    if(section==="submissions")return adminSubmissions(main);
    if(section==="users")return adminUsers(main);
    if(section==="people")return adminPeople(main);
    if(section==="recruitment")return adminRecruitment(main);
    if(section==="forms")return adminForms(main);
    if(section==="terms")return adminTerms(main);
    if(section==="teaching")return adminTeaching(main);
    if(section==="classes")return adminGeneric(main,"classes","Lớp học",["unit_code","title","level","status","capacity"]);
    if(section==="events")return adminGeneric(main,"events","Sự kiện",["unit_code","title","start_at","end_at","status","capacity"]);
    if(section==="documents")return adminGeneric(main,"documents","Kho văn bản",["code","doc_type","title","visibility","status","issued_at"]);
    if(section==="units")return adminGeneric(main,"units","Đơn vị trực thuộc",["code","name","unit_type","manager_name","email","status"]);
    if(section==="news")return adminGeneric(main,"news","Tin tức & CMS",["title","slug","body","status","published_at"]);
    if(section==="tasks")return adminGeneric(main,"tasks","Nhiệm vụ & Bàn giao",["title","description","assigned_to","unit_code","status","priority","due_at"]);
    if(section==="certificates")return adminCertificates(main);
    if(section==="tickets")return adminTickets(main);
    if(section==="privacy")return adminPrivacy(main);
    if(section==="files")return adminFiles(main);
    if(section==="email")return adminEmail(main);
    if(section==="modules")return adminModules(main);
    if(section==="settings")return adminSettings(main);
    if(section==="search")return adminSearch(main);
    if(section==="audit")return adminAudit(main);
    if(section==="backup")return adminBackup(main);
  }catch(err){main.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`}
}
async function adminDashboard(main){
  const d=await api("/api/admin/dashboard");const c=d.counts;
  main.innerHTML=`<h1>Quản trị SFN</h1><div class="kpis"><div class="kpi"><b>${c.submissions}</b>Hồ sơ</div><div class="kpi"><b>${c.pending}</b>Cần xử lý</div><div class="kpi"><b>${c.people}</b>Nhân sự</div><div class="kpi"><b>${c.certificates}</b>GCN/GXN đã cấp</div><div class="kpi"><b>${c.approvals}</b>Chờ phê duyệt</div><div class="kpi"><b>${c.tickets}</b>Ticket mở</div><div class="kpi"><b>${c.tasks}</b>Nhiệm vụ</div></div>
  <div class="card" style="margin-top:14px"><h2>Nguyên tắc phân quyền</h2><p>Super Admin gốc: <b>skyfirst.ec@gmail.com</b>. Thành viên không tự cấp quyền. Quản trị viên chỉ cấp được vai trò trong phạm vi thẩm quyền.</p></div>`;
}
async function adminSubmissions(main){
  const d=await api("/api/admin/submissions");state.admin.submissions=d.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Hồ sơ đăng ký</h1><button class="secondary" onclick="location.href='/api/admin/export/submissions.csv'">Xuất CSV</button></div>
  <div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Loại</th><th>Người gửi</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody>${state.admin.submissions.map(r=>`<tr><td><b>${E(r.code)}</b></td><td>${E(r.form_id)}</td><td>${E(r.full_name)}<br><span class="small">${E(r.email)}</span></td><td><span class="status">${E(r.status)}</span></td><td>${fmt(r.updated_at)}</td><td><button class="secondary" onclick="viewSubmission('${E(r.code)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.viewSubmission=async code=>{
  try{
    const d=await api(`/api/admin/submissions/${encodeURIComponent(code)}`),r=d.item;
    modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>${E(r.code)}</h2><p>${E(r.full_name)} • ${E(r.email)}</p>
    <div class="field"><label>Trạng thái</label><select id="subStatus">${["Đã tiếp nhận","Đang xem xét","Cần bổ sung","Mời phỏng vấn","Đang đánh giá","Đã duyệt","Không phù hợp","Hoàn tất"].map(s=>`<option ${s===r.status?"selected":""}>${E(s)}</option>`).join("")}</select></div>
    <div class="field"><label>Điểm tổng hợp</label><input id="subScore" type="number" step="0.1" value="${E(r.score??"")}"></div>
    <div class="field"><label>Ghi chú nội bộ</label><textarea id="subNote">${E(r.internal_note||"")}</textarea></div>
    <h3>Câu trả lời</h3>${Object.entries(r.answers||{}).map(([k,v])=>`<div class="card" style="margin:6px 0"><b>${E(k)}</b><br>${E(typeof v==="object"?JSON.stringify(v):v)}</div>`).join("")}
    <h3>Tệp</h3>${(d.files||[]).map(f=>`<p><a href="/api/files/${encodeURIComponent(f.id)}" target="_blank">${E(f.filename)}</a> (${Math.round((f.size||0)/1024)} KB)</p>`).join("")||"<p>Không có.</p>"}
    <div class="actions"><button class="primary" onclick="saveSubmission('${E(r.code)}')">Lưu xử lý</button><button class="secondary" onclick="scheduleInterview('${E(r.code)}')">Lịch phỏng vấn</button><button class="secondary" onclick="addEvaluation('${E(r.code)}')">Chấm đánh giá</button><button class="secondary" onclick="requestGenericApproval('submission','${E(r.code)}')">Gửi phê duyệt</button>${["member","core","volunteer"].includes(r.form_id)&&r.status==="Đã duyệt"?`<button class="secondary" onclick="convertPerson('${E(r.code)}')">Tiếp nhận thành nhân sự</button>`:""}</div>`);
  }catch(err){toast(errorText(err),"bad")}
}
window.saveSubmission=async code=>{try{await api(`/api/admin/submissions/${encodeURIComponent(code)}`,{method:"PATCH",body:{status:document.getElementById("subStatus").value,score:Number(document.getElementById("subScore").value)||null,internal_note:document.getElementById("subNote").value}});closeModal();toast("Đã lưu.");adminSubmissions(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}
window.convertPerson=code=>api(`/api/admin/submissions/${encodeURIComponent(code)}/convert-person`,{method:"POST"}).then(d=>toast("Đã tạo hồ sơ nhân sự #"+d.person_id)).catch(e=>toast(errorText(e),"bad"));
window.scheduleInterview=code=>{const at=prompt("Thời gian phỏng vấn (YYYY-MM-DDTHH:MM):");if(!at)return;const url=prompt("Link Meet/Zoom:")||"";api("/api/admin/interviews",{method:"POST",body:{submission_code:code,scheduled_at:at,meeting_url:url}}).then(()=>toast("Đã tạo lịch phỏng vấn.")).catch(e=>toast(errorText(e),"bad"))}
window.addEvaluation=code=>{const score=prompt("Điểm tổng hợp (0-100):");if(score===null)return;const rec=prompt("Khuyến nghị:")||"";const note=prompt("Ghi chú:")||"";api("/api/admin/evaluations",{method:"POST",body:{submission_code:code,score:{total:Number(score)},recommendation:rec,note}}).then(()=>toast("Đã lưu đánh giá.")).catch(e=>toast(errorText(e),"bad"))}

async function adminApprovals(main){
  const d=await api("/api/admin/approvals");
  main.innerHTML=`<h1>Trung tâm phê duyệt</h1><div class="card table-scroll"><table><thead><tr><th>Loại</th><th>Hành động</th><th>Trạng thái</th><th>Hạn</th><th></th></tr></thead><tbody>${(d.items||[]).map(a=>`<tr><td>${E(a.entity_type)}<br><span class="small">${E(a.entity_id)}</span></td><td>${E(a.action)}</td><td><span class="status">${E(a.status)}</span></td><td>${fmt(a.due_at)}</td><td>${a.status==="pending"?`<button class="primary" onclick="decideApproval('${E(a.id)}','approved')">Phê duyệt</button> <button class="danger" onclick="decideApproval('${E(a.id)}','rejected')">Từ chối</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}
window.decideApproval=(id,status)=>{const note=prompt("Ghi chú quyết định (nếu có):")||"";api(`/api/admin/approvals/${encodeURIComponent(id)}`,{method:"PATCH",body:{status,note}}).then(()=>{toast("Đã cập nhật phê duyệt.");adminApprovals(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminUsers(main){
  const d=await api("/api/admin/users");state.admin.users=d.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Tài khoản & Phân quyền</h1><button class="primary" onclick="inviteUser()">+ Cấp tài khoản</button></div>
  <div class="card table-scroll"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Xác minh</th><th>2FA</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.users.map(u=>`<tr><td><b>${E(u.full_name||"")}</b><br>${E(u.email)}</td><td>${(u.roles||[]).map(r=>`<span class="badge-role">${E(r.role_id)}${r.scope_unit_code?` @ ${E(r.scope_unit_code)}`:""}</span>`).join("")}</td><td>${u.email_verified?"✓":"—"}</td><td>${u.totp_enabled?"✓":"—"}</td><td>${E(u.status)}</td><td><button class="secondary" onclick="editRoles(${u.id})">Quyền</button> <button class="ghost" onclick="resetUserPassword(${u.id},'${E(u.email)}')">Đặt lại MK</button> <button class="ghost" onclick="toggleUser(${u.id},'${E(u.status)}')">${u.status==="active"?"Khóa":"Mở khóa"}</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.inviteUser=()=>{
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Cấp tài khoản</h2><form id="inviteForm"><div class="field"><label>Họ và tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Vai trò ban đầu</label><select name="role"><option>student</option><option>member</option><option>volunteer</option><option>handler</option><option>unit_admin</option><option>communications</option><option>external_events</option><option>hr</option><option>office</option><option>network_secretary</option><option>system_admin</option><option>super_admin</option></select></div><div class="field"><label>Phạm vi đơn vị (nếu có)</label><input name="scope_unit_code" placeholder="Ví dụ: SFEC"></div><button class="primary">Cấp tài khoản</button></form>`);
  document.getElementById("inviteForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/admin/users",{method:"POST",body:{full_name:f.get("full_name"),email:f.get("email"),roles:[f.get("role")],scope_unit_code:f.get("scope_unit_code")}});closeModal();modal(`<h2>Đã cấp tài khoản</h2><div class="notice warn">Mật khẩu tạm thời chỉ hiển thị lần này.</div><p><b>${E(f.get("email"))}</b></p><pre class="card">${E(d.temp_password)}</pre><button class="primary" onclick="closeModal()">Đã lưu</button>`)}catch(err){toast(errorText(err),"bad")}};
}
window.editRoles=idUser=>{
  const u=state.admin.users.find(x=>x.id===idUser);if(!u)return;
  const all=["student","member","volunteer","handler","unit_admin","communications","external_events","hr","office","network_secretary","system_admin","super_admin"];
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Phân quyền — ${E(u.full_name||u.email)}</h2><div id="roleChecks">${all.map(r=>`<div class="check"><input type="checkbox" data-role="${r}" ${(u.roles||[]).some(x=>x.role_id===r)?"checked":""}><label>${r}</label></div>`).join("")}</div><div class="field"><label>Phạm vi đơn vị áp dụng cho vai trò mới</label><input id="roleScope" placeholder="SFEC hoặc để trống"></div><button class="primary" onclick="saveRoles(${idUser})">Lưu quyền</button>`);
}
window.saveRoles=async idUser=>{const roles=[...document.querySelectorAll("#roleChecks [data-role]:checked")].map(x=>({role_id:x.dataset.role,scope_unit_code:document.getElementById("roleScope").value.trim()}));try{await api(`/api/admin/users/${idUser}/roles`,{method:"PUT",body:{roles}});closeModal();toast("Đã cập nhật quyền.");adminUsers(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}
window.resetUserPassword=async(idUser,email)=>{if(!confirm(`Tạo mật khẩu tạm thời mới cho ${email}? Tất cả phiên đăng nhập hiện tại sẽ bị thu hồi.`))return;try{const d=await api(`/api/admin/users/${idUser}/reset-password`,{method:"POST"});modal(`<h2>Mật khẩu tạm thời mới</h2><p>${E(email)}</p><pre class="card">${E(d.temp_password)}</pre><div class="notice warn">Mật khẩu này chỉ hiển thị lần này. Người dùng sẽ buộc đổi sau khi đăng nhập.</div><button class="primary" onclick="closeModal()">Đã lưu</button>`)}catch(e){toast(errorText(e),"bad")}}
window.toggleUser=async(idUser,status)=>{try{await api(`/api/admin/users/${idUser}/status`,{method:"PATCH",body:{status:status==="active"?"locked":"active"}});toast("Đã cập nhật.");adminUsers(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}

async function adminPeople(main){
  const d=await api("/api/admin/people");main.innerHTML=`<h1>Hồ sơ nhân sự điện tử</h1><div class="card table-scroll"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Đơn vị</th><th>Chức danh/Vai trò</th><th>Trạng thái</th><th>Gia nhập</th></tr></thead><tbody>${(d.items||[]).map(p=>`<tr><td><b>${E(p.full_name)}</b></td><td>${E(p.email||"")}</td><td>${E(p.unit_code||"")}</td><td>${E(p.position||"")}</td><td><span class="status">${E(p.status)}</span></td><td>${E(p.joined_at||"")}</td></tr>`).join("")}</tbody></table></div>`;
}
async function adminRecruitment(main){
  main.innerHTML=`<h1>Tuyển dụng & Đánh giá</h1><div class="grid"><div class="card"><h3>Quy trình Core Team</h3><p>Tiếp nhận → Sàng lọc → Phỏng vấn → Đánh giá bổ sung → Thông báo → Tiếp nhận.</p><a class="primary" href="#admin/submissions">Mở hồ sơ</a></div><div class="card"><h3>TNV Dạy học</h3><p>Đánh giá đúng phạm vi Lớp 9/10/11/12/Cơ bản/Giao tiếp/IELTS; có thể dạy thử trước khi phân lớp.</p><a class="primary" href="#admin/submissions">Mở hồ sơ TNV</a></div><div class="card"><h3>Chấm điểm & Phỏng vấn</h3><p>Mở một hồ sơ và dùng nút Lịch phỏng vấn / Chấm đánh giá.</p></div></div>`;
}


window.requestGenericApproval=(entity_type,entity_id)=>{const action=prompt("Nội dung cần phê duyệt:","Phê duyệt hồ sơ/đề xuất");if(!action)return;const role=prompt("Vai trò được giao phê duyệt:","network_secretary")||"network_secretary";api("/api/admin/approvals",{method:"POST",body:{entity_type,entity_id,action,assigned_role:role}}).then(()=>toast("Đã chuyển vào Trung tâm phê duyệt.")).catch(e=>toast(errorText(e),"bad"))}

async function adminTerms(main){
  const d=await api("/api/admin/terms");state.admin.terms=d.items||[];
  main.innerHTML=`<h1>Điều khoản & Chính sách</h1><p class="muted">Hệ thống lưu phiên bản điều khoản mà từng người đã xác nhận.</p>${state.admin.terms.map(t=>`<div class="card" style="margin:10px 0"><div class="toolbar"><div><b>${E(t.code)} — ${E(t.name)}</b><br><span class="small muted">Phiên bản ${E(t.version)} • ${E(t.status)}</span></div><button class="secondary" onclick="editTerm('${encodeURIComponent(t.code)}')">Sửa</button></div><pre style="white-space:pre-wrap;max-height:180px;overflow:auto">${E(t.body)}</pre></div>`).join("")}`;
}
window.editTerm=encoded=>{const code=decodeURIComponent(encoded),t=state.admin.terms.find(x=>x.code===code);if(!t)return;modal(`<h2>${E(code)}</h2><div class="field"><label>Tên</label><input id="termName" value="${E(t.name)}"></div><div class="field"><label>Phiên bản</label><input id="termVersion" value="${E(t.version)}"></div><div class="field"><label>Phạm vi</label><input id="termScope" value="${E(t.scope||"")}"></div><div class="field"><label>Nội dung</label><textarea id="termBody" style="min-height:360px">${E(t.body)}</textarea></div><button class="primary" onclick="saveTerm('${encodeURIComponent(code)}')">Lưu phiên bản</button>`)}
window.saveTerm=encoded=>{const code=decodeURIComponent(encoded);api(`/api/admin/terms/${encodeURIComponent(code)}`,{method:"PUT",body:{name:document.getElementById("termName").value,version:document.getElementById("termVersion").value,scope:document.getElementById("termScope").value,body:document.getElementById("termBody").value,status:"published"}}).then(()=>{closeModal();toast("Đã cập nhật điều khoản.");adminTerms(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminTeaching(main){
  const [ppl,ts]=await Promise.all([api("/api/admin/people"),api("/api/admin/teaching-scopes")]);state.admin.people=ppl.items||[];state.admin.teaching=ts.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Phạm vi TNV Dạy học</h1><button class="primary" onclick="addTeachingScope()">+ Thêm phạm vi</button></div><div class="notice">Các phạm vi chuẩn: Lớp 9, Lớp 10, Lớp 11, Lớp 12, Tiếng Anh Cơ bản, Tiếng Anh Giao tiếp, IELTS. Được nhận làm TNV không đồng nghĩa được phép dạy tất cả phạm vi.</div><div class="card table-scroll"><table><thead><tr><th>Nhân sự</th><th>Phạm vi</th><th>Trạng thái</th><th>Ghi chú đánh giá</th><th></th></tr></thead><tbody>${state.admin.teaching.map(x=>`<tr><td>${E(x.full_name)}<br><span class="small">${E(x.email||"")}</span></td><td><b>${E(x.scope)}</b></td><td><span class="status">${E(x.status)}</span></td><td>${E(x.assessment_note||"")}</td><td><button class="secondary" onclick="editTeachingScope('${E(x.id)}')">Đánh giá</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.addTeachingScope=()=>{const person=prompt("ID hồ sơ nhân sự:");if(!person)return;const scope=prompt("Phạm vi (Lớp 9/10/11/12/Cơ bản/Giao tiếp/IELTS):");if(!scope)return;api("/api/admin/teaching-scopes",{method:"POST",body:{person_id:Number(person),scope,status:"Đang đánh giá"}}).then(()=>{toast("Đã thêm phạm vi.");adminTeaching(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}
window.editTeachingScope=idt=>{const x=state.admin.teaching.find(i=>i.id===idt);if(!x)return;modal(`<h2>${E(x.full_name)} — ${E(x.scope)}</h2><div class="field"><label>Trạng thái</label><select id="teachStatus">${["Đang đánh giá","Được mời dạy thử","Đã duyệt","Chưa được duyệt","Tạm dừng"].map(v=>`<option ${v===x.status?"selected":""}>${E(v)}</option>`).join("")}</select></div><div class="field"><label>Ghi chú đánh giá</label><textarea id="teachNote">${E(x.assessment_note||"")}</textarea></div><button class="primary" onclick="saveTeachingScope('${E(idt)}')">Lưu</button>`)}
window.saveTeachingScope=idt=>api(`/api/admin/teaching-scopes/${encodeURIComponent(idt)}`,{method:"PATCH",body:{status:document.getElementById("teachStatus").value,assessment_note:document.getElementById("teachNote").value}}).then(()=>{closeModal();toast("Đã cập nhật phạm vi.");adminTeaching(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))

async function adminPrivacy(main){
  const d=await api("/api/admin/data-requests");state.admin.dataRequests=d.items||[];
  main.innerHTML=`<h1>Trung tâm Quyền riêng tư</h1><div class="card table-scroll"><table><thead><tr><th>Email</th><th>Yêu cầu</th><th>Trạng thái</th><th>Ngày gửi</th><th></th></tr></thead><tbody>${state.admin.dataRequests.map(x=>`<tr><td>${E(x.email)}</td><td>${E(x.request_type)}<br><span class="small">${E(x.note||"")}</span></td><td><span class="status">${E(x.status)}</span></td><td>${fmt(x.created_at)}</td><td><button class="secondary" onclick="processPrivacy('${E(x.id)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.processPrivacy=idr=>{const status=prompt("Trạng thái:","Đang xử lý");if(!status)return;const note=prompt("Ghi chú xử lý:")||"";api(`/api/admin/data-requests/${encodeURIComponent(idr)}`,{method:"PATCH",body:{status,note}}).then(()=>{toast("Đã cập nhật.");adminPrivacy(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminForms(main){
  const d=await api("/api/admin/forms");state.admin.forms=d.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Form Builder</h1><button class="primary" onclick="createForm()">+ Tạo biểu mẫu</button></div><div class="grid">${state.admin.forms.map(f=>`<div class="card"><span class="pill">${E(f.prefix)}</span><h3>${E(f.name)}</h3><p class="muted">${E(f.description)}</p><p>Phiên bản: ${f.version} • ${f.enabled?"Đang bật":"Đang tắt"}</p><button class="secondary" onclick="editForm('${E(f.id)}')">Chỉnh biểu mẫu</button></div>`).join("")}</div>`;
}
window.editForm=idForm=>{
  const f=state.admin.forms.find(x=>x.id===idForm);if(!f)return;state.formBuilder=JSON.parse(JSON.stringify(f));
  renderFormBuilder();
}
function renderFormBuilder(){
  const f=state.formBuilder,c=f.config;
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Chỉnh biểu mẫu — ${E(f.name)}</h2>
   <div class="row2"><div class="field"><label>Tên biểu mẫu</label><input id="fbName" value="${E(f.name)}"></div><div class="field"><label>Mã tiền tố</label><input id="fbPrefix" value="${E(f.prefix)}"></div></div>
   <div class="field"><label>Mô tả</label><textarea id="fbDesc">${E(f.description||"")}</textarea></div>
   <div id="builderSections">${(c.sections||[]).map((s,si)=>`<div class="builder-section"><div class="toolbar"><b>${E(s.title)}</b><button class="secondary" onclick="addBuilderField(${si})">+ Câu hỏi</button><button class="danger" onclick="deleteBuilderSection(${si})">Xóa phần</button></div>${(s.fields||[]).map((x,fi)=>`<div class="builder-field"><span><b>${E(x.label)}</b><br><span class="small muted">${E(x.key)}</span></span><span>${E(x.type)}</span><span>${x.required?"Bắt buộc":""}</span><span><button class="ghost" onclick="moveField(${si},${fi},-1)">↑</button><button class="ghost" onclick="moveField(${si},${fi},1)">↓</button><button class="danger" onclick="deleteBuilderField(${si},${fi})">×</button></span></div>`).join("")}</div>`).join("")}</div>
   <div class="actions"><button class="secondary" onclick="addBuilderSection()">+ Thêm phần</button><button class="primary" onclick="saveFormBuilder()">Lưu phiên bản mới</button></div>`);
}
window.addBuilderSection=()=>{const title=prompt("Tên phần:");if(!title)return;state.formBuilder.config.sections.push({title,fields:[]});renderFormBuilder()}
window.deleteBuilderSection=i=>{if(confirm("Xóa phần này?")){state.formBuilder.config.sections.splice(i,1);renderFormBuilder()}}
window.addBuilderField=si=>{const label=prompt("Nhãn câu hỏi:");if(!label)return;const key=(prompt("Mã kỹ thuật (không dấu, không khoảng trắng):")||label.toLowerCase().replace(/\s+/g,"_").replace(/[^\w]/g,"")).slice(0,50);const type=prompt("Loại: text / email / date / textarea / select / checkbox / file","text")||"text";const req=confirm("Bắt buộc trả lời?");let options=[];if(type==="select")options=(prompt("Các lựa chọn, cách nhau bằng |","")||"").split("|").map(x=>x.trim()).filter(Boolean);state.formBuilder.config.sections[si].fields.push({key,label,type,required:req,options});renderFormBuilder()}
window.deleteBuilderField=(si,fi)=>{state.formBuilder.config.sections[si].fields.splice(fi,1);renderFormBuilder()}
window.moveField=(si,fi,dir)=>{const a=state.formBuilder.config.sections[si].fields,j=fi+dir;if(j<0||j>=a.length)return;[a[fi],a[j]]=[a[j],a[fi]];renderFormBuilder()}
window.saveFormBuilder=async()=>{state.formBuilder.name=document.getElementById("fbName").value;state.formBuilder.prefix=document.getElementById("fbPrefix").value;state.formBuilder.description=document.getElementById("fbDesc").value;try{await api(`/api/admin/forms/${encodeURIComponent(state.formBuilder.id)}`,{method:"PUT",body:{name:state.formBuilder.name,prefix:state.formBuilder.prefix,description:state.formBuilder.description,audience:state.formBuilder.audience,min_age:state.formBuilder.min_age,enabled:!!state.formBuilder.enabled,recipient_email:state.formBuilder.recipient_email,config:state.formBuilder.config}});closeModal();toast("Đã lưu phiên bản biểu mẫu.");adminForms(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}
window.createForm=()=>{const name=prompt("Tên biểu mẫu:");if(!name)return;const idForm=prompt("ID biểu mẫu (vd: scholarship):");if(!idForm)return;const prefix=prompt("Tiền tố mã hồ sơ (vd: SFN-HB):","SFN-FORM");if(!prefix)return;const cfg={id:idForm,name,prefix,description:"",audience:"public",term_codes:["PRIVACY/SFN"],sections:[{title:"Thông tin",fields:[{key:"full_name",label:"Họ và tên",type:"text",required:true},{key:"email",label:"Email",type:"email",required:true}]}]};api("/api/admin/forms",{method:"POST",body:{id:idForm,name,prefix,description:"",audience:"public",config:cfg}}).then(()=>{toast("Đã tạo biểu mẫu.");adminForms(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminGeneric(main,type,title,fields){
  const d=await api(`/api/admin/content/${type}`);state.admin[type]=d.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">${E(title)}</h1><button class="primary" onclick="createGeneric('${type}')">+ Thêm</button></div><div class="card table-scroll"><table><thead><tr>${fields.map(f=>`<th>${E(f)}</th>`).join("")}<th></th></tr></thead><tbody>${state.admin[type].map(x=>`<tr>${fields.map(f=>`<td>${E(String(x[f]??"").slice(0,220))}</td>`).join("")}<td><button class="secondary" onclick="editGeneric('${type}','${E(x.id||x.code)}')">Sửa</button> <button class="danger" onclick="deleteGeneric('${type}','${E(x.id||x.code)}')">Xóa</button></td></tr>`).join("")}</tbody></table></div>${type==="classes"?`<div class="card" style="margin-top:14px"><h2>Điểm danh</h2><p>Mở danh sách học viên theo lớp và ghi nhận Có mặt/Vắng/Có phép qua chức năng quản trị lớp.</p><button class="secondary" onclick="attendanceTool()">Mở công cụ điểm danh</button></div>`:""}${type==="events"?`<div class="card" style="margin-top:14px"><h2>Check-in</h2><button class="secondary" onclick="checkinTool()">Nhập mã check-in</button></div>`:""}`;
}
const genericFields={
 news:["title","slug","body","status","published_at"],
 classes:["unit_code","title","level","status","capacity","schedule_json","data_json"],
 events:["unit_code","title","start_at","end_at","status","capacity","data_json"],
 units:["code","name","unit_type","manager_name","email","status","data_json"],
 documents:["code","doc_type","title","visibility","status","file_id","issued_at","metadata_json"],
 tasks:["title","description","assigned_to","unit_code","status","priority","due_at"]
};
window.createGeneric=type=>{const body={};for(const f of genericFields[type]||[]){const v=prompt(`${f}:`,f.endsWith("_json")?"{}":"");if(v===null)return;body[f]=v;if(["capacity","assigned_to"].includes(f)&&v!=="")body[f]=Number(v)}if(type!=="units")body.id=body.id||undefined;api(`/api/admin/content/${type}`,{method:"POST",body}).then(()=>{toast("Đã thêm.");adminGeneric(document.getElementById("adminMain"),type,adminTitle(type),displayFields(type))}).catch(e=>toast(errorText(e),"bad"))}
window.editGeneric=(type,idv)=>{const x=(state.admin[type]||[]).find(o=>String(o.id||o.code)===String(idv));if(!x)return;const body={};for(const f of genericFields[type]||[]){const v=prompt(`${f}:`,String(x[f]??""));if(v===null)return;body[f]=v;if(["capacity","assigned_to"].includes(f)&&v!=="")body[f]=Number(v)}api(`/api/admin/content/${type}/${encodeURIComponent(idv)}`,{method:"PUT",body}).then(()=>{toast("Đã cập nhật.");adminGeneric(document.getElementById("adminMain"),type,adminTitle(type),displayFields(type))}).catch(e=>toast(errorText(e),"bad"))}
window.deleteGeneric=(type,idv)=>{if(!confirm("Xóa mục này?"))return;api(`/api/admin/content/${type}/${encodeURIComponent(idv)}`,{method:"DELETE"}).then(()=>{toast("Đã xóa.");adminGeneric(document.getElementById("adminMain"),type,adminTitle(type),displayFields(type))}).catch(e=>toast(errorText(e),"bad"))}
function adminTitle(t){return {news:"Tin tức & CMS",classes:"Lớp học",events:"Sự kiện",units:"Đơn vị trực thuộc",documents:"Kho văn bản",tasks:"Nhiệm vụ"}[t]||t}
function displayFields(t){return {news:["title","slug","status","published_at"],classes:["unit_code","title","level","status","capacity"],events:["unit_code","title","start_at","status"],units:["code","name","unit_type","manager_name","status"],documents:["code","doc_type","title","visibility","status"],tasks:["title","assigned_to","unit_code","status","priority","due_at"]}[t]||[]}
window.attendanceTool=async()=>{const classId=prompt("ID lớp (vd SFEC-L9):");if(!classId)return;try{const d=await api(`/api/admin/class-enrollments?class_id=${encodeURIComponent(classId)}`);modal(`<h2>Điểm danh ${E(classId)}</h2>${(d.items||[]).map(x=>`<div class="card"><b>${E(x.full_name)}</b> — ${E(x.email||"")}<div class="actions"><button class="secondary" onclick="markAttendance('${E(classId)}',${x.id},'Có mặt')">Có mặt</button><button class="secondary" onclick="markAttendance('${E(classId)}',${x.id},'Có phép')">Có phép</button><button class="danger" onclick="markAttendance('${E(classId)}',${x.id},'Vắng')">Vắng</button></div></div>`).join("")||"<p>Chưa có học viên.</p>"}`)}catch(e){toast(errorText(e),"bad")}}
window.markAttendance=(classId,enrollmentId,status)=>api("/api/admin/attendance",{method:"POST",body:{class_id:classId,enrollment_id:enrollmentId,session_date:new Date().toISOString().slice(0,10),status}}).then(()=>toast("Đã điểm danh.")).catch(e=>toast(errorText(e),"bad"))
window.checkinTool=()=>{const code=prompt("Mã check-in:");if(!code)return;api("/api/admin/event-checkin",{method:"POST",body:{checkin_code:code}}).then(()=>toast("Check-in thành công.")).catch(e=>toast(errorText(e),"bad"))}

async function adminCertificates(main){
  const d=await api("/api/admin/certificates");state.admin.certificates=d.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">GCN & GXN</h1><button class="primary" onclick="requestCertificate()">+ Đề nghị cấp</button></div>
  <div class="notice">Quy trình: <b>Ban Nhân sự đề nghị → Văn phòng kiểm tra → Tổng Thư ký Mạng lưới phê duyệt → Văn phòng cấp số, vào sổ, lưu và phát hành.</b></div>
  <div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Người được cấp</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.certificates.map(c=>`<tr><td><b>${E(c.code||"Chưa cấp số")}</b></td><td>${E(c.full_name)}<br>${E(c.email||"")}</td><td>${E(c.content)}</td><td><span class="status">${E(c.status)}</span></td><td>${c.status==="approved"?`<button class="primary" onclick="issueCert('${E(c.id)}')">Phát hành</button>`:""}${c.status==="issued"?` <button class="secondary" onclick="showCertQR('${E(c.code)}')">QR</button> <button class="danger" onclick="revokeCert('${E(c.id)}')">Thu hồi</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}
window.requestCertificate=()=>{const full_name=prompt("Họ tên người được cấp:");if(!full_name)return;const email=prompt("Email (nếu có):")||"";const cert_type=prompt("Loại: Giấy chứng nhận / Giấy xác nhận","Giấy chứng nhận")||"Giấy chứng nhận";const content=prompt("Nội dung ghi nhận:");if(!content)return;api("/api/admin/certificates",{method:"POST",body:{full_name,email,cert_type,content}}).then(()=>{toast("Đã gửi Trung tâm phê duyệt.");adminCertificates(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}
window.issueCert=idc=>api(`/api/admin/certificates/${encodeURIComponent(idc)}`,{method:"PATCH",body:{action:"issue"}}).then(d=>{toast("Đã phát hành: "+d.code);adminCertificates(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))
window.showCertQR=code=>{const text=`${location.origin}/?cert_lookup=${encodeURIComponent(code)}#lookup`;modal(`<h2>QR xác thực — ${E(code)}</h2><p>QR chỉ chứa liên kết tra cứu công khai, không chứa dữ liệu hồ sơ riêng tư.</p><img alt="QR" style="max-width:280px;width:100%" src="https://quickchart.io/qr?size=300&text=${encodeURIComponent(text)}"><p><a href="#lookup" onclick="closeModal()">Mở trang tra cứu</a></p>`)}
window.revokeCert=idc=>{const note=prompt("Lý do thu hồi:")||"";api(`/api/admin/certificates/${encodeURIComponent(idc)}`,{method:"PATCH",body:{action:"revoke",note}}).then(()=>{toast("Đã thu hồi.");adminCertificates(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminTickets(main){
  const d=await api("/api/admin/tickets");state.admin.tickets=d.items||[];
  main.innerHTML=`<h1>Hỗ trợ & Ticket</h1><div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Người gửi</th><th>Loại</th><th>Ưu tiên</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.tickets.map(t=>`<tr><td><b>${E(t.code)}</b></td><td>${E(t.submitter_name||"")}<br>${E(t.email||"")}</td><td>${E(t.ticket_type||"")}</td><td>${E(t.priority)}</td><td>${E(t.status)}</td><td><button class="secondary" onclick="editTicket('${E(t.id)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.editTicket=idt=>{const t=state.admin.tickets.find(x=>x.id===idt);if(!t)return;modal(`<h2>${E(t.code)}</h2><div class="field"><label>Ưu tiên</label><select id="tPriority">${["Thấp","Bình thường","Cao","Khẩn"].map(x=>`<option ${x===t.priority?"selected":""}>${x}</option>`)}</select></div><div class="field"><label>Trạng thái</label><select id="tStatus">${["Mới","Đang xử lý","Chờ phản hồi","Đã giải quyết","Đã đóng"].map(x=>`<option ${x===t.status?"selected":""}>${x}</option>`)}</select></div><div class="field"><label>Phản hồi nội bộ</label><textarea id="tMessage"></textarea></div><button class="primary" onclick="saveTicket('${E(idt)}')">Lưu</button>`)}
window.saveTicket=idt=>api(`/api/admin/tickets/${encodeURIComponent(idt)}`,{method:"PATCH",body:{priority:document.getElementById("tPriority").value,status:document.getElementById("tStatus").value,message:document.getElementById("tMessage").value}}).then(()=>{closeModal();toast("Đã cập nhật ticket.");adminTickets(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))

async function adminFiles(main){
  const d=await api("/api/admin/files");main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">File & Minh chứng</h1><button class="primary" onclick="uploadAdminFile()">+ Upload</button></div><div class="card table-scroll"><table><thead><tr><th>Tệp</th><th>Loại</th><th>Dung lượng</th><th>Quyền</th><th></th></tr></thead><tbody>${(d.items||[]).map(f=>`<tr><td><a href="/api/files/${E(f.id)}" target="_blank">${E(f.filename)}</a></td><td>${E(f.mime)}</td><td>${Math.round((f.size||0)/1024)} KB</td><td>${E(f.visibility)}</td><td><button class="danger" onclick="deleteFile('${E(f.id)}')">Xóa</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.uploadAdminFile=()=>{modal(`<h2>Upload file</h2><form id="upFile"><div class="field"><input name="file" type="file" required></div><div class="check"><input name="public" type="checkbox"><label>Cho phép công khai</label></div><button class="primary">Upload</button></form>`);document.getElementById("upFile").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),fd=new FormData();fd.append("file",f.get("file"));fd.append("visibility",f.get("public")?"public":"private");try{await api("/api/admin/upload",{method:"POST",body:fd});closeModal();toast("Đã upload.");adminFiles(document.getElementById("adminMain"))}catch(err){toast(errorText(err),"bad")}}}
window.deleteFile=idf=>{if(!confirm("Xóa file?"))return;api(`/api/admin/files/${encodeURIComponent(idf)}`,{method:"DELETE"}).then(()=>{toast("Đã xóa.");adminFiles(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminEmail(main){
  const [t,l]=await Promise.all([api("/api/admin/email-templates"),api("/api/admin/email-logs")]);state.admin.emailTemplates=t.items||[];
  main.innerHTML=`<h1>Email</h1><div class="notice">Email tiếp nhận toàn bộ đăng ký mặc định: <b>skyfirst.ec@gmail.com</b>. Dịch vụ gửi mail phải được cấu hình bằng secret ở backend.</div><h2>Mẫu email</h2>${state.admin.emailTemplates.map(x=>`<div class="card" style="margin:8px 0"><b>${E(x.key)}</b> — ${E(x.subject_template)} <button class="secondary" onclick="editEmailTemplate('${E(x.key)}')">Sửa</button></div>`).join("")}<h2 class="section-title">Nhật ký email</h2><div class="card table-scroll"><table><thead><tr><th>Đến</th><th>Template</th><th>Trạng thái</th><th>Thời gian</th><th>Lỗi</th></tr></thead><tbody>${(l.items||[]).slice(0,300).map(x=>`<tr><td>${E(x.to_email)}</td><td>${E(x.template_key)}</td><td>${E(x.status)}</td><td>${fmt(x.created_at)}</td><td>${E(x.error||"")}</td></tr>`).join("")}</tbody></table></div>`;
}
window.editEmailTemplate=key=>{const x=state.admin.emailTemplates.find(t=>t.key===key);if(!x)return;modal(`<h2>${E(key)}</h2><div class="field"><label>Tiêu đề</label><input id="etSubject" value="${E(x.subject_template)}"></div><div class="field"><label>HTML</label><textarea id="etHtml">${E(x.html_template)}</textarea></div><div class="field"><label>Text</label><textarea id="etText">${E(x.text_template||"")}</textarea></div><button class="primary" onclick="saveEmailTemplate('${E(key)}')">Lưu</button>`)}
window.saveEmailTemplate=key=>api(`/api/admin/email-templates/${encodeURIComponent(key)}`,{method:"PUT",body:{subject_template:document.getElementById("etSubject").value,html_template:document.getElementById("etHtml").value,text_template:document.getElementById("etText").value,enabled:true}}).then(()=>{closeModal();toast("Đã lưu mẫu email.");adminEmail(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))

async function adminModules(main){
  const d=await api("/api/admin/modules");state.admin.modules=d.items||[];
  main.innerHTML=`<h1>Quản lý Modules</h1><p class="muted">Bật/tắt chức năng theo nhu cầu mà không phải tạo lại ZIP.</p><div class="card">${state.admin.modules.map(m=>`<div class="check"><input type="checkbox" data-module="${E(m.key)}" ${m.enabled?"checked":""}><label><b>${E(m.name)}</b> — ${E(m.description||"")} <span class="small muted">(${E(m.category)})</span></label></div>`).join("")}<button class="primary" onclick="saveModules()">Lưu Modules</button></div>`;
}
window.saveModules=()=>{const items=state.admin.modules.map(m=>({key:m.key,enabled:document.querySelector(`[data-module="${CSS.escape(m.key)}"]`).checked}));api("/api/admin/modules",{method:"PUT",body:{items}}).then(async()=>{toast("Đã cập nhật Modules.");await loadConfig()}).catch(e=>toast(errorText(e),"bad"))}

async function adminSettings(main){
  const d=await api("/api/admin/settings"),map=Object.fromEntries((d.items||[]).map(x=>[x.key,x.value]));state.admin.settings=map;
  main.innerHTML=`<h1>Cài đặt hệ thống</h1><div class="card"><div class="field"><label>Tên hệ thống</label><input id="sAppName" value="${E(map.app_name||"")}"></div><div class="field"><label>Email nhận toàn bộ đăng ký</label><input id="sReceiver" value="${E(map.receiver_email||"skyfirst.ec@gmail.com")}"></div><div class="field"><label>Hotline/Zalo</label><input id="sHotline" value="${E(map.hotline||"0924 910 210")}"></div><div class="field"><label>Website</label><input id="sWebsite" value="${E(map.website||"")}"></div><div class="field"><label>Châm ngôn</label><input id="sSlogan" value="${E(map.brand_slogan||"")}"></div><div class="field"><label>Tiêu đề Hero</label><input id="sHeroTitle" value="${E(map.hero_title||"Kết nối giáo dục. Phát triển cộng đồng.")}"></div><div class="field"><label>Mô tả Hero</label><textarea id="sHeroText">${E(map.hero_text||"Một cổng chung cho Thành viên, Core Team, Tình nguyện viên, Học sinh/Học viên, lớp học, hoạt động, hồ sơ, GCN/GXN và quản trị Sky First Network.")}</textarea></div><div class="field"><label>Ảnh bìa Hero (URL hoặc /api/files/...)</label><input id="sHeroCover" value="${E(map.hero_cover_url||"/assets/sfn-cover.png")}"></div><div class="field"><label>Thời hạn lưu hồ sơ không phù hợp (ngày)</label><input id="sRetention" type="number" value="${E(map.rejected_application_retention_days||365)}"></div><div class="check"><input id="sMaintenance" type="checkbox" ${map.maintenance_mode?"checked":""}><label>Bật chế độ bảo trì trang công khai</label></div><button class="primary" onclick="saveSettings()">Lưu cài đặt</button></div>`;
}
window.saveSettings=()=>api("/api/admin/settings",{method:"PUT",body:{items:{app_name:document.getElementById("sAppName").value,receiver_email:document.getElementById("sReceiver").value,hotline:document.getElementById("sHotline").value,website:document.getElementById("sWebsite").value,brand_slogan:document.getElementById("sSlogan").value,hero_title:document.getElementById("sHeroTitle").value,hero_text:document.getElementById("sHeroText").value,hero_cover_url:document.getElementById("sHeroCover").value,rejected_application_retention_days:Number(document.getElementById("sRetention").value)||365,maintenance_mode:document.getElementById("sMaintenance").checked}}}).then(async()=>{toast("Đã lưu cài đặt.");await loadConfig()}).catch(e=>toast(errorText(e),"bad"))

async function adminSearch(main){
  main.innerHTML=`<h1>Tìm kiếm toàn hệ thống</h1><div class="card"><div class="field"><label>Từ khóa</label><input id="globalSearch" placeholder="Mã hồ sơ, họ tên, GCN, văn bản, ticket…"></div><button class="primary" onclick="runSearch()">Tìm</button><div id="searchResults" class="search-results"></div></div>`;
}
window.runSearch=async()=>{const q=document.getElementById("globalSearch").value.trim();if(q.length<2)return;try{const d=await api(`/api/admin/search?q=${encodeURIComponent(q)}`);document.getElementById("searchResults").innerHTML=(d.items||[]).map(x=>`<div class="card"><span class="pill">${E(x.kind)}</span><b>${E(x.ref)}</b> — ${E(x.title)}<br><span class="muted">${E(x.detail||"")}</span></div>`).join("")||"<div class='notice'>Không có kết quả.</div>"}catch(e){toast(errorText(e),"bad")}}
async function adminAudit(main){
  const d=await api("/api/admin/audit");main.innerHTML=`<h1>Audit Log</h1><div class="card table-scroll"><table><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>${(d.items||[]).map(x=>`<tr><td>${fmt(x.created_at)}</td><td>${E(x.actor_email||"Hệ thống")}</td><td>${E(x.action)}</td><td>${E(x.entity_type||"")} ${E(x.entity_id||"")}</td></tr>`).join("")}</tbody></table></div>`;
}
async function adminBackup(main){
  const d=await api("/api/admin/backups");main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Sao lưu</h1><button class="primary" onclick="createBackup()">Tạo backup ngay</button></div><div class="notice">Hệ thống còn có lịch cleanup hằng ngày và backup cấu hình/nghiệp vụ tự động vào Chủ nhật khi cron được bật.</div><div class="card">${(d.items||[]).map(x=>`<p><b>${E(x.id)}</b> — ${Math.round((x.size||0)/1024)} KB — ${fmt(x.created_at)} <button class="danger" onclick="restoreBackup('${E(x.id)}')">Phục hồi</button></p>`).join("")||"<p>Chưa có backup.</p>"}</div>`;
}
window.restoreBackup=idb=>{if(!confirm("Phục hồi sẽ ghi đè các bảng nghiệp vụ trong backup. Chỉ Super Admin được thực hiện. Tiếp tục?"))return;api(`/api/admin/backups/${encodeURIComponent(idb)}/restore`,{method:"POST"}).then(()=>{toast("Đã phục hồi backup.");adminBackup(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}
window.createBackup=()=>api("/api/admin/backup",{method:"POST"}).then(()=>{toast("Đã tạo backup.");adminBackup(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))

function errorText(err){
  const code=err?.data?.error||err?.message||"Có lỗi xảy ra.";
  const map={
    INVALID_CREDENTIALS:"Email hoặc mật khẩu không đúng.",
    EMAIL_NOT_VERIFIED:"Email chưa được xác minh.",
    MEMBER_ACCESS_NOT_GRANTED:"Tài khoản này chưa được SFN cấp quyền Thành viên.",
    ADMIN_ACCESS_NOT_GRANTED:"Tài khoản này chưa được cấp quyền Quản trị viên.",
    PASSWORD_TOO_SHORT:"Mật khẩu cần ít nhất 10 ký tự.",
    CURRENT_PASSWORD_INVALID:"Mật khẩu hiện tại không đúng.",
    RATE_LIMIT:"Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.",
    FORBIDDEN:"Bạn không có quyền thực hiện thao tác này.",
    PROTECTED_SUPER_ADMIN:"Tài khoản Super Admin gốc được bảo vệ.",
    ROOT_SUPER_ADMIN_CANNOT_BE_REMOVED:"Không thể gỡ quyền Super Admin gốc.",
    EMAIL_PROVIDER_NOT_CONFIGURED:"Dịch vụ email chưa được cấu hình.",
    GOOGLE_OAUTH_NOT_CONFIGURED:"Đăng nhập Google chưa được cấu hình."
  };
  return map[code]||code;
}

async function handleQueryActions(){
  const q=new URLSearchParams(location.search);
  if(q.get("verify")){
    try{await api("/api/auth/verify-email",{method:"POST",body:{token:q.get("verify")}});history.replaceState({},document.title,location.pathname+location.hash);toast("Email đã được xác minh.")}catch(e){toast(errorText(e),"bad")}
  }
  if(q.get("reset")){
    const token=q.get("reset");
    history.replaceState({},document.title,location.pathname+location.hash);
    modal(`<h2>Đặt lại mật khẩu</h2><form id="resetPw"><div class="field"><label>Mật khẩu mới</label><input name="new_password" type="password" minlength="10" required></div><button class="primary">Đặt lại</button></form>`);
    document.getElementById("resetPw").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/auth/reset",{method:"POST",body:{token,new_password:f.get("new_password")}});closeModal();toast("Đã đặt lại mật khẩu.");location.hash="login"}catch(err){toast(errorText(err),"bad")}};
  }
  if(q.get("auth_error"))toast(errorText({message:q.get("auth_error")}),"bad");
}
async function router(){
  const hash=(location.hash||"#home").slice(1),[route,param]=hash.split("/");
  try{
    if(route==="home")return renderHome();
    if(route==="forms")return renderForms();
    if(route==="form")return renderForm(decodeURIComponent(param||""));
    if(route==="classes")return renderClasses();
    if(route==="events")return renderEvents();
    if(route==="units")return renderUnits();
    if(route==="news")return renderNews();
    if(route==="lookup")return renderLookup();
    if(route==="login")return renderLogin();
    if(route==="portal")return renderPortal();
    if(route==="admin")return renderAdmin();
    location.hash="home";
  }catch(err){app.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`}
}

window.addEventListener("hashchange",router);
(async()=>{
  await loadConfig();await loadMe();await handleQueryActions();
  if(state.config.maintenance_mode&&!state.user&&!location.hash.startsWith("#login")){app.innerHTML=`<div class="form-wrap"><div class="card"><img src="/assets/sfn-logo.png" style="width:90px"><h1>Sky First đang bảo trì</h1><p class="muted">Hệ thống tạm thời bảo trì. Quản trị viên vẫn có thể đăng nhập.</p><a class="primary" href="#login">Đăng nhập Quản trị</a></div></div>`;return}
  await router();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
})();
