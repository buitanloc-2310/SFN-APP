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
  try{state.config=await api("/api/config")}catch{state.config={app_name:"Sky First Network",hero_title:"Kết nối giáo dục. Phát triển cộng đồng.",hero_text:"Một không gian chung cho học tập, hoạt động và phát triển cộng đồng.",hero_cover_url:"/assets/sfn-cover.png",modules:[],forms:[]}}
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
  const setLink=(id,textId,url,labelId,label)=>{const a=document.getElementById(id),t=document.getElementById(textId),l=labelId&&document.getElementById(labelId);if(a&&url)a.href=url;if(t&&url)t.textContent=url.replace(/^https?:\/\//,"").replace(/\/$/,"");if(l&&label)l.textContent=label};
  setLink("portalMainLink","portalMainText",c.portal_main_url,"portalMainLabel",c.portal_main_label);
  setLink("portalTnvLink","portalTnvText",c.portal_tnv_url);setLink("portalSfecLink","portalSfecText",c.portal_sfec_url);setLink("portalSlcLink","portalSlcText",c.portal_slc_url);setLink("portalMemberLink","portalMemberText",c.portal_member_url);
  const pe=document.getElementById("footerPortalEmailText"),pel=document.getElementById("footerPortalEmailLink");if(pe&&c.footer_portal_email)pe.textContent=c.footer_portal_email;if(pel&&c.footer_portal_email)pel.href="mailto:"+c.footer_portal_email;
  const ph=document.getElementById("footerHotlineText"),phl=document.getElementById("footerHotlineLink");if(ph&&c.hotline)ph.textContent=c.hotline;if(phl&&c.hotline)phl.href="tel:"+c.hotline.replace(/[^+\d]/g,"");
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
  return `<section class="hero ctt-hero">
    <div class="hero-copy"><span class="pill white">SKY FIRST NETWORK • SFN</span>
      <h1>${E(state.config?.hero_title||"Cổng thông tin Sky First Network")}</h1>
      <p class="hero-lead"><b>Khám phá và tham gia các hoạt động của Sky First.</b></p>
      <p>${E(state.config?.hero_text||"Theo dõi hoạt động, sự kiện, chương trình giáo dục và các cơ hội tham gia đang được mở trên toàn Mạng lưới.")}</p>
      <div class="actions"><a class="primary hero-white" href="#events">Khám phá hoạt động →</a><a class="secondary hero-outline" href="#lookup">Tra cứu đăng ký</a></div>
    </div>
  </section>`;
}
async function renderHome(){
  app.innerHTML=hero()+`
  <section class="lookup-strip">
    <div><span class="eyebrow">TRA CỨU NHANH</span><h2>Kiểm tra hồ sơ, GCN & GXN</h2><p>Nhập mã đã được cấp để theo dõi hồ sơ hoặc xác thực thông tin do Sky First Network phát hành.</p></div>
    <a class="primary lookup-cta" href="#lookup">Mở tra cứu →</a>
  </section>

  <section class="home-section">
    <div class="section-heading"><div><span class="eyebrow">KHÁM PHÁ SKY FIRST</span><h2>Một hệ sinh thái học tập và phát triển cộng đồng</h2><p class="muted">Các chức năng được tổ chức theo từng nhu cầu để bạn tìm đúng nơi cần đến nhanh hơn.</p></div></div>
    <div class="grid4 home-feature-grid">
      ${quickCard("users","Thành viên & Core Team","Đăng ký tham gia, theo dõi hồ sơ và kết nối với các nhóm vận hành của Sky First.","#forms")}
      ${quickCard("heart","Tình nguyện viên","Khám phá cơ hội tình nguyện, giảng dạy và đóng góp chuyên môn cho các hoạt động cộng đồng.","#form/volunteer")}
      ${quickCard("book","Lớp học & chương trình","Theo dõi các lớp, chương trình học tập, tình trạng tuyển sinh và đăng ký tham gia.","#classes")}
      ${quickCard("badge","GCN & GXN","Tra cứu và xác thực giấy chứng nhận, giấy xác nhận cùng các hồ sơ liên quan.","#lookup")}
    </div>
  </section>

  <section class="home-story">
    <div class="home-story-copy">
      <span class="eyebrow">VỀ SKY FIRST NETWORK</span>
      <h2>Không chỉ là một website, mà là không gian để học tập, thử sức và tạo giá trị</h2>
      <p>Sky First Network được xây dựng theo định hướng giáo dục, phát triển con người và kết nối cộng đồng. Nền tảng này giúp tập trung những hoạt động vốn thường nằm rời rạc ở nhiều nơi: đăng ký tham gia, lớp học, tình nguyện, sự kiện, hồ sơ thành viên, chứng nhận, xác nhận và các kênh hỗ trợ. Người dùng có thể bắt đầu từ một nhu cầu rất đơn giản như tìm lớp học, gửi hồ sơ tình nguyện hoặc tra cứu giấy xác nhận, sau đó tiếp tục theo dõi hành trình của mình trên cùng một hệ thống.</p>
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
    <div class="section-heading"><div><span class="eyebrow">HỆ SINH THÁI SKY FIRST</span><h2>Nền tảng kết nối</h2><p class="muted">Các cổng chuyên biệt còn lại của Sky First, được giữ gọn để tránh trùng lặp chức năng.</p></div></div>
    <div class="portal-grid portal-grid-3">
      ${portalCard("Sky First Network","Website chính và điểm bắt đầu của hệ sinh thái.","https://skyfirst.io.vn","Sky First")}
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
        form.innerHTML=`<div class="notice good"><h2>Thông tin đăng ký đã được tiếp nhận</h2><p><b>Mã đăng ký: ${E(r.code)}</b></p><p>${r.email_sent?"Thông tin đăng ký của bạn đã được gửi đến địa chỉ email đăng ký.":"Thông tin đăng ký đã được lưu thành công. Email xác nhận đang được hệ thống xử lý."}</p><div class="actions"><a class="primary" href="#lookup">Tra cứu</a><a class="secondary" href="#home">Trang chủ</a></div></div>`;
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
      <div class="verify-head"><div><span class="eyebrow">SKY FIRST NETWORK</span><h1>Tra cứu & Xác thực</h1><p>Tra cứu tình trạng hồ sơ hoặc xác thực GCN/GXN do Sky First phát hành.</p></div><div class="verify-seal" aria-hidden="true">✓</div></div>
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
  app.innerHTML=`<h1>Đăng nhập Sky First</h1><p class="muted">Chọn khu vực phù hợp. Quyền Thành viên và Quản trị viên chỉ do SFN cấp.</p>
  <div class="role-grid">
   <button class="role-card" onclick="showLogin('student')"><h3>Bạn là Học sinh/Học viên?</h3><p class="muted">Lớp học, hồ sơ, thông báo, GCN/GXN.</p></button>
   <button class="role-card" onclick="showLogin('member')"><h3>Bạn là Thành viên?</h3><p class="muted">Hồ sơ nhân sự, hoạt động, nhiệm vụ và thủ tục nội bộ.</p></button>
   <button class="role-card" onclick="showLogin('admin')"><h3>Bạn là Quản trị viên?</h3><p class="muted">Chỉ tài khoản đã được cấp quyền quản trị.</p></button>
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
    e.preventDefault();
    const f=new FormData(e.target);

    try{
      const d=await api("/api/auth/login",{
        method:"POST",
        body:{
          email:f.get("email"),
          password:f.get("password"),
          portal
        }
      });

      if(d.needs_2fa)return show2FA(d.challenge);

      state.user=d.user;
      accountBtn.textContent=state.user.full_name||state.user.email;

      if(d.must_change_password)return forcePasswordChange(f.get("password"));

      location.hash=portal==="admin"?"admin/dashboard":"portal";
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
}

window.googleLogin=portal=>location.href=`/api/auth/google/start?portal=${encodeURIComponent(portal)}`;

window.showRegister=function(){
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Tạo tài khoản Học sinh/Học viên</h2>
  <p class="muted">Tài khoản tự tạo chỉ có quyền người học. Quyền Thành viên SFN phải được SFN cấp sau khi duyệt.</p>
  <form id="registerForm"><div class="field"><label>Họ và tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mật khẩu (ít nhất 10 ký tự)</label><input name="password" type="password" minlength="10" required></div><button class="primary">Tạo tài khoản</button></form>`);

  document.getElementById("registerForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    try{
      await api("/api/auth/register",{
        method:"POST",
        body:Object.fromEntries(f)
      });
      closeModal();
      toast("Đã tạo tài khoản. Kiểm tra email để xác minh.");
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
}

window.showForgot=function(){
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Quên mật khẩu</h2><form id="forgotForm"><div class="field"><label>Email</label><input name="email" type="email" required></div><button class="primary">Gửi liên kết đặt lại</button></form>`);

  document.getElementById("forgotForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    await api("/api/auth/forgot",{
      method:"POST",
      body:{email:f.get("email")}
    }).catch(()=>{});

    closeModal();
    toast("Nếu email tồn tại, hệ thống đã gửi hướng dẫn.");
  };
}

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

      location.hash=isAdmin(state.user)?"admin/dashboard":"portal";
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
      await api("/api/auth/change-password",{
        method:"POST",
        body:Object.fromEntries(f)
      });

      closeModal();
      toast("Đã đổi mật khẩu.");
      location.hash=isAdmin(state.user)?"admin/dashboard":"portal";
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
}

async function logout(){
  await api("/api/auth/logout",{method:"POST"}).catch(()=>{});
  state.user=null;
  accountBtn.textContent="Đăng nhập";
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

window.privacyRequest=type=>{
  const note=prompt("Ghi chú thêm (nếu có):")||"";

  api("/api/me/data-requests",{
    method:"POST",
    body:{
      request_type:type,
      note
    }
  })
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

window.disable2fa=()=>{
  const pw=prompt("Nhập mật khẩu để tắt 2FA:");
  if(!pw)return;

  api("/api/me/2fa/disable",{
    method:"POST",
    body:{password:pw}
  })
  .then(async()=>{
    await loadMe();
    toast("Đã tắt 2FA.");
    renderPortal();
  })
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

const adminMenu=[
 {group:"Tổng quan",items:[["dashboard","Tổng quan"],["approvals","Trung tâm phê duyệt"],["search","Tìm kiếm toàn hệ thống"]]},
 {group:"Con người & hồ sơ",items:[["submissions","Hồ sơ đăng ký"],["users","Tài khoản & Phân quyền"],["people","Hồ sơ nhân sự"],["recruitment","Tuyển dụng & Đánh giá"],["teaching","TNV Dạy học"]]},
 {group:"Hoạt động & nội dung",items:[["forms","Form Builder"],["classes","Lớp học & Điểm danh"],["events","Sự kiện & Check-in"],["certificates","GCN & GXN"],["documents","Kho văn bản"],["units","Đơn vị trực thuộc"],["news","Tin tức & CMS"],["tasks","Nhiệm vụ"]]},
 {group:"Hệ thống & giao diện",items:[["site","Cài đặt website"],["header","Đầu trang / Header"],["footer","Cuối trang / Footer"],["maintenance","404 & Bảo trì"],["media","Thư viện ảnh R2"],["modules","Modules"],["files","File & Minh chứng"],["email","Email"],["terms","Điều khoản & Chính sách"],["privacy","Quyền riêng tư"]]},
 {group:"Kiểm soát",items:[["tickets","Hỗ trợ & Ticket"],["audit","Audit Log"],["backup","Sao lưu & Phục hồi"]]}
];

async function renderAdmin(){
  if(!state.user||!isAdmin(state.user)){
    location.hash="login";
    return;
  }

  const section=location.hash.split("/")[1]||"dashboard";

  app.innerHTML=`<div class="dashboard"><aside class="sidebar">${adminMenu.map(g=>`<div class="sidebar-group"><div class="sidebar-label">${E(g.group)}</div>${g.items.map(m=>`<button class="${section===m[0]?"active":""}" onclick="location.hash='admin/${m[0]}'">${E(m[1])}</button>`).join("")}</div>`).join("")}<button onclick="logout()">↩ Đăng xuất</button></aside><section id="adminMain"><div class="loading">Đang tải…</div></section></div>`;

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
    if(section==="site")return adminSite(main);
    if(section==="header")return adminHeader(main);
    if(section==="footer")return adminFooter(main);
    if(section==="maintenance")return adminMaintenance(main);
    if(section==="media")return adminMedia(main);
    if(section==="modules")return adminModules(main);
    if(section==="settings")return adminSettings(main);
    if(section==="search")return adminSearch(main);
    if(section==="audit")return adminAudit(main);
    if(section==="backup")return adminBackup(main);
  }catch(err){
    main.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`;
  }
}

async function adminDashboard(main){
  const health=await api("/api/health").catch(()=>({ok:false,database:false,storage:false}));
  let c={submissions:"—",pending:"—",people:"—",certificates:"—",approvals:"—",tickets:"—",tasks:"—"};
  let dataOk=false;
  try{const d=await api("/api/admin/dashboard");c=d.counts||c;dataOk=true}catch(err){console.error("ADMIN_DASHBOARD_DATA",err)}

  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">TRUNG TÂM QUẢN TRỊ</span><h1>Quản trị Sky First</h1><p class="muted">Theo dõi nhanh dữ liệu, trạng thái hệ thống và truy cập các tác vụ thường dùng.</p></div><span class="system-pill ${health.ok?"ok":"warn"}">${health.ok?"● Hệ thống đang hoạt động":"● Cần kiểm tra hệ thống"}</span></div>
  <div class="system-status-grid"><div class="status-card"><span>Ứng dụng</span><b>${health.ok?"Hoạt động":"Gián đoạn"}</b></div><div class="status-card"><span>D1</span><b>${health.database?"Đã kết nối":"Không khả dụng"}</b></div><div class="status-card"><span>R2</span><b>${health.storage?"Đã kết nối":"Không khả dụng"}</b></div><div class="status-card"><span>Dữ liệu Dashboard</span><b>${dataOk?"Đọc được":"Tạm lỗi"}</b></div></div>
  <div class="kpis"><div class="kpi"><b>${c.submissions}</b>Hồ sơ</div><div class="kpi"><b>${c.pending}</b>Cần xử lý</div><div class="kpi"><b>${c.people}</b>Nhân sự</div><div class="kpi"><b>${c.certificates}</b>GCN/GXN đã cấp</div><div class="kpi"><b>${c.approvals}</b>Chờ phê duyệt</div><div class="kpi"><b>${c.tickets}</b>Ticket mở</div><div class="kpi"><b>${c.tasks}</b>Nhiệm vụ</div></div>
  <div class="admin-quick-grid"><button class="admin-quick" onclick="location.hash='admin/submissions'">${lineIcon("users")}<b>Xử lý hồ sơ</b><span>Tiếp nhận và cập nhật trạng thái</span></button><button class="admin-quick" onclick="location.hash='admin/certificates'">${lineIcon("badge")}<b>GCN & GXN</b><span>Đề nghị, phê duyệt và phát hành</span></button><button class="admin-quick" onclick="location.hash='admin/media'">${lineIcon("book")}<b>Ảnh & Media</b><span>Tải ảnh giao diện lên R2</span></button><button class="admin-quick" onclick="location.hash='admin/maintenance'">${lineIcon("shield")}<b>Website & Bảo trì</b><span>404, bảo trì và trạng thái công khai</span></button></div>
  <div class="card" style="margin-top:16px"><h2>Quản trị an toàn</h2><p class="muted">Các module được tách theo chức năng. Ảnh giao diện lưu ở R2; cấu hình công khai có giá trị mặc định trong source; dữ liệu nghiệp vụ tiếp tục dùng D1 để không làm thay đổi dữ liệu cũ.</p></div>`;
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
    <div class="field"><label>Trạng thái</label><select id="subStatus">${["Đã tiếp nhận","Đang xem xét","Cần bổ sung","Mời phỏng vấn","Đang đánh giá","Đã duyệt","Không phù hợp","Hoàn tất"].map(s=>`<option ${s===r.status?"selected":""}>${E(s)}</option>`).join("")}</select></div>
    <div class="field"><label>Điểm tổng hợp</label><input id="subScore" type="number" step="0.1" value="${E(r.score??"")}"></div>
    <div class="field"><label>Ghi chú nội bộ</label><textarea id="subNote">${E(r.internal_note||"")}</textarea></div>
    <h3>Câu trả lời</h3>${Object.entries(r.answers||{}).map(([k,v])=>`<div class="card" style="margin:6px 0"><b>${E(k)}</b><br>${E(typeof v==="object"?JSON.stringify(v):v)}</div>`).join("")}
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

window.scheduleInterview=code=>{
  const at=prompt("Thời gian phỏng vấn (YYYY-MM-DDTHH:MM):");
  if(!at)return;

  const url=prompt("Link Meet/Zoom:")||"";

  api("/api/admin/interviews",{
    method:"POST",
    body:{
      submission_code:code,
      scheduled_at:at,
      meeting_url:url
    }
  })
  .then(()=>toast("Đã tạo lịch phỏng vấn."))
  .catch(e=>toast(errorText(e),"bad"));
};

window.addEvaluation=code=>{
  const score=prompt("Điểm tổng hợp (0-100):");
  if(score===null)return;

  const rec=prompt("Khuyến nghị:")||"";
  const note=prompt("Ghi chú:")||"";

  api("/api/admin/evaluations",{
    method:"POST",
    body:{
      submission_code:code,
      score:{total:Number(score)},
      recommendation:rec,
      note
    }
  })
  .then(()=>toast("Đã lưu đánh giá."))
  .catch(e=>toast(errorText(e),"bad"));
};

async function adminApprovals(main){
  const d=await api("/api/admin/approvals");

  main.innerHTML=`<h1>Trung tâm phê duyệt</h1><div class="card table-scroll"><table><thead><tr><th>Loại</th><th>Hành động</th><th>Trạng thái</th><th>Hạn</th><th></th></tr></thead><tbody>${(d.items||[]).map(a=>`<tr><td>${E(a.entity_type)}<br><span class="small">${E(a.entity_id)}</span></td><td>${E(a.action)}</td><td><span class="status">${E(a.status)}</span></td><td>${fmt(a.due_at)}</td><td>${a.status==="pending"?`<button class="primary" onclick="decideApproval('${E(a.id)}','approved')">Phê duyệt</button> <button class="danger" onclick="decideApproval('${E(a.id)}','rejected')">Từ chối</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}

window.decideApproval=(id,status)=>{
  const note=prompt("Ghi chú quyết định (nếu có):")||"";

  api(`/api/admin/approvals/${encodeURIComponent(id)}`,{
    method:"PATCH",
    body:{
      status,
      note
    }
  })
  .then(()=>{
    toast("Đã cập nhật phê duyệt.");
    adminApprovals(document.getElementById("adminMain"));
  })
  .catch(e=>toast(errorText(e),"bad"));
};

async function adminUsers(main){
  const d=await api("/api/admin/users");
  state.admin.users=d.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Tài khoản & Phân quyền</h1><button class="primary" onclick="inviteUser()">+ Cấp tài khoản</button></div>
  <div class="card table-scroll"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Xác minh</th><th>2FA</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.users.map(u=>`<tr><td><b>${E(u.full_name||"")}</b><br>${E(u.email)}</td><td>${(u.roles||[]).map(r=>`<span class="badge-role">${E(r.role_id)}${r.scope_unit_code?` @ ${E(r.scope_unit_code)}`:""}</span>`).join("")}</td><td>${u.email_verified?"✓":"—"}</td><td>${u.totp_enabled?"✓":"—"}</td><td>${E(u.status)}</td><td><button class="secondary" onclick="editRoles(${u.id})">Quyền</button> <button class="ghost" onclick="resetUserPassword(${u.id},'${E(u.email)}')">Đặt lại MK</button> <button class="ghost" onclick="toggleUser(${u.id},'${E(u.status)}')">${u.status==="active"?"Khóa":"Mở khóa"}</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.inviteUser=()=>{
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Cấp tài khoản</h2><form id="inviteForm"><div class="field"><label>Họ và tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Vai trò ban đầu</label><select name="role"><option>student</option><option>member</option><option>volunteer</option><option>handler</option><option>unit_admin</option><option>communications</option><option>external_events</option><option>hr</option><option>office</option><option>network_secretary</option><option>system_admin</option><option>super_admin</option></select></div><div class="field"><label>Phạm vi đơn vị (nếu có)</label><input name="scope_unit_code" placeholder="Ví dụ: SFEC"></div><button class="primary">Cấp tài khoản</button></form>`);

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
          scope_unit_code:f.get("scope_unit_code")
        }
      });

      closeModal();

      modal(`<h2>Đã cấp tài khoản</h2><div class="notice warn">Mật khẩu tạm thời chỉ hiển thị lần này.</div><p><b>${E(f.get("email"))}</b></p><pre class="card">${E(d.temp_password)}</pre><button class="primary" onclick="closeModal()">Đã lưu</button>`);
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
  if(!confirm(`Tạo mật khẩu tạm thời mới cho ${email}? Tất cả phiên đăng nhập hiện tại sẽ bị thu hồi.`))return;

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
  main.innerHTML=`<h1>Tuyển dụng & Đánh giá</h1><div class="grid"><div class="card"><h3>Quy trình Core Team</h3><p>Tiếp nhận → Sàng lọc → Phỏng vấn → Đánh giá bổ sung → Thông báo → Tiếp nhận.</p><a class="primary" href="#admin/submissions">Mở hồ sơ</a></div><div class="card"><h3>TNV Dạy học</h3><p>Đánh giá đúng phạm vi Lớp 9/10/11/12/Cơ bản/Giao tiếp/IELTS; có thể dạy thử trước khi phân lớp.</p><a class="primary" href="#admin/submissions">Mở hồ sơ TNV</a></div><div class="card"><h3>Chấm điểm & Phỏng vấn</h3><p>Mở một hồ sơ và dùng nút Lịch phỏng vấn / Chấm đánh giá.</p></div></div>`;
}

window.requestGenericApproval=(entity_type,entity_id)=>{
  const action=prompt("Nội dung cần phê duyệt:","Phê duyệt hồ sơ/đề xuất");
  if(!action)return;
  const role=prompt("Vai trò được giao phê duyệt:","network_secretary")||"network_secretary";
  api("/api/admin/approvals",{method:"POST",body:{entity_type,entity_id,action,assigned_role:role}})
    .then(()=>toast("Đã chuyển vào Trung tâm phê duyệt."))
    .catch(e=>toast(errorText(e),"bad"));
};

async function adminTerms(main){
  const d=await api("/api/admin/terms");
  state.admin.terms=d.items||[];
  main.innerHTML=`<h1>Điều khoản & Chính sách</h1><p class="muted">Hệ thống lưu phiên bản điều khoản mà từng người đã xác nhận.</p>${state.admin.terms.map(t=>`<div class="card" style="margin:10px 0"><div class="toolbar"><div><b>${E(t.code)} — ${E(t.name)}</b><br><span class="small muted">Phiên bản ${E(t.version)} • ${E(t.status)}</span></div><button class="secondary" onclick="editTerm('${encodeURIComponent(t.code)}')">Sửa</button></div><pre style="white-space:pre-wrap;max-height:180px;overflow:auto">${E(t.body)}</pre></div>`).join("")}`;
}

window.editTerm=encoded=>{
  const code=decodeURIComponent(encoded);
  const t=state.admin.terms.find(x=>x.code===code);
  if(!t)return;
  modal(`<h2>${E(code)}</h2><div class="field"><label>Tên</label><input id="termName" value="${E(t.name)}"></div><div class="field"><label>Phiên bản</label><input id="termVersion" value="${E(t.version)}"></div><div class="field"><label>Phạm vi</label><input id="termScope" value="${E(t.scope||"")}"></div><div class="field"><label>Nội dung</label><textarea id="termBody" style="min-height:360px">${E(t.body)}</textarea></div><button class="primary" onclick="saveTerm('${encodeURIComponent(code)}')">Lưu phiên bản</button>`);
};

window.saveTerm=encoded=>{
  const code=decodeURIComponent(encoded);
  api(`/api/admin/terms/${encodeURIComponent(code)}`,{
    method:"PUT",
    body:{
      name:document.getElementById("termName").value,
      version:document.getElementById("termVersion").value,
      scope:document.getElementById("termScope").value,
      body:document.getElementById("termBody").value,
      status:"published"
    }
  }).then(()=>{
    closeModal();
    toast("Đã cập nhật điều khoản.");
    adminTerms(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

async function adminTeaching(main){
  const [ppl,ts]=await Promise.all([
    api("/api/admin/people"),
    api("/api/admin/teaching-scopes")
  ]);
  state.admin.people=ppl.items||[];
  state.admin.teaching=ts.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Phạm vi TNV Dạy học</h1><button class="primary" onclick="addTeachingScope()">+ Thêm phạm vi</button></div><div class="notice">Các phạm vi chuẩn: Lớp 9, Lớp 10, Lớp 11, Lớp 12, Tiếng Anh Cơ bản, Tiếng Anh Giao tiếp, IELTS. Được nhận làm TNV không đồng nghĩa được phép dạy tất cả phạm vi.</div><div class="card table-scroll"><table><thead><tr><th>Nhân sự</th><th>Phạm vi</th><th>Trạng thái</th><th>Ghi chú đánh giá</th><th></th></tr></thead><tbody>${state.admin.teaching.map(x=>`<tr><td>${E(x.full_name)}<br><span class="small">${E(x.email||"")}</span></td><td><b>${E(x.scope)}</b></td><td><span class="status">${E(x.status)}</span></td><td>${E(x.assessment_note||"")}</td><td><button class="secondary" onclick="editTeachingScope('${E(x.id)}')">Đánh giá</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.addTeachingScope=()=>{
  const person=prompt("ID hồ sơ nhân sự:");
  if(!person)return;
  const scope=prompt("Phạm vi (Lớp 9/10/11/12/Cơ bản/Giao tiếp/IELTS):");
  if(!scope)return;

  api("/api/admin/teaching-scopes",{
    method:"POST",
    body:{person_id:Number(person),scope,status:"Đang đánh giá"}
  }).then(()=>{
    toast("Đã thêm phạm vi.");
    adminTeaching(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

window.editTeachingScope=idt=>{
  const x=state.admin.teaching.find(i=>i.id===idt);
  if(!x)return;
  modal(`<h2>${E(x.full_name)} — ${E(x.scope)}</h2><div class="field"><label>Trạng thái</label><select id="teachStatus">${["Đang đánh giá","Được mời dạy thử","Đã duyệt","Chưa được duyệt","Tạm dừng"].map(v=>`<option ${v===x.status?"selected":""}>${E(v)}</option>`).join("")}</select></div><div class="field"><label>Ghi chú đánh giá</label><textarea id="teachNote">${E(x.assessment_note||"")}</textarea></div><button class="primary" onclick="saveTeachingScope('${E(idt)}')">Lưu</button>`);
};

window.saveTeachingScope=idt=>api(`/api/admin/teaching-scopes/${encodeURIComponent(idt)}`,{
  method:"PATCH",
  body:{
    status:document.getElementById("teachStatus").value,
    assessment_note:document.getElementById("teachNote").value
  }
}).then(()=>{
  closeModal();
  toast("Đã cập nhật phạm vi.");
  adminTeaching(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

async function adminPrivacy(main){
  const d=await api("/api/admin/data-requests");
  state.admin.dataRequests=d.items||[];
  main.innerHTML=`<h1>Trung tâm Quyền riêng tư</h1><div class="card table-scroll"><table><thead><tr><th>Email</th><th>Yêu cầu</th><th>Trạng thái</th><th>Ngày gửi</th><th></th></tr></thead><tbody>${state.admin.dataRequests.map(x=>`<tr><td>${E(x.email)}</td><td>${E(x.request_type)}<br><span class="small">${E(x.note||"")}</span></td><td><span class="status">${E(x.status)}</span></td><td>${fmt(x.created_at)}</td><td><button class="secondary" onclick="processPrivacy('${E(x.id)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.processPrivacy=idr=>{
  const status=prompt("Trạng thái:","Đang xử lý");
  if(!status)return;
  const note=prompt("Ghi chú xử lý:")||"";

  api(`/api/admin/data-requests/${encodeURIComponent(idr)}`,{
    method:"PATCH",
    body:{status,note}
  }).then(()=>{
    toast("Đã cập nhật.");
    adminPrivacy(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

async function adminForms(main){
  const d=await api("/api/admin/forms");
  state.admin.forms=d.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Form Builder</h1><button class="primary" onclick="createForm()">+ Tạo biểu mẫu</button></div>
  <p class="muted">Tạo, chỉnh sửa, nhân bản và bật/tắt biểu mẫu ngay trong Admin. Mặc định mọi biểu mẫu bắt buộc ảnh cá nhân; riêng Lớp học / Học viên mới không bắt buộc.</p>
  <div class="grid">${state.admin.forms.map(f=>`<div class="card"><span class="pill">${E(f.prefix)}</span><h3>${E(f.name)}</h3><p class="muted">${E(f.description)}</p><p>Phiên bản: ${f.version} • ${f.enabled?"Đang bật":"Đang tắt"}</p><p class="small muted">Ảnh cá nhân: ${f.config?.profile_photo_required===false?"Không bắt buộc":"Bắt buộc"}</p><div class="actions"><button class="secondary" onclick="editForm('${E(f.id)}')">Chỉnh sửa</button><button class="secondary" onclick="cloneForm('${E(f.id)}')">Sao chép</button></div></div>`).join("")}</div>`;
}

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
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Chỉnh biểu mẫu — ${E(f.name)}</h2>
   <div class="row2"><div class="field"><label>Tên biểu mẫu</label><input id="fbName" value="${E(f.name)}"></div><div class="field"><label>Mã tiền tố</label><input id="fbPrefix" value="${E(f.prefix)}"></div></div>
   <div class="field"><label>Mô tả</label><textarea id="fbDesc">${E(f.description||"")}</textarea></div>
   <div class="row2"><div class="field"><label>Loại biểu mẫu</label><select id="fbType"><option value="general" ${c.form_type!=="class"&&c.form_type!=="student"?"selected":""}>Đăng ký chung</option><option value="class" ${c.form_type==="class"?"selected":""}>Lớp học</option><option value="student" ${c.form_type==="student"?"selected":""}>Học viên mới</option></select></div><div class="field"><label>Trạng thái</label><select id="fbEnabled"><option value="1" ${f.enabled?"selected":""}>Đang bật</option><option value="0" ${!f.enabled?"selected":""}>Đang tắt</option></select></div></div>
   <div class="check"><input id="fbPhotoRequired" type="checkbox" ${c.profile_photo_required!==false?"checked":""}><label>Bắt buộc ảnh cá nhân</label></div><p class="small muted">Lớp học / Học viên mới có thể bỏ yêu cầu ảnh. Các đăng ký khác nên giữ bắt buộc.</p>
   <div id="builderSections">${(c.sections||[]).map((sec,si)=>`<div class="builder-section"><div class="toolbar"><b>${E(sec.title)}</b><button class="secondary" onclick="addBuilderField(${si})">+ Câu hỏi</button><button class="danger" onclick="deleteBuilderSection(${si})">Xóa phần</button></div>${(sec.fields||[]).map((x,fi)=>`<div class="builder-field"><span><b>${E(x.label)}</b><br><span class="small muted">${E(x.key)}</span></span><span>${E(x.type)}</span><span>${x.required?"Bắt buộc":"Không bắt buộc"}</span><span><button class="ghost" onclick="moveField(${si},${fi},-1)">↑</button><button class="ghost" onclick="moveField(${si},${fi},1)">↓</button><button class="secondary" onclick="editBuilderField(${si},${fi})">Sửa</button><button class="danger" onclick="deleteBuilderField(${si},${fi})">×</button></span></div>`).join("")}</div>`).join("")}</div>
   <div class="actions"><button class="secondary" onclick="addBuilderSection()">+ Thêm phần</button><button class="secondary" onclick="previewFormBuilder()">Xem trước</button><button class="primary" onclick="saveFormBuilder()">Lưu phiên bản mới</button></div>`);
  document.getElementById("fbType").onchange=e=>{
    const type=e.target.value;
    if(type==="class"||type==="student") document.getElementById("fbPhotoRequired").checked=false;
    else document.getElementById("fbPhotoRequired").checked=true;
  };
}

window.addBuilderSection=()=>{
  const title=prompt("Tên phần:"); if(!title)return;
  state.formBuilder.config.sections.push({title,fields:[]}); renderFormBuilder();
};
window.deleteBuilderSection=i=>{if(confirm("Xóa phần này?")){state.formBuilder.config.sections.splice(i,1);renderFormBuilder();}};
window.addBuilderField=si=>{
  const label=prompt("Nhãn câu hỏi:"); if(!label)return;
  const key=(prompt("Mã kỹ thuật (không dấu, không khoảng trắng):")||label.toLowerCase().replace(/\s+/g,"_").replace(/[^\w]/g,"")).slice(0,50);
  const type=prompt("Loại: text / email / date / textarea / select / checkbox / file","text")||"text";
  const req=confirm("Bắt buộc trả lời?"); let options=[];
  if(type==="select")options=(prompt("Các lựa chọn, cách nhau bằng |","")||"").split("|").map(x=>x.trim()).filter(Boolean);
  state.formBuilder.config.sections[si].fields.push({key,label,type,required:req,options}); renderFormBuilder();
};
window.editBuilderField=(si,fi)=>{
  const x=state.formBuilder.config.sections[si].fields[fi]; if(!x)return;
  const label=prompt("Nhãn câu hỏi:",x.label); if(label===null)return;
  const type=prompt("Loại: text / email / date / textarea / select / checkbox / file",x.type||"text")||x.type;
  const required=confirm("Đặt trường này là bắt buộc?\nOK = Bắt buộc, Cancel = Không bắt buộc");
  let options=x.options||[];
  if(type==="select") options=(prompt("Các lựa chọn, cách nhau bằng |",options.join(" | "))||"").split("|").map(v=>v.trim()).filter(Boolean);
  Object.assign(x,{label,type,required,options}); renderFormBuilder();
};
window.deleteBuilderField=(si,fi)=>{state.formBuilder.config.sections[si].fields.splice(fi,1);renderFormBuilder();};
window.moveField=(si,fi,dir)=>{const a=state.formBuilder.config.sections[si].fields,j=fi+dir;if(j<0||j>=a.length)return;[a[fi],a[j]]=[a[j],a[fi]];renderFormBuilder();};

window.previewFormBuilder=()=>{
  const c=state.formBuilder.config;
  const html=(c.sections||[]).map(sec=>`<section><h3>${E(sec.title)}</h3>${(sec.fields||[]).map(x=>`<div class="field"><label>${E(x.label)}${x.required?" *":""}</label><div class="small muted">${E(x.type)} • ${E(x.key)}</div></div>`).join("")}</section>`).join("");
  modal(`<button class="ghost" onclick="renderFormBuilder()">← Quay lại chỉnh sửa</button><h2>Xem trước — ${E(state.formBuilder.name)}</h2><div class="card">${html}</div>`);
};

window.saveFormBuilder=async()=>{
  state.formBuilder.name=document.getElementById("fbName").value;
  state.formBuilder.prefix=document.getElementById("fbPrefix").value;
  state.formBuilder.description=document.getElementById("fbDesc").value;
  state.formBuilder.enabled=document.getElementById("fbEnabled").value==="1";
  state.formBuilder.config.form_type=document.getElementById("fbType").value;
  state.formBuilder.config.profile_photo_required=document.getElementById("fbPhotoRequired").checked;
  try{
    await api(`/api/admin/forms/${encodeURIComponent(state.formBuilder.id)}`,{method:"PUT",body:{name:state.formBuilder.name,prefix:state.formBuilder.prefix,description:state.formBuilder.description,audience:state.formBuilder.audience,min_age:state.formBuilder.min_age,enabled:!!state.formBuilder.enabled,recipient_email:state.formBuilder.recipient_email,config:state.formBuilder.config}});
    closeModal();toast("Đã lưu phiên bản biểu mẫu.");adminForms(document.getElementById("adminMain"));
  }catch(e){toast(errorText(e),"bad")}
};

window.createForm=()=>{
  const name=prompt("Tên biểu mẫu:"); if(!name)return;
  const idForm=prompt("ID biểu mẫu (vd: volunteer_2026):"); if(!idForm)return;
  const prefix=prompt("Tiền tố mã đăng ký (vd: SFN-TNV):","SFN-FORM"); if(!prefix)return;
  const kind=(prompt("Loại biểu mẫu: general / class / student","general")||"general").toLowerCase();
  const photoRequired=!(kind==="class"||kind==="student");
  const cfg={id:idForm,name,prefix,description:"",audience:"public",form_type:kind,profile_photo_required:photoRequired,term_codes:["PRIVACY/SFN"],sections:[{title:"Thông tin",fields:[{key:"full_name",label:"Họ và tên",type:"text",required:true},{key:"email",label:"Email",type:"email",required:true}]}]};
  api("/api/admin/forms",{method:"POST",body:{id:idForm,name,prefix,description:"",audience:"public",config:cfg}}).then(()=>{toast("Đã tạo biểu mẫu.");adminForms(document.getElementById("adminMain"));}).catch(e=>toast(errorText(e),"bad"));
};

window.cloneForm=idForm=>{
  const src=state.admin.forms.find(x=>x.id===idForm); if(!src)return;
  const newId=prompt("ID biểu mẫu mới:",`${src.id}_copy`); if(!newId)return;
  const newName=prompt("Tên biểu mẫu mới:",`${src.name} — Bản sao`); if(!newName)return;
  const newPrefix=prompt("Tiền tố mã đăng ký:",src.prefix); if(!newPrefix)return;
  const cfg=JSON.parse(JSON.stringify(src.config)); cfg.id=newId; cfg.name=newName; cfg.prefix=newPrefix;
  api("/api/admin/forms",{method:"POST",body:{id:newId,name:newName,prefix:newPrefix,description:src.description||"",audience:src.audience||"public",min_age:src.min_age,recipient_email:src.recipient_email,config:cfg}}).then(()=>{toast("Đã sao chép biểu mẫu.");adminForms(document.getElementById("adminMain"));}).catch(e=>toast(errorText(e),"bad"));
};

async function adminGeneric(main,type,title,fields){
  const d=await api(`/api/admin/content/${type}`);
  state.admin[type]=d.items||[];

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

window.createGeneric=type=>{
  const body={};

  for(const f of genericFields[type]||[]){
    const v=prompt(`${f}:`,f.endsWith("_json")?"{}":"");
    if(v===null)return;
    body[f]=v;
    if(["capacity","assigned_to"].includes(f)&&v!=="")body[f]=Number(v);
  }

  if(type!=="units")body.id=body.id||undefined;

  api(`/api/admin/content/${type}`,{
    method:"POST",
    body
  }).then(()=>{
    toast("Đã thêm.");
    adminGeneric(
      document.getElementById("adminMain"),
      type,
      adminTitle(type),
      displayFields(type)
    );
  }).catch(e=>toast(errorText(e),"bad"));
};

window.editGeneric=(type,idv)=>{
  const x=(state.admin[type]||[]).find(
    o=>String(o.id||o.code)===String(idv)
  );
  if(!x)return;

  const body={};

  for(const f of genericFields[type]||[]){
    const v=prompt(`${f}:`,String(x[f]??""));
    if(v===null)return;
    body[f]=v;
    if(["capacity","assigned_to"].includes(f)&&v!=="")body[f]=Number(v);
  }

  api(`/api/admin/content/${type}/${encodeURIComponent(idv)}`,{
    method:"PUT",
    body
  }).then(()=>{
    toast("Đã cập nhật.");
    adminGeneric(
      document.getElementById("adminMain"),
      type,
      adminTitle(type),
      displayFields(type)
    );
  }).catch(e=>toast(errorText(e),"bad"));
};

window.deleteGeneric=(type,idv)=>{
  if(!confirm("Xóa mục này?"))return;

  api(`/api/admin/content/${type}/${encodeURIComponent(idv)}`,{
    method:"DELETE"
  }).then(()=>{
    toast("Đã xóa.");
    adminGeneric(
      document.getElementById("adminMain"),
      type,
      adminTitle(type),
      displayFields(type)
    );
  }).catch(e=>toast(errorText(e),"bad"));
};

function adminTitle(t){
  return {
    news:"Tin tức & CMS",
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
  const classId=prompt("ID lớp (vd SFEC-L9):");
  if(!classId)return;

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
      session_date:new Date().toISOString().slice(0,10),
      status
    }
  }
).then(()=>toast("Đã điểm danh."))
 .catch(e=>toast(errorText(e),"bad"));

window.checkinTool=()=>{
  const code=prompt("Mã check-in:");
  if(!code)return;

  api("/api/admin/event-checkin",{
    method:"POST",
    body:{checkin_code:code}
  }).then(()=>toast("Check-in thành công."))
    .catch(e=>toast(errorText(e),"bad"));
};

async function adminCertificates(main){
  const d=await api("/api/admin/certificates");
  state.admin.certificates=d.items||[];

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">GCN & GXN</h1><button class="primary" onclick="requestCertificate()">+ Đề nghị cấp</button></div>
  <div class="notice">Quy trình: <b>Ban Nhân sự đề nghị → Văn phòng kiểm tra → Tổng Thư ký Mạng lưới phê duyệt → Văn phòng cấp số, vào sổ, lưu và phát hành.</b></div>
  <div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Người được cấp</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.certificates.map(c=>`<tr><td><b>${E(c.code||"Chưa cấp số")}</b></td><td>${E(c.full_name)}<br>${E(c.email||"")}</td><td>${E(c.content)}</td><td><span class="status">${E(c.status)}</span></td><td>${c.status==="approved"?`<button class="primary" onclick="issueCert('${E(c.id)}')">Phát hành</button>`:""}${c.status==="issued"?` <button class="secondary" onclick="showCertQR('${E(c.code)}')">QR</button> <button class="danger" onclick="revokeCert('${E(c.id)}')">Thu hồi</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}

window.requestCertificate=()=>{
  modal(`
    <button class="ghost" onclick="closeModal()">✕ Đóng</button>

    <h2>Đề nghị cấp GCN/GXN</h2>

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
      toast("Đã tạo đề nghị cấp GCN/GXN.");
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
  const text=`${location.origin}/?cert_lookup=${encodeURIComponent(code)}#lookup`;

  modal(`<h2>QR xác thực — ${E(code)}</h2><p>QR chỉ chứa liên kết tra cứu công khai, không chứa dữ liệu hồ sơ riêng tư.</p><img alt="QR" style="max-width:280px;width:100%" src="https://quickchart.io/qr?size=300&text=${encodeURIComponent(text)}"><p><a href="#lookup" onclick="closeModal()">Mở trang tra cứu</a></p>`);
};

window.revokeCert=idc=>{
  const note=prompt("Lý do thu hồi:")||"";

  api(`/api/admin/certificates/${encodeURIComponent(idc)}`,{
    method:"PATCH",
    body:{action:"revoke",note}
  }).then(()=>{
    toast("Đã thu hồi.");
    adminCertificates(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

async function adminTickets(main){
  const d=await api("/api/admin/tickets");
  state.admin.tickets=d.items||[];

  main.innerHTML=`<h1>Hỗ trợ & Ticket</h1><div class="card table-scroll"><table><thead><tr><th>Mã</th><th>Người gửi</th><th>Loại</th><th>Ưu tiên</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.admin.tickets.map(t=>`<tr><td><b>${E(t.code)}</b></td><td>${E(t.submitter_name||"")}<br>${E(t.email||"")}</td><td>${E(t.ticket_type||"")}</td><td>${E(t.priority)}</td><td>${E(t.status)}</td><td><button class="secondary" onclick="editTicket('${E(t.id)}')">Xử lý</button></td></tr>`).join("")}</tbody></table></div>`;
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
  toast("Đã cập nhật ticket.");
  adminTickets(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

async function adminFiles(main){
  const d=await api("/api/admin/files");

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">File & Minh chứng</h1><button class="primary" onclick="uploadAdminFile()">+ Upload</button></div><div class="card table-scroll"><table><thead><tr><th>Tệp</th><th>Loại</th><th>Dung lượng</th><th>Quyền</th><th></th></tr></thead><tbody>${(d.items||[]).map(f=>`<tr><td><a href="/api/files/${E(f.id)}" target="_blank">${E(f.filename)}</a></td><td>${E(f.mime)}</td><td>${Math.round((f.size||0)/1024)} KB</td><td>${E(f.visibility)}</td><td><button class="danger" onclick="deleteFile('${E(f.id)}')">Xóa</button></td></tr>`).join("")}</tbody></table></div>`;
}

window.uploadAdminFile=()=>{
  modal(`<h2>Upload file</h2><form id="upFile"><div class="field"><input name="file" type="file" required></div><div class="check"><input name="public" type="checkbox"><label>Cho phép công khai</label></div><button class="primary">Upload</button></form>`);

  document.getElementById("upFile").onsubmit=async e=>{
    e.preventDefault();

    const f=new FormData(e.target);
    const fd=new FormData();

    fd.append("file",f.get("file"));
    fd.append("visibility",f.get("public")?"public":"private");

    try{
      await api("/api/admin/upload",{
        method:"POST",
        body:fd
      });

      closeModal();
      toast("Đã upload.");
      adminFiles(document.getElementById("adminMain"));
    }catch(err){
      toast(errorText(err),"bad");
    }
  };
};

window.deleteFile=idf=>{
  if(!confirm("Xóa file?"))return;

  api(`/api/admin/files/${encodeURIComponent(idf)}`,{
    method:"DELETE"
  }).then(()=>{
    toast("Đã xóa.");
    adminFiles(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

async function adminEmail(main){
  const [t,l]=await Promise.all([
    api("/api/admin/email-templates"),
    api("/api/admin/email-logs")
  ]);

  state.admin.emailTemplates=t.items||[];

  main.innerHTML=`<h1>Email</h1><div class="notice">Email tiếp nhận toàn bộ đăng ký mặc định: <b>skyfirst.ec@gmail.com</b>. Dịch vụ gửi mail phải được cấu hình bằng secret ở backend.</div><h2>Mẫu email</h2>${state.admin.emailTemplates.map(x=>`<div class="card" style="margin:8px 0"><b>${E(x.key)}</b> — ${E(x.subject_template)} <button class="secondary" onclick="editEmailTemplate('${E(x.key)}')">Sửa</button></div>`).join("")}<h2 class="section-title">Nhật ký email</h2><div class="card table-scroll"><table><thead><tr><th>Đến</th><th>Template</th><th>Trạng thái</th><th>Thời gian</th><th>Lỗi</th></tr></thead><tbody>${(l.items||[]).slice(0,300).map(x=>`<tr><td>${E(x.to_email)}</td><td>${E(x.template_key)}</td><td>${E(x.status)}</td><td>${fmt(x.created_at)}</td><td>${E(x.error||"")}</td></tr>`).join("")}</tbody></table></div>`;
}

window.editEmailTemplate=key=>{
  const x=state.admin.emailTemplates.find(t=>t.key===key);
  if(!x)return;

  modal(`<h2>${E(key)}</h2><div class="field"><label>Tiêu đề</label><input id="etSubject" value="${E(x.subject_template)}"></div><div class="field"><label>HTML</label><textarea id="etHtml">${E(x.html_template)}</textarea></div><div class="field"><label>Text</label><textarea id="etText">${E(x.text_template||"")}</textarea></div><button class="primary" onclick="saveEmailTemplate('${E(key)}')">Lưu</button>`);
};

window.saveEmailTemplate=key=>api(
  `/api/admin/email-templates/${encodeURIComponent(key)}`,
  {
    method:"PUT",
    body:{
      subject_template:document.getElementById("etSubject").value,
      html_template:document.getElementById("etHtml").value,
      text_template:document.getElementById("etText").value,
      enabled:true
    }
  }
).then(()=>{
  closeModal();
  toast("Đã lưu mẫu email.");
  adminEmail(document.getElementById("adminMain"));
}).catch(e=>toast(errorText(e),"bad"));

async function loadSettingsMap(){
  const d=await api("/api/admin/settings");
  return Object.fromEntries((d.items||[]).map(x=>[x.key,x.value]));
}
async function saveSettingItems(items,msg="Đã lưu thay đổi."){
  await api("/api/admin/settings",{method:"PUT",body:{items}});
  toast(msg);await loadConfig();
}
async function adminSite(main){
  const m=await loadSettingsMap();state.admin.settings=m;
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">HỆ THỐNG & GIAO DIỆN</span><h1>Cài đặt website</h1><p class="muted">Quản lý nhận diện và nội dung chính mà không cần sửa source.</p></div></div>
  <div class="admin-grid2"><div class="card"><h2>Nhận diện</h2><div class="field"><label>Tên website</label><input id="siteName" value="${E(m.app_name||"Sky First Network")}"></div><div class="field"><label>Châm ngôn</label><input id="siteSlogan" value="${E(m.brand_slogan||"")}"></div><div class="field"><label>Website chính</label><input id="siteWebsite" value="${E(m.website||"https://skyfirst.io.vn")}"></div><div class="field"><label>Hotline/Zalo</label><input id="siteHotline" value="${E(m.hotline||"0924 910 210")}"></div></div>
  <div class="card"><h2>Hero trang chủ</h2><div class="field"><label>Tiêu đề</label><input id="siteHeroTitle" value="${E(m.hero_title||"Kết nối giáo dục. Phát triển cộng đồng.")}"></div><div class="field"><label>Mô tả</label><textarea id="siteHeroText">${E(m.hero_text||"")}</textarea></div><div class="field"><label>Ảnh Hero</label><div class="input-action"><input id="siteHeroCover" value="${E(m.hero_cover_url||"/assets/sfn-cover.png")}"><button class="secondary" onclick="location.hash='admin/media'">Chọn/Tải ảnh</button></div></div><button class="primary" onclick="saveAdminSite()">Lưu cài đặt</button></div></div>`;
}
window.saveAdminSite=()=>saveSettingItems({app_name:document.getElementById("siteName").value,brand_slogan:document.getElementById("siteSlogan").value,website:document.getElementById("siteWebsite").value,hotline:document.getElementById("siteHotline").value,hero_title:document.getElementById("siteHeroTitle").value,hero_text:document.getElementById("siteHeroText").value,hero_cover_url:document.getElementById("siteHeroCover").value},"Đã cập nhật website.");

async function adminHeader(main){
  const m=await loadSettingsMap();
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">GIAO DIỆN</span><h1>Đầu trang / Header</h1><p class="muted">Bật/tắt nhanh các thành phần của đầu trang. Cấu hình mặc định luôn còn trong source để website không trắng khi D1 lỗi.</p></div></div><div class="card"><div class="check"><input id="hdrShowBrand" type="checkbox" ${m.header_show_brand!==false?"checked":""}><label>Hiển thị logo và tên Sky First</label></div><div class="check"><input id="hdrShowTheme" type="checkbox" ${m.header_show_theme!==false?"checked":""}><label>Hiển thị nút đổi sáng/tối</label></div><div class="check"><input id="hdrShowAccount" type="checkbox" ${m.header_show_account!==false?"checked":""}><label>Hiển thị nút đăng nhập/tài khoản</label></div><div class="field"><label>Nhãn nút tài khoản</label><input id="hdrAccountLabel" value="${E(m.header_account_label||"Đăng nhập")}"></div><button class="primary" onclick="saveHeaderSettings()">Lưu Header</button></div>`;
}
window.saveHeaderSettings=()=>saveSettingItems({header_show_brand:document.getElementById("hdrShowBrand").checked,header_show_theme:document.getElementById("hdrShowTheme").checked,header_show_account:document.getElementById("hdrShowAccount").checked,header_account_label:document.getElementById("hdrAccountLabel").value},"Đã lưu Header.");

async function adminFooter(main){
  const m=await loadSettingsMap();
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">GIAO DIỆN & LIÊN KẾT</span><h1>Cuối trang / Footer</h1><p class="muted">Chỉnh thông tin liên hệ và toàn bộ liên kết hệ sinh thái. Thay đổi được áp dụng công khai sau khi lưu.</p></div></div><div class="admin-grid2"><div class="card"><h2>Thông tin liên hệ</h2><div class="field"><label>Mô tả ngắn</label><textarea id="ftDesc">${E(m.footer_description||"")}</textarea></div><div class="field"><label>Email liên hệ</label><input id="ftEmail" value="${E(m.footer_email||"skyfirst.ec@gmail.com")}"></div><div class="field"><label>Email hỗ trợ</label><input id="ftSupport" value="${E(m.footer_support_email||"hotro@skyfirst.io.v")}"></div><div class="field"><label>Email Cổng Thông tin</label><input id="ftPortalEmail" value="${E(m.footer_portal_email||"ctt@skyfirst.io.vn")}"></div><div class="field"><label>Điện thoại / Zalo</label><input id="ftHotline" value="${E(m.hotline||"0924 910 210")}"></div><div class="field"><label>Dòng bản quyền</label><input id="ftCopyright" value="${E(m.footer_copyright||"© 2026 Sky First Network (SFN)")}"></div></div><div class="card"><h2>Tra cứu & Hệ thống</h2><div class="field"><label>Tên Trang thông tin điện tử</label><input id="ftMainLabel" value="${E(m.portal_main_label||"Trang thông tin điện tử Sky First Network")}"></div><div class="field"><label>Trang thông tin điện tử</label><input id="ftMain" value="${E(m.portal_main_url||"https://skyfirst.io.vn")}"></div><div class="field"><label>Cổng Tình nguyện viên</label><input id="ftTnv" value="${E(m.portal_tnv_url||"https://tnv.skyfirst.io.vn")}"></div><div class="field"><label>Cổng SFEC</label><input id="ftSfec" value="${E(m.portal_sfec_url||"https://sfec.skyfirst.io.vn")}"></div><div class="field"><label>Trung tâm Học tập số</label><input id="ftSlc" value="${E(m.portal_slc_url||"https://slc.skyfirst.io.vn")}"></div><div class="field"><label>Trang Thành viên</label><input id="ftMember" value="${E(m.portal_member_url||"https://member.skyfirst.io.vn")}"></div></div></div><button class="primary" onclick="saveFooterSettings()">Lưu toàn bộ Footer</button>`;
}
window.saveFooterSettings=()=>saveSettingItems({footer_description:document.getElementById("ftDesc").value,footer_email:document.getElementById("ftEmail").value,footer_support_email:document.getElementById("ftSupport").value,footer_portal_email:document.getElementById("ftPortalEmail").value,hotline:document.getElementById("ftHotline").value,footer_copyright:document.getElementById("ftCopyright").value,portal_main_label:document.getElementById("ftMainLabel").value,portal_main_url:document.getElementById("ftMain").value,portal_tnv_url:document.getElementById("ftTnv").value,portal_sfec_url:document.getElementById("ftSfec").value,portal_slc_url:document.getElementById("ftSlc").value,portal_member_url:document.getElementById("ftMember").value},"Đã cập nhật Footer và liên kết hệ sinh thái.");

async function adminMaintenance(main){
  const m=await loadSettingsMap();
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">TRẠNG THÁI WEBSITE</span><h1>404 & Bảo trì</h1><p class="muted">Có thể ẩn website công khai khi nâng cấp, đồng thời chuẩn bị nội dung 404 và thông báo trạng thái.</p></div></div><div class="admin-grid2"><div class="card"><h2>Chế độ website</h2><div class="check"><input id="mntMode" type="checkbox" ${m.maintenance_mode?"checked":""}><label><b>Bật chế độ bảo trì</b></label></div><div class="field"><label>Tiêu đề bảo trì</label><input id="mntTitle" value="${E(m.maintenance_title||"Sky First đang được cập nhật")}"></div><div class="field"><label>Nội dung thông báo</label><textarea id="mntText">${E(m.maintenance_text||"Hệ thống đang được nâng cấp để phục vụ bạn tốt hơn. Vui lòng quay lại sau.")}</textarea></div></div><div class="card"><h2>Trang 404</h2><div class="field"><label>Tiêu đề 404</label><input id="nfTitle" value="${E(m.not_found_title||"Không tìm thấy nội dung")}"></div><div class="field"><label>Mô tả</label><textarea id="nfText">${E(m.not_found_text||"Trang bạn đang tìm có thể đã được di chuyển, ẩn hoặc không còn tồn tại.")}</textarea></div><div class="field"><label>Ảnh minh họa (URL)</label><input id="nfImage" value="${E(m.not_found_image||"/assets/sfn-logo.png")}"></div></div></div><button class="primary" onclick="saveMaintenanceSettings()">Lưu trạng thái website</button>`;
}
window.saveMaintenanceSettings=()=>saveSettingItems({maintenance_mode:document.getElementById("mntMode").checked,maintenance_title:document.getElementById("mntTitle").value,maintenance_text:document.getElementById("mntText").value,not_found_title:document.getElementById("nfTitle").value,not_found_text:document.getElementById("nfText").value,not_found_image:document.getElementById("nfImage").value},"Đã cập nhật trạng thái website.");

async function adminMedia(main){
  const d=await api("/api/admin/media");state.admin.media=d.items||[];
  main.innerHTML=`<div class="admin-page-head"><div><span class="eyebrow">R2 MEDIA</span><h1>Thư viện ảnh</h1><p class="muted">Ảnh giao diện được lưu trực tiếp trên R2, không cần bản ghi D1.</p></div><button class="primary" onclick="uploadSiteImage()">+ Tải ảnh</button></div><div class="media-grid">${state.admin.media.map(x=>`<div class="media-card"><img src="${E(x.url)}" alt=""><div class="media-meta"><b>${E(x.key.split('/').pop())}</b><small>${Math.round((x.size||0)/1024)} KB</small><div class="actions"><button class="secondary" onclick="copyMediaUrl('${E(x.url)}')">Sao chép URL</button><button class="danger" onclick="deleteSiteImage('${E(x.key)}')">Xóa</button></div></div></div>`).join("")||`<div class="card muted">Chưa có ảnh tải lên.</div>`}</div>`;
}
window.uploadSiteImage=()=>{modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Tải ảnh lên R2</h2><form id="siteImageForm"><div class="field"><label>Chọn ảnh</label><input name="file" type="file" accept="image/*" required></div><button class="primary">Tải lên</button></form>`);document.getElementById("siteImageForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);try{const r=await api("/api/admin/media",{method:"POST",body:fd});closeModal();toast("Đã tải ảnh. URL: "+r.url);adminMedia(document.getElementById("adminMain"));}catch(err){toast(errorText(err),"bad")}}};
window.copyMediaUrl=async url=>{try{await navigator.clipboard.writeText(location.origin+url);toast("Đã sao chép URL ảnh.")}catch{prompt("Sao chép URL:",location.origin+url)}};
window.deleteSiteImage=key=>{if(!confirm("Xóa ảnh này khỏi R2?"))return;api(`/api/admin/media/${encodeURIComponent(key)}`,{method:"DELETE"}).then(()=>{toast("Đã xóa ảnh.");adminMedia(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))};

async function adminModules(main){
  const d=await api("/api/admin/modules");
  state.admin.modules=d.items||[];

  main.innerHTML=`<h1>Quản lý Modules</h1><p class="muted">Bật/tắt chức năng theo nhu cầu mà không phải tạo lại ZIP.</p><div class="card">${state.admin.modules.map(m=>`<div class="check"><input type="checkbox" data-module="${E(m.key)}" ${m.enabled?"checked":""}><label><b>${E(m.name)}</b> — ${E(m.description||"")} <span class="small muted">(${E(m.category)})</span></label></div>`).join("")}<button class="primary" onclick="saveModules()">Lưu Modules</button></div>`;
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
    toast("Đã cập nhật Modules.");
    await loadConfig();
  }).catch(e=>toast(errorText(e),"bad"));
};

async function adminSettings(main){
  const d=await api("/api/admin/settings");
  const map=Object.fromEntries(
    (d.items||[]).map(x=>[x.key,x.value])
  );
  state.admin.settings=map;

  main.innerHTML=`<h1>Cài đặt hệ thống</h1><div class="card"><div class="field"><label>Tên hệ thống</label><input id="sAppName" value="${E(map.app_name||"")}"></div><div class="field"><label>Email nhận toàn bộ đăng ký</label><input id="sReceiver" value="${E(map.receiver_email||"skyfirst.ec@gmail.com")}"></div><div class="field"><label>Hotline/Zalo</label><input id="sHotline" value="${E(map.hotline||"0924 910 210")}"></div><div class="field"><label>Website</label><input id="sWebsite" value="${E(map.website||"")}"></div><div class="field"><label>Châm ngôn</label><input id="sSlogan" value="${E(map.brand_slogan||"")}"></div><div class="field"><label>Tiêu đề Hero</label><input id="sHeroTitle" value="${E(map.hero_title||"Kết nối giáo dục. Phát triển cộng đồng.")}"></div><div class="field"><label>Mô tả Hero</label><textarea id="sHeroText">${E(map.hero_text||"Một cổng chung cho Thành viên, Core Team, Tình nguyện viên, Học sinh/Học viên, lớp học, hoạt động, hồ sơ, GCN/GXN và quản trị Sky First Network.")}</textarea></div><div class="field"><label>Ảnh bìa Hero (URL hoặc /api/files/...)</label><input id="sHeroCover" value="${E(map.hero_cover_url||"/assets/sfn-cover.png")}"></div><div class="field"><label>Thời hạn lưu hồ sơ không phù hợp (ngày)</label><input id="sRetention" type="number" value="${E(map.rejected_application_retention_days||365)}"></div><div class="check"><input id="sMaintenance" type="checkbox" ${map.maintenance_mode?"checked":""}><label>Bật chế độ bảo trì trang công khai</label></div><button class="primary" onclick="saveSettings()">Lưu cài đặt</button></div>`;
}

window.saveSettings=()=>api("/api/admin/settings",{
  method:"PUT",
  body:{
    items:{
      app_name:document.getElementById("sAppName").value,
      receiver_email:document.getElementById("sReceiver").value,
      hotline:document.getElementById("sHotline").value,
      website:document.getElementById("sWebsite").value,
      brand_slogan:document.getElementById("sSlogan").value,
      hero_title:document.getElementById("sHeroTitle").value,
      hero_text:document.getElementById("sHeroText").value,
      hero_cover_url:document.getElementById("sHeroCover").value,
      rejected_application_retention_days:
        Number(document.getElementById("sRetention").value)||365,
      maintenance_mode:
        document.getElementById("sMaintenance").checked
    }
  }
}).then(async()=>{
  toast("Đã lưu cài đặt.");
  await loadConfig();
}).catch(e=>toast(errorText(e),"bad"));

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

  main.innerHTML=`<h1>Audit Log</h1><div class="card table-scroll"><table><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>${(d.items||[]).map(x=>`<tr><td>${fmt(x.created_at)}</td><td>${E(x.actor_email||"Hệ thống")}</td><td>${E(x.action)}</td><td>${E(x.entity_type||"")} ${E(x.entity_id||"")}</td></tr>`).join("")}</tbody></table></div>`;
}

async function adminBackup(main){
  const d=await api("/api/admin/backups");

  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Sao lưu</h1><button class="primary" onclick="createBackup()">Tạo backup ngay</button></div><div class="notice">Hệ thống còn có lịch cleanup hằng ngày và backup cấu hình/nghiệp vụ tự động vào Chủ nhật khi cron được bật.</div><div class="card">${(d.items||[]).map(x=>`<p><b>${E(x.id)}</b> — ${Math.round((x.size||0)/1024)} KB — ${fmt(x.created_at)} <button class="danger" onclick="restoreBackup('${E(x.id)}')">Phục hồi</button></p>`).join("")||"<p>Chưa có backup.</p>"}</div>`;
}

window.restoreBackup=idb=>{
  if(!confirm("Phục hồi sẽ ghi đè các bảng nghiệp vụ trong backup. Chỉ Super Admin được thực hiện. Tiếp tục?"))return;

  api(`/api/admin/backups/${encodeURIComponent(idb)}/restore`,{
    method:"POST"
  }).then(()=>{
    toast("Đã phục hồi backup.");
    adminBackup(document.getElementById("adminMain"));
  }).catch(e=>toast(errorText(e),"bad"));
};

window.createBackup=()=>api("/api/admin/backup",{
  method:"POST"
}).then(()=>{
  toast("Đã tạo backup.");
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
    GOOGLE_OAUTH_NOT_CONFIGURED:"Đăng nhập Google chưa được cấu hình."
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
  }catch(err){
    app.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`;
  }
}

window.addEventListener("hashchange",router);

(async()=>{
  await loadConfig();
  await loadMe();
  await handleQueryActions();

  if(
    state.config.maintenance_mode&&
    !state.user&&
    !location.hash.startsWith("#login")
  ){
    app.innerHTML=`<div class="form-wrap"><div class="card"><img src="/assets/sfn-logo.png" style="width:90px"><h1>Sky First đang bảo trì</h1><p class="muted">Hệ thống tạm thời bảo trì. Quản trị viên vẫn có thể đăng nhập.</p><a class="primary" href="#login">Đăng nhập Quản trị</a></div></div>`;
    return;
  }

  await router();

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  }
})();
