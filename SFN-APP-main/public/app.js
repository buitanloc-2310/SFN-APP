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
const fmt=d=>d?new Date(d).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"—";
const cttToday=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;};
const rolesOf=u=>(u?.roles||[]).map(r=>r.role_id);
const isAdmin=u=>Array.isArray(u?.permissions)&&(u.permissions.includes("*")||u.permissions.includes("admin.access"))||(u?.roles||[]).some(r=>Number(r.level)>=40);
const isMember=u=>(u?.roles||[]).some(r=>["member","volunteer","handler","unit_admin","editor","communications","external_events","case_manager","reviewer","certificate_manager","hr","office","content_admin","network_secretary","system_admin","super_admin","owner"].includes(r.role_id));

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
let modalReturnFocus=null,modalKeyHandler=null;
function modal(html){
  modalReturnFocus=document.activeElement;
  if(modalKeyHandler)document.removeEventListener("keydown",modalKeyHandler);
  modalRoot.innerHTML=`<div class="modal-bg" id="modalBg"><div class="modal" role="dialog" aria-modal="true" aria-label="Hộp thoại quản trị">${html}</div></div>`;
  const bg=document.getElementById("modalBg"),box=bg?.querySelector(".modal");
  bg?.addEventListener("click",e=>{if(e.target.id==="modalBg")closeModal()});
  modalKeyHandler=e=>{
    const current=modalRoot.querySelector('[role="dialog"]');if(!current)return;
    if(e.key==="Escape"){e.preventDefault();closeModal();return;}
    if(e.key!=="Tab")return;
    const focusable=[...current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
    if(!focusable.length){e.preventDefault();current.tabIndex=-1;current.focus();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(!current.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();}
    else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",modalKeyHandler);
  const first=box?.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]');
  if(first)requestAnimationFrame(()=>first.focus());
}
let activeAdminDialogCancel=null;
function closeModal(){
  const cancel=activeAdminDialogCancel;activeAdminDialogCancel=null;modalRoot.innerHTML="";
  if(modalKeyHandler){document.removeEventListener("keydown",modalKeyHandler);modalKeyHandler=null;}
  if(cancel)cancel();
  const target=modalReturnFocus;modalReturnFocus=null;
  if(target?.isConnected)requestAnimationFrame(()=>target.focus?.());
}
window.closeModal=closeModal;
function adminDialog({title="Thao tác quản trị",description="",fields=[],confirmText="Lưu",cancelText="Hủy",danger=false}={}){
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;activeAdminDialogCancel=null;modalRoot.innerHTML="";resolve(value)};
    const inputHtml=f=>{
      const id=`admin-dialog-${f.name}`,value=f.value??"",required=f.required?"required":"",help=f.help?`<small class="muted">${E(f.help)}</small>`:"";
      if(f.type==="textarea")return `<div class="field"><label for="${E(id)}">${E(f.label)}</label><textarea id="${E(id)}" name="${E(f.name)}" rows="${Number(f.rows)||4}" ${required} placeholder="${E(f.placeholder||"")}">${E(value)}</textarea>${help}</div>`;
      if(f.type==="select")return `<div class="field"><label for="${E(id)}">${E(f.label)}</label><select id="${E(id)}" name="${E(f.name)}" ${required}>${(f.options||[]).map(o=>{const opt=typeof o==="string"?{value:o,label:o}:o;return `<option value="${E(opt.value)}" ${String(opt.value)===String(value)?"selected":""}>${E(opt.label)}</option>`}).join("")}</select>${help}</div>`;
      if(f.type==="checkbox")return `<label class="check admin-dialog-check"><input id="${E(id)}" name="${E(f.name)}" type="checkbox" ${f.checked?"checked":""}><span>${E(f.label)}</span></label>${help}`;
      return `<div class="field"><label for="${E(id)}">${E(f.label)}</label><input id="${E(id)}" name="${E(f.name)}" type="${E(f.type||"text")}" value="${E(value)}" ${required} ${f.min!==undefined?`min="${E(f.min)}"`:""} ${f.max!==undefined?`max="${E(f.max)}"`:""} ${f.step!==undefined?`step="${E(f.step)}"`:""} maxlength="${E(f.maxlength||500)}" placeholder="${E(f.placeholder||"")}">${help}</div>`;
    };
    modal(`<div class="admin-dialog-head"><span class="eyebrow">Sky First · QUẢN TRỊ</span><button type="button" class="admin-modal-close" id="adminDialogClose" aria-label="Đóng">×</button><h2 id="adminDialogTitle">${E(title)}</h2>${description?`<p class="muted">${E(description)}</p>`:""}</div><form id="adminDialogForm" class="admin-dialog-form">${fields.map(inputHtml).join("")}<div class="admin-dialog-actions"><button type="button" class="secondary" id="adminDialogCancel">${E(cancelText)}</button><button type="submit" class="${danger?"danger":"primary"}">${E(confirmText)}</button></div></form>`);
    activeAdminDialogCancel=()=>finishWithCleanup(null);
    const escapeDialog=e=>{if(e.key==="Escape"){e.preventDefault();window.removeEventListener("keydown",escapeDialog);finish(null);}};
    window.addEventListener("keydown",escapeDialog);
    const originalFinish=finish;
    const finishWithCleanup=value=>{window.removeEventListener("keydown",escapeDialog);originalFinish(value);};
    document.getElementById("adminDialogClose")?.addEventListener("click",()=>finishWithCleanup(null));
    document.getElementById("adminDialogCancel")?.addEventListener("click",()=>finishWithCleanup(null));
    document.getElementById("adminDialogForm")?.addEventListener("submit",e=>{
      e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
      const out={};for(const f of fields){const el=form.elements.namedItem(f.name);if(!el)continue;out[f.name]=f.type==="checkbox"?el.checked:el.value;}
      finishWithCleanup(out);
    });
    const first=document.querySelector("#adminDialogForm input:not([type=checkbox]),#adminDialogForm textarea,#adminDialogForm select");first?.focus();
  });
}
async function adminPrompt(message,defaultValue="",options={}){
  const out=await adminDialog({title:options.title||"Nhập thông tin",description:options.description||"",confirmText:options.confirmText||"Tiếp tục",fields:[{name:"value",label:message,value:defaultValue,type:options.type||"text",required:!!options.required,placeholder:options.placeholder||"",min:options.min,max:options.max,step:options.step,options:options.options,help:options.help}]});
  return out===null?null:out.value;
}
async function adminConfirm(message,{title="Xác nhận thao tác",confirmText="Xác nhận",danger=false}={}){
  const out=await adminDialog({title,description:message,confirmText,cancelText:"Quay lại",danger,fields:[]});return out!==null;
}

async function loadConfig(){
  try{state.config=await api("/api/config")}catch{state.config={app_name:"Hệ thống Thông tin Số Sky First",hero_title:"Hệ thống Thông tin Số Sky First",hero_text:"Tra cứu chương trình, sự kiện, tài liệu, biểu mẫu, hồ sơ và chứng nhận tại một điểm truy cập thống nhất.",hero_cover_url:"",modules:[],forms:[]}}
  applySiteConfig();
}
function applySiteConfig(){
  const c=state.config||{};
  const brand=document.getElementById("siteBrand"),theme=document.getElementById("themeBtn"),account=document.getElementById("accountBtn");
  if(brand)brand.style.display=c.header_show_brand===false?"none":"";
  if(theme)theme.style.display=c.header_show_theme===false?"none":"";
  if(account)account.style.display=c.header_show_account===false?"none":"";
  if(account&&!state.user&&c.header_account_label)account.textContent=c.header_account_label;
  const fd=document.getElementById("footerDescription");if(fd&&c.footer_description)fd.textContent=c.footer_description;
  const fe=document.getElementById("footerEmailText"),fel=document.getElementById("footerEmailLink");if(fe&&c.footer_email)fe.textContent=c.footer_email;if(fel&&c.footer_email)fel.href="mailto:"+c.footer_email;
  const fs=document.getElementById("footerSupportText"),fsl=document.getElementById("footerSupportLink");if(fs&&c.footer_support_email)fs.textContent=c.footer_support_email;if(fsl&&c.footer_support_email)fsl.href="mailto:"+c.footer_support_email;
  const fc=document.getElementById("footerCopyright");if(fc&&c.footer_copyright)fc.textContent=c.footer_copyright;
  const fcit=document.getElementById("footerCitationNotice");if(fcit&&c.footer_citation_notice)fcit.textContent=c.footer_citation_notice;
  const setLink=(id,textId,url,labelId,label)=>{const a=document.getElementById(id),t=document.getElementById(textId),l=labelId&&document.getElementById(labelId);if(a&&url)a.href=url;if(t&&url)t.textContent=url.replace(/^https?:\/\//,"").replace(/\/$/,"");if(l&&label)l.textContent=label};
  setLink("portalMainLink","portalMainText",c.portal_main_url,"portalMainLabel",c.portal_main_label);
  setLink("portalCttLink","portalCttText",c.portal_ctt_url);setLink("portalMailLink","portalMailText",c.portal_mail_url);setLink("portalMemberLink","portalMemberText",c.portal_member_url);setLink("portalSfecLink","portalSfecText",c.portal_sfec_url);setLink("portalExamLink","portalExamText",c.portal_exam_url);
  const pe=document.getElementById("footerPortalEmailText"),pel=document.getElementById("footerPortalEmailLink");if(pe&&c.footer_portal_email)pe.textContent=c.footer_portal_email;if(pel&&c.footer_portal_email)pel.href="mailto:"+c.footer_portal_email;
  const ph=document.getElementById("footerHotlineText"),phl=document.getElementById("footerHotlineLink");if(ph&&c.hotline)ph.textContent=c.hotline;if(phl&&c.hotline)phl.href="tel:"+c.hotline.replace(/[^+\d]/g,"");
}
async function loadMe(){
  try{state.user=(await api("/api/auth/me")).user}catch{state.user=null}
  if(accountBtn) accountBtn.textContent=state.user?(state.user.full_name||state.user.email):"Đăng nhập";
}
function moduleEnabled(key){
  const m=(state.config?.modules||[]).find(x=>x.key===key);
  return !m||!!m.enabled;
}
function setTheme(t){
  document.body.classList.toggle("dark",t==="dark");localStorage.setItem("sfn_theme",t);
}
if(themeBtn) themeBtn.onclick=()=>setTheme(document.body.classList.contains("dark")?"light":"dark");
setTheme(localStorage.getItem("sfn_theme")||"light");
if(accountBtn) accountBtn.onclick=()=>{if(state.user) location.hash=isAdmin(state.user)?"admin/dashboard":"portal"; else location.hash="login"};

function hero(){
  return `<section class="hero ctt-hero">
    <div class="hero-copy"><span class="pill white">Sky First • SFN</span>
      <h1>${E(state.config?.hero_title||"Hệ thống Thông tin Số Sky First")}</h1>
      <p class="hero-lead"><b>Khám phá và tham gia các hoạt động của Sky First.</b></p>
      <p>${E(state.config?.hero_text||"Theo dõi hoạt động, sự kiện, chương trình giáo dục và các cơ hội tham gia đang được mở trên toàn Mạng lưới.")}</p>
      <div class="actions"><a class="primary hero-white" href="#events">Khám phá hoạt động →</a><a class="secondary hero-outline" href="#lookup">Tra cứu đăng ký</a></div>
    </div>
  </section>`;
}
async function renderHome(){
  app.innerHTML=hero()+`
  <section class="lookup-strip">
    <div><span class="eyebrow">TRA CỨU NHANH</span><h2>Kiểm tra hồ sơ, GCN & GXN</h2><p>Nhập mã đã được cấp để theo dõi hồ sơ hoặc xác thực thông tin do Sky First phát hành.</p></div>
    <a class="primary lookup-cta" href="#lookup">Mở tra cứu →</a>
  </section>

  <section class="home-section">
    <div class="section-heading"><div><span class="eyebrow">KHÁM PHÁ Sky First</span><h2>Một hệ sinh thái học tập và phát triển cộng đồng</h2><p class="muted">Các chức năng được tổ chức theo từng nhu cầu để bạn tìm đúng nơi cần đến nhanh hơn.</p></div></div>
    <div class="grid4 home-feature-grid">
      ${quickCard("users","Thành viên & Core Team","Đăng ký tham gia, theo dõi hồ sơ và kết nối với các nhóm vận hành của Sky First.","#forms")}
      ${quickCard("heart","Tình nguyện viên","Khám phá cơ hội tình nguyện, giảng dạy và đóng góp chuyên môn cho các hoạt động cộng đồng.","#form/volunteer")}
      ${quickCard("book","Lớp học & chương trình","Theo dõi các lớp, chương trình học tập, tình trạng tuyển sinh và đăng ký tham gia.","#classes")}
      ${quickCard("badge","GCN & GXN","Tra cứu và xác thực giấy chứng nhận, giấy xác nhận cùng các hồ sơ liên quan.","#lookup")}
    </div>
  </section>

  <section class="home-story">
    <div class="home-story-copy">
      <span class="eyebrow">VỀ Sky First</span>
      <h2>Không chỉ là một website, mà là không gian để học tập, thử sức và tạo giá trị</h2>
      <p>Sky First được xây dựng theo định hướng giáo dục, phát triển con người và kết nối cộng đồng. Nền tảng này giúp tập trung những hoạt động vốn thường nằm rời rạc ở nhiều nơi: đăng ký tham gia, lớp học, tình nguyện, sự kiện, hồ sơ thành viên, chứng nhận, xác nhận và các kênh hỗ trợ. Người dùng có thể bắt đầu từ một nhu cầu rất đơn giản như tìm lớp học, gửi hồ sơ tình nguyện hoặc tra cứu giấy xác nhận, sau đó tiếp tục theo dõi hành trình của mình trên cùng một hệ thống.</p>
      <p>Điểm quan trọng của Sky First là tạo điều kiện để người trẻ được học bằng trải nghiệm thật. Một thành viên có thể bắt đầu với vai trò người học, sau đó thử sức ở một dự án, hỗ trợ một hoạt động cộng đồng hoặc tham gia Core Team. Mỗi vai trò đều hướng đến việc hình thành kỹ năng tổ chức, giao tiếp, làm việc nhóm, trách nhiệm và khả năng tự học. Các chương trình không chỉ tập trung vào kết quả cuối cùng mà còn chú trọng quá trình tham gia, sự chủ động và cách mỗi cá nhân đóng góp cho tập thể.</p>
      <p>Website này được thiết kế như một cổng chung để các thông tin quan trọng dễ tiếp cận hơn, giảm việc phải hỏi lại nhiều nơi và giúp quy trình đăng ký, tra cứu, tiếp nhận hay xác nhận minh bạch hơn. Từng chức năng được tách riêng để khi một khu vực gặp sự cố, các khu vực còn lại vẫn có thể tiếp tục hoạt động. Nội dung công khai cũng được ưu tiên có phương án dự phòng để người dùng vẫn xem được những thông tin thiết yếu ngay cả khi hệ thống dữ liệu tạm thời không khả dụng.</p>
    </div>
    <div class="home-value-stack">
      <div class="value-card">${lineIcon("spark")}<h3>Học tập chủ động</h3><p>Khuyến khích tự học, thực hành và phát triển năng lực qua trải nghiệm.</p></div>
      <div class="value-card">${lineIcon("people")}<h3>Kết nối cộng đồng</h3><p>Tạo môi trường để thành viên, tình nguyện viên và người học hỗ trợ lẫn nhau.</p></div>
      <div class="value-card">${lineIcon("shield")}<h3>Minh bạch & dễ tra cứu</h3><p>Hồ sơ, GCN/GXN và trạng thái xử lý được tổ chức rõ ràng, dễ kiểm tra.</p></div>
    </div>
  </section>

  <section class="home-section">
    <div class="section-heading"><div><span class="eyebrow">HÀNH TRÌNH THAM GIA</span><h2>Từ tìm hiểu đến đồng hành lâu dài</h2><p class="muted">Quy trình được trình bày rõ để người mới không phải đoán mình cần làm gì tiếp theo.</p></div></div>
    <div class="journey-grid">
      <div class="journey-card"><span>01</span><h3>Tìm đúng chương trình</h3><p>Khám phá lớp học, hoạt động, vị trí tình nguyện hoặc vai trò thành viên phù hợp với nhu cầu và thời gian của bạn.</p></div>
      <div class="journey-card"><span>02</span><h3>Gửi thông tin</h3><p>Hoàn thành biểu mẫu tương ứng. Sau khi gửi, hệ thống cấp mã hồ sơ để bạn chủ động theo dõi quá trình xử lý.</p></div>
      <div class="journey-card"><span>03</span><h3>Theo dõi & phản hồi</h3><p>Tra cứu trạng thái, bổ sung thông tin khi cần và nhận thông báo từ bộ phận phụ trách theo từng quy trình.</p></div>
      <div class="journey-card"><span>04</span><h3>Tham gia & ghi nhận</h3><p>Khi đủ điều kiện, bạn được tiếp nhận vào lớp, hoạt động hoặc đội ngũ; các ghi nhận phù hợp có thể được xác thực bằng GCN/GXN.</p></div>
    </div>
  </section>

  <section class="home-section faq-section">
    <div class="section-heading"><div><span class="eyebrow">HỖ TRỢ NHANH</span><h2>Câu hỏi thường gặp</h2></div></div>
    <div class="faq-grid">
      <details class="faq-card"><summary>Tôi tra cứu hồ sơ ở đâu?</summary><p>Dùng mục Tra cứu, nhập mã hồ sơ và email đã sử dụng khi đăng ký. Kết quả chỉ hiển thị thông tin cần thiết cho việc theo dõi.</p></details>
      <details class="faq-card"><summary>GCN/GXN được xác thực như thế nào?</summary><p>Nhập mã được ghi trên giấy tại mục Xác thực GCN/GXN. Hệ thống đối chiếu mã và trạng thái phát hành để trả kết quả.</p></details>
      <details class="faq-card"><summary>Nếu một phần website đang lỗi thì sao?</summary><p>Các module công khai được tách riêng. Khi dữ liệu động tạm thời không khả dụng, website vẫn giữ các nội dung nền và thông báo rõ khu vực nào đang gián đoạn.</p></details>
      <details class="faq-card"><summary>Cần hỗ trợ thêm thì liên hệ thế nào?</summary><p>Bạn có thể dùng biểu mẫu hỗ trợ hoặc các thông tin liên hệ ở cuối trang. Khi liên hệ, nên gửi kèm mã hồ sơ nếu vấn đề liên quan đến một đăng ký cụ thể.</p></details>
    </div>
  </section>

  <section class="system-hub compact-hub">
    <div class="section-heading"><div><span class="eyebrow">HỆ SINH THÁI Sky First</span><h2>Nền tảng kết nối</h2><p class="muted">Các cổng chuyên biệt còn lại của Sky First, được giữ gọn để tránh trùng lặp chức năng.</p></div></div>
    <div class="portal-grid portal-grid-3">
      ${portalCard("Sky First","Website chính và điểm bắt đầu của hệ sinh thái.","https://skyfirst.io.vn","Sky First")}
      ${portalCard("Tình nguyện viên","Đăng ký, hồ sơ và hoạt động tình nguyện.","https://tnv.skyfirst.io.vn","TNV")}
      ${portalCard("SFEC","Không gian dành cho hoạt động và chương trình tiếng Anh.","https://sfec.skyfirst.io.vn","SFEC")}
    </div>
  </section>

  <section class="home-section">
    <div class="section-heading"><div><span class="eyebrow">CẬP NHẬT</span><h2>Tin mới từ Sky First</h2><p class="muted">Thông báo, hoạt động và các nội dung mới nhất được công bố trên hệ thống.</p></div><a class="secondary" href="#news">Xem tất cả</a></div>
    <div class="grid" id="homeNews"></div>
  </section>

  <section class="join-banner"><div><span class="eyebrow">BẮT ĐẦU HÀNH TRÌNH</span><h2>Bạn muốn tham gia Sky First?</h2><p>Chọn biểu mẫu phù hợp, gửi thông tin và lưu lại mã hồ sơ để theo dõi quá trình xử lý.</p></div><div class="actions"><a class="primary" href="#forms">Đăng ký tham gia</a><a class="secondary" href="#lookup">Tra cứu hồ sơ</a></div></section>`;
  try{
    const d=await api("/api/public/news");
    document.getElementById("homeNews").innerHTML=(d.items||[]).slice(0,3).map(newsCard).join("")||`<div class="card muted">Chưa có tin mới.</div>`;
  }catch{
    const el=document.getElementById("homeNews");
    if(el)el.innerHTML=`<div class="card muted">Tin tức đang tạm thời chưa tải được. Các chức năng công khai khác vẫn hoạt động bình thường.</div>`;
  }
}
function lineIcon(name){
  const paths={
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    badge:'<circle cx="12" cy="8" r="6"/><path d="M8.2 13 7 22l5-3 5 3-1.2-9"/>',
    spark:'<path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5"/>',
    shield:'<path d="M12 3l7 3v5c0 5-3.2 8.2-7 10-3.8-1.8-7-5-7-10V6l7-3z"/><path d="m9 12 2 2 4-4"/>'
  };
  return `<div class="quick-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.book}</svg></div>`;
}
function quickCard(icon,title,desc,href){return `<div class="card">${lineIcon(icon)}<h3>${E(title)}</h3><p class="muted">${E(desc)}</p><a class="primary" href="${href}">Mở</a></div>`}
function portalCard(title,desc,href,label){return `<a class="portal-card" href="${href}" target="_blank" rel="noopener"><span class="portal-tag">${E(label)}</span><h3>${E(title)}</h3><p>${E(desc)}</p><span class="portal-open">Truy cập <b>↗</b></span></a>`}
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
if(f.type==="file")return `<div class="field upload-field"><label>${E(f.label)}${req}</label><input type="file" ${attrs} ${f.accept?`accept="${E(f.accept.join(","))}"`:""}><div class="file-preview" data-file-preview="${E(f.key)}"><span>Chưa chọn tệp</span></div>`
  if(f.type==="signature")return `<div class="field signature-field"><label>${E(f.label)}${req}</label><div class="signature-pad"><canvas data-signature-canvas="${E(f.key)}" width="900" height="280" aria-label="Vùng vẽ chữ ký"></canvas><div class="signature-actions"><button type="button" class="secondary" data-signature-clear="${E(f.key)}">Xóa / ký lại</button><label class="secondary signature-upload-label">Tải ảnh chữ ký lên<input type="file" data-signature-upload="${E(f.key)}" accept="image/png,image/jpeg,image/webp" hidden></label></div><div class="signature-preview-slot" data-signature-preview="${E(f.key)}" style="margin-top:8px;"></div></div></div>`;
  return `<div class="field"><label>${E(f.label)}${req}</label><input type="${E(f.type||"text")}" ${attrs}></div>`;
}
function sectionActive(section,answers){
  if(section?.minor_only){const d=answers.dob?new Date(answers.dob):null;if(!d||Number.isNaN(d.getTime()))return false;const now=new Date();let age=now.getFullYear()-d.getFullYear();const md=now.getMonth()-d.getMonth();if(md<0||(md===0&&now.getDate()<d.getDate()))age--;if(age>=18)return false;}
  return conditionOk(section?.condition,answers);
}
function collectFormValues(formEl,config,validate=true){
  const answers={},files={};let firstBad=null;
  const pre={};formEl.querySelectorAll('[data-key]').forEach(el=>{pre[el.dataset.key]=el.type==='checkbox'?el.checked:el.value?.trim?.()||''});
  for(const section of config.sections||[]){
    if(!sectionActive(section,pre)) continue;
    for(const f of section.fields||[]){
      if(!conditionOk(f.condition,{...pre,...answers}))continue;
      if(f.type==='signature'){
        const canvas=formEl.querySelector(`[data-signature-canvas="${CSS.escape(f.key)}"]`),up=formEl.querySelector(`[data-signature-upload="${CSS.escape(f.key)}"]`);
        const signed=canvas?.dataset.signed==='1',uploaded=up?.files?.[0];
        answers[f.key]=signed?'drawn':uploaded?'uploaded':'';if(uploaded)files[f.key]=uploaded;
        if(validate&&f.required&&!signed&&!uploaded&&!firstBad)firstBad={el:canvas||up,label:f.label};
        continue;
      }
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
    const s=config.sections[i];sec.classList.toggle("condition-hidden",!sectionActive(s,answers));
  });
  for(const f of config.sections.flatMap(s=>s.fields||[])){
    const wrap=form.querySelector(`[data-field-wrap="${CSS.escape(f.key)}"]`);if(wrap)wrap.classList.toggle("hidden",!conditionOk(f.condition,answers));
  }
}
function initFilePreviews(form){
  form.querySelectorAll('input[type="file"][data-key]').forEach(input=>input.addEventListener('change',()=>{const box=form.querySelector(`[data-file-preview="${CSS.escape(input.dataset.key)}"]`),file=input.files?.[0];if(!box)return;if(!file){box.innerHTML='<span>Chưa chọn tệp</span>';return}const size=(file.size/1024/1024).toFixed(2);box.innerHTML=`<b>${E(file.name)}</b><span>${size} MB · ${E(file.type||'file')}</span>`;}));
}
function initSignaturePads(form){
  form.querySelectorAll('[data-signature-canvas]').forEach(canvas=>{const key=canvas.dataset.signatureCanvas,ctx=canvas.getContext('2d'),prevSlot=form.querySelector(`[data-signature-preview="${CSS.escape(key)}"]`);ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--ink')||'#10233e';let drawing=false,last=null;const pos=e=>{const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e;return {x:(p.clientX-r.left)*(canvas.width/r.width),y:(p.clientY-r.top)*(canvas.height/r.height)}};const start=e=>{e.preventDefault();drawing=true;last=pos(e)};const move=e=>{if(!drawing)return;e.preventDefault();const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;canvas.dataset.signed='1';if(prevSlot)prevSlot.innerHTML='<span class="small muted">✓ Đã ghi nhận chữ ký vẽ tay</span>'};const end=()=>{drawing=false;last=null};canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);window.addEventListener('pointerup',end);form.querySelector(`[data-signature-clear="${CSS.escape(key)}"]`)?.addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.signed='0';const up=form.querySelector(`[data-signature-upload="${CSS.escape(key)}"]`);if(up)up.value='';if(prevSlot)prevSlot.innerHTML=''});form.querySelector(`[data-signature-upload="${CSS.escape(key)}"]`)?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file){ctx.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.signed='0';if(prevSlot){const objUrl=URL.createObjectURL(file);prevSlot.innerHTML=`<div class="small muted">✓ Đã chọn ảnh chữ ký: <b>${E(file.name)}</b></div><img src="${E(objUrl)}" alt="Xem trước chữ ký tải lên" style="max-height:90px;margin-top:6px;border:1px solid #dbe4f0;border-radius:8px;background:#fff;padding:4px;">`;}}});});
}
function signatureBlob(canvas){return new Promise(resolve=>canvas.toBlob(resolve,'image/png',.95))}
async function clientSha256(file){const buf=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function uploadWithSession(file,key,onProgress=()=>{}){
  const digest=await clientSha256(file);
  const session=await api('/api/uploads/session',{method:'POST',body:{filename:file.name||`${key}.bin`,mime:file.type||'application/octet-stream',size:file.size,sha256:digest,field_key:key}});
  await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',session.upload_url,true);xhr.setRequestHeader('content-type',file.type||'application/octet-stream');xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round((e.loaded/e.total)*100))};xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('UPLOAD_FAILED'));xhr.onerror=()=>reject(new Error('UPLOAD_FAILED'));xhr.send(file)});
  return {id:session.id,token:session.token,sha256:digest};
}
function restoreDraft(form,idForm){try{const d=JSON.parse(localStorage.getItem(`sfn_form_draft:${idForm}`)||'{}');for(const [k,v] of Object.entries(d)){const el=form.querySelector(`[data-key="${CSS.escape(k)}"]`);if(!el||el.type==='file')continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v}}catch{}}
function saveDraft(form,idForm){const d={};form.querySelectorAll('[data-key]').forEach(el=>{if(el.type==='file')return;d[el.dataset.key]=el.type==='checkbox'?el.checked:el.value});localStorage.setItem(`sfn_form_draft:${idForm}`,JSON.stringify(d))}
async function renderForm(idForm){
  document.body.classList.add("public-digital");
  app.innerHTML=`<div class="loading">Đang tải biểu mẫu…</div>`;
  try{
    const d=await api(`/api/forms/${encodeURIComponent(idForm)}`);state.currentForm=d;
    const c=d.form.config||{},presentation=c.presentation||"classic",multi=["multi-step","guided"].includes(presentation);
    const sections=c.sections||[];
    app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">Sky First · BIỂU MẪU SỐ</span><h1>${E(d.form.name)}</h1><p>${E(d.form.description||"Biểu mẫu số Sky First")}</p></section><div class="form-wrap digital-form-wrap"><a class="ghost" href="/bieu-mau">← Danh mục biểu mẫu</a><div class="card digital-form-card">
      <div class="form-meta"><span class="pill">${E(d.form.prefix)}</span> <span aria-hidden="true">•</span> <span>Phiên bản ${E(d.form.version)}</span> <span aria-hidden="true">•</span> <span>${presentation==="classic"?"Biểu mẫu tiêu chuẩn":presentation==="guided"?"Biểu mẫu hướng dẫn từng bước":"Biểu mẫu nhiều bước"}</span>${c.minor_mode?' <span aria-hidden="true">•</span> <span>Hỗ trợ người dưới 18 tuổi</span>':''}</div>
      ${(d.terms||[]).map(t=>`<details class="term"><summary>${E(t.name)} · ${E(t.version)}</summary><pre>${E(t.body)}</pre></details>`).join("")}
      ${multi?`<div class="form-stepper" id="formStepper">${sections.map((x,i)=>`<span data-step-dot="${i}" class="${i===0?'active':''}"><b>${i+1}</b><small>${E(x.title)}</small></span>`).join('')}</div>`:''}
      <form id="dynamicForm" novalidate>${sections.map((sec,i)=>`<section data-section="${i}" class="${multi&&i!==0?'step-hidden':''}"><div class="form-section-head"><span>${String(i+1).padStart(2,'0')}</span><div><h2>${E(sec.title)}</h2>${sec.description?`<p>${E(sec.description)}</p>`:''}</div></div>${(sec.fields||[]).map(f=>`<div data-field-wrap="${E(f.key)}">${fieldHtml(f)}</div>`).join("")}</section>`).join("")}
      <div id="turnstileSlot"></div><div class="actions form-navigation">${multi?'<button class="secondary" id="prevStep" type="button" disabled>← Quay lại</button><button class="primary" id="nextStep" type="button">Tiếp tục →</button>':''}<button class="primary ${multi?'hidden':''}" id="submitFormBtn" type="submit">Gửi hồ sơ</button><a class="secondary" href="/bieu-mau">Hủy</a></div></form>
    </div></div>`;
    const form=document.getElementById("dynamicForm");let currentStep=0;
    restoreDraft(form,idForm);initFilePreviews(form);initSignaturePads(form);applyConditions(c);
    form.addEventListener("input",()=>{applyConditions(c);saveDraft(form,idForm)});form.addEventListener("change",()=>{applyConditions(c);saveDraft(form,idForm)});
    if(state.config.turnstile_site_key) await mountTurnstile();
    const showStep=i=>{currentStep=Math.max(0,Math.min(sections.length-1,i));form.querySelectorAll('[data-section]').forEach((sec,n)=>sec.classList.toggle('step-hidden',multi&&n!==currentStep));document.querySelectorAll('[data-step-dot]').forEach((dot,n)=>{dot.classList.toggle('active',n===currentStep);dot.classList.toggle('done',n<currentStep)});const prev=document.getElementById('prevStep'),next=document.getElementById('nextStep'),submit=document.getElementById('submitFormBtn');if(prev)prev.disabled=currentStep===0;if(next)next.classList.toggle('hidden',currentStep===sections.length-1);if(submit)submit.classList.toggle('hidden',currentStep!==sections.length-1);applyConditions(c);window.scrollTo({top:Math.max(0,form.getBoundingClientRect().top+scrollY-105),behavior:'smooth'})};
    if(multi){document.getElementById('prevStep').onclick=()=>showStep(currentStep-1);document.getElementById('nextStep').onclick=()=>showStep(currentStep+1)}
    form.addEventListener("submit",async e=>{
      e.preventDefault();const {answers,files,firstBad}=collectFormValues(form,c,true);
      form.querySelector('#formErrorSummary')?.remove();
      if(firstBad){
        if(multi){const sec=firstBad.el?.closest?.('[data-section]');if(sec)showStep(Number(sec.dataset.section))}
        const summary=document.createElement('div');summary.id='formErrorSummary';summary.className='form-error-summary';summary.setAttribute('role','alert');summary.setAttribute('tabindex','-1');summary.innerHTML=`<b>Vui lòng kiểm tra biểu mẫu</b><p>Trường “${E(firstBad.label)}” cần được hoàn thành trước khi gửi.</p>`;form.prepend(summary);
        firstBad.el?.setAttribute?.('aria-invalid','true');firstBad.el?.closest?.('.field,.check,.signature-field')?.classList.add('field-error');summary.focus();setTimeout(()=>firstBad.el?.focus?.(),0);return
      }
      if(c.review_before_submit!==false&&form.dataset.reviewConfirmed!=='1'){
        form.querySelector('#formReviewPanel')?.remove();
        const labels={},fieldTypes={};for(const sec of c.sections||[])for(const f of sec.fields||[]){labels[f.key]=f.label||f.key;fieldTypes[f.key]=f.type;}
        const sigPreviews={};
        for(const [k,v] of Object.entries(answers)){
          if(fieldTypes[k]==='signature'){
            if(v==='uploaded'&&files[k]) sigPreviews[k]=URL.createObjectURL(files[k]);
            else if(v==='drawn'){
              const cv=form.querySelector(`[data-signature-canvas="${CSS.escape(k)}"]`);
              if(cv){const b=await signatureBlob(cv);if(b)sigPreviews[k]=URL.createObjectURL(b);}
            }
          }
        }
        const rows=Object.entries(answers).filter(([,v])=>v!==''&&v!==false&&v!=null).map(([k,v])=>{
          if(sigPreviews[k]) return `<div><dt>${E(labels[k]||k)}</dt><dd><img src="${E(sigPreviews[k])}" alt="Xem lại chữ ký" style="max-height:96px;border:1px solid #dbe4f0;border-radius:8px;background:#fff;padding:4px;"></dd></div>`;
          return `<div><dt>${E(labels[k]||k)}</dt><dd>${E(v===true?'Đã xác nhận':String(v))}</dd></div>`;
        }).join('');
        const panel=document.createElement('section');panel.id='formReviewPanel';panel.className='form-review-panel';panel.setAttribute('aria-labelledby','reviewTitle');panel.innerHTML=`<span class="hero-eyebrow">REVIEW BEFORE SUBMIT</span><h2 id="reviewTitle">Kiểm tra lần cuối</h2><p>Xem lại thông tin và ảnh chữ ký trước khi hồ sơ được tiếp nhận. Tệp và chữ ký đã chọn sẽ được tải lên và xác thực lưu trữ trước khi hoàn tất.</p><dl>${rows||'<div><dt>Thông tin</dt><dd>Đã sẵn sàng</dd></div>'}</dl><div class="actions"><button type="button" class="primary" id="confirmFinalSubmit">Xác nhận & gửi hồ sơ →</button><button type="button" class="secondary" id="editBeforeSubmit">Quay lại chỉnh sửa</button></div>`;
        form.querySelector('.form-navigation')?.before(panel);panel.scrollIntoView({behavior:'smooth',block:'center'});
        panel.querySelector('#confirmFinalSubmit').onclick=()=>{form.dataset.reviewConfirmed='1';form.requestSubmit()};panel.querySelector('#editBeforeSubmit').onclick=()=>{panel.remove();delete form.dataset.reviewConfirmed};return
      }
      delete form.dataset.reviewConfirmed;form.querySelector('#formReviewPanel')?.remove();
      const uploadFiles={...files};
      for(const canvas of form.querySelectorAll('[data-signature-canvas][data-signed="1"]')){const key=canvas.dataset.signatureCanvas;if(uploadFiles[key])continue;const blob=await signatureBlob(canvas);if(blob)uploadFiles[key]=new File([blob],`${key}-signature.png`,{type:'image/png'})}
      const btn=document.getElementById('submitFormBtn');btn.disabled=true;btn.textContent="Đang chuẩn bị tệp…";
      try{
        const uploads={};
        for(const [key,file] of Object.entries(uploadFiles)){uploads[key]=await uploadWithSession(file,key,pct=>{btn.textContent=`Đang tải ${E(file.name||key)} · ${pct}%`})}
        btn.textContent='Đang tiếp nhận hồ sơ…';
        const r=await api(`/api/forms/${encodeURIComponent(idForm)}/submit`,{method:"POST",body:{answers,uploads,turnstile_token:state.turnstileToken}});
        localStorage.removeItem(`sfn_form_draft:${idForm}`);
        form.innerHTML=`<article class="digital-receipt"><div class="receipt-check">✓</div><span>HỒ SƠ ĐÃ ĐƯỢC TIẾP NHẬN</span><h2>${E(r.code)}</h2><dl><div><dt>Thời gian</dt><dd>${fmt(r.received_at)}</dd></div><div><dt>Loại</dt><dd>${E(r.form_name||d.form.name)}</dd></div><div><dt>Trạng thái</dt><dd>${E(r.status||'Đã tiếp nhận')}</dd></div><div><dt>Bước tiếp theo</dt><dd>${E(r.next_action||'Theo dõi hồ sơ')}</dd></div></dl><p>${r.email_sent?"Biên nhận cũng đã được gửi đến email đăng ký.":"Hồ sơ đã được lưu. Email xác nhận có thể được xử lý riêng."}</p><div class="actions"><a class="primary" href="${E(r.tracking_url||`/ho-so?code=${encodeURIComponent(r.code)}`)}">Theo dõi hồ sơ →</a><a class="secondary" href="/">Về Trang chủ Hệ thống</a></div></article>`;
        fetch('/api/public/analytics',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event:'form_complete',category:idForm,route:'/bieu-mau'})}).catch(()=>{});
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
  const d=await api("/api/public/classes");app.innerHTML=`<h1>Lớp học & Chương trình giáo dục</h1>${d.degraded?`<div class="notice">Dữ liệu lớp học đang tạm thời chưa đồng bộ. Website vẫn hoạt động và bạn có thể quay lại sau.</div>`:""}<div class="grid">${(d.items||[]).map(c=>`<div class="card"><span class="pill">${E(c.unit_code)}</span><h3>${E(c.title)}</h3><p>${E(c.level||"")}</p><span class="status">${E(c.status)}</span><div class="actions"><a class="primary" href="#form/class">Đăng ký</a></div></div>`).join("")||"<div class='card'>Chưa có lớp học được công bố.</div>"}</div>`;
}
async function renderEvents(){
  const d=await api("/api/public/events");app.innerHTML=`<h1>Hoạt động & Sự kiện</h1>${d.degraded?`<div class="notice">Dữ liệu sự kiện đang tạm thời chưa đồng bộ. Các khu vực công khai khác vẫn sử dụng bình thường.</div>`:""}<div class="grid">${(d.items||[]).map(x=>`<div class="card"><span class="pill">${E(x.unit_code)}</span><h3>${E(x.title)}</h3><p class="muted">${fmt(x.start_at)}</p><span class="status">${E(x.status)}</span><div class="actions"><a class="primary" href="#form/event">Đăng ký</a></div></div>`).join("")||"<div class='card'>Chưa có sự kiện được công bố.</div>"}</div>`;
}
async function renderUnits(){
  const d=await api("/api/public/units");app.innerHTML=`<h1>Đơn vị trực thuộc</h1>${d.degraded?`<div class="notice">Danh sách đơn vị đang tạm thời chưa đồng bộ.</div>`:""}<div class="grid">${(d.items||[]).map(u=>`<div class="card"><span class="pill">${E(u.code)}</span><h3>${E(u.name)}</h3><p>${E(u.unit_type||"")}</p><p class="muted">Phụ trách: ${E(u.manager_name||"—")}<br>${E(u.email||"")}</p><span class="status">${E(u.status)}</span></div>`).join("")||"<div class='card'>Chưa có đơn vị được công bố.</div>"}</div>`;
}
async function renderNews(){
  const d=await api("/api/public/news");app.innerHTML=`<h1>Tin tức & Cập nhật</h1>${d.degraded?`<div class="notice">Tin tức đang tạm thời chưa đồng bộ với cơ sở dữ liệu.</div>`:""}<div class="grid">${(d.items||[]).map(newsCard).join("")||"<div class='card'>Chưa có tin mới.</div>"}</div>`;
}

function renderLookup(){
  const submissionStatusText=status=>({
    "Đã tiếp nhận":"Đã tiếp nhận",
    "Đang xem xét":"Đang xem xét",
    "Cần bổ sung":"Cần bổ sung thông tin",
    "Mời phỏng vấn":"Mời phỏng vấn",
    "Đang đánh giá":"Đang đánh giá",
    "Đã duyệt":"Đã duyệt",
    "Không phù hợp":"Không phù hợp",
    "Hoàn tất":"Hoàn tất"
  }[status]||status||"—");

  app.innerHTML=`
    <section class="verify-page">
      <div class="verify-head"><div><span class="eyebrow">Sky First</span><h1>Tra cứu & Xác thực</h1><p>Tra cứu tình trạng hồ sơ hoặc xác thực GCN/GXN do Sky First phát hành.</p></div><div class="verify-seal" aria-hidden="true">✓</div></div>
      <div class="verify-grid">
        <div class="verify-card record-card"><div class="verify-card-head"><span class="verify-icon">⌕</span><div><h2>Tra cứu hồ sơ</h2><p>Kiểm tra tình trạng hồ sơ và thông tin đăng ký của bạn.</p></div><span class="trust-pill">Nhanh chóng · Chính xác</span></div>
          <form id="lookupRecord"><div class="field"><label>Mã hồ sơ</label><input name="code" required autocomplete="off" placeholder="Nhập mã hồ sơ (VD: SFN-TNV-2026-0001)"></div><div class="field"><label>Email đã đăng ký</label><input name="email" type="email" required autocomplete="email" placeholder="Nhập email bạn đã sử dụng khi đăng ký"></div><button class="primary verify-btn">⌕ &nbsp; Tra cứu hồ sơ →</button></form><div id="recordResult"></div>
        </div>
        <div class="verify-card cert-card"><div class="verify-card-head"><span class="verify-icon green">✓</span><div><h2>Xác thực GCN/GXN</h2><p>Kiểm tra tính hợp lệ của Giấy chứng nhận hoặc Giấy xác nhận.</p></div><span class="trust-pill green">Minh bạch · Chính thống</span></div>
          <form id="lookupCert"><div class="field"><label>Mã GCN/GXN</label><input name="code" required autocomplete="off" placeholder="Nhập mã GCN/GXN (VD: 001/GCN-SFN/2026)"></div><button class="primary verify-btn verify-green">✓ &nbsp; Xác thực →</button></form><div id="certResult"></div>
        </div>
      </div>
      <div class="verify-benefits"><div><b>◷ &nbsp; Nhanh chóng</b><span>Tra cứu trong vài giây</span></div><div><b>♢ &nbsp; Chính xác</b><span>Dữ liệu được xác thực</span></div><div><b>▣ &nbsp; Bảo mật</b><span>Thông tin được bảo vệ</span></div><div><b>♡ &nbsp; Vì cộng đồng</b><span>Lan tỏa giá trị tích cực</span></div></div>
    </section>`;

  document.getElementById("lookupRecord").onsubmit=async e=>{
    e.preventDefault();

    const form=e.target;
    const f=new FormData(form);
    const result=document.getElementById("recordResult");
    const button=form.querySelector("button");

    button.disabled=true;
    button.textContent="Đang tra cứu…";
    result.innerHTML="";

    try{
      const d=await api(
        `/api/lookup/submission?code=${encodeURIComponent(f.get("code"))}&email=${encodeURIComponent(f.get("email"))}`
      );

      const r=d.item||{};

      result.innerHTML=`
        <div class="notice good" style="margin-top:18px">
          <div class="small muted">MÃ HỒ SƠ</div>
          <h2 style="margin:4px 0 16px">${E(r.code||"—")}</h2>

          ${r.full_name?`
            <p>
              <span class="muted">Người đăng ký</span><br>
              <b>${E(r.full_name)}</b>
            </p>
          `:""}

          <p>
            <span class="muted">Biểu mẫu</span><br>
            <b>${E(r.form_name||r.form_id||"—")}</b>
          </p>

          <p>
            <span class="muted">Trạng thái hồ sơ</span><br>
            <span class="status">${E(submissionStatusText(r.status))}</span>
          </p>

          <p>
            <span class="muted">Thời điểm tiếp nhận</span><br>
            ${E(fmt(r.submitted_at))}
          </p>

          <p>
            <span class="muted">Cập nhật gần nhất</span><br>
            ${E(fmt(r.updated_at))}
          </p>
        </div>
      `;
        }catch(err){
      result.innerHTML=`
        <div class="notice bad" style="margin-top:18px">
          ${E(
            err?.data?.message||
            "Không tìm thấy hồ sơ khớp với thông tin đã nhập."
          )}
        </div>
      `;
    }finally{
      button.disabled=false;
      button.textContent="Tra cứu hồ sơ";
    }
  };

  document.getElementById("lookupCert").onsubmit=async e=>{
    e.preventDefault();

    const form=e.target;
    const f=new FormData(form);
    const result=document.getElementById("certResult");
    const button=form.querySelector("button");

    button.disabled=true;
    button.textContent="Đang xác thực…";
    result.innerHTML="";

    try{
      const d=await api(
        `/api/lookup/certificate?code=${encodeURIComponent(f.get("code"))}`
      );

      const c=d.item||{};

      result.innerHTML=`
        <div class="notice good" style="margin-top:18px">

          <div class="small muted">MÃ GCN/GXN</div>
          <h2 style="margin:4px 0 6px">${E(c.code||"—")}</h2>

          <div style="margin-bottom:18px">
            <span class="status">${E(c.status_text||c.status||"—")}</span>
          </div>

          <p>
            <span class="muted">Loại văn bản</span><br>
            <b>${E(c.type||"—")}</b>
          </p>

          <p>
            <span class="muted">Người được cấp</span><br>
            <b>${E(c.full_name||"—")}</b>
          </p>

          ${c.unit_name?`
            <p>
              <span class="muted">Đơn vị ghi nhận</span><br>
              <b>${E(c.unit_name)}</b>
            </p>
          `:""}

          ${c.program?`
            <p>
              <span class="muted">Chương trình / Hoạt động</span><br>
              ${E(c.program)}
            </p>
          `:""}

          ${c.role?`
            <p>
              <span class="muted">Vai trò / Nội dung tham gia</span><br>
              ${E(c.role)}
            </p>
          `:""}

          ${c.content?`
            <p>
              <span class="muted">Nội dung được ghi nhận</span><br>
              ${E(c.content)}
            </p>
          `:""}

          <p>
            <span class="muted">Ngày cấp</span><br>
            ${E(fmt(c.issued_at))}
          </p>

          ${c.file_url?`
            <div class="actions">
              <a
                class="secondary"
                href="${E(c.file_url)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Xem GCN/GXN
              </a>
            </div>
          `:""}

        </div>
      `;
    }catch(err){
      result.innerHTML=`
        <div class="notice bad" style="margin-top:18px">
          ${E(
            err?.data?.message||
            "Không tìm thấy GCN/GXN với mã đã nhập."
          )}
        </div>
      `;
    }finally{
      button.disabled=false;
      button.textContent="Xác thực";
    }
  };

  const auto=new URLSearchParams(location.search).get("cert_lookup");

  if(auto){
    const input=document.querySelector('#lookupCert [name="code"]');
    if(input){
      input.value=auto;
      document.getElementById("lookupCert").requestSubmit();
    }
  }
}

function renderLogin(){
  document.body.classList.remove('public-digital');document.body.classList.add('admin-mode');
  app.innerHTML=`<section class="admin-login-page" aria-label="Đăng nhập quản trị">
    <div class="admin-login-shell">
      <aside class="admin-login-brand-panel">
        <a class="admin-login-brand" href="/" aria-label="Quay về trang chủ Sky First"><img src="/assets/sfn-logo-tight.png" alt="Sky First"><span><b>Sky First</b><small>Hệ thống Thông tin Số</small></span></a>
        <div class="admin-login-brand-copy"><span class="admin-login-eyebrow">KHÔNG GIAN QUẢN TRỊ</span><h2>Vận hành hệ thống<br>một cách có kiểm soát.</h2><p>Khu vực dành riêng cho quản trị viên và nhân sự được phân quyền.</p></div>
        <div class="admin-login-line-art" aria-hidden="true"><svg viewBox="0 0 520 250" focusable="false"><defs><linearGradient id="loginLineBlue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6fdcff"/><stop offset="1" stop-color="#1477ed"/></linearGradient></defs><path d="M0 180 C70 132 112 225 182 166 S298 96 355 158 S450 202 520 132" fill="none" stroke="url(#loginLineBlue)" stroke-width="2" opacity=".9"/><path d="M0 210 C70 162 112 255 182 196 S298 126 355 188 S450 232 520 162" fill="none" stroke="#55c9ff" stroke-width="1" opacity=".45"/><g fill="#8be8ff"><circle cx="55" cy="158" r="3"/><circle cx="182" cy="166" r="4"/><circle cx="355" cy="158" r="3"/><circle cx="450" cy="182" r="4"/></g><g transform="translate(222 30)"><rect x="0" y="0" width="118" height="146" rx="14" fill="#ffffff" fill-opacity=".96"/><rect x="12" y="12" width="94" height="122" rx="8" fill="none" stroke="#c5e5ff"/><path d="M36 45h48M36 59h48M36 73h34" stroke="#2e87e5" stroke-width="5" stroke-linecap="round"/><path d="M59 90l23 0M48 106l34 0" stroke="#88bdf0" stroke-width="4" stroke-linecap="round"/><circle cx="59" cy="25" r="5" fill="#0b72da"/></g></svg></div>
        <div class="admin-login-brand-foot"><span>Sky First Digital Information System</span><span>Truy cập có xác thực</span></div>
      </aside>
      <div class="admin-login-form-panel">
        <span class="admin-login-pill"><span aria-hidden="true">▣</span> KHU VỰC QUẢN TRỊ</span>
        <h1>${E((state.config?.cms_system_pages?.["/admin/login"]?.title)||"Đăng nhập Hệ thống Thông tin Số Sky First")}</h1>
        <p class="admin-login-intro">${E((state.config?.cms_system_pages?.["/admin/login"]?.summary)||"Đăng nhập bằng tài khoản được cấp quyền để tiếp tục đến khu vực quản trị.")}</p>
        <form id="loginForm" class="admin-login-form">
          <div class="field"><label for="loginEmail">Email tài khoản</label><div class="admin-login-input-wrap"><span aria-hidden="true">@</span><input id="loginEmail" name="email" type="email" placeholder="Nhập email tài khoản" autocomplete="username" required></div></div>
          <div class="field"><label for="loginPass">Mật khẩu</label><div class="admin-login-input-wrap"><span aria-hidden="true">⌑</span><input id="loginPass" name="password" type="password" placeholder="Nhập mật khẩu" autocomplete="current-password" required><button class="admin-login-password-toggle" id="loginPassToggle" type="button" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></div></div>
          <button class="admin-login-submit" type="submit"><span>Đăng nhập hệ thống</span><span aria-hidden="true">→</span></button>
        </form>
        ${state.config.google_oauth?`<div class="admin-login-divider"><span>hoặc</span></div><button class="admin-login-google" type="button" onclick="googleLogin('admin')">Đăng nhập bằng Google</button>`:""}
        <div class="admin-login-links"><button class="ghost" type="button" onclick="showForgot()">Quên mật khẩu?</button><a href="/">← Về Trang chủ Hệ thống</a></div>
        <p class="admin-login-security-note">Không chia sẻ mật khẩu hoặc mã xác thực với bất kỳ ai.</p>
      </div>
    </div>
  </section>`;
  const pass=document.getElementById('loginPass'),toggle=document.getElementById('loginPassToggle');
  if(pass&&toggle)toggle.onclick=()=>{const showing=pass.type==='text';pass.type=showing?'password':'text';toggle.textContent=showing?'Hiện':'Ẩn';toggle.setAttribute('aria-pressed',String(!showing));toggle.setAttribute('aria-label',showing?'Hiện mật khẩu':'Ẩn mật khẩu');};
  document.getElementById("loginForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target);const submit=e.currentTarget.querySelector('button[type="submit"]');
    if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');submit.dataset.label=submit.innerHTML;submit.innerHTML='<span>Đang xác thực…</span><span aria-hidden="true">…</span>';}
    try{const d=await api("/api/auth/login",{method:"POST",body:{email:f.get("email"),password:f.get("password"),portal:"admin"}});if(d.needs_2fa)return show2FA(d.challenge);state.user=d.user;if(accountBtn)accountBtn.textContent=state.user.full_name||state.user.email;if(d.must_change_password)return forcePasswordChange(f.get("password"));if(location.pathname==="/admin/login")history.replaceState(null,"","/admin#admin/dashboard");location.hash="admin/dashboard";await router();}catch(err){toast(errorText(err),"bad")}finally{if(submit&&document.body.classList.contains('admin-mode')){submit.disabled=false;submit.removeAttribute('aria-busy');if(submit.dataset.label)submit.innerHTML=submit.dataset.label;}}
  };
}
window.showForgot=function(){
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">AN TOÀN TÀI KHOẢN QUẢN TRỊ</span><h2>Hỗ trợ đặt lại mật khẩu</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <div class="notice" style="margin-bottom:14px;">
    <b>Quy trình bảo mật:</b> Để bảo vệ hệ thống quản trị, việc đặt lại mật khẩu được thực hiện thông qua xác minh của <b>Quản trị viên hệ thống</b> thay vì gửi liên kết tự động không kiểm soát.<br>
    • Email hỗ trợ kỹ thuật: <a href="mailto:support@skyfirst.io.vn"><b>support@skyfirst.io.vn</b></a><br>
    • Hotline hỗ trợ: <a href="tel:0924910210"><b>0924 910 210</b></a>
  </div>
  <form id="forgotPwForm">
    <div class="field"><label for="forgotEmailInput">Email tài khoản quản trị cần hỗ trợ *</label><input id="forgotEmailInput" name="email" type="email" required placeholder="Nhập email tài khoản quản trị" autocomplete="email"></div>
    <div class="field"><label for="forgotNoteInput">Thông tin xác minh / Ghi chú gửi Quản trị viên</label><textarea id="forgotNoteInput" name="note" rows="3" placeholder="Nêu rõ họ tên, đơn vị hoặc nội dung cần hỗ trợ..."></textarea></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button><button type="submit" class="primary" id="forgotSubmitBtn">Gửi yêu cầu hỗ trợ</button></div>
  </form>`);
  document.getElementById("forgotPwForm").onsubmit=async e=>{
    e.preventDefault();
    const email=document.getElementById("forgotEmailInput").value.trim();
    const note=document.getElementById("forgotNoteInput").value.trim();
    const btn=document.getElementById("forgotSubmitBtn");
    btn.disabled=true;btn.textContent="Đang gửi…";
    try{
      const r=await api("/api/auth/forgot",{method:"POST",body:{email,note}});
      closeModal();
      toast(r.message||"Đã ghi nhận yêu cầu hỗ trợ đặt lại mật khẩu. Vui lòng liên hệ Quản trị viên qua support@skyfirst.io.vn hoặc 0924 910 210.");
    }catch(err){
      toast(errorText(err),"bad");
      btn.disabled=false;btn.textContent="Gửi yêu cầu hỗ trợ";
    }
  };
};

function show2FA(challenge){
  modal(`<h2>Xác minh 2 bước</h2><form id="twofaForm"><div class="field"><label>Mã 6 số từ ứng dụng xác thực</label><input name="code" inputmode="numeric" maxlength="6" required></div><button class="primary">Xác minh</button></form>`);

  document.getElementById("twofaForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    try{
      const d=await api("/api/auth/login-2fa",{
        method:"POST",
        body:{
          challenge,
          code:f.get("code")
        }
      });

      closeModal();
      state.user=d.user;

      if(d.must_change_password)return forcePasswordChange("");

      const nextHash2fa=isAdmin(state.user)?"admin/dashboard":"portal";
      if(location.pathname==="/admin/login")history.replaceState(null,"",`/admin#${nextHash2fa}`);
      location.hash=nextHash2fa;
      await router();
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
}

function forcePasswordChange(currentPassword=""){
  modal(`<h2>Đổi mật khẩu lần đầu</h2><div class="notice warn">Tài khoản này phải đổi mật khẩu trước khi tiếp tục.</div>
  <form id="changeFirst"><div class="field"><label>Mật khẩu hiện tại</label><input name="current_password" type="password" value="${E(currentPassword)}" required></div><div class="field"><label>Mật khẩu mới (ít nhất 10 ký tự)</label><input name="new_password" type="password" minlength="10" required></div><button class="primary">Đổi mật khẩu</button></form>`);

  document.getElementById("changeFirst").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    try{
      const chgRes=await api("/api/auth/change-password",{
        method:"POST",
        body:Object.fromEntries(f)
      });
      if(chgRes?.user)state.user=chgRes.user;
      else if(state.user)state.user.must_change_password=0;

      closeModal();
      toast("Đã đổi mật khẩu.");
      const nextHash=isAdmin(state.user)?"admin/dashboard":"portal";
      if(location.pathname==="/admin/login")history.replaceState(null,"",`/admin#${nextHash}`);
      location.hash=nextHash;
      await router();
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
}

async function logout(){
  await api("/api/auth/logout",{method:"POST"}).catch(()=>{});
  state.user=null;
  if(accountBtn)accountBtn.textContent="Đăng nhập";
  location.hash="home";
}

window.logout=logout;

async function renderPortal(){
  if(!state.user){
    location.hash="login";
    return;
  }

  const d=await api("/api/me/portal");
  const member=isMember(state.user);

  const menu=[
    ["overview","Tổng quan"],
    ["records","Hồ sơ đăng ký"],
    ["classes","Lớp học"],
    ["events","Sự kiện"],
    ["certs","GCN/GXN"],
    ["notifications","Thông báo"],
    ...(member?[
      ["profile","Hồ sơ thành viên"],
      ["requests","Yêu cầu nội bộ"],
      ["privacy","Quyền riêng tư"]
    ]:[]),
    ["security","Bảo mật tài khoản"]
  ];

  const route=(location.hash.split("/")[1]||"overview");

  app.innerHTML=`<div class="dashboard"><aside class="sidebar">${menu.map(m=>`<button class="${route===m[0]?"active":""}" onclick="location.hash='portal/${m[0]}'">${m[1]}</button>`).join("")}<button onclick="logout()">↩ Đăng xuất</button></aside><div id="portalMain"></div></div>`;

  const main=document.getElementById("portalMain");

  if(route==="overview"){
    main.innerHTML=`<h1>Hồ sơ của tôi</h1><div class="kpis"><div class="kpi"><b>${d.records.length}</b>Hồ sơ</div><div class="kpi"><b>${d.classes.length}</b>Lớp học</div><div class="kpi"><b>${d.certificates.length}</b>GCN/GXN</div><div class="kpi"><b>${d.notifications.filter(n=>!n.read_at).length}</b>Thông báo mới</div></div>${d.person?`<div class="card" style="margin-top:14px"><h3>${E(d.person.full_name)}</h3><p>${E(d.person.position||"")} • ${E(d.person.unit_code||"SFN")}</p><span class="status">${E(d.person.status)}</span></div>`:""}`;
  }

  if(route==="records"){
    main.innerHTML=listCards(
      "Hồ sơ đăng ký",
      d.records,
      r=>`<b>${E(r.code)}</b> — ${E(r.form_id)} <span class="status">${E(r.status)}</span><br><span class="small muted">${fmt(r.created_at)}</span>`
    );
  }

  if(route==="classes"){
    main.innerHTML=listCards(
      "Lớp học của tôi",
      d.classes,
      r=>`<b>${E(r.title)}</b> — ${E(r.status)}<br><span class="small muted">${E(r.class_status)}</span>`
    );
  }

  if(route==="events"){
    main.innerHTML=listCards(
      "Sự kiện của tôi",
      d.events,
      r=>`<b>${E(r.title)}</b> — ${E(r.status)}<br><span class="small muted">${fmt(r.start_at)}</span>`
    );
  }

  if(route==="certs"){
    main.innerHTML=listCards(
      "GCN/GXN của tôi",
      d.certificates,
      r=>`<b>${E(r.code||"Đang chờ cấp số")}</b> — ${E(r.cert_type)}<br>${E(r.content)}<br><span class="status">${E(r.status)}</span>`
    );
  }

  if(route==="notifications"){
    main.innerHTML=
      listCards(
        "Thông báo",
        d.notifications,
        r=>`<b>${E(r.title)}</b><br>${E(r.body||"")}<br><span class="small muted">${fmt(r.created_at)}</span>`
      )+
      `<button class="secondary" onclick="markAllRead()">Đánh dấu tất cả đã đọc</button>`;
  }

  if(route==="profile"){
    main.innerHTML=`<h1>Hồ sơ thành viên</h1>${d.person?`<div class="card"><h2>${E(d.person.full_name)}</h2><p>Email: ${E(d.person.email||state.user.email)}</p><p>Đơn vị: ${E(d.person.unit_code||"SFN")}</p><p>Chức danh/Vai trò: ${E(d.person.position||"")}</p><p>Ngày gia nhập: ${E(d.person.joined_at||"")}</p><span class="status">${E(d.person.status)}</span></div>`:`<div class="notice warn">Tài khoản đã đăng nhập nhưng chưa có hồ sơ nhân sự điện tử liên kết.</div>`}`;
  }

  if(route==="requests"){
    main.innerHTML=`<h1>Yêu cầu & Thủ tục nội bộ</h1><div class="grid">${["Cập nhật thông tin nhân sự","Điều chuyển vị trí/đơn vị","Tạm ngừng hoạt động","Thôi nhiệm vụ/rút khỏi SFN","Đề nghị xác nhận quá trình tham gia","Đề nghị GCN/GXN","Bàn giao nhiệm vụ"].map(x=>`<button class="role-card" onclick="internalRequest('${E(x)}')"><b>${E(x)}</b></button>`).join("")}</div><h2 class="section-title">Lịch sử yêu cầu</h2>${listCards("",d.internal_requests,r=>`<b>${E(r.code)}</b> — ${E(r.request_type)} <span class="status">${E(r.status)}</span>`)}`;
  }

  if(route==="privacy"){
    main.innerHTML=`<h1>Trung tâm Quyền riêng tư</h1><div class="card"><p>Bạn có thể yêu cầu cập nhật, đính chính, xuất hoặc xem xét xóa dữ liệu cá nhân.</p><div class="actions">${["Cập nhật dữ liệu","Đính chính dữ liệu","Yêu cầu xuất dữ liệu cá nhân","Yêu cầu xem xét xóa dữ liệu"].map(x=>`<button class="secondary" onclick="privacyRequest('${E(x)}')">${E(x)}</button>`).join("")}</div></div>`;
  }

  if(route==="security"){
    renderSecurity(main);
  }
}

function listCards(title,items,renderer){
  return `${title?`<h1>${E(title)}</h1>`:""}${items?.length?items.map(x=>`<div class="card" style="margin:9px 0">${renderer(x)}</div>`).join(""):`<div class="notice">Chưa có dữ liệu.</div>`}`;
}

window.markAllRead=async()=>{
  await api("/api/me/notifications/read",{method:"POST",body:{}});
  toast("Đã đánh dấu đã đọc.");
  renderPortal();
};

window.internalRequest=type=>{
  modal(`<h2>${E(type)}</h2><form id="reqForm"><div class="field"><label>Nội dung</label><textarea name="content" required></textarea></div><button class="primary">Gửi yêu cầu</button></form>`);

  document.getElementById("reqForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    try{
      const d=await api("/api/me/internal-requests",{
        method:"POST",
        body:{
          request_type:type,
          content:f.get("content")
        }
      });

      closeModal();
      toast("Đã gửi: "+d.code);
      location.hash="portal/requests";
      renderPortal();
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
};

window.privacyRequest=async type=>{
  const note=await adminPrompt("Ghi chú thêm (không bắt buộc):","",{title:"Yêu cầu quyền riêng tư",type:"textarea",required:false});
  if(note===null)return;
  api("/api/me/data-requests",{method:"POST",body:{request_type:type,note}})
    .then(()=>toast("Đã tiếp nhận yêu cầu."))
    .catch(e=>toast(errorText(e),"bad"));
};

async function renderSecurity(main){
  let sessions=[];

  try{
    sessions=(await api("/api/me/sessions")).sessions||[];
  }catch{}

  main.innerHTML=`<h1>Bảo mật tài khoản</h1><div class="grid2">
  <div class="card"><h2>Đổi mật khẩu</h2><form id="changePw"><div class="field"><label>Mật khẩu hiện tại</label><input name="current_password" type="password" required></div><div class="field"><label>Mật khẩu mới</label><input name="new_password" type="password" minlength="10" required></div><button class="primary">Đổi mật khẩu</button></form></div>
  <div class="card"><h2>Xác minh 2 bước (2FA)</h2><p>Trạng thái: <b>${state.user.totp_enabled?"Đang bật":"Chưa bật"}</b></p>${state.user.totp_enabled?`<button class="danger" onclick="disable2fa()">Tắt 2FA</button>`:`<button class="primary" onclick="setup2fa()">Thiết lập 2FA</button>`}</div></div>
  <h2 class="section-title">Phiên đăng nhập</h2><div class="card">${sessions.map(s=>`<p><b>${E((s.user_agent||"Thiết bị").slice(0,120))}</b><br><span class="small muted">Hoạt động: ${fmt(s.last_seen_at)} • Hết hạn: ${fmt(s.expires_at)}</span></p>`).join("")}<button class="danger" onclick="revokeAllSessions()">Đăng xuất tất cả thiết bị</button></div>`;

  document.getElementById("changePw").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    try{
      await api("/api/auth/change-password",{
        method:"POST",
        body:Object.fromEntries(f)
      });
      toast("Đã đổi mật khẩu.");
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
}

window.setup2fa=async()=>{
  try{
    const d=await api("/api/me/2fa/setup",{method:"POST"});

    modal(`<h2>Thiết lập 2FA</h2><p>Thêm tài khoản trong ứng dụng xác thực bằng secret:</p><pre class="card">${E(d.secret)}</pre><p class="small muted">URI: ${E(d.otpauth_uri)}</p><form id="enable2fa"><div class="field"><label>Nhập mã 6 số hiện tại</label><input name="code" required maxlength="6"></div><button class="primary">Bật 2FA</button></form>`);

    document.getElementById("enable2fa").onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target);

      try{
        await api("/api/me/2fa/enable",{
          method:"POST",
          body:{code:f.get("code")}
        });

        closeModal();
        await loadMe();
        toast("Đã bật 2FA.");
        renderPortal();
      }catch(err){
        toast(errorText(err),"bad");
      }
    };
  }catch(err){
    toast(errorText(err),"bad");
  }
};

window.disable2fa=async()=>{
  const pw=await adminPrompt("Mật khẩu hiện tại","",{title:"Tắt xác minh hai bước",type:"password",required:true,description:"Nhập mật khẩu để xác nhận thao tác bảo mật."});
  if(pw===null||!pw)return;
  api("/api/me/2fa/disable",{method:"POST",body:{password:pw}})
    .then(async()=>{await loadMe();toast("Đã tắt 2FA.");renderPortal();})
    .catch(e=>toast(errorText(e),"bad"));
};

window.revokeAllSessions=()=>api("/api/me/sessions/revoke-all",{
  method:"POST"
})
.then(()=>{
  state.user=null;
  location.hash="login";
})
.catch(e=>toast(errorText(e),"bad"));

if(!window.__cttAdminHotkeysInstalled){
  window.__cttAdminHotkeysInstalled=true;
  window.addEventListener("keydown",e=>{
    if(!document.body.classList.contains("admin-mode"))return;
    const active=document.activeElement;
    const editing=active&&(active.matches?.("input,textarea,select,[contenteditable=true]")||active.isContentEditable);
    if(e.key==="/"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!editing){const input=document.getElementById("adminMenuSearch");if(input){e.preventDefault();input.focus();}}
    if(e.key==="Escape"){const layout=document.getElementById("adminLayout");if(layout?.classList.contains("nav-open")){layout.classList.remove("nav-open");document.getElementById("adminMenuToggle")?.setAttribute("aria-expanded","false");}}
  });
}

const adminMenu=[
 {group:"TỔNG QUAN",items:[
  ["dashboard","Tổng quan hệ thống","dashboard.view"],["home-stats","5 Chỉ số trang chủ","settings.manage"],["approvals","Trung tâm phê duyệt","approval.view"],["search","Tìm kiếm nội bộ","search.use"]
 ]},
 {group:"QUẢN TRỊ NỘI DUNG & ĐA WEBSITE",items:[
  ["page-builder","Trình dựng trang trực quan","cms.view"],["websites","Quản trị đa Website (7 cổng)","website.view"],["news","Tin tức & Thông báo","news.manage"],["site","Nhận diện & Hệ thống thiết kế","settings.manage"],["header","Thanh điều hướng & Menu","settings.manage"],["footer","Chân trang & Hệ sinh thái","settings.manage"],["media","Thư viện tài nguyên & Kiểm toán","file.manage"]
 ]},
 {group:"CHƯƠNG TRÌNH, SỰ KIỆN & TÀI TRỢ",items:[
  ["classes","Chương trình & Lớp học","class.manage"],["events","Sự kiện & Hoạt động","event.manage"],["sponsorship","Minh bạch Tài trợ & VietQR","sponsorship.view"],["units","Đơn vị & Đối tác","unit.view"],["people","Hồ sơ nhân sự","people.view"],["tasks","Nhiệm vụ & Bàn giao","task.manage"]
 ]},
 {group:"BIỂU MẪU & HỒ SƠ",items:[
  ["forms","Quản lý & Dựng Biểu mẫu","form.view"],["submissions","Tiếp nhận & Xử lý hồ sơ","submission.view"],["recruitment","Tuyển dụng & Đánh giá","submission.view"],["terms","Điều khoản & Chính sách","form.view"]
 ]},
 {group:"CHỨNG NHẬN & THƯ VIỆN PDF",items:[
  ["certificates","Chứng nhận (GCN/GXN/BK)","certificate.view"],["documents","Thư viện PDF & Tài liệu","document.view"],["files","Kho tệp & Minh chứng","file.manage"]
 ]},
 {group:"AN TOÀN, EMAIL & HỆ THỐNG",items:[
  ["email","Trung tâm Email tự động","email.view"],["safety","Báo cáo An toàn số","safety.view"],["tickets","Phiếu hỗ trợ","ticket.manage"],["users","Tài khoản & Phân quyền","user.view"],["privacy","Yêu cầu Quyền riêng tư","privacy.manage"],["audit","Nhật ký kiểm toán","audit.view"],["backup","Sao lưu & Phục hồi","backup.create"],["maintenance","Chế độ vận hành & Bảo trì","settings.manage"],["modules","Quản lý Phân hệ","module.manage"],["settings","Cài đặt hệ thống","settings.manage"]
 ]}
];

const adminRoutePermissions={
 dashboard:"dashboard.view","home-stats":"settings.manage",approvals:"approval.view",search:"search.use",
 "page-builder":"cms.view",websites:"website.view",site:"settings.manage",header:"settings.manage",news:"news.manage",footer:"settings.manage",media:"file.manage",
 classes:"class.manage",events:"event.manage",sponsorship:"sponsorship.view",units:"unit.view",people:"people.view",tasks:"task.manage",tickets:"ticket.manage",
 forms:"form.view",submissions:"submission.view",recruitment:"submission.view",terms:"form.view",
 certificates:"certificate.view",documents:"document.view",files:"file.manage",users:"user.view",email:"email.view",safety:"safety.view",
 privacy:"privacy.manage",audit:"audit.view",backup:"backup.create",maintenance:"settings.manage",modules:"module.manage",settings:"settings.manage"
};
function adminCan(permission){
  if(!permission||!state.user)return true;
  const permissions=state.user.permissions;
  if(!Array.isArray(permissions))return false;
  return permissions.includes("*")||permissions.includes(permission);
}
function getCollapsedAdminGroups(){
  try{return JSON.parse(sessionStorage.getItem("sfn_admin_collapsed_groups")||"[]");}catch{return [];}
}
function setCollapsedAdminGroups(list){
  try{sessionStorage.setItem("sfn_admin_collapsed_groups",JSON.stringify(list));}catch{}
}
function adminMenuMarkup(section){
  const collapsedSet=new Set(getCollapsedAdminGroups());
  return adminMenu.map((group,index)=>{
    const items=group.items.filter(item=>adminCan(item[2]));
    if(!items.length)return "";
    const isCollapsed=collapsedSet.has(index);
    return `<section class="admin-nav-group ${isCollapsed?"is-collapsed":""}" data-admin-group="${index}"><button type="button" class="admin-nav-group-title" data-admin-group-toggle="${index}" aria-expanded="${!isCollapsed}"><span>${E(group.group)}</span><b aria-hidden="true">⌄</b></button><div class="admin-nav-items">${items.map(item=>`<button type="button" class="admin-nav-item ${section===item[0]?"active":""}" data-admin-route="${E(item[0])}" data-admin-label="${E(item[1].toLocaleLowerCase("vi"))}" ${section===item[0]?'aria-current="page"':""}><span class="admin-nav-dot" aria-hidden="true"></span><span>${E(item[1])}</span>${section===item[0]?'<i aria-hidden="true">●</i>':""}</button>`).join("")}</div></section>`;
  }).join("");
}

async function renderAdmin(){
  document.body.classList.add("admin-mode");document.body.classList.remove("public-digital");
  if(!state.user||!isAdmin(state.user)){location.hash="login";return;}
  const pathSec=location.pathname.startsWith("/admin/")?location.pathname.slice("/admin/".length).replace(/\/+$/,""):"";
  const section=(pathSec&&pathSec!=="login"?pathSec:location.hash.split("/")[1])||"dashboard";
  const requiredPermission=adminRoutePermissions[section];
  const currentTitle=adminMenu.flatMap(g=>g.items).find(x=>x[0]===section)?.[1]||"Quản trị hệ thống";

  let layout=document.getElementById("adminLayout");
  const existingNav=layout?.querySelector(".admin-nav");
  if(existingNav){
    try{sessionStorage.setItem("sfn_admin_nav_scroll_top",String(existingNav.scrollTop||0));}catch{}
  }

  if(!layout){
    const curLang=localStorage.getItem("sfn_lang")||"vi";
    app.innerHTML=`<div class="admin-layout" id="adminLayout">
      <aside class="admin-sidebar" id="adminSidebar" aria-label="Danh mục quản trị">
        <div class="admin-brand"><img src="/assets/sfn-logo-tight.png" alt="Logo Sky First"><div><b>Sky First</b><small>TRUNG TÂM QUẢN TRỊ</small></div></div>
        <label class="admin-menu-search"><span aria-hidden="true">⌕</span><input type="search" id="adminMenuSearch" placeholder="Tìm chức năng…" aria-label="Tìm chức năng quản trị"><kbd>/</kbd></label>
        <nav class="admin-nav" id="adminSidebarNav" aria-label="Menu quản trị">${adminMenuMarkup(section)}</nav>
        <div class="admin-sidebar-foot"><span class="admin-online-dot"></span><span>Hệ thống quản trị</span><a href="/" target="_blank" rel="noopener">Xem website ↗</a></div>
      </aside>
      <section class="admin-workspace">
        <header class="admin-topbar"><div class="admin-topbar-left"><button type="button" id="adminMenuToggle" class="admin-mobile-menu" aria-controls="adminSidebar" aria-expanded="false">☰ <span>Danh mục</span></button><div><span class="admin-topbar-kicker">Hệ thống Thông tin Số Sky First · Quản trị</span><b id="adminCurrentLabel">${E(currentTitle)}</b></div></div><div class="admin-topbar-actions"><button type="button" class="secondary" id="adminLangSwitch" title="Chuyển ngôn ngữ hiển thị cổng công khai">🌐 ${curLang.toUpperCase()}</button><span class="admin-user-chip"><i>${E((state.user.full_name||state.user.email||"A").slice(0,1).toUpperCase())}</i><span><b>${E(state.user.full_name||"Quản trị viên")}</b><small>${E(state.user.email||"")}</small></span></span><a href="/" class="admin-view-site" target="_blank" rel="noopener">Xem website ↗</a><button type="button" id="adminLogout" class="admin-logout">Đăng xuất</button></div></header>
        <section id="adminMain" class="admin-main"><div class="loading">Đang tải dữ liệu quản trị…</div></section>
      </section>
    </div>`;
    layout=document.getElementById("adminLayout");
    const navEl=document.getElementById("adminSidebarNav");
    navEl?.addEventListener("scroll",()=>{
      try{sessionStorage.setItem("sfn_admin_nav_scroll_top",String(navEl.scrollTop||0));}catch{}
    },{passive:true});
    document.querySelectorAll("[data-admin-route]").forEach(btn=>btn.addEventListener("click",()=>{
      const targetRoute=btn.dataset.adminRoute;
      if(navEl){try{sessionStorage.setItem("sfn_admin_nav_scroll_top",String(navEl.scrollTop||0));}catch{}}
      layout?.classList.remove("nav-open");
      if(location.hash===`#admin/${targetRoute}`)return;
      location.hash=`admin/${targetRoute}`;
    }));
    document.querySelectorAll("[data-admin-group-toggle]").forEach(btn=>btn.addEventListener("click",()=>{
      const group=btn.closest(".admin-nav-group"),collapsed=group?.classList.toggle("is-collapsed");
      btn.setAttribute("aria-expanded",String(!collapsed));
      const idx=Number(btn.dataset.adminGroupToggle);
      const current=new Set(getCollapsedAdminGroups());
      if(collapsed)current.add(idx);else current.delete(idx);
      setCollapsedAdminGroups([...current]);
    }));
    const searchInput=document.getElementById("adminMenuSearch");
    searchInput?.addEventListener("keydown",e=>{
      if(e.key==="Escape"){e.currentTarget.value="";e.currentTarget.dispatchEvent(new Event("input",{bubbles:true}));e.currentTarget.blur();}
    });
    searchInput?.addEventListener("input",e=>{
      const q=e.currentTarget.value.trim().toLocaleLowerCase("vi");
      try{sessionStorage.setItem("sfn_admin_menu_search",q);}catch{}
      document.querySelectorAll(".admin-nav-group").forEach(group=>{
        let visible=0;
        group.querySelectorAll("[data-admin-route]").forEach(item=>{const yes=!q||(item.textContent||"").toLocaleLowerCase("vi").includes(q)||(group.querySelector(".admin-nav-group-title")?.textContent||"").toLocaleLowerCase("vi").includes(q);item.hidden=!yes;if(yes)visible++;});
        group.hidden=visible===0;
        if(q&&visible){group.classList.remove("is-collapsed");group.querySelector(".admin-nav-group-title")?.setAttribute("aria-expanded","true");}
      });
    });
    try{
      const savedQ=sessionStorage.getItem("sfn_admin_menu_search")||"";
      if(savedQ&&searchInput){searchInput.value=savedQ;searchInput.dispatchEvent(new Event("input"));}
      const savedNavTop=Number(sessionStorage.getItem("sfn_admin_nav_scroll_top")||0);
      if(navEl&&savedNavTop>0)navEl.scrollTop=savedNavTop;
    }catch{}
    document.getElementById("adminMenuToggle")?.addEventListener("click",e=>{
      const open=layout?.classList.toggle("nav-open");e.currentTarget.setAttribute("aria-expanded",String(!!open));
    });
    document.getElementById("adminLangSwitch")?.addEventListener("click",e=>{
      const next=(localStorage.getItem("sfn_lang")||"vi")==="vi"?"en":"vi";
      localStorage.setItem("sfn_lang",next);
      window.SkyFirstDigital?.setLang?.(next);
      e.currentTarget.textContent=`🌐 ${next.toUpperCase()}`;
      toast(`Đã chuyển ngôn ngữ hiển thị cổng công khai sang ${next.toUpperCase()}.`);
    });
    document.getElementById("adminLogout")?.addEventListener("click",logout);
  }else{
    const labelEl=document.getElementById("adminCurrentLabel");
    if(labelEl)labelEl.textContent=currentTitle;
    layout.querySelectorAll("[data-admin-route]").forEach(btn=>{
      const active=btn.dataset.adminRoute===section;
      btn.classList.toggle("active",active);
      if(active)btn.setAttribute("aria-current","page");else btn.removeAttribute("aria-current");
      const dot=btn.querySelector("i");
      if(active&&!dot)btn.insertAdjacentHTML("beforeend",'<i aria-hidden="true">●</i>');
      else if(!active&&dot)dot.remove();
    });
    const navEl=document.getElementById("adminSidebarNav");
    try{
      const savedNavTop=Number(sessionStorage.getItem("sfn_admin_nav_scroll_top")||0);
      if(navEl&&savedNavTop>=0)navEl.scrollTop=savedNavTop;
    }catch{}
  }

  const main=document.getElementById("adminMain");
  if(requiredPermission&&!adminCan(requiredPermission)){
    main.innerHTML=`<section class="admin-access-denied"><span>403 · KHÔNG ĐỦ QUYỀN</span><h1>Chức năng giới hạn quyền truy cập</h1><p>Tài khoản của bà chưa được cấp quyền cần thiết cho khu vực này. Dữ liệu vẫn được bảo vệ bởi kiểm tra quyền ở máy chủ.</p><a class="primary" href="#admin/dashboard">Quay về Tổng quan</a></section>`;return;
  }
  try{
    if(section==="dashboard")return await adminDashboard(main);
    if(section==="home-stats")return await adminHomeStats(main);
    if(section==="approvals")return await adminApprovals(main);
    if(section==="submissions")return await adminSubmissions(main);
    if(section==="users")return await adminUsers(main);
    if(section==="people")return await adminPeople(main);
    if(section==="recruitment")return await adminRecruitment(main);
    if(section==="forms")return await adminForms(main);
    if(section==="terms")return await adminTerms(main);
    if(section==="classes")return await adminGeneric(main,"classes","Chương trình & Lớp học",["unit_code","title","level","status","capacity"]);
    if(section==="events")return await adminGeneric(main,"events","Hoạt động & Sự kiện",["unit_code","title","start_at","end_at","status","capacity"]);
    if(section==="page-builder")return await adminPageBuilder(main);
    if(section==="websites")return await adminWebsites(main);
    if(section==="sponsorship")return await adminSponsorship(main);
    if(section==="safety")return await adminSafety(main);
    if(section==="documents")return await adminDocumentsLibrary(main);
    if(section==="units")return await adminGeneric(main,"units","Đơn vị trực thuộc",["code","name","unit_type","manager_name","email","status"]);
    if(section==="news")return await adminNews(main);
    if(section==="tasks")return await adminGeneric(main,"tasks","Nhiệm vụ & Bàn giao",["title","description","assigned_to","unit_code","status","priority","due_at"]);
    if(section==="certificates")return await adminCertificates(main);
    if(section==="tickets")return await adminTickets(main);
    if(section==="privacy")return await adminPrivacy(main);
    if(section==="files")return await adminFiles(main);
    if(section==="email")return await adminEmail(main);
    if(section==="site")return await adminSite(main);
    if(section==="header")return await adminHeader(main);
    if(section==="footer")return await adminFooter(main);
    if(section==="maintenance")return await adminMaintenance(main);
    if(section==="media")return await adminMedia(main);
    if(section==="modules")return await adminModules(main);
    if(section==="settings")return await adminSettings(main);
    if(section==="search")return await adminSearch(main);
    if(section==="audit")return await adminAudit(main);
    if(section==="backup")return await adminBackup(main);
    main.innerHTML=`<div class="admin-access-denied"><h1>Không tìm thấy mục quản trị</h1><p>Đường dẫn này chưa được cấu hình.</p><a class="primary" href="#admin/dashboard">Về Tổng quan</a></div>`;
  }catch(err){
    console.error("ADMIN_ROUTE_ERROR",section,err);
    main.innerHTML=`<div class="notice bad admin-error"><b>Không thể tải mục quản trị.</b><p>${E(errorText(err))}</p><button type="button" class="secondary" id="adminRetry">Thử tải lại</button><a href="#admin/dashboard" class="admin-error-link">Về Tổng quan</a></div>`;
    document.getElementById("adminRetry")?.addEventListener("click",()=>renderAdmin());
  }
}

async function adminDashboard(main){
  const health=await api("/api/health").catch(()=>({ok:false,database:false,storage:false}));
  let c={submissions:0,pending:0,approved_submissions:0,rejected_submissions:0,forms:0,people:0,certificates:0,revoked_certificates:0,superseded_certificates:0,documents:0,published_documents:0,cms_pages:0,published_pages:0,approvals:0,tickets:0,tasks:0,safety_open:0};
  let emailBreakdown={sent:0,pending:0,failed:0,provider_configured:false};
  let recentAudit=[],warnings=[],timeSeries=[];
  let dataOk=false;
  try{
    const d=await api("/api/admin/dashboard");
    c={...c,...(d.counts||{})};
    emailBreakdown={...emailBreakdown,...(d.email_breakdown||{})};
    recentAudit=d.recent_audit||[];
    warnings=d.warnings||[];
    timeSeries=d.time_series||[];
    dataOk=true;
  }catch(err){console.error("ADMIN_DASHBOARD_DATA",err)}

  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">TRUNG TÂM ĐIỀU HÀNH & QUẢN TRỊ HỆ THỐNG</span><h1>Tổng quan Hệ thống Thông tin Số Sky First</h1><p class="muted">Số liệu thời gian thực từ cơ sở dữ liệu D1, tình trạng tài liệu, chứng nhận, email tự động và nhật ký hoạt động gần đây.</p></div><span class="system-pill ${health.ok?"ok":"warn"}">${health.ok?"● Hệ thống đang hoạt động":"● Cần kiểm tra hệ thống"}</span></div>
  <div class="system-status-grid">
    <div class="status-card"><span>Ứng dụng Worker</span><b>${health.ok?"Hoạt động":"Gián đoạn"}</b></div>
    <div class="status-card"><span>Cơ sở dữ liệu D1</span><b>${health.database?"Đã kết nối":"Không khả dụng"}</b></div>
    <div class="status-card"><span>Lưu trữ R2</span><b>${health.storage?"Đã kết nối":"Không khả dụng"}</b></div>
    <div class="status-card"><span>Dịch vụ Email</span><b>${emailBreakdown.provider_configured?"Đã cấu hình":"Chờ cấu hình khóa"}</b></div>
  </div>
  ${warnings.length?`<div style="display:grid;gap:8px;margin:14px 0;">${warnings.map(w=>`<div class="notice ${w.level==='bad'?'bad':w.level==='warn'?'warn':''}"><b>Cảnh báo hệ thống (${E(w.code)}):</b> ${E(w.message)}</div>`).join("")}</div>`:""}
  <div class="kpis">
    <div class="kpi"><b>${E(c.submissions)}</b>Tổng số hồ sơ (${E(c.forms)} biểu mẫu)</div>
    <div class="kpi"><b>${E(c.pending)}</b>Hồ sơ mới & đang xử lý</div>
    <div class="kpi"><b>${E(c.approved_submissions)}</b>Hồ sơ đã duyệt / hoàn tất</div>
    <div class="kpi"><b>${E(c.certificates)}</b>Chứng nhận có hiệu lực (${E(c.revoked_certificates)} thu hồi)</div>
    <div class="kpi"><b>${E(c.published_documents)} / ${E(c.documents)}</b>Tài liệu PDF công bố</div>
    <div class="kpi"><b>${E(c.published_pages)} / ${E(c.cms_pages)}</b>Trang CMS xuất bản</div>
    <div class="kpi"><b>${E(c.approvals)}</b>Yêu cầu chờ phê duyệt</div>
    <div class="kpi"><b>${E(c.tickets)}</b>Phiếu hỗ trợ (${E(c.safety_open)} an toàn)</div>
  </div>
  <div class="admin-quick-grid">
    <button class="admin-quick" onclick="location.hash='admin/submissions'">${lineIcon("users")}<b>Xử lý hồ sơ & Biểu mẫu</b><span>Tiếp nhận, phân công và phê duyệt hồ sơ</span></button>
    <button class="admin-quick" onclick="location.hash='admin/page-builder'">${lineIcon("spark")}<b>Trình dựng trang & Nội dung</b><span>Quản trị nội dung động và xuất bản trang</span></button>
    <button class="admin-quick" onclick="location.hash='admin/documents'">${lineIcon("book")}<b>Thư viện PDF & Tài liệu</b><span>Quản lý phiên bản, quyền tải và vòng đời</span></button>
    <button class="admin-quick" onclick="location.hash='admin/certificates'">${lineIcon("badge")}<b>Chứng nhận (GCN/GXN/BK)</b><span>Đề nghị, duyệt hai bước, phát hành & thu hồi</span></button>
  </div>
  <div class="admin-grid2" style="margin-top:18px;">
    <section class="card">
      <span class="eyebrow">TRẠNG THÁI GỬI EMAIL TỰ ĐỘNG</span>
      <h2>Thống kê Trung tâm Email (email_universal_auto.html)</h2>
      <div class="kpis" style="margin-top:10px;">
        <div class="kpi"><b>${E(emailBreakdown.sent)}</b>Đã gửi tới nhà cung cấp</div>
        <div class="kpi"><b>${E(emailBreakdown.pending)}</b>Chờ cấu hình dịch vụ gửi</div>
        <div class="kpi"><b>${E(emailBreakdown.failed)}</b>Gửi thất bại</div>
      </div>
      <div class="actions" style="margin-top:12px;"><button type="button" class="secondary" onclick="location.hash='admin/email'">Mở Trung tâm Email tự động →</button></div>
    </section>
    <section class="card">
      <span class="eyebrow">THỐNG KÊ THEO THỜI GIAN</span>
      <h2>Lượng hồ sơ tiếp nhận theo ngày</h2>
      ${timeSeries.length?`<div class="table-scroll" style="margin-top:10px;"><table><thead><tr><th>Ngày</th><th>Số lượng hồ sơ tiếp nhận</th></tr></thead><tbody>${timeSeries.map(t=>`<tr><td><b>${E(t.day)}</b></td><td><b>${E(t.c)}</b> hồ sơ</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted" style="margin-top:10px;">Chưa có dữ liệu hồ sơ theo chuỗi thời gian. Khi có hồ sơ gửi lên hệ thống, thống kê theo ngày sẽ tự động hiển thị tại đây.</p>`}
    </section>
  </div>
  <section class="card" style="margin-top:18px;">
    <div class="toolbar"><div style="margin-right:auto"><span class="eyebrow">NHẬT KÝ HOẠT ĐỘNG GẦN ĐÂY</span><h2 style="margin:4px 0 0">Hoạt động quản trị & xác thực mới nhất</h2></div><button type="button" class="secondary" onclick="location.hash='admin/audit'">Xem toàn bộ Nhật ký kiểm toán →</button></div>
    <div class="table-scroll"><table><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>
      ${recentAudit.map(a=>`<tr><td>${fmt(a.created_at)}</td><td><b>${E(a.actor_email||"Hệ thống")}</b></td><td>${E(a.action)}</td><td><code>${E(a.entity_type||"")} ${E(a.entity_id||"")}</code></td></tr>`).join("")||`<tr><td colspan="4" class="muted">Chưa có hoạt động quản trị nào được ghi nhận.</td></tr>`}
    </tbody></table></div>
  </section>`;
}


async function adminHomeStats(main){
  const [settings,config]=await Promise.all([loadSettingsMap(),api("/api/config")]);
  const stored=settings.home_stats||{},cfg=config.home_stats||{};
  const defaults={
    source:"d1",
    values:{programs:0,members:0,certificates:0,partners:0,sponsorship:0},
    labels:{programs:"Chương trình & sự kiện",members:"Thành viên cộng đồng",certificates:"Chứng nhận đã phát hành",partners:"Đối tác & đơn vị đồng hành",sponsorship:"Tổng tiền tài trợ (thực nhận)"},
    duration_ms:1200,cycles:1
  };
  const stats={...defaults,...stored,values:{...defaults.values,...(stored.values||{})},labels:{...defaults.labels,...(stored.labels||{})}};
  const d1=cfg.d1_values||{};
  const hasD1=key=>Object.prototype.hasOwnProperty.call(d1,key)&&d1[key]!==null&&d1[key]!==undefined&&String(d1[key]).trim()!==""&&Number.isFinite(Number(d1[key]))&&Number(d1[key])>=0;
  const rows=[
    ["programs","Chương trình & sự kiện"],
    ["members","Thành viên cộng đồng"],
    ["certificates","Chứng nhận đã phát hành"],
    ["partners","Đối tác & đơn vị đồng hành"],
    ["sponsorship","Tổng tiền tài trợ (thực nhận)"]
  ];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">QUẢN LÝ TRANG CHỦ</span><h1>Thống kê trang chủ</h1><p class="muted">Quản lý năm chỉ số vận hành trên trang chủ (Chương trình & sự kiện, Thành viên cộng đồng, Chứng nhận đã phát hành, Đối tác & đơn vị đồng hành, Tổng tiền tài trợ thực nhận). Chế độ Tự động lấy số liệu thực tế từ cơ sở dữ liệu hệ thống; chế độ Thủ công dùng giá trị do quản trị viên phê duyệt.</p></div><span class="system-pill ${stats.source==="d1"?"ok":"warn"}">${stats.source==="d1"?"Nguồn: Cơ sở dữ liệu":"Nguồn: Thủ công"}</span></div>
    <form id="homeStatsForm" class="admin-stat-manager">
      <section class="card admin-card-premium"><div class="admin-card-heading"><div><span class="eyebrow">01 / NGUỒN DỮ LIỆU</span><h2>Chọn cách lấy số liệu</h2></div><span class="admin-status-tag">Được lưu trong Cài đặt</span></div><div class="field"><label for="hsSource">Nguồn thống kê</label><select id="hsSource" name="source"><option value="d1" ${stats.source==="d1"?"selected":""}>Tự động tính từ cơ sở dữ liệu hệ thống</option><option value="manual" ${stats.source==="manual"?"selected":""}>Dùng số do quản trị viên nhập</option></select></div><p class="muted admin-help-text">Số liệu tự động chỉ đọc từ nguồn nghiệp vụ có thẩm quyền, không làm thay đổi dữ liệu gốc. Khi chọn thủ công, bốn ô giá trị bên dưới sẽ được sử dụng.</p></section>
      <section class="card admin-card-premium"><div class="admin-card-heading"><div><span class="eyebrow">02 / BẢNG THỐNG KÊ</span><h2>Nhãn và giá trị từng thẻ</h2></div><span class="admin-status-tag">5 chỉ số đang cấu hình</span></div><div class="table-scroll"><table class="admin-stats-table"><thead><tr><th>Thẻ</th><th>Nhãn công khai</th><th>Giá trị thủ công</th><th>Số liệu thực tế trong hệ thống</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(([key,defaultLabel],i)=>`<tr><td><span class="admin-stat-key">0${i+1}</span><b>${E(defaultLabel)}</b><small>${E(key)}</small></td><td><input type="text" class="admin-stat-label" name="label_${key}" maxlength="80" required value="${E(stats.labels[key]||defaultLabel)}" aria-label="Nhãn ${E(defaultLabel)}"></td><td><input type="number" class="admin-stat-value" name="value_${key}" min="0" step="1" required value="${E(stats.values[key]??0)}" aria-label="Giá trị thủ công ${E(defaultLabel)}"></td><td><strong class="admin-d1-value">${hasD1(key)?E(new Intl.NumberFormat("vi-VN").format(Number(d1[key]))):"Chưa có dữ liệu"}</strong><small>${hasD1(key)?"Đồng bộ từ cơ sở dữ liệu":"Kiểm tra kết nối / dữ liệu"}</small></td><td><span class="status ${hasD1(key)?"":"status-warn"}">${hasD1(key)?"Có dữ liệu":"Chưa xác định"}</span></td></tr>`).join("")}</tbody></table></div><div class="admin-stat-preview"><span class="eyebrow">XEM NHANH</span><div class="admin-stat-preview-grid">${rows.map(([key,defaultLabel],i)=>`<article class="admin-stat-preview-card stat-tone-${i+1}"><i>${["▤","♧","✓","↗","♡"][i]}</i><div><b data-hs-preview-value="${key}">${stats.source==="d1"?(hasD1(key)?E(new Intl.NumberFormat("vi-VN").format(Number(d1[key]))):"Chưa có dữ liệu"):(stats.values[key]!==null&&stats.values[key]!==undefined&&String(stats.values[key]).trim()!==""&&Number.isFinite(Number(stats.values[key]))?E(new Intl.NumberFormat("vi-VN").format(Number(stats.values[key]))):"Chưa có dữ liệu")}</b><span data-hs-preview-label="${key}">${E(stats.labels[key]||defaultLabel)}</span></div></article>`).join("")}</div></div></section>
      <section class="card admin-card-premium"><div class="admin-card-heading"><div><span class="eyebrow">03 / HIỆU ỨNG</span><h2>Hoạt ảnh đếm số</h2></div></div><div class="row2"><div class="field"><label for="hsDuration">Thời lượng mỗi lượt (giây)</label><input id="hsDuration" type="number" min="0.25" max="30" step="0.05" value="${E((Number(stats.duration_ms)||1800)/1000)}" required></div><div class="field"><label for="hsCycles">Số lượt chạy (1–100)</label><input id="hsCycles" type="number" min="1" max="100" step="1" value="${E(stats.cycles||100)}" required></div></div><p class="muted admin-help-text">Bộ đếm dừng ở giá trị đích sau số lượt đã chọn; không chạy vô hạn và không tạo truy vấn ghi lặp vào cơ sở dữ liệu.</p></section>
      <div class="admin-sticky-save"><span>Thay đổi chỉ áp dụng sau khi lưu.</span><button type="submit" class="primary" id="saveHomeStats">Lưu thống kê trang chủ</button></div>
    </form>`;
  const form=document.getElementById("homeStatsForm"),source=document.getElementById("hsSource");
  const updateMode=()=>{
    const manual=source.value==="manual";
    form.querySelectorAll(".admin-stat-value").forEach(input=>{input.disabled=!manual;input.setAttribute("aria-disabled",String(!manual));});
    document.querySelectorAll("[data-hs-preview-value]").forEach(el=>{
      const key=el.dataset.hsPreviewValue;
      const n=manual?form.elements[`value_${key}`].value:d1[key];
      el.textContent=n!==undefined&&n!==null&&String(n).trim()!==""&&Number.isFinite(Number(n))&&Number(n)>=0?new Intl.NumberFormat("vi-VN").format(Number(n)):"Chưa có dữ liệu";
    });
    document.querySelectorAll("[data-hs-preview-label]").forEach(el=>{const key=el.dataset.hsPreviewLabel;el.textContent=form.elements[`label_${key}`].value.trim()||rows.find(r=>r[0]===key)?.[1]||key;});
  };
  source.addEventListener("change",updateMode);
  form.querySelectorAll(".admin-stat-value,.admin-stat-label").forEach(el=>el.addEventListener("input",updateMode));
  updateMode();
  form.addEventListener("submit",async e=>{
    e.preventDefault();const btn=document.getElementById("saveHomeStats");
    const labels={},values={};
    for(const [key,defaultLabel] of rows){
      labels[key]=String(form.elements[`label_${key}`].value||"").trim();
      const n=Number(form.elements[`value_${key}`].value);
      if(!labels[key]||labels[key].length>80||!Number.isFinite(n)||n<0||!Number.isInteger(n)){toast(`Kiểm tra nhãn và giá trị của mục ${defaultLabel}.`,"bad");return;}
      values[key]=n;
    }
    const duration=Number(document.getElementById("hsDuration").value),cycles=Number(document.getElementById("hsCycles").value);
    if(!Number.isFinite(duration)||duration<.25||duration>30||!Number.isInteger(cycles)||cycles<1||cycles>100){toast("Thời lượng phải từ 0,25 đến 30 giây và số lượt từ 1 đến 100.","bad");return;}
    btn.disabled=true;btn.textContent="Đang lưu…";
    try{
      await api("/api/admin/settings",{method:"PUT",body:{items:{home_stats:{source:source.value==="d1"?"d1":"manual",values,labels,duration_ms:Math.round(duration*1000),cycles}}}});
      await loadConfig();toast("Đã lưu bảng thống kê trang chủ.");await adminHomeStats(main);
    }catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Lưu thống kê trang chủ";}
  });
}

async function adminSubmissions(main){
  const d=await api("/api/admin/submissions");
  state.admin.submissions=d.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Hồ sơ đăng ký</h1><button class="secondary" onclick="location.href='/api/admin/export/submissions.csv'">Xuất CSV</button></div>
  <div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Loại</th><th>Người gửi</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody>${state.admin.submissions.map(r=>`<tr><td><b>${E(r.code)}</b></td><td>${E(r.form_id)}</td><td>${E(r.full_name)}<br><span class="small">${E(r.email)}</span></td><td><span class="status">${E(r.status)}</span></td><td>${fmt(r.updated_at)}</td><td><button class="secondary" onclick="viewSubmission('${E(r.code)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.viewSubmission=async code=>{
  try{
    const d=await api(`/api/admin/submissions/${encodeURIComponent(code)}`);
    const r=d.item;

    modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>${E(r.code)}</h2><p>${E(r.full_name)} • ${E(r.email)}</p>
    <div class="row2">
      <div class="field"><label>Trạng thái xử lý</label><select id="subStatus">${["Đã tiếp nhận","Đang xem xét","Cần bổ sung","Mời phỏng vấn","Đang đánh giá","Đã duyệt","Không phù hợp","Hoàn tất"].map(s=>`<option ${s===r.status?"selected":""}>${E(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Điểm tổng hợp</label><input id="subScore" type="number" step="0.1" value="${E(r.score??"")}"></div>
    </div>
    <div class="field"><label>Lý do phê duyệt / từ chối / yêu cầu bổ sung (hiển thị trên tiến trình & email thông báo)</label><input id="subPublicNote" value="${E(r.result_summary||"")}" placeholder="Nhập tóm tắt kết quả hoặc nội dung yêu cầu bổ sung..."></div>
    <div class="field"><label>Hướng dẫn bước tiếp theo cho người nộp</label><input id="subNextAction" value="${E(r.next_action||"")}" placeholder="VD: Bổ sung minh chứng trước ngày... / Kiểm tra email lịch hẹn"></div>
    <div class="field"><label>Ghi chú nội bộ (chỉ quản trị viên xem, không trả về tra cứu công khai)</label><textarea id="subNote">${E(r.internal_note||"")}</textarea></div>
    <h3>Nội dung kê khai & Chữ ký xác nhận</h3>${Object.entries(r.answers||{}).map(([k,v])=>{
      if(v&&typeof v==="object"&&v.file_id){
        const isSig=v.signature_type==="electronic_image_confirmation"||v.signature_method;
        if(isSig){
          return `<div class="card" style="margin:6px 0;border-left:4px solid var(--blue)"><b>${E(k)} — Chữ ký xác nhận biểu mẫu (Hình ảnh chữ ký điện tử)</b><div class="small muted" style="margin:4px 0">Phương thức: <b>${v.signature_method==="uploaded_image"?"Tải ảnh chữ ký":"Vẽ chữ ký tay trực tiếp"}</b> · Người ký: <b>${E(v.signer_name||r.full_name||"—")}</b> · Thời điểm ký: <b>${fmt(v.signed_at||r.created_at)}</b> · Phiên bản biểu mẫu: <b>v${E(v.form_version||r.form_version||1)}</b> · SHA-256: <code>${E((v.sha256||"—").slice(0,24))}…</code></div><img src="/api/files/${encodeURIComponent(v.file_id)}" alt="Chữ ký xác nhận" style="max-height:110px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:6px;margin-top:6px;"><div class="small muted" style="margin-top:4px">Lưu ý nghiệp vụ: Đây là hình ảnh chữ ký xác nhận gắn với hồ sơ và mã băm toàn vẹn SHA-256 trên hệ thống, tách biệt với chữ ký số chuyên dụng (CA).</div></div>`;
        }
        return `<div class="card" style="margin:6px 0"><b>${E(k)} (Tệp đính kèm)</b><br><a href="/api/files/${encodeURIComponent(v.file_id)}" target="_blank">Mở tệp đính kèm (${E(v.file_id)}) ↗</a>${v.sha256?` · <small class="muted">SHA-256: <code>${E(v.sha256.slice(0,20))}…</code></small>`:""}</div>`;
      }
      return `<div class="card" style="margin:6px 0"><b>${E(k)}</b><br>${E(typeof v==="object"?JSON.stringify(v):v)}</div>`;
    }).join("")}
    <h3>Tệp</h3>${(d.files||[]).map(f=>`<p><a href="/api/files/${encodeURIComponent(f.id)}" target="_blank">${E(f.filename)}</a> (${Math.round((f.size||0)/1024)} KB)</p>`).join("")||"<p>Không có.</p>"}
    <div class="actions"><button class="primary" onclick="saveSubmission('${E(r.code)}')">Lưu xử lý</button><button class="secondary" onclick="scheduleInterview('${E(r.code)}')">Lịch phỏng vấn</button><button class="secondary" onclick="addEvaluation('${E(r.code)}')">Chấm đánh giá</button><button class="secondary" onclick="requestGenericApproval('submission','${E(r.code)}')">Gửi phê duyệt</button>${["member","core","volunteer"].includes(r.form_id)&&r.status==="Đã duyệt"?`<button class="secondary" onclick="convertPerson('${E(r.code)}')">Tiếp nhận thành nhân sự</button>`:""}</div>`);
  }catch(err){
    toast(errorText(err),"bad");
  }
};

window.saveSubmission=async code=>{
  try{
    await api(`/api/admin/submissions/${encodeURIComponent(code)}`,{
      method:"PATCH",
      body:{
        status:document.getElementById("subStatus").value,
        score:Number(document.getElementById("subScore").value)||null,
        note:document.getElementById("subPublicNote")?.value||"",
        result_summary:document.getElementById("subPublicNote")?.value||"",
        next_action:document.getElementById("subNextAction")?.value||"",
        internal_note:document.getElementById("subNote").value
      }
    });

    closeModal();
    toast("Đã lưu.");
    adminSubmissions(document.getElementById("adminMain"));
  }catch(e){
    toast(errorText(e),"bad");
  }
};

window.convertPerson=code=>api(`/api/admin/submissions/${encodeURIComponent(code)}/convert-person`,{
  method:"POST"
})
.then(d=>toast("Đã tạo hồ sơ nhân sự #"+d.person_id))
.catch(e=>toast(errorText(e),"bad"));

window.scheduleInterview=async code=>{
  const values=await adminDialog({title:"Lên lịch phỏng vấn",description:`Hồ sơ ${code} · thời gian theo giờ Việt Nam (UTC+7).`,confirmText:"Tạo lịch",fields:[
    {name:"at",label:"Thời gian phỏng vấn",type:"datetime-local",required:true},
    {name:"url",label:"Link Meet / Zoom (không bắt buộc)",type:"url",required:false,placeholder:"https://…"}
  ]});
  if(!values)return;
  api("/api/admin/interviews",{method:"POST",body:{submission_code:code,scheduled_at:`${values.at}:00+07:00`,meeting_url:values.url||""}})
    .then(()=>toast("Đã tạo lịch phỏng vấn."))
    .catch(e=>toast(errorText(e),"bad"));
};

window.addEvaluation=async code=>{
  const values=await adminDialog({title:"Chấm đánh giá hồ sơ",description:`Hồ sơ ${code}. Điểm tổng hợp từ 0 đến 100.`,confirmText:"Lưu đánh giá",fields:[
    {name:"score",label:"Điểm tổng hợp",type:"number",required:true,min:0,max:100,step:0.1},
    {name:"recommendation",label:"Khuyến nghị",type:"textarea",required:false,rows:3},
    {name:"note",label:"Ghi chú nội bộ",type:"textarea",required:false,rows:3}
  ]});
  if(!values)return;const score=Number(values.score);if(!Number.isFinite(score)||score<0||score>100){toast("Điểm phải nằm trong khoảng 0–100.","bad");return;}
  api("/api/admin/evaluations",{method:"POST",body:{submission_code:code,score:{total:score},recommendation:values.recommendation||"",note:values.note||""}})
    .then(()=>toast("Đã lưu đánh giá."))
    .catch(e=>toast(errorText(e),"bad"));
};

async function adminApprovals(main){
  const d=await api("/api/admin/approvals");

  main.innerHTML=`<h1>Trung tâm phê duyệt</h1><div class="card table-scroll"><table><thead><tr><th>Loại</th><th>Hành động</th><th>Trạng thái</th><th>Hạn</th><th></th></tr></thead><tbody>${(d.items||[]).map(a=>`<tr><td>${E(a.entity_type)}<br><span class="small">${E(a.entity_id)}</span></td><td>${E(a.action)}</td><td><span class="status">${E(a.status)}</span></td><td>${fmt(a.due_at)}</td><td>${a.status==="pending"?`<button class="primary" onclick="decideApproval('${E(a.id)}','approved')">Phê duyệt</button> <button class="danger" onclick="decideApproval('${E(a.id)}','rejected')">Từ chối</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}

window.decideApproval=async(id,status)=>{
  const note=await adminPrompt("Ghi chú quyết định (không bắt buộc)","",{title:status==="approved"?"Phê duyệt yêu cầu":"Từ chối yêu cầu",type:"textarea"});
  if(note===null)return;
  api(`/api/admin/approvals/${encodeURIComponent(id)}`,{method:"PATCH",body:{status,note}})
    .then(()=>{toast("Đã cập nhật phê duyệt.");adminApprovals(document.getElementById("adminMain"));})
    .catch(e=>toast(errorText(e),"bad"));
};

async function adminUsers(main){
  const d=await api("/api/admin/users");
  state.admin.users=d.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Quản trị viên & Phân quyền</h1><button class="primary" onclick="inviteUser()">+ Tạo tài khoản quản trị viên</button></div>
  <div class="card table-scroll"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Xác minh</th><th>2FA</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.users.map(u=>`<tr><td><b>${E(u.full_name||"")}</b><br>${E(u.email)}</td><td>${(u.roles||[]).map(r=>`<span class="badge-role">${E(r.role_id)}${r.scope_unit_code?` @ ${E(r.scope_unit_code)}`:""}</span>`).join("")}</td><td>${u.email_verified?"✓":"—"}</td><td>${u.totp_enabled?"✓":"—"}</td><td>${E(u.status)}</td><td><button class="secondary" onclick="editRoles(${u.id})">Quyền</button> <button class="ghost" onclick="resetUserPassword(${u.id},'${E(u.email)}')">Đặt lại MK</button> <button class="ghost" onclick="toggleUser(${u.id},'${E(u.status)}')">${u.status==="active"?"Khóa":"Mở khóa"}</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.inviteUser=()=>{
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Tạo tài khoản quản trị viên</h2><form id="inviteForm"><div class="field"><label>Họ và tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Vai trò ban đầu</label><select name="role"><option value="editor">Biên tập viên</option><option value="handler">Nhân sự xử lý hồ sơ</option><option value="unit_admin">Quản trị viên đơn vị trực thuộc</option><option value="communications">Ban Truyền thông</option><option value="external_events">Ban Đối ngoại & Sự kiện</option><option value="case_manager">Quản lý hồ sơ</option><option value="reviewer">Người duyệt</option><option value="certificate_manager">Quản lý giấy đã phát hành</option><option value="hr">Ban Nhân sự</option><option value="office">Văn phòng</option><option value="content_admin">Quản trị nội dung</option><option value="network_secretary">Tổng Thư ký Mạng lưới</option><option value="system_admin">Quản trị viên hệ thống</option><option value="super_admin">Quản trị viên cấp cao</option></select></div><div class="field"><label>Phạm vi đơn vị (nếu có)</label><input name="scope_unit_code" placeholder="Ví dụ: SFEC"></div><div class="field"><label>Cách kích hoạt</label><select name="activation_mode"><option value="email">Gửi email kích hoạt</option><option value="self">Tự kích hoạt</option></select></div><button class="primary">Tạo tài khoản</button></form>`);

  document.getElementById("inviteForm").onsubmit=async e=>{
    e.preventDefault();

    const f=new FormData(e.target);

    try{
      const d=await api("/api/admin/users",{
        method:"POST",
        body:{
          full_name:f.get("full_name"),
          email:f.get("email"),
          roles:[f.get("role")],
          scope_unit_code:f.get("scope_unit_code"),
          activation_mode:f.get("activation_mode")
        }
      });

      closeModal();

      modal(`<h2>Đã tạo tài khoản</h2><p><b>${E(f.get("email"))}</b></p>${d.activation_sent?`<div class="notice good">Đã gửi email kích hoạt. Tài khoản đang ở trạng thái Chưa kích hoạt.</div>`:`<div class="notice warn">Tài khoản đã được tự kích hoạt. Mật khẩu tạm thời chỉ hiển thị lần này.</div><pre class="card">${E(d.temp_password||"")}</pre>`}<button class="primary" onclick="closeModal()">Hoàn tất</button>`);
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
};

window.editRoles=idUser=>{
  const u=state.admin.users.find(x=>x.id===idUser);
  if(!u)return;

  const all=[
    "student",
    "member",
    "volunteer",
    "handler",
    "unit_admin",
    "communications",
    "external_events",
    "hr",
    "office",
    "network_secretary",
    "system_admin",
    "super_admin"
  ];

  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Phân quyền — ${E(u.full_name||u.email)}</h2><div id="roleChecks">${all.map(r=>`<div class="check"><input type="checkbox" data-role="${r}" ${(u.roles||[]).some(x=>x.role_id===r)?"checked":""}><label>${r}</label></div>`).join("")}</div><div class="field"><label>Phạm vi đơn vị áp dụng cho vai trò mới</label><input id="roleScope" placeholder="SFEC hoặc để trống"></div><button class="primary" onclick="saveRoles(${idUser})">Lưu quyền</button>`);
};

window.saveRoles=async idUser=>{
  const roles=[
    ...document.querySelectorAll("#roleChecks [data-role]:checked")
  ].map(x=>({
    role_id:x.dataset.role,
    scope_unit_code:document.getElementById("roleScope").value.trim()
  }));

  try{
    await api(`/api/admin/users/${idUser}/roles`,{
      method:"PUT",
      body:{roles}
    });

    closeModal();
    toast("Đã cập nhật quyền.");
    adminUsers(document.getElementById("adminMain"));
  }catch(e){
    toast(errorText(e),"bad");
  }
};

window.resetUserPassword=async(idUser,email)=>{
  if(!await adminConfirm(`Tạo mật khẩu tạm thời mới cho ${email}? Tất cả phiên đăng nhập hiện tại sẽ bị thu hồi.`,{title:"Đặt lại mật khẩu",confirmText:"Tạo mật khẩu tạm thời",danger:true}))return;

  try{
    const d=await api(`/api/admin/users/${idUser}/reset-password`,{
      method:"POST"
    });

    modal(`<h2>Mật khẩu tạm thời mới</h2><p>${E(email)}</p><pre class="card">${E(d.temp_password)}</pre><div class="notice warn">Mật khẩu này chỉ hiển thị lần này. Người dùng sẽ buộc đổi sau khi đăng nhập.</div><button class="primary" onclick="closeModal()">Đã lưu</button>`);
  }catch(e){
    toast(errorText(e),"bad");
  }
};

window.toggleUser=async(idUser,status)=>{
  try{
    await api(`/api/admin/users/${idUser}/status`,{
      method:"PATCH",
      body:{
        status:status==="active"?"locked":"active"
      }
    });

    toast("Đã cập nhật.");
    adminUsers(document.getElementById("adminMain"));
  }catch(e){
    toast(errorText(e),"bad");
  }
};

async function adminPeople(main){
  const d=await api("/api/admin/people");

  main.innerHTML=`<h1>Hồ sơ nhân sự điện tử</h1><div class="card table-scroll"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Đơn vị</th><th>Chức danh/Vai trò</th><th>Trạng thái</th><th>Gia nhập</th></tr></thead><tbody>${(d.items||[]).map(p=>`<tr><td><b>${E(p.full_name)}</b></td><td>${E(p.email||"")}</td><td>${E(p.unit_code||"")}</td><td>${E(p.position||"")}</td><td><span class="status">${E(p.status)}</span></td><td>${E(p.joined_at||"")}</td></tr>`).join("")}</tbody></table></div>`;
}
    async function adminRecruitment(main){
  main.innerHTML=`<h1>Tuyển dụng & Đánh giá</h1><div class="grid"><div class="card"><h3>Quy trình Core Team</h3><p>Tiếp nhận → Sàng lọc → Phỏng vấn → Đánh giá bổ sung → Thông báo → Tiếp nhận.</p><a class="primary" href="#admin/submissions">Mở hồ sơ</a></div><div class="card"><h3>Tuyển Tình nguyện viên</h3><p>Tiếp nhận hồ sơ đăng ký tình nguyện viên, phân loại theo ban chuyên môn và theo dõi đánh giá.</p><a class="primary" href="#admin/submissions">Mở hồ sơ TNV</a></div><div class="card"><h3>Chấm điểm & Phỏng vấn</h3><p>Mở một hồ sơ và dùng nút Lịch phỏng vấn / Chấm đánh giá.</p></div></div>`;
}

window.requestGenericApproval=async(entity_type,entity_id)=>{
  const values=await adminDialog({title:"Gửi yêu cầu phê duyệt",description:`Đối tượng: ${entity_type} · ${entity_id}`,confirmText:"Gửi phê duyệt",fields:[
    {name:"action",label:"Nội dung cần phê duyệt",value:"Phê duyệt hồ sơ/đề xuất",required:true},
    {name:"role",label:"Vai trò được giao phê duyệt",type:"select",value:"network_secretary",required:true,options:[{value:"network_secretary",label:"Thư ký mạng lưới"},{value:"system_admin",label:"Quản trị hệ thống"},{value:"content_admin",label:"Quản trị nội dung"},{value:"certificate_manager",label:"Quản lý chứng nhận"}]}
  ]});
  if(!values)return;
  api("/api/admin/approvals",{method:"POST",body:{entity_type,entity_id,action:values.action.trim(),assigned_role:values.role}})
    .then(()=>toast("Đã chuyển vào Trung tâm phê duyệt."))
    .catch(e=>toast(errorText(e),"bad"));
};

async function adminTerms(main){
  const d=await api("/api/admin/terms");
  state.admin.terms=d.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">QUẢN LÝ ĐIỀU KHOẢN, CAM KẾT & CHÍNH SÁCH</span><h1>Điều khoản & Chính sách Hệ thống</h1><p class="muted">Quản lý nội dung các văn bản điều khoản, chính sách quyền riêng tư và cam kết tham gia. Hệ thống lưu đầy đủ lịch sử phiên bản (không ghi đè mất dấu vết) và ghi nhận chính xác phiên bản mà người dùng đã đồng ý khi gửi biểu mẫu.</p></div><button type="button" class="primary" onclick="createTermModal()">+ Thêm điều khoản mới</button></div>
  <div style="display:grid;gap:14px;">${state.admin.terms.map(t=>`<article class="card"><div class="toolbar"><div><span class="pill">${E(t.code)}</span> <b style="font-size:17px;margin-left:6px;">${E(t.name)}</b><br><span class="small muted">Phiên bản: <b>${E(t.version)}</b> • Phạm vi: <b>${E(t.scope||"Toàn hệ thống")}</b> • Cập nhật: ${fmt(t.updated_at)}</span></div><div style="margin-left:auto;display:flex;gap:8px;align-items:center;"><span class="status ${t.status==="published"?"":"status-warn"}">${t.status==="published"?"Đang công bố":t.status==="draft"?"Bản nháp":E(t.status)}</span><button type="button" class="secondary" onclick="previewTermModal('${encodeURIComponent(t.code)}')">Xem trước</button><button type="button" class="secondary" onclick="viewTermRevisions('${encodeURIComponent(t.code)}')">Lịch sử phiên bản</button><button type="button" class="primary" onclick="editTerm('${encodeURIComponent(t.code)}')">Chỉnh sửa</button></div></div><pre style="white-space:pre-wrap;max-height:160px;overflow:auto;margin-top:10px;padding:12px;background:var(--bg);border-radius:10px;border:1px solid var(--line);font-family:inherit;">${E(t.body)}</pre></article>`).join("")||`<div class="card muted">Chưa có điều khoản nào.</div>`}</div>`;
}

window.createTermModal=()=>{
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">ĐIỀU KHOẢN & CHÍNH SÁCH</span><h2>Tạo điều khoản / chính sách mới</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <form id="createTermForm">
    <div class="row2"><div class="field"><label for="newTermCode">Mã điều khoản *</label><input id="newTermCode" required placeholder="VD: DK-03/2026/SFN"></div><div class="field"><label for="newTermVersion">Phiên bản *</label><input id="newTermVersion" value="24/10/2026" required></div></div>
    <div class="row2"><div class="field"><label for="newTermName">Tên điều khoản / chính sách *</label><input id="newTermName" required placeholder="VD: Điều khoản Bảo mật & Quy tắc ứng xử"></div><div class="field"><label for="newTermScope">Phạm vi áp dụng</label><input id="newTermScope" value="Toàn hệ thống"></div></div>
    <div class="row2"><div class="field"><label for="newTermStatus">Trạng thái xuất bản</label><select id="newTermStatus"><option value="draft">Bản nháp (Chưa áp dụng công khai)</option><option value="published">Công bố chính thức</option></select></div><div class="field"><label for="newTermNote">Ghi chú phiên bản</label><input id="newTermNote" value="Khởi tạo điều khoản mới"></div></div>
    <div class="field"><label for="newTermBody">Nội dung chi tiết *</label><textarea id="newTermBody" rows="8" required placeholder="Nhập toàn văn điều khoản hoặc chính sách..."></textarea></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="submit" class="primary" id="newTermSubmitBtn">Lưu điều khoản</button></div>
  </form>`);
  document.getElementById("createTermForm").onsubmit=async e=>{
    e.preventDefault();
    const btn=document.getElementById("newTermSubmitBtn");btn.disabled=true;btn.textContent="Đang lưu…";
    try{
      await api("/api/admin/terms",{
        method:"POST",
        body:{
          code:document.getElementById("newTermCode").value.trim(),
          name:document.getElementById("newTermName").value.trim(),
          version:document.getElementById("newTermVersion").value.trim(),
          scope:document.getElementById("newTermScope").value.trim(),
          status:document.getElementById("newTermStatus").value,
          change_note:document.getElementById("newTermNote").value.trim(),
          body:document.getElementById("newTermBody").value
        }
      });
      closeModal();toast("Đã tạo điều khoản mới và lưu lịch sử phiên bản.");adminTerms(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Lưu điều khoản";}
  };
};

window.previewTermModal=encoded=>{
  const code=decodeURIComponent(encoded);
  const t=(state.admin.terms||[]).find(x=>x.code===code);if(!t)return;
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">XEM TRƯỚC ĐIỀU KHOẢN HIỂN THỊ TRÊN BIỂU MẪU</span><h2>${E(t.name)} (${E(t.code)})</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <div class="card" style="background:var(--bg);"><div class="toolbar"><span class="pill">Phiên bản: ${E(t.version)}</span><span class="pill">Phạm vi: ${E(t.scope||"Toàn hệ thống")}</span><span class="status ${t.status==="published"?"":"status-warn"}">${t.status==="published"?"Đang công bố":"Bản nháp"}</span></div><div style="white-space:pre-wrap;line-height:1.75;padding:14px;background:var(--card);border-radius:12px;border:1px solid var(--line);max-height:420px;overflow:auto;">${E(t.body)}</div></div>
  <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button><button type="button" class="primary" onclick="editTerm('${encodeURIComponent(t.code)}')">Chỉnh sửa điều khoản này</button></div>`);
};

window.viewTermRevisions=async encoded=>{
  const code=decodeURIComponent(encoded);
  try{
    const d=await api(`/api/admin/terms/${encodeURIComponent(code)}/revisions`);
    const items=d.items||[];
    state.admin.termRevisions=items;
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">LỊCH SỬ PHIÊN BẢN ĐIỀU KHOẢN</span><h2>${E(code)} (${items.length} phiên bản)</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <div class="table-scroll"><table><thead><tr><th>Phiên bản</th><th>Tên & Phạm vi</th><th>Trạng thái</th><th>Ghi chú thay đổi</th><th>Thời điểm lưu</th><th>Thao tác</th></tr></thead><tbody>
      ${items.map((r,idx)=>`<tr><td><b>${E(r.version)}</b></td><td><b>${E(r.name)}</b><br><small class="muted">${E(r.scope||"")}</small></td><td><span class="status ${r.status==="published"?"":"status-warn"}">${r.status==="published"?"Đã công bố":"Bản nháp"}</span></td><td><small>${E(r.change_note||"—")}</small></td><td>${fmt(r.created_at)}</td><td><button type="button" class="secondary" onclick="restoreTermRevision('${encodeURIComponent(code)}',${idx})">Khôi phục bản này</button></td></tr>`).join("")||`<tr><td colspan="6" class="muted">Chưa có bản ghi lịch sử.</td></tr>`}
    </tbody></table></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

window.restoreTermRevision=async(encoded,idx)=>{
  const code=decodeURIComponent(encoded);
  const rev=(state.admin.termRevisions||[])[idx];if(!rev)return;
  if(!await adminConfirm(`Khôi phục điều khoản ${code} về nội dung của phiên bản ${rev.version}? Hệ thống sẽ tạo một bản ghi lịch sử mới để bảo toàn dấu vết.`,{title:"Khôi phục phiên bản điều khoản",confirmText:"Khôi phục"}))return;
  try{
    await api(`/api/admin/terms/${encodeURIComponent(code)}`,{
      method:"PUT",
      body:{name:rev.name,version:rev.version,scope:rev.scope,body:rev.body,status:rev.status,change_note:`Khôi phục từ phiên bản ${rev.version}`}
    });
    closeModal();toast("Đã khôi phục phiên bản điều khoản.");adminTerms(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.editTerm=encoded=>{
  const code=decodeURIComponent(encoded);
  const t=state.admin.terms.find(x=>x.code===code);
  if(!t)return;
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">CẬP NHẬT ĐIỀU KHOẢN</span><h2>${E(code)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <div class="row2"><div class="field"><label for="termName">Tên điều khoản</label><input id="termName" value="${E(t.name)}"></div><div class="field"><label for="termVersion">Phiên bản</label><input id="termVersion" value="${E(t.version)}"></div></div>
  <div class="row2"><div class="field"><label for="termScope">Phạm vi áp dụng</label><input id="termScope" value="${E(t.scope||"")}"></div><div class="field"><label for="termStatus">Trạng thái</label><select id="termStatus"><option value="published" ${t.status==="published"?"selected":""}>Đang công bố</option><option value="draft" ${t.status==="draft"?"selected":""}>Bản nháp</option><option value="archived" ${t.status==="archived"?"selected":""}>Lưu trữ</option></select></div></div>
  <div class="field"><label for="termChangeNote">Ghi chú thay đổi phiên bản</label><input id="termChangeNote" placeholder="Nhập tóm tắt nội dung chỉnh sửa để lưu vào lịch sử phiên bản..."></div>
  <div class="field"><label for="termBody">Nội dung điều khoản</label><textarea id="termBody" style="min-height:320px">${E(t.body)}</textarea></div>
  <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="button" class="primary" onclick="saveTerm('${encodeURIComponent(code)}')">Lưu phiên bản mới</button></div>`);
};

window.saveTerm=encoded=>{
  const code=decodeURIComponent(encoded);
  api(`/api/admin/terms/${encodeURIComponent(code)}`,{
    method:"PUT",
    body:{
      name:document.getElementById("termName").value,
      version:document.getElementById("termVersion").value,
      scope:document.getElementById("termScope").value,
      status:document.getElementById("termStatus")?.value||"published",
      change_note:document.getElementById("termChangeNote")?.value||"Cập nhật nội dung điều khoản",
      body:document.getElementById("termBody").value
    }
  }).then(()=>{
    closeModal();
    toast("Đã cập nhật điều khoản và lưu lịch sử phiên bản.");
    adminTerms(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

window.viewEmailTemplateVersions=async key=>{
  try{
    const d=await api(`/api/admin/email-templates/${encodeURIComponent(key)}/versions`);
    const items=d.items||[];
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">LỊCH SỬ PHIÊN BẢN MẪU EMAIL</span><h2>${E(key)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <div class="table-scroll"><table><thead><tr><th>Phiên bản</th><th>Tiêu đề mẫu</th><th>Thời điểm lưu</th></tr></thead><tbody>
      ${items.map(v=>`<tr><td><b>v${E(v.version)}</b></td><td>${E(v.subject_template)}</td><td>${fmt(v.created_at)}</td></tr>`).join("")||`<tr><td colspan="3" class="muted">Mẫu đang ở phiên bản gốc (v1) từ cơ sở dữ liệu. Khi chỉnh sửa và lưu mẫu, phiên bản mới sẽ được ghi nhận tại đây.</td></tr>`}
    </tbody></table></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

async function adminPrivacy(main){
  const d=await api("/api/admin/data-requests");
  state.admin.dataRequests=d.items||[];
  main.innerHTML=`<h1>Trung tâm Quyền riêng tư</h1><div class="card table-scroll"><table><thead><tr><th>Email</th><th>Yêu cầu</th><th>Trạng thái</th><th>Ngày gửi</th><th></th></tr></thead><tbody>${state.admin.dataRequests.map(x=>`<tr><td>${E(x.email)}</td><td>${E(x.request_type)}<br><span class="small">${E(x.note||"")}</span></td><td><span class="status">${E(x.status)}</span></td><td>${fmt(x.created_at)}</td><td><button class="secondary" onclick="processPrivacy('${E(x.id)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.processPrivacy=async idr=>{
  const values=await adminDialog({title:"Xử lý yêu cầu quyền riêng tư",confirmText:"Lưu xử lý",fields:[
    {name:"status",label:"Trạng thái",value:"Đang xử lý",required:true},
    {name:"note",label:"Ghi chú xử lý",type:"textarea",rows:4,required:false}
  ]});
  if(!values)return;
  api(`/api/admin/data-requests/${encodeURIComponent(idr)}`,{method:"PATCH",body:{status:values.status.trim(),note:values.note||""}})
    .then(()=>{toast("Đã cập nhật.");adminPrivacy(document.getElementById("adminMain"));})
    .catch(e=>toast(errorText(e),"bad"));
};

function formWfLabel(wf,enabled){
  if(enabled&&wf==="published") return "Đang công bố (Mở nhận hồ sơ)";
  if(wf==="pending_review") return "Chờ phê duyệt";
  if(wf==="approved") return "Đã duyệt (Chờ mở công khai)";
  if(wf==="paused") return "Tạm ngừng tiếp nhận";
  return "Bản nháp (Chưa công bố)";
}

async function adminForms(main){
  const d=await api("/api/admin/forms");
  state.admin.forms=d.items||[];

  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">QUẢN LÝ & DỰNG BIỂU MẪU ĐIỆN TỬ</span><h1>Trình dựng Biểu mẫu & Quản lý Phiên bản</h1><p class="muted">Quản lý cấu trúc câu hỏi, điều khoản áp dụng, logic hiển thị, tải tệp, chữ ký xác nhận và quy trình phê duyệt. Biểu mẫu mới tạo luôn ở trạng thái <b>Bản nháp</b> và chỉ hiển thị công khai sau khi được phê duyệt công bố.</p></div><button class="primary" onclick="createForm()">+ Tạo biểu mẫu mới</button></div>
  <div class="grid">${state.admin.forms.map(f=>{
    const wf=f.workflow_status||(f.enabled?"published":"draft");
    return `<div class="card"><div class="toolbar"><span class="pill">${E(f.prefix)}</span><span class="status ${f.enabled?"":"status-warn"}">${E(formWfLabel(wf,f.enabled))}</span></div><h3>${E(f.name)}</h3><p class="muted">${E(f.description||"Biểu mẫu điện tử Sky First")}</p><p class="small">Phiên bản: <b>v${f.version}</b> • Mã: <code>${E(f.id)}</code></p><p class="small muted">Ảnh cá nhân: ${f.config?.profile_photo_required===true?"Bắt buộc":"Không bắt buộc"} • Chữ ký: ${f.config?.signature_required===true?"Bắt buộc":"Tùy chọn"}</p><div class="actions" style="flex-wrap:wrap;gap:6px;"><button class="primary" onclick="editForm('${E(f.id)}')">Chỉnh sửa câu hỏi</button><button class="secondary" onclick="viewFormRevisions('${E(f.id)}')">Lịch sử phiên bản</button>${!f.enabled?`<button class="secondary" onclick="runFormWorkflow('${E(f.id)}','submit_review')">Gửi duyệt</button><button class="secondary" onclick="runFormWorkflow('${E(f.id)}','publish')">Phê duyệt & Công bố</button>`:`<button class="secondary" onclick="runFormWorkflow('${E(f.id)}','pause')">Tạm ngừng</button>`}<button class="ghost" onclick="cloneForm('${E(f.id)}')">Sao chép</button></div></div>`;
  }).join("")}</div>`;
}

window.runFormWorkflow=async(idForm,action)=>{
  const labels={submit_review:"Gửi biểu mẫu vào hàng đợi chờ phê duyệt?",publish:"Phê duyệt và công bố biểu mẫu này lên cổng công khai (/bieu-mau)?",pause:"Tạm ngừng tiếp nhận hồ sơ cho biểu mẫu này?"};
  if(labels[action]&&!await adminConfirm(labels[action],{title:"Quy trình phê duyệt & công bố biểu mẫu",confirmText:"Xác nhận"}))return;
  try{
    await api(`/api/admin/forms/${encodeURIComponent(idForm)}/workflow`,{method:"POST",body:{action}});
    toast("Đã cập nhật trạng thái quy trình biểu mẫu.");
    adminForms(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.viewFormRevisions=async idForm=>{
  try{
    const d=await api(`/api/admin/forms/${encodeURIComponent(idForm)}/revisions`);
    const items=d.items||[];
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">LỊCH SỬ PHIÊN BẢN BIỂU MẪU</span><h2>Biểu mẫu: ${E(idForm)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <div class="table-scroll"><table><thead><tr><th>Phiên bản</th><th>Trạng thái</th><th>Thời điểm lưu</th><th>Thao tác</th></tr></thead><tbody>
      ${items.map(r=>`<tr><td><b>v${E(r.version)}</b></td><td><span class="status ${r.status==="published"?"":"status-warn"}">${E(r.status==="published"?"Đã công bố":r.status==="draft"?"Bản nháp":r.status)}</span></td><td>${fmt(r.created_at)}</td><td><button type="button" class="secondary" onclick="restoreFormVersion('${E(idForm)}',${r.version})">Khôi phục về bản nháp</button></td></tr>`).join("")||`<tr><td colspan="4" class="muted">Đang ở phiên bản khởi tạo v1.</td></tr>`}
    </tbody></table></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

window.restoreFormVersion=async(idForm,version)=>{
  if(!await adminConfirm(`Khôi phục cấu hình biểu mẫu "${idForm}" từ phiên bản v${version} sang một bản nháp mới?`,{title:"Khôi phục phiên bản biểu mẫu",confirmText:"Khôi phục"}))return;
  try{
    await api(`/api/admin/forms/${encodeURIComponent(idForm)}/workflow`,{method:"POST",body:{action:"restore_version",version}});
    closeModal();toast(`Đã khôi phục phiên bản v${version} về trạng thái Bản nháp.`);adminForms(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.editForm=idForm=>{
  const f=state.admin.forms.find(x=>x.id===idForm);
  if(!f)return;
  state.formBuilder=JSON.parse(JSON.stringify(f));
  state.formBuilder.config.form_type=state.formBuilder.config.form_type||(f.id==="class"?"class":"general");
  if(typeof state.formBuilder.config.profile_photo_required!=="boolean") state.formBuilder.config.profile_photo_required=state.formBuilder.config.form_type!=="class";
  renderFormBuilder();
};

function renderFormBuilder(){
  const f=state.formBuilder,c=f.config;
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Chỉnh sửa biểu mẫu — ${E(f.name)}</h2>
   <div class="row2"><div class="field"><label>Tên biểu mẫu</label><input id="fbName" value="${E(f.name)}"></div><div class="field"><label>Mã tiền tố hồ sơ</label><input id="fbPrefix" value="${E(f.prefix)}"></div></div>
   <div class="field"><label>Mô tả biểu mẫu</label><textarea id="fbDesc">${E(f.description||"")}</textarea></div>
   <div class="row2"><div class="field"><label>Loại biểu mẫu</label><select id="fbType"><option value="general" ${c.form_type!=="class"&&c.form_type!=="student"?"selected":""}>Đăng ký chung</option><option value="class" ${c.form_type==="class"?"selected":""}>Lớp học</option><option value="student" ${c.form_type==="student"?"selected":""}>Học viên mới</option></select></div><div class="field"><label>Kiểu trình bày</label><select id="fbPresentation"><option value="classic" ${(c.presentation||"classic")==="classic"?"selected":""}>Biểu mẫu tiêu chuẩn (Một trang)</option><option value="multi-step" ${c.presentation==="multi-step"?"selected":""}>Biểu mẫu nhiều bước</option><option value="guided" ${c.presentation==="guided"?"selected":""}>Biểu mẫu hướng dẫn từng bước</option></select></div></div>
   <div class="row2"><div class="field"><label>Trạng thái xuất bản</label><select id="fbEnabled"><option value="1" ${f.enabled?"selected":""}>Đang công bố (Mở nhận hồ sơ)</option><option value="0" ${!f.enabled?"selected":""}>Bản nháp / Tạm đóng</option></select></div><div class="field"><label>Bước kiểm tra trước khi gửi</label><select id="fbReview"><option value="1" ${c.review_before_submit!==false?"selected":""}>Xem lại thông tin trước khi gửi</option><option value="0" ${c.review_before_submit===false?"selected":""}>Gửi trực tiếp</option></select></div></div>
   <div class="check"><input id="fbMinorMode" type="checkbox" ${c.minor_mode?"checked":""}><label>Chế độ người tham gia dưới 18 tuổi — tự động hiển thị phần thông tin người giám hộ khi dưới 18 tuổi</label></div>
   <div class="check"><input id="fbPhotoRequired" type="checkbox" ${c.profile_photo_required===true?"checked":""}><label>Yêu cầu ảnh cá nhân (chỉ bật khi chương trình thực sự cần)</label></div>
   <div class="check"><input id="fbSignatureRequired" type="checkbox" ${c.signature_required===true?"checked":""}><label>Bắt buộc có chữ ký xác nhận (vẽ trực tiếp hoặc tải ảnh chữ ký)</label></div><p class="small muted">Nguyên tắc tối thiểu hóa dữ liệu: ảnh cá nhân, giấy tờ định danh và tệp nhạy cảm không được bật mặc định nếu nghiệp vụ không yêu cầu.</p>
   <div id="builderSections">${(c.sections||[]).map((sec,si)=>`<div class="builder-section"><div class="toolbar"><b>${E(sec.title)}</b><button class="secondary" onclick="addBuilderField(${si})">+ Thêm câu hỏi</button><button class="danger" onclick="deleteBuilderSection(${si})">Xóa phần</button></div>${(sec.fields||[]).map((x,fi)=>`<div class="builder-field" draggable="true" data-builder-pos="${si}:${fi}"><span><b>${E(x.label)}</b><br><span class="small muted">${E(x.key)}</span></span><span>${E(x.type)}</span><span>${x.required?"Bắt buộc":"Không bắt buộc"}</span><span><button class="ghost" onclick="moveField(${si},${fi},-1)">↑</button><button class="ghost" onclick="moveField(${si},${fi},1)">↓</button><button class="secondary" onclick="editBuilderField(${si},${fi})">Sửa</button><button class="danger" onclick="deleteBuilderField(${si},${fi})">×</button></span></div>`).join("")}</div>`).join("")}</div>
   <div class="actions"><button class="secondary" onclick="addBuilderSection()">+ Thêm phần mới</button><button class="secondary" onclick="previewFormBuilder()">Xem trước</button><button class="primary" onclick="saveFormBuilder()">Lưu phiên bản mới</button></div>`);
  document.getElementById("fbType").onchange=e=>{
    const type=e.target.value;
    if(type==="class"||type==="student") document.getElementById("fbPhotoRequired").checked=false;
  };
  initBuilderDragDrop();
}
function initBuilderDragDrop(){
  let from=null;document.querySelectorAll('[data-builder-pos]').forEach(el=>{el.addEventListener('dragstart',()=>{from=el.dataset.builderPos;el.classList.add('dragging')});el.addEventListener('dragend',()=>el.classList.remove('dragging'));el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();if(!from)return;const [fsi,ffi]=from.split(':').map(Number),[tsi,tfi]=el.dataset.builderPos.split(':').map(Number);if(fsi!==tsi)return;const a=state.formBuilder.config.sections[fsi].fields,[moved]=a.splice(ffi,1);a.splice(tfi,0,moved);renderFormBuilder()})})
}

window.addBuilderSection=async()=>{
  const value=await adminPrompt("Tên phần biểu mẫu","",{title:"Thêm phần biểu mẫu",required:true});
  const title=String(value||"").trim();if(!title)return;
  state.formBuilder.config.sections.push({title,fields:[]});renderFormBuilder();
};
window.deleteBuilderSection=async i=>{
  const section=state.formBuilder.config.sections[i];if(!section)return;
  if(await adminConfirm(`Xóa phần “${section.title}” cùng toàn bộ câu hỏi bên trong?`,{title:"Xóa phần biểu mẫu",confirmText:"Xóa phần",danger:true})){state.formBuilder.config.sections.splice(i,1);renderFormBuilder();}
};
const builderFieldTypes=[
  {value:"text",label:"Văn bản ngắn (text)"},
  {value:"email",label:"Địa chỉ Email (email)"},
  {value:"date",label:"Ngày tháng (date)"},
  {value:"textarea",label:"Văn bản dài (textarea)"},
  {value:"select",label:"Danh sách lựa chọn (select)"},
  {value:"checkbox",label:"Ô đánh dấu xác nhận (checkbox)"},
  {value:"file",label:"Tệp đính kèm (file)"},
  {value:"signature",label:"Chữ ký xác nhận (signature)"}
];
function builderFieldKey(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,50);}
window.addBuilderField=async si=>{
  const value=await adminDialog({title:"Thêm câu hỏi biểu mẫu",description:"Mã kỹ thuật được tạo tự động nếu để trống. Với câu hỏi dạng danh sách lựa chọn, nhập mỗi lựa chọn trên một dòng.",confirmText:"Thêm câu hỏi",fields:[
    {name:"label",label:"Nhãn câu hỏi",required:true},
    {name:"key",label:"Mã kỹ thuật (không bắt buộc)",placeholder:"vd: ho_ten"},
    {name:"type",label:"Loại trường dữ liệu",type:"select",value:"text",required:true,options:builderFieldTypes},
    {name:"required",label:"Bắt buộc trả lời",type:"select",value:"yes",options:[{value:"yes",label:"Có, bắt buộc"},{value:"no",label:"Không bắt buộc"}]},
    {name:"options",label:"Các lựa chọn (dành cho trường danh sách lựa chọn)",type:"textarea",rows:4,placeholder:"Một lựa chọn trên mỗi dòng"}
  ]});
  if(!value)return;const label=value.label.trim(),key=builderFieldKey(value.key||label),type=value.type,options=String(value.options||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  if(!label||!key){toast("Nhãn và mã kỹ thuật hợp lệ là bắt buộc.","bad");return;}
  if(state.formBuilder.config.sections.some(sec=>(sec.fields||[]).some(f=>f.key===key))){toast("Mã kỹ thuật đã tồn tại trong biểu mẫu.","bad");return;}
  if(type==="select"&&!options.length){toast("Câu hỏi dạng danh sách lựa chọn cần ít nhất một lựa chọn.","bad");return;}
  state.formBuilder.config.sections[si].fields.push({key,label,type,required:value.required==="yes",options:type==="select"?options:[]});renderFormBuilder();
};
window.editBuilderField=async(si,fi)=>{
  const x=state.formBuilder.config.sections[si]?.fields[fi];if(!x)return;
  const value=await adminDialog({title:"Chỉnh sửa câu hỏi",description:"Giữ nguyên mã kỹ thuật để tránh làm sai lệch dữ liệu đã gửi. Với trường danh sách lựa chọn, nhập mỗi lựa chọn trên một dòng.",confirmText:"Lưu câu hỏi",fields:[
    {name:"label",label:"Nhãn câu hỏi",value:x.label,required:true},
    {name:"key",label:"Mã kỹ thuật",value:x.key,required:true},
    {name:"type",label:"Loại trường dữ liệu",type:"select",value:x.type||"text",required:true,options:builderFieldTypes},
    {name:"required",label:"Bắt buộc trả lời",type:"select",value:x.required?"yes":"no",options:[{value:"yes",label:"Có, bắt buộc"},{value:"no",label:"Không bắt buộc"}]},
    {name:"options",label:"Các lựa chọn (dành cho trường danh sách lựa chọn)",type:"textarea",value:(x.options||[]).join("\n"),rows:4}
  ]});
  if(!value)return;const label=value.label.trim(),key=builderFieldKey(value.key),type=value.type,options=String(value.options||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  if(!label||!key){toast("Nhãn và mã kỹ thuật hợp lệ là bắt buộc.","bad");return;}
  if(state.formBuilder.config.sections.some((sec,sidx)=>(sec.fields||[]).some((f,fidx)=>f.key===key&&(sidx!==si||fidx!==fi)))){toast("Mã kỹ thuật đã được dùng bởi câu hỏi khác.","bad");return;}
  if(type==="select"&&!options.length){toast("Câu hỏi dạng danh sách lựa chọn cần ít nhất một lựa chọn.","bad");return;}
  Object.assign(x,{label,key,type,required:value.required==="yes",options:type==="select"?options:[]});renderFormBuilder();
};
window.deleteBuilderField=async(si,fi)=>{const field=state.formBuilder.config.sections[si]?.fields[fi];if(!field)return;if(await adminConfirm(`Xóa câu hỏi “${field.label}” khỏi cấu hình biểu mẫu?`,{title:"Xóa câu hỏi",confirmText:"Xóa câu hỏi",danger:true})){state.formBuilder.config.sections[si].fields.splice(fi,1);renderFormBuilder();}};
window.moveField=(si,fi,dir)=>{const a=state.formBuilder.config.sections[si].fields,j=fi+dir;if(j<0||j>=a.length)return;[a[fi],a[j]]=[a[j],a[fi]];renderFormBuilder();};

window.previewFormBuilder=()=>{
  const c=state.formBuilder.config;
  const html=(c.sections||[]).map(sec=>`<section><h3>${E(sec.title)}</h3>${(sec.fields||[]).map(x=>`<div class="field"><label>${E(x.label)}${x.required?" *":""}</label><div class="small muted">Loại: ${E(x.type)} • Mã trường: <code>${E(x.key)}</code></div></div>`).join("")}</section>`).join("");
  modal(`<button class="ghost" onclick="renderFormBuilder()">← Quay lại chỉnh sửa</button><h2>Xem trước cấu trúc — ${E(state.formBuilder.name)}</h2><div class="card">${html}</div>`);
};

window.saveFormBuilder=async()=>{
  state.formBuilder.name=document.getElementById("fbName").value;
  state.formBuilder.prefix=document.getElementById("fbPrefix").value;
  state.formBuilder.description=document.getElementById("fbDesc").value;
  state.formBuilder.enabled=document.getElementById("fbEnabled").value==="1";
  state.formBuilder.config.form_type=document.getElementById("fbType").value;
  state.formBuilder.config.presentation=document.getElementById("fbPresentation").value;
  state.formBuilder.config.review_before_submit=document.getElementById("fbReview").value==="1";
  state.formBuilder.config.minor_mode=document.getElementById("fbMinorMode").checked;
  state.formBuilder.config.profile_photo_required=document.getElementById("fbPhotoRequired").checked;
  state.formBuilder.config.signature_required=!!document.getElementById("fbSignatureRequired")?.checked;
  state.formBuilder.config.workflow_status=state.formBuilder.enabled?"published":"draft";
  try{
    await api(`/api/admin/forms/${encodeURIComponent(state.formBuilder.id)}`,{method:"PUT",body:{name:state.formBuilder.name,prefix:state.formBuilder.prefix,description:state.formBuilder.description,audience:state.formBuilder.audience,min_age:state.formBuilder.min_age,enabled:!!state.formBuilder.enabled,workflow_status:state.formBuilder.config.workflow_status,recipient_email:state.formBuilder.recipient_email,config:state.formBuilder.config}});
    closeModal();toast("Đã lưu phiên bản biểu mẫu mới.");adminForms(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.createForm=async()=>{
  const values=await adminDialog({title:"Tạo biểu mẫu mới (Bản nháp)",description:"Biểu mẫu mới sẽ được khởi tạo ở trạng thái Bản nháp (chưa công bố công khai). Bạn có thể bổ sung câu hỏi, xem trước và gửi phê duyệt trước khi công bố.",confirmText:"Khởi tạo bản nháp",fields:[
    {name:"name",label:"Tên biểu mẫu *",required:true,placeholder:"VD: Đăng ký Chương trình Tình nguyện Mùa hè 2026"},
    {name:"id",label:"Mã định danh biểu mẫu (ID) *",required:true,placeholder:"tnv_mua_he_2026",help:"Dùng chữ thường, số, dấu gạch dưới hoặc gạch ngang; phải duy nhất."},
    {name:"prefix",label:"Tiền tố mã hồ sơ *",value:"SFN-FORM",required:true,placeholder:"SFN-TNV"},
    {name:"description",label:"Mô tả ngắn",placeholder:"Nhập mô tả mục đích và đối tượng của biểu mẫu..."},
    {name:"kind",label:"Phân loại biểu mẫu",type:"select",value:"general",options:[{value:"general",label:"Đăng ký chung"},{value:"class",label:"Đăng ký lớp học"},{value:"student",label:"Học viên mới"}]}
  ]});
  if(!values)return;const name=values.name.trim(),idForm=values.id.trim().toLowerCase(),prefix=values.prefix.trim().toUpperCase(),kind=values.kind;
  if(!/^[a-z0-9_-]{2,80}$/.test(idForm)){toast("Mã định danh chỉ được gồm chữ thường, số, dấu gạch dưới hoặc gạch ngang (tối thiểu 2 ký tự).","bad");return;}
  const cfg={id:idForm,name,prefix,description:values.description||"",audience:"public",form_type:kind,workflow_status:"draft",presentation:"classic",review_before_submit:true,minor_mode:false,profile_photo_required:false,signature_required:false,term_codes:["PRIVACY/SFN"],sections:[{title:"Thông tin người đăng ký",fields:[{key:"full_name",label:"Họ và tên",type:"text",required:true},{key:"email",label:"Địa chỉ Email",type:"email",required:true}]}]};
  api("/api/admin/forms",{method:"POST",body:{id:idForm,name,prefix,description:values.description||"",audience:"public",publish:false,config:cfg}}).then(()=>{toast("Đã tạo biểu mẫu ở trạng thái Bản nháp.");adminForms(document.getElementById("adminMain"));}).catch(e=>toast(errorText(e),"bad"));
};

window.cloneForm=async idForm=>{
  const src=state.admin.forms.find(x=>x.id===idForm);if(!src)return;
  const values=await adminDialog({title:"Sao chép biểu mẫu sang Bản nháp mới",description:"Cấu hình và các câu hỏi hiện tại sẽ được sao chép sang một biểu mẫu mới ở trạng thái Bản nháp.",confirmText:"Sao chép",fields:[
    {name:"id",label:"Mã định danh biểu mẫu mới",value:`${src.id}_ban_sao`,required:true},
    {name:"name",label:"Tên biểu mẫu mới",value:`${src.name} — Bản sao`,required:true},
    {name:"prefix",label:"Tiền tố mã hồ sơ",value:src.prefix,required:true}
  ]});
  if(!values)return;const newId=values.id.trim().toLowerCase(),newName=values.name.trim(),newPrefix=values.prefix.trim().toUpperCase();
  if(!/^[a-z0-9_-]{2,80}$/.test(newId)){toast("Mã định danh chỉ được gồm chữ thường, số, dấu gạch dưới hoặc gạch ngang.","bad");return;}
  const cfg=JSON.parse(JSON.stringify(src.config));cfg.id=newId;cfg.name=newName;cfg.prefix=newPrefix;cfg.workflow_status="draft";
  api("/api/admin/forms",{method:"POST",body:{id:newId,name:newName,prefix:newPrefix,description:src.description||"",audience:src.audience||"public",min_age:src.min_age,recipient_email:src.recipient_email,publish:false,config:cfg}}).then(()=>{toast("Đã sao chép biểu mẫu sang Bản nháp mới.");adminForms(document.getElementById("adminMain"));}).catch(e=>toast(errorText(e),"bad"));
};

function adminNewsSlug(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,160);}
function adminNewsTags(value){try{const parsed=typeof value==="string"?JSON.parse(value||"[]"):value;return Array.isArray(parsed)?parsed.map(x=>String(x)).join(", "):""}catch{return String(value||"")}}
function adminNewsDatetime(value){
  if(!value)return "";const raw=String(value).trim();const ms=Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)?raw:`${raw.replace(" ","T")}+07:00`);if(!Number.isFinite(ms))return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms));const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
}
function adminNewsCoverUrl(key){return key?`/media/${encodeURIComponent(String(key))}`:"";}
async function adminNews(main){
  const d=await api("/api/admin/content/news");state.admin.news=d.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">CMS · TIN TỨC & THÔNG BÁO</span><h1>Quản lý tin tức</h1><p class="muted">Tạo, sửa, xuất bản và tải ảnh đại diện thật cho từng bài viết. Chỉ sử dụng hình ảnh hoạt động thực tế hoặc tài nguyên có quyền sử dụng hợp lệ.</p></div><button type="button" class="primary" id="newsCreateBtn">＋ Viết bài mới</button></div>
  <section class="admin-news-summary"><div><b>${state.admin.news.length}</b><span>Tổng bài viết</span></div><div><b>${state.admin.news.filter(x=>x.status==="published").length}</b><span>Đang công khai</span></div><div><b>${state.admin.news.filter(x=>x.cover_file_id).length}</b><span>Đã có ảnh đại diện</span></div><div><b>${state.admin.news.filter(x=>x.status!=="published").length}</b><span>Bản nháp / ẩn</span></div></section>
  <section class="card admin-card-premium"><div class="toolbar admin-news-toolbar"><label class="admin-searchbox"><span>⌕</span><input id="adminNewsSearch" type="search" placeholder="Tìm tiêu đề, slug hoặc nội dung…" aria-label="Tìm bài viết"></label><select id="adminNewsStatus" aria-label="Lọc trạng thái"><option value="all">Tất cả trạng thái</option><option value="published">Đang công khai</option><option value="draft">Bản nháp</option><option value="other">Ẩn / trạng thái khác</option></select><span id="adminNewsCount" class="muted small"></span></div>
  <div class="table-scroll"><table class="admin-news-table"><thead><tr><th>Ảnh đại diện</th><th>Bài viết</th><th>Trạng thái</th><th>Ngày đăng</th><th>Đường dẫn</th><th>Thao tác</th></tr></thead><tbody id="adminNewsRows"></tbody></table></div><div id="adminNewsEmpty" class="admin-empty-state" hidden><span>▤</span><b>Không tìm thấy bài viết phù hợp</b><p>Thử đổi từ khóa hoặc tạo bài viết mới.</p></div></section>`;
  const rows=document.getElementById("adminNewsRows"),search=document.getElementById("adminNewsSearch"),filter=document.getElementById("adminNewsStatus"),count=document.getElementById("adminNewsCount"),empty=document.getElementById("adminNewsEmpty");
  const draw=()=>{
    const q=search.value.trim().toLocaleLowerCase("vi"),status=filter.value;
    const items=state.admin.news.filter(x=>{
      const text=[x.title,x.slug,x.body,x.tags_json].join(" ").toLocaleLowerCase("vi");
      const statusOk=status==="all"||(status==="published"?x.status==="published":status==="draft"?x.status==="draft":!['published','draft'].includes(String(x.status||'')));
      return (!q||text.includes(q))&&statusOk;
    });
    rows.innerHTML=items.map(x=>`<tr><td><div class="admin-news-thumb">${x.cover_file_id?`<img src="${E(adminNewsCoverUrl(x.cover_file_id))}" alt="Ảnh đại diện ${E(x.title)}" loading="lazy"><span class="image-ready">Đã tải ảnh</span>`:`<div class="admin-news-placeholder"><i>▤</i><b>Chưa có ảnh</b><small>Dùng minh họa mặc định</small></div>`}</div></td><td><b class="admin-news-title">${E(x.title||"Chưa có tiêu đề")}</b><small>${E(x.slug||"Chưa có slug")}</small><p>${E(String(x.body||"").replace(/<[^>]*>/g," ").trim().slice(0,150))}${String(x.body||"").length>150?"…":""}</p></td><td><span class="status ${x.status==="published"?"":"status-warn"}">${x.status==="published"?"Đang công khai":x.status==="draft"?"Bản nháp":E(x.status||"Chưa đặt")}</span></td><td>${E(fmt(x.published_at))}</td><td><code>${E(x.slug?`#news/${x.slug}`:`ID: ${x.id}`)}</code></td><td><div class="admin-row-actions"><button type="button" class="secondary" data-news-edit="${E(x.id)}">Sửa</button><a class="admin-preview-link" href="/#news/${encodeURIComponent(x.slug||x.id)}" target="_blank" rel="noopener">Xem ↗</a><button type="button" class="danger" data-news-delete="${E(x.id)}">Xóa</button></div></td></tr>`).join("");
    count.textContent=`${items.length} / ${state.admin.news.length} bài`;empty.hidden=items.length>0;
    rows.querySelectorAll("[data-news-edit]").forEach(btn=>btn.addEventListener("click",()=>openNewsEditor(btn.dataset.newsEdit)));
    rows.querySelectorAll("[data-news-delete]").forEach(btn=>btn.addEventListener("click",()=>confirmDeleteNews(btn.dataset.newsDelete)));
    rows.querySelectorAll(".admin-news-thumb img").forEach(img=>img.addEventListener("error",()=>{const box=img.closest(".admin-news-thumb");if(box)box.innerHTML='<div class="admin-news-placeholder"><i>▤</i><b>Không tải được ảnh</b><small>Kiểm tra lại ảnh đại diện</small></div>';},{once:true}));
  };
  search.addEventListener("input",draw);filter.addEventListener("change",draw);document.getElementById("newsCreateBtn").addEventListener("click",()=>openNewsEditor(null));draw();
}
window.openNewsEditor=(id)=>{
  const row=id?state.admin.news.find(x=>String(x.id)===String(id)):null;if(id&&!row){toast("Không tìm thấy bài viết cần sửa.","bad");return;}
  const x=row||{title:"",slug:"",body:"",status:"draft",published_at:"",tags_json:"[]",cover_file_id:""};
  const oldCover=x.cover_file_id?adminNewsCoverUrl(x.cover_file_id):"";
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">CMS / ${row?"CHỈNH SỬA":"BÀI VIẾT MỚI"}</span><h2>${row?"Chỉnh sửa tin tức":"Tạo tin tức mới"}</h2><p class="muted">Ảnh đại diện phải là ảnh thật do bà tải lên hoặc ảnh được phép sử dụng.</p></div><button type="button" class="admin-modal-close" data-news-close aria-label="Đóng">×</button></div>
  <form id="adminNewsEditor" data-news-id="${E(row?.id||"")}"><div class="admin-news-editor-grid"><div class="admin-news-editor-fields">
  <div class="field"><label for="neTitle">Tiêu đề bài viết *</label><input id="neTitle" name="title" maxlength="240" required value="${E(x.title)}" placeholder="Nhập tiêu đề rõ ràng"></div>
  <div class="field"><label for="neSlug">Đường dẫn / slug *</label><input id="neSlug" name="slug" maxlength="160" required value="${E(x.slug)}" placeholder="vi-du-bai-viet"><small class="muted">Dùng chữ thường, số và dấu gạch nối; phải khác các bài khác.</small></div>
  <div class="field"><label for="neBody">Nội dung *</label><textarea id="neBody" name="body" rows="9" required placeholder="Nhập nội dung bài viết…">${E(x.body||"")}</textarea></div>
  <div class="row2"><div class="field"><label for="neStatus">Trạng thái</label><select id="neStatus" name="status"><option value="draft" ${x.status==="draft"?"selected":""}>Bản nháp</option><option value="published" ${x.status==="published"?"selected":""}>Công khai</option><option value="hidden" ${!['draft','published'].includes(String(x.status||''))?"selected":""}>Ẩn</option></select></div><div class="field"><label for="nePublished">Ngày / giờ đăng (UTC+7)</label><input id="nePublished" name="published_at" type="datetime-local" value="${E(adminNewsDatetime(x.published_at))}"></div></div>
  <div class="field"><label for="neTags">Nhãn / chủ đề</label><input id="neTags" name="tags" value="${E(adminNewsTags(x.tags_json))}" placeholder="Tin tức, Thông báo, SFN"><small class="muted">Ngăn cách nhiều nhãn bằng dấu phẩy.</small></div></div>
  <aside class="admin-news-image-panel"><h3>Ảnh đại diện</h3><div id="neImagePreview" class="admin-news-image-preview">${oldCover?`<img src="${E(oldCover)}" alt="Ảnh đại diện hiện tại">`:`<div class="admin-news-placeholder large"><i>▤</i><b>Chưa tải ảnh đại diện</b><small>Trang công khai sẽ dùng minh họa mặc định hiện có.</small></div>`}</div><label class="admin-upload-cta" for="neImageFile"><span>＋</span><b>Tải ảnh từ máy tính</b><small>PNG, JPG, WEBP hoặc GIF · tối đa 15 MB</small></label><input type="file" id="neImageFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden><label class="admin-remove-cover"><input id="neRemoveCover" type="checkbox" ${oldCover?"":"disabled"}> Bỏ ảnh đại diện hiện tại</label><p class="muted admin-help-text">Chỉ sử dụng hình ảnh thực tế hợp lệ. Ưu tiên ảnh hoạt động/chương trình thật do Sky First sở hữu hoặc có quyền sử dụng.</p></aside></div>
  <div class="admin-sticky-save"><span>${row?`Đang sửa bài #${E(row.id)}`:"Bài mới được lưu ở trạng thái nháp nếu chưa chọn công khai."}</span><div><button type="button" class="secondary" data-news-close>Hủy</button><button type="submit" class="primary" id="neSave">${row?"Lưu thay đổi":"Tạo bài viết"}</button></div></div></form>`);
  document.querySelectorAll("[data-news-close]").forEach(btn=>btn.addEventListener("click",closeModal));
  const form=document.getElementById("adminNewsEditor"),title=document.getElementById("neTitle"),slug=document.getElementById("neSlug"),fileInput=document.getElementById("neImageFile"),preview=document.getElementById("neImagePreview"),remove=document.getElementById("neRemoveCover");
  preview.querySelector("img")?.addEventListener("error",()=>{preview.innerHTML='<div class="admin-news-placeholder large"><i>!</i><b>Không tải được ảnh hiện tại</b><small>Bà có thể tải ảnh mới lên để thay thế.</small></div>';},{once:true});
  let slugTouched=!!x.slug;
  slug.addEventListener("input",()=>{slugTouched=true;});title.addEventListener("input",()=>{if(!slugTouched)slug.value=adminNewsSlug(title.value);});
  if(!row){title.addEventListener("blur",()=>{if(!slug.value)slug.value=adminNewsSlug(title.value);});}
  remove.addEventListener("change",()=>{if(remove.checked){preview.innerHTML='<div class="admin-news-placeholder large"><i>▤</i><b>Chưa tải ảnh đại diện</b><small>Đang chọn bỏ ảnh hiện tại</small></div>';fileInput.value="";}});
  fileInput.addEventListener("change",()=>{
    const file=fileInput.files?.[0];if(!file)return;
    if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){toast("Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.","bad");fileInput.value="";return;}
    if(file.size>15*1024*1024){toast("Ảnh vượt quá giới hạn 15 MB.","bad");fileInput.value="";return;}
    remove.checked=false;remove.disabled=false;preview.innerHTML=`<img alt="Xem trước ảnh vừa chọn">`;const img=preview.querySelector("img");img.addEventListener("error",()=>{preview.innerHTML='<div class="admin-news-placeholder large"><i>!</i><b>Không thể xem trước ảnh này</b><small>Hãy thử chọn một file ảnh hợp lệ khác.</small></div>';},{once:true});img.src=URL.createObjectURL(file);
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();const save=document.getElementById("neSave"),fd=new FormData(form);
    const titleText=String(fd.get("title")||"").trim(),slugText=adminNewsSlug(fd.get("slug")),bodyText=String(fd.get("body")||"").trim();
    if(!titleText||!slugText||!bodyText){toast("Vui lòng nhập tiêu đề, đường dẫn và nội dung.","bad");return;}
    const tags=String(fd.get("tags")||"").split(",").map(v=>v.trim()).filter(Boolean).slice(0,20);
    const data={title:titleText,slug:slugText,body:bodyText,status:String(fd.get("status")||"draft"),published_at:fd.get("published_at")?`${fd.get("published_at")}:00+07:00`:null,tags_json:JSON.stringify(tags),cover_file_id:remove.checked?"":String(x.cover_file_id||"")};
    if(data.status==="published"&&!data.published_at)data.published_at=new Date().toISOString();
    const image=fileInput.files?.[0];save.disabled=true;save.textContent="Đang lưu…";
    try{
      if(image){const uploadFd=new FormData();uploadFd.append("file",image);const uploaded=await api("/api/admin/media",{method:"POST",body:uploadFd});data.cover_file_id=uploaded.key;}
      if(row)await api(`/api/admin/content/news/${encodeURIComponent(row.id)}`,{method:"PUT",body:data});
      else await api("/api/admin/content/news",{method:"POST",body:data});
      closeModal();toast(row?"Đã cập nhật bài viết và ảnh đại diện.":"Đã tạo bài viết.");await adminNews(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad");save.disabled=false;save.textContent=row?"Lưu thay đổi":"Tạo bài viết";}
  });
};
window.confirmDeleteNews=id=>{
  const x=state.admin.news.find(v=>String(v.id)===String(id));if(!x)return;
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">XÁC NHẬN THAO TÁC</span><h2>Xóa bài viết?</h2></div><button type="button" class="admin-modal-close" data-delete-cancel aria-label="Đóng">×</button></div><p>Bài viết <b>${E(x.title)}</b> sẽ bị xóa khỏi CMS. Thao tác này không thể hoàn tác.</p><div class="admin-sticky-save"><button type="button" class="secondary" data-delete-cancel>Giữ lại</button><button type="button" class="danger" id="confirmDeleteNewsBtn">Xác nhận xóa</button></div>`);
  document.querySelectorAll("[data-delete-cancel]").forEach(btn=>btn.addEventListener("click",closeModal));
  document.getElementById("confirmDeleteNewsBtn").addEventListener("click",async e=>{const btn=e.currentTarget;btn.disabled=true;btn.textContent="Đang xóa…";try{await api(`/api/admin/content/news/${encodeURIComponent(id)}`,{method:"DELETE"});closeModal();toast("Đã xóa bài viết.");await adminNews(document.getElementById("adminMain"));}catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Xác nhận xóa";}});
};

async function adminGeneric(main,type,title,fields){
  const d=await api(`/api/admin/content/${type}`);state.admin[type]=d.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">QUẢN LÝ DỮ LIỆU</span><h1>${E(title)}</h1><p class="muted">Dữ liệu được lưu trong hệ thống quản trị. Mọi thao tác đều cần xác nhận và báo rõ kết quả.</p></div><button type="button" class="primary" id="genericCreateBtn">＋ Thêm mới</button></div><section class="card admin-card-premium"><div class="toolbar admin-news-toolbar"><label class="admin-searchbox"><span>⌕</span><input type="search" id="genericSearch" placeholder="Tìm trong bảng…" aria-label="Tìm kiếm dữ liệu"></label><span class="muted small" id="genericCount"></span></div><div class="table-scroll"><table class="admin-generic-table"><thead><tr>${fields.map(f=>`<th>${E(adminFieldLabel(f))}</th>`).join("")}<th>Thao tác</th></tr></thead><tbody id="genericRows"></tbody></table></div><div id="genericEmpty" class="admin-empty-state" hidden><span>⌕</span><b>Không có bản ghi phù hợp</b><p>Thử từ khóa khác hoặc thêm bản ghi mới.</p></div></section>${type==="classes"?`<div class="card" style="margin-top:14px"><h2>Điểm danh lớp</h2><p class="muted">Mở danh sách học viên theo lớp và ghi nhận trạng thái tham dự.</p><button type="button" class="secondary" id="attendanceToolBtn">Mở công cụ điểm danh</button></div>`:""}${type==="events"?`<div class="card" style="margin-top:14px"><h2>Check-in sự kiện</h2><button type="button" class="secondary" id="checkinToolBtn">Nhập mã check-in</button></div>`:""}`;
  const rows=document.getElementById("genericRows"),search=document.getElementById("genericSearch"),count=document.getElementById("genericCount"),empty=document.getElementById("genericEmpty");
  const draw=()=>{const q=search.value.trim().toLocaleLowerCase("vi"),items=state.admin[type].filter(x=>!q||fields.some(f=>String(x[f]??"").toLocaleLowerCase("vi").includes(q)));rows.innerHTML=items.map(x=>`<tr>${fields.map(f=>`<td>${E(String(x[f]??"").slice(0,220))}</td>`).join("")}<td><div class="admin-row-actions"><button type="button" class="secondary" data-generic-edit="${E(x.id??x.code)}">Sửa</button><button type="button" class="danger" data-generic-delete="${E(x.id??x.code)}">Xóa</button></div></td></tr>`).join("");count.textContent=`${items.length} / ${state.admin[type].length} bản ghi`;empty.hidden=items.length>0;
    rows.querySelectorAll("[data-generic-edit]").forEach(btn=>btn.addEventListener("click",()=>openGenericEditor(type,btn.dataset.genericEdit)));
    rows.querySelectorAll("[data-generic-delete]").forEach(btn=>btn.addEventListener("click",()=>confirmDeleteGeneric(type,btn.dataset.genericDelete)));
  };
  search.addEventListener("input",draw);document.getElementById("genericCreateBtn").addEventListener("click",()=>openGenericEditor(type,null));
  document.getElementById("attendanceToolBtn")?.addEventListener("click",()=>attendanceTool());document.getElementById("checkinToolBtn")?.addEventListener("click",()=>checkinTool());draw();
}

const genericFields={
  news:["title","slug","body","status","published_at"],
  classes:["unit_code","title","level","status","capacity","schedule_json","data_json"],
  events:["unit_code","title","start_at","end_at","status","capacity","data_json"],
  units:["code","name","unit_type","manager_name","email","status","data_json"],
  documents:["code","doc_type","title","visibility","status","file_id","issued_at","metadata_json"],
  tasks:["title","description","assigned_to","unit_code","status","priority","due_at"]
};

function adminFieldLabel(field){return ({
  title:"Tiêu đề / Tên",slug:"Slug",body:"Nội dung",status:"Trạng thái",published_at:"Ngày đăng",tags_json:"Nhãn (JSON)",cover_file_id:"Khóa ảnh đại diện",
  unit_code:"Đơn vị",level:"Cấp độ",schedule_json:"Lịch học (JSON)",capacity:"Sức chứa",data_json:"Dữ liệu bổ sung (JSON)",start_at:"Bắt đầu",end_at:"Kết thúc",
  code:"Mã",name:"Tên",unit_type:"Loại đơn vị",manager_name:"Người phụ trách",email:"Email",doc_type:"Loại tài liệu",visibility:"Phạm vi hiển thị",file_id:"Tệp",issued_at:"Ngày phát hành",
  description:"Mô tả",assigned_to:"Người phụ trách (ID)",priority:"Ưu tiên",due_at:"Hạn hoàn thành"
})[field]||field;}
function genericFieldControl(type,field,value,isEdit){
  const id=`generic-${field}`,label=adminFieldLabel(field),jsonField=field.endsWith("_json"),large=["body","description"].includes(field)||jsonField,dateField=["published_at","start_at","end_at","issued_at","due_at"].includes(field),numberField=["capacity","assigned_to"].includes(field),emailField=field==="email";
  if(field==="status"){
    const choices=type==="classes"?["Đang mở đăng ký","Đang hoạt động","Tạm dừng","Đã kết thúc","Nháp"]:type==="events"?["Sắp diễn ra","Đang diễn ra","Đã kết thúc","Nháp"]:type==="units"?["Đang hoạt động","Tạm ngừng","Đã giải thể"]:type==="documents"?["Có hiệu lực","Hết hiệu lực","Nháp"]:["Cần làm","Đang thực hiện","Hoàn thành","Đã hủy"];
    const options=[...new Set([String(value||""),...choices].filter(Boolean))];return `<div class="field"><label for="${id}">${E(label)}</label><select id="${id}" name="${E(field)}">${options.map(v=>`<option value="${E(v)}" ${v===String(value||"")?"selected":""}>${E(v)}</option>`).join("")}</select></div>`;
  }
  const inputType=dateField?"datetime-local":numberField?"number":emailField?"email":"text",v=dateField?adminNewsDatetime(value):String(value??"");
  const disabled=isEdit&&type==="units"&&field==="code"?"readonly":"";
  return `<div class="field"><label for="${id}">${E(label)}${(["title","name","code"].includes(field)?" *":"")}</label>${large?`<textarea id="${id}" name="${E(field)}" rows="${jsonField?4:field==="body"?8:4}" ${["title","code"].includes(field)?"required":""} placeholder="${jsonField?"Nhập JSON hợp lệ…":"Nhập "+label.toLowerCase()+"…"}>${E(v)}</textarea>`:`<input id="${id}" name="${E(field)}" type="${inputType}" ${numberField?'min="0" step="1"':''} value="${E(v)}" ${disabled} ${["title","name","code"].includes(field)?"required":""} placeholder="${E(label)}">`}</div>`;
}
window.createGeneric=type=>openGenericEditor(type,null);
window.editGeneric=(type,idv)=>openGenericEditor(type,idv);
function openGenericEditor(type,idv){
  const x=idv===null||idv===undefined?null:(state.admin[type]||[]).find(o=>String(o.id??o.code)===String(idv));if(idv!==null&&idv!==undefined&&!x){toast("Không tìm thấy bản ghi cần sửa.","bad");return;}
  const fields=genericFields[type]||[],isEdit=!!x;
  const defaults=type==="classes"?{unit_code:"SFEC",title:"",level:"",status:"Đang mở đăng ký",capacity:"",schedule_json:"{}",data_json:"{}"}:type==="events"?{unit_code:"SFN",title:"",start_at:"",end_at:"",status:"Sắp diễn ra",capacity:"",data_json:"{}"}:type==="units"?{code:"",name:"",unit_type:"",manager_name:"",email:"",status:"Đang hoạt động",data_json:"{}"}:type==="documents"?{code:"",doc_type:"",title:"",visibility:"internal",status:"Có hiệu lực",file_id:"",issued_at:"",metadata_json:"{}"}:{title:"",description:"",assigned_to:"",unit_code:"",status:"Cần làm",priority:"Bình thường",due_at:""};
  const values={...defaults,...(x||{})};
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">DỮ LIỆU / ${isEdit?"CHỈNH SỬA":"BẢN GHI MỚI"}</span><h2>${isEdit?"Chỉnh sửa bản ghi":"Thêm bản ghi mới"}</h2><p class="muted">Trường có dấu * là bắt buộc. JSON phải đúng định dạng trước khi lưu.</p></div><button type="button" class="admin-modal-close" id="genericClose" aria-label="Đóng">×</button></div><form id="genericEditor" data-type="${E(type)}" data-id="${E(x?.id??x?.code??"")}"><div class="admin-generic-form-grid">${fields.map(f=>genericFieldControl(type,f,values[f],isEdit)).join("")}</div><div class="admin-sticky-save"><span>${isEdit?`Bản ghi ${E(x.id??x.code)}`:"Bản ghi mới chưa lưu"}</span><div><button type="button" class="secondary" id="genericCancel">Hủy</button><button type="submit" class="primary" id="genericSave">${isEdit?"Lưu thay đổi":"Tạo bản ghi"}</button></div></div></form>`);
  document.getElementById("genericClose")?.addEventListener("click",closeModal);document.getElementById("genericCancel")?.addEventListener("click",closeModal);
  document.getElementById("genericEditor").addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,save=document.getElementById("genericSave"),fd=new FormData(form),body={};
    try{
      for(const f of fields){let value=fd.get(f);if(["capacity","assigned_to"].includes(f)){value=value===""?null:Number(value);if(value!==null&&(!Number.isFinite(value)||value<0||!Number.isInteger(value)))throw new Error(`Giá trị ${adminFieldLabel(f)} phải là số nguyên không âm.`);}else if(f.endsWith("_json")){const raw=String(value||"").trim()||"{}";JSON.parse(raw);value=raw;}else if(["published_at","start_at","end_at","issued_at","due_at"].includes(f)){value=value?`${value}:00+07:00`:null;}else value=String(value??"").trim();body[f]=value;}
      if(type==="units"&&!isEdit&&!body.code)throw new Error("Mã đơn vị là bắt buộc.");
      if(isEdit&&type!=="units")body.id=x.id;
      if(type==="units"&&isEdit)body.code=x.code;
      save.disabled=true;save.textContent="Đang lưu…";
      if(isEdit)await api(`/api/admin/content/${type}/${encodeURIComponent(x.id??x.code)}`,{method:"PUT",body});else await api(`/api/admin/content/${type}`,{method:"POST",body});
      closeModal();toast(isEdit?"Đã cập nhật bản ghi.":"Đã tạo bản ghi.");await adminGeneric(document.getElementById("adminMain"),type,adminTitle(type),displayFields(type));
    }catch(err){toast(errorText(err),"bad");save.disabled=false;save.textContent=isEdit?"Lưu thay đổi":"Tạo bản ghi";}
  });
}
window.deleteGeneric=(type,idv)=>confirmDeleteGeneric(type,idv);
window.confirmDeleteGeneric=(type,idv)=>{
  const x=(state.admin[type]||[]).find(o=>String(o.id??o.code)===String(idv));if(!x)return;
  const label=x.title||x.name||x.code||x.id||"bản ghi";
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">XÁC NHẬN THAO TÁC</span><h2>Xóa bản ghi?</h2></div><button type="button" class="admin-modal-close" id="genericDeleteClose" aria-label="Đóng">×</button></div><p>Bản ghi <b>${E(label)}</b> sẽ bị xóa. Thao tác này không thể hoàn tác.</p><div class="admin-sticky-save"><button type="button" class="secondary" id="genericDeleteCancel">Giữ lại</button><button type="button" class="danger" id="genericDeleteConfirm">Xác nhận xóa</button></div>`);
  document.getElementById("genericDeleteClose")?.addEventListener("click",closeModal);document.getElementById("genericDeleteCancel")?.addEventListener("click",closeModal);
  document.getElementById("genericDeleteConfirm").addEventListener("click",async e=>{const btn=e.currentTarget;btn.disabled=true;btn.textContent="Đang xóa…";try{await api(`/api/admin/content/${type}/${encodeURIComponent(idv)}`,{method:"DELETE"});closeModal();toast("Đã xóa bản ghi.");await adminGeneric(document.getElementById("adminMain"),type,adminTitle(type),displayFields(type));}catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Xác nhận xóa";}});
};

function adminTitle(t){
  return {
    news:"Tin tức & Thông báo",
    classes:"Lớp học",
    events:"Sự kiện",
    units:"Đơn vị trực thuộc",
    documents:"Kho văn bản",
    tasks:"Nhiệm vụ"
  }[t]||t;
}

function displayFields(t){
  return {
    news:["title","slug","status","published_at"],
    classes:["unit_code","title","level","status","capacity"],
    events:["unit_code","title","start_at","status"],
    units:["code","name","unit_type","manager_name","status"],
    documents:["code","doc_type","title","visibility","status"],
    tasks:["title","assigned_to","unit_code","status","priority","due_at"]
  }[t]||[];
}

window.attendanceTool=async()=>{
  const classId=await adminPrompt("ID lớp (ví dụ SFEC-L9)","",{title:"Mở công cụ điểm danh",required:true});
  if(classId===null||!classId.trim())return;

  try{
    const d=await api(
      `/api/admin/class-enrollments?class_id=${encodeURIComponent(classId)}`
    );

    modal(`<h2>Điểm danh ${E(classId)}</h2>${(d.items||[]).map(x=>`<div class="card"><b>${E(x.full_name)}</b> — ${E(x.email||"")}<div class="actions"><button class="secondary" onclick="markAttendance('${E(classId)}',${x.id},'Có mặt')">Có mặt</button><button class="secondary" onclick="markAttendance('${E(classId)}',${x.id},'Có phép')">Có phép</button><button class="danger" onclick="markAttendance('${E(classId)}',${x.id},'Vắng')">Vắng</button></div></div>`).join("")||"<p>Chưa có học viên.</p>"}`);
  }catch(e){
    toast(errorText(e),"bad");
  }
};

window.markAttendance=(classId,enrollmentId,status)=>api(
  "/api/admin/attendance",
  {
    method:"POST",
    body:{
      class_id:classId,
      enrollment_id:enrollmentId,
      session_date:cttToday(),
      status
    }
  }
).then(()=>toast("Đã điểm danh."))
 .catch(e=>toast(errorText(e),"bad"));

window.checkinTool=async()=>{
  const code=await adminPrompt("Mã check-in","",{title:"Check-in sự kiện",required:true});
  if(code===null||!code.trim())return;
  api("/api/admin/event-checkin",{method:"POST",body:{checkin_code:code.trim()}})
    .then(()=>toast("Check-in thành công."))
    .catch(e=>toast(errorText(e),"bad"));
};

async function adminCertificates(main){
  const d=await api("/api/admin/certificates");
  state.admin.certificates=d.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Giấy đã phát hành</h1><button class="primary" onclick="requestCertificate()">+ Phát hành giấy</button></div>
  <div class="notice"><b>Quy trình chuẩn: Đề nghị → Thẩm định & Phê duyệt → Phát hành chính thức → Xác thực trực tuyến → Thu hồi / Thay thế.</b> Mã định danh chỉ được sinh khi Phát hành chính thức (dạng <code>SFN-GCN/GXN/BK-########</code>); các mã lịch sử được bảo toàn nguyên trạng.</div>
  <div class="card table-scroll"><table><thead><tr><th>Mã chứng nhận</th><th>Người được ghi nhận</th><th>Nội dung ghi nhận</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${state.admin.certificates.map(c=>`<tr><td><b>${E(c.code||"Chưa phát hành")}</b></td><td>${E(c.full_name)}<br><span class="small muted">${E(c.cert_type||"")}</span></td><td>${E(c.content)}</td><td><span class="status">${E(c.status)}</span></td><td><button class="secondary" onclick="credentialHistory('${E(c.id)}')">Lịch sử</button> ${c.status==="approved"?`<button class="primary" onclick="issueCert('${E(c.id)}')">Phát hành</button>`:""}${c.status==="issued"?` <button class="secondary" onclick="showCertQR('${E(c.code)}')">Mã QR</button> <button class="secondary" onclick="supersedeCert('${E(c.id)}')">Thay thế</button> <button class="danger" onclick="revokeCert('${E(c.id)}')">Thu hồi</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}

window.requestCertificate=()=>{
  modal(`
    <button class="ghost" onclick="closeModal()">✕ Đóng</button>

    <h2>Chuẩn bị GCN / GXN / BK</h2>

    <p class="muted">
      Thông tin dưới đây là dữ liệu chính thức dùng cho quy trình
      phê duyệt, phát hành và tra cứu GCN/GXN.
    </p>

    <form id="certificateRequestForm">

      <div class="row2">
        <div class="field">
          <label>Họ và tên người được cấp *</label>
          <input name="full_name" required>
        </div>

        <div class="field">
          <label>Email</label>
          <input name="email" type="email">
        </div>
      </div>

      <div class="row2">
        <div class="field">
          <label>Loại *</label>
          <select name="cert_type" required>
            <option value="Giấy chứng nhận">Giấy chứng nhận</option>
            <option value="Giấy xác nhận">Giấy xác nhận</option>
            <option value="Bằng khen">Bằng khen</option>
          </select>
        </div>

        <div class="field">
          <label>Đơn vị ghi nhận *</label>
          <input
            name="unit_name"
            required
            placeholder="Ví dụ: Câu lạc bộ Tiếng Anh The Sky First"
          >
        </div>
      </div>

      <div class="field">
        <label>Chương trình / Hoạt động</label>
        <input
          name="program"
          placeholder="Tên chương trình, hoạt động, sự kiện hoặc lớp học"
        >
      </div>

      <div class="field">
        <label>Vai trò / Tư cách tham gia</label>
        <input
          name="role"
          placeholder="Ví dụ: Tình nguyện viên, Thành viên Ban Tổ chức..."
        >
      </div>

      <div class="field">
        <label>Nội dung ghi nhận *</label>
        <textarea
          name="content"
          required
          placeholder="Nội dung chính thức được xác nhận hoặc chứng nhận"
        ></textarea>
      </div>

      <div class="actions">
        <button class="primary" type="submit">
          Gửi đề nghị cấp
        </button>

        <button class="secondary" type="button" onclick="closeModal()">
          Hủy
        </button>
      </div>

    </form>
  `);

  document.getElementById("certificateRequestForm").onsubmit=async e=>{
    e.preventDefault();

    const form=e.target;
    const f=new FormData(form);
    const button=form.querySelector('button[type="submit"]');

    const payload={
      full_name:String(f.get("full_name")||"").trim(),
      email:String(f.get("email")||"").trim(),
      cert_type:String(f.get("cert_type")||"").trim(),
      content:String(f.get("content")||"").trim(),

      metadata:{
        unit_name:String(f.get("unit_name")||"").trim(),
        program:String(f.get("program")||"").trim(),
        role:String(f.get("role")||"").trim()
      }
    };

    button.disabled=true;
    button.textContent="Đang gửi…";

    try{
      await api("/api/admin/certificates",{
        method:"POST",
        body:payload
      });

      closeModal();
      toast("Đã tạo đề nghị cấp chứng nhận ở trạng thái chờ duyệt.");
      adminCertificates(document.getElementById("adminMain"));

    }catch(err){
      toast(errorText(err),"bad");
      button.disabled=false;
      button.textContent="Gửi đề nghị cấp";
    }
  };
};

window.issueCert=idc=>api(
  `/api/admin/certificates/${encodeURIComponent(idc)}`,
  {
    method:"PATCH",
    body:{action:"issue"}
  }
).then(d=>{
  toast("Đã phát hành: "+d.code);
  adminCertificates(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

window.showCertQR=code=>{
  const text=`${location.origin}/gcn/${encodeURIComponent(code)}`;
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">MÃ XÁC THỰC CHỨNG NHẬN</span><h2>QR xác thực — ${E(code)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div><p class="muted">Liên kết xác thực công khai chỉ chứa mã định danh công khai, tuyệt đối không gửi dữ liệu cá nhân ra dịch vụ bên ngoài.</p><div class="card" style="text-align:center;padding:20px;"><code>${E(text)}</code></div><div class="actions" style="margin-top:12px;"><a class="primary" href="/gcn/${encodeURIComponent(code)}" onclick="closeModal()">Mở trang xác thực công khai ↗</a><button type="button" class="secondary" onclick="navigator.clipboard?.writeText('${E(text)}').then(()=>toast('Đã sao chép liên kết xác thực.'))">Sao chép liên kết</button></div>`);
};

window.revokeCert=async idc=>{
  const note=await adminPrompt("Lý do thu hồi","",{title:"Thu hồi giấy đã phát hành",type:"textarea",required:true});
  if(note===null||!note.trim())return;
  if(!await adminConfirm("Giấy sẽ được chuyển sang trạng thái thu hồi. Hãy chắc chắn lý do đã chính xác.",{title:"Xác nhận thu hồi",confirmText:"Thu hồi giấy",danger:true}))return;
  api(`/api/admin/certificates/${encodeURIComponent(idc)}`,{method:"PATCH",body:{action:"revoke",note:note.trim()}})
    .then(()=>{toast("Đã thu hồi.");adminCertificates(document.getElementById("adminMain"));})
    .catch(e=>toast(errorText(e),"bad"));
};

window.supersedeCert=async idc=>{
  const note=await adminPrompt("Lý do cần thay thế giấy","",{title:"Yêu cầu thay thế giấy",type:"textarea",required:true});if(note===null||!note.trim())return;
  if(!await adminConfirm("Tạo một yêu cầu thay thế chờ phê duyệt; giấy hiện tại chưa bị thay đổi cho đến khi bản mới được phát hành.",{title:"Xác nhận yêu cầu thay thế",confirmText:"Gửi yêu cầu"}))return;
  api(`/api/admin/certificates/${encodeURIComponent(idc)}`,{method:"PATCH",body:{action:"supersede",note:note.trim()}}).then(()=>{toast("Đã tạo bản thay thế chờ phê duyệt.");adminCertificates(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"));
};
window.credentialHistory=async idc=>{
  try{const d=await api(`/api/admin/certificates/${encodeURIComponent(idc)}/history`);modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Lịch sử giấy đã phát hành</h2><p><b>${E(d.item.code||'Chưa phát hành')}</b> · ${E(d.item.full_name)} · ${E(d.item.status)}</p><div class="timeline-admin">${(d.history||[]).map(h=>`<div class="card"><b>${E(h.action)}</b><p>${E(h.note||'')}</p><small>${fmt(h.created_at)}${h.actor_id?` · Người thực hiện #${E(h.actor_id)}`:''}</small></div>`).join('')||'<p>Chưa có lịch sử thao tác.</p>'}</div>`)}catch(e){toast(errorText(e),'bad')}
};

async function adminTickets(main){
  const d=await api("/api/admin/tickets");
  state.admin.tickets=d.items||[];

  main.innerHTML=`<h1>Quản lý Phiếu hỗ trợ</h1><div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Người gửi</th><th>Loại</th><th>Ưu tiên</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.tickets.map(t=>`<tr><td><b>${E(t.code)}</b></td><td>${E(t.submitter_name||"")}<br>${E(t.email||"")}</td><td>${E(t.ticket_type||"")}</td><td>${E(t.priority)}</td><td>${E(t.status)}</td><td><button class="secondary" onclick="editTicket('${E(t.id)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.editTicket=idt=>{
  const t=state.admin.tickets.find(x=>x.id===idt);
  if(!t)return;

  modal(`<h2>${E(t.code)}</h2><div class="field"><label>Ưu tiên</label><select id="tPriority">${["Thấp","Bình thường","Cao","Khẩn"].map(x=>`<option ${x===t.priority?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Trạng thái</label><select id="tStatus">${["Mới","Đang xử lý","Chờ phản hồi","Đã giải quyết","Đã đóng"].map(x=>`<option ${x===t.status?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Phản hồi nội bộ</label><textarea id="tMessage"></textarea></div><button class="primary" onclick="saveTicket('${E(idt)}')">Lưu</button>`);
};

window.saveTicket=idt=>api(`/api/admin/tickets/${encodeURIComponent(idt)}`,{
  method:"PATCH",
  body:{
    priority:document.getElementById("tPriority").value,
    status:document.getElementById("tStatus").value,
    message:document.getElementById("tMessage").value
  }
}).then(()=>{
  closeModal();
  toast("Đã cập nhật phiếu hỗ trợ.");
  adminTickets(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

async function adminFiles(main){
  const d=await api("/api/admin/files");
  state.admin.filesList=d.items||[];
  state.admin.filesPage=1;
  state.admin.filesQuery="";
  state.admin.filesVis="all";

  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">KHO TỆP & MINH CHỨNG HỆ THỐNG</span><h1>Quản lý Tệp & Minh chứng (/admin/files)</h1><p class="muted">Quản lý toàn bộ tệp đính kèm hồ sơ, tài liệu PDF và minh chứng lưu trữ trên R2/D1. Hỗ trợ tìm kiếm tức thời, lọc theo phạm vi truy cập, phân trang và kiểm tra an toàn tham chiếu trước khi xóa.</p></div><button type="button" class="primary" onclick="uploadAdminFile()">+ Tải tệp mới lên</button></div>
  <section class="card admin-card-premium">
    <div class="toolbar">
      <label class="admin-searchbox" style="flex:1;min-width:240px;"><span>⌕</span><input id="adminFilesSearch" type="search" placeholder="Tìm theo tên tệp, mã hồ sơ, loại MIME hoặc mã tệp…" aria-label="Tìm kiếm tệp"></label>
      <select id="adminFilesVisFilter" aria-label="Lọc quyền truy cập">
        <option value="all">Tất cả quyền truy cập</option>
        <option value="public">Công khai (Public)</option>
        <option value="private">Nội bộ / Bảo mật (Private)</option>
      </select>
      <span id="adminFilesSummary" class="small muted"></span>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Tên tệp & Mã định danh</th><th>Hồ sơ / Trường liên kết</th><th>Định dạng (MIME)</th><th>Dung lượng</th><th>Quyền truy cập</th><th>Thời gian tải lên</th><th>Thao tác</th></tr></thead>
        <tbody id="adminFilesRows"></tbody>
      </table>
    </div>
    <div class="toolbar" id="adminFilesPager" style="margin-top:12px;justify-content:space-between;"></div>
  </section>`;

  const renderRows=()=>{
    const q=(state.admin.filesQuery||"").toLowerCase();
    const vis=state.admin.filesVis||"all";
    const filtered=(state.admin.filesList||[]).filter(f=>{
      if(vis!=="all"&&f.visibility!==vis) return false;
      if(q&&![f.id,f.filename,f.mime,f.submission_code,f.field_key].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    const pageSize=25;
    const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
    if(state.admin.filesPage>totalPages) state.admin.filesPage=totalPages;
    const start=(state.admin.filesPage-1)*pageSize;
    const pageItems=filtered.slice(start,start+pageSize);

    const summaryEl=document.getElementById("adminFilesSummary");
    if(summaryEl) summaryEl.textContent=`Hiển thị ${pageItems.length} / ${filtered.length} tệp`;

    const tbody=document.getElementById("adminFilesRows");
    if(tbody){
      tbody.innerHTML=pageItems.map(f=>`<tr>
        <td><a href="/api/files/${encodeURIComponent(f.id)}" target="_blank" rel="noopener"><b>${E(f.filename||f.id)}</b></a><br><small class="muted">Mã: <code>${E(f.id)}</code>${f.sha256?` · SHA-256: <code>${E(f.sha256.slice(0,12))}…</code>`:""}</small></td>
        <td>${f.submission_code?`<b>${E(f.submission_code)}</b><br><small class="muted">${E(f.field_key||"")}</small>`:"<span class='muted'>Tải lên trực tiếp</span>"}</td>
        <td><code>${E(f.mime||"application/octet-stream")}</code></td>
        <td>${Math.max(1,Math.round((f.size||0)/1024))} KB</td>
        <td><span class="status ${f.visibility==="public"?"":"status-warn"}">${f.visibility==="public"?"Công khai":"Nội bộ"}</span></td>
        <td>${fmt(f.created_at)}</td>
        <td><div class="admin-row-actions"><a class="secondary" href="/api/files/${encodeURIComponent(f.id)}" target="_blank" rel="noopener">Xem</a><a class="secondary" href="/api/files/${encodeURIComponent(f.id)}?download=1">Tải về</a><button type="button" class="danger" onclick="deleteFile('${E(f.id)}')">Xóa</button></div></td>
      </tr>`).join("")||`<tr><td colspan="7" class="muted">Không có tệp nào phù hợp với bộ lọc hiện tại.</td></tr>`;
    }

    const pager=document.getElementById("adminFilesPager");
    if(pager){
      pager.innerHTML=`<span class="small muted">Trang ${state.admin.filesPage} / ${totalPages} (Tổng ${filtered.length} tệp)</span>
      <div style="display:flex;gap:6px;">
        <button type="button" class="secondary" id="filesPrevPage" ${state.admin.filesPage<=1?"disabled":""}>← Trang trước</button>
        <button type="button" class="secondary" id="filesNextPage" ${state.admin.filesPage>=totalPages?"disabled":""}>Trang sau →</button>
      </div>`;
      document.getElementById("filesPrevPage")?.addEventListener("click",()=>{if(state.admin.filesPage>1){state.admin.filesPage--;renderRows();}});
      document.getElementById("filesNextPage")?.addEventListener("click",()=>{if(state.admin.filesPage<totalPages){state.admin.filesPage++;renderRows();}});
    }
  };

  document.getElementById("adminFilesSearch")?.addEventListener("input",e=>{state.admin.filesQuery=e.target.value.trim();state.admin.filesPage=1;renderRows();});
  document.getElementById("adminFilesVisFilter")?.addEventListener("change",e=>{state.admin.filesVis=e.target.value;state.admin.filesPage=1;renderRows();});
  renderRows();
}

window.uploadAdminFile=()=>{
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">KHO TỆP & MINH CHỨNG</span><h2>Tải tệp mới lên hệ thống</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <form id="upFile">
    <div class="field"><label for="upFileInput">Chọn tệp từ thiết bị *</label><input id="upFileInput" name="file" type="file" required></div>
    <div class="check"><input id="upFilePublic" name="public" type="checkbox"><label for="upFilePublic">Cho phép truy cập công khai (Public)</label></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="submit" class="primary" id="upFileSubmitBtn">Tải tệp lên</button></div>
  </form>`);

  document.getElementById("upFile").onsubmit=async e=>{
    e.preventDefault();
    const btn=document.getElementById("upFileSubmitBtn");
    const f=new FormData(e.target);
    const fd=new FormData();
    fd.append("file",f.get("file"));
    fd.append("visibility",f.get("public")?"public":"private");
    if(btn){btn.disabled=true;btn.textContent="Đang tải lên…";}
    try{
      await api("/api/admin/upload",{method:"POST",body:fd});
      closeModal();
      toast("Đã tải tệp lên kho lưu trữ thành công.");
      adminFiles(document.getElementById("adminMain"));
    }catch(err){
      toast(errorText(err),"bad");
      if(btn){btn.disabled=false;btn.textContent="Tải tệp lên";}
    }
  };
};

window.deleteFile=async idf=>{
  if(!await adminConfirm("Tệp sẽ bị xóa khỏi kho lưu trữ sau khi hệ thống kiểm tra không còn hồ sơ, tài liệu hay chứng nhận nào đang tham chiếu. Thao tác này không thể hoàn tác.",{title:"Xóa tệp khỏi kho lưu trữ",confirmText:"Xác nhận xóa tệp",danger:true}))return;
  api(`/api/admin/files/${encodeURIComponent(idf)}`,{method:"DELETE"})
    .then(()=>{toast("Đã xóa tệp khỏi kho lưu trữ.");adminFiles(document.getElementById("adminMain"));})
    .catch(e=>toast(errorText(e),"bad"));
};

const EMAIL_TEMPLATE_META = {
  submission_confirmation: {name:"Xác nhận tiếp nhận hồ sơ", group:"Hồ sơ & Biểu mẫu", trigger:"Khi người dùng gửi biểu mẫu hồ sơ thành công", file:"email_universal_auto.html"},
  registration_confirmation: {name:"Xác nhận đăng ký chương trình/sự kiện", group:"Chương trình & Sự kiện", trigger:"Khi đăng ký lớp học hoặc sự kiện thành công", file:"email_universal_auto.html"},
  certificate_issued: {name:"Thông báo phát hành chứng nhận", group:"Chứng nhận", trigger:"Khi chứng nhận được cấp mã và phát hành chính thức", file:"email_universal_auto.html"},
  certificate_revoked: {name:"Thông báo thu hồi / thay thế chứng nhận", group:"Chứng nhận", trigger:"Khi chứng nhận bị thu hồi hoặc được thay thế", file:"email_universal_auto.html"},
  status_update: {name:"Cập nhật trạng thái hồ sơ", group:"Hồ sơ & Biểu mẫu", trigger:"Khi hồ sơ chuyển trạng thái xử lý thông thường", file:"email_universal_auto.html"},
  information_required: {name:"Yêu cầu bổ sung thông tin", group:"Hồ sơ & Biểu mẫu", trigger:"Khi hồ sơ chuyển sang trạng thái 'Cần bổ sung'", file:"email_universal_auto.html"},
  application_result: {name:"Thông báo kết quả xử lý hồ sơ", group:"Hồ sơ & Biểu mẫu", trigger:"Khi hồ sơ hoàn tất / đã duyệt / có kết quả cuối", file:"email_universal_auto.html"},
  interview_scheduled: {name:"Thông báo lịch phỏng vấn / làm việc", group:"Hồ sơ & Biểu mẫu", trigger:"Khi tạo lịch phỏng vấn cho hồ sơ ứng viên", file:"email_universal_auto.html"},
  account_invite: {name:"Kích hoạt / Thông báo tài khoản", group:"Tài khoản & Bảo mật", trigger:"Khi tạo tài khoản quản trị mới", file:"email_universal_auto.html"},
  support_ticket_received: {name:"Xác nhận yêu cầu hỗ trợ / an toàn", group:"Hỗ trợ & An toàn", trigger:"Khi người dùng gửi biểu mẫu hỗ trợ hoặc báo cáo sự cố an toàn", file:"email_universal_auto.html"},
  support_ticket_reply: {name:"Phản hồi yêu cầu hỗ trợ", group:"Hỗ trợ & An toàn", trigger:"Khi bộ phận hỗ trợ gửi phản hồi trên ticket", file:"email_universal_auto.html"},
  fundraising_update: {name:"Thông báo cập nhật minh bạch tài trợ", group:"Tài trợ", trigger:"Khi công bố báo cáo hoặc cập nhật chương trình tài trợ", file:"email_universal_auto.html"},
  submission_internal: {name:"Thông báo hồ sơ mới (Quản trị viên)", group:"Quản trị nội bộ", trigger:"Gửi về địa chỉ tiếp nhận nội bộ khi có hồ sơ mới", file:"email_universal_auto.html"},
  verify_email: {name:"Xác minh địa chỉ email", group:"Tài khoản & Bảo mật", trigger:"Khi yêu cầu xác minh email tài khoản", file:"email_universal_auto.html"},
  password_reset: {name:"Hướng dẫn đặt lại mật khẩu", group:"Tài khoản & Bảo mật", trigger:"Khi quản trị viên cấp liên kết đặt lại mật khẩu", file:"email_universal_auto.html"},
  document_published: {name:"Thông báo phát hành tài liệu số", group:"Tài liệu & Thư viện PDF", trigger:"Khi tài liệu mới được phê duyệt và công bố", file:"email_universal_auto.html"}
};

async function adminEmail(main){
  const [t,l]=await Promise.all([
    api("/api/admin/email-templates"),
    api("/api/admin/email-logs")
  ]);
  state.admin.emailTemplates=t.items||[];
  const logs=l.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">TRUNG TÂM EMAIL TỰ ĐỘNG</span><h1>Quản lý Mẫu Email & Nhật ký Gửi thư</h1><p class="muted">Quản lý thư viện mẫu HTML email theo sự kiện nghiệp vụ, xem trước nội dung, gửi thử nghiệm và đối soát nhật ký gửi thư.</p></div></div>
  <div class="notice"><b>Địa chỉ email chuẩn của hệ thống:</b> Thông báo tự động: <code>app@skyfirst.io.vn</code> · Liên hệ chung: <code>lienhe@skyfirst.io.vn</code> · Hỗ trợ kỹ thuật: <code>support@skyfirst.io.vn</code>.</div>
  <section class="card admin-card-premium" style="margin-top:16px;">
    <div class="admin-card-heading"><div><span class="eyebrow">01 / THƯ VIỆN MẪU EMAIL HTML</span><h2>Danh sách mẫu email tự động (${state.admin.emailTemplates.length})</h2></div></div>
    <div class="table-scroll"><table><thead><tr><th>Mã mẫu & Tệp HTML</th><th>Tên mẫu & Sự kiện kích hoạt</th><th>Nhóm nghiệp vụ</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>
      ${state.admin.emailTemplates.map(x=>{
        const m=EMAIL_TEMPLATE_META[x.key]||{name:x.key,group:"Hệ thống",trigger:"Theo cấu hình hệ thống",file:"—"};
        return `<tr>
          <td><b>${E(x.key)}</b><br><small class="muted">${E(m.file)}</small></td>
          <td><b>${E(m.name)}</b><br><small class="muted">Tiêu đề: ${E(x.subject_template)}</small><br><small class="muted">Kích hoạt: ${E(m.trigger)}</small></td>
          <td><span class="pill">${E(m.group)}</span></td>
          <td><span class="status ${x.enabled?"":"status-warn"}">${x.enabled?"Đang sử dụng":"Tạm ngừng"}</span></td>
          <td>${fmt(x.updated_at)}</td>
          <td><div class="admin-row-actions"><button type="button" class="secondary" onclick="previewEmailTemplate('${E(x.key)}')">Xem trước</button><button type="button" class="secondary" onclick="editEmailTemplate('${E(x.key)}')">Chỉnh sửa</button><button type="button" class="secondary" onclick="viewEmailTemplateVersions('${E(x.key)}')">Phiên bản</button><button type="button" class="ghost" onclick="testEmailTemplate('${E(x.key)}')">Gửi thử</button></div></td>
        </tr>`;
      }).join("")}
    </tbody></table></div>
  </section>
  <section class="card admin-card-premium" style="margin-top:18px;">
    <div class="admin-card-heading"><div><span class="eyebrow">02 / NHẬT KÝ GỬI THƯ</span><h2>Lịch sử gửi email (${logs.length})</h2></div></div>
    <div class="table-scroll"><table><thead><tr><th>Người nhận</th><th>Mẫu sử dụng</th><th>Tiêu đề</th><th>Trạng thái xử lý</th><th>Thời điểm</th><th>Thông tin đối soát / Lỗi</th></tr></thead><tbody>
      ${logs.slice(0,300).map(x=>`<tr><td>${E(x.to_email)}</td><td><code>${E(x.template_key||"—")}</code></td><td>${E(x.subject||"")}</td><td><span class="status ${x.status==="sent"?"":x.status==="pending"?"status-warn":"bad"}">${x.status==="sent"?"Đã gửi tới nhà cung cấp":x.status==="pending"?"Chờ cấu hình gửi":"Gửi thất bại"}</span></td><td>${fmt(x.created_at)}</td><td><small>${E(x.provider_message_id||x.error||"—")}</small></td></tr>`).join("")||`<tr><td colspan="6" class="muted">Chưa có bản ghi nhật ký gửi thư.</td></tr>`}
    </tbody></table></div>
  </section>`;
}

window.previewEmailTemplate=async key=>{
  try{
    const d=await api(`/api/admin/email-templates/${encodeURIComponent(key)}/preview`,{method:"POST",body:{}});
    const p=d.preview||{};
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">XEM TRƯỚC MẪU EMAIL</span><h2>${E(p.subject||key)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <iframe title="Xem trước HTML Email" style="width:100%;height:480px;border:1px solid var(--line);border-radius:12px;background:#fff;" srcdoc="${E(p.html||"")}"></iframe>
    <details style="margin-top:12px;"><summary><b>Phiên bản văn bản thuần (Plain Text)</b></summary><pre class="card" style="white-space:pre-wrap;margin-top:8px;">${E(p.text||"")}</pre></details>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button><button type="button" class="primary" onclick="editEmailTemplate('${E(key)}')">Chỉnh sửa mẫu này</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

window.testEmailTemplate=async key=>{
  const to=await adminPrompt("Nhập địa chỉ email nhận bản gửi thử:",state.user?.email||"support@skyfirst.io.vn",{title:`Gửi thử mẫu: ${key}`,type:"email",required:true});
  if(!to) return;
  try{
    const r=await api(`/api/admin/email-templates/${encodeURIComponent(key)}/test`,{method:"POST",body:{to_email:to}});
    toast(r.message||"Đã thực hiện kiểm tra gửi thử email.",r.ok?"good":"warn");
    adminEmail(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.editEmailTemplate=key=>{
  const x=state.admin.emailTemplates.find(t=>t.key===key);
  if(!x)return;
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">CHỈNH SỬA MẪU EMAIL</span><h2>${E(key)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <div class="field"><label for="etSubject">Tiêu đề email *</label><input id="etSubject" value="${E(x.subject_template)}"></div>
  <div class="field"><label for="etEnabled">Trạng thái kích hoạt</label><select id="etEnabled"><option value="1" ${x.enabled?"selected":""}>Đang sử dụng</option><option value="0" ${!x.enabled?"selected":""}>Tạm ngừng</option></select></div>
  <div class="field"><label for="etHtml">Nội dung HTML *</label><textarea id="etHtml" rows="10">${E(x.html_template)}</textarea></div>
  <div class="field"><label for="etText">Phiên bản văn bản thuần (Plain Text)</label><textarea id="etText" rows="4">${E(x.text_template||"")}</textarea></div>
  <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button class="primary" onclick="saveEmailTemplate('${E(key)}')">Lưu phiên bản mẫu</button></div>`);
};

window.saveEmailTemplate=key=>api(
  `/api/admin/email-templates/${encodeURIComponent(key)}`,
  {
    method:"PUT",
    body:{
      subject_template:document.getElementById("etSubject").value,
      html_template:document.getElementById("etHtml").value,
      text_template:document.getElementById("etText").value,
      enabled:document.getElementById("etEnabled").value==="1"
    }
  }
).then(()=>{
  closeModal();
  toast("Đã lưu mẫu email và ghi nhận lịch sử phiên bản.");
  adminEmail(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

// ================= QUẢN LÝ MINH BẠCH TÀI TRỢ & VIETQR (#admin/sponsorship) =================
const ADMIN_NAPAS_BANKS=[
  {bin:"970436",code:"VCB",short_name:"Vietcombank",name:"Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)"},
  {bin:"970415",code:"ICB",short_name:"VietinBank",name:"Ngân hàng TMCP Công thương Việt Nam (VietinBank)"},
  {bin:"970418",code:"BIDV",short_name:"BIDV",name:"Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)"},
  {bin:"970405",code:"VBA",short_name:"Agribank",name:"Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)"},
  {bin:"970422",code:"MB",short_name:"MBBank",name:"Ngân hàng TMCP Quân đội (MB Bank)"},
  {bin:"970407",code:"TCB",short_name:"Techcombank",name:"Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)"},
  {bin:"970416",code:"ACB",short_name:"ACB",name:"Ngân hàng TMCP Á Châu (ACB)"},
  {bin:"970432",code:"VPB",short_name:"VPBank",name:"Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)"},
  {bin:"970423",code:"TPB",short_name:"TPBank",name:"Ngân hàng TMCP Tiên Phong (TPBank)"},
  {bin:"970403",code:"STB",short_name:"Sacombank",name:"Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)"},
  {bin:"970437",code:"HDB",short_name:"HDBank",name:"Ngân hàng TMCP Phát triển TP. Hồ Chí Minh (HDBank)"},
  {bin:"970441",code:"VIB",short_name:"VIB",name:"Ngân hàng TMCP Quốc tế Việt Nam (VIB)"},
  {bin:"970443",code:"SHB",short_name:"SHB",name:"Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)"},
  {bin:"970431",code:"EIB",short_name:"Eximbank",name:"Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)"},
  {bin:"970426",code:"MSB",short_name:"MSB",name:"Ngân hàng TMCP Hàng Hải Việt Nam (MSB)"},
  {bin:"970448",code:"OCB",short_name:"OCB",name:"Ngân hàng TMCP Phương Đông (OCB)"},
  {bin:"970440",code:"SEAB",short_name:"SeABank",name:"Ngân hàng TMCP Đông Nam Á (SeABank)"},
  {bin:"970449",code:"LPB",short_name:"LPBank",name:"Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)"}
];

async function adminSponsorship(main){
  const d=await api("/api/admin/sponsorship");
  state.admin.sponsorship=d;
  const camps=d.campaigns||[],txs=d.transactions||[],reps=d.reports||[],intents=d.payment_intents||[],trail=d.audit_trail||[];
  const fmtVnd=n=>new Intl.NumberFormat("vi-VN").format(Math.round(Number(n||0)))+" đồng";
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">MINH BẠCH TÀI CHÍNH, VIETQR & ĐỐI SOÁT</span><h1>Quản lý Chương trình Tài trợ & Sổ cái Giao dịch</h1><p class="muted">Tách biệt rõ 5 chỉ tiêu: Mục tiêu, Cam kết, Thực nhận, Đã chi và Số dư còn lại. Tích hợp danh mục ngân hàng chuẩn NAPAS 247, sinh mã VietQR chuẩn ISO/IEC 18004 theo từng chiến dịch và đối soát hai bước.</p></div><div class="actions"><button type="button" class="secondary" onclick="location.href='/api/admin/export/sponsorship.csv'">⬇ Xuất CSV đối soát</button><button type="button" class="secondary" onclick="createSponsorshipReport()">+ Thêm báo cáo/chứng từ</button><button type="button" class="secondary" onclick="createSponsorshipTx()">+ Ghi nhận giao dịch</button><button type="button" class="primary" onclick="editSponsorshipCampaign(null)">+ Tạo chương trình tài trợ</button></div></div>
  <section class="card admin-card-premium">
    <div class="admin-card-heading"><div><span class="eyebrow">01 / CHƯƠNG TRÌNH TÀI TRỢ & TÀI KHOẢN VIETQR</span><h2>Danh sách chương trình (${camps.length})</h2></div></div>
    <div class="table-scroll"><table><thead><tr><th>Mã & Tên chương trình</th><th>Tài khoản nhận (VietQR NAPAS)</th><th>Mục tiêu</th><th>Thực nhận</th><th>Đã chi</th><th>Trạng thái & Công khai</th><th>Thao tác</th></tr></thead><tbody>
      ${camps.map(c=>`<tr>
        <td><b>${E(c.code)}</b> — ${E(c.title)}<br><small class="muted">${E(c.summary||"")}</small></td>
        <td><small><b>${E(c.bank_name||"Chưa chọn ngân hàng")}</b>${c.bank_bin?` (<code>BIN: ${E(c.bank_bin)}</code>)`:""}<br>STK: <code>${E(c.bank_account_no||"Chưa cấu hình")}</code><br>${E(c.bank_account_name||"")}</small></td>
        <td>${E(fmtVnd(c.target_amount))}</td>
        <td><b style="color:var(--good)">${E(fmtVnd(c.received_amount))}</b><br><small class="muted">Cam kết: ${E(fmtVnd(c.pledged_amount))}</small></td>
        <td>${E(fmtVnd(c.disbursed_amount))}</td>
        <td><span class="status ${c.visibility==="public"?"":"status-warn"}">${c.visibility==="public"?"Công khai":"Bản nháp nội bộ"}</span> · <small>${E(c.status)}</small></td>
        <td><button type="button" class="secondary" onclick="editSponsorshipCampaign('${E(c.id)}')">Chỉnh sửa / VietQR</button></td>
      </tr>`).join("")||`<tr><td colspan="7" class="muted">Chưa có chương trình tài trợ nào.</td></tr>`}
    </tbody></table></div>
  </section>
  <section class="card admin-card-premium" style="margin-top:18px;">
    <div class="admin-card-heading"><div><span class="eyebrow">02 / GIAO DỊCH ĐỐI SOÁT</span><h2>Nhật ký cam kết, thực nhận & giải ngân (${txs.length})</h2></div></div>
    <div class="table-scroll"><table><thead><tr><th>Mã GD & Tham chiếu</th><th>Chương trình</th><th>Loại</th><th>Số tiền</th><th>Đơn vị hiển thị công khai</th><th>Trạng thái xác minh</th><th>Thao tác</th></tr></thead><tbody>
      ${txs.map(tx=>`<tr>
        <td><b>${E(tx.tx_code)}</b>${(tx.reference_code||tx.bank_ref)?`<br><small class="muted">Tham chiếu: <code>${E(tx.reference_code||tx.bank_ref)}</code></small>`:""}</td>
        <td>${E(tx.campaign_code)}</td>
        <td><span class="pill">${E(tx.tx_type==="pledge"?"Cam kết":tx.tx_type==="receipt"?"Thực nhận":tx.tx_type==="disbursement"?"Giải ngân":tx.tx_type==="refund"?"Hoàn trả":"Điều chỉnh")}</span></td>
        <td><b>${E(fmtVnd(tx.amount))}</b></td>
        <td>${E(tx.public_party_label)}<br><small class="muted">${E(tx.purpose||"")}</small></td>
        <td><span class="status ${tx.verification_status==="verified"?"":"status-warn"}">${tx.verification_status==="verified"?"Đã xác minh":"Chờ đối soát"}</span> (${tx.is_public?"Công khai":"Nội bộ"})</td>
        <td><button type="button" class="secondary" onclick="verifySponsorshipTx('${E(tx.id)}','${tx.verification_status==='verified'?'pending':'verified'}',${tx.is_public?0:1})">${tx.verification_status==="verified"?"Chuyển về chờ đối soát":"Xác minh & Công bố"}</button></td>
      </tr>`).join("")||`<tr><td colspan="7" class="muted">Chưa có giao dịch tài trợ nào.</td></tr>`}
    </tbody></table></div>
  </section>
  <div class="admin-grid2" style="margin-top:18px;">
    <section class="card admin-card-premium">
      <div class="admin-card-heading"><div><span class="eyebrow">03 / PHIÊN CHUYỂN KHOẢN QR</span><h2>Mã tham chiếu QR đã khởi tạo (${intents.length})</h2></div></div>
      <div class="table-scroll"><table><thead><tr><th>Mã tham chiếu</th><th>Số tiền dự kiến</th><th>Nội dung & Ngân hàng</th><th>Trạng thái đối soát</th></tr></thead><tbody>
        ${intents.slice(0,30).map(it=>{
          const refCode=it.reference_code||it.intent_code||"—";
          const amt=it.expected_amount??it.amount??0;
          const memo=it.purpose||it.transfer_memo||refCode;
          const pState=it.payment_state||it.status||"qr_generated";
          const pLabel=pState==="verified"||pState==="paid"?"Đã đối soát":pState==="transfer_reported"?"Người gửi báo đã chuyển (Chờ đối soát)":"Mới tạo mã QR (Chưa xác nhận tiền về)";
          return `<tr><td><b><code>${E(refCode)}</code></b><br><small class="muted">${fmt(it.created_at)}</small></td><td><b>${E(fmtVnd(amt))}</b></td><td><small>${E(memo)}<br>BIN: <code>${E(it.recipient_bank_bin||"—")}</code> · STK: <code>${E(it.recipient_account_no||"—")}</code></small></td><td><span class="status ${pState==="verified"||pState==="paid"?"":"status-warn"}">${E(pLabel)}</span></td></tr>`;
        }).join("")||`<tr><td colspan="4" class="muted">Chưa có phiên mã QR nào được tạo.</td></tr>`}
      </tbody></table></div>
    </section>
    <section class="card admin-card-premium">
      <div class="admin-card-heading"><div><span class="eyebrow">04 / NHẬT KÝ KIỂM TOÁN TÀI TRỢ BẤT BIẾN</span><h2>Lịch sử thay đổi tài chính (${trail.length})</h2></div></div>
      <div class="table-scroll"><table><thead><tr><th>Thời điểm</th><th>Hành động</th><th>Người thực hiện</th><th>Ghi chú</th></tr></thead><tbody>
        ${trail.slice(0,30).map(a=>`<tr><td>${fmt(a.created_at)}</td><td><b>${E(a.action)}</b><br><small><code>${E(a.campaign_id||"")}${a.transaction_id?` / ${E(a.transaction_id)}`:""}</code></small></td><td>${E(a.actor_email||"Hệ thống")}</td><td><small>${E(a.reason||"")}</small></td></tr>`).join("")||`<tr><td colspan="4" class="muted">Chưa có bản ghi kiểm toán tài chính.</td></tr>`}
      </tbody></table></div>
    </section>
  </div>`;
}

window.editSponsorshipCampaign=id=>{
  const banks=state.admin.sponsorship?.napas_banks||state.config?.napas_banks||ADMIN_NAPAS_BANKS;
  const c=id?(state.admin.sponsorship?.campaigns||[]).find(x=>x.id===id):null;
  const x=c||{code:"SFN-TT-2026-01",title:"",summary:"",purpose:"",target_amount:0,bank_bin:"",bank_name:"",bank_account_no:"",bank_account_name:"",status:"active",visibility:"draft"};
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">CHƯƠNG TRÌNH TÀI TRỢ & CẤU HÌNH VIETQR</span><h2>${c?"Cập nhật chương trình tài trợ":"Tạo chương trình tài trợ mới"}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <form id="spCampForm">
    <div class="row2"><div class="field"><label>Mã chương trình *</label><input name="code" value="${E(x.code)}" ${c?"readonly":""} required></div><div class="field"><label>Mục tiêu tài chính (VND) *</label><input name="target_amount" type="number" min="0" step="1000" value="${E(x.target_amount||0)}" required></div></div>
    <div class="field"><label>Tên chương trình tài trợ *</label><input name="title" value="${E(x.title)}" required></div>
    <div class="field"><label>Tóm tắt ngắn</label><input name="summary" value="${E(x.summary||"")}"></div>
    <div class="field"><label>Mục đích sử dụng nguồn lực</label><textarea name="purpose" rows="2">${E(x.purpose||"")}</textarea></div>
    <div class="row2">
      <div class="field">
        <label for="spBankSelect">Ngân hàng thụ hưởng (Danh mục chuẩn NAPAS 247)</label>
        <select id="spBankSelect" name="bank_bin">
          <option value="">-- Chọn ngân hàng thụ hưởng --</option>
          ${banks.map(b=>`<option value="${E(b.bin)}" data-bank-name="${E(b.short_name)}" ${String(x.bank_bin||"")===String(b.bin)?"selected":""}>${E(b.short_name)} (${E(b.code)}) — BIN ${E(b.bin)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label for="spBankNameInput">Tên ngân hàng hiển thị</label><input id="spBankNameInput" name="bank_name" value="${E(x.bank_name||"")}" placeholder="Tự động điền khi chọn ngân hàng"></div>
    </div>
    <div class="row2"><div class="field"><label>Số tài khoản nhận tài trợ</label><input name="bank_account_no" value="${E(x.bank_account_no||"")}" placeholder="Nhập chính xác số tài khoản thụ hưởng"></div><div class="field"><label>Tên chủ tài khoản</label><input name="bank_account_name" value="${E(x.bank_account_name||"")}" placeholder="VD: SKY FIRST NETWORK"></div></div>
    <div class="row2"><div class="field"><label>Trạng thái chương trình</label><select name="status"><option value="active" ${x.status==="active"?"selected":""}>Đang triển khai</option><option value="completed" ${x.status==="completed"?"selected":""}>Đã hoàn thành</option><option value="paused" ${x.status==="paused"?"selected":""}>Tạm dừng</option></select></div><div class="field"><label>Phạm vi hiển thị (cần quyền phê duyệt)</label><select name="visibility"><option value="draft" ${x.visibility!=="public"?"selected":""}>Bản nháp nội bộ</option><option value="public" ${x.visibility==="public"?"selected":""}>Công khai trên trang Tài trợ</option></select></div></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="submit" class="primary">Lưu chương trình</button></div>
  </form>`);
  document.getElementById("spBankSelect")?.addEventListener("change",e=>{
    const opt=e.target.selectedOptions?.[0];
    const nameInput=document.getElementById("spBankNameInput");
    if(opt&&nameInput&&opt.dataset.bankName) nameInput.value=opt.dataset.bankName;
  });
  document.getElementById("spCampForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),body=Object.fromEntries(f);body.target_amount=Number(body.target_amount||0);
    if((body.bank_account_no||body.bank_bin)&&(!body.bank_bin||!body.bank_account_no||!body.bank_account_name)){
      toast("Khi cấu hình tài khoản VietQR, vui lòng chọn đúng Ngân hàng (mã BIN), nhập Số tài khoản và Tên chủ tài khoản.","bad");
      return;
    }
    try{
      if(c) await api(`/api/admin/sponsorship/campaigns/${encodeURIComponent(c.id)}`,{method:"PUT",body});
      else await api("/api/admin/sponsorship/campaigns",{method:"POST",body});
      closeModal();toast("Đã lưu chương trình tài trợ.");adminSponsorship(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad")}
  };
};

window.createSponsorshipTx=()=>{
  const camps=state.admin.sponsorship?.campaigns||[];
  if(!camps.length){toast("Hãy tạo chương trình tài trợ trước khi ghi nhận giao dịch.","warn");return;}
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">ĐỐI SOÁT TÀI CHÍNH</span><h2>Ghi nhận giao dịch tài trợ</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <form id="spTxForm">
    <div class="row2"><div class="field"><label>Chương trình *</label><select name="campaign_id" required>${camps.map(c=>`<option value="${E(c.id)}">${E(c.code)} — ${E(c.title)}</option>`).join("")}</select></div><div class="field"><label>Loại chỉ tiêu *</label><select name="tx_type"><option value="pledge">Khoản cam kết</option><option value="receipt">Khoản thực nhận (Thu)</option><option value="disbursement">Khoản giải ngân / đã chi (Chi)</option><option value="adjustment">Điều chỉnh đối soát</option><option value="refund">Hoàn trả</option></select></div></div>
    <div class="row2"><div class="field"><label>Số tiền (VND, cho phép âm khi điều chỉnh giảm) *</label><input name="amount" type="number" step="1000" required></div><div class="field"><label>Tên hiển thị công khai (ẩn thông tin nhạy cảm) *</label><input name="public_party_label" required placeholder="VD: Nhà tài trợ đồng hành / Chi học liệu đợt 1"></div></div>
    <div class="row2"><div class="field"><label>Mã tham chiếu / Mã giao dịch ngân hàng</label><input name="reference_code" placeholder="VD: SFN-TT-2026-01-123456 hoặc FT26296..."></div><div class="field"><label>Phương thức thanh toán</label><select name="payment_method"><option value="bank_transfer">Chuyển khoản ngân hàng (VietQR)</option><option value="direct">Tiếp nhận trực tiếp</option><option value="contract">Hợp đồng tài trợ</option></select></div></div>
    <div class="field"><label>Nội dung / Mục đích chi tiết</label><textarea name="purpose" rows="2"></textarea></div>
    <div class="check"><input type="checkbox" id="spTxVerify" checked><label for="spTxVerify">Xác minh đối soát và cho phép hiển thị công khai</label></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="submit" class="primary">Lưu giao dịch</button></div>
  </form>`);
  document.getElementById("spTxForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),verified=document.getElementById("spTxVerify").checked;
    try{
      await api("/api/admin/sponsorship/transactions",{method:"POST",body:{campaign_id:f.get("campaign_id"),tx_type:f.get("tx_type"),amount:Number(f.get("amount")),public_party_label:f.get("public_party_label"),reference_code:f.get("reference_code"),payment_method:f.get("payment_method"),purpose:f.get("purpose"),verification_status:verified?"verified":"pending",is_public:verified}});
      closeModal();toast("Đã ghi nhận giao dịch và tự động cập nhật tổng số liệu.");adminSponsorship(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad")}
  };
};

window.verifySponsorshipTx=async(id,status,isPublic)=>{
  try{
    await api(`/api/admin/sponsorship/transactions/${encodeURIComponent(id)}`,{method:"PATCH",body:{verification_status:status,is_public:!!isPublic}});
    toast("Đã cập nhật trạng thái đối soát giao dịch.");adminSponsorship(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.createSponsorshipReport=async()=>{
  const camps=state.admin.sponsorship?.campaigns||[];
  if(!camps.length){toast("Hãy tạo chương trình tài trợ trước.","warn");return;}
  const v=await adminDialog({title:"Thêm báo cáo / chứng từ tài trợ",confirmText:"Lưu báo cáo",fields:[
    {name:"campaign_id",label:"Chương trình",type:"select",required:true,options:camps.map(c=>({value:c.id,label:`${c.code} — ${c.title}`}))},
    {name:"title",label:"Tiêu đề báo cáo / chứng từ",required:true},
    {name:"report_period",label:"Kỳ báo cáo",value:"Quý IV/2026"},
    {name:"file_id",label:"Mã tệp PDF chứng từ (nếu đã tải lên Kho tệp)",required:false},
    {name:"summary",label:"Tóm tắt nội dung",type:"textarea",rows:3},
    {name:"status",label:"Trạng thái",type:"select",value:"published",options:[{value:"published",label:"Công bố công khai"},{value:"draft",label:"Bản nháp"}]}
  ]});
  if(!v)return;
  try{await api("/api/admin/sponsorship/reports",{method:"POST",body:v});toast("Đã lưu báo cáo tài trợ.");adminSponsorship(document.getElementById("adminMain"));}catch(e){toast(errorText(e),"bad")}
};

// ================= QUẢN LÝ BÁO CÁO AN TOÀN SỐ (#admin/safety) =================
async function adminSafety(main){
  const d=await api("/api/admin/safety-reports");
  state.admin.safetyReports=d.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">AN TOÀN & BẢO MẬT SỐ</span><h1>Báo cáo Sự cố An toàn</h1><p class="muted">Tiếp nhận và xử lý các cảnh báo giả mạo, nghi ngờ truy cập trái phép hoặc báo cáo quyền riêng tư từ trang /an-toan.</p></div></div>
  <div class="card table-scroll"><table><thead><tr><th>Mã tham chiếu</th><th>Phân loại & Mức độ</th><th>Tiêu đề & Mô tả</th><th>Người báo cáo</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>
    ${state.admin.safetyReports.map(r=>`<tr>
      <td><b>${E(r.code)}</b></td>
      <td><span class="pill">${E(r.category)}</span><br><small>Mức độ: <b>${E(r.severity)}</b></small></td>
      <td><b>${E(r.title)}</b><br><small class="muted">${E(r.description.slice(0,160))}</small>${r.affected_url?`<br><small>URL: <code>${E(r.affected_url)}</code></small>`:""}</td>
      <td>${E(r.reporter_name||"Ẩn danh")}<br><small>${E(r.reporter_email||"")}</small></td>
      <td><span class="status">${E(r.status)}</span></td>
      <td>${fmt(r.created_at)}</td>
      <td><button type="button" class="secondary" onclick="resolveSafetyReport('${E(r.id)}')">Xử lý</button></td>
    </tr>`).join("")||`<tr><td colspan="7" class="muted">Chưa có báo cáo sự cố an toàn nào.</td></tr>`}
  </tbody></table></div>`;
}

window.resolveSafetyReport=async id=>{
  const r=(state.admin.safetyReports||[]).find(x=>x.id===id);if(!r)return;
  const v=await adminDialog({title:`Xử lý sự cố ${r.code}`,confirmText:"Lưu kết quả",fields:[
    {name:"status",label:"Trạng thái xử lý",type:"select",value:r.status,options:["Đã tiếp nhận","Đang xác minh","Đã xử lý","Đã đóng"]},
    {name:"severity",label:"Mức độ",type:"select",value:r.severity,options:["Thấp","Trung bình","Cao","Khẩn cấp"]},
    {name:"resolution_note",label:"Ghi chú xác minh & biện pháp xử lý",type:"textarea",value:r.resolution_note||"",rows:4}
  ]});
  if(!v)return;
  try{await api(`/api/admin/safety-reports/${encodeURIComponent(id)}`,{method:"PATCH",body:v});toast("Đã cập nhật báo cáo an toàn.");adminSafety(document.getElementById("adminMain"));}catch(e){toast(errorText(e),"bad")}
};

// ================= THƯ VIỆN PDF & QUẢN LÝ PHIÊN BẢN TÀI LIỆU (#admin/documents) =================
async function adminDocumentsLibrary(main){
  const [docsData,filesData]=await Promise.all([
    api("/api/admin/content/documents"),
    api("/api/admin/files").catch(()=>({items:[]}))
  ]);
  state.admin.documents=docsData.items||[];
  state.admin.files=filesData.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">THƯ VIỆN PDF & TÀI LIỆU SỐ</span><h1>Quản lý Tài liệu & Phiên bản PDF</h1><p class="muted">Tải lên PDF, phân loại danh mục, xem trực tiếp, cập nhật phiên bản mới mà không làm mất lịch sử phiên bản cũ và kiểm soát quyền tải về phía máy chủ.</p></div><button type="button" class="primary" onclick="openDocumentEditor(null)">＋ Thêm tài liệu mới</button></div>
  <section class="card admin-card-premium">
    <div class="toolbar"><label class="admin-searchbox"><span>⌕</span><input id="adminDocSearch" type="search" placeholder="Tìm tên tài liệu, mã văn bản, danh mục..."></label></div>
    <div class="table-scroll"><table><thead><tr><th>Mã văn bản</th><th>Tên tài liệu & Danh mục</th><th>Phạm vi & Quyền tải</th><th>Trạng thái</th><th>Tệp đính kèm</th><th>Thao tác</th></tr></thead><tbody id="adminDocRows"></tbody></table></div>
  </section>`;
  const rows=document.getElementById("adminDocRows"),search=document.getElementById("adminDocSearch");
  const draw=()=>{
    const q=search.value.trim().toLocaleLowerCase("vi");
    const items=state.admin.documents.filter(d=>!q||[d.code,d.title,d.doc_type,d.metadata_json].join(" ").toLocaleLowerCase("vi").includes(q));
    rows.innerHTML=items.map(d=>{
      let meta={};try{meta=JSON.parse(d.metadata_json||"{}")}catch{}
      const allowDl=meta.allow_download!==false;
      return `<tr>
        <td><b>${E(d.code)}</b></td>
        <td><b>${E(d.title)}</b><br><small class="muted">Loại: ${E(d.doc_type)}</small></td>
        <td><span class="pill">${d.visibility==="public"?"Công khai":"Nội bộ / Hạn chế"}</span><br><small class="muted">${allowDl?"Cho phép tải PDF":"Chỉ xem trực tuyến"}</small></td>
        <td><span class="status">${E(d.status)}</span></td>
        <td>${d.file_id?`<a href="/api/files/${encodeURIComponent(d.file_id)}" target="_blank">Xem PDF (${E(d.file_id.slice(0,12))}…) ↗</a>`:"Chưa gắn tệp"}</td>
        <td><div class="admin-row-actions"><button type="button" class="secondary" onclick="manageDocumentVersions('${E(d.id)}')">Phiên bản PDF</button><button type="button" class="secondary" onclick="manageDocumentLifecycle('${E(d.id)}')">Vòng đời / Hồ sơ</button><button type="button" class="secondary" onclick="openDocumentEditor('${E(d.id)}')">Sửa</button><button type="button" class="danger" onclick="confirmDeleteGeneric('documents','${E(d.id)}')">Xóa</button></div></td>
      </tr>`;
    }).join("")||`<tr><td colspan="6" class="muted">Chưa có tài liệu nào.</td></tr>`;
  };
  search.addEventListener("input",draw);draw();
}

window.openDocumentEditor=id=>{
  const d=id?(state.admin.documents||[]).find(x=>x.id===id):null;
  let meta={}; try{meta=JSON.parse(d?.metadata_json||"{}")}catch{}
  const x=d||{code:`TL-${new Date().getFullYear()}-01`,doc_type:"Hướng dẫn",title:"",visibility:"public",status:"Có hiệu lực",file_id:""};
  const allowDl=meta.allow_download!==false;
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">THƯ VIỆN PDF & TÀI LIỆU</span><h2>${d?"Chỉnh sửa tài liệu":"Thêm tài liệu mới"}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <form id="docEditorForm">
    <div class="row2"><div class="field"><label>Mã tài liệu *</label><input name="code" value="${E(x.code)}" required></div><div class="field"><label>Danh mục / Loại văn bản *</label><input name="doc_type" value="${E(x.doc_type)}" required placeholder="Hướng dẫn, Quy chế, Báo cáo, Biểu mẫu PDF..."></div></div>
    <div class="field"><label>Tên hiển thị tài liệu *</label><input name="title" value="${E(x.title)}" required></div>
    <div class="field"><label>Mô tả ngắn</label><textarea name="description" rows="2">${E(meta.description||"")}</textarea></div>
    <div class="row2"><div class="field"><label>Từ khóa tìm kiếm</label><input name="keywords" value="${E(meta.keywords||"")}" placeholder="hướng dẫn, quy chế, pdf"></div><div class="field"><label>Website sở hữu</label><input name="website_id" value="${E(meta.website_id||"app")}"></div></div>
    <div class="row2"><div class="field"><label>Phạm vi truy cập</label><select name="visibility"><option value="public" ${x.visibility==="public"?"selected":""}>Công khai (/tai-lieu)</option><option value="internal" ${x.visibility!=="public"?"selected":""}>Nội bộ / Hạn chế</option></select></div><div class="field"><label>Trạng thái hiệu lực</label><select name="status"><option value="Có hiệu lực" ${x.status==="Có hiệu lực"?"selected":""}>Có hiệu lực</option><option value="Hết hiệu lực" ${x.status==="Hết hiệu lực"?"selected":""}>Hết hiệu lực</option><option value="Nháp" ${x.status==="Nháp"?"selected":""}>Bản nháp</option></select></div></div>
    <div class="check"><input type="checkbox" id="docAllowDownload" ${allowDl?"checked":""}><label for="docAllowDownload">Cho phép người dùng tải xuống tệp PDF (nếu tắt, máy chủ chặn ?download=1)</label></div>
    <div class="field"><label>Tải tệp PDF mới lên (hoặc giữ nguyên mã tệp bên dưới)</label><input type="file" id="docUploadFile" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></div>
    <div class="field"><label>Mã tệp lưu trữ hiện tại (File ID)</label><input name="file_id" id="docFileIdInput" value="${E(x.file_id||"")}" placeholder="Sẽ tự động điền khi tải tệp lên"></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="submit" class="primary" id="docSaveBtn">Lưu tài liệu</button></div>
  </form>`);
  document.getElementById("docEditorForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),btn=document.getElementById("docSaveBtn");
    btn.disabled=true;btn.textContent="Đang xử lý…";
    try{
      let fileId=String(f.get("file_id")||"").trim();
      const upFile=document.getElementById("docUploadFile").files?.[0];
      if(upFile){
        const ufd=new FormData();ufd.append("file",upFile);ufd.append("visibility",f.get("visibility")==="public"?"public":"private");
        const upRes=await api("/api/admin/upload",{method:"POST",body:ufd});
        fileId=upRes.id;
      }
      const allow_download=!!document.getElementById("docAllowDownload")?.checked;
      const metadata={...meta,description:f.get("description"),keywords:f.get("keywords"),website_id:f.get("website_id")||"app",category:f.get("doc_type"),allow_download};
      const payload={code:f.get("code"),doc_type:f.get("doc_type"),title:f.get("title"),visibility:f.get("visibility"),status:f.get("status"),file_id:fileId,issued_at:d?.issued_at||new Date().toISOString(),metadata_json:JSON.stringify(metadata)};
      if(d) await api(`/api/admin/content/documents/${encodeURIComponent(d.id)}`,{method:"PUT",body:payload});
      else await api("/api/admin/content/documents",{method:"POST",body:payload});
      closeModal();toast("Đã lưu tài liệu.");adminDocumentsLibrary(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Lưu tài liệu";}
  };
};

window.manageDocumentVersions=async docId=>{
  try{
    const d=await api(`/api/admin/documents/${encodeURIComponent(docId)}/versions`);
    const doc=d.document,vers=d.versions||[];
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">QUẢN LÝ PHIÊN BẢN TÀI LIỆU</span><h2>${E(doc.code)} — ${E(doc.title)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    ${doc.file_id?`<iframe src="/api/files/${encodeURIComponent(doc.file_id)}" title="Xem trước PDF" style="width:100%;height:340px;border:1px solid var(--line);border-radius:12px;margin-bottom:14px;"></iframe>`:""}
    <form id="newDocVerForm" class="card" style="margin-bottom:14px;">
      <h3>Tải lên phiên bản mới (giữ nguyên lịch sử phiên bản cũ)</h3>
      <div class="row2"><div class="field"><label>Chọn tệp PDF mới *</label><input type="file" id="verFileInput" accept="application/pdf" required></div><div class="field"><label>Ghi chú thay đổi phiên bản *</label><input id="verNoteInput" required placeholder="VD: Cập nhật biểu phí / phụ lục mới"></div></div>
      <button type="submit" class="primary" id="verSubmitBtn">Tải lên & Đặt làm phiên bản hiện hành</button>
    </form>
    <h3>Lịch sử các phiên bản (${vers.length})</h3>
    <div class="table-scroll"><table><thead><tr><th>Phiên bản</th><th>Tệp</th><th>Ghi chú</th><th>Thời gian</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${vers.map(v=>`<tr><td><b>v${E(v.version_number)}</b></td><td><a href="/api/files/${encodeURIComponent(v.file_id)}" target="_blank">${E(v.filename||v.file_id)} ↗</a></td><td>${E(v.change_note||"")}</td><td>${fmt(v.created_at)}</td><td><span class="status ${v.is_current?"":"status-warn"}">${v.is_current?"Đang áp dụng":"Phiên bản cũ"}</span></td><td>${!v.is_current?`<button type="button" class="secondary" onclick="restoreDocVersion('${E(doc.id)}','${E(v.id)}')">Khôi phục</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6" class="muted">Chưa có lịch sử phiên bản.</td></tr>`}
    </tbody></table></div>`);
    document.getElementById("newDocVerForm").onsubmit=async e=>{
      e.preventDefault();const file=document.getElementById("verFileInput").files?.[0],note=document.getElementById("verNoteInput").value.trim(),btn=document.getElementById("verSubmitBtn");
      if(!file)return;btn.disabled=true;btn.textContent="Đang tải tệp…";
      try{
        const ufd=new FormData();ufd.append("file",file);ufd.append("visibility",doc.visibility==="public"?"public":"private");
        const up=await api("/api/admin/upload",{method:"POST",body:ufd});
        await api(`/api/admin/documents/${encodeURIComponent(doc.id)}/versions`,{method:"POST",body:{file_id:up.id,change_note:note}});
        toast("Đã phát hành phiên bản tài liệu mới.");manageDocumentVersions(doc.id);adminDocumentsLibrary(document.getElementById("adminMain"));
      }catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Tải lên & Đặt làm phiên bản hiện hành";}
    };
  }catch(e){toast(errorText(e),"bad")}
};

window.restoreDocVersion=async(docId,verId)=>{
  if(!await adminConfirm("Khôi phục phiên bản này làm phiên bản hiện hành trên trang công khai?",{title:"Khôi phục phiên bản tài liệu"}))return;
  try{
    await api(`/api/admin/documents/${encodeURIComponent(docId)}/versions/${encodeURIComponent(verId)}/restore`,{method:"POST"});
    toast("Đã khôi phục phiên bản tài liệu.");manageDocumentVersions(docId);adminDocumentsLibrary(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.manageDocumentLifecycle=docId=>{
  const d=(state.admin.documents||[]).find(x=>x.id===docId);if(!d)return;
  let meta={}; try{meta=JSON.parse(d.metadata_json||"{}")}catch{}
  const history=Array.isArray(meta.lifecycle_history)?meta.lifecycle_history:[];
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">QUẢN LÝ VÒNG ĐỜI TÀI LIỆU & LIÊN KẾT HỒ SƠ</span><h2>${E(d.code)} — ${E(d.title)}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <p>Trạng thái hiện tại: <span class="status">${E(d.status)}</span> · Phạm vi: <b>${d.visibility==="public"?"Công khai":"Nội bộ"}</b> · Hồ sơ liên kết: <b>${E(meta.related_record_code||"Chưa gắn")}</b></p>
  <form id="docLifecycleForm" class="card" style="margin-bottom:14px;">
    <div class="row2">
      <div class="field"><label>Thao tác nghiệp vụ *</label>
        <select id="dlcAction" required>
          <option value="publish">Công bố công khai (Có hiệu lực)</option>
          <option value="unpublish">Ngừng công bố (Chuyển về Nội bộ)</option>
          <option value="revoke">Thu hồi tài liệu (Đã thu hồi)</option>
          <option value="replace">Thay thế bằng tài liệu mới</option>
          <option value="restore">Khôi phục hiệu lực</option>
          <option value="link_record">Gắn với mã hồ sơ / bản ghi liên quan</option>
        </select>
      </div>
      <div class="field"><label>Mã hồ sơ liên quan / Mã tài liệu thay thế</label><input id="dlcRefCode" value="${E(meta.related_record_code||meta.replaced_by_code||"")}" placeholder="VD: SFN-TNV-2026-0001 hoặc TL-2026-02"></div>
    </div>
    <div class="field"><label>Lý do / Ghi chú nhật ký *</label><input id="dlcReason" required placeholder="Nhập lý do thực hiện thao tác vòng đời..."></div>
    <button type="submit" class="primary">Thực hiện & Ghi lịch sử</button>
  </form>
  <h3>Lịch sử vòng đời tài liệu (${history.length})</h3>
  <div class="table-scroll"><table><thead><tr><th>Thời điểm</th><th>Thao tác</th><th>Trạng thái trước → sau</th><th>Người thực hiện</th><th>Lý do</th></tr></thead><tbody>
    ${history.map(h=>`<tr><td>${fmt(h.timestamp)}</td><td><b>${E(h.action)}</b></td><td>${E(h.previous_status)} → <b>${E(h.new_status)}</b></td><td>${E(h.actor_email||"Quản trị viên")}</td><td>${E(h.reason||"")}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">Chưa có lịch sử chuyển trạng thái vòng đời.</td></tr>`}
  </tbody></table></div>`);
  document.getElementById("docLifecycleForm").onsubmit=async e=>{
    e.preventDefault();
    const action=document.getElementById("dlcAction").value;
    const ref=document.getElementById("dlcRefCode").value.trim();
    const reason=document.getElementById("dlcReason").value.trim();
    try{
      await api(`/api/admin/documents/${encodeURIComponent(d.id)}/lifecycle`,{
        method:"POST",
        body:{action,reason,related_record_code:ref,replacement_code:ref}
      });
      closeModal();
      toast("Đã cập nhật vòng đời tài liệu.");
      await adminDocumentsLibrary(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad")}
  };
};

// ================= QUẢN TRỊ ĐA WEBSITE — 7 WEBSITE CHUẨN (#admin/websites) =================
async function adminWebsites(main){
  const d=await api("/api/admin/websites");
  state.admin.websites=d.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">QUẢN TRỊ ĐA WEBSITE · 7 CỔNG CHUẨN SKY FIRST</span><h1>Hệ thống Quản lý Đa Website Sky First</h1><p class="muted">Danh mục 7 cổng chính thức: <code>app</code>, <code>main</code>, <code>ctt</code>, <code>mail</code>, <code>member</code>, <code>sfec</code>, <code>exam</code>. Quản lý nhận diện, tên miền và trạng thái vận hành riêng với cơ chế cách ly dữ liệu phía máy chủ.</p></div><button type="button" class="primary" onclick="editWebsiteModal(null)">＋ Thêm Website</button></div>
  <div class="grid">${state.admin.websites.map(w=>`<article class="card"><div class="toolbar"><span class="pill">${E(w.code)}</span><span class="status ${w.status==="active"?"":"status-warn"}">${w.status==="active"?"Đang hoạt động":E(w.status)}</span></div><h3>${E(w.name)}</h3><p><b>Tên miền:</b> <code>${E(w.domain)}</code></p><p class="muted small">${E(w.description||"")}</p><div class="actions"><button type="button" class="secondary" onclick="editWebsiteModal('${E(w.id)}')">Cấu hình</button><button type="button" class="secondary" onclick="location.hash='admin/page-builder'">Quản lý trang CMS →</button></div></article>`).join("")}</div>`;
}

window.editWebsiteModal=id=>{
  const w=id?(state.admin.websites||[]).find(x=>x.id===id):null;
  const x=w||{id:"",code:"",name:"",domain:"",description:"",primary_color:"#0759b8",navy_color:"#071b35",status:"active"};
  modal(`<div class="admin-modal-head"><div><span class="eyebrow">CẤU HÌNH WEBSITE</span><h2>${w?`Cấu hình: ${w.name}`:"Thêm Website mới"}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
  <form id="siteConfigForm">
    <div class="row2"><div class="field"><label>Mã định danh nội bộ (id) *</label><input name="id" value="${E(x.id)}" ${w?"readonly":""} required placeholder="vd: sfec"></div><div class="field"><label>Mã hiển thị (code) *</label><input name="code" value="${E(x.code)}" required placeholder="SF-SFEC"></div></div>
    <div class="row2"><div class="field"><label>Tên hiển thị Website *</label><input name="name" value="${E(x.name)}" required></div><div class="field"><label>Tên miền chính thức *</label><input name="domain" value="${E(x.domain)}" required placeholder="app.skyfirst.io.vn"></div></div>
    <div class="field"><label>Mô tả phạm vi hoạt động</label><textarea name="description" rows="2">${E(x.description||"")}</textarea></div>
    <div class="row2"><div class="field"><label>Màu chủ đạo (Primary)</label><input name="primary_color" value="${E(x.primary_color||"#0759b8")}"></div><div class="field"><label>Trạng thái vận hành</label><select name="status"><option value="active" ${x.status==="active"?"selected":""}>Đang hoạt động (Active)</option><option value="maintenance" ${x.status==="maintenance"?"selected":""}>Đang bảo trì (Maintenance)</option><option value="paused" ${x.status==="paused"?"selected":""}>Tạm ngừng xuất bản</option></select></div></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button type="submit" class="primary">Lưu cấu hình Website</button></div>
  </form>`);
  document.getElementById("siteConfigForm").onsubmit=async e=>{
    e.preventDefault();const body=Object.fromEntries(new FormData(e.target));
    try{
      if(w) await api(`/api/admin/websites/${encodeURIComponent(w.id)}`,{method:"PUT",body});
      else await api("/api/admin/websites",{method:"POST",body});
      closeModal();toast("Đã lưu cấu hình website.");adminWebsites(document.getElementById("adminMain"));
    }catch(err){toast(errorText(err),"bad")}
  };
};

// ================= TRÌNH DỰNG TRANG TRỰC QUAN KÉO THẢ, CMS TOÀN TRANG & WORDPRESS ADAPTER (#admin/page-builder) =================
const pbState={pages:[],templates:[],sharedBlocks:[],websites:[],current:null,revisions:[],history:[],future:[],dirty:false,viewport:"desktop",editLang:"vi"};

async function adminPageBuilder(main){
  const [cmsData,sitesData]=await Promise.all([
    api("/api/admin/cms/pages"),
    api("/api/admin/websites").catch(()=>({items:[]}))
  ]);
  pbState.pages=cmsData.items||[];
  pbState.templates=cmsData.templates||[];
  pbState.sharedBlocks=cmsData.shared_blocks||[];
  pbState.websites=sitesData.items||[{id:"app",name:"Hệ thống Thông tin Số Sky First",domain:"app.skyfirst.io.vn"}];

  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI DUNG & TRÌNH DỰNG TRANG TRỰC QUAN</span><h1>Trình dựng Trang Trực quan, Trang Hệ thống & Quy trình Xuất bản</h1><p class="muted">Quản trị cả 13 trang hệ thống (<code>/</code>, <code>/gioi-thieu</code>, <code>/chuong-trinh</code>, <code>/su-kien</code>, <code>/tai-tro</code>, <code>/tai-lieu</code>, <code>/bieu-mau</code>, <code>/ho-so</code>, <code>/tra-cuu</code>, <code>/gcn</code>, <code>/an-toan</code>, <code>/ho-tro</code>, <code>/admin/login</code>) và các trang nội dung mở rộng <code>/trang/...</code> với song ngữ VI/EN, khối dùng chung, hẹn giờ xuất bản và đồng bộ WordPress Gutenberg.</p></div><div class="actions"><button type="button" class="secondary" onclick="runScheduledPublishNow()">⏱ Chạy lịch xuất bản</button><button type="button" class="secondary" onclick="openSharedBlocksManager()">🧩 Khối dùng chung (${pbState.sharedBlocks.length})</button><button type="button" class="secondary" onclick="openTemplatesManager()">📐 Mẫu bố cục (${pbState.templates.length})</button><button type="button" class="secondary" onclick="openWordPressImportModal()">⇄ WordPress / Gutenberg</button><button type="button" class="primary" onclick="createNewCmsPage()">＋ Tạo trang mới</button></div></div>
  <section class="card admin-card-premium">
    <div class="toolbar"><label class="admin-searchbox"><span>⌕</span><input id="cmsPageSearch" type="search" placeholder="Tìm tiêu đề, đường dẫn, route..."></label><select id="cmsTypeFilter"><option value="all">Tất cả loại trang (${pbState.pages.length})</option><option value="system">Trang hệ thống (System Routes)</option><option value="custom">Trang mở rộng (/trang/...)</option></select><select id="cmsSiteFilter"><option value="all">Tất cả Website</option>${pbState.websites.map(w=>`<option value="${E(w.id)}">${E(w.name)} (${E(w.domain)})</option>`).join("")}</select></div>
    <div class="table-scroll"><table><thead><tr><th>Website & Loại</th><th>Tiêu đề (VI / EN) & Đường dẫn</th><th>Phiên bản</th><th>Trạng thái quy trình</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody id="cmsPageRows"></tbody></table></div>
  </section>
  <div id="visualBuilderMount" style="margin-top:22px;"></div>`;

  const rows=document.getElementById("cmsPageRows"),search=document.getElementById("cmsPageSearch"),siteFilter=document.getElementById("cmsSiteFilter"),typeFilter=document.getElementById("cmsTypeFilter");
  const statusLabel=s=>({draft:"1. Bản nháp",pending_review:"2. Chờ duyệt",approved:"3. Đã duyệt",scheduled:"⏱ Hẹn giờ xuất bản",published:"4. Đã xuất bản",archived:"5. Tạm gỡ / Lưu trữ"}[s]||s);
  const draw=()=>{
    const q=search.value.trim().toLocaleLowerCase("vi"),site=siteFilter.value,ptype=typeFilter.value;
    const list=pbState.pages.filter(p=>(site==="all"||p.website_id===site)&&(ptype==="all"||(ptype==="system"?p.page_type==="system":p.page_type!=="system"))&&(!q||[p.title,p.title_en,p.slug,p.route_path,p.summary].join(" ").toLocaleLowerCase("vi").includes(q)));
    rows.innerHTML=list.map(p=>{
      const publicUrl=p.page_type==="system"&&p.route_path?p.route_path:`/trang/${encodeURIComponent(p.slug)}`;
      return `<tr>
        <td><span class="pill">${E(p.website_id.toUpperCase())}</span><br><small class="muted">${p.page_type==="system"?"Trang hệ thống":"Trang CMS"}</small></td>
        <td><b>${E(p.title)}</b>${p.title_en?`<br><small class="muted">EN: ${E(p.title_en)}</small>`:""}<br><code>${E(publicUrl)}</code></td>
        <td>v${E(p.version||1)}</td>
        <td><span class="status ${p.status==="published"?"":p.status==="approved"?"good":"status-warn"}">${E(statusLabel(p.status))}</span>${p.scheduled_at?`<br><small class="muted">Lịch: ${fmt(p.scheduled_at)}</small>`:""}</td>
        <td>${fmt(p.updated_at)}</td>
        <td><div class="admin-row-actions">
          <button type="button" class="primary" onclick="openVisualBuilder('${E(p.id)}')">Mở Trình dựng</button>
          <button type="button" class="secondary" onclick="duplicateCmsPage('${E(p.id)}')">Nhân bản</button>
          <a class="secondary" href="${E(publicUrl)}" target="_blank">Xem trang ↗</a>
        </div></td>
      </tr>`;
    }).join("")||`<tr><td colspan="6" class="muted">Chưa có trang nội dung nào phù hợp bộ lọc.</td></tr>`;
  };
  search.addEventListener("input",draw);siteFilter.addEventListener("change",draw);typeFilter.addEventListener("change",draw);draw();
}

window.runScheduledPublishNow=async()=>{
  try{
    const r=await api("/api/admin/cms/run-scheduled",{method:"POST"});
    toast(`Đã kiểm tra lịch xuất bản tự động (${r.published_count||0} trang được xuất bản).`);
    await adminPageBuilder(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.duplicateCmsPage=async id=>{
  try{
    const r=await api(`/api/admin/cms/pages/${encodeURIComponent(id)}/duplicate`,{method:"POST"});
    toast(`Đã nhân bản trang sang slug: ${r.slug}`);
    await adminPageBuilder(document.getElementById("adminMain"));
    await openVisualBuilder(r.id);
  }catch(e){toast(errorText(e),"bad")}
};

window.createNewCmsPage=async()=>{
  const tplOptions=[{value:"blank",label:"Trang trống (tự kéo thả khối)"},...pbState.templates.map(t=>({value:t.id,label:`Mẫu: ${t.name}`}))];
  const v=await adminDialog({title:"Tạo trang nội dung mới",description:"Chọn website đích, loại trang và mẫu bố cục khởi tạo. Mẫu chỉ cung cấp khung trình bày, không tự tạo số liệu giả.",confirmText:"Tạo & Mở Trình dựng",fields:[
    {name:"website_id",label:"Website sở hữu",type:"select",value:"app",options:pbState.websites.map(w=>({value:w.id,label:`${w.name} (${w.domain})`}))},
    {name:"page_type",label:"Loại trang",type:"select",value:"custom",options:[{value:"custom",label:"Trang CMS mở rộng (/trang/...)"},{value:"system",label:"Trang hệ thống (System Route)"}]},
    {name:"route_path",label:"Đường dẫn hệ thống (nếu là Trang hệ thống)",required:false,placeholder:"VD: /gioi-thieu hoặc /ho-tro"},
    {name:"title",label:"Tiêu đề trang (Tiếng Việt) *",required:true,placeholder:"VD: Hướng dẫn đăng ký chương trình 2026"},
    {name:"title_en",label:"Tiêu đề trang (English)",required:false,placeholder:"e.g. 2026 Program Registration Guide"},
    {name:"slug",label:"Đường dẫn (slug) *",required:true,placeholder:"huong-dan-dang-ky-2026"},
    {name:"summary",label:"Mô tả ngắn (SEO VI)",required:false},
    {name:"summary_en",label:"Mô tả ngắn (SEO EN)",required:false},
    {name:"template_id",label:"Mẫu giao diện khởi tạo",type:"select",value:pbState.templates[0]?.id||"blank",options:tplOptions}
  ]});
  if(!v)return;
  const tpl=pbState.templates.find(t=>t.id===v.template_id);
  let blocks=[]; try{blocks=tpl?JSON.parse(tpl.blocks_json||"[]"):[{id:uid("blk"),type:"heading",level:"h1",text:v.title,align:"left"},{id:uid("blk"),type:"paragraph",text:v.summary||"Nhập nội dung trang tại đây...",align:"left"}]}catch{}
  try{
    const r=await api("/api/admin/cms/pages",{method:"POST",body:{website_id:v.website_id,page_type:v.page_type,route_path:v.route_path||null,title:v.title,title_en:v.title_en||"",slug:v.slug,summary:v.summary,summary_en:v.summary_en||"",blocks,blocks_en:[],seo:{meta_title:v.title,meta_description:v.summary||""},seo_en:{meta_title:v.title_en||v.title,meta_description:v.summary_en||v.summary||""}}});
    toast("Đã tạo trang mới ở trạng thái Bản nháp.");
    await adminPageBuilder(document.getElementById("adminMain"));
    await openVisualBuilder(r.id);
  }catch(e){toast(errorText(e),"bad")}
};

window.openVisualBuilder=async pageId=>{
  try{
    const d=await api(`/api/admin/cms/pages/${encodeURIComponent(pageId)}`);
    pbState.current=JSON.parse(JSON.stringify(d.item));
    if(!Array.isArray(pbState.current.blocks))pbState.current.blocks=[];
    if(!Array.isArray(pbState.current.blocks_en))pbState.current.blocks_en=[];
    pbState.revisions=d.revisions||[];
    pbState.history=[];
    pbState.future=[];
    pbState.dirty=false;
    renderVisualBuilderWorkspace();
  }catch(e){toast(errorText(e),"bad")}
};

function activePbBlocks(){
  if(!pbState.current)return [];
  return pbState.editLang==="en"?pbState.current.blocks_en:pbState.current.blocks;
}

function pushPbHistory(){
  if(!pbState.current)return;
  pbState.history.push(JSON.stringify({blocks:pbState.current.blocks,blocks_en:pbState.current.blocks_en}));
  if(pbState.history.length>30) pbState.history.shift();
  pbState.future=[];
  pbState.dirty=true;
}

window.pbUndo=()=>{
  if(!pbState.history.length)return;
  pbState.future.push(JSON.stringify({blocks:pbState.current.blocks,blocks_en:pbState.current.blocks_en}));
  const prev=JSON.parse(pbState.history.pop());
  pbState.current.blocks=prev.blocks||[];
  pbState.current.blocks_en=prev.blocks_en||[];
  renderVisualBuilderWorkspace();
};
window.pbRedo=()=>{
  if(!pbState.future.length)return;
  pbState.history.push(JSON.stringify({blocks:pbState.current.blocks,blocks_en:pbState.current.blocks_en}));
  const next=JSON.parse(pbState.future.pop());
  pbState.current.blocks=next.blocks||[];
  pbState.current.blocks_en=next.blocks_en||[];
  renderVisualBuilderWorkspace();
};

const BLOCK_CATALOG=[
  {type:"hero",label:"Hero Banner",defaults:{title:"Tiêu đề khu vực nổi bật",subtitle:"Mô tả ngắn gọn phục vụ người dùng",ctaText:"Khám phá",ctaHref:"/chuong-trinh",align:"center"}},
  {type:"heading",label:"Tiêu đề (H1/H2/H3)",defaults:{level:"h2",text:"Tiêu đề mục nội dung",align:"left"}},
  {type:"paragraph",label:"Đoạn văn bản",defaults:{text:"Nhập nội dung đoạn văn bản tại đây...",align:"left"}},
  {type:"callout",label:"Khối thông báo",defaults:{tone:"good",title:"Lưu ý quan trọng",text:"Nội dung thông báo cần làm nổi bật."}},
  {type:"columns",label:"Bố cục nhiều cột",defaults:{columns:[{title:"Cột 1",body:"Nội dung cột 1"},{title:"Cột 2",body:"Nội dung cột 2"}]}},
  {type:"grid",label:"Lưới thẻ (Grid)",defaults:{cols:3,items:[{title:"Thẻ 1",body:"Mô tả thẻ 1"},{title:"Thẻ 2",body:"Mô tả thẻ 2"},{title:"Thẻ 3",body:"Mô tả thẻ 3"}]}},
  {type:"table",label:"Bảng dữ liệu",defaults:{title:"Bảng thông tin",headers:["Cột 1","Cột 2","Cột 3"],rows:[["Dữ liệu 1","Dữ liệu 2","Dữ liệu 3"]]}},
  {type:"stats",label:"Khối số liệu (Stats)",defaults:{items:[{value:"100%",label:"Minh bạch đối soát"},{value:"24/7",label:"Tra cứu trực tuyến"}]}},
  {type:"faq",label:"Câu hỏi thường gặp (Accordion/FAQ)",defaults:{title:"Câu hỏi thường gặp",items:[{q:"Câu hỏi 1?",a:"Câu trả lời chi tiết 1."}]}},
  {type:"tabs",label:"Thẻ chuyển nội dung (Tabs)",defaults:{tabs:[{label:"Tab 1",content:"Nội dung tab 1"},{label:"Tab 2",content:"Nội dung tab 2"}]}},
  {type:"timeline",label:"Dòng thời gian (Timeline)",defaults:{title:"Các mốc triển khai",steps:[{time:"Bước 01",title:"Tiếp nhận",body:"Mô tả bước 1"},{time:"Bước 02",title:"Xác minh",body:"Mô tả bước 2"}]}},
  {type:"cta",label:"Khối kêu gọi hành động (CTA)",defaults:{eyebrow:"HÀNH ĐỘNG",title:"Bắt đầu ngay hôm nay",text:"Mô tả ngắn gọn.",label:"Mở biểu mẫu",href:"/bieu-mau"}},
  {type:"video",label:"Video nhúng",defaults:{title:"Video giới thiệu",url:"",caption:"Video tài liệu hướng dẫn"}},
  {type:"image",label:"Hình ảnh",defaults:{url:"/assets/sfn-logo-tight.png",caption:"Chú thích hình ảnh",align:"center"}},
  {type:"pdf_embed",label:"Nhúng tài liệu PDF",defaults:{title:"Tài liệu PDF đính kèm",fileId:""}},
  {type:"form_embed",label:"Nhúng Biểu mẫu số",defaults:{title:"Biểu mẫu đăng ký trực tuyến",formId:"member"}},
  {type:"dynamic_list",label:"Danh sách động (Dynamic Module)",defaults:{title:"Danh sách dữ liệu động",source:"programs",href:"/chuong-trinh"}},
  {type:"guide",label:"Khối hướng dẫn từng bước",defaults:{title:"Hướng dẫn thực hiện",steps:["Bước 1: Chuẩn bị thông tin","Bước 2: Gửi biểu mẫu và lưu mã hồ sơ"]}},
  {type:"shared_block",label:"Khối dùng chung (Shared Block)",defaults:{sharedKey:"global-contact-strip",title:"Khối liên hệ dùng chung"}},
  {type:"button",label:"Nút bấm điều hướng",defaults:{label:"Mở liên kết",href:"/bieu-mau",align:"left"}},
  {type:"list",label:"Danh sách mục",defaults:{items:["Mục nội dung 1","Mục nội dung 2","Mục nội dung 3"]}}
];

function renderVisualBuilderWorkspace(){
  const mount=document.getElementById("visualBuilderMount");
  if(!mount||!pbState.current)return;
  const p=pbState.current,blocks=activePbBlocks();
  const vpWidth=pbState.viewport==="mobile"?"390px":pbState.viewport==="tablet"?"768px":"100%";
  const publicUrl=p.page_type==="system"&&p.route_path?p.route_path:`/trang/${p.slug}`;
  if(pbState.selectedBlockIdx===undefined||pbState.selectedBlockIdx>=blocks.length) pbState.selectedBlockIdx=blocks.length?0:-1;
  const selBlock=pbState.selectedBlockIdx>=0?blocks[pbState.selectedBlockIdx]:null;

  mount.innerHTML=`<section class="card admin-card-premium" style="border:2px solid var(--blue);">
    <div class="toolbar" style="border-bottom:1px solid var(--line);padding-bottom:12px;">
      <div style="margin-right:auto">
        <span class="eyebrow">TRÌNH QUẢN TRỊ NỘI DUNG & DỰNG TRANG TRỰC QUAN · WEBSITE: ${E(p.website_id.toUpperCase())} · ${p.page_type==="system"?"TRANG HỆ THỐNG":"TRANG MỞ RỘNG"} · v${E(p.version)}</span>
        <h2 style="margin:4px 0 0">${E(p.title)} <small class="muted">(${E(publicUrl)})</small></h2>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <button type="button" class="${pbState.editLang==="vi"?"primary":"secondary"}" onclick="switchPbEditLang('vi')">🇻🇳 Khối Tiếng Việt (${(p.blocks||[]).length})</button>
        <button type="button" class="${pbState.editLang==="en"?"primary":"secondary"}" onclick="switchPbEditLang('en')">🇬🇧 Khối Tiếng Anh (${(p.blocks_en||[]).length})</button>
        <button type="button" class="secondary" onclick="pbUndo()" ${pbState.history.length?"":"disabled"}>↶ Hoàn tác (${pbState.history.length})</button>
        <button type="button" class="secondary" onclick="pbRedo()" ${pbState.future.length?"":"disabled"}>↷ Làm lại (${pbState.future.length})</button>
        <select id="pbViewportSelect" aria-label="Chế độ màn hình">
          <option value="desktop" ${pbState.viewport==="desktop"?"selected":""}>🖥️ Máy tính (100%)</option>
          <option value="tablet" ${pbState.viewport==="tablet"?"selected":""}>📱 Máy tính bảng (768px)</option>
          <option value="mobile" ${pbState.viewport==="mobile"?"selected":""}>📱 Điện thoại (390px)</option>
        </select>
        <button type="button" class="secondary" onclick="previewServerCmsPage('${E(p.id)}')">👁 Xem thử trang</button>
        <button type="button" class="secondary" onclick="exportPageWordPress('${E(p.id)}')">⬇ Xuất cấu trúc khối</button>
        <button type="button" class="primary" onclick="saveVisualPage()">💾 Lưu bản nháp</button>
      </div>
    </div>

    <div class="toolbar" style="background:var(--bg);padding:10px 14px;border-radius:12px;margin:14px 0;">
      <b>Quy trình phê duyệt & xuất bản:</b>
      <span class="status">${E(p.status==="published"?"Đang công bố":p.status==="pending_review"?"Chờ duyệt":p.status==="approved"?"Đã duyệt":p.status==="scheduled"?"Đã lên lịch":"Bản nháp")}</span>
      ${p.scheduled_at?`<span class="pill">⏱ Lịch xuất bản: ${fmt(p.scheduled_at)}</span>`:""}
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="secondary" onclick="runCmsWorkflow('submit_review')">1. Gửi duyệt</button>
        <button type="button" class="secondary" onclick="runCmsWorkflow('approve')">2. Phê duyệt</button>
        <button type="button" class="danger" onclick="runCmsWorkflow('reject')">Từ chối duyệt</button>
        <button type="button" class="secondary" onclick="runCmsWorkflow('schedule')">⏱ Hẹn giờ công bố</button>
        <button type="button" class="primary" onclick="runCmsWorkflow('publish')">3. Công bố chính thức</button>
        ${p.status==="published"?`<button type="button" class="secondary" onclick="runCmsWorkflow('unpublish')">Gỡ công bố</button>`:""}
      </div>
    </div>

    ${selBlock?`<div class="toolbar" style="background:#f0f6ff;border:1px solid #bfdbfe;padding:10px 14px;border-radius:12px;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
      <b>🎨 Định dạng khối đang chọn (#${pbState.selectedBlockIdx+1} — ${E(BLOCK_CATALOG.find(x=>x.type===selBlock.type)?.label||selBlock.type)}):</b>
      <label class="small">Phông chữ:
        <select id="pbStyleFont" style="margin-left:4px;">
          <option value="" ${!selBlock.fontFamily?"selected":""}>Mặc định hệ thống</option>
          <option value="'Be Vietnam Pro', Inter, sans-serif" ${selBlock.fontFamily?.includes("Be Vietnam Pro")?"selected":""}>Be Vietnam Pro</option>
          <option value="Inter, system-ui, sans-serif" ${selBlock.fontFamily?.startsWith("Inter")?"selected":""}>Inter</option>
          <option value="Georgia, serif" ${selBlock.fontFamily?.startsWith("Georgia")?"selected":""}>Georgia (Có chân)</option>
          <option value="'JetBrains Mono', monospace" ${selBlock.fontFamily?.includes("JetBrains")?"selected":""}>JetBrains Mono</option>
        </select>
      </label>
      <label class="small">Cỡ chữ:
        <select id="pbStyleSize" style="margin-left:4px;">
          <option value="" ${!selBlock.fontSize?"selected":""}>Mặc định</option>
          <option value="14px" ${selBlock.fontSize==="14px"?"selected":""}>Nhỏ (14px)</option>
          <option value="16px" ${selBlock.fontSize==="16px"?"selected":""}>Tiêu chuẩn (16px)</option>
          <option value="18px" ${selBlock.fontSize==="18px"?"selected":""}>Vừa (18px)</option>
          <option value="22px" ${selBlock.fontSize==="22px"?"selected":""}>Lớn (22px)</option>
          <option value="28px" ${selBlock.fontSize==="28px"?"selected":""}>Tiêu đề (28px)</option>
          <option value="34px" ${selBlock.fontSize==="34px"?"selected":""}>Nổi bật (34px)</option>
        </select>
      </label>
      <label class="small">Căn lề:
        <select id="pbStyleAlign" style="margin-left:4px;">
          <option value="left" ${(selBlock.align||"left")==="left"?"selected":""}>Căn trái</option>
          <option value="center" ${selBlock.align==="center"?"selected":""}>Căn giữa</option>
          <option value="right" ${selBlock.align==="right"?"selected":""}>Căn phải</option>
        </select>
      </label>
      <label class="small">Màu chữ: <input type="color" id="pbStyleColor" value="${E(selBlock.textColor||"#071b35")}" style="width:32px;height:26px;padding:0;vertical-align:middle;"></label>
      <label class="small">Màu nền: <input type="color" id="pbStyleBg" value="${E(selBlock.bgColor||"#ffffff")}" style="width:32px;height:26px;padding:0;vertical-align:middle;"></label>
      <button type="button" class="ghost small" onclick="resetPbBlockStyle(${pbState.selectedBlockIdx})">Đặt lại kiểu</button>
    </div>`:""}

    <div class="admin-grid2" style="grid-template-columns:310px 1fr;gap:18px;align-items:start;">
      <aside class="card" style="position:sticky;top:90px;max-height:82vh;overflow:auto;">
        <h3>+ Thư viện Khối (${BLOCK_CATALOG.length} loại)</h3>
        <p class="small muted">Đang sửa ngôn ngữ: <b>${pbState.editLang.toUpperCase()}</b>. Nhấp trực tiếp vào văn bản ở khung bên phải để sửa tại chỗ hoặc kéo thả để đổi vị trí khối.</p>
        <div style="display:grid;gap:6px;max-height:280px;overflow:auto;padding-right:4px;">
          ${BLOCK_CATALOG.map(b=>`<button type="button" class="secondary" style="text-align:left;padding:7px 10px;font-size:13px;" onclick="addPbBlock('${E(b.type)}')">＋ ${E(b.label)}</button>`).join("")}
        </div>
        <h3 style="margin-top:18px;">Thông tin trang & SEO (VI / EN)</h3>
        <div class="field"><label>Tiêu đề (VI)</label><input id="pbPageTitle" value="${E(p.title||"")}"></div>
        <div class="field"><label>Tiêu đề (EN)</label><input id="pbPageTitleEn" value="${E(p.title_en||"")}" placeholder="Tiêu đề tiếng Anh"></div>
        <div class="field"><label>Đường dẫn định danh (Slug)</label><input id="pbPageSlug" value="${E(p.slug||"")}"></div>
        ${p.page_type==="system"?`<div class="field"><label>Đường dẫn hệ thống cố định</label><input id="pbRoutePath" value="${E(p.route_path||"")}" readonly></div>`:""}
        <div class="field"><label>Mô tả SEO (VI)</label><textarea id="pbPageSummary" rows="2">${E(p.summary||"")}</textarea></div>
        <div class="field"><label>Mô tả SEO (EN)</label><textarea id="pbPageSummaryEn" rows="2">${E(p.summary_en||"")}</textarea></div>
        <h3 style="margin-top:18px;">Lịch sử phiên bản (${(pbState.revisions||[]).length})</h3>
        <div style="max-height:150px;overflow:auto;display:grid;gap:6px;">
          ${(pbState.revisions||[]).map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;border-bottom:1px solid var(--line);padding:4px 0;"><span><b>v${E(r.version)}</b> · ${E(r.status)}</span><button type="button" class="ghost" style="padding:3px 6px;" onclick="restorePbRevision(${r.version})">Khôi phục</button></div>`).join("")}
        </div>
      </aside>

      <div>
        <div class="card" style="background:var(--bg);margin-bottom:18px;">
          <div class="toolbar" style="margin-bottom:8px;">
            <span class="eyebrow">KHUNG SOẠN THẢO TRỰC QUAN — NHẤP VÀO VĂN BẢN ĐỂ SỬA TRỰC TIẾP & KÉO THẢ KHỐI (${E(pbState.viewport.toUpperCase())} — ${vpWidth})</span>
          </div>
          <div id="pbLiveCanvas" style="width:${vpWidth};max-width:100%;margin:8px auto 0;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;display:grid;gap:14px;">
            ${blocks.map((b,idx)=>`<div class="pb-canvas-block" draggable="true" data-pb-idx="${idx}" onclick="selectPbBlock(${idx},event)" style="position:relative;border:2px ${pbState.selectedBlockIdx===idx?"solid var(--blue)":"dashed transparent"};border-radius:14px;padding:10px;transition:border-color .15s;">
              <div class="toolbar" style="margin:0 0 8px;padding:4px 8px;background:var(--bg);border-radius:8px;font-size:12px;">
                <span style="cursor:grab;font-weight:700;">☰ Khối #${idx+1}: ${E(BLOCK_CATALOG.find(x=>x.type===b.type)?.label||b.type)}</span>
                <span class="small muted" style="margin-left:8px;">(Nhấp vào chữ bên dưới để sửa trực tiếp)</span>
                <div style="margin-left:auto;display:flex;gap:4px;">
                  <button type="button" class="ghost" style="padding:2px 6px;" onclick="movePbBlock(${idx},-1)" title="Đưa lên">↑</button>
                  <button type="button" class="ghost" style="padding:2px 6px;" onclick="movePbBlock(${idx},1)" title="Đưa xuống">↓</button>
                  <button type="button" class="secondary" style="padding:2px 8px;font-size:11px;" onclick="duplicatePbBlock(${idx})">Nhân bản</button>
                  <button type="button" class="secondary" style="padding:2px 8px;font-size:11px;" onclick="editPbBlock(${idx})">Thuộc tính nâng cao</button>
                  <button type="button" class="danger" style="padding:2px 8px;font-size:11px;" onclick="removePbBlock(${idx})">×</button>
                </div>
              </div>
              <div class="pb-inline-surface">${pbEditableBlockHtml(b,idx)}</div>
            </div>`).join("")||`<div class="notice">Ngôn ngữ <b>${pbState.editLang.toUpperCase()}</b> chưa có khối nội dung riêng. Hãy nhấn chọn một loại khối ở cột bên trái để thêm vào trang.</div>`}
          </div>
        </div>
      </div>
    </div>
  </section>`;

  document.getElementById("pbViewportSelect")?.addEventListener("change",e=>{pbState.viewport=e.target.value;renderVisualBuilderWorkspace();});
  document.getElementById("pbPageTitle")?.addEventListener("input",e=>{pbState.current.title=e.target.value;pbState.dirty=true;});
  document.getElementById("pbPageTitleEn")?.addEventListener("input",e=>{pbState.current.title_en=e.target.value;pbState.dirty=true;});
  document.getElementById("pbPageSlug")?.addEventListener("input",e=>{pbState.current.slug=e.target.value;pbState.dirty=true;});
  document.getElementById("pbPageSummary")?.addEventListener("input",e=>{pbState.current.summary=e.target.value;pbState.dirty=true;});
  document.getElementById("pbPageSummaryEn")?.addEventListener("input",e=>{pbState.current.summary_en=e.target.value;pbState.dirty=true;});

  if(selBlock){
    document.getElementById("pbStyleFont")?.addEventListener("change",e=>{pushPbHistory();selBlock.fontFamily=e.target.value;renderVisualBuilderWorkspace();});
    document.getElementById("pbStyleSize")?.addEventListener("change",e=>{pushPbHistory();selBlock.fontSize=e.target.value;renderVisualBuilderWorkspace();});
    document.getElementById("pbStyleAlign")?.addEventListener("change",e=>{pushPbHistory();selBlock.align=e.target.value;renderVisualBuilderWorkspace();});
    document.getElementById("pbStyleColor")?.addEventListener("change",e=>{pushPbHistory();selBlock.textColor=e.target.value;renderVisualBuilderWorkspace();});
    document.getElementById("pbStyleBg")?.addEventListener("change",e=>{pushPbHistory();selBlock.bgColor=e.target.value;renderVisualBuilderWorkspace();});
  }

  // Bind inline contenteditable elements
  mount.querySelectorAll("[data-pb-inline]").forEach(el=>{
    el.addEventListener("focus",()=>{
      const idx=Number(el.dataset.pbBlock);
      pbState.selectedBlockIdx=idx;
    });
    el.addEventListener("blur",()=>{
      const idx=Number(el.dataset.pbBlock);
      const prop=el.dataset.pbInline;
      const blk=activePbBlocks()[idx];
      if(!blk)return;
      const newVal=el.innerText.trim();
      if(String(blk[prop]||"")!==newVal){
        pushPbHistory();
        blk[prop]=newVal;
      }
    });
  });

  let dragFrom=null;
  mount.querySelectorAll("[data-pb-idx]").forEach(el=>{
    el.addEventListener("dragstart",e=>{
      if(e.target.isContentEditable){e.preventDefault();return;}
      dragFrom=Number(el.dataset.pbIdx);el.classList.add("dragging");
    });
    el.addEventListener("dragend",()=>el.classList.remove("dragging"));
    el.addEventListener("dragover",e=>e.preventDefault());
    el.addEventListener("drop",e=>{
      e.preventDefault();
      const dragTo=Number(el.dataset.pbIdx);
      if(dragFrom===null||dragFrom===dragTo)return;
      pushPbHistory();
      const arr=activePbBlocks();
      const [moved]=arr.splice(dragFrom,1);
      arr.splice(dragTo,0,moved);
      pbState.selectedBlockIdx=dragTo;
      renderVisualBuilderWorkspace();
    });
  });
}

window.selectPbBlock=(idx,ev)=>{
  if(ev?.target?.closest("button,select,input,[contenteditable='true']")) return;
  if(pbState.selectedBlockIdx!==idx){
    pbState.selectedBlockIdx=idx;
    renderVisualBuilderWorkspace();
  }
};

window.resetPbBlockStyle=idx=>{
  const b=activePbBlocks()[idx];if(!b)return;
  pushPbHistory();
  delete b.fontFamily;delete b.fontSize;delete b.textColor;delete b.bgColor;b.align="left";
  renderVisualBuilderWorkspace();
};

window.switchPbEditLang=lang=>{
  pbState.editLang=lang==="en"?"en":"vi";
  if(pbState.editLang==="en"&&(!pbState.current.blocks_en||!pbState.current.blocks_en.length)&&(pbState.current.blocks||[]).length){
    pbState.current.blocks_en=JSON.parse(JSON.stringify(pbState.current.blocks));
    toast("Đã sao chép cấu trúc khối Tiếng Việt sang Tiếng Anh để biên tập nhanh.");
  }
  renderVisualBuilderWorkspace();
};

function pbCustomStyleStr(b){
  const parts=[`text-align:${E(b.align||"left")}`];
  if(b.fontFamily) parts.push(`font-family:${E(b.fontFamily)}`);
  if(b.fontSize) parts.push(`font-size:${E(b.fontSize)}`);
  if(b.textColor) parts.push(`color:${E(b.textColor)}`);
  if(b.bgColor) parts.push(`background:${E(b.bgColor)};padding:12px 16px;border-radius:12px`);
  return parts.join(";")+";";
}

function pbEditableBlockHtml(b,idx){
  const style=pbCustomStyleStr(b);
  if(b.type==="hero"){
    return `<div style="padding:28px;border-radius:16px;background:${E(b.bgColor||"linear-gradient(125deg,#071b35,#0759b8)")};color:${E(b.textColor||"#fff")};text-align:${E(b.align||"center")};${b.fontFamily?`font-family:${E(b.fontFamily)};`:""}">
      <h2 contenteditable="true" data-pb-block="${idx}" data-pb-inline="title" style="outline:1px dashed #ffffff66;padding:4px;border-radius:6px;${b.fontSize?`font-size:${E(b.fontSize)};`:""}">${E(b.title||"Tiêu đề khu vực nổi bật")}</h2>
      <p contenteditable="true" data-pb-block="${idx}" data-pb-inline="subtitle" style="outline:1px dashed #ffffff44;padding:4px;border-radius:6px;">${E(b.subtitle||"Mô tả ngắn gọn")}</p>
      ${b.ctaText?`<span class="pill white" contenteditable="true" data-pb-block="${idx}" data-pb-inline="ctaText">${E(b.ctaText)}</span>`:""}
    </div>`;
  }
  if(b.type==="heading"){
    const tag=["h1","h2","h3"].includes(b.level)?b.level:"h2";
    return `<${tag} contenteditable="true" data-pb-block="${idx}" data-pb-inline="text" style="margin:0;outline:1px dashed var(--line);padding:6px 8px;border-radius:8px;${style}">${E(b.text||b.title||"Nhập tiêu đề...")}</${tag}>`;
  }
  if(b.type==="paragraph"){
    return `<div contenteditable="true" data-pb-block="${idx}" data-pb-inline="text" style="margin:0;line-height:1.75;white-space:pre-line;outline:1px dashed var(--line);padding:8px 10px;border-radius:8px;${style}">${E(b.text||"Nhập nội dung đoạn văn bản...")}</div>`;
  }
  if(b.type==="callout"||b.type==="guide"){
    return `<div class="notice ${E(b.tone||"")}" style="${style}">
      <b contenteditable="true" data-pb-block="${idx}" data-pb-inline="title" style="display:block;outline:1px dashed var(--line);padding:2px 6px;border-radius:4px;">${E(b.title||"Tiêu đề thông báo")}</b>
      <div contenteditable="true" data-pb-block="${idx}" data-pb-inline="text" style="margin-top:6px;white-space:pre-line;outline:1px dashed var(--line);padding:4px 6px;border-radius:4px;">${E(b.text||"Nội dung chi tiết...")}</div>
    </div>`;
  }
  if(b.type==="cta"){
    return `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;${style}">
      <div style="flex:1;">
        <h3 contenteditable="true" data-pb-block="${idx}" data-pb-inline="title" style="margin:0 0 4px;outline:1px dashed var(--line);padding:2px 6px;">${E(b.title||"Tiêu đề kêu gọi hành động")}</h3>
        <p contenteditable="true" data-pb-block="${idx}" data-pb-inline="text" class="muted" style="margin:0;outline:1px dashed var(--line);padding:2px 6px;">${E(b.text||"Mô tả ngắn gọn")}</p>
      </div>
      <span class="primary" contenteditable="true" data-pb-block="${idx}" data-pb-inline="ctaText" style="padding:8px 14px;border-radius:999px;">${E(b.ctaText||b.label||"Mở liên kết")}</span>
    </div>`;
  }
  return pbPreviewBlockHtml(b);
}

function pbPreviewBlockHtml(b){
  if(window.SkyFirstDigital?.renderVisualBlock){
    return window.SkyFirstDigital.renderVisualBlock(b);
  }
  const style=pbCustomStyleStr(b);
  if(b.type==="hero") return `<div style="padding:28px;border-radius:16px;background:linear-gradient(125deg,#071b35,#0759b8);color:#fff;${style}"><h2>${E(b.title||"")}</h2><p>${E(b.subtitle||"")}</p>${b.ctaText?`<span class="pill white">${E(b.ctaText)} →</span>`:""}</div>`;
  if(b.type==="heading") return `<h2 style="margin:0;${style}">${E(b.text||"")}</h2>`;
  if(b.type==="paragraph") return `<p style="margin:0;line-height:1.7;${style}">${E(b.text||"")}</p>`;
  if(b.type==="callout") return `<div class="notice ${E(b.tone||"")}" style="${style}"><b>${E(b.title||"")}</b><p style="margin:4px 0 0">${E(b.text||"")}</p></div>`;
  return `<div class="card" style="${style}"><b>${E(b.type)}</b>: ${E(b.title||b.text||b.label||"")}</div>`;
}

window.addPbBlock=type=>{
  const cat=BLOCK_CATALOG.find(x=>x.type===type);if(!cat)return;
  pushPbHistory();
  const arr=activePbBlocks();
  arr.push({id:uid("blk"),type,...JSON.parse(JSON.stringify(cat.defaults))});
  pbState.selectedBlockIdx=arr.length-1;
  renderVisualBuilderWorkspace();
};
window.movePbBlock=(idx,dir)=>{
  const arr=activePbBlocks(),target=idx+dir;
  if(target<0||target>=arr.length)return;
  pushPbHistory();
  [arr[idx],arr[target]]=[arr[target],arr[idx]];
  pbState.selectedBlockIdx=target;
  renderVisualBuilderWorkspace();
};
window.duplicatePbBlock=idx=>{
  const arr=activePbBlocks(),b=arr[idx];if(!b)return;
  pushPbHistory();
  const copy=JSON.parse(JSON.stringify(b));copy.id=uid("blk");
  arr.splice(idx+1,0,copy);
  pbState.selectedBlockIdx=idx+1;
  renderVisualBuilderWorkspace();
};
window.removePbBlock=idx=>{
  pushPbHistory();
  activePbBlocks().splice(idx,1);
  renderVisualBuilderWorkspace();
};
window.editPbBlock=async idx=>{
  const arr=activePbBlocks(),b=arr[idx];if(!b)return;
  const structuredTypes=["columns","grid","table","stats","faq","tabs","timeline","guide"];
  const fields=[
    {name:"title",label:"Tiêu đề / Nhãn chính",value:b.title||b.label||""},
    {name:"text",label:"Nội dung văn bản / Mô tả",type:"textarea",value:b.text||b.subtitle||(b.items&&Array.isArray(b.items)&&typeof b.items[0]==="string"?b.items.join("\n"):""),rows:3},
    {name:"align",label:"Căn lề",type:"select",value:b.align||"left",options:[{value:"left",label:"Căn trái"},{value:"center",label:"Căn giữa"},{value:"right",label:"Căn phải"}]},
    {name:"fontFamily",label:"Phông chữ",type:"select",value:b.fontFamily||"",options:[{value:"",label:"Mặc định hệ thống"},{value:"'Be Vietnam Pro', Inter, sans-serif",label:"Be Vietnam Pro"},{value:"Inter, system-ui, sans-serif",label:"Inter"},{value:"Georgia, serif",label:"Georgia"},{value:"'JetBrains Mono', monospace",label:"JetBrains Mono"}]},
    {name:"fontSize",label:"Cỡ chữ",type:"select",value:b.fontSize||"",options:[{value:"",label:"Mặc định"},{value:"14px",label:"14px"},{value:"16px",label:"16px"},{value:"18px",label:"18px"},{value:"22px",label:"22px"},{value:"28px",label:"28px"},{value:"34px",label:"34px"}]},
    {name:"ref",label:"Liên kết URL / Mã biểu mẫu / Mã tệp PDF / Khóa khối dùng chung",value:b.ctaHref||b.href||b.formId||b.fileId||b.url||b.sharedKey||b.source||""}
  ];
  if(structuredTypes.includes(b.type)){
    const payloadKey=b.type==="columns"?"columns":b.type==="table"?"rows":b.type==="tabs"?"tabs":b.type==="timeline"||b.type==="guide"?"steps":"items";
    fields.push({name:"json_data",label:`Dữ liệu cấu trúc (${payloadKey} JSON)`,type:"textarea",rows:5,value:JSON.stringify(b[payloadKey]||[],null,2)});
  }
  const v=await adminDialog({title:`Chỉnh sửa thuộc tính khối #${idx+1} (${b.type})`,confirmText:"Áp dụng",fields});
  if(!v)return;
  pushPbHistory();
  b.align=v.align;
  if(v.fontFamily) b.fontFamily=v.fontFamily; else delete b.fontFamily;
  if(v.fontSize) b.fontSize=v.fontSize; else delete b.fontSize;
  if(b.type==="hero"){b.title=v.title;b.subtitle=v.text;b.ctaHref=v.ref;}
  else if(b.type==="heading"){b.text=v.title||v.text;}
  else if(b.type==="paragraph"){b.text=v.text;}
  else if(b.type==="callout"){b.title=v.title;b.text=v.text;}
  else if(b.type==="cta"){b.title=v.title;b.text=v.text;b.href=v.ref;}
  else if(b.type==="button"){b.label=v.title;b.href=v.ref;}
  else if(b.type==="pdf_embed"){b.title=v.title;b.fileId=v.ref;}
  else if(b.type==="form_embed"){b.title=v.title;b.formId=v.ref||"member";}
  else if(b.type==="image"||b.type==="video"){b.title=v.title;b.caption=v.text||v.title;b.url=v.ref||"/assets/sfn-logo-tight.png";}
  else if(b.type==="shared_block"){b.title=v.title;b.sharedKey=v.ref||"global-contact-strip";}
  else if(b.type==="dynamic_list"){b.title=v.title;b.source=v.ref||"programs";}
  else if(b.type==="list"){b.items=String(v.text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);}
  else if(structuredTypes.includes(b.type)){
    b.title=v.title;
    const payloadKey=b.type==="columns"?"columns":b.type==="table"?"rows":b.type==="tabs"?"tabs":b.type==="timeline"||b.type==="guide"?"steps":"items";
    try{b[payloadKey]=JSON.parse(v.json_data||"[]");}catch{toast("Cấu trúc dữ liệu JSON chưa hợp lệ, giữ nguyên cấu trúc cũ.","warn");}
  }
  renderVisualBuilderWorkspace();
};

window.saveVisualPage=async()=>{
  if(!pbState.current)return;
  const p=pbState.current;
  try{
    const r=await api(`/api/admin/cms/pages/${encodeURIComponent(p.id)}`,{
      method:"PUT",
      body:{title:p.title,title_en:p.title_en||"",slug:p.slug,route_path:p.route_path||null,page_type:p.page_type||"custom",summary:p.summary,summary_en:p.summary_en||"",blocks:p.blocks,blocks_en:p.blocks_en||[],seo:{meta_title:p.title,meta_description:p.summary||""},seo_en:{meta_title:p.title_en||p.title,meta_description:p.summary_en||p.summary||""}}
    });
    pbState.dirty=false;
    await loadConfig();
    toast(`Đã lưu trang CMS (Phiên bản v${r.version}).`);
    await openVisualBuilder(p.id);
  }catch(e){toast(errorText(e),"bad")}
};

window.runCmsWorkflow=async action=>{
  if(!pbState.current)return;
  if(pbState.dirty){await saveVisualPage();}
  let note="",scheduled_at=null;
  if(action==="reject"||action==="approve"){
    note=await adminPrompt("Ghi chú phê duyệt / lý do từ chối:","",{title:action==="approve"?"Phê duyệt trang CMS":"Từ chối duyệt trang CMS"});
    if(note===null)return;
  }
  if(action==="schedule"){
    const dt=await adminPrompt("Chọn thời điểm xuất bản tự động (UTC+7):","",{title:"Lên lịch xuất bản trang",type:"datetime-local",required:true});
    if(!dt)return;
    scheduled_at=`${dt}:00+07:00`;
  }
  try{
    const r=await api(`/api/admin/cms/pages/${encodeURIComponent(pbState.current.id)}/workflow`,{method:"POST",body:{action,note,scheduled_at}});
    await loadConfig();
    toast(`Đã chuyển trạng thái trang sang: ${r.status}`);
    await openVisualBuilder(pbState.current.id);
    await adminPageBuilder(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.restorePbRevision=async version=>{
  if(!pbState.current)return;
  if(!await adminConfirm(`Khôi phục trang về phiên bản v${version}?`,{title:"Khôi phục phiên bản trang"}))return;
  try{
    await api(`/api/admin/cms/pages/${encodeURIComponent(pbState.current.id)}/restore-version`,{method:"POST",body:{version}});
    toast(`Đã khôi phục phiên bản v${version}.`);
    await openVisualBuilder(pbState.current.id);
  }catch(e){toast(errorText(e),"bad")}
};

window.previewServerCmsPage=async id=>{
  try{
    const d=await api(`/api/admin/cms/pages/${encodeURIComponent(id)}/preview?lang=${encodeURIComponent(pbState.editLang)}`);
    const p=d.preview||{};
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">CHẾ ĐỘ XEM THỬ AN TOÀN · KHÔNG TỰ CÔNG KHAI BẢN NHÁP</span><h2>${E(p.title)} (${E((p.lang||"vi").toUpperCase())})</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <p class="muted">${E(p.summary||"")}</p>
    <div class="card" style="display:grid;gap:14px;background:var(--bg);padding:20px;">${(p.blocks||[]).map(b=>pbPreviewBlockHtml(b)).join("")}</div>
    <div class="admin-sticky-save"><button type="button" class="primary" onclick="closeModal()">Đóng</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

window.openSharedBlocksManager=async()=>{
  try{
    const d=await api("/api/admin/cms/shared-blocks");
    const items=d.items||[];
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">THƯ VIỆN KHỐI DÙNG CHUNG (REUSABLE BLOCKS)</span><h2>Quản lý Khối dùng chung & Cảnh báo trang bị ảnh hưởng</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <p class="muted">Khi cập nhật một khối dùng chung, tất cả các trang đang nhúng khối đó sẽ tự động cập nhật theo và hệ thống cảnh báo danh sách trang bị ảnh hưởng.</p>
    <div class="table-scroll"><table><thead><tr><th>Khóa (Key)</th><th>Tên khối</th><th>Trang đang sử dụng (Impact)</th><th>Thao tác</th></tr></thead><tbody>
      ${items.map(b=>`<tr><td><code>${E(b.key)}</code></td><td><b>${E(b.name)}</b><br><small class="muted">${E(b.description||"")}</small></td><td>${(b.affected_pages||[]).length?`<span class="status status-warn">Ảnh hưởng ${(b.affected_pages||[]).length} trang</span><br><small>${(b.affected_pages||[]).map(p=>E(p.title)).join(", ")}</small>`:`<span class="muted">Chưa trang nào nhúng</span>`}</td><td><button type="button" class="secondary" onclick="editSharedBlockItem('${E(b.id)}','${E(b.key)}','${E(b.name)}')">Sửa</button> <button type="button" class="danger" onclick="deleteSharedBlockItem('${E(b.id)}')">Xóa</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button><button type="button" class="primary" onclick="editSharedBlockItem('','','')">+ Tạo khối dùng chung mới</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

window.editSharedBlockItem=async(id,key,name)=>{
  const v=await adminDialog({title:id?`Cập nhật khối dùng chung: ${name}`:"Tạo khối dùng chung mới",description:"Hệ thống sẽ kiểm tra và thông báo số trang bị ảnh hưởng sau khi lưu.",confirmText:"Lưu khối dùng chung",fields:[
    {name:"key",label:"Khóa định danh (key) *",value:key||"custom-shared-banner",required:true},
    {name:"name",label:"Tên hiển thị *",value:name||"Khối thông báo dùng chung",required:true},
    {name:"title",label:"Tiêu đề hiển thị trong khối",value:name||"Thông báo từ Hệ thống Thông tin Số Sky First",required:true},
    {name:"text",label:"Nội dung khối (Tiếng Việt)",type:"textarea",rows:3,value:"Mọi hồ sơ và chứng nhận đều được đối soát trực tuyến tại app.skyfirst.io.vn."},
    {name:"text_en",label:"Nội dung khối (English)",type:"textarea",rows:3,value:"All records and credentials are verified online at app.skyfirst.io.vn."}
  ]});
  if(!v)return;
  try{
    const r=await api("/api/admin/cms/shared-blocks",{method:"POST",body:{
      id:id||undefined,key:v.key,name:v.name,
      block:{type:"callout",tone:"good",title:v.title,text:v.text},
      block_en:{type:"callout",tone:"good",title:v.title,text:v.text_en||v.text}
    }});
    toast(`Đã lưu khối dùng chung (${r.warning||"0 trang bị ảnh hưởng"}).`);
    openSharedBlocksManager();
  }catch(e){toast(errorText(e),"bad")}
};

window.deleteSharedBlockItem=async id=>{
  if(!await adminConfirm("Xóa khối dùng chung này? Hệ thống sẽ từ chối nếu khối đang được nhúng trên trang CMS.",{title:"Xóa khối dùng chung",danger:true}))return;
  try{
    await api(`/api/admin/cms/shared-blocks/${encodeURIComponent(id)}`,{method:"DELETE"});
    toast("Đã xóa khối dùng chung.");
    openSharedBlocksManager();
  }catch(e){toast(errorText(e),"bad")}
};

window.openTemplatesManager=async()=>{
  try{
    const d=await api("/api/admin/cms/templates");
    const items=d.items||[];
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">THƯ VIỆN MẪU BỐ CỤC (PAGE TEMPLATES)</span><h2>Quản lý Mẫu trang (${items.length})</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <div class="table-scroll"><table><thead><tr><th>Mã mẫu</th><th>Tên & Danh mục</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>
      ${items.map(t=>`<tr><td><code>${E(t.id)}</code></td><td><b>${E(t.name)}</b><br><span class="pill">${E(t.category||"general")}</span></td><td>${E(t.description||"")}</td><td><button type="button" class="danger" onclick="deleteCmsTemplateItem('${E(t.id)}')">Xóa</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="closeModal()">Đóng</button><button type="button" class="primary" onclick="createNewCmsTemplate()">+ Tạo mẫu bố cục từ trang đang mở</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

window.createNewCmsTemplate=async()=>{
  const v=await adminDialog({title:"Lưu mẫu bố cục mới",confirmText:"Lưu mẫu",fields:[
    {name:"name",label:"Tên mẫu bố cục *",required:true,placeholder:"VD: Mẫu trang Sự kiện chuyên đề"},
    {name:"category",label:"Danh mục",value:"operations"},
    {name:"description",label:"Mô tả ngắn",value:"Mẫu bố cục chuẩn của Sky First"}
  ]});
  if(!v)return;
  const blocks=pbState.current?.blocks||[{id:uid("blk"),type:"hero",title:v.name,subtitle:v.description,align:"center"}];
  try{
    await api("/api/admin/cms/templates",{method:"POST",body:{name:v.name,category:v.category,description:v.description,blocks}});
    toast("Đã lưu mẫu bố cục mới.");
    await adminPageBuilder(document.getElementById("adminMain"));
    openTemplatesManager();
  }catch(e){toast(errorText(e),"bad")}
};

window.deleteCmsTemplateItem=async id=>{
  try{
    await api(`/api/admin/cms/templates/${encodeURIComponent(id)}`,{method:"DELETE"});
    toast("Đã xóa mẫu bố cục.");
    openTemplatesManager();
  }catch(e){toast(errorText(e),"bad")}
};

window.openWordPressImportModal=async()=>{
  const v=await adminDialog({title:"Đồng bộ & Nhập trang từ Headless WordPress / Gutenberg",description:"Chuyển đổi an toàn bài viết/trang WordPress REST API (hoặc HTML chú thích khối <!-- wp:... -->) sang cấu trúc khối JSON của D1 mà không cho phép thực thi mã tùy ý.",confirmText:"Nhập vào CMS (Bản nháp)",fields:[
    {name:"website_id",label:"Website đích",type:"select",value:"app",options:pbState.websites.map(w=>({value:w.id,label:`${w.name} (${w.domain})`}))},
    {name:"title",label:"Tiêu đề trang *",required:true,placeholder:"Tiêu đề bài viết / trang WordPress"},
    {name:"slug",label:"Slug đường dẫn *",required:true,placeholder:"trang-nhap-tu-wordpress"},
    {name:"content",label:"Nội dung Gutenberg Block Markup hoặc WordPress Content *",type:"textarea",rows:6,required:true,value:`<!-- wp:heading -->\n<h2>Giới thiệu chương trình từ WordPress</h2>\n<!-- /wp:heading -->\n<!-- wp:paragraph -->\n<p>Nội dung được chuyển đổi tự động sang khối dữ liệu cấu trúc an toàn trên Cloudflare D1.</p>\n<!-- /wp:paragraph -->`}
  ]});
  if(!v)return;
  try{
    const r=await api("/api/admin/cms/wordpress/import",{method:"POST",body:{website_id:v.website_id,title:v.title,slug:v.slug,content:v.content}});
    toast(`Đã nhập ${r.imported_blocks_count||0} khối từ WordPress/Gutenberg.`);
    await adminPageBuilder(document.getElementById("adminMain"));
    await openVisualBuilder(r.id);
  }catch(e){toast(errorText(e),"bad")}
};

window.exportPageWordPress=async id=>{
  try{
    const d=await api(`/api/admin/cms/pages/${encodeURIComponent(id)}/wordpress-export`);
    modal(`<div class="admin-modal-head"><div><span class="eyebrow">WORDPRESS GUTENBERG & REST PAYLOAD</span><h2>Xuất chuẩn WordPress: ${E(d.wp_payload?.title||"")}</h2></div><button type="button" class="admin-modal-close" onclick="closeModal()">×</button></div>
    <p class="muted">Dữ liệu dưới đây tương thích với WordPress Gutenberg Block Editor và WordPress REST API (<code>/wp-json/wp/v2/pages</code>).</p>
    <div class="field"><label>Gutenberg Block Content</label><textarea rows="10" readonly>${E(d.wp_payload?.content||"")}</textarea></div>
    <div class="admin-sticky-save"><button type="button" class="secondary" onclick="navigator.clipboard?.writeText(${JSON.stringify(d.wp_payload?.content||"")}).then(()=>toast('Đã sao chép mã Gutenberg.'))">Sao chép Gutenberg Markup</button><button type="button" class="primary" onclick="closeModal()">Đóng</button></div>`);
  }catch(e){toast(errorText(e),"bad")}
};

async function loadSettingsMap(){
  const d=await api("/api/admin/settings");
  return Object.fromEntries((d.items||[]).map(x=>[x.key,x.value]));
}
async function saveSettingItems(items,msg="Đã lưu thay đổi."){
  await api("/api/admin/settings",{method:"PUT",body:{items}});
  toast(msg);await loadConfig();
}

// ================= NHẬN DIỆN, TRANG CHỦ & DESIGN SYSTEM (#admin/site) =================
async function adminSite(main){
  const [m,dsRes]=await Promise.all([
    loadSettingsMap(),
    api("/api/admin/design-system").catch(()=>({design_system:{}}))
  ]);
  state.admin.settings=m;
  const ds=dsRes.design_system||{};
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">NHẬN DIỆN THƯƠNG HIỆU & HỆ THỐNG THIẾT KẾ</span><h1>Cài đặt Nhận diện, Khu vực Mở đầu & Hệ thống Thiết kế</h1><p class="muted">Quản lý nhận diện thương hiệu, nội dung Hero song ngữ và bảng màu/kiểu chữ toàn cục mà không cần sửa mã nguồn.</p></div></div>
  <div class="admin-grid2">
    <div class="card">
      <h2>01 / Nhận diện thương hiệu</h2>
      <div class="field"><label>Tên hệ thống (VI)</label><input id="siteName" value="${E(m.app_name||"Hệ thống Thông tin Số Sky First")}"></div>
      <div class="field"><label>Tên hệ thống (EN)</label><input id="siteNameEn" value="${E(m.app_name_en||"Sky First Digital Information System")}"></div>
      <div class="field"><label>Châm ngôn (VI)</label><input id="siteSlogan" value="${E(m.brand_slogan||"")}"></div>
      <div class="field"><label>Châm ngôn (EN)</label><input id="siteSloganEn" value="${E(m.brand_slogan_en||"")}"></div>
      <div class="row2"><div class="field"><label>Website chính</label><input id="siteWebsite" value="${E(m.website||"https://skyfirst.io.vn")}"></div><div class="field"><label>Hotline/Zalo</label><input id="siteHotline" value="${E(m.hotline||"0924 910 210")}"></div></div>
    </div>
    <div class="card">
      <h2>02 / Hero Trang chủ (VI / EN)</h2>
      <div class="field"><label>Tiêu đề Hero (VI)</label><input id="siteHeroTitle" value="${E(m.hero_title||"Kết nối giáo dục. Phát triển cộng đồng.")}"></div>
      <div class="field"><label>Tiêu đề Hero (EN)</label><input id="siteHeroTitleEn" value="${E(m.hero_title_en||"Connecting Education. Empowering Communities.")}"></div>
      <div class="field"><label>Mô tả Hero (VI)</label><textarea id="siteHeroText" rows="2">${E(m.hero_text||"")}</textarea></div>
      <div class="field"><label>Mô tả Hero (EN)</label><textarea id="siteHeroTextEn" rows="2">${E(m.hero_text_en||"")}</textarea></div>
      <div class="field"><label>Ảnh Hero</label><div class="input-action"><input id="siteHeroCover" value="${E(m.hero_cover_url||"/assets/sfn-cover.png")}"><button type="button" class="secondary" onclick="location.hash='admin/media'">Chọn/Tải ảnh</button></div></div>
      <button type="button" class="primary" onclick="saveAdminSite()">Lưu Nhận diện & Hero</button>
    </div>
  </div>
  <section class="card admin-card-premium" style="margin-top:18px;">
    <div class="admin-card-heading"><div><span class="eyebrow">03 / THÔNG SỐ HỆ THỐNG THIẾT KẾ</span><h2>Bảng màu, Kiểu chữ, Bo góc & Mật độ giao diện</h2></div></div>
    <form id="designSystemForm">
      <div class="row2">
        <div class="field"><label>Màu chủ đạo (Primary Color)</label><input name="primary_color" value="${E(ds.primary_color||"#0759b8")}"></div>
        <div class="field"><label>Màu nền đậm (Navy Color)</label><input name="navy_color" value="${E(ds.navy_color||"#071b35")}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Màu nhấn (Accent Color)</label><input name="accent_color" value="${E(ds.accent_color||"#0ca678")}"></div>
        <div class="field"><label>Màu bề mặt (Surface Color)</label><input name="surface_color" value="${E(ds.surface_color||"#f6f9fc")}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Font tiêu đề (Heading)</label><input name="font_heading" value="${E(ds.font_heading||"Inter, system-ui, sans-serif")}"></div>
        <div class="field"><label>Font nội dung (Body)</label><input name="font_body" value="${E(ds.font_body||"Inter, system-ui, sans-serif")}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Độ bo góc thẻ (Border Radius)</label><input name="border_radius" value="${E(ds.border_radius||"16px")}"></div>
        <div class="field"><label>Độ rộng khung trang (Container Max Width)</label><input name="container_width" value="${E(ds.container_width||"1240px")}"></div>
      </div>
      <button type="submit" class="primary">Lưu Hệ thống Thiết kế</button>
    </form>
  </section>`;
  document.getElementById("designSystemForm").onsubmit=async e=>{
    e.preventDefault();
    const body=Object.fromEntries(new FormData(e.target));
    try{
      await api("/api/admin/design-system",{method:"PUT",body});
      await loadConfig();
      window.SkyFirstDigital?.applyDesignSystem?.(state.config?.design_system||body);
      toast("Đã cập nhật thông số Hệ thống Thiết kế.");
    }catch(err){toast(errorText(err),"bad")}
  };
}
window.saveAdminSite=()=>saveSettingItems({
  app_name:document.getElementById("siteName").value,
  app_name_en:document.getElementById("siteNameEn").value,
  brand_slogan:document.getElementById("siteSlogan").value,
  brand_slogan_en:document.getElementById("siteSloganEn").value,
  website:document.getElementById("siteWebsite").value,
  hotline:document.getElementById("siteHotline").value,
  hero_title:document.getElementById("siteHeroTitle").value,
  hero_title_en:document.getElementById("siteHeroTitleEn").value,
  hero_text:document.getElementById("siteHeroText").value,
  hero_text_en:document.getElementById("siteHeroTextEn").value,
  hero_cover_url:document.getElementById("siteHeroCover").value
},"Đã cập nhật nhận diện website và Hero.");

// ================= THANH ĐIỀU HƯỚNG & QUẢN LÝ MENU (#admin/header) =================
async function adminHeader(main){
  const [m,menusRes]=await Promise.all([
    loadSettingsMap(),
    api("/api/admin/menus").catch(()=>({items:[]}))
  ]);
  const hdrMenu=(menusRes.items||[]).find(x=>x.location==="header")||{items:[]};
  state.admin.headerMenuItems=hdrMenu.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">GIAO DIỆN & ĐIỀU HƯỚNG</span><h1>Đầu trang (Header) & Quản lý Menu Chính</h1><p class="muted">Bật/tắt thành phần Header và cấu hình danh sách mục điều hướng song ngữ VI/EN hiển thị trên thanh menu công khai.</p></div></div>
  <div class="admin-grid2">
    <div class="card">
      <h2>01 / Thành phần Header</h2>
      <div class="check"><input id="hdrShowBrand" type="checkbox" ${m.header_show_brand!==false?"checked":""}><label>Hiển thị logo và tên Sky First</label></div>
      <div class="check"><input id="hdrShowTheme" type="checkbox" ${m.header_show_theme!==false?"checked":""}><label>Hiển thị nút đổi giao diện sáng/tối</label></div>
      <div class="check"><input id="hdrShowAccount" type="checkbox" ${m.header_show_account!==false?"checked":""}><label>Hiển thị liên kết quản trị tại chân trang</label></div>
      <div class="field"><label>Nhãn nút tài khoản</label><input id="hdrAccountLabel" value="${E(m.header_account_label||"Đăng nhập")}"></div>
      <button type="button" class="primary" onclick="saveHeaderSettings()">Lưu cấu hình Header</button>
    </div>
    <div class="card">
      <div class="toolbar"><h2 style="margin:0;margin-right:auto;">02 / Menu điều hướng chính (${state.admin.headerMenuItems.length})</h2><button type="button" class="secondary" onclick="addHeaderMenuItem()">+ Thêm mục menu</button></div>
      <div class="table-scroll"><table><thead><tr><th>Nhãn (VI / EN)</th><th>Đường dẫn</th><th>Bật</th><th></th></tr></thead><tbody id="hdrMenuRows">
        ${state.admin.headerMenuItems.map((it,idx)=>`<tr>
          <td><input value="${E(it.label_vi||it.label||"")}" data-hm-vi="${idx}" placeholder="Nhãn VI" style="margin-bottom:4px;"><input value="${E(it.label_en||"")}" data-hm-en="${idx}" placeholder="Label EN"></td>
          <td><input value="${E(it.href||"/")}" data-hm-href="${idx}"></td>
          <td><input type="checkbox" data-hm-enabled="${idx}" ${it.enabled!==false?"checked":""}></td>
          <td><button type="button" class="ghost" onclick="moveHeaderMenuItem(${idx},-1)">↑</button><button type="button" class="ghost" onclick="moveHeaderMenuItem(${idx},1)">↓</button><button type="button" class="danger" onclick="removeHeaderMenuItem(${idx})">×</button></td>
        </tr>`).join("")}
      </tbody></table></div>
      <button type="button" class="primary" style="margin-top:12px;" onclick="saveHeaderMenu()">Lưu Menu điều hướng</button>
    </div>
  </div>`;
}
window.saveHeaderSettings=()=>saveSettingItems({header_show_brand:document.getElementById("hdrShowBrand").checked,header_show_theme:document.getElementById("hdrShowTheme").checked,header_show_account:document.getElementById("hdrShowAccount").checked,header_account_label:document.getElementById("hdrAccountLabel").value},"Đã lưu Header.");
window.syncHeaderMenuDom=()=>{
  state.admin.headerMenuItems=(state.admin.headerMenuItems||[]).map((it,idx)=>({
    ...it,
    label_vi:document.querySelector(`[data-hm-vi="${idx}"]`)?.value||it.label_vi||"",
    label_en:document.querySelector(`[data-hm-en="${idx}"]`)?.value||it.label_en||"",
    href:document.querySelector(`[data-hm-href="${idx}"]`)?.value||it.href||"/",
    enabled:!!document.querySelector(`[data-hm-enabled="${idx}"]`)?.checked
  }));
};
window.addHeaderMenuItem=()=>{window.syncHeaderMenuDom();state.admin.headerMenuItems.push({id:uid("m"),label_vi:"Mục mới",label_en:"New Item",href:"/trang/gioi-thieu",enabled:true});adminHeader(document.getElementById("adminMain"));};
window.moveHeaderMenuItem=(idx,dir)=>{window.syncHeaderMenuDom();const a=state.admin.headerMenuItems,t=idx+dir;if(t<0||t>=a.length)return;[a[idx],a[t]]=[a[t],a[idx]];adminHeader(document.getElementById("adminMain"));};
window.removeHeaderMenuItem=idx=>{window.syncHeaderMenuDom();state.admin.headerMenuItems.splice(idx,1);adminHeader(document.getElementById("adminMain"));};
window.saveHeaderMenu=async()=>{
  window.syncHeaderMenuDom();
  try{
    await api("/api/admin/menus/header",{method:"PUT",body:{website_id:"app",title:"Menu điều hướng chính",items:state.admin.headerMenuItems}});
    await loadConfig();
    toast("Đã lưu Menu điều hướng chính.");
  }catch(e){toast(errorText(e),"bad")}
};

// ================= CHÂN TRANG & LIÊN KẾT 7 WEBSITE CHUẨN (#admin/footer) =================
async function adminFooter(main){
  const m=await loadSettingsMap();
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">GIAO DIỆN & LIÊN KẾT HỆ SINH THÁI</span><h1>Cuối trang (Footer) & 7 Website Chuẩn Sky First</h1><p class="muted">Chỉnh thông tin liên hệ, thông điệp bản quyền song ngữ và liên kết 7 cổng chính thức của Hệ sinh thái Sky First.</p></div></div>
  <div class="admin-grid2">
    <div class="card">
      <h2>Thông tin liên hệ & Bản quyền</h2>
      <div class="field"><label>Mô tả ngắn (VI)</label><textarea id="ftDesc" rows="2">${E(m.footer_description||"")}</textarea></div>
      <div class="field"><label>Mô tả ngắn (EN)</label><textarea id="ftDescEn" rows="2">${E(m.footer_description_en||"")}</textarea></div>
      <div class="row2"><div class="field"><label>Email liên hệ</label><input id="ftEmail" value="${E(m.footer_email||"lienhe@skyfirst.io.vn")}"></div><div class="field"><label>Email hỗ trợ</label><input id="ftSupport" value="${E(m.footer_support_email||"support@skyfirst.io.vn")}"></div></div>
      <div class="row2"><div class="field"><label>Email Hệ thống Số</label><input id="ftPortalEmail" value="${E(m.footer_portal_email||"app@skyfirst.io.vn")}"></div><div class="field"><label>Điện thoại / Zalo</label><input id="ftHotline" value="${E(m.hotline||"0924 910 210")}"></div></div>
      <div class="field"><label>Dòng bản quyền (VI)</label><input id="ftCopyright" value="${E(m.footer_copyright||"© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.")}"></div>
      <div class="field"><label>Thông điệp trích dẫn nguồn & bản quyền</label><textarea id="ftCitationNotice" rows="2">${E(m.footer_citation_notice||"Mọi thông tin trích dẫn phải ghi rõ nguồn và dẫn liên kết đến nội dung gốc khi có thể; không làm sai lệch nội dung và phải tuân thủ quy định về quyền tác giả, sở hữu trí tuệ và bảo vệ dữ liệu cá nhân.")}</textarea></div>
    </div>
    <div class="card">
      <h2>Liên kết 7 Website Hệ sinh thái Sky First</h2>
      <div class="field"><label>1. Hệ thống Thông tin Số (app.skyfirst.io.vn)</label><input id="ftApp" value="${E(m.portal_app_url||"https://app.skyfirst.io.vn")}"></div>
      <div class="field"><label>2. Trang thông tin điện tử Sky First (skyfirst.io.vn)</label><input id="ftMain" value="${E(m.portal_main_url||"https://skyfirst.io.vn")}"></div>
      <div class="field"><label>3. Cổng Thông tin điện tử (ctt.skyfirst.io.vn)</label><input id="ftCtt" value="${E(m.portal_ctt_url||"https://ctt.skyfirst.io.vn")}"></div>
      <div class="field"><label>4. Hệ thống Thư điện tử (mail.skyfirst.io.vn)</label><input id="ftMail" value="${E(m.portal_mail_url||"https://mail.skyfirst.io.vn")}"></div>
      <div class="field"><label>5. Chuyên trang Thành viên (member.skyfirst.io.vn)</label><input id="ftMember" value="${E(m.portal_member_url||"https://member.skyfirst.io.vn")}"></div>
      <div class="field"><label>6. CLB Tiếng Anh The Sky First (sfec.skyfirst.io.vn)</label><input id="ftSfec" value="${E(m.portal_sfec_url||"https://sfec.skyfirst.io.vn")}"></div>
      <div class="field"><label>7. Cổng Khảo thí & Đánh giá năng lực (exam.skyfirst.io.vn)</label><input id="ftExam" value="${E(m.portal_exam_url||"https://exam.skyfirst.io.vn")}"></div>
    </div>
  </div>
  <button type="button" class="primary" style="margin-top:14px;" onclick="saveFooterSettings()">Lưu toàn bộ Footer & Hệ sinh thái</button>`;
}
window.saveFooterSettings=()=>saveSettingItems({
  footer_description:document.getElementById("ftDesc").value,
  footer_description_en:document.getElementById("ftDescEn").value,
  footer_email:document.getElementById("ftEmail").value,
  footer_support_email:document.getElementById("ftSupport").value,
  footer_portal_email:document.getElementById("ftPortalEmail").value,
  hotline:document.getElementById("ftHotline").value,
  footer_copyright:document.getElementById("ftCopyright").value,
  footer_citation_notice:document.getElementById("ftCitationNotice")?.value||"",
  portal_app_url:document.getElementById("ftApp").value,
  portal_main_url:document.getElementById("ftMain").value,
  portal_ctt_url:document.getElementById("ftCtt").value,
  portal_mail_url:document.getElementById("ftMail").value,
  portal_member_url:document.getElementById("ftMember").value,
  portal_sfec_url:document.getElementById("ftSfec").value,
  portal_exam_url:document.getElementById("ftExam").value
},"Đã cập nhật Footer và 7 liên kết hệ sinh thái chuẩn.");

// ================= 6 CHẾ ĐỘ VẬN HÀNH, KIỂM TRA TRƯỚC MỞ LẠI, SỰ CỐ & QA (#admin/maintenance) =================
async function adminMaintenance(main){
  const [m,mcRes,incRes,preRes,qaRes]=await Promise.all([
    loadSettingsMap(),
    api("/api/admin/maintenance-config").catch(()=>({maintenance_config:{}})),
    api("/api/admin/system/incidents").catch(()=>({items:[]})),
    api("/api/admin/system/pre-reopen-check").catch(()=>({ready_to_reopen:true,checks:[]})),
    api("/api/admin/system/qa-check").catch(()=>({ok:true,checks:[]}))
  ]);
  const mc=mcRes.maintenance_config||{mode:"normal",title_vi:"Hệ thống đang được cập nhật",title_en:"System Under Maintenance",message_vi:"",message_en:"",allow_lookup:true,contact_email:"support@skyfirst.io.vn",hotline:"0924 910 210"};
  const incidents=incRes.items||[];
  const preChecks=preRes.checks||[];
  const qaChecks=qaRes.checks||[];

  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">ĐIỀU KHIỂN VẬN HÀNH MÁY CHỦ & KIỂM SOÁT PHÁT HÀNH</span><h1>6 Chế độ Vận hành, Bảo trì, Trang lỗi & Trung tâm Sự cố</h1><p class="muted">Mọi chế độ vận hành được cưỡng chế trực tiếp tại tầng Middleware/API của Worker. Hỗ trợ kiểm tra tự động trước khi mở lại website (Pre-reopen Check) và kiểm tra chất lượng phát hành (Release QA Gate).</p></div><span class="system-pill ${mc.mode==="normal"?"ok":"warn"}">Chế độ hiện hành: ${E(mc.mode)}</span></div>

  <div class="admin-grid2">
    <section class="card admin-card-premium">
      <div class="admin-card-heading"><div><span class="eyebrow">01 / CẤU HÌNH 6 CHẾ ĐỘ VẬN HÀNH</span><h2>Điều khiển trạng thái máy chủ</h2></div></div>
      <form id="opModeForm">
        <div class="field">
          <label for="mcMode">Chế độ vận hành toàn hệ thống *</label>
          <select id="mcMode" name="mode">
            <option value="normal" ${mc.mode==="normal"?"selected":""}>1. Hoạt động bình thường (normal)</option>
            <option value="manual_maintenance" ${mc.mode==="manual_maintenance"?"selected":""}>2. Bảo trì thủ công (manual_maintenance — chặn trang công khai)</option>
            <option value="scheduled_maintenance" ${mc.mode==="scheduled_maintenance"?"selected":""}>3. Bảo trì theo lịch (scheduled_maintenance — tự bật theo khung giờ)</option>
            <option value="emergency_maintenance" ${mc.mode==="emergency_maintenance"?"selected":""}>4. Bảo trì khẩn cấp (emergency_maintenance — ngắt ngay lập tức)</option>
            <option value="read_only" ${mc.mode==="read_only"?"selected":""}>5. Chỉ đọc (read_only — khóa gửi biểu mẫu/ghi dữ liệu công khai)</option>
            <option value="publishing_paused" ${mc.mode==="publishing_paused"?"selected":""}>6. Tạm dừng xuất bản (publishing_paused — khóa publish CMS/Tin tức)</option>
          </select>
        </div>
        <div class="row2">
          <div class="field"><label>Bắt đầu bảo trì theo lịch (ISO/UTC+7)</label><input name="scheduled_start" value="${E(mc.scheduled_start||"")}" placeholder="2026-11-01T00:00:00+07:00"></div>
          <div class="field"><label>Kết thúc dự kiến (ETA)</label><input name="scheduled_end" value="${E(mc.scheduled_end||"")}" placeholder="2026-11-01T04:00:00+07:00"></div>
        </div>
        <div class="row2">
          <div class="field"><label>Tiêu đề thông báo (VI)</label><input name="title_vi" value="${E(mc.title_vi||m.maintenance_title||"Hệ thống đang được cập nhật")}"></div>
          <div class="field"><label>Tiêu đề thông báo (EN)</label><input name="title_en" value="${E(mc.title_en||"System Under Maintenance")}"></div>
        </div>
        <div class="field"><label>Nội dung thông báo (VI)</label><textarea name="message_vi" rows="2">${E(mc.message_vi||m.maintenance_text||"Một số dịch vụ đang tạm dừng để bảo trì và nâng cấp định kỳ.")}</textarea></div>
        <div class="field"><label>Nội dung thông báo (EN)</label><textarea name="message_en" rows="2">${E(mc.message_en||"Some services are temporarily paused for scheduled maintenance.")}</textarea></div>
        <div class="check"><input type="checkbox" id="mcAllowLookup" ${mc.allow_lookup!==false?"checked":""}><label for="mcAllowLookup">Cho phép API xác thực chứng nhận (/api/lookup/certificate) hoạt động ngay cả khi bảo trì</label></div>
        <button type="submit" class="primary">Áp dụng Chế độ Vận hành</button>
      </form>
    </section>

    <section class="card admin-card-premium">
      <div class="admin-card-heading"><div><span class="eyebrow">02 / KIỂM TRA TRƯỚC KHI MỞ LẠI & CHẤT LƯỢNG PHÁT HÀNH</span><h2>Kiểm tra an toàn trước khi mở lại & Trang 404</h2></div></div>
      <div class="notice ${preRes.ready_to_reopen?"good":"warn"}" style="margin-bottom:12px;">
        <b>Trạng thái sẵn sàng mở lại (Pre-Reopen Check):</b> ${preRes.ready_to_reopen?"ĐẠT — Tất cả kiểm tra cốt lõi đều sẵn sàng":"CẦN KIỂM TRA"}
        <ul style="margin:6px 0 0 18px;">${preChecks.map(c=>`<li><b>${E(c.check)}:</b> ${c.ok?"✓ Đạt":"✕ Lỗi"} ${c.count!==undefined?`(${E(c.count)})`:""}</li>`).join("")}</ul>
      </div>
      <div class="notice ${qaRes.ok?"good":"warn"}" style="margin-bottom:14px;">
        <b>Kiểm tra chất lượng phát hành (Release QA Gate):</b> ${qaRes.ok?"ĐẠT":"CẦN XỬ LÝ"}
        <ul style="margin:6px 0 0 18px;">${qaChecks.map(c=>`<li><b>${E(c.name)}:</b> ${c.ok?"✓":"✕"} ${E(c.detail||"")}</li>`).join("")}</ul>
      </div>
      <h3>Tùy chỉnh Trang lỗi 404</h3>
      <div class="field"><label>Tiêu đề 404</label><input id="nfTitle" value="${E(m.not_found_title||"Không tìm thấy nội dung")}"></div>
      <div class="field"><label>Mô tả 404</label><textarea id="nfText" rows="2">${E(m.not_found_text||"Trang bạn đang tìm có thể đã được di chuyển, ẩn hoặc không còn tồn tại.")}</textarea></div>
      <div class="field"><label>Ảnh minh họa 404 (URL)</label><input id="nfImage" value="${E(m.not_found_image||"/assets/sfn-logo-tight.png")}"></div>
      <button type="button" class="secondary" onclick="saveMaintenanceSettings()">Lưu cấu hình Trang 404</button>
    </section>
  </div>

  <section class="card admin-card-premium" style="margin-top:18px;">
    <div class="toolbar"><div style="margin-right:auto"><span class="eyebrow">03 / NHẬT KÝ SỰ CỐ VẬN HÀNH</span><h2 style="margin:4px 0 0">Danh sách sự cố & bảo trì kỹ thuật (${incidents.length})</h2></div><button type="button" class="primary" onclick="createSystemIncidentModal()">+ Ghi nhận sự cố / đợt bảo trì</button></div>
    <div class="table-scroll"><table><thead><tr><th>Mã</th><th>Tiêu đề & Mức độ</th><th>Chế độ kích hoạt</th><th>Trạng thái</th><th>Thời gian</th><th></th></tr></thead><tbody>
      ${incidents.map(inc=>`<tr><td><b>${E(inc.code)}</b></td><td><b>${E(inc.title)}</b><br><small class="muted">${E(inc.summary||"")}</small></td><td><code>${E(inc.operational_mode||"normal")}</code></td><td><span class="status ${inc.status==="resolved"?"":"status-warn"}">${E(inc.status)}</span></td><td>${fmt(inc.started_at)}</td><td>${inc.status!=="resolved"?`<button type="button" class="secondary" onclick="resolveSystemIncident('${E(inc.id)}')">Đóng sự cố & Mở lại</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6" class="muted">Không có sự cố kỹ thuật nào đang mở.</td></tr>`}
    </tbody></table></div>
  </section>`;

  document.getElementById("opModeForm").onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const body=Object.fromEntries(fd);
    body.allow_lookup=document.getElementById("mcAllowLookup").checked;
    try{
      await api("/api/admin/maintenance-config",{method:"PUT",body});
      await loadConfig();
      toast(`Đã chuyển chế độ vận hành sang: ${body.mode}`);
      adminMaintenance(main);
    }catch(err){toast(errorText(err),"bad")}
  };
}
window.saveMaintenanceSettings=()=>saveSettingItems({not_found_title:document.getElementById("nfTitle").value,not_found_text:document.getElementById("nfText").value,not_found_image:document.getElementById("nfImage").value},"Đã lưu cấu hình trang 404.");

window.createSystemIncidentModal=async()=>{
  const v=await adminDialog({title:"Ghi nhận sự cố / đợt bảo trì hệ thống",confirmText:"Tạo bản ghi",fields:[
    {name:"title",label:"Tiêu đề sự cố / đợt bảo trì *",required:true},
    {name:"severity",label:"Mức độ",type:"select",value:"medium",options:["low","medium","high","critical"]},
    {name:"operational_mode",label:"Chuyển chế độ vận hành (tùy chọn)",type:"select",value:"normal",options:["normal","manual_maintenance","read_only","publishing_paused","emergency_maintenance"]},
    {name:"summary",label:"Mô tả chi tiết",type:"textarea",rows:3}
  ]});
  if(!v)return;
  try{
    await api("/api/admin/system/incidents",{method:"POST",body:v});
    await loadConfig();
    toast("Đã ghi nhận sự cố hệ thống.");
    adminMaintenance(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.resolveSystemIncident=async id=>{
  const note=await adminPrompt("Ghi chú khắc phục & kết quả kiểm tra:","Đã khắc phục và kiểm tra Pre-reopen đạt yêu cầu.",{title:"Đóng sự cố & Khôi phục vận hành"});
  if(note===null)return;
  try{
    await api(`/api/admin/system/incidents/${encodeURIComponent(id)}`,{method:"PATCH",body:{status:"resolved",resolution_note:note,restore_normal_mode:true}});
    await loadConfig();
    toast("Đã đóng sự cố và chuyển hệ thống về chế độ hoạt động bình thường.");
    adminMaintenance(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

// ================= THƯ VIỆN TÀI NGUYÊN & KIỂM TOÁN MEDIA (#admin/media) =================
async function adminMedia(main){
  const [d,auditRes]=await Promise.all([
    api("/api/admin/media"),
    api("/api/admin/media/audit").catch(()=>({summary:{total_files:0,in_use_count:0,orphan_count:0,broken_references_count:0},items:[],broken_references:[]}))
  ]);
  state.admin.media=d.items||[];
  const sum=auditRes.summary||{};
  const usageMap=Object.fromEntries((auditRes.items||[]).map(x=>[x.key,x]));
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">THƯ VIỆN ĐA PHƯƠNG TIỆN & KIỂM TOÁN TÀI NGUYÊN</span><h1>Thư viện Hình ảnh, SVG, PDF & Kiểm toán Sử dụng</h1><p class="muted">Quản lý tập trung ảnh JPG, PNG, WEBP, GIF, SVG (đã làm sạch mã thực thi) và PDF trên R2/D1. Tự động đối chiếu các trang CMS, bài viết và cài đặt đang sử dụng từng tệp.</p></div><button class="primary" onclick="uploadSiteImage()">+ Tải tài nguyên lên</button></div>
  <div class="kpis" style="margin-bottom:16px;">
    <div class="kpi"><b>${E(sum.total_files||state.admin.media.length)}</b>Tổng tệp trong thư viện</div>
    <div class="kpi"><b>${E(sum.in_use_count||0)}</b>Tệp đang gắn trên trang</div>
    <div class="kpi"><b>${E(sum.orphan_count||0)}</b>Tệp chưa gắn vào nội dung</div>
    <div class="kpi"><b>${E(sum.broken_references_count||0)}</b>Tham chiếu ảnh bị thiếu</div>
  </div>
  <div class="media-grid">${state.admin.media.map(x=>{
    const u=usageMap[x.key]||{};
    const usedBy=u.used_by||[];
    const isPdf=String(x.mime||"").includes("pdf")||String(x.key||"").endsWith(".pdf");
    return `<div class="media-card">${isPdf?`<div style="padding:28px;text-align:center;background:var(--bg);font-weight:700;">📄 Tài liệu PDF</div>`:`<img src="${E(x.url)}" alt="${E(x.key.split('/').pop())}">`}<div class="media-meta"><b>${E(x.key.split('/').pop())}</b><small>${Math.round((x.size||0)/1024)} KB · ${usedBy.length?`Đang dùng (${usedBy.length})`:"Chưa gắn"}</small><div class="actions"><button class="secondary" onclick="copyMediaUrl('${E(x.url)}')">Sao chép URL</button><button class="danger" onclick="deleteSiteImage('${E(x.key)}')">Xóa</button></div></div></div>`;
  }).join("")||`<div class="card muted">Chưa có tài nguyên tải lên.</div>`}</div>`;
}
window.uploadSiteImage=()=>{modal(`<div class="admin-dialog-head"><span class="eyebrow">THƯ VIỆN TÀI NGUYÊN SỐ</span><button type="button" class="admin-modal-close" onclick="closeModal()" aria-label="Đóng">×</button><h2>Tải ảnh / SVG / PDF lên Thư viện</h2><p class="muted">Hỗ trợ JPG, PNG, WEBP, GIF, SVG (được làm sạch script tự động) và PDF tối đa 15 MB.</p></div><form id="siteImageForm" class="admin-dialog-form"><div class="field"><label for="siteImageFile">Chọn tệp</label><input id="siteImageFile" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf" required><small class="muted">Chỉ sử dụng tài nguyên thực tế có quyền sử dụng hợp lệ.</small></div><div class="admin-dialog-actions"><button type="button" class="secondary" onclick="closeModal()">Hủy</button><button class="primary" id="siteImageSubmit">Tải lên</button></div></form>`);document.getElementById("siteImageForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,file=form.elements.file.files?.[0],submit=document.getElementById("siteImageSubmit");if(!file)return;if(!["image/jpeg","image/png","image/webp","image/gif","image/svg+xml","application/pdf"].includes(file.type)){toast("Chỉ hỗ trợ JPG, PNG, WEBP, GIF, SVG hoặc PDF.","bad");return}if(file.size>15*1024*1024){toast("Tệp vượt quá giới hạn 15 MB.","bad");return}const fd=new FormData(form);submit.disabled=true;submit.textContent="Đang tải lên…";try{const r=await api("/api/admin/media",{method:"POST",body:fd});closeModal();toast("Đã tải tài nguyên lên thư viện. Đường dẫn: "+r.url);adminMedia(document.getElementById("adminMain"));}catch(err){toast(errorText(err),"bad");submit.disabled=false;submit.textContent="Thử tải lại"}}};
window.copyMediaUrl=async url=>{const value=location.origin+url;try{await navigator.clipboard.writeText(value);toast("Đã sao chép URL tài nguyên.")}catch{modal(`<div class="admin-dialog-head"><span class="eyebrow">THƯ VIỆN TÀI NGUYÊN</span><button type="button" class="admin-modal-close" onclick="closeModal()" aria-label="Đóng">×</button><h2>URL tài nguyên</h2></div><div class="field"><label for="mediaUrlFallback">Đường dẫn đầy đủ</label><input id="mediaUrlFallback" value="${E(value)}" readonly></div><div class="admin-dialog-actions"><button type="button" class="secondary" onclick="closeModal()">Đóng</button></div>`);}};
window.deleteSiteImage=async key=>{if(!await adminConfirm("Tài nguyên chỉ có thể xóa khi không còn được dùng trong nội dung hoặc cấu hình. Thao tác này không thể hoàn tác.",{title:"Xóa khỏi thư viện",confirmText:"Xóa",danger:true}))return;api(`/api/admin/media/${encodeURIComponent(key)}`,{method:"DELETE"}).then(()=>{toast("Đã xóa tài nguyên.");adminMedia(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))};

async function adminModules(main){
  const d=await api("/api/admin/modules");
  state.admin.modules=d.items||[];

  main.innerHTML=`<h1>Quản lý Phân hệ Hệ thống</h1><p class="muted">Bật/tắt chức năng theo nhu cầu vận hành. Khi tắt một phân hệ, cả giao diện công khai lẫn API máy chủ đều tự động khóa truy cập phân hệ đó.</p><div class="card">${state.admin.modules.map(m=>`<div class="check"><input type="checkbox" data-module="${E(m.key)}" ${m.enabled?"checked":""}><label><b>${E(m.name)}</b> — ${E(m.description||"")} <span class="small muted">(${E(m.category)})</span></label></div>`).join("")}<button class="primary" onclick="saveModules()">Lưu cấu hình Phân hệ</button></div>`;
}

window.saveModules=()=>{
  const items=state.admin.modules.map(m=>({
    key:m.key,
    enabled:document.querySelector(
      `[data-module="${CSS.escape(m.key)}"]`
    ).checked
  }));

  api("/api/admin/modules",{
    method:"PUT",
    body:{items}
  }).then(async()=>{
    toast("Đã cập nhật trạng thái các Phân hệ.");
    await loadConfig();
  }).catch(e=>toast(errorText(e),"bad"));
};

async function adminSettings(main){
  const d=await api("/api/admin/settings");
  const map=Object.fromEntries((d.items||[]).map(x=>[x.key,x.value]));state.admin.settings=map;
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">CẤU HÌNH HỆ THỐNG</span><h1>Cài đặt hệ thống</h1><p class="muted">Quản lý thông tin vận hành chung. Bảng thống kê trang chủ và chế độ bảo trì chuyên sâu đã có phân hệ điều khiển riêng.</p></div></div><form id="adminSystemSettings" class="admin-system-settings"><section class="card admin-card-premium"><div class="admin-card-heading"><div><span class="eyebrow">01 / NHẬN DIỆN</span><h2>Thông tin hệ thống</h2></div></div><div class="row2"><div class="field"><label for="sAppName">Tên hệ thống</label><input id="sAppName" value="${E(map.app_name||"")}" required></div><div class="field"><label for="sReceiver">Email nhận đăng ký</label><input id="sReceiver" type="email" value="${E(map.receiver_email||"skyfirst.ec@gmail.com")}" required></div><div class="field"><label for="sHotline">Hotline / Zalo</label><input id="sHotline" value="${E(map.hotline||"0924 910 210")}"></div><div class="field"><label for="sWebsite">Website chính</label><input id="sWebsite" type="url" value="${E(map.website||"https://skyfirst.io.vn")}"></div><div class="field"><label for="sSlogan">Châm ngôn</label><input id="sSlogan" value="${E(map.brand_slogan||"")}"></div><div class="field"><label for="sRetention">Thời hạn lưu hồ sơ không phù hợp (ngày)</label><input id="sRetention" type="number" min="1" max="36500" value="${E(map.rejected_application_retention_days||365)}" required></div></div></section><section class="card admin-card-premium"><div class="admin-card-heading"><div><span class="eyebrow">02 / VẬN HÀNH</span><h2>Trạng thái website</h2></div></div><label class="admin-toggle-row"><input id="sMaintenance" type="checkbox" ${map.maintenance_mode?"checked":""}><span><b>Bật chế độ bảo trì công khai</b><small>Khi bật, khách truy cập sẽ thấy trang thông báo bảo trì. Quản trị viên vẫn có thể đăng nhập.</small></span></label><div class="notice warn">Chỉ bật bảo trì khi thật sự cần thiết; nhớ tắt sau khi hoàn tất triển khai.</div></section><div class="admin-sticky-save"><span>Bảo toàn nguyên vẹn cấu trúc cơ sở dữ liệu và dữ liệu nghiệp vụ.</span><button type="submit" class="primary" id="saveSystemSettings">Lưu cài đặt</button></div></form>`;
  document.getElementById("adminSystemSettings").addEventListener("submit",async e=>{
    e.preventDefault();const btn=document.getElementById("saveSystemSettings");
    const retention=Number(document.getElementById("sRetention").value);if(!Number.isInteger(retention)||retention<1||retention>36500){toast("Thời hạn lưu phải từ 1 đến 36.500 ngày.","bad");return;}
    btn.disabled=true;btn.textContent="Đang lưu…";
    try{await api("/api/admin/settings",{method:"PUT",body:{items:{app_name:document.getElementById("sAppName").value.trim(),receiver_email:document.getElementById("sReceiver").value.trim(),hotline:document.getElementById("sHotline").value.trim(),website:document.getElementById("sWebsite").value.trim(),brand_slogan:document.getElementById("sSlogan").value.trim(),rejected_application_retention_days:retention,maintenance_mode:document.getElementById("sMaintenance").checked}}});await loadConfig();toast("Đã lưu cài đặt hệ thống.");await adminSettings(main);}catch(err){toast(errorText(err),"bad");btn.disabled=false;btn.textContent="Lưu cài đặt";}
  });
}

async function adminSearch(main){
  main.innerHTML=`<h1>Tìm kiếm toàn hệ thống</h1><div class="card"><div class="field"><label>Từ khóa</label><input id="globalSearch" placeholder="Mã hồ sơ, họ tên, GCN, văn bản, ticket…"></div><button class="primary" onclick="runSearch()">Tìm</button><div id="searchResults" class="search-results"></div></div>`;
}

window.runSearch=async()=>{
  const q=document.getElementById("globalSearch").value.trim();
  if(q.length<2)return;

  try{
    const d=await api(
      `/api/admin/search?q=${encodeURIComponent(q)}`
    );

    document.getElementById("searchResults").innerHTML=
      (d.items||[]).map(x=>`<div class="card"><span class="pill">${E(x.kind)}</span><b>${E(x.ref)}</b> — ${E(x.title)}<br><span class="muted">${E(x.detail||"")}</span></div>`).join("")||
      "<div class='notice'>Không có kết quả.</div>";
  }catch(e){
    toast(errorText(e),"bad");
  }
};

async function adminAudit(main){
  const d=await api("/api/admin/audit");

  main.innerHTML=`<h1>Nhật ký Kiểm toán Hệ thống (Audit Log)</h1><div class="card table-scroll"><table><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>${(d.items||[]).map(x=>`<tr><td>${fmt(x.created_at)}</td><td>${E(x.actor_email||"Hệ thống")}</td><td>${E(x.action)}</td><td>${E(x.entity_type||"")} ${E(x.entity_id||"")}</td></tr>`).join("")}</tbody></table></div>`;
}

async function adminBackup(main){
  const d=await api("/api/admin/backups");

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Sao lưu & Phục hồi Dữ liệu (D1 + R2)</h1><button class="primary" onclick="createBackup()">Tạo bản sao lưu ngay</button></div><div class="notice">Mỗi bản sao lưu bao gồm mã băm toàn vẹn SHA-256 và thống kê số bản ghi từng bảng. Hệ thống tự động kiểm tra SHA-256 trước khi khôi phục.</div><div class="card">${(d.items||[]).map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);"><div><b>${E(x.id)}</b> — ${Math.round((x.size||0)/1024)} KB — ${fmt(x.created_at)}<br><small class="muted">SHA-256: <code>${E((x.sha256||"—").slice(0,24))}…</code></small></div><button class="danger" onclick="restoreBackup('${E(x.id)}')">Phục hồi</button></div>`).join("")||"<p>Chưa có bản sao lưu nào.</p>"}</div>`;
}

window.restoreBackup=async idb=>{
  if(!await adminConfirm("Phục hồi sẽ ghi đè dữ liệu nghiệp vụ bằng bản sao lưu đã chọn sau khi đối chiếu mã băm SHA-256. Chỉ thực hiện khi đã xác minh đúng bản backup.",{title:"Phục hồi bản sao lưu",confirmText:"Phục hồi dữ liệu",danger:true}))return;
  api(`/api/admin/backups/${encodeURIComponent(idb)}/restore`,{method:"POST"})
    .then(()=>{toast("Đã phục hồi bản sao lưu thành công.");adminBackup(document.getElementById("adminMain"));})
    .catch(e=>toast(errorText(e),"bad"));
};

window.createBackup=()=>api("/api/admin/backup",{
  method:"POST"
}).then(()=>{
  toast("Đã tạo bản sao lưu kèm mã băm SHA-256.");
  adminBackup(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

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
    GOOGLE_OAUTH_NOT_CONFIGURED:"Đăng nhập Google chưa được cấu hình.",
    INTERNAL_ERROR:"Hệ thống gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại; nếu lỗi lặp lại, dùng mã tham chiếu trong phản hồi để kiểm tra nhật ký.",
    OWNER_PROTECTED:"Tài khoản Chủ sở hữu hệ thống được bảo vệ.",
    OWNER_ROLE_NOT_ASSIGNABLE_HERE:"Vai trò Chủ sở hữu hệ thống không thể cấp từ màn hình này.",
    OWNER_CANNOT_BE_DISABLED:"Phải luôn duy trì ít nhất một Chủ sở hữu hệ thống đang hoạt động.",
    FEATURE_TEMPORARILY_UNAVAILABLE:"Chức năng này tạm thời chưa tương thích với cấu trúc dữ liệu hiện tại.",
    DUPLICATE_FORM_ID:"Mã định danh biểu mẫu đã tồn tại. Vui lòng chọn một mã khác.",
    DUPLICATE_TERM_CODE:"Mã điều khoản đã tồn tại. Vui lòng chọn mã khác hoặc sửa điều khoản hiện có.",
    BANK_CONFIG_INCOMPLETE:"Chương trình tài trợ chưa cấu hình đầy đủ thông tin ngân hàng thụ hưởng (mã BIN, số tài khoản, tên chủ tài khoản).",
    INVALID_INPUT:"Dữ liệu gửi lên chưa đầy đủ hoặc chưa đúng định dạng. Vui lòng kiểm tra lại các trường bắt buộc.",
    ASSET_IN_USE:"Tệp đang được tham chiếu bởi hồ sơ, tài liệu hoặc trang nội dung nên không thể xóa.",
    SELF_APPROVAL_FORBIDDEN:"Nguyên tắc tách biệt nhiệm vụ: Người khởi tạo không được tự phê duyệt giao dịch do chính mình tạo."
  };

  return map[code]||code;
}

async function handleQueryActions(){
  const q=new URLSearchParams(location.search);

  if(q.get("verify")){
    try{
      await api("/api/auth/verify-email",{
        method:"POST",
        body:{token:q.get("verify")}
      });

      history.replaceState(
        {},
        document.title,
        location.pathname+location.hash
      );

      toast("Email đã được xác minh.");
    }catch(e){
      toast(errorText(e),"bad");
    }
  }

  if(q.get("reset")){
    const token=q.get("reset");

    history.replaceState(
      {},
      document.title,
      location.pathname+location.hash
    );

    modal(`<h2>Đặt lại mật khẩu</h2><form id="resetPw"><div class="field"><label>Mật khẩu mới</label><input name="new_password" type="password" minlength="10" required></div><button class="primary">Đặt lại</button></form>`);

    document.getElementById("resetPw").onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target);

      try{
        await api("/api/auth/reset",{
          method:"POST",
          body:{
            token,
            new_password:f.get("new_password")
          }
        });

        closeModal();
        toast("Đã đặt lại mật khẩu.");
        location.hash="login";
      }catch(err){
        toast(errorText(err),"bad");
      }
    };
  }

  if(q.get("auth_error")){
    toast(errorText({message:q.get("auth_error")}),"bad");
  }
}

async function router(){
  const hash=(location.hash||"#home").slice(1);
  const [route,param]=hash.split("/");
  const path=location.pathname.replace(/\/+$/,"/")||"/";

  try{
    if((path==="/admin/login"||route==="login")&&state.user&&isAdmin(state.user)&&route==="admin"){
      if(path==="/admin/login")history.replaceState(null,"","/admin"+(location.hash||"#admin/dashboard"));
      return renderAdmin();
    }
    if(path==="/admin/login"&&state.user&&isAdmin(state.user)&&!Number(state.user.must_change_password||0)){
      history.replaceState(null,"","/admin#admin/dashboard");
      return renderAdmin();
    }
    if(path==="/admin/login"||route==="login") return renderLogin();
    if(path==="/admin"||path.startsWith("/admin/")||route==="admin") return renderAdmin();
    if(route==="portal") return isAdmin(state.user)?renderAdmin():renderLogin();
    if(route==="form") return renderForm(decodeURIComponent(param||""));
    if(window.SkyFirstDigital?.canRender(path,route)) return window.SkyFirstDigital.render({app,path,route,param,state,api,escape:E,format:fmt});
    return window.SkyFirstDigital?.render({app,path:"/",route:"home",param:"",state,api,escape:E,format:fmt});
  }catch(err){
    app.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`;
  }
}

window.addEventListener("hashchange",router);

(async()=>{
  await loadConfig();
  await loadMe();
  await handleQueryActions();

  const adminEntry=location.pathname==="/admin"||location.pathname==="/admin/login"||location.pathname.startsWith("/admin/")||location.hash.startsWith("#login")||location.hash.startsWith("#admin");
  if(state.config.maintenance_mode&&!state.user&&!adminEntry){
    app.innerHTML=`<main class="system-state-shell"><section class="system-state"><img src="/assets/sfn-logo-tight.png" alt="Sky First"><span class="state-code">MAINTENANCE</span><h1>Hệ thống đang được cập nhật</h1><p>Một số dịch vụ đang tạm dừng để bảo trì. Dữ liệu đã gửi trước đó không cần gửi lại chỉ vì trạng thái này.</p><div class="actions"><a class="secondary" href="mailto:support@skyfirst.io.vn">Hỗ trợ</a></div></section></main>`;
    return;
  }

  await router();
})();
