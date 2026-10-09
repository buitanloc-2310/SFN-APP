
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
const isAdmin=u=>(u?.roles||[]).some(r=>Number(r.level)>=40||["super_admin","system_admin","club_secretary","office","hr","communications","external_events","unit_admin","handler"].includes(r.role_id));
const isMember=u=>(u?.roles||[]).some(r=>["member","volunteer","handler","unit_admin","communications","external_events","hr","office","club_secretary","system_admin","super_admin"].includes(r.role_id));

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
  accountBtn.textContent=state.user?(state.user.full_name||"Quản trị"):"Quản trị";
}
function moduleEnabled(key){
  const m=(state.config?.modules||[]).find(x=>x.key===key);
  return !m||!!m.enabled;
}
function setTheme(t){
  document.body.classList.toggle("dark",t==="dark");localStorage.setItem("sfec_theme",t);
}
themeBtn.onclick=()=>setTheme(document.body.classList.contains("dark")?"light":"dark");
setTheme(localStorage.getItem("sfec_theme")||"light");
accountBtn.onclick=()=>{if(state.user&&isAdmin(state.user)) location.hash="admin/dashboard"; else location.hash="login"};

function hero(){
  const title=E(state.config?.hero_title||"Học tiếng Anh. Kết nối trải nghiệm. Phát triển cùng SFEC.");
  const text=E(state.config?.hero_text||"Website chính thức của The Sky First English Club (SFEC), nơi công bố các chương trình, lớp học, hoạt động tiếng Anh và thông tin xác minh Giấy chứng nhận.");
  return `<section class="hero hero-official"><div class="hero-copy"><span class="eyebrow">THE SKY FIRST ENGLISH CLUB · SKY FIRST NETWORK</span><div class="hero-org">SFEC · ENGLISH LEARNING & ACTIVITIES</div><h1>${title}</h1><p>${text}</p><p class="hero-owner"><b>SFEC là đơn vị trực thuộc Sky First Network</b>, tập trung tổ chức các chương trình, lớp học và hoạt động liên quan đến Tiếng Anh. SFEC không duy trì cơ cấu Phòng/Ban nội bộ; các công tác hỗ trợ được phối hợp thông qua hệ thống chung của Sky First Network.</p><p class="hero-slogan"><b>${E(state.config?.slogan||"Learn · Connect · Grow")}</b></p><div class="actions"><a class="primary" href="#classes">Khám phá chương trình</a><a class="secondary" href="#lookup">Tra cứu GCN</a><a class="hero-link" href="#about">Giới thiệu SFEC →</a></div></div></section>`;
}
async function renderHome(){
  try{
    const custom=await api("/api/public/pages/home");
    if(custom?.item?.body_html){const x=custom.item;if(x.seo_title)document.title=x.seo_title;app.innerHTML=hero()+`<section class="cms-public-body">${x.body_html}</section>`;return;}
  }catch{}
  app.innerHTML=hero()+`<div class="section-kicker" style="margin-top:54px">SFEC HÔM NAY</div><h2 class="section-title" style="margin-top:8px">Tập trung vào Tiếng Anh, tinh gọn trong vận hành</h2><div class="grid3">
  ${quickCard("📘","Chương trình Tiếng Anh","Theo dõi các lớp học, chuyên đề và chương trình đang được SFEC tổ chức.","#classes")}
  ${quickCard("✨","Hoạt động","Các hoạt động, workshop và không gian thực hành Tiếng Anh của SFEC.","#events")}
  ${quickCard("✓","Xác minh GCN","Kiểm tra Giấy chứng nhận được ghi nhận trên hệ thống SFEC.","#lookup")}
  </div><div class="simple-note"><b>Mô hình vận hành tinh gọn</b><p>SFEC tập trung vào chuyên môn Tiếng Anh và không tổ chức các Phòng/Ban nội bộ. Hành chính, nhân sự, truyền thông, đối ngoại và các nhu cầu hỗ trợ khác được phối hợp với Sky First Network theo phân công.</p></div><h2 class="section-title">Bản tin SFEC</h2><div class="grid" id="homeNews"></div>`;
  try{const d=await api("/api/public/news");document.getElementById("homeNews").innerHTML=(d.items||[]).slice(0,3).map(newsCard).join("")||`<div class="card muted">Chưa có bản tin.</div>`}catch{}
}
function quickCard(icon,title,desc,href){return `<div class="card feature-card"><div class="feature-icon" aria-hidden="true">${icon}</div><h3>${E(title)}</h3><p class="muted">${E(desc)}</p><a class="secondary" href="${href}">Xem chi tiết →</a></div>`}
function newsExcerpt(body,max=210){const t=String(body||"").replace(/\s+/g," ").trim();return t.length>max?t.slice(0,max).trim()+"…":t}
function newsBody(body){return E(body||"").replace(/\r?\n/g,"<br>")}
function newsCard(n){return `<article class="card news-card"><span class="pill">${E((n.published_at||"").slice(0,10))}</span><h3>${E(n.title)}</h3><p class="muted news-excerpt">${E(newsExcerpt(n.body))}</p><a class="secondary" href="#news/${encodeURIComponent(n.id)}">Đọc bản tin →</a></article>`}
async function renderInfoPage(kind){
  const pages={
    about:{k:"GIỚI THIỆU SFEC",t:"Một không gian dành cho việc học và sử dụng Tiếng Anh",b:`<div class="article-lead"><p><b>The Sky First English Club (SFEC)</b> là đơn vị trực thuộc <b>Sky First Network (SFN)</b>, tập trung tổ chức các lớp học, chương trình, chuyên đề và hoạt động liên quan đến Tiếng Anh.</p></div><h2>SFEC tập trung vào điều gì?</h2><p>SFEC hướng đến những hoạt động có nội dung rõ ràng, phù hợp với người học và tạo thêm cơ hội thực hành Tiếng Anh. Tùy từng giai đoạn, SFEC có thể triển khai lớp học, hoạt động giao tiếp, phát âm, từ vựng, kỹ năng, chuyên đề học thuật hoặc những chương trình Tiếng Anh phù hợp với định hướng chung.</p><h2>Mô hình tinh gọn</h2><p>SFEC không duy trì cơ cấu Phòng/Ban nội bộ và không vận hành như một tổ chức độc lập. Các công tác hành chính, nhân sự, truyền thông, đối ngoại, công nghệ và hỗ trợ vận hành khi phát sinh được phối hợp thông qua cơ cấu chung của Sky First Network theo phân công.</p><h2>Website SFEC</h2><p>Website này là kênh công khai thông tin chương trình, hoạt động, bản tin và tra cứu Giấy chứng nhận. Website không phải cổng học viên và không cung cấp tài khoản học viên/thành viên. Khu vực đăng nhập chỉ dành cho người được cấp quyền quản trị hệ thống.</p>`},
    journey:{k:"HÀNH TRÌNH SFEC",t:"Từ một câu lạc bộ đến mô hình chuyên môn tinh gọn",b:`<p>SFEC được xây dựng từ định hướng tạo môi trường học và thực hành Tiếng Anh. Qua quá trình hoạt động, mô hình vận hành được điều chỉnh theo hướng tinh gọn hơn để tập trung nguồn lực cho chuyên môn và trải nghiệm của các chương trình.</p><h2>Giai đoạn hiện tại</h2><p>SFEC tập trung tổ chức các mảng liên quan đến Tiếng Anh, không duy trì hệ thống Phòng/Ban riêng. Những chức năng hỗ trợ không thuộc chuyên môn Tiếng Anh được phối hợp ở cấp Sky First Network.</p>`},
    values:{k:"ĐỊNH HƯỚNG",t:"Học thật · Thực hành thật · Vận hành tinh gọn",b:`<h2>Chuyên môn là trọng tâm</h2><p>Mỗi chương trình của SFEC cần hướng đến giá trị học tập hoặc thực hành Tiếng Anh cụ thể, có nội dung phù hợp và thông tin rõ ràng.</p><h2>Tinh gọn và phối hợp</h2><p>SFEC không tạo thêm bộ máy nội bộ khi các chức năng đó đã có thể được hỗ trợ bởi Sky First Network. Việc phối hợp được thực hiện theo nhu cầu thực tế của từng chương trình.</p><h2>Thông tin có thể kiểm chứng</h2><p>Các thông tin công khai, chương trình và Giấy chứng nhận cần được ghi nhận rõ ràng trên hệ thống để thuận tiện cho việc tra cứu và xác minh.</p>`},
    organization:{k:"SFEC & SKY FIRST NETWORK",t:"Một đơn vị chuyên môn trong hệ thống Sky First Network",b:`<p><b>SFEC trực thuộc Sky First Network</b> và tập trung vào các chương trình, lớp học và hoạt động Tiếng Anh.</p><div class="simple-note"><b>SFEC không duy trì cơ cấu Phòng/Ban nội bộ.</b><p>Các nhu cầu về hành chính, nhân sự, truyền thông, đối ngoại, công nghệ và vận hành được phối hợp với các đơn vị chức năng của Sky First Network theo phân công.</p></div><p>Cách tổ chức này giúp SFEC dành nguồn lực cho chuyên môn thay vì xây dựng một bộ máy vận hành độc lập.</p>`}
  };
  const x=pages[kind]||pages.about;
  app.innerHTML=`<article class="info-page longform"><div class="section-kicker">${x.k}</div><h1>${x.t}</h1><div class="info-copy">${x.b}</div><div class="article-cta"><div><b>Khám phá SFEC</b><p class="muted">Xem chương trình, hoạt động hoặc xác minh Giấy chứng nhận.</p></div><div class="actions"><a class="primary" href="#classes">Chương trình</a><a class="secondary" href="#lookup">Tra cứu GCN</a></div></div></article>`;
}
async function renderForms(){
  const forms=state.config?.forms||[];
  app.innerHTML=`<div class="section-kicker">Tham gia SFEC</div><h1>Chọn đúng hành trình của bạn</h1><p class="muted">Mỗi biểu mẫu phục vụ một nhu cầu cụ thể. Hồ sơ được tiếp nhận tập trung bởi Văn phòng SFEC và người đăng ký nhận email xác nhận sau khi gửi thành công.</p><div class="grid">${forms.map(f=>`<div class="card"><span class="pill">${E(f.prefix)}</span><h3>${E(f.name)}</h3><p class="muted">${E(f.description)}</p><p class="small">${f.min_age?`Điều kiện độ tuổi: từ đủ ${f.min_age} tuổi`:"Theo điều kiện của lớp/chương trình"}</p><a class="primary" href="#form/${encodeURIComponent(f.id)}">Mở đăng ký</a></div>`).join("")}</div>`;
}
function conditionOk(cond,answers){
  if(!cond)return true;if("equals" in cond)return answers[cond.key]===cond.equals;if("not_equals" in cond)return answers[cond.key]!==cond.not_equals;return true;
}
function fieldHtml(f){
  const req=f.required?" *":"",attrs=`data-key="${E(f.key)}" ${f.required?"required":""}`;
  if(f.type==="textarea")return `<div class="field"><label>${E(f.label)}${req}</label><textarea ${attrs}></textarea></div>`;
  if(f.type==="select")return `<div class="field"><label>${E(f.label)}${req}</label><select ${attrs}><option value="">-- Chọn --</option>${(f.options||[]).map(x=>`<option>${E(x)}</option>`).join("")}</select></div>`;
  if(f.type==="checkbox")return `<div class="check"><input type="checkbox" ${attrs}><label>${E(f.label)}${req}</label></div>`;
  if(f.type==="file")return `<div class="field file-field"><label>${E(f.label)}${req}</label><label class="upload-zone"><span class="upload-icon">⬆</span><b>Chọn tệp để tải lên</b><small>${(f.accept||[]).some(x=>String(x).startsWith("image/"))?"JPG, PNG hoặc WEBP · ảnh rõ mặt, đủ sáng":"Tệp được lưu bảo mật trong hệ thống"}</small><input type="file" ${attrs} ${f.accept?`accept="${E(f.accept.join(","))}"`:""}></label><div class="image-preview" data-preview-for="${E(f.key)}"></div></div>`;
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
    app.innerHTML=`<div class="form-wrap"><a class="ghost" href="#forms">← Quay lại</a><div class="form-hero"><span class="form-icon">✦</span><div><span class="pill">${E(d.form.prefix)}</span><h1>${E(d.form.name)}</h1><p>${E(d.form.description)}</p><div class="form-assurance"><span>🔒 Dữ liệu được lưu bảo mật</span><span>✉️ Email xác nhận từ sfec@skyfirst.io.vn</span><span>🏢 Văn phòng SFEC tiếp nhận hồ sơ</span></div></div></div><div class="card form-card">
      ${(d.terms||[]).map(t=>`<details class="term"><summary>${E(t.code)} — ${E(t.name)} (${E(t.version)})</summary><pre>${E(t.body)}</pre></details>`).join("")}
      <form id="dynamicForm">${(c.sections||[]).map((s,i)=>`<section data-section="${i}"><h2>${E(s.title)}</h2>${(s.fields||[]).map(f=>`<div data-field-wrap="${E(f.key)}">${fieldHtml(f)}</div>`).join("")}</section>`).join("")}
      <div id="turnstileSlot"></div><div class="actions"><button class="primary" type="submit">Gửi hồ sơ</button><a class="secondary" href="#forms">Hủy</a></div></form>
    </div></div>`;
    const form=document.getElementById("dynamicForm");
    form.addEventListener("change",e=>{applyConditions(c);const el=e.target;if(el?.type==="file"&&el.files?.[0]){const box=form.querySelector(`[data-preview-for="${CSS.escape(el.dataset.key||"")}"]`);if(box&&String(el.files[0].type||"").startsWith("image/")){const url=URL.createObjectURL(el.files[0]);box.innerHTML=`<img src="${url}" alt="Xem trước ảnh"><span>${E(el.files[0].name)}</span>`;}}});applyConditions(c);
    if(state.config.turnstile_site_key) await mountTurnstile();
    form.addEventListener("submit",async e=>{
      e.preventDefault();const {answers,files,firstBad}=collectFormValues(form,c,true);
      if(firstBad){toast("Vui lòng hoàn thành: "+firstBad.label,"bad");firstBad.el.focus();return}
      const fd=new FormData();fd.append("payload",JSON.stringify({answers,turnstile_token:state.turnstileToken}));
      for(const [k,f] of Object.entries(files))fd.append(`file:${k}`,f);
      const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Đang gửi…";
      try{
        const r=await api(`/api/forms/${encodeURIComponent(idForm)}/submit`,{method:"POST",body:fd});
        form.innerHTML=`<div class="notice good"><h2>Hồ sơ đã được tiếp nhận</h2><p><b>Mã hồ sơ: ${E(r.code)}</b></p><p>Hãy lưu mã này để tra cứu. ${r.email_sent?`<b>Email xác nhận đã được gửi đến địa chỉ email bạn đăng ký từ sfec@skyfirst.io.vn.</b>`:`<b>Hồ sơ đã lưu thành công.</b> Email xác nhận chưa gửi được; Văn phòng SFEC vẫn đã nhận hồ sơ trên hệ thống.`}</p><div class="actions"><a class="primary" href="#lookup">Tra cứu hồ sơ</a><a class="secondary" href="#home">Trang chủ</a></div></div>`;
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
  const d=await api("/api/public/classes");app.innerHTML=`<div class="section-kicker">CHƯƠNG TRÌNH TIẾNG ANH</div><h1>Chương trình & Lớp học SFEC</h1><p class="muted">Thông tin các chương trình, lớp học và nội dung Tiếng Anh đang được SFEC công bố.</p><div class="grid">${(d.items||[]).map(c=>`<div class="card"><span class="pill">${E(c.level||"SFEC")}</span><h3>${E(c.title)}</h3><p class="muted">${E(c.unit_code||"The Sky First English Club")}</p><span class="status">${E(c.status)}</span></div>`).join("")||"<div class='card'>Chưa có chương trình được công bố.</div>"}</div>`;
}
async function renderEvents(){
  const d=await api("/api/public/events");app.innerHTML=`<div class="section-kicker">HOẠT ĐỘNG SFEC</div><h1>Hoạt động Tiếng Anh</h1><p class="muted">Các hoạt động, workshop, chuyên đề và không gian thực hành Tiếng Anh được SFEC công bố.</p><div class="grid">${(d.items||[]).map(x=>`<div class="card"><span class="pill">SFEC</span><h3>${E(x.title)}</h3><p class="muted">${fmt(x.start_at)}</p><span class="status">${E(x.status)}</span></div>`).join("")||"<div class='card'>Chưa có hoạt động được công bố.</div>"}</div>`;
}
async function renderNews(id=null){
  const d=await api("/api/public/news");
  if(id){const n=(d.items||[]).find(x=>String(x.id)===String(id));if(!n){app.innerHTML=`<div class="notice bad">Không tìm thấy bản tin.</div>`;return}app.innerHTML=`<article class="news-detail"><a class="ghost" href="#news">← Bản tin SFEC</a><div class="section-kicker">BẢN TIN SFEC</div><h1>${E(n.title)}</h1><div class="news-meta">${E((n.published_at||"").slice(0,10))}</div><div class="news-content">${newsBody(n.body)}</div></article>`;return}
  app.innerHTML=`<div class="section-kicker">TIN TỨC & CẬP NHẬT</div><h1>Bản tin SFEC</h1><p class="muted">Thông tin lớp học, hoạt động, chương trình và những cập nhật chính thức từ SFEC.</p><div class="grid news-grid">${(d.items||[]).map(newsCard).join("")||"<div class='card'>Chưa có tin.</div>"}</div>`;
}
function renderLookup(){
  app.innerHTML=`<section class="verify-hero"><div><div class="section-kicker">TRA CỨU & XÁC MINH</div><h1>Xác thực Giấy chứng nhận <span>của SFEC</span></h1><p>Kiểm tra thông tin Giấy chứng nhận được ghi nhận trên hệ thống The Sky First English Club.</p><div class="verify-benefits"><span>◈ <b>Thông tin chính xác</b></span><span>▣ <b>Dữ liệu có kiểm chứng</b></span><span>⚡ <b>Xác minh nhanh chóng</b></span></div></div><div class="verify-art"><div class="cert-sheet">SFEC<br><strong>CERTIFICATE</strong><div></div><div></div><div></div><b>✓</b></div><div class="magnifier"></div></div></section><section class="verify-panel"><aside><div class="verify-tab active"><b>▤</b><span><strong>Xác minh<br>Giấy chứng nhận</strong><small>Nhập mã GCN để tra cứu</small></span></div><div class="verify-tab"><b>⌗</b><span><strong>Quét mã QR</strong><small>Sử dụng mã QR trên GCN</small></span></div><div class="verify-help">ⓘ Mã Giấy chứng nhận thường được in trên GCN hoặc gửi kèm thông tin phát hành.</div></aside><div class="verify-main"><div class="lookup-label">NHẬP MÃ GIẤY CHỨNG NHẬN</div><h2>Tra cứu thông tin GCN</h2><p class="muted">Nhập chính xác mã Giấy chứng nhận để kiểm tra thông tin xác minh công khai.</p><form id="lookupCert" class="verify-form"><div class="verify-input"><span>▤</span><input name="code" required placeholder="Ví dụ: 001/GCN-SFEC/2026"></div><button class="primary">⌕ &nbsp; Xác minh →</button></form><div class="verify-format">Định dạng mã GCN: <b>XXX/GCN-SFEC/NĂM</b> &nbsp; | &nbsp; Ví dụ: 001/GCN-SFEC/2026</div><div class="verify-trust">♢ Thông tin hiển thị được truy xuất trực tiếp từ hệ thống SFEC và có giá trị xác minh công khai.</div><div id="certResult"></div></div></section>`;
  document.getElementById("lookupCert").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api(`/api/lookup/certificate?code=${encodeURIComponent(f.get("code"))}`);const c=d.item,m=J(c.metadata_json)||{};const valid=c.status!=="revoked";document.getElementById("certResult").innerHTML=`<div class="lookup-result ${valid?'valid':'revoked'}"><div class="verify-head"><span class="verify-dot"></span><div><small>TRẠNG THÁI XÁC MINH</small><strong>${valid?'Giấy chứng nhận hợp lệ':'Giấy chứng nhận đã thu hồi'}</strong></div></div><dl><div><dt>Mã Giấy chứng nhận</dt><dd>${E(c.code)}</dd></div><div><dt>Họ và tên</dt><dd>${E(c.full_name)}</dd></div><div><dt>Nội dung ghi nhận</dt><dd>${E(c.content)}</dd></div><div><dt>Đơn vị tổ chức</dt><dd>${E(m.unit_name||'The Sky First English Club (SFEC)')}</dd></div><div><dt>Đơn vị chủ quản</dt><dd>${E(m.owner_name||'Sky First Network (SFN)')}</dd></div><div><dt>Ngày cấp</dt><dd>${fmt(c.issued_at)}</dd></div>${m.registry_no?`<div><dt>Số vào sổ</dt><dd>${E(m.registry_no)}</dd></div>`:''}<div><dt>Trạng thái</dt><dd>${E(c.status)}</dd></div></dl></div>`}catch{document.getElementById("certResult").innerHTML="<div class='notice warn'>Chưa tìm thấy Giấy chứng nhận với mã này. Vui lòng kiểm tra lại mã đã nhập.</div>"}};
  const auto=new URLSearchParams(location.search).get("cert_lookup");if(auto){document.querySelector('#lookupCert [name="code"]').value=auto;document.getElementById("lookupCert").requestSubmit();}
}
function renderContact(){app.innerHTML=`<article class="info-page"><div class="section-kicker">LIÊN HỆ</div><h1>Kết nối với SFEC</h1><div class="grid2"><div class="card"><h3>The Sky First English Club</h3><p>SFEC tập trung tổ chức các chương trình, lớp học và hoạt động liên quan đến Tiếng Anh.</p><p><b>Email:</b> sfec@skyfirst.io.vn<br><b>Website:</b> sfec.skyfirst.io.vn</p></div><div class="card"><h3>Hỗ trợ vận hành</h3><p>Các nội dung hành chính, nhân sự, truyền thông, đối ngoại và hỗ trợ hệ thống được phối hợp thông qua Sky First Network theo phân công.</p><a class="secondary" href="https://skyfirst.io.vn" target="_blank" rel="noopener">Sky First Network →</a></div></div></article>`;}

function renderLogin(){
  app.innerHTML=`<div class="admin-login-public"><div class="section-kicker">SFEC SYSTEM</div><h1>Đăng nhập Quản trị</h1><p class="muted">Khu vực dành riêng cho tài khoản được cấp quyền quản trị hệ thống SFEC.</p><div id="loginPanel" style="max-width:650px;margin:18px auto"></div></div>`;
  showLogin('admin');
}
window.showLogin=function(portal){
  state.portal=portal;
  const title="Quản trị viên";
  const reg="";
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
  <p class="muted">Tài khoản tự tạo chỉ có quyền người học. Quyền Thành viên SFEC phải được SFEC cấp sau khi duyệt.</p>
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
async function logout(){await api("/api/auth/logout",{method:"POST"}).catch(()=>{});state.user=null;accountBtn.textContent="Quản trị";location.hash="home"}
window.logout=logout;

async function renderPortal(){
  if(!state.user){location.hash="login";return}
  const d=await api("/api/me/portal");
  const member=isMember(state.user);
  const menu=[
    ["overview","🏠 Tổng quan"],["records","📥 Hồ sơ đăng ký"],["classes","Lớp học"],["events","Sự kiện"],["certs","GCN/GXN"],["notifications","Thông báo"],
    ...(member?[["profile","Hồ sơ thành viên"],["requests","Yêu cầu nội bộ"],["privacy","🛡️ Quyền riêng tư"]]:[]),
    ["security","Bảo mật tài khoản"]
  ];
  const route=(location.hash.split("/")[1]||"overview");
  app.innerHTML=`<div class="dashboard"><aside class="sidebar">${menu.map(m=>`<button class="${route===m[0]?"active":""}" onclick="location.hash='portal/${m[0]}'">${m[1]}</button>`).join("")}<button onclick="logout()">↩ Đăng xuất</button></aside><div id="portalMain"></div></div>`;
  const main=document.getElementById("portalMain");
  if(route==="overview")main.innerHTML=`<h1>Hồ sơ của tôi</h1><div class="kpis"><div class="kpi"><b>${d.records.length}</b>Hồ sơ</div><div class="kpi"><b>${d.classes.length}</b>Lớp học</div><div class="kpi"><b>${d.certificates.length}</b>GCN/GXN</div><div class="kpi"><b>${d.notifications.filter(n=>!n.read_at).length}</b>Thông báo mới</div></div>${d.person?`<div class="card" style="margin-top:14px"><h3>${E(d.person.full_name)}</h3><p>${E(d.person.position||"")} • ${E(d.person.unit_code||"SFEC")}</p><span class="status">${E(d.person.status)}</span></div>`:""}`;
  if(route==="records")main.innerHTML=listCards("📥 Hồ sơ đăng ký",d.records,r=>`<b>${E(r.code)}</b> — ${E(r.form_id)} <span class="status">${E(r.status)}</span><br><span class="small muted">${fmt(r.created_at)}</span>`);
  if(route==="classes")main.innerHTML=listCards("Lớp học của tôi",d.classes,r=>`<b>${E(r.title)}</b> — ${E(r.status)}<br><span class="small muted">${E(r.class_status)}</span>`);
  if(route==="events")main.innerHTML=listCards("Sự kiện của tôi",d.events,r=>`<b>${E(r.title)}</b> — ${E(r.status)}<br><span class="small muted">${fmt(r.start_at)}</span>`);
  if(route==="certs")main.innerHTML=listCards("GCN/GXN của tôi",d.certificates,r=>`<b>${E(r.code||"Đang chờ cấp số")}</b> — ${E(r.cert_type)}<br>${E(r.content)}<br><span class="status">${E(r.status)}</span>`);
  if(route==="notifications"){main.innerHTML=listCards("Thông báo",d.notifications,r=>`<b>${E(r.title)}</b><br>${E(r.body||"")}<br><span class="small muted">${fmt(r.created_at)}</span>`)+`<button class="secondary" onclick="markAllRead()">Đánh dấu tất cả đã đọc</button>`}
  if(route==="profile")main.innerHTML=`<h1>Hồ sơ thành viên</h1>${d.person?`<div class="card"><h2>${E(d.person.full_name)}</h2><p>Email: ${E(d.person.email||state.user.email)}</p><p>Đơn vị: ${E(d.person.unit_code||"SFEC")}</p><p>Chức danh/Vai trò: ${E(d.person.position||"")}</p><p>Ngày gia nhập: ${E(d.person.joined_at||"")}</p><span class="status">${E(d.person.status)}</span></div>`:`<div class="notice warn">Tài khoản đã đăng nhập nhưng chưa có hồ sơ nhân sự điện tử liên kết.</div>`}`;
  if(route==="requests")main.innerHTML=`<h1>Yêu cầu & Thủ tục nội bộ</h1><div class="grid">${["Cập nhật thông tin nhân sự","Điều chuyển vị trí/đơn vị","Tạm ngừng hoạt động","Thôi nhiệm vụ/rút khỏi SFEC","Đề nghị xác nhận quá trình tham gia","Đề nghị GCN/GXN","Bàn giao nhiệm vụ"].map(x=>`<button class="role-card" onclick="internalRequest('${E(x)}')"><b>${E(x)}</b></button>`).join("")}</div><h2 class="section-title">Lịch sử yêu cầu</h2>${listCards("",d.internal_requests,r=>`<b>${E(r.code)}</b> — ${E(r.request_type)} <span class="status">${E(r.status)}</span>`)}`;
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
 {group:"",items:[["dashboard","🏠 Tổng quan"]]},
 {group:"VẬN HÀNH",items:[["approvals","✅ Trung tâm phê duyệt"],["submissions","📥 Hồ sơ đăng ký"],["classes","🎓 Lớp học & Điểm danh"],["events","🎉 Sự kiện & Check-in"],["tasks","📌 Nhiệm vụ"]]},
 {group:"NHÂN SỰ",items:[["people","👥 Hồ sơ nhân sự"],["recruitment","🧭 Tuyển dụng & Đánh giá"],["users","🔐 Tài khoản & Phân quyền"],["teaching","👩‍🏫 Phạm vi TNV Dạy học"]]},
 {group:"NỘI DUNG & WEBSITE",items:[["studio","✨ Website Studio"],["media","🖼️ Thư viện Media"],["news","📰 Bản tin & CMS"],["forms","🧩 Form Builder"],["documents","📚 Kho văn bản"],["files","📎 File & Minh chứng"]]},
 {group:"XÁC MINH & HỖ TRỢ",items:[["certificates","🏅 GCN & GXN"],["tickets","🎫 Hỗ trợ & Ticket"],["email","✉️ Email"]]},
 {group:"HỆ THỐNG",items:[["terms","📜 Điều khoản & Chính sách"],["privacy","🛡️ Quyền riêng tư"],["modules","🧱 Modules"],["settings","⚙️ Cài đặt"],["search","🔎 Tìm kiếm"],["audit","🧾 Audit Log"],["backup","💾 Sao lưu & Phục hồi"]]}
]
async function renderAdmin(){
  if(!state.user||!isAdmin(state.user)){location.hash="login";return}
  const section=location.hash.split("/")[1]||"dashboard";
  app.innerHTML=`<div class="dashboard"><aside class="sidebar"><div class="admin-brand"><b>SFEC</b><span>HỆ THỐNG QUẢN TRỊ</span></div>${adminMenu.map(g=>`${g.group?`<div class="admin-group-title">${g.group}</div>`:""}${g.items.map(m=>`<button class="${section===m[0]?"active":""}" onclick="location.hash='admin/${m[0]}'">${m[1]}</button>`).join("")}`).join("")}<button class="admin-logout" onclick="logout()">Đăng xuất</button></aside><section id="adminMain"><div class="loading">Đang tải…</div></section></div>`;
  const main=document.getElementById("adminMain");
  try{
    if(section==="dashboard")await adminDashboard(main);
    else if(section==="approvals")await adminApprovals(main);
    else if(section==="submissions")await adminSubmissions(main);
    else if(section==="users")await adminUsers(main);
    else if(section==="people")await adminPeople(main);
    else if(section==="recruitment")await adminRecruitment(main);
    else if(section==="forms")await adminForms(main);
    else if(section==="terms")await adminTerms(main);
    else if(section==="teaching")await adminTeaching(main);
    else if(section==="classes")await adminGeneric(main,"classes","Lớp học",["unit_code","title","level","status","capacity"]);
    else if(section==="events")await adminGeneric(main,"events","Sự kiện",["unit_code","title","start_at","end_at","status","capacity"]);
    else if(section==="documents")await adminGeneric(main,"documents","📚 Kho văn bản",["code","doc_type","title","visibility","status","issued_at"]);
    else if(section==="studio")await adminStudio(main);
    else if(section==="media")await adminMedia(main);
    else if(section==="news")await adminNews(main);
    else if(section==="tasks")await adminGeneric(main,"tasks","Nhiệm vụ & Bàn giao",["title","description","assigned_to","unit_code","status","priority","due_at"]);
    else if(section==="certificates")await adminCertificates(main);
    else if(section==="tickets")await adminTickets(main);
    else if(section==="privacy")await adminPrivacy(main);
    else if(section==="files")await adminFiles(main);
    else if(section==="email")await adminEmail(main);
    else if(section==="modules")await adminModules(main);
    else if(section==="settings")await adminSettings(main);
    else if(section==="search")await adminSearch(main);
    else if(section==="audit")await adminAudit(main);
    else if(section==="backup")await adminBackup(main);
    else main.innerHTML='<div class="notice bad">Không tìm thấy mục quản trị này.</div>';
  }catch(err){
    console.error('Admin section load failed:',section,err);
    main.innerHTML=`<div class="notice bad"><b>Không thể tải mục này.</b><br>${E(errorText(err))}<div class="small muted" style="margin-top:8px">Nếu vừa cập nhật hệ thống, hãy chạy migration D1 rồi tải lại trang.</div></div>`;
  }
}
async function adminDashboard(main){
  const d=await api("/api/admin/dashboard");const c=d.counts;
  main.innerHTML=`<div class="admin-hero-pro"><div><span class="pill">SFEC CONTROL CENTER</span><h1>Quản trị SFEC</h1><p>Trung tâm vận hành website, nội dung, hồ sơ, nhân sự, lớp học, sự kiện và hệ thống trong một nơi.</p></div><div class="admin-live"><i></i><span>Hệ thống đang hoạt động</span></div></div><div class="kpis"><div class="kpi"><b>${c.submissions}</b>Hồ sơ</div><div class="kpi"><b>${c.pending}</b>Cần xử lý</div><div class="kpi"><b>${c.people}</b>Nhân sự</div><div class="kpi"><b>${c.certificates}</b>GCN/GXN đã cấp</div><div class="kpi"><b>${c.approvals}</b>Chờ phê duyệt</div><div class="kpi"><b>${c.tickets}</b>Ticket mở</div><div class="kpi"><b>${c.tasks}</b>Nhiệm vụ</div></div>
  <h2 class="section-title">Thao tác nhanh</h2><div class="admin-quick-grid"><button onclick="location.hash='admin/studio'"><b>✨ Website Studio</b><span>Sửa các trang, SEO, cover và xuất bản.</span></button><button onclick="location.hash='admin/media'"><b>🖼️ Media Library</b><span>Upload và quản lý ảnh trên R2.</span></button><button onclick="location.hash='admin/news'"><b>📰 Bản tin</b><span>Đăng và chỉnh sửa nội dung truyền thông.</span></button><button onclick="location.hash='admin/forms'"><b>🧩 Form Builder</b><span>Tạo và quản lý biểu mẫu đăng ký.</span></button><button onclick="location.hash='admin/search'"><b>⌕ Tìm kiếm</b><span>Tìm hồ sơ, người, GCN và dữ liệu hệ thống.</span></button><button onclick="location.hash='admin/backup'"><b>🛡️ Backup</b><span>Sao lưu và phục hồi dữ liệu nghiệp vụ.</span></button></div>
  <div class="card" style="margin-top:18px"><h2>Quyền quản trị được bảo vệ</h2><p>Super Admin gốc: <b>sfec.englishclub@gmail.com</b>. Thành viên không tự cấp quyền. Quản trị viên chỉ cấp được vai trò trong phạm vi thẩm quyền.</p></div>`;
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
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Cấp tài khoản</h2><form id="inviteForm"><div class="field"><label>Họ và tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Vai trò ban đầu</label><select name="role"><option>student</option><option>member</option><option>volunteer</option><option>handler</option><option>unit_admin</option><option>communications</option><option>external_events</option><option>hr</option><option>office</option><option>club_secretary</option><option>system_admin</option><option>super_admin</option></select></div><div class="field"><label>Phạm vi đơn vị (nếu có)</label><input name="scope_unit_code" placeholder="Ví dụ: SFEC"></div><button class="primary">Cấp tài khoản</button></form>`);
  document.getElementById("inviteForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/admin/users",{method:"POST",body:{full_name:f.get("full_name"),email:f.get("email"),roles:[f.get("role")],scope_unit_code:f.get("scope_unit_code")}});closeModal();modal(`<h2>Đã cấp tài khoản</h2><div class="notice warn">Mật khẩu tạm thời chỉ hiển thị lần này.</div><p><b>${E(f.get("email"))}</b></p><pre class="card">${E(d.temp_password)}</pre><button class="primary" onclick="closeModal()">Đã lưu</button>`)}catch(err){toast(errorText(err),"bad")}};
}
window.editRoles=idUser=>{
  const u=state.admin.users.find(x=>x.id===idUser);if(!u)return;
  const all=["student","member","volunteer","handler","unit_admin","communications","external_events","hr","office","club_secretary","system_admin","super_admin"];
  modal(`<button class="ghost" onclick="closeModal()">✕ Đóng</button><h2>Phân quyền — ${E(u.full_name||u.email)}</h2><div id="roleChecks">${all.map(r=>`<div class="check"><input type="checkbox" data-role="${r}" ${(u.roles||[]).some(x=>x.role_id===r)?"checked":""}><label>${r}</label></div>`).join("")}</div><div class="field"><label>Phạm vi đơn vị áp dụng cho vai trò mới</label><input id="roleScope" placeholder="SFEC hoặc để trống"></div><button class="primary" onclick="saveRoles(${idUser})">Lưu quyền</button>`);
}
window.saveRoles=async idUser=>{const roles=[...document.querySelectorAll("#roleChecks [data-role]:checked")].map(x=>({role_id:x.dataset.role,scope_unit_code:document.getElementById("roleScope").value.trim()}));try{await api(`/api/admin/users/${idUser}/roles`,{method:"PUT",body:{roles}});closeModal();toast("Đã cập nhật quyền.");adminUsers(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}
window.resetUserPassword=async(idUser,email)=>{if(!confirm(`Tạo mật khẩu tạm thời mới cho ${email}? Tất cả phiên đăng nhập hiện tại sẽ bị thu hồi.`))return;try{const d=await api(`/api/admin/users/${idUser}/reset-password`,{method:"POST"});modal(`<h2>Mật khẩu tạm thời mới</h2><p>${E(email)}</p><pre class="card">${E(d.temp_password)}</pre><div class="notice warn">Mật khẩu này chỉ hiển thị lần này. Người dùng sẽ buộc đổi sau khi đăng nhập.</div><button class="primary" onclick="closeModal()">Đã lưu</button>`)}catch(e){toast(errorText(e),"bad")}}
window.toggleUser=async(idUser,status)=>{try{await api(`/api/admin/users/${idUser}/status`,{method:"PATCH",body:{status:status==="active"?"locked":"active"}});toast("Đã cập nhật.");adminUsers(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}

async function adminPeople(main){
  const d=await api("/api/admin/people");main.innerHTML=`<h1>Hồ sơ nhân sự điện tử</h1><div class="card table-scroll"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Đơn vị</th><th>Chức danh/Vai trò</th><th>Trạng thái</th><th>Gia nhập</th></tr></thead><tbody>${(d.items||[]).map(p=>`<tr><td><b>${E(p.full_name)}</b></td><td>${E(p.email||"")}</td><td>${E(p.unit_code||"")}</td><td>${E(p.position||"")}</td><td><span class="status">${E(p.status)}</span></td><td>${E(p.joined_at||"")}</td></tr>`).join("")}</tbody></table></div>`;
}
async function adminRecruitment(main){
  main.innerHTML=`<h1>Tuyển dụng & Đánh giá</h1><div class="grid"><div class="card"><h3>Quy trình Core Team</h3><p>Tiếp nhận → Sàng lọc → Phỏng vấn → Đánh giá bổ sung → Thông báo → Tiếp nhận.</p><a class="primary" href="#admin/submissions">Mở hồ sơ</a></div><div class="card"><h3>TNV Dạy học</h3><p>Đánh giá đúng phạm vi Lớp 9/10/11/12/A1–A2/B1–B2/Giao tiếp/Từ vựng; có thể dạy thử trước khi phân lớp.</p><a class="primary" href="#admin/submissions">Mở hồ sơ TNV</a></div><div class="card"><h3>Chấm điểm & Phỏng vấn</h3><p>Mở một hồ sơ và dùng nút Lịch phỏng vấn / Chấm đánh giá.</p></div></div>`;
}


window.requestGenericApproval=(entity_type,entity_id)=>{const action=prompt("Nội dung cần phê duyệt:","Phê duyệt hồ sơ/đề xuất");if(!action)return;const role=prompt("Vai trò được giao phê duyệt:","club_secretary")||"club_secretary";api("/api/admin/approvals",{method:"POST",body:{entity_type,entity_id,action,assigned_role:role}}).then(()=>toast("Đã chuyển vào Trung tâm phê duyệt.")).catch(e=>toast(errorText(e),"bad"))}

async function adminTerms(main){
  const d=await api("/api/admin/terms");state.admin.terms=d.items||[];
  main.innerHTML=`<h1>Điều khoản & Chính sách</h1><p class="muted">Hệ thống lưu phiên bản điều khoản mà từng người đã xác nhận.</p>${state.admin.terms.map(t=>`<div class="card" style="margin:10px 0"><div class="toolbar"><div><b>${E(t.code)} — ${E(t.name)}</b><br><span class="small muted">Phiên bản ${E(t.version)} • ${E(t.status)}</span></div><button class="secondary" onclick="editTerm('${encodeURIComponent(t.code)}')">Sửa</button></div><pre style="white-space:pre-wrap;max-height:180px;overflow:auto">${E(t.body)}</pre></div>`).join("")}`;
}
window.editTerm=encoded=>{const code=decodeURIComponent(encoded),t=state.admin.terms.find(x=>x.code===code);if(!t)return;modal(`<h2>${E(code)}</h2><div class="field"><label>Tên</label><input id="termName" value="${E(t.name)}"></div><div class="field"><label>Phiên bản</label><input id="termVersion" value="${E(t.version)}"></div><div class="field"><label>Phạm vi</label><input id="termScope" value="${E(t.scope||"")}"></div><div class="field"><label>Nội dung</label><textarea id="termBody" style="min-height:360px">${E(t.body)}</textarea></div><button class="primary" onclick="saveTerm('${encodeURIComponent(code)}')">Lưu phiên bản</button>`)}
window.saveTerm=encoded=>{const code=decodeURIComponent(encoded);api(`/api/admin/terms/${encodeURIComponent(code)}`,{method:"PUT",body:{name:document.getElementById("termName").value,version:document.getElementById("termVersion").value,scope:document.getElementById("termScope").value,body:document.getElementById("termBody").value,status:"published"}}).then(()=>{closeModal();toast("Đã cập nhật điều khoản.");adminTerms(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminTeaching(main){
  const [ppl,ts]=await Promise.all([api("/api/admin/people"),api("/api/admin/teaching-scopes")]);state.admin.people=ppl.items||[];state.admin.teaching=ts.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Phạm vi TNV Dạy học</h1><button class="primary" onclick="addTeachingScope()">+ Thêm phạm vi</button></div><div class="notice">Các phạm vi chuẩn: Lớp 9, Lớp 10, Lớp 11, Lớp 12, A1–A2, B1–B2, Tiếng Anh Giao tiếp, Từ vựng. Được nhận làm TNV không đồng nghĩa được phép dạy tất cả phạm vi.</div><div class="card table-scroll"><table><thead><tr><th>Nhân sự</th><th>Phạm vi</th><th>Trạng thái</th><th>Ghi chú đánh giá</th><th></th></tr></thead><tbody>${state.admin.teaching.map(x=>`<tr><td>${E(x.full_name)}<br><span class="small">${E(x.email||"")}</span></td><td><b>${E(x.scope)}</b></td><td><span class="status">${E(x.status)}</span></td><td>${E(x.assessment_note||"")}</td><td><button class="secondary" onclick="editTeachingScope('${E(x.id)}')">Đánh giá</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.addTeachingScope=()=>{const person=prompt("ID hồ sơ nhân sự:");if(!person)return;const scope=prompt("Phạm vi (Lớp 9/10/11/12/A1–A2/B1–B2/Giao tiếp/Từ vựng):");if(!scope)return;api("/api/admin/teaching-scopes",{method:"POST",body:{person_id:Number(person),scope,status:"Đang đánh giá"}}).then(()=>{toast("Đã thêm phạm vi.");adminTeaching(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}
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
window.createForm=()=>{const name=prompt("Tên biểu mẫu:");if(!name)return;const idForm=prompt("ID biểu mẫu (vd: scholarship):");if(!idForm)return;const prefix=prompt("Tiền tố mã hồ sơ (vd: SFEC-HB):","SFEC-FORM");if(!prefix)return;const cfg={id:idForm,name,prefix,description:"",audience:"public",term_codes:["PRIVACY/SFEC"],sections:[{title:"Thông tin",fields:[{key:"full_name",label:"Họ và tên",type:"text",required:true},{key:"email",label:"✉️ Email",type:"email",required:true}]}]};api("/api/admin/forms",{method:"POST",body:{id:idForm,name,prefix,description:"",audience:"public",config:cfg}}).then(()=>{toast("Đã tạo biểu mẫu.");adminForms(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminNews(main){
  const d=await api("/api/admin/content/news");state.admin.news=d.items||[];
  main.innerHTML=`<div class="toolbar"><div style="margin-right:auto"><div class="section-kicker">NỘI DUNG</div><h1 style="margin:4px 0">Bản tin & CMS</h1><p class="muted">Soạn bài theo đoạn; hệ thống giữ nguyên xuống dòng khi xuất bản.</p></div><button class="primary" onclick="newsEditor()">Tạo bản tin</button></div><div class="card table-scroll"><table><thead><tr><th>Tiêu đề</th><th>Slug</th><th>Trạng thái</th><th>Ngày xuất bản</th><th></th></tr></thead><tbody>${state.admin.news.map(n=>`<tr><td><b>${E(n.title)}</b><br><span class="small muted">${E(newsExcerpt(n.body,90))}</span></td><td>${E(n.slug||"")}</td><td><span class="status">${E(n.status||"")}</span></td><td>${fmt(n.published_at)}</td><td><button class="secondary" onclick="newsEditor('${E(n.id)}')">Sửa</button> <button class="danger" onclick="deleteGeneric('news','${E(n.id)}')">Xóa</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.newsEditor=id=>{const n=(state.admin.news||[]).find(x=>String(x.id)===String(id))||{};modal(`<button class="ghost" onclick="closeModal()">Đóng</button><div class="section-kicker">BẢN TIN & CMS</div><h2>${id?'Chỉnh sửa bản tin':'Tạo bản tin'}</h2><form id="newsEditorForm"><div class="field"><label>Tiêu đề</label><input name="title" required value="${E(n.title||'')}"></div><div class="field"><label>Slug</label><input name="slug" value="${E(n.slug||'')}"></div><div class="field"><label>Nội dung</label><textarea name="body" class="news-editor" required placeholder="Viết nội dung tại đây. Nhấn Enter để xuống dòng; cách một dòng để tạo đoạn mới.">${E(n.body||'')}</textarea><div class="small muted">Xuống dòng và khoảng cách giữa các đoạn sẽ được giữ khi đăng.</div></div><div class="row2"><div class="field"><label>Trạng thái</label><select name="status"><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="hidden">Ẩn</option></select></div><div class="field"><label>Ngày xuất bản</label><input name="published_at" type="datetime-local" value="${n.published_at?String(n.published_at).slice(0,16):''}"></div></div><div class="actions"><button class="primary">${id?'Lưu thay đổi':'Tạo bản tin'}</button><button type="button" class="secondary" onclick="previewNewsEditor()">Xem trước</button></div><div id="newsPreview"></div></form>`);document.querySelector('#newsEditorForm [name="status"]').value=n.status||'draft';document.getElementById('newsEditorForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target).entries());try{await api(id?`/api/admin/content/news/${encodeURIComponent(id)}`:'/api/admin/content/news',{method:id?'PUT':'POST',body:b});closeModal();toast(id?'Đã cập nhật bản tin.':'Đã tạo bản tin.');adminNews(document.getElementById('adminMain'))}catch(er){toast(errorText(er),'bad')}}}
window.previewNewsEditor=()=>{const f=document.getElementById('newsEditorForm'),box=document.getElementById('newsPreview');box.innerHTML=`<article class="news-detail preview"><h2>${E(f.title.value||'Tiêu đề bản tin')}</h2><div class="news-content">${newsBody(f.body.value)}</div></article>`}

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
function adminTitle(t){return {news:"Tin tức & CMS",classes:"Lớp học",events:"Sự kiện",documents:"📚 Kho văn bản",tasks:"📌 Nhiệm vụ"}[t]||t}
function displayFields(t){return {news:["title","slug","status","published_at"],classes:["unit_code","title","level","status","capacity"],events:["unit_code","title","start_at","status"],units:["code","name","unit_type","manager_name","status"],documents:["code","doc_type","title","visibility","status"],tasks:["title","assigned_to","unit_code","status","priority","due_at"]}[t]||[]}
window.attendanceTool=async()=>{const classId=prompt("ID lớp (vd SFEC-L9):");if(!classId)return;try{const d=await api(`/api/admin/class-enrollments?class_id=${encodeURIComponent(classId)}`);modal(`<h2>Điểm danh ${E(classId)}</h2>${(d.items||[]).map(x=>`<div class="card"><b>${E(x.full_name)}</b> — ${E(x.email||"")}<div class="actions"><button class="secondary" onclick="markAttendance('${E(classId)}',${x.id},'Có mặt')">Có mặt</button><button class="secondary" onclick="markAttendance('${E(classId)}',${x.id},'Có phép')">Có phép</button><button class="danger" onclick="markAttendance('${E(classId)}',${x.id},'Vắng')">Vắng</button></div></div>`).join("")||"<p>Chưa có học viên.</p>"}`)}catch(e){toast(errorText(e),"bad")}}
window.markAttendance=(classId,enrollmentId,status)=>api("/api/admin/attendance",{method:"POST",body:{class_id:classId,enrollment_id:enrollmentId,session_date:new Date().toISOString().slice(0,10),status}}).then(()=>toast("Đã điểm danh.")).catch(e=>toast(errorText(e),"bad"))
window.checkinTool=()=>{const code=prompt("Mã check-in:");if(!code)return;api("/api/admin/event-checkin",{method:"POST",body:{checkin_code:code}}).then(()=>toast("Check-in thành công.")).catch(e=>toast(errorText(e),"bad"))}

async function adminCertificates(main){
  const d=await api("/api/admin/certificates");state.admin.certificates=d.items||[];
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">GCN & GXN</h1><button class="primary" onclick="requestCertificate()">+ Đề nghị cấp</button></div>
  <div class="notice">Quy trình: <b>Ban Nhân sự đề nghị → Văn phòng kiểm tra → Thư ký Ban Chủ nhiệm phê duyệt → Văn phòng cấp số, vào sổ, lưu và phát hành.</b></div>
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

async function adminStudio(main){
  const d=await api("/api/admin/site-pages");
  state.admin.sitePages=d.items||[];
  const names={home:"Trang chủ",about:"Giới thiệu",journey:"Hành trình",values:"Định hướng & Giá trị",organization:"Cơ cấu & Hệ sinh thái"};
  main.innerHTML=`<div class="admin-hero-pro"><div><span class="pill">SFEC WEBSITE STUDIO</span><h1>Điều khiển website như một CMS thật</h1><p>Chỉnh nội dung, SEO, ảnh bìa, xuất bản/nháp và khôi phục phiên bản cũ ngay trong trang quản trị.</p></div><div class="actions"><button class="primary" onclick="openSitePage('home')">Sửa Trang chủ</button><button class="secondary" onclick="location.hash='admin/media'">Mở Media</button></div></div>
  <div class="studio-grid">${state.admin.sitePages.map(x=>`<button class="studio-page-card" onclick="openSitePage('${E(x.slug)}')"><span class="studio-status ${E(x.status)}">${E(x.status)}</span><b>${E(names[x.slug]||x.title)}</b><small>${E(x.title)}</small><em>Cập nhật: ${fmt(x.updated_at)}</em></button>`).join("")}</div>
  <div class="card pro-tip"><b>⚡ Workflow nhanh</b><span>Upload ảnh → chọn ảnh trong Media → chèn vào nội dung → xem Preview → Publish. Mỗi lần lưu hệ thống tự tạo phiên bản để có thể khôi phục.</span></div>`;
}
window.openSitePage=async slug=>{
  try{
    const d=await api(`/api/admin/site-pages/${encodeURIComponent(slug)}`),x=d.item;
    state.admin.currentSitePage=x;state.admin.currentSiteRevisions=d.revisions||[];
    const media=await api("/api/admin/media").catch(()=>({items:[]}));state.admin.media=media.items||[];
    mainSiteEditor(slug,x,d.revisions||[]);
  }catch(e){toast(errorText(e),"bad")}
}
function mainSiteEditor(slug,x,revisions){
  const main=document.getElementById("adminMain");
  main.innerHTML=`<div class="toolbar"><button class="ghost" onclick="adminStudio(document.getElementById('adminMain'))">← Website Studio</button><div style="margin-left:auto" class="actions"><button class="secondary" onclick="previewSitePage()">Preview</button><button class="primary" onclick="saveSitePage('${E(slug)}')">Lưu thay đổi</button></div></div>
  <div class="cms-editor-shell"><section class="cms-editor-main"><div class="card"><div class="editor-head"><div><span class="pill">${E(slug)}</span><h1>${E(x.title)}</h1></div><select id="cmsStatus"><option value="inherit" ${x.status==='inherit'?'selected':''}>Dùng nội dung mặc định</option><option value="draft" ${x.status==='draft'?'selected':''}>Bản nháp</option><option value="published" ${x.status==='published'?'selected':''}>Đã xuất bản</option></select></div>
  <div class="grid2"><div class="field"><label>Tiêu đề trang</label><input id="cmsTitle" value="${E(x.title)}"></div><div class="field"><label>Kicker / nhãn trên tiêu đề</label><input id="cmsKicker" value="${E(x.kicker||'')}"></div></div>
  <div class="editor-toolbar"><button onclick="cmsWrap('<h2>','</h2>')">H2</button><button onclick="cmsWrap('<h3>','</h3>')">H3</button><button onclick="cmsWrap('<b>','</b>')"><b>B</b></button><button onclick="cmsWrap('<p>','</p>')">P</button><button onclick="cmsWrap('<blockquote>','</blockquote>')">Quote</button><button onclick="insertCmsLink()">Link</button><button onclick="pickCmsImage()">+ Ảnh</button></div>
  <div class="field"><label>Nội dung HTML</label><textarea id="cmsBody" class="cms-code" oninput="cmsLivePreview()">${E(x.body_html||'')}</textarea><div class="small muted">Bạn có thể dùng HTML cơ bản. Ảnh được lưu trên R2 và chèn bằng đường dẫn /api/files/...</div></div></div>
  <div class="card"><h2>SEO & chia sẻ</h2><div class="field"><label>SEO title</label><input id="cmsSeoTitle" value="${E(x.seo_title||'')}"></div><div class="field"><label>SEO description</label><textarea id="cmsSeoDesc">${E(x.seo_description||'')}</textarea></div><div class="field"><label>Ảnh bìa / Cover file ID</label><div class="toolbar"><input id="cmsCover" value="${E(x.cover_file_id||'')}" placeholder="media_..."><button class="secondary" onclick="pickCoverImage()">Chọn ảnh</button></div></div></div>
  <div class="card"><h2>Lịch sử phiên bản</h2>${revisions.length?revisions.map(r=>`<div class="revision-row"><div><b>#${r.id} · ${E(r.title)}</b><small>${fmt(r.created_at)} · ${E(r.status)}</small></div><button class="ghost" onclick="restoreSiteRevision('${E(slug)}',${r.id})">Khôi phục</button></div>`).join(''):'<p class="muted">Chưa có phiên bản cũ.</p>'}</div></section>
  <aside class="cms-preview-side"><div class="preview-sticky"><div class="preview-label">LIVE PREVIEW</div><div id="cmsPreview" class="cms-preview"></div></div></aside></div>`;
  cmsLivePreview();
}
window.cmsWrap=(a,b)=>{const t=document.getElementById('cmsBody');const s=t.selectionStart,e=t.selectionEnd,v=t.value;t.value=v.slice(0,s)+a+v.slice(s,e)+b+v.slice(e);t.focus();t.selectionStart=s+a.length;t.selectionEnd=e+a.length+(e-s);cmsLivePreview()}
window.insertCmsLink=()=>{const url=prompt('URL liên kết:','https://');if(!url)return;cmsWrap(`<a href="${E(url)}" target="_blank" rel="noopener">`,'</a>')}
window.cmsLivePreview=()=>{const p=document.getElementById('cmsPreview'),b=document.getElementById('cmsBody');if(p&&b)p.innerHTML=`<div class="section-kicker">${E(document.getElementById('cmsKicker')?.value||'')}</div><h1>${E(document.getElementById('cmsTitle')?.value||'')}</h1><div class="info-copy">${b.value||'<p class="muted">Chưa có nội dung tùy chỉnh.</p>'}</div>`}
window.previewSitePage=()=>{const html=document.getElementById('cmsPreview')?.innerHTML||'';modal(`<div class="cms-full-preview"><button class="ghost" onclick="closeModal()">✕ Đóng</button>${html}</div>`)}
window.saveSitePage=slug=>api(`/api/admin/site-pages/${encodeURIComponent(slug)}`,{method:'PUT',body:{title:document.getElementById('cmsTitle').value,kicker:document.getElementById('cmsKicker').value,body_html:document.getElementById('cmsBody').value,status:document.getElementById('cmsStatus').value,seo_title:document.getElementById('cmsSeoTitle').value,seo_description:document.getElementById('cmsSeoDesc').value,cover_file_id:document.getElementById('cmsCover').value||null}}).then(()=>{toast('Đã lưu trang và tạo revision.');openSitePage(slug)}).catch(e=>toast(errorText(e),'bad'))
window.restoreSiteRevision=(slug,id)=>{if(!confirm('Khôi phục phiên bản này? Nội dung hiện tại sẽ được thay thế.'))return;api(`/api/admin/site-pages/${encodeURIComponent(slug)}/revisions/${id}/restore`,{method:'POST'}).then(()=>{toast('Đã khôi phục phiên bản.');openSitePage(slug)}).catch(e=>toast(errorText(e),'bad'))}
function mediaPicker(mode='insert'){
  const items=state.admin.media||[];
  modal(`<h2>Chọn ảnh từ Media</h2><div class="media-picker">${items.map(m=>`<button onclick="selectCmsMedia('${E(m.id)}','${E(m.url)}','${mode}')"><img src="${E(m.url)}" alt=""><span>${E(m.filename)}</span></button>`).join('')||'<p class="muted">Chưa có ảnh. Hãy upload trong Thư viện Media.</p>'}</div>`)
}
window.pickCmsImage=()=>mediaPicker('insert');window.pickCoverImage=()=>mediaPicker('cover');
window.selectCmsMedia=(id,url,mode)=>{closeModal();if(mode==='cover'){document.getElementById('cmsCover').value=id;return}const alt=prompt('Mô tả ảnh (alt):','')||'';const t=document.getElementById('cmsBody');const snippet=`\n<figure class="cms-figure"><img src="${url}" alt="${E(alt)}" loading="lazy"><figcaption>${E(alt)}</figcaption></figure>\n`;const pos=t.selectionStart||t.value.length;t.value=t.value.slice(0,pos)+snippet+t.value.slice(pos);cmsLivePreview()}

async function adminMedia(main){
  const d=await api('/api/admin/media');state.admin.media=d.items||[];
  main.innerHTML=`<div class="admin-hero-pro compact"><div><span class="pill">MEDIA LIBRARY</span><h1>Ảnh của website</h1><p>Upload JPG, PNG, WEBP, GIF lên R2; ảnh công khai có URL ổn định để dùng cho trang, bản tin và hero.</p></div><button class="primary" onclick="uploadSiteMedia()">+ Tải ảnh lên</button></div><div class="media-grid">${state.admin.media.map(m=>`<article class="media-card"><img src="${E(m.url)}" alt=""><div><b>${E(m.filename)}</b><small>${Math.round((m.size||0)/1024)} KB · ${fmt(m.created_at)}</small><div class="actions"><button class="ghost" onclick="copyMediaUrl('${E(m.url)}')">Copy URL</button><button class="danger" onclick="deleteMedia('${E(m.id)}')">Xóa</button></div></div></article>`).join('')||'<div class="notice">Chưa có ảnh nào.</div>'}</div>`;
}
window.uploadSiteMedia=()=>{modal(`<h2>Tải ảnh lên website</h2><form id="mediaUpload"><div class="drop-upload"><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required><b>Chọn ảnh</b><span>JPG, PNG, WEBP hoặc GIF</span></div><button class="primary">Upload lên R2</button></form>`);document.getElementById('mediaUpload').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);try{await api('/api/admin/media',{method:'POST',body:fd});closeModal();toast('Đã upload ảnh.');adminMedia(document.getElementById('adminMain'))}catch(err){toast(errorText(err),'bad')}}}
window.copyMediaUrl=async url=>{await navigator.clipboard.writeText(location.origin+url);toast('Đã copy URL ảnh.')}
window.deleteMedia=id=>{if(!confirm('Xóa ảnh này khỏi R2? Các trang đang dùng ảnh có thể bị mất ảnh.'))return;api(`/api/admin/files/${encodeURIComponent(id)}`,{method:'DELETE'}).then(()=>{toast('Đã xóa ảnh.');adminMedia(document.getElementById('adminMain'))}).catch(e=>toast(errorText(e),'bad'))}

async function adminFiles(main){
  const d=await api("/api/admin/files");main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">File & Minh chứng</h1><button class="primary" onclick="uploadAdminFile()">+ Upload</button></div><div class="card table-scroll"><table><thead><tr><th>Tệp</th><th>Loại</th><th>Dung lượng</th><th>Quyền</th><th></th></tr></thead><tbody>${(d.items||[]).map(f=>`<tr><td><a href="/api/files/${E(f.id)}" target="_blank">${E(f.filename)}</a></td><td>${E(f.mime)}</td><td>${Math.round((f.size||0)/1024)} KB</td><td>${E(f.visibility)}</td><td><button class="danger" onclick="deleteFile('${E(f.id)}')">Xóa</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.uploadAdminFile=()=>{modal(`<h2>Upload file</h2><form id="upFile"><div class="field"><input name="file" type="file" required></div><div class="check"><input name="public" type="checkbox"><label>Cho phép công khai</label></div><button class="primary">Upload</button></form>`);document.getElementById("upFile").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),fd=new FormData();fd.append("file",f.get("file"));fd.append("visibility",f.get("public")?"public":"private");try{await api("/api/admin/upload",{method:"POST",body:fd});closeModal();toast("Đã upload.");adminFiles(document.getElementById("adminMain"))}catch(err){toast(errorText(err),"bad")}}}
window.deleteFile=idf=>{if(!confirm("Xóa file?"))return;api(`/api/admin/files/${encodeURIComponent(idf)}`,{method:"DELETE"}).then(()=>{toast("Đã xóa.");adminFiles(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))}

async function adminEmail(main){
  const [t,l,status]=await Promise.all([api("/api/admin/email-templates"),api("/api/admin/email-logs"),api("/api/admin/email-status")]);state.admin.emailTemplates=t.items||[];
  const providerLabel=status.provider==="resend"?"Resend đã cấu hình":status.provider==="cloudflare-binding"?"Cloudflare Email binding đã cấu hình":"Chưa cấu hình nhà cung cấp gửi thư";
  main.innerHTML=`<div class="toolbar"><h1 style="margin-right:auto">Email tự động</h1><button class="primary" onclick="testSfecEmail()">Gửi email thử</button></div>
  <div class="notice"><b>${E(providerLabel)}</b><br>Địa chỉ gửi: ${E(status.from||"")} · Trả lời đến: ${E(status.reply_to||"")}<br>Font mẫu email bắt buộc: <b style="font-family:'Times New Roman',Times,serif">Times New Roman</b>. Khóa API chỉ cấu hình bằng secret ở backend, không nhập tại đây.</div>
  <div class="card"><h2>Cấu hình nhận thông báo nội bộ</h2><div class="field"><label>Email nhận cảnh báo vận hành</label><input id="emailAlertRecipient" type="email" value="${E(status.alert_recipient||"")}"></div><button class="secondary" onclick="saveEmailCenterSettings()">Lưu cấu hình email</button></div>
  <h2 class="section-title">Mẫu email & sự kiện</h2>${state.admin.emailTemplates.map(x=>`<div class="card" style="margin:8px 0"><div class="toolbar"><div style="flex:1"><b>${E(x.key)}</b><div class="small muted">${E(x.subject_template)}</div></div><label class="check"><input type="checkbox" ${x.enabled?"checked":""} onchange="toggleEmailTemplate('${E(x.key)}',this.checked)"> Bật</label><button class="secondary" onclick="editEmailTemplate('${E(x.key)}')">Sửa mẫu</button></div></div>`).join("")}
  <h2 class="section-title">Nhật ký gửi email</h2><div class="card table-scroll"><table><thead><tr><th>Đến</th><th>Mẫu/sự kiện</th><th>Trạng thái</th><th>Thời gian</th><th>Lỗi</th><th>Thao tác</th></tr></thead><tbody>${(l.items||[]).slice(0,300).map(x=>`<tr><td>${E(x.to_email)}</td><td>${E(x.template_key||"")}<br>${E(x.subject||"")}</td><td><span class="status">${E(x.status)}</span></td><td>${fmt(x.created_at)}</td><td>${E(x.error||"")}</td><td>${x.retryable?`<button class="secondary" onclick="retrySfecEmail(${Number(x.id)})">Thử gửi lại</button>`:"—"}</td></tr>`).join("")}</tbody></table></div>`;
}
window.testSfecEmail=()=>{modal(`<h2>Gửi email thử</h2><p class="muted">Chỉ gửi một email thử đến địa chỉ bà nhập.</p><form id="emailTestForm"><div class="field"><label>Email nhận thử</label><input name="to" type="email" required placeholder="ten@example.com"></div><button class="primary">Gửi thử</button></form>`);document.getElementById("emailTestForm").onsubmit=async e=>{e.preventDefault();const to=new FormData(e.target).get("to");try{const r=await api("/api/admin/email-test",{method:"POST",body:{to}});closeModal();toast(r.ok?"Nhà cung cấp đã chấp nhận email thử.":"Chưa gửi được email thử.",r.ok?"good":"bad");await adminEmail(document.getElementById("adminMain"))}catch(err){toast(errorText(err),"bad")}}}
window.saveEmailCenterSettings=async()=>{try{await api("/api/admin/email-settings",{method:"PUT",body:{alert_recipient:document.getElementById("emailAlertRecipient").value.trim()}});toast("Đã lưu địa chỉ nhận cảnh báo.");await adminEmail(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}
window.toggleEmailTemplate=async(key,enabled)=>{const x=state.admin.emailTemplates.find(t=>t.key===key);if(!x)return;try{await api(`/api/admin/email-templates/${encodeURIComponent(key)}`,{method:"PUT",body:{subject_template:x.subject_template,html_template:x.html_template,text_template:x.text_template,enabled}});toast(enabled?"Đã bật sự kiện email.":"Đã tắt sự kiện email.");await adminEmail(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}
window.editEmailTemplate=key=>{const x=state.admin.emailTemplates.find(t=>t.key===key);if(!x)return;modal(`<h2>Chỉnh mẫu email: ${E(key)}</h2><div class="field"><label>Tiêu đề</label><input id="etSubject" value="${E(x.subject_template)}"></div><div class="field"><label>Nội dung HTML — font Times New Roman được tự áp dụng khi gửi</label><textarea id="etHtml" style="min-height:320px;font-family:'Times New Roman',Times,serif">${E(x.html_template)}</textarea></div><div class="field"><label>Nội dung văn bản thuần</label><textarea id="etText" style="min-height:140px;font-family:'Times New Roman',Times,serif">${E(x.text_template||"")}</textarea></div><label class="check"><input id="etEnabled" type="checkbox" ${x.enabled?"checked":""}> Bật mẫu/sự kiện này</label><button class="primary" onclick="saveEmailTemplate('${E(key)}')">Lưu mẫu</button>`)}
window.saveEmailTemplate=key=>api(`/api/admin/email-templates/${encodeURIComponent(key)}`,{method:"PUT",body:{subject_template:document.getElementById("etSubject").value,html_template:document.getElementById("etHtml").value,text_template:document.getElementById("etText").value,enabled:document.getElementById("etEnabled").checked}}).then(()=>{closeModal();toast("Đã lưu mẫu email.");adminEmail(document.getElementById("adminMain"))}).catch(e=>toast(errorText(e),"bad"))
window.retrySfecEmail=async id=>{if(!confirm("Thử gửi lại email này? Chỉ gửi lại nội dung đã lưu an toàn trong nhật ký."))return;try{const r=await api(`/api/admin/email-logs/${id}/retry`,{method:"POST",body:{}});toast(r.ok?"Nhà cung cấp đã chấp nhận gửi lại.":"Gửi lại thất bại: "+(r.error||"không rõ lỗi"),r.ok?"good":"bad");await adminEmail(document.getElementById("adminMain"))}catch(e){toast(errorText(e),"bad")}}

async function adminModules(main){
  const d=await api("/api/admin/modules");state.admin.modules=d.items||[];
  main.innerHTML=`<h1>Quản lý Modules</h1><p class="muted">Bật/tắt chức năng theo nhu cầu mà không phải tạo lại ZIP.</p><div class="card">${state.admin.modules.map(m=>`<div class="check"><input type="checkbox" data-module="${E(m.key)}" ${m.enabled?"checked":""}><label><b>${E(m.name)}</b> — ${E(m.description||"")} <span class="small muted">(${E(m.category)})</span></label></div>`).join("")}<button class="primary" onclick="saveModules()">Lưu Modules</button></div>`;
}
window.saveModules=()=>{const items=state.admin.modules.map(m=>({key:m.key,enabled:document.querySelector(`[data-module="${CSS.escape(m.key)}"]`).checked}));api("/api/admin/modules",{method:"PUT",body:{items}}).then(async()=>{toast("Đã cập nhật Modules.");await loadConfig()}).catch(e=>toast(errorText(e),"bad"))}

async function adminSettings(main){
  const [d,emailStatus]=await Promise.all([api("/api/admin/settings"),api("/api/admin/email-status").catch(()=>({provider:"unknown"}))]),map=Object.fromEntries((d.items||[]).map(x=>[x.key,x.value]));state.admin.settings=map;
  const emailProviderLabel=emailStatus.provider==="resend"?"Resend đã cấu hình":emailStatus.provider==="cloudflare-binding"?"Cloudflare Email binding đã cấu hình":"Chưa xác định / chưa cấu hình";
  main.innerHTML=`<h1>Cài đặt hệ thống</h1><div class="card"><h2>Email hệ thống</h2><p>Trạng thái nhà cung cấp: <b>${E(emailProviderLabel)}</b></p><p>Địa chỉ gửi hiện tại: <b>${E(emailStatus.from||"")}</b></p><div class="field"><label>Email nhận cảnh báo vận hành</label><input id="sEmailAlertRecipient" type="email" value="${E(map.email_internal_alert_recipient||"sfec@skyfirst.io.vn")}"></div><p class="small muted">Khóa API chỉ cấu hình qua Cloudflare Worker Secrets; không lưu khóa bí mật trong database.</p><a class="secondary" href="#admin/email">Mở quản lý Email tự động</a></div><div class="card"><div class="field"><label>Tên hệ thống</label><input id="sAppName" value="${E(map.app_name||"")}"></div><div class="field"><label>Email nhận toàn bộ đăng ký</label><input id="sReceiver" value="${E(map.receiver_email||"sfec@skyfirst.io.vn")}"></div><div class="field"><label>Hotline/Zalo</label><input id="sHotline" value="${E(map.hotline||"0924 910 210")}"></div><div class="field"><label>Website</label><input id="sWebsite" value="${E(map.website||"")}"></div><div class="field"><label>Châm ngôn</label><input id="sSlogan" value="${E(map.brand_slogan||"")}"></div><div class="field"><label>Tiêu đề Hero</label><input id="sHeroTitle" value="${E(map.hero_title||"Học tiếng Anh. Kết nối cộng đồng. Vươn cao cùng SFEC.")}"></div><div class="field"><label>Mô tả Hero</label><textarea id="sHeroText">${E(map.hero_text||"Cổng học tập và hoạt động dành riêng cho The Sky First English Club.")}</textarea></div><div class="field"><label>Ảnh bìa Hero (URL hoặc /api/files/...)</label><input id="sHeroCover" value="${E(map.hero_cover_url||"/assets/sfec-cover.png")}"></div><div class="field"><label>Thời hạn lưu hồ sơ không phù hợp (ngày)</label><input id="sRetention" type="number" value="${E(map.rejected_application_retention_days||365)}"></div><div class="check"><input id="sMaintenance" type="checkbox" ${map.maintenance_mode?"checked":""}><label>Bật chế độ bảo trì trang công khai</label></div><button class="primary" onclick="saveSettings()">Lưu cài đặt</button></div>`;
}
window.saveSettings=()=>api("/api/admin/settings",{method:"PUT",body:{items:{app_name:document.getElementById("sAppName").value,receiver_email:document.getElementById("sReceiver").value,hotline:document.getElementById("sHotline").value,website:document.getElementById("sWebsite").value,brand_slogan:document.getElementById("sSlogan").value,hero_title:document.getElementById("sHeroTitle").value,hero_text:document.getElementById("sHeroText").value,hero_cover_url:document.getElementById("sHeroCover").value,rejected_application_retention_days:Number(document.getElementById("sRetention").value)||365,maintenance_mode:document.getElementById("sMaintenance").checked,email_internal_alert_recipient:document.getElementById("sEmailAlertRecipient")?.value.trim()||"sfec@skyfirst.io.vn"}}}).then(async()=>{toast("Đã lưu cài đặt.");await loadConfig()}).catch(e=>toast(errorText(e),"bad"))

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
    MEMBER_ACCESS_NOT_GRANTED:"Tài khoản này chưa được SFEC cấp quyền Thành viên.",
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
  const hash=(location.hash||"#home").slice(1),parts=hash.split("/"),[route,param]=parts;
  try{
    if(route==="home")return renderHome();
    if(["about","journey","values","organization"].includes(route))return renderInfoPage(route);
    if(route==="forms")return renderForms();
    if(route==="form")return renderForm(decodeURIComponent(param||""));
    if(route==="classes")return renderClasses();
    if(route==="events")return renderEvents();
    if(route==="units")return renderHome();
    if(route==="news")return renderNews(parts[1]||null);
    if(route==="lookup")return renderLookup();
    if(route==="contact")return renderContact();
    if(route==="terms")return renderPolicyPage("terms");
    if(route==="privacy")return renderPolicyPage("privacy-public");
    if(route==="login")return renderLogin();
    if(route==="portal")return renderPortal();
    if(route==="admin")return renderAdmin();
    location.hash="home";
  }catch(err){app.innerHTML=`<div class="notice bad">${E(errorText(err))}</div>`}
}

window.addEventListener("hashchange",router);
(async()=>{
  await loadConfig();await loadMe();await handleQueryActions();
  if(state.config.maintenance_mode&&!state.user&&!location.hash.startsWith("#login")){app.innerHTML=`<div class="form-wrap"><div class="card"><img src="/assets/sfec-logo.png" style="width:90px"><h1>SFEC đang bảo trì</h1><p class="muted">Hệ thống tạm thời bảo trì. Quản trị viên vẫn có thể đăng nhập.</p><a class="primary" href="#login">Đăng nhập Quản trị</a></div></div>`;return}
  await router();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
})();
