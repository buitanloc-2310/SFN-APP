const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function parseCttTime(value){
  const raw=String(value??'').trim();if(!raw)return NaN;
  if(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw))return Date.parse(raw);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return Date.parse(`${raw}T00:00:00+07:00`);
  const normalized=raw.includes('T')?raw:raw.replace(' ','T');
  return Date.parse(`${normalized}+07:00`);
}
const fmt=d=>{const ms=parseCttTime(d);return Number.isFinite(ms)?new Date(ms).toLocaleString(getLang()==='en'?"en-GB":"vi-VN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}):"—";};
const fmtVnd=n=>{const num=Number(n);if(!Number.isFinite(num))return getLang()==='en'?"No public data":"Chưa có dữ liệu";return new Intl.NumberFormat("vi-VN").format(Math.round(num))+(getLang()==='en'?" VND":" đồng");};
const api=async(path,options={})=>{const r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.headers||{})}});const ct=r.headers.get("content-type")||"";const d=ct.includes("application/json")?await r.json():await r.text();if(!r.ok){const e=new Error(d?.message||d?.error||`HTTP ${r.status}`);e.status=r.status;e.data=d;throw e}return d};
const event=(name,meta={})=>fetch('/api/public/analytics',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event:name,route:location.pathname,device_class:innerWidth<700?'mobile':innerWidth<1100?'tablet':'desktop',...meta})}).catch(()=>{});
const icon=n=>({verify:'✓',case:'⌁',form:'▤',program:'◫',event:'▦',resource:'▤',news:'◧',unit:'◎',search:'⌕',support:'?',shield:'◇',sponsorship:'♡',cms_page:'▤'}[n]||'•');
function statusClass(s=''){s=String(s).toLowerCase();return s.includes('thu hồi')||s.includes('revoked')?'bad':s.includes('thay thế')||s.includes('supersed')?'warn':s.includes('xác thực')||s.includes('issued')||s.includes('hoàn tất')||s.includes('có hiệu lực')?'good':''}
function normalizeBrandString(value){
  const protectedParts=[];
  let text=String(value??'');
  // Never rewrite email addresses or hostnames, even when their local/domain part
  // contains the word skyfirst (for example the protected root account mailbox).
  const protect=match=>{const token=`\uE000${protectedParts.length}\uE001`;protectedParts.push(match);return token;};
  text=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,protect);
  text=text.replace(/(?:[a-z0-9-]+\.)*skyfirst\.io\.vn/gi,protect);
  text=text.replace(/\bsky\s*first(?:\s+network)?\b/gi,'Sky First');
  text=text.replace(/\bskyfirst\b/gi,'Sky First');
  return text.replace(/\uE000(\d+)\uE001/g,(_,i)=>protectedParts[Number(i)]??_);
}
function normalizeVisibleBrand(root=document.body){
  if(!root||typeof document.createTreeWalker!=='function')return;
  const skipTags=new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','NOSCRIPT']);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    let p=node.parentElement;
    while(p&&p!==root){if(skipTags.has(p.tagName)||p.isContentEditable)return NodeFilter.FILTER_REJECT;p=p.parentElement;}
    const next=normalizeBrandString(node.nodeValue);
    return next!==node.nodeValue?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const changed=[];while(walker.nextNode())changed.push(walker.currentNode);
  for(const node of changed)node.nodeValue=normalizeBrandString(node.nodeValue);
  if(root.querySelectorAll){
    root.querySelectorAll('[aria-label],[title],[alt],[placeholder]').forEach(el=>{
      for(const attr of ['aria-label','title','alt','placeholder']){
        if(!el.hasAttribute(attr))continue;const old=el.getAttribute(attr),next=normalizeBrandString(old);if(next!==old)el.setAttribute(attr,next);
      }
    });
  }
}

let cachedPublicConfig = null;
async function ensurePublicConfig() {
  if (cachedPublicConfig) return cachedPublicConfig;
  try {
    cachedPublicConfig = await api('/api/config');
    applyPublicConfigToDom(cachedPublicConfig);
  } catch {}
  return cachedPublicConfig || {};
}

function applyPublicConfigToDom(cfg = {}) {
  if (!cfg || typeof cfg !== 'object') return;
  if (cfg.i18n_overrides && typeof cfg.i18n_overrides === 'object') {
    if (cfg.i18n_overrides.vi) Object.assign(I18N.vi, cfg.i18n_overrides.vi);
    if (cfg.i18n_overrides.en) Object.assign(I18N.en, cfg.i18n_overrides.en);
  }
  const ds = cfg.design_system || {};
  const rootStyle = document.documentElement.style;
  if (ds.primary_color) rootStyle.setProperty('--dip-blue', ds.primary_color);
  if (ds.navy_color) rootStyle.setProperty('--dip-navy', ds.navy_color);
  if (ds.accent_color) rootStyle.setProperty('--dip-accent', ds.accent_color);

  // Module visibility on mainNav
  if (Array.isArray(cfg.modules) && cfg.modules.length) {
    const enabledSet = new Set(cfg.modules.filter(m => Number(m.enabled) !== 0).map(m => m.key));
    document.querySelectorAll('#mainNav [data-module-nav]').forEach(el => {
      const modKey = el.getAttribute('data-module-nav');
      const existsInTable = cfg.modules.some(m => m.key === modKey);
      el.hidden = existsInTable && !enabledSet.has(modKey);
    });
  }

  // Pre-maintenance or read-only operational notice banner
  const bannerEl = document.getElementById('operationalNoticeBanner');
  const op = cfg.operational_state || {};
  const isEn = getLang() === 'en';
  if (bannerEl) {
    if (op.is_read_only) {
      bannerEl.style.display = 'block';
      bannerEl.innerHTML = isEn
        ? '<b>Read-Only Mode Active:</b> Public lookups and verification are operating normally; new form submissions and payment intents are temporarily paused for data review.'
        : '<b>Chế độ Chỉ đọc (Read-only):</b> Chức năng xem và tra cứu hoạt động bình thường; việc gửi biểu mẫu và tạo giao dịch mới tạm thời khóa để rà soát dữ liệu.';
    } else if (op.show_pre_banner && (op.pre_banner_vi || op.pre_banner_en)) {
      bannerEl.style.display = 'block';
      bannerEl.innerHTML = `<b>${isEn ? 'Scheduled Maintenance Notice:' : 'Thông báo bảo trì định kỳ:'}</b> ${esc(isEn ? (op.pre_banner_en || op.pre_banner_vi) : (op.pre_banner_vi || op.pre_banner_en))}`;
    } else {
      bannerEl.style.display = 'none';
      bannerEl.innerHTML = '';
    }
  }

  // Bilingual footer & contact text
  const fd = document.getElementById('footerDescription');
  if (fd) fd.textContent = isEn ? (cfg.footer_description_en || t('footer_desc')) : (cfg.footer_description || t('footer_desc'));
  const fc = document.getElementById('footerCopyright');
  if (fc) fc.textContent = isEn ? (cfg.footer_copyright_en || t('footer_copyright')) : (cfg.footer_copyright || t('footer_copyright'));
  const fcit = document.getElementById('footerCitationNotice');
  if (fcit) fcit.textContent = isEn ? (cfg.footer_citation_notice_en || t('footer_citation_notice')) : (cfg.footer_citation_notice || t('footer_citation_notice'));
}

function setMeta(title,desc){
  const isEn = getLang() === 'en';
  const suffix = isEn ? 'Sky First Digital Information System' : 'Hệ thống Thông tin Số Sky First';
  document.title=`${normalizeBrandString(title)} — ${suffix}`;
  const cleanDesc = normalizeBrandString(desc || (isEn ? 'Sky First Digital Information System (app.skyfirst.io.vn).' : 'Hệ thống Thông tin Số Sky First (Sky First Digital Information System).'));
  document.querySelector('meta[name="description"]')?.setAttribute('content', cleanDesc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', cleanDesc);
  const base = 'https://app.skyfirst.io.vn';
  const cleanPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/, '');
  const canonUrl = `${base}${cleanPath}`;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonUrl);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonUrl);
  document.getElementById('hreflangVi')?.setAttribute('href', canonUrl);
  document.getElementById('hreflangEn')?.setAttribute('href', `${canonUrl}?lang=en`);
  document.getElementById('hreflangDefault')?.setAttribute('href', canonUrl);
}
function sectionHead(kicker,title,desc){return `<div class="dip-section-head"><div><span class="section-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div></div>`}
function empty(msg){return `<div class="dip-empty"><span>◇</span><p>${esc(msg)}</p></div>`}
function jsonObject(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value||'{}')}catch{return {}}}
function firstText(obj,keys){for(const key of keys){const v=obj?.[key];if(typeof v==='string'&&v.trim())return v.trim()}return ''}
function isHiddenPublicStatus(status=''){return /(^|\b)(nháp|draft|private|ẩn|đã ẩn|unpublished)(\b|$)/i.test(String(status||''))}
function visiblePublicItems(items=[]){return (items||[]).filter(x=>!isHiddenPublicStatus(x.status))}
function programArtKind(item={}){const t=String(item.title||'').toLowerCase();if(t.includes('reading')||t.includes('đọc'))return 'reading';if(t.includes('listening')||t.includes('nghe'))return 'listening';if(t.includes('speaking')||t.includes('nói'))return 'speaking';return 'program'}
function publicStatusLabel(status){
  const s=String(status||'').trim();
  const en=getLang()==='en';
  if(!s)return en?'Status updating':'Trạng thái đang cập nhật';
  if(/draft|nháp|private|ẩn/i.test(s))return en?'Unpublished':'Chưa công khai';
  if(en){
    const map={'Đang mở đăng ký':'Open for Registration','Đang hoạt động':'Active','Sắp diễn ra':'Upcoming','Đang diễn ra':'Ongoing','Đã kết thúc':'Completed','Có hiệu lực':'Valid / Active','Đã tiếp nhận':'Received','Đang xem xét':'Under Review','Cần bổ sung':'Additional Info Required','Mời phỏng vấn':'Interview Scheduled','Đã duyệt':'Approved','Hoàn tất':'Completed','Không phù hợp':'Not Selected','CÓ HIỆU LỰC':'VALID / ISSUED','ĐÃ THU HỒI':'REVOKED','ĐÃ ĐƯỢC THAY THẾ':'SUPERSEDED','HẾT HIỆU LỰC':'EXPIRED'};
    return map[s]||s;
  }
  return s;
}

const I18N = {
  vi: {
    brand_sub: "HỆ THỐNG THÔNG TIN SỐ",
    nav_home: "Trang chủ",
    nav_about: "Giới thiệu",
    nav_programs: "Chương trình",
    nav_events: "Sự kiện",
    nav_docs: "Tài liệu",
    nav_forms: "Biểu mẫu",
    nav_certs: "Chứng nhận",
    nav_cases: "Hồ sơ",
    nav_sponsorship: "Tài trợ",
    nav_safety: "An toàn",
    nav_support: "Trung tâm Hỗ trợ (/ho-tro)",
    nav_login: "Đăng nhập",
    hero_badge: "HỆ THỐNG THÔNG TIN SỐ · Sky First",
    hero_title_top: "Hệ thống Thông tin Số",
    hero_desc: "Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First.",
    search_placeholder: "Tìm kiếm chương trình, sự kiện, tài liệu, biểu mẫu, chứng nhận...",
    search_btn: "Tìm kiếm",
    quick_label: "Truy cập nhanh:",
    card_prog_title: "Chương trình",
    card_prog_desc: "Khám phá các chương trình giáo dục và cộng đồng",
    card_ev_title: "Sự kiện",
    card_ev_desc: "Cập nhật sự kiện mới nhất",
    card_doc_title: "Tài liệu",
    card_doc_desc: "Tài liệu, hướng dẫn và biểu mẫu",
    card_cert_title: "Chứng nhận",
    card_cert_desc: "Tra cứu chứng nhận đã phát hành",
    card_safe_title: "An toàn",
    card_safe_desc: "Bảo vệ dữ liệu và thông tin cá nhân",
    card_sp_title: "Tài trợ",
    card_sp_desc: "Công khai minh bạch các chương trình tài trợ",
    stat_programs: "Chương trình & sự kiện",
    stat_members: "Thành viên cộng đồng",
    stat_certificates: "Chứng nhận đã phát hành",
    stat_partners: "Đối tác & đơn vị đồng hành",
    stat_sponsorship: "Tổng tiền tài trợ (thực nhận)",
    footer_tagline: "Kết nối tri thức • Lan tỏa giá trị • Vì cộng đồng bền vững",
    footer_desc: "Hệ thống thông tin và dịch vụ số phục vụ tra cứu, đăng ký chương trình, biểu mẫu, chứng nhận và minh bạch hoạt động.",
    footer_col_services: "Chức năng số",
    footer_col_lookup: "Tra cứu & Minh bạch",
    footer_col_contact: "Liên hệ & Hỗ trợ",
    footer_privacy: "Quyền riêng tư & Bảo vệ dữ liệu",
    search_header: "TÌM KIẾM HỆ THỐNG",
    search_eyebrow: "TÌM KIẾM TRÊN HỆ THỐNG THÔNG TIN SỐ · Sky First",
    search_title: "Khám phá thông tin & dịch vụ số",
    search_hint: "Chỉ tìm kiếm trên dữ liệu công khai. Dùng phím ↑ ↓ để chọn, Enter để mở.",
    skip_nav: "Bỏ qua điều hướng",
    footer_brand_title: "Hệ thống Thông tin Số Sky First",
    footer_link_hub: "Trung tâm Tra cứu (/tra-cuu)",
    footer_link_certs: "Chứng nhận (/gcn)",
    footer_link_cases: "Hồ sơ (/ho-so)",
    footer_link_sponsorship: "Tài trợ (/tai-tro)",
    footer_link_safety: "An toàn (/an-toan)",
    footer_sys_email_label: "Hệ thống:",
    footer_contact_email_label: "Liên hệ chung:",
    footer_support_email_label: "Hỗ trợ kỹ thuật:",
    footer_hotline_label: "Hotline:",
    footer_copyright: "© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.",
    footer_citation_notice: "Mọi thông tin trích dẫn phải ghi rõ nguồn và dẫn liên kết đến nội dung gốc khi có thể; không làm sai lệch nội dung và phải tuân thủ quy định về quyền tác giả, sở hữu trí tuệ và bảo vệ dữ liệu cá nhân.",
    footer_admin_login: "Đăng Nhập Quản Trị",
    lookup_policy_1: "Hệ thống chỉ cung cấp các thông tin được phép công khai theo chính sách dữ liệu của Sky First Network. Thông tin cá nhân và dữ liệu nội bộ không thuộc phạm vi công khai phải được bảo vệ, không trả về trong phản hồi tra cứu hoặc hiển thị trên giao diện người dùng.",
    lookup_policy_2: "Kết quả tra cứu phản ánh trạng thái của bản ghi trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First tại thời điểm thực hiện truy vấn."
  },
  en: {
    brand_sub: "DIGITAL INFORMATION SYSTEM",
    nav_home: "Home",
    nav_about: "About",
    nav_programs: "Programs",
    nav_events: "Events",
    nav_docs: "Documents",
    nav_forms: "Forms",
    nav_certs: "Certificates",
    nav_cases: "Records",
    nav_sponsorship: "Sponsorship",
    nav_safety: "Safety",
    nav_support: "Support Center (/ho-tro)",
    nav_login: "Sign In",
    hero_badge: "Sky First Digital Information System",
    hero_title_top: "Digital Information System",
    hero_desc: "Explore, verify, register, and manage educational programs, events, documents, forms, certificates, and community support services of Sky First.",
    search_placeholder: "Search programs, events, documents, forms, certificates...",
    search_btn: "Search",
    quick_label: "Quick access:",
    card_prog_title: "Programs",
    card_prog_desc: "Explore educational and community programs",
    card_ev_title: "Events",
    card_ev_desc: "Latest activity & event updates",
    card_doc_title: "Documents",
    card_doc_desc: "Official PDFs, guides & templates",
    card_cert_title: "Certificates",
    card_cert_desc: "Verify issued certificates by code",
    card_safe_title: "Safety",
    card_safe_desc: "Data protection & incident reporting",
    card_sp_title: "Sponsorship",
    card_sp_desc: "Public financial & sponsorship transparency",
    stat_programs: "Programs & events",
    stat_members: "Community members",
    stat_certificates: "Issued certificates",
    stat_partners: "Partners & units",
    stat_sponsorship: "Received sponsorship",
    footer_tagline: "Connecting Knowledge • Spreading Value • Sustainable Community",
    footer_desc: "Digital information and service platform for program registration, records lookup, credential verification, and public transparency.",
    footer_col_services: "Digital Services",
    footer_col_lookup: "Lookup & Transparency",
    footer_col_contact: "Contact & Support",
    footer_privacy: "Privacy & Data Protection",
    search_header: "SYSTEM SEARCH",
    search_eyebrow: "Search · Sky First Digital Information System",
    search_title: "Discover public information & services",
    search_hint: "Searches public records only. Use ↑ ↓ arrows to navigate, Enter to open.",
    skip_nav: "Skip to main content",
    footer_brand_title: "Sky First Digital Information System",
    footer_link_hub: "Verification Hub (/tra-cuu)",
    footer_link_certs: "Certificates (/gcn)",
    footer_link_cases: "Records (/ho-so)",
    footer_link_sponsorship: "Sponsorship (/tai-tro)",
    footer_link_safety: "Safety (/an-toan)",
    footer_sys_email_label: "System:",
    footer_contact_email_label: "General Contact:",
    footer_support_email_label: "Technical Support:",
    footer_hotline_label: "Hotline:",
    footer_copyright: "© 2026 Sky First Digital Information System. All rights reserved.",
    footer_citation_notice: "All cited information must clearly state the source and link to the original content where possible; content must not be distorted and must comply with copyright, intellectual property, and personal data protection regulations.",
    footer_admin_login: "Admin Login",
    lookup_policy_1: "The system only provides information permitted for public disclosure under Sky First Network's data policy. Personal information and non-public internal data are protected and never returned in lookup responses or displayed on the user interface.",
    lookup_policy_2: "Lookup results reflect the status of the record in the Sky First Digital Information System database at the time of the query."
  }
};

function getLang(){
  try{
    const qLang = new URLSearchParams(location.search).get('lang');
    if (qLang === 'en' || qLang === 'vi') return qLang;
    return localStorage.getItem('sfn_lang')==='en'?'en':'vi';
  }catch{return 'vi'}
}
function t(key){
  const lang=getLang();
  return I18N[lang]?.[key] || I18N.vi[key] || key;
}
function bi(viText, enText) {
  return getLang() === 'en' ? (enText || viText) : viText;
}
function captureFormInputs(root) {
  const snap = {};
  if (!root?.querySelectorAll) return snap;
  root.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => {
    if (el.type === 'file') return;
    snap[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return snap;
}
function restoreFormInputs(root, snap = {}) {
  if (!root?.querySelectorAll || !snap) return;
  for (const [id, val] of Object.entries(snap)) {
    const el = document.getElementById(id);
    if (!el || el.type === 'file') continue;
    if (el.type === 'checkbox') el.checked = Boolean(val);
    else el.value = val;
  }
}
function applyLanguage(lang){
  const code=lang==='en'?'en':'vi';
  try{localStorage.setItem('sfn_lang',code)}catch{}
  document.documentElement.lang=code;
  document.querySelectorAll('.lang-btn').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.lang===code));
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.dataset.i18n;
    if(I18N[code]?.[k]) el.textContent=I18N[code][k];
  });
  const hs=document.getElementById('homeSearch')||document.getElementById('staticSearch');
  if(hs) hs.placeholder=t('search_placeholder');
  if(cachedPublicConfig) applyPublicConfigToDom(cachedPublicConfig);
}

function renderSystemPageCmsZone(routePath) {
  const sysMap = cachedPublicConfig?.system_pages || {};
  const sysPage = sysMap[routePath];
  if (!sysPage) return '';
  const isEn = getLang() === 'en';
  const blocks = isEn && Array.isArray(sysPage.blocks_en) && sysPage.blocks_en.length ? sysPage.blocks_en : (sysPage.blocks || []);
  if (!blocks.length) return '';
  return `<section class="dip-section tight system-cms-zone" data-system-route="${esc(routePath)}"><div class="cms-rendered-page" style="display:grid;gap:16px;max-width:1080px;margin:0 auto;">${blocks.map(renderVisualBlock).join('')}</div></section>`;
}

let sceneSequence=0;
function sceneArt(kind='program'){
  const uid=`sfn-art-${++sceneSequence}`,blue=`url(#${uid}-blue)`,cyan=`url(#${uid}-cyan)`,violet=`url(#${uid}-violet)`;
  let drawing='';
  if(kind==='events') drawing=`<ellipse cx="294" cy="322" rx="174" ry="32" fill="#00d5ff" opacity=".16"/><ellipse cx="294" cy="322" rx="132" ry="21" fill="none" stroke="#39d9ff" stroke-width="3" opacity=".75"/><g transform="rotate(-7 300 205)"><rect x="203" y="94" width="190" height="226" rx="26" fill="#061c49" opacity=".38"/><rect x="192" y="81" width="190" height="226" rx="24" fill="white" stroke="#b2ecff" stroke-width="5"/><rect x="192" y="81" width="190" height="64" rx="22" fill="${blue}"/><rect x="192" y="119" width="190" height="26" fill="${blue}"/><path d="M239 70v30M334 70v30" stroke="#c4f5ff" stroke-width="12" stroke-linecap="round"/><g fill="#b2d9ff"><rect x="220" y="168" width="28" height="26" rx="7"/><rect x="272" y="168" width="28" height="26" rx="7"/><rect x="324" y="168" width="28" height="26" rx="7"/><rect x="220" y="211" width="28" height="26" rx="7"/><rect x="272" y="211" width="28" height="26" rx="7"/><rect x="324" y="211" width="28" height="26" rx="7"/><rect x="220" y="254" width="28" height="26" rx="7"/><rect x="272" y="254" width="28" height="26" rx="7"/></g><rect x="324" y="254" width="28" height="26" rx="7" fill="#05d9b5"/></g><g transform="translate(390 135) rotate(13)"><rect width="75" height="78" rx="18" fill="${violet}" stroke="#bca7ff" stroke-width="2"/><path d="M18 27h39M18 39h28M18 51h34" stroke="white" stroke-width="5" stroke-linecap="round"/></g>`;
  else if(kind==='news') drawing=`<ellipse cx="310" cy="319" rx="185" ry="33" fill="#00c8ff" opacity=".18"/><ellipse cx="310" cy="319" rx="144" ry="22" fill="none" stroke="#a98aff" stroke-width="3"/><circle cx="284" cy="207" r="106" fill="${blue}" opacity=".95"/><circle cx="284" cy="207" r="106" fill="none" stroke="#8aefff" stroke-width="4"/><ellipse cx="284" cy="207" rx="49" ry="106" fill="none" stroke="#b2eaff" stroke-width="2" opacity=".8"/><ellipse cx="284" cy="207" rx="106" ry="35" fill="none" stroke="#b2eaff" stroke-width="2" opacity=".7"/><path d="M183 187Q284 153 385 187M183 227Q284 260 385 227" fill="none" stroke="#b2eaff" stroke-width="2" opacity=".7"/><g transform="translate(350 102) rotate(8)"><rect width="130" height="178" rx="18" fill="white" stroke="#b7ebff" stroke-width="5"/><rect x="17" y="18" width="96" height="12" rx="6" fill="${cyan}"/><rect x="17" y="45" width="96" height="53" rx="9" fill="#d8edff"/><rect x="17" y="113" width="70" height="7" rx="3.5" fill="#9bbce8"/><rect x="17" y="130" width="88" height="7" rx="3.5" fill="#9bbce8"/><rect x="17" y="147" width="57" height="7" rx="3.5" fill="#9bbce8"/></g>`;
  else if(kind==='lookup') drawing=`<ellipse cx="300" cy="322" rx="180" ry="33" fill="#00bfff" opacity=".16"/><ellipse cx="300" cy="322" rx="141" ry="23" fill="none" stroke="#978aff" stroke-width="3"/><g transform="translate(184 75) rotate(-7)"><rect width="194" height="238" rx="23" fill="white" stroke="#b8e6ff" stroke-width="5"/><path d="M34 47h127M34 68h95" stroke="#1684f8" stroke-width="10" stroke-linecap="round"/><rect x="34" y="93" width="126" height="79" rx="12" fill="#e1f4ff"/><path d="M34 194h126M34 213h95" stroke="#aac9e9" stroke-width="8" stroke-linecap="round"/></g><g transform="translate(323 182)"><circle cx="48" cy="48" r="55" fill="${blue}" stroke="#7ee7ff" stroke-width="7"/><circle cx="48" cy="48" r="30" fill="none" stroke="white" stroke-width="8"/><path d="M72 75l34 35" stroke="white" stroke-width="12" stroke-linecap="round"/><path d="M34 46l10 11 23-27" fill="none" stroke="#7af0d6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  else if(kind==='utility') drawing=`<ellipse cx="294" cy="327" rx="190" ry="32" fill="#00c8ff" opacity=".2"/><ellipse cx="294" cy="327" rx="149" ry="22" fill="none" stroke="#a68bff" stroke-width="3"/><g transform="translate(95 92) rotate(-9)"><rect width="135" height="150" rx="24" fill="${blue}" stroke="#78dfff" stroke-width="4"/><path d="M35 36h65M35 52h55M35 68h61" stroke="white" stroke-width="8" stroke-linecap="round"/><path d="M55 101l16 15 31-38" stroke="#7ff2d8" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><g transform="translate(285 63) rotate(9)"><rect width="135" height="150" rx="24" fill="${violet}" stroke="#d3c6ff" stroke-width="4"/><g fill="white"><rect x="27" y="28" width="22" height="22" rx="5"/><rect x="58" y="28" width="22" height="22" rx="5"/><rect x="89" y="28" width="22" height="22" rx="5"/><rect x="27" y="59" width="22" height="22" rx="5"/><rect x="58" y="59" width="22" height="22" rx="5"/><rect x="89" y="59" width="22" height="22" rx="5"/></g></g><g transform="translate(176 211) rotate(6)"><rect width="135" height="112" rx="24" fill="${cyan}" stroke="#91fff0" stroke-width="4"/><path d="M69 24l-26 39h22l-7 28 39-48H74z" fill="white"/></g><g transform="translate(353 221) rotate(-7)"><rect width="135" height="112" rx="24" fill="${blue}" stroke="#80dcff" stroke-width="4"/><path d="M32 26h70M32 43h70M32 60h49M32 77h59" stroke="white" stroke-width="7" stroke-linecap="round"/></g>`;
  else if(kind==='reading') drawing=`<ellipse cx="297" cy="322" rx="170" ry="29" fill="#00cdff" opacity=".2"/><ellipse cx="297" cy="322" rx="136" ry="20" fill="none" stroke="#a28aff" stroke-width="3"/><circle cx="300" cy="220" r="102" fill="${blue}" opacity=".25"/><path d="M133 165Q220 128 296 178V281Q215 235 133 277Z" fill="white" stroke="#7fdfff" stroke-width="6"/><path d="M296 178Q372 128 459 165V277Q377 235 296 281Z" fill="#e4f5ff" stroke="#7fdfff" stroke-width="6"/><path d="M296 179V281M157 193Q222 176 270 204M157 218Q220 201 270 230M325 204Q372 176 435 193M325 230Q372 201 435 218" fill="none" stroke="#1686e9" stroke-width="5" stroke-linecap="round"/><path d="M153 140l14-22 14 22-14 22z" fill="${violet}"/><circle cx="433" cy="120" r="12" fill="#08d0e8"/>`;
  else if(kind==='listening') drawing=`<ellipse cx="298" cy="322" rx="168" ry="30" fill="#00c8ff" opacity=".18"/><ellipse cx="298" cy="322" rx="135" ry="20" fill="none" stroke="#9a8aff" stroke-width="3"/><circle cx="297" cy="204" r="105" fill="${blue}" opacity=".25"/><path d="M206 213v-17a91 91 0 0 1 182 0v17" fill="none" stroke="#6fe5ff" stroke-width="24" stroke-linecap="round"/><rect x="190" y="201" width="54" height="101" rx="22" fill="${blue}" stroke="#8beaff" stroke-width="5"/><rect x="351" y="201" width="54" height="101" rx="22" fill="${violet}" stroke="#d2c1ff" stroke-width="5"/><path d="M258 205q39-29 78 0M264 228q32-23 64 0" fill="none" stroke="white" stroke-width="6" stroke-linecap="round"/><circle cx="297" cy="261" r="9" fill="#7af4dc"/>`;
  else if(kind==='speaking') drawing=`<ellipse cx="298" cy="322" rx="168" ry="30" fill="#00c8ff" opacity=".18"/><ellipse cx="298" cy="322" rx="135" ry="20" fill="none" stroke="#9a8aff" stroke-width="3"/><circle cx="299" cy="209" r="100" fill="${blue}" opacity=".24"/><rect x="260" y="101" width="78" height="148" rx="39" fill="${blue}" stroke="#8ceaff" stroke-width="6"/><path d="M279 138h40M279 158h40M279 178h40" stroke="white" stroke-width="6" stroke-linecap="round"/><path d="M235 193v20a64 64 0 0 0 128 0v-20M299 277v37M267 314h64" fill="none" stroke="#7deaff" stroke-width="10" stroke-linecap="round"/><path d="M376 119q34 27 0 54M393 99q54 48 0 96" fill="none" stroke="#be9cff" stroke-width="6" stroke-linecap="round"/>`;
  else drawing=`<ellipse cx="298" cy="320" rx="186" ry="33" fill="#00c8ff" opacity=".2"/><ellipse cx="298" cy="320" rx="145" ry="22" fill="none" stroke="#9b89ff" stroke-width="3"/><circle cx="299" cy="205" r="110" fill="${blue}" opacity=".92"/><circle cx="299" cy="205" r="110" fill="none" stroke="#8cecff" stroke-width="5"/><ellipse cx="299" cy="205" rx="48" ry="110" fill="none" stroke="#8beaff" stroke-width="2"/><ellipse cx="299" cy="205" rx="110" ry="36" fill="none" stroke="#8beaff" stroke-width="2"/><path d="M194 178Q299 143 404 178M194 232Q299 266 404 232" fill="none" stroke="#8beaff" stroke-width="2"/><g transform="translate(241 70) rotate(-5)"><path d="M0 23L64 0 128 23 64 46Z" fill="${violet}" stroke="#e2d6ff" stroke-width="3"/><path d="M28 30v30q36 27 72 0V30" fill="#e6f5ff" stroke="#7be6ff" stroke-width="3"/><path d="M125 23v42" stroke="#9ceeff" stroke-width="4"/><circle cx="125" cy="67" r="7" fill="#ffe19d"/></g><g transform="translate(74 145) rotate(-9)"><rect width="86" height="80" rx="17" fill="${cyan}" stroke="#93edff" stroke-width="3"/><path d="M22 20h42M22 36h42M22 52h29" stroke="white" stroke-width="5" stroke-linecap="round"/></g><g transform="translate(409 144) rotate(9)"><rect width="86" height="80" rx="17" fill="${violet}" stroke="#d4c3ff" stroke-width="3"/><path d="M22 22l13 14 28-29" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return `<div class="scene-art scene-${esc(kind)}" aria-hidden="true"><div class="scene-glow"></div><svg viewBox="0 0 580 420" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${uid}-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00d9ff"/><stop offset=".48" stop-color="#147eff"/><stop offset="1" stop-color="#4a36f5"/></linearGradient><linearGradient id="${uid}-cyan" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5af4e0"/><stop offset="1" stop-color="#00a9df"/></linearGradient><linearGradient id="${uid}-violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a97aff"/><stop offset="1" stop-color="#4f36ee"/></linearGradient></defs><g>${drawing}</g></svg><span class="scene-spark scene-spark-a"></span><span class="scene-spark scene-spark-b"></span></div>`;
}

function storyHref(item){return `#news/${encodeURIComponent(item.slug||item.id||'')}`}
function programHref(item){return `/chuong-trinh/${encodeURIComponent(item.id||'')}`}
function eventHref(item){return `/su-kien/${encodeURIComponent(item.id||'')}`}
function activeLike(status=''){return /đang hoạt động|đang mở|active|open|ongoing|đang diễn ra/i.test(String(status||''))}
function comparePrograms(a,b){const rank=x=>{const t=String(x.title||'').toLowerCase();if(/tiếng anh trung cấp|b1\s*-?\s*b2/.test(t))return 0;if(/reading/.test(t))return 1;if(/listening/.test(t))return 2;if(/speaking/.test(t))return 3;return 4};return rank(a)-rank(b)}
function programCard(item,index=0,mode='catalog'){
 const data=jsonObject(item.data_json),kind=programArtKind(item),desc=firstText(data,['summary','short_description','description','intro'])||item.level||'';
 const status=publicStatusLabel(item.status),level=item.level?`<span class="program-level">${esc(item.level)}</span>`:'';
 if(mode==='home')return `<article class="program-home-card ${index===0?'is-featured':''} art-${esc(kind)}"><div class="program-home-art">${sceneArt(kind)}</div><div class="program-home-copy"><span class="program-unit">${esc(item.unit_code||'Sky First')}</span><h3>${esc(normalizeBrandString(item.title))}</h3>${level}<p class="program-status-line">${esc(status)}</p><a href="${esc(programHref(item))}">${bi('Xem chi tiết chương trình','View Program Details')} <span>→</span></a></div></article>`;
 return `<article class="program-card"><div class="program-card-visual">${sceneArt(kind)}<span class="program-unit">${esc(item.unit_code||'Sky First')}</span></div><div class="program-card-body"><h3>${esc(normalizeBrandString(item.title))}</h3>${level}${desc?`<p>${esc(desc)}</p>`:`<p>${bi('Thông tin chi tiết của chương trình được đồng bộ từ hệ thống quản trị.','Detailed program information is synchronized from the Administration System.')}</p>`}<div class="program-card-foot"><span class="program-status ${activeLike(item.status)?'is-active':''}"><i></i>${esc(status)}</span><a href="${esc(programHref(item))}">${bi('Xem chi tiết','View Details')} <b>→</b></a></div></div></article>`;
}

function updateActiveNav(activeKey){
  document.querySelectorAll('#mainNav [data-nav-match]').forEach(a=>{
    const match=a.dataset.navMatch===activeKey;
    a.classList.toggle('is-active',match);
    if(match) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
}

async function home(app){
  updateActiveNav('home');
  setMeta(bi('Hệ thống Thông tin Số Sky First','Sky First Digital Information System'),t('hero_desc'));
  const [news,classes,events,resources,config]=await Promise.allSettled([
    api('/api/public/news'),
    api('/api/public/classes'),
    api('/api/public/events'),
    api('/api/public/resources'),
    api('/api/config')
  ]);
  if (config.status === 'fulfilled' && config.value) {
    cachedPublicConfig = config.value;
    applyPublicConfigToDom(cachedPublicConfig);
  }
  const n=news.value?.items||[], c=classes.value?.items||[], ev=events.value?.items||[], r=resources.value?.items||[];
  const newsHtml=n.length?`<div class="news-editorial"><a class="news-feature" href="${esc(storyHref(n[0]))}"><div class="news-feature-art">${sceneArt('news')}${n[0].cover_file_id?`<img src="/media/${encodeURIComponent(n[0].cover_file_id)}" alt="Ảnh đại diện: ${esc(n[0].title)}" loading="lazy">`:''}${n[0].cover_file_id?'':`<em class="cover-default-note">MINH HỌA MẶC ĐỊNH · CHƯA CÓ ẢNH ĐẠI DIỆN</em>`}</div><span>${bi('TIN NỔI BẬT','FEATURED UPDATE')}</span><h3>${esc(n[0].title)}</h3><p>${esc(String(n[0].body||'').replace(/<[^>]*>/g,' ').slice(0,230))}</p><small>${n[0].published_at?fmt(n[0].published_at):''}</small><b class="news-card-cta">${bi('Đọc tin','Read Article')} <span>→</span></b></a><div class="news-stack">${n.slice(1,5).map(x=>`<a href="${esc(storyHref(x))}"><span>${bi('THÔNG BÁO','NOTICE')}</span><b>${esc(x.title)}</b><small>${x.published_at?fmt(x.published_at):''}</small><strong>${bi('Đọc tin →','Read →')}</strong></a>`).join('')}</div></div>`:`<div class="beautiful-empty"><i>◧</i><div><h3>${bi('Chưa có tin tức công khai','No public announcements yet')}</h3><p>${bi('Tin mới và thông báo sẽ xuất hiện tại đây khi được xuất bản từ hệ thống quản trị.','Announcements will appear here once published from the Administration System.')}</p></div></div>`;

  app.innerHTML=`
  <section class="sfn-clean-hero" id="heroSection">
    <div class="sfn-clean-hero-inner">
      <div class="sfn-hero-badge"><span>✦</span> <b data-i18n="hero_badge">${esc(t('hero_badge'))}</b></div>
      <h1><span data-i18n="hero_title_top">${esc(t('hero_title_top'))}</span><strong>Sky First</strong></h1>
      <p class="sfn-hero-desc" data-i18n="hero_desc">${esc(t('hero_desc'))}</p>
      <div class="sfn-search-bar" role="search">
        <label class="sr-only" for="homeSearch">Tìm kiếm trên Hệ thống Thông tin Số Sky First</label>
        <span class="sfn-search-icon" aria-hidden="true">⌕</span>
        <input id="homeSearch" type="search" placeholder="${esc(t('search_placeholder'))}" autocomplete="off">
        <button id="homeSearchBtn" type="button"><span data-i18n="search_btn">${esc(t('search_btn'))}</span> <span aria-hidden="true">→</span></button>
      </div>
      <div class="sfn-quick-pills" aria-label="Truy cập nhanh">
        <span class="sfn-quick-label" data-i18n="quick_label">${esc(t('quick_label'))}</span>
        <a href="/chuong-trinh"><span>◫</span> <b data-i18n="nav_programs">${esc(t('nav_programs'))}</b></a>
        <a href="/su-kien"><span>▦</span> <b data-i18n="nav_events">${esc(t('nav_events'))}</b></a>
        <a href="/tai-lieu"><span>▤</span> <b data-i18n="nav_docs">${esc(t('nav_docs'))}</b></a>
        <a href="/bieu-mau"><span>▧</span> <b data-i18n="nav_forms">${esc(t('nav_forms'))}</b></a>
        <a href="/gcn"><span>✓</span> <b data-i18n="nav_certs">${esc(t('nav_certs'))}</b></a>
        <a href="/ho-so"><span>⌁</span> <b data-i18n="nav_cases">${esc(t('nav_cases'))}</b></a>
        <a href="/tai-tro"><span>♡</span> <b data-i18n="nav_sponsorship">${esc(t('nav_sponsorship'))}</b></a>
        <a href="/an-toan"><span>◇</span> <b data-i18n="nav_safety">${esc(t('nav_safety'))}</b></a>
      </div>

      <div class="sfn-feature-cards-grid" aria-label="Các phân hệ chức năng chính">
        <a class="sfn-fcard fcard-blue" href="/chuong-trinh">
          <div class="sfn-fcard-icon" aria-hidden="true">◫</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_prog_title">${esc(t('card_prog_title'))}</h2>
            <p data-i18n="card_prog_desc">${esc(t('card_prog_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-purple" href="/su-kien">
          <div class="sfn-fcard-icon" aria-hidden="true">▦</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_ev_title">${esc(t('card_ev_title'))}</h2>
            <p data-i18n="card_ev_desc">${esc(t('card_ev_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-teal" href="/tai-lieu">
          <div class="sfn-fcard-icon" aria-hidden="true">▱</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_doc_title">${esc(t('card_doc_title'))}</h2>
            <p data-i18n="card_doc_desc">${esc(t('card_doc_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-amber" href="/gcn">
          <div class="sfn-fcard-icon" aria-hidden="true">✓</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_cert_title">${esc(t('card_cert_title'))}</h2>
            <p data-i18n="card_cert_desc">${esc(t('card_cert_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-navy" href="/an-toan">
          <div class="sfn-fcard-icon" aria-hidden="true">◇</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_safe_title">${esc(t('card_safe_title'))}</h2>
            <p data-i18n="card_safe_desc">${esc(t('card_safe_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-green" href="/tai-tro">
          <div class="sfn-fcard-icon" aria-hidden="true">♡</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_sp_title">${esc(t('card_sp_title'))}</h2>
            <p data-i18n="card_sp_desc">${esc(t('card_sp_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
      </div>

      <div class="sfn-stats-bar home-stats-5" id="homeStats" aria-label="Chỉ số vận hành hệ thống">
        <div class="sfn-stat-item">
          <i class="sfn-stat-icon" aria-hidden="true">◫</i>
          <div>
            <strong data-stat="programs">—</strong>
            <span data-stat-label="programs" data-i18n="stat_programs">${esc(t('stat_programs'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <i class="sfn-stat-icon" aria-hidden="true">♧</i>
          <div>
            <strong data-stat="members">—</strong>
            <span data-stat-label="members" data-i18n="stat_members">${esc(t('stat_members'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <i class="sfn-stat-icon" aria-hidden="true">✓</i>
          <div>
            <strong data-stat="certificates">—</strong>
            <span data-stat-label="certificates" data-i18n="stat_certificates">${esc(t('stat_certificates'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <i class="sfn-stat-icon" aria-hidden="true">↔</i>
          <div>
            <strong data-stat="partners">—</strong>
            <span data-stat-label="partners" data-i18n="stat_partners">${esc(t('stat_partners'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <i class="sfn-stat-icon" aria-hidden="true">◇</i>
          <div>
            <strong data-stat="sponsorship">—</strong>
            <span data-stat-label="sponsorship" data-i18n="stat_sponsorship">${esc(t('stat_sponsorship'))}</span>
          </div>
        </div>
      </div>

      <div class="sfn-hero-tagline">
        <span class="tagline-line"></span>
        <p data-i18n="footer_tagline">${esc(t('footer_tagline'))}</p>
        <span class="tagline-line"></span>
      </div>
    </div>
  </section>

  ${renderSystemPageCmsZone('/')}

  <div class="home-operational-grid">
    <section class="dip-section live-v3 home-programs-panel" id="programs">
      ${sectionHead(bi('CHƯƠNG TRÌNH ĐÀO TẠO & CỘNG ĐỒNG','COMMUNITY & EDUCATIONAL PROGRAMS'),bi('Chương trình đang triển khai','Active Programs'),bi('Danh sách chương trình được đồng bộ từ dữ liệu đã công bố.','Programs synchronized directly from published D1 database records.'))}
      <div class="program-spotlight">${visiblePublicItems(c).sort(comparePrograms).slice(0,3).map((x,i)=>programCard(x,i,'home')).join('')||`<div class="beautiful-empty"><i>◫</i><div><h3>${bi('Chưa có chương trình công khai','No public programs yet')}</h3><p>${bi('Chương trình sẽ xuất hiện tại đây khi được cập nhật và công bố từ hệ thống quản trị.','Programs will appear here once published from the Administration System.')}</p><a href="mailto:lienhe@skyfirst.io.vn">${bi('Liên hệ hỗ trợ →','Contact Support →')}</a></div></div>`}</div>
      <a class="section-more-link" href="/chuong-trinh">${bi('Xem toàn bộ chương trình','View All Programs')} <span>→</span></a>
    </section>
    <div class="home-right-stack">
      <section class="dip-section tone home-events-panel" id="activities">
        ${sectionHead(bi('SỰ KIỆN & HOẠT ĐỘNG','EVENTS & ACTIVITIES'),bi('Lịch sự kiện và hoạt động thực tế','Verified Event Schedule'),bi('Theo dõi thời gian và trạng thái các sự kiện công khai.','Track schedules and registration status of public events.'))}
        <div class="event-timeline" id="events">${visiblePublicItems(ev).slice(0,4).map(x=>`<a href="${esc(eventHref(x))}"><time>${x.start_at?fmt(x.start_at):bi('Thời gian đang cập nhật','Time updating')}</time><div><small>${esc(x.unit_code||'Sky First')}</small><h3>${esc(x.title)}</h3><p>${esc(publicStatusLabel(x.status))}</p></div><span>→</span></a>`).join('')||`<div class="home-empty"><span aria-hidden="true">▦</span><b>${bi('Chưa có sự kiện công khai','No public events yet')}</b><p>${bi('Lịch sự kiện sẽ hiển thị khi được cập nhật và công bố.','Event schedules will be displayed once published.')}</p></div>`}</div>
        <a class="section-more-link" href="/su-kien">${bi('Xem tất cả sự kiện','View All Events')} <span>→</span></a>
      </section>
      <section class="dip-section resources-v3 home-resources-panel" id="resources">
        ${sectionHead(bi('THƯ VIỆN TÀI LIỆU SỐ','DIGITAL DOCUMENT LIBRARY'),bi('Tài liệu, văn bản và hướng dẫn','Official Documents & Guides'),bi('Tài liệu công khai có thể xem trước hoặc tải theo quyền truy cập.','Preview or download official PDF documents according to access policy.'))}
        ${r.length?`<div class="resource-list">${r.slice(0,4).map(x=>`<article><i>${icon('resource')}</i><div><span>${esc(bi(x.category||x.doc_type||'TÀI LIỆU',x.category_en||x.category||'DOCUMENT'))} · v${esc(x.current_version||1)}</span><h3>${esc(bi(x.title,x.title_en))}</h3>${x.description?`<p class="muted small">${esc(bi(x.description,x.description_en))}</p>`:''}</div><div class="actions">${x.preview_url?`<a class="secondary" href="/tai-lieu?preview=${encodeURIComponent(x.id)}">${bi('Xem trước','Preview')}</a>`:''}${x.download_url?`<a class="portal-button" href="${esc(x.download_url)}">${bi('Tải xuống →','Download →')}</a>`:''}</div></article>`).join('')}</div>`:`<div class="home-empty"><span aria-hidden="true">▤</span><b>${bi('Chưa có tài liệu công khai','No public documents yet')}</b><p>${bi('Tài liệu và văn bản sẽ hiển thị khi được phê duyệt, công bố.','Documents will appear once approved and published.')}</p></div>`}
        <a class="section-more-link" href="/tai-lieu">${bi('Mở Thư viện Tài liệu','Open Document Library')} <span>→</span></a>
      </section>
    </div>
  </div>
  <div class="home-lower-grid">
    <section class="dip-section news-v3 home-news-panel" id="news">
      ${sectionHead(bi('THÔNG BÁO & CẬP NHẬT','ANNOUNCEMENTS & UPDATES'),bi('Thông tin vận hành và thông báo mới','Operational Notices & News'),bi('Các thông báo đã được công bố trên hệ thống.','Official announcements published on the system.'))}
      ${newsHtml}
      <a class="section-more-link" href="#news">${bi('Xem thông báo mới','View All Announcements')} <span>→</span></a>
    </section>
    <section class="home-about-panel" id="about">
      <span class="section-kicker">HỆ THỐNG Sky First</span>
      <h2>${bi('Thông tin số rõ ràng, thuận tiện và có kiểm soát','Clear, Accessible, and Governed Digital Information')}</h2>
      <p>${bi('Tra cứu chương trình, sự kiện, tài liệu, biểu mẫu, hồ sơ và chứng nhận tại một điểm truy cập thống nhất.','Access programs, events, documents, forms, applications, and credential verification from a unified digital gateway.')}</p>
      <div class="home-about-pill-row"><span>${bi('Giáo dục','Education')}</span><span>${bi('Môi trường','Environment')}</span><span>${bi('Cộng đồng','Community')}</span></div>
      <div class="actions" style="margin-top:12px;"><a class="section-more-link" href="/gioi-thieu">${bi('Giới thiệu hệ thống','About the System')} <span>→</span></a><a class="section-more-link" href="/an-toan">${bi('Hướng dẫn an toàn','Safety Guide')} <span>→</span></a></div>
    </section>
  </div>`;

  bindBrokenCoverImages(app,'.news-feature-art','ẢNH ĐẠI DIỆN KHÔNG TẢI ĐƯỢC · MINH HỌA MẶC ĐỊNH');
  const statConfig=config.status==="fulfilled"?(config.value.home_stats||{}):{};
  const statDefaults={
    source:"d1",
    values:{programs:null,members:null,certificates:null,partners:null,sponsorship:null},
    labels:{
      programs:t('stat_programs'),
      members:t('stat_members'),
      certificates:t('stat_certificates'),
      partners:t('stat_partners'),
      sponsorship:t('stat_sponsorship')
    },
    duration_ms:900,
    cycles:1
  };
  const statSettings={...statDefaults,...statConfig,values:{...statDefaults.values,...(statConfig.values||{})},labels:{...statDefaults.labels,...(statConfig.labels||{})}};
  document.querySelectorAll("[data-stat-label]").forEach(el=>{
    const k=el.dataset.statLabel;
    const label=getLang()==='en'?t(`stat_${k}`):String(statSettings.labels[k]||t(`stat_${k}`)).trim();
    if(label) el.textContent=label;
  });
  const fmtStat=(n,key)=>{
    const num=Number(n)||0;
    const isEn=getLang()==='en';
    if(key==="sponsorship"){
      if(num>=1000000000) return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:2}).format(num/1000000000)+(isEn?"B VND":" tỷ đồng");
      if(num>=1000000) return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1}).format(num/1000000)+(isEn?"M VND":" triệu đồng");
      return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(num)+(isEn?" VND":" đồng");
    }
    return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(num);
  };
  const runStat=el=>{
    const key=el.dataset.stat;
    let rawValue=statSettings.values?.[key];
    if(statSettings.source==="d1"){
      rawValue=statConfig.d1_values&&Object.prototype.hasOwnProperty.call(statConfig.d1_values,key)?statConfig.d1_values[key]:null;
    }
    if(rawValue===null||rawValue===undefined||rawValue===""||!Number.isFinite(Number(rawValue))||Number(rawValue)<0){
      el.textContent=getLang()==='en'?"No public data":"Chưa có dữ liệu";
      el.setAttribute("data-stat-state","unavailable");
      return;
    }
    const target=Number(rawValue);
    el.removeAttribute("data-stat-state");
    el.textContent=fmtStat(target,key);
  };
  document.querySelectorAll("[data-stat]").forEach(runStat);
  document.getElementById('homeSearchBtn')?.addEventListener('click',()=>openSearch(document.getElementById('homeSearch')?.value||''));
  document.getElementById('homeSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openSearch(e.currentTarget.value)}});
  event('route_view',{category:'home'});
}

async function aboutCenter(app) {
  updateActiveNav('home');
  await ensurePublicConfig();
  setMeta(bi('Giới thiệu Hệ thống Thông tin Số Sky First','About Sky First Digital Information System'), bi('Tổng quan sứ mệnh, kiến trúc quản trị dữ liệu và hệ sinh thái số Sky First.','Overview of the mission, data governance architecture, and digital portal ecosystem of Sky First.'));
  const websites = cachedPublicConfig?.websites || [];
  app.innerHTML = `<section class="page-hero compact"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('GIỚI THIỆU HỆ THỐNG','ABOUT THE DIGITAL SYSTEM')}</h1><p>${bi('Kiến trúc quản trị dữ liệu tập trung (Admin-Driven), xác thực định danh số và minh bạch vận hành thuộc mạng lưới Sky First.','Centralized Admin-Driven data governance architecture, digital credential verification, and operational transparency of Sky First.')}</p></section>
  ${renderSystemPageCmsZone('/gioi-thieu')}
  <section class="dip-section tight">
    ${sectionHead(bi('HỆ SINH THÁI SKY FIRST','SKY FIRST ECOSYSTEM'), bi('7 Cổng thông tin & Dịch vụ chuyên biệt','7 Specialized Portals & Digital Services'), bi('Được quản lý tập trung từ Trung tâm Quản trị với phân quyền theo phạm vi đơn vị.','Centrally governed from the Admin Control Center with scope-based access control.'))}
    <div class="program-catalog-grid">${websites.map(w => `<article class="program-card"><div class="program-card-body"><span class="content-tag">${esc(w.code)}</span><h3>${esc(w.name)}</h3><p>${esc(w.description || '')}</p><div class="program-card-foot"><span class="program-status is-active"><i></i>${esc(w.domain)}</span><a href="https://${esc(w.domain)}" target="_blank" rel="noopener">${bi('Truy cập','Visit')} <b>↗</b></a></div></div></article>`).join('')}</div>
  </section>`;
  event('route_view',{category:'about'});
}

async function supportCenter(app) {
  updateActiveNav('safety');
  await ensurePublicConfig();
  setMeta(bi('Trung tâm Hỗ trợ & Liên hệ','Support & Official Contact Center'), bi('Kênh tiếp nhận yêu cầu hỗ trợ kỹ thuật, giải đáp thủ tục hồ sơ và liên hệ công tác chính thức.','Official channel for technical support, application inquiries, and partnership requests.'));
  app.innerHTML = `<section class="page-hero compact"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('TRUNG TÂM HỖ TRỢ & LIÊN HỆ','SUPPORT & CONTACT CENTER')}</h1><p>${bi('Giải đáp quy trình hồ sơ, tra cứu chứng nhận, đối soát tài trợ và tiếp nhận yêu cầu hỗ trợ trực tuyến.','Guidance on application procedures, credential verification, sponsorship reconciliation, and online support requests.')}</p></section>
  ${renderSystemPageCmsZone('/ho-tro')}
  <section class="dip-section tight">
    <div class="public-benefits">
      <article><i>✉</i><h3>${bi('Thư điện tử Hệ thống','System Email')}</h3><p><b>app@skyfirst.io.vn</b> — ${bi('Gửi thông báo tự động và biên nhận hồ sơ.','Automated notifications and application receipts.')}</p></article>
      <article><i>?</i><h3>${bi('Hỗ trợ Kỹ thuật','Technical Support')}</h3><p><b>support@skyfirst.io.vn</b> · Hotline: <b>0924 910 210</b></p></article>
      <article><i>◎</i><h3>${bi('Liên hệ Chung & Hợp tác','General & Partnership Contact')}</h3><p><b>lienhe@skyfirst.io.vn</b> — ${bi('Tiếp nhận đề xuất đồng hành và truyền thông.','Partnership proposals and general inquiries.')}</p></article>
    </div>
    <div class="actions" style="margin-top:20px;justify-content:center;">
      <a class="portal-button" href="/#form/support">${bi('Mở Biểu mẫu Yêu cầu Hỗ trợ →','Open Support Request Form →')}</a>
      <a class="secondary" href="/an-toan">${bi('Báo cáo Sự cố An toàn →','Report Safety Incident →')}</a>
    </div>
  </section>`;
  event('route_view',{category:'support'});
}

async function formCenter(app){
  updateActiveNav('forms');
  setMeta(bi('Biểu mẫu điện tử','Electronic Forms'),'Hệ thống Biểu mẫu điện tử Sky First — tiếp nhận thông tin, chữ ký hình ảnh và tệp đính kèm an toàn.');
  const d=await api('/api/config'); cachedPublicConfig=d; applyPublicConfigToDom(d); const forms=d.forms||[];
  app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('BIỂU MẪU ĐIỆN TỬ','ELECTRONIC FORMS')}</h1><p>${bi('Gửi đăng ký chương trình, hồ sơ tham gia và yêu cầu trực tuyến trên app.skyfirst.io.vn. Sau khi gửi thành công, hệ thống cấp mã hồ sơ để bạn tra cứu tiến trình xử lý tại mục ','Submit program registrations, applications, and requests online at app.skyfirst.io.vn. Upon submission, you receive a reference code to track progress at ')}<b>${bi('Hồ sơ (/ho-so)','Records (/ho-so)')}</b>.</p></section>
  ${renderSystemPageCmsZone('/bieu-mau')}
  <section class="dip-section tight">
    <div class="capability-strip"><span>${bi('Biểu mẫu nhiều bước','Multi-step forms')}</span><span>${bi('Điều kiện hiển thị linh hoạt','Conditional logic')}</span><span>${bi('Tải tệp kiểm tra chữ ký byte','Magic-byte verified uploads')}</span><span>${bi('Hỗ trợ vẽ/tải ảnh chữ ký','Draw or upload signature')}</span><span>${bi('Bảo vệ người dưới 18 tuổi','Minor guardian protection')}</span><span>${bi('Xem lại trước khi gửi','Review before submit')}</span></div>
    ${sectionHead(bi('DANH MỤC BIỂU MẪU','ACTIVE FORMS'),bi('Biểu mẫu đang mở tiếp nhận','Forms Open for Submission'),bi('Chọn biểu mẫu phù hợp với nhu cầu của bạn.','Select the appropriate electronic form below.'))}
    <div class="form-center-grid">${forms.map(f=>`<article class="form-center-card"><div><span class="content-tag">${esc(f.prefix)}</span><h3>${esc(f.name)}</h3><p>${esc(f.description||'')}</p></div><div><small>${f.min_age?`${bi('Điều kiện tuổi: từ đủ','Minimum age:')} ${esc(f.min_age)}+`:bi('Theo điều kiện của chương trình','Subject to program terms')}</small><a class="portal-button" href="#form/${encodeURIComponent(f.id)}">Mở biểu mẫu <span>→</span></a></div></article>`).join('')||empty(bi('Hiện chưa có biểu mẫu công khai đang mở.','No public forms are currently open.'))}</div>
  </section>`;
  event('route_view',{category:'forms'});
}

function lookupShell(title,desc){return `<section class="page-hero compact lookup-entry-hero"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></section>`}

function lookupPolicyBanner(){
  return `<div class="notice lookup-policy-banner" style="margin:18px auto;max-width:1080px;">
    <p style="margin:0 0 6px;"><b>${bi('Chính sách dữ liệu tra cứu:','Lookup Data Privacy Policy:')}</b> ${esc(t('lookup_policy_1'))}</p>
    <p style="margin:0;font-size:13px;opacity:.92;">${esc(t('lookup_policy_2'))}</p>
  </div>`;
}

async function lookupCenter(app){
  updateActiveNav('gcn');
  await ensurePublicConfig();
  setMeta(bi('Tra cứu thông tin','Verification & Lookup Hub'),'Chọn phân hệ tra cứu Chứng nhận (/gcn) hoặc Hồ sơ (/ho-so) trên Hệ thống Thông tin Số Sky First.');
  app.innerHTML=lookupShell(bi('TRUNG TÂM TRA CỨU','CENTRAL VERIFICATION HUB'),bi('Chọn đúng phân hệ cần tra cứu: Chứng nhận đã phát hành (/gcn), Hồ sơ đã gửi (/ho-so) hoặc Minh bạch Tài trợ (/tai-tro).','Select a verification module: Issued Credentials (/gcn), Submitted Applications (/ho-so), or Sponsorship Transparency (/tai-tro).'))+renderSystemPageCmsZone('/tra-cuu')+lookupPolicyBanner()+`<section class="lookup-choice-v3"><a class="lookup-choice paper" href="/gcn"><div class="choice-art"><span>✓</span><i>▦</i></div><small>CHỨNG NHẬN (/GCN)</small><h2>${bi('Tra cứu Giấy chứng nhận, Giấy xác nhận & Bằng khen','Verify Certificates, Confirmations & Merit Awards')}</h2><p>${bi('Tra cứu tính hợp lệ và trạng thái hiệu lực bằng mã chứng nhận hoặc thông tin đăng ký được xác thực.','Verify authenticity and validity status using the credential code or registered contact information.')}</p><b>${bi('Mở tra cứu chứng nhận →','Open Credential Verification →')}</b></a><a class="lookup-choice case" href="/ho-so"><div class="choice-art"><span>⌁</span><i>•••</i></div><small>HỒ SƠ (/HO-SO)</small><h2>${bi('Tra cứu tiến trình xử lý hồ sơ','Track Application Processing Status')}</h2><p>${bi('Xác minh bằng mã hồ sơ và địa chỉ email đã đăng ký để bảo vệ thông tin cá nhân.','Verify with both your application code and registered email address to protect personal data.')}</p><b>${bi('Mở tra cứu hồ sơ →','Open Application Lookup →')}</b></a></section>`;
}

function credentialResult(x){return `<article class="verification-record ${statusClass(x.status_text)}"><div class="verify-state"><i>${x.status==='issued'?'✓':x.status==='revoked'?'!':'↻'}</i><div><span>${bi('KẾT QUẢ ĐỐI CHIẾU CHỨNG NHẬN','CREDENTIAL VERIFICATION RESULT')}</span><h2>${esc(publicStatusLabel(x.status_text))}</h2></div></div><dl><div><dt>${bi('Mã chứng nhận','Credential Code')}</dt><dd>${esc(x.code)}</dd></div><div><dt>${bi('Loại văn bản','Document Type')}</dt><dd>${esc(x.type)}</dd></div><div><dt>${bi('Người được ghi nhận','Recipient Name')}</dt><dd>${esc(x.full_name)}</dd></div><div class="wide"><dt>${bi('Nội dung ghi nhận','Citation / Content')}</dt><dd>${esc(x.content)}</dd></div>${x.program?`<div><dt>${bi('Chương trình / Hoạt động','Program / Activity')}</dt><dd>${esc(x.program)}</dd></div>`:''}<div><dt>${bi('Đơn vị phát hành','Issuing Unit')}</dt><dd>${esc(x.unit_name)}</dd></div><div><dt>${bi('Ngày phát hành','Issued Date')}</dt><dd>${esc(x.issued_at?fmt(x.issued_at):'—')}</dd></div><div><dt>${bi('Trạng thái hiệu lực','Validity Status')}</dt><dd>${esc(publicStatusLabel(x.status_text))}</dd></div>${x.replacement_code?`<div class="wide"><dt>${bi('Được thay thế bởi mã mới','Superseded by Code')}</dt><dd><a href="/gcn/${encodeURIComponent(x.replacement_code)}">${esc(x.replacement_code)}</a></dd></div>`:''}${x.revocation_reason?`<div class="wide"><dt>${bi('Lý do thu hồi','Revocation Reason')}</dt><dd>${esc(x.revocation_reason)}</dd></div>`:''}</dl><p class="record-note">${esc(t('lookup_policy_2'))}<br><small>${esc(t('lookup_policy_1'))}</small></p></article>`}
function failCard(msg){return `<div class="result-fail" role="alert"><i>×</i><div><h3>${getLang()==='en'?'Verification Failed':'Không thể xác minh thông tin'}</h3><p>${esc(msg||'Không tìm thấy dữ liệu phù hợp với thông tin đã cung cấp.')}</p></div></div>`}

async function credentialCenter(app,path){
  updateActiveNav('gcn');
  await ensurePublicConfig();
  setMeta(bi('Tra cứu chứng nhận','Credential Verification'),'Tra cứu Giấy chứng nhận, Giấy xác nhận và Bằng khen trên Hệ thống Thông tin Số Sky First.');
  const pathCode=decodeURIComponent(path.split('/').filter(Boolean)[1]||''); const queryCode=new URLSearchParams(location.search).get('code')||''; const init=pathCode||queryCode;
  app.innerHTML=`<section class="lookup-hero credential-hero"><div class="lookup-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('TRA CỨU','VERIFY')} <strong>${bi('CHỨNG NHẬN','CREDENTIALS')}</strong></h1><p>${bi('Xác thực trạng thái hiệu lực, hết hạn, thu hồi hoặc thay thế của Giấy chứng nhận, Giấy xác nhận và Bằng khen.','Verify validity, expiration, revocation, or replacement status of Certificates (GCN), Confirmations (GXN), and Merit Awards (BK).')}</p><div class="lookup-trust"><span>✓ ${bi('Đối chiếu trực tiếp cơ sở dữ liệu D1','Direct D1 database verification')}</span><span>⌁ ${bi('Hỗ trợ tra cứu theo mã hoặc email/SĐT đăng ký','Lookup by code or registered email/phone')}</span><span>▦ ${bi('Hỗ trợ quét mã QR','QR code scanner supported')}</span></div></div><div class="lookup-hero-art credential-art-new" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="credential-document"><span>Sky First</span><i>CHỨNG NHẬN</i><b>★</b><small>▦ QR</small></div><div class="credential-shield">✓</div></div></section>
  ${renderSystemPageCmsZone('/gcn')}
  <section class="lookup-search-panel credential-search credential-search-v3">
    <h2>${bi('Nhập mã chứng nhận hoặc thông tin đăng ký để xác thực','Enter credential code or registered contact to verify')}</h2>
    <form id="credentialForm">
      <label for="credentialCode">${bi('Mã chứng nhận (GCN / GXN / BK)','Credential Code (GCN / GXN / BK)')}</label>
      <div class="lookup-big"><span>⌕</span><input id="credentialCode" value="${esc(init)}" placeholder="${bi('Ví dụ: SFN-GCN-12345678 hoặc 001-GCN-SFN/2026','e.g., SFN-GCN-12345678 or 001-GCN-SFN/2026')}" autocomplete="off"><button type="submit">⌕ &nbsp; ${bi('XÁC THỰC THEO MÃ','VERIFY BY CODE')}</button></div>
      <div class="lookup-secondary-actions"><button class="secondary" type="button" id="scanQr">▦ &nbsp; ${bi('Quét mã QR','Scan QR Code')}</button><button class="secondary" type="button" id="toggleContactLookup">${bi('Tra cứu bằng Email / Số điện thoại','Lookup by Email / Phone')}</button><a href="#huong-dan">${bi('Quy tắc xác thực chứng nhận ↓','Verification Rules ↓')}</a></div>
    </form>
    <form id="credentialContactForm" class="card" style="margin-top:14px;display:none;">
      <h3 style="margin-top:0">${bi('Tra cứu chứng nhận bằng Email hoặc Số điện thoại đã đăng ký','Lookup Credential by Registered Email or Phone Number')}</h3>
      <div class="row2">
        <div class="field"><label for="credEmailInput">${bi('Email người được cấp','Recipient Email')}</label><input id="credEmailInput" type="email" placeholder="name@example.com" autocomplete="email"></div>
        <div class="field"><label for="credPhoneInput">${bi('Hoặc Số điện thoại','Or Phone Number')}</label><input id="credPhoneInput" type="tel" placeholder="09xxxxxxxx" autocomplete="tel"></div>
      </div>
      <button type="submit" class="portal-button">⌕ &nbsp; ${bi('Tra cứu theo Email / SĐT','Search by Email / Phone')}</button>
    </form>
    ${lookupPolicyBanner()}
    <div id="credentialOut" aria-live="polite"></div>
  </section>
  <section class="dip-section tight public-benefits credential-benefits"><article><i>✓</i><h3>${bi('Trạng thái minh bạch','Transparent Status')}</h3><p>${bi('Phân biệt rõ chứng nhận đang có hiệu lực, hết hiệu lực, đã bị thu hồi hoặc đã được thay thế bằng mã mới.','Clearly distinguishes Valid, Expired, Revoked, or Superseded credentials.')}</p></article><article><i>◇</i><h3>${bi('Bảo vệ dữ liệu cá nhân','Personal Data Privacy')}</h3><p>${esc(t('lookup_policy_1'))}</p></article><article><i>▦</i><h3>${bi('Tương thích mã cũ & mới','Legacy & V3 Code Compatible')}</h3><p>${bi('Hỗ trợ đồng thời mã định danh ngẫu nhiên 8 số mới và các mã chứng nhận đã phát hành trước đây.','Supports both 8-digit random SFN-GCN/GXN/BK codes and legacy issued codes.')}</p></article></section>
  <section class="dip-section tone faq-v3" id="huong-dan"><details><summary>${bi('Chính sách bảo vệ dữ liệu khi tra cứu chứng nhận','Data privacy policy during credential lookup')}</summary><p>${esc(t('lookup_policy_1'))} ${esc(t('lookup_policy_2'))}</p></details><details><summary>${bi('Chứng nhận bị thu hồi hoặc thay thế hiển thị như thế nào?','How are revoked or superseded credentials displayed?')}</summary><p>${bi('Nếu chứng nhận bị thu hồi, hệ thống hiển thị cảnh báo ĐÃ THU HỒI kèm lý do. Nếu chứng nhận được cấp lại do điều chỉnh thông tin, hệ thống hiển thị ĐÃ ĐƯỢC THAY THẾ và dẫn tới mã chứng nhận mới.','Revoked credentials display REVOKED along with the official reason. Superseded credentials display SUPERSEDED and link directly to the replacement code.')}</p></details></section>`;
  const form=document.getElementById('credentialForm'), input=document.getElementById('credentialCode'), out=document.getElementById('credentialOut');
  const contactForm=document.getElementById('credentialContactForm'), toggleBtn=document.getElementById('toggleContactLookup');
  if(toggleBtn && contactForm){
    toggleBtn.onclick=()=>{contactForm.style.display=contactForm.style.display==='none'?'block':'none';};
  }
  form.onsubmit=async e=>{
    e.preventDefault();const code=input.value.trim();if(!code){return;}
    out.innerHTML=`<div class="loading">${bi('Đang đối chiếu mã chứng nhận…','Verifying credential code…')}</div>`;
    try{const d=await api(`/api/public/credentials/${encodeURIComponent(code)}`);out.innerHTML=credentialResult(d.item);history.replaceState(null,'',`/gcn/${encodeURIComponent(d.item.code)}`);event('verification_success',{category:'credential'})}catch(err){out.innerHTML=failCard(err.message);event('verification_not_found',{category:'credential'})}
  };
  if(contactForm){
    contactForm.onsubmit=async e=>{
      e.preventDefault();
      const email=document.getElementById('credEmailInput')?.value.trim()||'';
      const phone=document.getElementById('credPhoneInput')?.value.trim()||'';
      if(!email && !phone) return;
      out.innerHTML=`<div class="loading">${bi('Đang tra cứu chứng nhận…','Searching credentials…')}</div>`;
      try{
        const d=await api('/api/lookup/certificate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,phone})});
        const list=d.items||[d.item].filter(Boolean);
        out.innerHTML=list.map(credentialResult).join('');
        event('verification_success',{category:'credential_contact'});
      }catch(err){
        out.innerHTML=failCard(err.message);
        event('verification_not_found',{category:'credential_contact'});
      }
    };
  }
  document.getElementById('scanQr').onclick=()=>openQrScanner(input,form); if(init) form.requestSubmit();
}

function openQrScanner(input,form){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){credentialScanMessage('Trình duyệt hiện tại chưa hỗ trợ quét QR trực tiếp từ camera. Vui lòng nhập mã chứng nhận vào ô tìm kiếm.');return}
  const wrap=document.createElement('div');wrap.className='qr-modal';wrap.innerHTML='<div><button type="button" aria-label="Đóng">✕</button><h2>Quét mã QR trên chứng nhận</h2><video autoplay playsinline muted></video><p>Đưa mã QR vào khung hình để tự động nhận diện.</p></div>';document.body.appendChild(wrap);const video=wrap.querySelector('video'),close=()=>{stream?.getTracks().forEach(t=>t.stop());wrap.remove()},detector=new BarcodeDetector({formats:['qr_code']});let stream=null;wrap.querySelector('button').onclick=close;navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(s=>{stream=s;video.srcObject=s;const tick=async()=>{if(!document.body.contains(wrap))return;try{const codes=await detector.detect(video);if(codes[0]?.rawValue){const raw=codes[0].rawValue;let value=raw;try{const u=new URL(raw);value=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||raw)}catch{}input.value=value;close();form.requestSubmit();return}}catch{}requestAnimationFrame(tick)};tick()}).catch(()=>{close();credentialScanMessage('Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera hoặc nhập mã chứng nhận thủ công.')});
}
function credentialScanMessage(message){const out=document.getElementById('credentialOut');if(out)out.innerHTML=`<div class="notice bad qr-scan-message" role="alert">${esc(message)}</div>`;}

function caseResult(x){const steps=['TIẾP NHẬN','KIỂM TRA','XỬ LÝ','CẦN BỔ SUNG','HOÀN TẤT'];const timeline=x.timeline||[];const seen=new Set(timeline.map(t=>t.label));return `<article class="case-record"><div class="case-head"><div><span>${bi('HỒ SƠ ĐÃ XÁC MINH','VERIFIED APPLICATION RECORD')}</span><h2>${esc(x.code)}</h2></div><strong>${esc(publicStatusLabel(x.status))}</strong></div><div class="case-meta"><div><span>${bi('Người đăng ký','Applicant')}</span><b>${esc(x.full_name||'—')}</b></div><div><span>${bi('Biểu mẫu','Form')}</span><b>${esc(x.form_name||x.form_id)}</b></div><div><span>${bi('Ngày tiếp nhận','Received At')}</span><b>${fmt(x.submitted_at)}</b></div><div><span>${bi('Hướng dẫn tiếp theo','Next Step')}</span><b>${esc(x.next_action||'Theo dõi cập nhật')}</b></div></div><div class="timeline">${steps.map((s,i)=>{const ev=timeline.find(t=>t.label===s);const active=seen.has(s);return `<div class="${active?'done':''}"><i>${active?'✓':i+1}</i><span><b>${s}</b><small>${ev?.note?esc(ev.note):active?fmt(ev?.created_at):bi('Chưa đến bước này','Pending stage')}</small></span></div>`}).join('')}</div>${x.result?`<div class="case-result"><span>${bi('KẾT QUẢ XỬ LÝ','PROCESSING RESULT')}</span><p>${esc(x.result)}</p></div>`:''}<p class="record-note" style="margin-top:14px;">${esc(t('lookup_policy_2'))}<br><small>${esc(t('lookup_policy_1'))}</small></p></article>`}

async function caseCenter(app){
  updateActiveNav('hoso');
  await ensurePublicConfig();
  setMeta(bi('Tra cứu hồ sơ','Application Status Lookup'),'Tra cứu trạng thái xử lý hồ sơ trực tuyến trên Hệ thống Thông tin Số Sky First.');
  const qs=new URLSearchParams(location.search), init=qs.get('code')||'';
  app.innerHTML=`<section class="lookup-hero case-hero"><div class="lookup-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('TRA CỨU','TRACK')} <strong>${bi('HỒ SƠ','APPLICATIONS')}</strong></h1><p>${bi('Theo dõi tiến trình xử lý hồ sơ đã gửi. Để bảo vệ thông tin cá nhân và chống truy cập trái phép (IDOR), hệ thống kiểm tra đồng thời Mã hồ sơ và Email đăng ký ở phía máy chủ.','Track the processing timeline of your submitted application. To protect personal privacy and prevent IDOR enumeration, the server verifies both Application Code and Registered Email.')}</p><div class="lookup-trust"><span>◇ ${bi('Xác thực 2 thông tin phía máy chủ','Dual-factor server-side verification')}</span><span>✓ ${bi('Không lộ câu trả lời chi tiết','Protects private form answers')}</span></div></div><div class="lookup-hero-art case-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="case-folder">▤<span>HỒ SƠ</span></div><div class="case-magnifier">⌕</div><div class="case-lock">◇</div></div></section>${renderSystemPageCmsZone('/ho-so')}<section class="lookup-search-panel case-search"><form id="caseForm" class="case-form"><div class="lookup-form-title"><span>▤</span><div><h2>${bi('Nhập thông tin xác minh hồ sơ','Enter Application Verification Details')}</h2><p>${bi('Vui lòng cung cấp đúng mã hồ sơ trên biên nhận và địa chỉ email đã dùng khi đăng ký.','Please enter the reference code from your receipt and the email address used during submission.')}</p></div></div><div class="field"><label for="caseCode">${bi('Mã hồ sơ *','Application Code *')}</label><input id="caseCode" value="${esc(init)}" placeholder="${bi('Ví dụ: SFN-TV-2026-0001','e.g., SFN-TV-2026-0001')}" autocomplete="off" required></div><div class="field"><label for="caseEmail">${bi('Email đã đăng ký *','Registered Email *')}</label><input id="caseEmail" type="email" placeholder="${bi('Nhập email đã dùng khi nộp hồ sơ','Enter registered email address')}" autocomplete="email" required></div><button class="portal-button" type="submit">⌕ &nbsp; ${bi('TRA CỨU HỒ SƠ','TRACK APPLICATION')} <span>→</span></button><p class="privacy-hint">${esc(t('lookup_policy_1'))} ${esc(t('lookup_policy_2'))}</p></form><div id="caseOut" aria-live="polite"></div></section>`;
  const f=document.getElementById('caseForm'),out=document.getElementById('caseOut');
  f.onsubmit=async e=>{e.preventDefault();out.innerHTML=`<div class="loading">${bi('Đang kiểm tra hồ sơ…','Checking application status…')}</div>`;const code=document.getElementById('caseCode').value.trim(),email=document.getElementById('caseEmail').value.trim();try{const d=await api('/api/lookup/submission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,email})});out.innerHTML=caseResult(d.item)}catch(err){out.innerHTML=failCard(bi('Không thể tra cứu hồ sơ với thông tin đã cung cấp. Vui lòng kiểm tra lại mã hồ sơ và email đăng ký.','Could not locate an application matching the provided code and email.'))}};
}

async function sponsorshipCenter(app,detailCode=''){
  updateActiveNav('sponsorship');
  await ensurePublicConfig();
  setMeta(bi('Minh bạch Tài trợ','Sponsorship Transparency'),'Công khai minh bạch các chương trình vận động tài trợ, số tiền cam kết, thực nhận, đã chi và báo cáo đối soát.');
  if(detailCode){
    try{
      const d=await api(`/api/public/sponsorship/${encodeURIComponent(detailCode)}`);
      const c=d.campaign,txs=d.transactions||[],reps=d.reports||[];
      app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">MINH BẠCH TÀI TRỢ · ${esc(c.code)}</span><h1>${esc(c.title)}</h1><p>${esc(c.summary||c.purpose||'Thông tin chi tiết chương trình tài trợ đã được phê duyệt công khai.')}</p><div class="actions"><a class="secondary" href="/tai-tro" style="color:#fff;border-color:#ffffff55;background:#ffffff1a;">← ${bi('Quay lại danh sách chương trình tài trợ','Back to Sponsorship Campaigns')}</a></div></section>
      <section class="dip-section tight">
        <div class="sponsorship-metrics-grid">
          <article class="sp-metric-card"><small>01 · ${bi('MỤC TIÊU TÀI TRỢ','TARGET AMOUNT')}</small><strong>${esc(fmtVnd(c.target_amount))}</strong><span>${bi('Kinh phí mục tiêu của đợt vận động','Campaign fundraising target')}</span></article>
          <article class="sp-metric-card"><small>02 · ${bi('SỐ TIỀN ĐÃ CAM KẾT','PLEDGED AMOUNT')}</small><strong>${esc(fmtVnd(c.pledged_amount))}</strong><span>${bi('Khoản cam kết (chưa tính vào thực nhận)','Pledged amount (separated from received)')}</span></article>
          <article class="sp-metric-card is-highlight"><small>03 · ${bi('SỐ TIỀN THỰC NHẬN','VERIFIED RECEIVED')}</small><strong>${esc(fmtVnd(c.received_amount))}</strong><span>${bi('Khoản đã thực tế tiếp nhận và xác minh','Verified net received amount')}</span></article>
          <article class="sp-metric-card"><small>04 · ${bi('SỐ TIỀN ĐÃ CHI','DISBURSED AMOUNT')}</small><strong>${esc(fmtVnd(c.disbursed_amount))}</strong><span>${bi('Khoản đã giải ngân theo mục đích','Verified disbursed amount')}</span></article>
          <article class="sp-metric-card ${Number(c.remaining_amount)<0?'is-overspent':''}"><small>05 · ${bi('SỐ DƯ CÒN LẠI','REMAINING BALANCE')}</small><strong style="${Number(c.remaining_amount)<0?'color:var(--dip-danger,#c62828)':''}">${esc(fmtVnd(c.remaining_amount))}</strong><span>${Number(c.remaining_amount)<0?bi('Cảnh báo: Chi vượt thực nhận','Alert: Disbursed exceeds received'):bi('Tính theo: Thực nhận trừ Đã chi','Formula: Received minus Disbursed')}</span></article>
        </div>
        ${Number(c.remaining_amount)<0?`<div class="notice bad" role="alert" style="margin-top:16px;"><b>${bi('Cảnh báo đối soát tài chính:','Financial Reconciliation Alert:')}</b> ${bi('Tổng số tiền đã giải ngân đang vượt quá số tiền thực nhận đã xác minh','Total disbursed amount currently exceeds verified received funds')} (${esc(fmtVnd(c.remaining_amount))}).</div>`:''}
        <div class="card" style="margin-top:20px;">
          <h3>${bi('Thông tin chương trình & nguyên tắc đối soát','Campaign Details & Reconciliation Policy')}</h3>
          <p><b>${bi('Mục đích sử dụng:','Purpose:')}</b> ${esc(c.purpose||c.summary||'Theo kế hoạch chương trình đã phê duyệt.')}</p>
          <p><b>${bi('Thời gian thực hiện:','Timeline:')}</b> ${esc(c.start_at?fmt(c.start_at):'Đang cập nhật')} — ${esc(c.end_at?fmt(c.end_at):'Đang cập nhật')} · <b>${bi('Cập nhật lần cuối:','Last Updated:')}</b> ${esc(fmt(c.updated_at))}</p>
          ${(Number(c.pending_amount||0)>0||Number(c.refunded_amount||0)>0||Number(c.adjusted_amount||0)!==0)?`<p class="small muted"><b>${bi('Chỉ số đối soát mở rộng:','Extended Reconciliation Metrics:')}</b> ${bi('Chờ xác minh:','Pending:')} ${esc(fmtVnd(c.pending_amount||0))} · ${bi('Hoàn trả:','Refunded:')} ${esc(fmtVnd(c.refunded_amount||0))} · ${bi('Điều chỉnh:','Adjusted:')} ${esc(fmtVnd(c.adjusted_amount||0))}</p>`:''}
        </div>
        ${c.status==='active'?`<div class="card" style="margin-top:20px;">
          <h3>${bi('Tạo mã VietQR tham chiếu chuyển khoản ủng hộ','Generate VietQR & Bank Transfer Reference Code')}</h3>
          <p class="small muted">${bi('Mỗi phiên ủng hộ được cấp một mã tham chiếu duy nhất để đối soát tự động hoặc xác minh chứng từ. Việc tạo mã QR hoặc nhấn báo đã chuyển khoản không tự động cộng vào Số tiền thực nhận cho đến khi giao dịch được xác thực đối soát.','Each transfer intent receives a unique reference code for bank statement or webhook reconciliation. Generating a QR or reporting a transfer never increases Verified Received Amount until reconciled.')}</p>
          <form id="spQrIntentForm" class="row2" style="margin-top:12px;align-items:end;">
            <div class="field"><label for="spDonorName">${bi('Tên hiển thị công khai (hoặc ẩn danh)','Public Donor Label (or Anonymous)')}</label><input id="spDonorName" placeholder="Nhà hảo tâm ẩn danh"></div>
            <div class="field"><label for="spExpectedAmount">${bi('Số tiền dự kiến ủng hộ (VND) *','Expected Amount (VND) *')}</label><input id="spExpectedAmount" type="number" min="1000" step="1000" value="100000" required></div>
            <div><button type="submit" class="portal-button">▦ ${bi('Tạo mã QR & Mã tham chiếu','Generate QR & Reference')}</button></div>
          </form>
          <div id="spQrIntentOut" style="margin-top:14px;" aria-live="polite"></div>
        </div>`:''}
        <h2 style="margin:32px 0 14px;">${bi('Nhật ký giao dịch thu / chi công khai đã xác minh','Verified Public Receipt & Disbursement Ledger')}</h2>
        ${txs.length?`<div class="card table-scroll"><table><thead><tr><th>${bi('Mã GD','TX Code')}</th><th>${bi('Loại chỉ tiêu','Type')}</th><th>${bi('Nội dung / Đơn vị (đã ẩn dữ liệu nhạy cảm)','Public Party & Purpose')}</th><th>${bi('Số tiền','Amount')}</th><th>${bi('Thời gian','Timestamp')}</th><th>${bi('Chứng từ','Voucher')}</th></tr></thead><tbody>${txs.map(tx=>`<tr><td><b>${esc(tx.tx_code)}</b></td><td><span class="status">${esc(tx.tx_type==='pledge'?'Cam kết':tx.tx_type==='receipt'?'Thực nhận (Thu)':tx.tx_type==='disbursement'?'Giải ngân (Chi)':tx.tx_type)}</span></td><td><b>${esc(tx.public_party_label)}</b><br><span class="small muted">${esc(tx.purpose||'')}</span></td><td><b>${esc(fmtVnd(tx.amount))}</b></td><td>${esc(fmt(tx.occurred_at))}</td><td>${tx.voucher_file_id?`<a href="/api/files/${encodeURIComponent(tx.voucher_file_id)}" target="_blank" rel="noopener">${bi('Xem chứng từ ↗','View Voucher ↗')}</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Chưa có giao dịch công khai nào được công bố cho chương trình này.')}
        <h2 style="margin:32px 0 14px;">${bi('Báo cáo & chứng từ tổng hợp','Published Financial Reports')}</h2>
        ${reps.length?`<div class="resource-list">${reps.map(r=>`<article><i>▤</i><div><span>${bi('KỲ BÁO CÁO:','PERIOD:')} ${esc(r.report_period||'Tổng hợp')}</span><h3>${esc(r.title)}</h3><p class="small muted">${esc(r.summary||'')}</p></div>${r.file_id?`<a class="portal-button" href="/api/files/${encodeURIComponent(r.file_id)}" target="_blank" rel="noopener">${bi('Mở báo cáo →','Open Report →')}</a>`:''}</article>`).join('')}</div>`:empty('Chưa có báo cáo định kỳ được xuất bản cho chương trình này.')}
      </section>`;
      const qrForm=document.getElementById('spQrIntentForm'),qrOut=document.getElementById('spQrIntentOut');
      if(qrForm&&qrOut){
        qrForm.onsubmit=async ev=>{
          ev.preventDefault();
          const donor=document.getElementById('spDonorName')?.value.trim()||'Nhà hảo tâm ẩn danh';
          const amt=Number(document.getElementById('spExpectedAmount')?.value||0);
          qrOut.innerHTML='<div class="loading">Đang khởi tạo mã tham chiếu đối soát…</div>';
          try{
            const res=await api(`/api/public/sponsorship/${encodeURIComponent(c.code)}/qr-intent`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({donor_name:donor,expected_amount:amt})});
            const it=res.intent;
            qrOut.innerHTML=`<div class="notice">
              <p><b>Mã tham chiếu đối soát (Nội dung chuyển khoản):</b> <code>${esc(it.reference_code)}</code> · <b>Số tiền:</b> ${esc(fmtVnd(it.expected_amount))}</p>
              <p class="small muted">${esc(it.notice||'')}</p>
              ${it.qr_image_url?`<div style="margin:10px 0;"><img src="${esc(it.qr_image_url)}" alt="Mã QR chuyển khoản ${esc(it.reference_code)}" style="max-width:220px;border-radius:12px;border:1px solid #dbe4f0;"></div>`:''}
              <button type="button" class="secondary" id="spReportTransferBtn">Tôi đã hoàn tất chuyển khoản (Gửi yêu cầu đối soát)</button>
            </div>`;
            document.getElementById('spReportTransferBtn')?.addEventListener('click',async()=>{
              try{
                const rep=await api(`/api/public/sponsorship/intents/${encodeURIComponent(it.reference_code)}/report-transfer`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({note:'Người ủng hộ xác nhận đã chuyển khoản trên cổng công khai'})});
                qrOut.innerHTML=`<div class="notice">${esc(rep.message||'Đã ghi nhận thông báo chuyển khoản chờ đối soát.')}</div>`;
              }catch(e2){}
            });
          }catch(e1){qrOut.innerHTML=failCard(e1.message);}
        };
      }
      return;
    }catch(err){
      app.innerHTML=lookupShell('MINH BẠCH TÀI TRỢ','Không tìm thấy chương trình tài trợ yêu cầu.')+`<section class="dip-section tight">${failCard(err.message)}<div class="actions" style="margin-top:16px;"><a class="portal-button" href="/tai-tro">Quay lại trang Tài trợ →</a></div></section>`;
      return;
    }
  }
  const d=await api('/api/public/sponsorship');
  const s=d.summary||{}, campaigns=d.campaigns||[], txs=d.transactions||[], reports=d.reports||[];
  app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">MINH BẠCH TÀI CHÍNH & TÀI TRỢ</span><h1>${bi('CÔNG KHAI','PUBLIC')} <strong>${bi('TÀI TRỢ','SPONSORSHIP')}</strong></h1><p>${bi('Module minh bạch tài trợ độc lập của Hệ thống Thông tin Số Sky First. Phân biệt rõ ràng 5 chỉ tiêu: Mục tiêu tài trợ, Số tiền đã cam kết, Số tiền thực nhận, Số tiền đã chi và Số tiền còn lại.','Independent financial transparency module of the Sky First Digital Information System, strictly separating Target, Pledged, Verified Received, Disbursed, and Remaining Balance.')}</p></section>
  ${renderSystemPageCmsZone('/tai-tro')}
  <section class="dip-section tight">
    ${s.has_data?`
      <div class="sponsorship-metrics-grid">
        <article class="sp-metric-card"><small>01 · ${bi('MỤC TIÊU TÀI TRỢ','TARGET AMOUNT')}</small><strong>${esc(fmtVnd(s.target_amount))}</strong><span>${bi('Tổng mục tiêu các chương trình công khai','Total public campaign target')}</span></article>
        <article class="sp-metric-card"><small>02 · ${bi('SỐ TIỀN ĐÃ CAM KẾT','PLEDGED AMOUNT')}</small><strong>${esc(fmtVnd(s.pledged_amount))}</strong><span>${bi('Khoản cam kết (tách biệt với thực nhận)','Pledged funds (separate from received)')}</span></article>
        <article class="sp-metric-card is-highlight"><small>03 · ${bi('SỐ TIỀN THỰC NHẬN','VERIFIED RECEIVED')}</small><strong>${esc(fmtVnd(s.received_amount))}</strong><span>${bi('Tổng tiền thực nhận đã xác minh','Total verified received funds')}</span></article>
        <article class="sp-metric-card"><small>04 · ${bi('SỐ TIỀN ĐÃ CHI','DISBURSED AMOUNT')}</small><strong>${esc(fmtVnd(s.disbursed_amount))}</strong><span>${bi('Tổng tiền đã giải ngân có đối soát','Total verified disbursed funds')}</span></article>
        <article class="sp-metric-card ${Number(s.remaining_amount)<0?'is-overspent':''}"><small>05 · ${bi('SỐ DƯ CÒN LẠI','REMAINING BALANCE')}</small><strong style="${Number(s.remaining_amount)<0?'color:var(--dip-danger,#c62828)':''}">${esc(fmtVnd(s.remaining_amount))}</strong><span>${bi('Bằng: Số tiền thực nhận trừ Số tiền đã chi','Formula: Verified Received minus Disbursed')}</span></article>
      </div>
      <p class="small muted" style="margin:12px 0 28px;">${bi('Thời điểm cập nhật dữ liệu gần nhất:','Last data update:')} <b>${esc(s.updated_at?fmt(s.updated_at):'Đang cập nhật')}</b> · ${bi('Đơn vị tiền tệ:','Currency:')} <b>Đồng Việt Nam (VND)</b>.</p>
      ${sectionHead('01 · CHƯƠNG TRÌNH & ĐỢT VẬN ĐỘNG',bi('Danh sách chương trình tài trợ công khai','Public Sponsorship Campaigns'),bi('Chọn từng chương trình để xem chi tiết các khoản thu, chi, mã QR đối soát và chứng từ đã được phê duyệt công bố.','Select a campaign to inspect verified receipts, disbursements, VietQR transfer references, and vouchers.'))}
      <div class="program-catalog-grid">${campaigns.map(c=>`<article class="program-card"><div class="program-card-body"><span class="content-tag">${esc(c.code)}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary||c.purpose||'')}</p><div class="sp-card-figures"><div><span>${bi('Mục tiêu:','Target:')}</span> <b>${esc(fmtVnd(c.target_amount))}</b></div><div><span>${bi('Cam kết:','Pledged:')}</span> <b>${esc(fmtVnd(c.pledged_amount))}</b></div><div><span>${bi('Thực nhận:','Received:')}</span> <b style="color:var(--dip-success)">${esc(fmtVnd(c.received_amount))}</b></div><div><span>${bi('Đã chi:','Disbursed:')}</span> <b>${esc(fmtVnd(c.disbursed_amount))}</b></div></div><div class="program-card-foot"><span class="program-status is-active"><i></i>${esc(c.status==='active'?bi('Đang triển khai','Active'):c.status==='completed'?bi('Đã hoàn thành','Completed'):c.status)}</span><a href="/tai-tro/${encodeURIComponent(c.code)}">${bi('Xem đối soát & chứng từ','View Ledger & Vouchers')} <b>→</b></a></div></div></article>`).join('')}</div>
      <div style="margin-top:40px;">
        ${sectionHead('02 · BẢNG SAO KÊ ĐỐI SOÁT CÔNG KHAI',bi('Giao dịch thu / chi đã xác minh','Verified Public Transactions'),bi('Chỉ hiển thị các bút toán đã qua đối soát sao kê ngân hàng hoặc phê duyệt hai bước.','Displays only transactions verified via bank statement reconciliation or two-step approval.'))}
        ${txs.length?`<div class="card table-scroll"><table><thead><tr><th>${bi('Mã GD','TX Code')}</th><th>${bi('Chiến dịch','Campaign')}</th><th>${bi('Loại','Type')}</th><th>${bi('Đơn vị / Nội dung','Party & Purpose')}</th><th>${bi('Số tiền','Amount')}</th><th>${bi('Thời gian','Date')}</th></tr></thead><tbody>${txs.slice(0,25).map(tx=>`<tr><td><b>${esc(tx.tx_code)}</b></td><td><code>${esc(tx.campaign_code||'')}</code></td><td><span class="status">${esc(tx.tx_type)}</span></td><td><b>${esc(tx.public_party_label)}</b><br><small class="muted">${esc(tx.purpose||'')}</small></td><td><b>${esc(fmtVnd(tx.amount))}</b></td><td>${esc(fmt(tx.occurred_at))}</td></tr>`).join('')}</tbody></table></div>`:empty(bi('Chưa có bút toán sao kê công khai.','No public ledger transactions yet.'))}
      </div>
      <div style="margin-top:40px;">
        ${sectionHead('03 · BÁO CÁO CÔNG KHAI & CHỨNG TỪ',bi('Báo cáo tài chính & chứng từ định kỳ','Periodic Financial Reports & Vouchers'),bi('Các báo cáo định kỳ đã được kiểm tra và phê duyệt công khai.','Periodic audit and financial reports approved for public disclosure.'))}
        ${reports.length?`<div class="resource-list">${reports.map(r=>`<article><i>▤</i><div><span>${esc(r.campaign_code)} · ${esc(r.report_period||'Báo cáo')}</span><h3>${esc(r.title)}</h3></div>${r.file_id?`<a class="portal-button" href="/api/files/${encodeURIComponent(r.file_id)}" target="_blank" rel="noopener">${bi('Xem tài liệu →','View PDF →')}</a>`:''}</article>`).join('')}</div>`:empty(bi('Chưa có báo cáo tài chính định kỳ được xuất bản.','No periodic financial reports published yet.'))}
      </div>
    `:`
      <div class="beautiful-empty" style="margin-bottom:28px;">
        <i>♡</i>
        <div>
          <h3>Chưa có dữ liệu tài trợ công khai</h3>
          <p>${bi('Hiện tại chưa có chương trình vận động tài trợ hoặc báo cáo tài chính nào được phê duyệt công bố. Hệ thống tuân thủ nguyên tắc minh bạch: không hiển thị số liệu giả lập, không gộp tiền cam kết với tiền thực nhận và chỉ công bố sau khi đã qua quy trình đối soát.','There are currently no public sponsorship campaigns or financial reports approved for disclosure. The system strictly prohibits synthetic figures, separates pledged from received amounts, and only publishes verified records.')}</p>
        </div>
      </div>
      <div class="public-benefits">
        <article><i>01</i><h3>${bi('Tách biệt Cam kết & Thực nhận','Separate Pledged & Received')}</h3><p>${bi('Số tiền cam kết và số tiền thực nhận được theo dõi và hiển thị thành hai chỉ tiêu độc lập, tuyệt đối không cộng gộp.','Pledged and verified received amounts are tracked as independent indicators and never merged.')}</p></article>
        <article><i>02</i><h3>${bi('Đối soát trước khi công bố','Reconciled Before Disclosure')}</h3><p>${bi('Mọi khoản thu, khoản chi và báo cáo chứng từ phải được quản trị viên có thẩm quyền xác minh trước khi hiển thị công khai.','Every receipt, disbursement, and report must be verified by an authorized administrator prior to public display.')}</p></article>
        <article><i>03</i><h3>${bi('Bảo vệ dữ liệu nhà tài trợ','Donor Privacy Protection')}</h3><p>${bi('Không công khai số tài khoản cá nhân, số định danh hoặc thông tin liên hệ riêng tư của nhà tài trợ.','Personal bank accounts, IDs, and private contact details of donors are never exposed publicly.')}</p></article>
      </div>
    `}
  </section>`;
  event('route_view',{category:'sponsorship'});
}

async function safetyCenter(app){
  updateActiveNav('safety');
  await ensurePublicConfig();
  setMeta(bi('An toàn & Bảo mật số','Digital Safety & Security'),'Hướng dẫn bảo vệ tài khoản, cảnh báo mạo danh lừa đảo, chính sách quyền riêng tư và kênh báo cáo sự cố an toàn.');
  app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('AN TOÀN','DIGITAL SAFETY')} <strong>${bi('& BẢO MẬT SỐ','& SECURITY')}</strong></h1><p>${bi('Hướng dẫn sử dụng hệ thống an toàn, bảo vệ dữ liệu cá nhân, nhận diện các hình thức mạo danh và kênh tiếp nhận báo cáo sự cố bảo mật chính thức.','Guidelines for safe system usage, personal data protection, anti-impersonation verification, and official security incident reporting.')}</p></section>
  ${renderSystemPageCmsZone('/an-toan')}
  <section class="dip-section tight">
    <div class="public-benefits">
      <article>
        <i>◇</i>
        <h3>${bi('1. Bảo vệ tài khoản & thông tin xác thực','1. Account & Authentication Security')}</h3>
        <p>${bi('Sử dụng mật khẩu tối thiểu 10 ký tự và bật xác thực hai bước (2FA/TOTP) đối với tài khoản quản trị. Tuyệt đối không chia sẻ mã OTP, liên kết kích hoạt tài khoản hoặc liên kết đặt lại mật khẩu cho bất kỳ ai.','Use passwords of at least 10 characters and enable 2FA/TOTP for administrative accounts. Never share OTP codes or activation links.')}</p>
      </article>
      <article>
        <i>!</i>
        <h3>${bi('2. Cảnh báo mạo danh & lừa đảo','2. Anti-Impersonation & Fraud Alert')}</h3>
        <p>${bi('Sky First không bao giờ yêu cầu người dùng chuyển tiền để mua vị trí, chức danh hay giấy chứng nhận, và không bao giờ yêu cầu cung cấp mật khẩu qua email hoặc tin nhắn. Chỉ tin cậy tên miền chính thức ','Sky First never charges fees for positions or certificates and never asks for passwords via email. Only trust official domains ')}<b>app.skyfirst.io.vn</b> & <b>skyfirst.io.vn</b>.</p>
      </article>
      <article>
        <i>▣</i>
        <h3>${bi('3. Quyền riêng tư & Dữ liệu cá nhân','3. Privacy & Personal Data Protection')}</h3>
        <p>${bi('Hệ thống chỉ thu thập dữ liệu cần thiết cho nghiệp vụ đăng ký, xử lý hồ sơ và xác thực chứng nhận. Mã hồ sơ chỉ hiển thị tiến trình khi xác minh đúng email đăng ký tại phía máy chủ.','The system collects only data required for application processing and credential verification, enforcing server-side email verification on case lookups.')}</p>
      </article>
    </div>

    <div class="admin-grid2" style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:22px;" id="privacy">
      <div class="card">
        <span class="section-kicker">${bi('HƯỚNG DẪN XỬ LÝ KHẨN CẤP','EMERGENCY RESPONSE GUIDE')}</span>
        <h2>${bi('Khi nghi ngờ lộ thông tin hoặc bị truy cập trái phép','If You Suspect Unauthorized Access or Impersonation')}</h2>
        <ol style="line-height:1.8;padding-left:20px;color:var(--dip-ink);">
          <li>${bi('Đổi mật khẩu ngay lập tức và sử dụng chức năng “Đăng xuất tất cả thiết bị” để thu hồi toàn bộ phiên đăng nhập đang hoạt động.','Change your password immediately and use "Revoke All Sessions" to invalidate active sessions.')}</li>
          <li>${bi('Kiểm tra lại địa chỉ người gửi email: hệ thống tự động chỉ gửi từ ','Verify sender addresses: automated emails only come from ')}<code>app@skyfirst.io.vn</code>; ${bi('hỗ trợ kỹ thuật tại ','technical support at ')}<code>support@skyfirst.io.vn</code>; ${bi('liên hệ chung tại ','general inquiries at ')}<code>lienhe@skyfirst.io.vn</code>.</li>
          <li>${bi('Nếu phát hiện trang web giả mạo, đường dẫn lạ hoặc nghi ngờ lộ dữ liệu hồ sơ, hãy gửi báo cáo ngay qua biểu mẫu bên cạnh.','If you detect a phishing page or suspicious link, submit an incident report using the form alongside.')}</li>
        </ol>
        <div class="notice" style="margin-top:16px;">
          <b>${bi('Kênh liên hệ trực tiếp:','Direct Contact Channels:')}</b><br>
          • ${bi('Hỗ trợ kỹ thuật & bảo mật:','Technical & Security Support:')} <a href="mailto:support@skyfirst.io.vn">support@skyfirst.io.vn</a><br>
          • ${bi('Liên hệ chung:','General Contact:')} <a href="mailto:lienhe@skyfirst.io.vn">lienhe@skyfirst.io.vn</a>
        </div>
      </div>

      <div class="card">
        <span class="section-kicker">${bi('KÊNH TIẾP NHẬN CHÍNH THỨC','OFFICIAL REPORTING CHANNEL')}</span>
        <h2>Báo cáo sự cố an toàn, giả mạo hoặc quyền riêng tư</h2>
        <p class="small muted">${bi('Không nhập mật khẩu, khóa bí mật hoặc token xác thực vào nội dung báo cáo.','Never include passwords, secret keys, or authentication tokens in the report body.')}</p>
        <form id="safetyReportForm">
          <div class="row2">
            <div class="field">
              <label for="srCategory">${bi('Phân loại sự cố *','Incident Category *')}</label>
              <select id="srCategory" required>
                <option value="Giả mạo / Lừa đảo">${bi('Cảnh báo trang / tài khoản giả mạo','Impersonation / Phishing Alert')}</option>
                <option value="Truy cập trái phép">${bi('Nghi ngờ truy cập trái phép tài khoản','Suspected Unauthorized Account Access')}</option>
                <option value="Lộ dữ liệu / Quyền riêng tư">${bi('Vấn đề quyền riêng tư / dữ liệu cá nhân','Privacy / Personal Data Issue')}</option>
                <option value="Lỗi bảo mật kỹ thuật">${bi('Báo cáo lỗ hổng / lỗi an toàn kỹ thuật','Technical Vulnerability Report')}</option>
                <option value="Khác">${bi('Vấn đề an toàn khác','Other Safety Issue')}</option>
              </select>
            </div>
            <div class="field">
              <label for="srSeverity">${bi('Mức độ ưu tiên *','Severity *')}</label>
              <select id="srSeverity" required>
                <option value="Trung bình">${bi('Trung bình','Medium')}</option>
                <option value="Cao">${bi('Cao','High')}</option>
                <option value="Khẩn cấp">${bi('Khẩn cấp','Critical')}</option>
                <option value="Thấp">${bi('Thấp','Low')}</option>
              </select>
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <label for="srName">${bi('Họ và tên người báo cáo','Reporter Name')}</label>
              <input id="srName" placeholder="${bi('Có thể để trống nếu báo cáo ẩn danh','Optional (can report anonymously)')}">
            </div>
            <div class="field">
              <label for="srEmail">${bi('Email nhận phản hồi','Contact Email')}</label>
              <input id="srEmail" type="email" placeholder="name@example.com">
            </div>
          </div>
          <div class="field">
            <label for="srTitle">${bi('Tiêu đề sự cố *','Incident Title *')}</label>
            <input id="srTitle" required minlength="5" maxlength="200" placeholder="${bi('Tóm tắt ngắn gọn vấn đề phát hiện','Brief summary of the issue')}">
          </div>
          <div class="field">
            <label for="srUrl">${bi('Đường dẫn (URL) hoặc mã hồ sơ liên quan','Affected URL or Reference Code')}</label>
            <input id="srUrl" maxlength="400" placeholder="https://...">
          </div>
          <div class="field">
            <label for="srDesc">${bi('Mô tả chi tiết *','Detailed Description *')}</label>
            <textarea id="srDesc" rows="4" required minlength="10" maxlength="4000" placeholder="${bi('Mô tả thời điểm, dấu hiệu phát hiện và nội dung cần kiểm tra (không ghi mật khẩu)...','Describe when and how the issue was observed (do not include passwords)...')}"></textarea>
          </div>
          <button type="submit" class="portal-button" id="srSubmitBtn">${bi('Gửi báo cáo an toàn →','Submit Safety Report →')}</button>
        </form>
        <div id="srResult" aria-live="polite" style="margin-top:14px;"></div>
      </div>
    </div>
  </section>`;

  const form=document.getElementById('safetyReportForm'), out=document.getElementById('srResult'), btn=document.getElementById('srSubmitBtn');
  form.onsubmit=async e=>{
    e.preventDefault();
    btn.disabled=true; btn.textContent=bi('Đang gửi báo cáo…','Submitting report…'); out.innerHTML='';
    try{
      const r=await api('/api/public/safety-reports',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          category:document.getElementById('srCategory').value,
          severity:document.getElementById('srSeverity').value,
          reporter_name:document.getElementById('srName').value.trim(),
          reporter_email:document.getElementById('srEmail').value.trim(),
          title:document.getElementById('srTitle').value.trim(),
          affected_url:document.getElementById('srUrl').value.trim(),
          description:document.getElementById('srDesc').value.trim()
        })
      });
      form.reset();
      out.innerHTML=`<div class="notice good"><b>${bi('Đã tiếp nhận báo cáo an toàn:','Safety report received:')} ${esc(r.code)}</b><br>${esc(r.message)}</div>`;
    }catch(err){
      out.innerHTML=failCard(err.message);
    }finally{
      btn.disabled=false; btn.textContent=bi('Gửi báo cáo an toàn →','Submit Safety Report →');
    }
  };
  event('route_view',{category:'safety'});
}

function renderVisualBlock(b={}){
  const type=b.type||'paragraph';
  const align=b.align||'left';
  const style=`text-align:${esc(align)};`;
  if(type==='shared_block'){
    const sbList = cachedPublicConfig?.shared_blocks || [];
    const found = sbList.find(s => s.key === (b.sharedKey || b.key) || s.id === (b.sharedId || b.id));
    if (found && found.config) {
      const cfg = found.config;
      return renderVisualBlock({
        ...cfg,
        type: found.block_type || cfg.type || 'callout',
        title: bi(cfg.title || found.name, cfg.title_en || cfg.title || found.name),
        text: bi(cfg.text || '', cfg.text_en || cfg.text || ''),
        ctaText: bi(cfg.ctaText || '', cfg.ctaText_en || cfg.ctaText || '')
      });
    }
  }
  if(type==='hero'){
    return `<section class="cms-block cms-block-hero" style="${style}"><h2>${esc(b.title||'')}</h2>${b.subtitle?`<p>${esc(b.subtitle)}</p>`:''}${b.ctaText?`<a class="portal-button" href="${esc(b.ctaHref||'#')}">${esc(b.ctaText)} →</a>`:''}</section>`;
  }
  if(type==='heading'){
    const tag=['h1','h2','h3'].includes(b.level)?b.level:'h2';
    return `<${tag} class="cms-block cms-block-heading" style="${style}">${esc(b.text||b.title||'')}</${tag}>`;
  }
  if(type==='paragraph'){
    return `<div class="cms-block cms-block-paragraph" style="${style}">${esc(b.text||'').replace(/\n/g,'<br>')}</div>`;
  }
  if(type==='callout'||type==='guide'){
    const tone=['good','warn','bad','info'].includes(b.tone)?b.tone:'';
    return `<div class="cms-block notice ${tone}"><b>${esc(b.title||(type==='guide'?'Hướng dẫn thực hiện':'Thông báo'))}</b><p style="margin:6px 0 0;white-space:pre-line;">${esc(b.text||'')}</p></div>`;
  }
  if(type==='cta'){
    return `<div class="cms-block card" style="${style};display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;"><div><h3 style="margin:0 0 4px">${esc(b.title||'')}</h3><p class="muted" style="margin:0">${esc(b.text||'')}</p></div>${b.ctaText?`<a class="portal-button" href="${esc(b.ctaHref||b.href||'/bieu-mau')}">${esc(b.ctaText)} →</a>`:''}</div>`;
  }
  if(type==='image'){
    const src=b.url||(b.fileId?`/api/files/${encodeURIComponent(b.fileId)}`:'');
    return src?`<figure class="cms-block cms-block-image" style="${style}"><img src="${esc(src)}" alt="${esc(b.alt||b.caption||'Hình ảnh')}" style="max-width:100%;border-radius:16px;">${b.caption?`<figcaption class="small muted">${esc(b.caption)}</figcaption>`:''}</figure>`:'';
  }
  if(type==='video'){
    const src=b.url||b.href||'';
    return `<div class="cms-block card" style="${style}"><h3>${esc(b.title||'Video giới thiệu')}</h3>${src?`<p><a class="portal-button" href="${esc(src)}" target="_blank" rel="noopener">▶ Mở video (${esc(src)}) ↗</a></p>`:`<p class="muted">${esc(b.text||'')}</p>`}</div>`;
  }
  if(type==='button'){
    return `<div class="cms-block" style="${style}"><a class="portal-button" href="${esc(b.href||'#')}">${esc(b.label||b.text||'Xem chi tiết')} →</a></div>`;
  }
  if(type==='list'){
    const items=Array.isArray(b.items)?b.items:String(b.text||'').split(/\r?\n/).filter(Boolean);
    return `<ul class="cms-block cms-block-list">${items.map(it=>`<li>${esc(it)}</li>`).join('')}</ul>`;
  }
  if(type==='table'){
    const headers=Array.isArray(b.headers)?b.headers:['Cột 1','Cột 2'];
    const rows=Array.isArray(b.rows)?b.rows:[];
    return `<div class="cms-block card table-scroll">${b.title?`<h3 style="margin-top:0">${esc(b.title)}</h3>`:''}<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${(Array.isArray(r)?r:[]).map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if(type==='columns'||type==='grid'){
    const cols=Array.isArray(b.columns)?b.columns:(Array.isArray(b.items)?b.items:[]);
    return `<div class="cms-block cms-block-columns" style="display:grid;grid-template-columns:repeat(${Math.max(1,Math.min(4,cols.length||2))},1fr);gap:18px;">${cols.map(c=>`<div class="card"><h3>${esc(c.title||'')}</h3><p>${esc(c.body||c.text||'')}</p></div>`).join('')}</div>`;
  }
  if(type==='stats'){
    const items=Array.isArray(b.items)?b.items:[];
    return `<div class="cms-block card">${b.title?`<h3 style="margin-top:0">${esc(b.title)}</h3>`:''}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">${items.map(it=>`<div class="sp-metric-card"><small>${esc(it.label||'')}</small><strong>${esc(it.value||'—')}</strong></div>`).join('')}</div></div>`;
  }
  if(type==='faq'||type==='accordion'){
    const items=Array.isArray(b.items)?b.items:[];
    return `<section class="cms-block faq-v3">${b.title?`<h3>${esc(b.title)}</h3>`:''}${items.map(it=>`<details><summary>${esc(it.q||it.title||'Câu hỏi')}</summary><p>${esc(it.a||it.body||it.text||'')}</p></details>`).join('')}</section>`;
  }
  if(type==='tabs'){
    const items=Array.isArray(b.items)?b.items:[];
    return `<div class="cms-block card">${b.title?`<h3>${esc(b.title)}</h3>`:''}<div style="display:grid;gap:12px;">${items.map(it=>`<div style="padding:12px;border:1px solid var(--dip-line,#e2e8f0);border-radius:12px;"><b>${esc(it.title||it.label||'Mục')}</b><p style="margin:6px 0 0">${esc(it.body||it.text||'')}</p></div>`).join('')}</div></div>`;
  }
  if(type==='timeline'){
    const items=Array.isArray(b.items)?b.items:[];
    return `<div class="cms-block card">${b.title?`<h3 style="margin-top:0">${esc(b.title)}</h3>`:''}<div class="timeline">${items.map((it,idx)=>`<div class="done"><i>${idx+1}</i><span><b>${esc(it.time?`${it.time} · ${it.title||''}`:(it.title||''))}</b><small>${esc(it.desc||it.text||'')}</small></span></div>`).join('')}</div></div>`;
  }
  if(type==='dynamic_list'){
    const source=b.source||'programs';
    const hrefMap={programs:'/chuong-trinh',events:'/su-kien',documents:'/tai-lieu',forms:'/bieu-mau',sponsorship:'/tai-tro'};
    return `<div class="cms-block card"><h3>${esc(b.title||'Danh sách dữ liệu động')}</h3><p class="muted">${esc(b.text||`Được kết xuất tự động từ phân hệ ${source} trên cơ sở dữ liệu D1.`)}</p><a class="portal-button" href="${esc(hrefMap[source]||'/')}">${bi('Xem danh sách trực tiếp →','Open Live Directory →')}</a></div>`;
  }
  if(type==='pdf_embed'){
    const fid=b.fileId||b.documentId||'';
    const src=fid.startsWith('/')?fid:(fid?`/api/files/${encodeURIComponent(fid)}`:'');
    return `<div class="cms-block card"><h3>${esc(b.title||'Tài liệu PDF đính kèm')}</h3>${src?`<iframe src="${esc(src)}" title="${esc(b.title||'PDF')}" style="width:100%;height:560px;border:1px solid var(--dip-line);border-radius:12px;"></iframe><div class="actions"><a class="portal-button" href="${esc(src)}?download=1">${bi('Tải xuống PDF →','Download PDF →')}</a></div>`:`<p class="muted">Tài liệu PDF chưa được gắn hoặc tạm thời không khả dụng.</p>`}</div>`;
  }
  if(type==='form_embed'){
    const fid=b.formId||'member';
    return `<div class="cms-block card"><h3>${esc(b.title||'Biểu mẫu trực tuyến')}</h3><p class="muted">${bi('Nhấn vào nút bên dưới để mở và điền biểu mẫu trực tuyến.','Click below to open and complete the online electronic form.')}</p><a class="portal-button" href="/#form/${encodeURIComponent(fid)}">Mở biểu mẫu (${esc(fid)}) →</a></div>`;
  }
  return '';
}

async function cmsPageCenter(app,slug=''){
  try{
    const d=await api(`/api/public/pages/${encodeURIComponent(slug)}?lang=${encodeURIComponent(getLang())}`);
    const page=d.item;
    setMeta(page.seo?.meta_title||page.title, page.seo?.meta_description||page.summary||'Trang nội dung Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">${esc(page.category||'TRANG NỘI DUNG')}</span><h1>${esc(page.title)}</h1>${page.summary?`<p>${esc(page.summary)}</p>`:''}</section>
    <section class="dip-section tight"><div class="cms-rendered-page" style="display:grid;gap:20px;max-width:980px;margin:0 auto;">${(page.blocks||[]).map(renderVisualBlock).join('')}</div></section>`;
  }catch(err){
    app.innerHTML=lookupShell(bi('KHÔNG TÌM THẤY TRANG','PAGE NOT FOUND'),bi('Trang nội dung này chưa được xuất bản hoặc đường dẫn không tồn tại.','This page has not been published or the URL does not exist.'))+`<section class="dip-section tight"><a class="portal-button" href="/">${bi('Về Trang chủ →','Back to Home →')}</a></section>`;
  }
}

async function programsPage(app,kind,detailId=''){
  await ensurePublicConfig();
  if(kind==='units'){
    const d=await api('/api/public/units');const items=d.items||[];setMeta(bi('Đơn vị & Đối tác','Units & Partners'),'Các đơn vị trực thuộc và đồng hành trong Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-ecosystem"><div class="catalog-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('ĐƠN VỊ','UNITS')} <strong>${bi('& ĐỐI TÁC','& PARTNERS')}</strong></h1><p>${bi('Danh sách đơn vị trực thuộc và đối tác đồng hành được ghi nhận chính thức trên hệ thống.','Official member units and partners registered in the Sky First system.')}</p></div>${sceneArt('globe')}</section><section class="catalog-section"><div class="ecosystem-detail-grid">${items.map(x=>`<article class="ecosystem-detail-card"><span>${esc(x.code||'Sky First')}</span><h3>${esc(x.name)}</h3><p>${esc(x.unit_type||'')}</p><small>${esc(publicStatusLabel(x.status||'Đang hoạt động'))}</small></article>`).join('')||empty('Chưa có đơn vị công khai.')}</div></section>`;return;
  }
  if(kind==='classes'){
    updateActiveNav('programs');
    const d=await api('/api/public/classes');const items=visiblePublicItems(d.items||[]).sort(comparePrograms);const selected=detailId?items.find(x=>String(x.id)===String(detailId)):null;
    if(detailId){
      if(!selected){setMeta('Không tìm thấy chương trình','Chương trình không tồn tại hoặc chưa được công khai.');app.innerHTML=`<section class="detail-missing"><div>${sceneArt('program')}</div><span class="section-kicker">CHƯƠNG TRÌNH Sky First</span><h1>Không tìm thấy chương trình</h1><p>Chương trình này có thể đã được gỡ khỏi danh sách công khai hoặc đường dẫn không còn hợp lệ.</p><a class="portal-button" href="/chuong-trinh">Quay lại danh sách chương trình →</a></section>`;return;}
      const data=jsonObject(selected.data_json),schedule=jsonObject(selected.schedule_json),summary=firstText(data,['description','summary','short_description','intro','content']);
      const detailRows=[selected.level?[bi('Cấp độ','Level'),selected.level]:null,selected.status?[bi('Trạng thái','Status'),publicStatusLabel(selected.status)]:null,firstText(schedule,['schedule','time','days','duration'])?[bi('Lịch học','Schedule'),firstText(schedule,['schedule','time','days','duration'])]:null,firstText(schedule,['format','mode','modality'])?[bi('Hình thức','Format'),firstText(schedule,['format','mode','modality'])]:null,firstText(data,['location','venue'])?[bi('Địa điểm','Location'),firstText(data,['location','venue'])]:null,selected.capacity?[bi('Sức chứa','Capacity'),String(selected.capacity)]:null].filter(Boolean);
      setMeta(selected.title,summary||'Thông tin chương trình được đồng bộ từ hệ thống quản trị Sky First.');
      app.innerHTML=`<section class="program-detail-hero"><div class="program-detail-copy"><a class="back-link" href="/chuong-trinh">← ${bi('Tất cả chương trình','All Programs')}</a><span class="hero-eyebrow">${esc(selected.unit_code||'Sky First')}</span><h1>${esc(selected.title)}</h1>${selected.level?`<span class="program-level">${esc(selected.level)}</span>`:''}<p>${esc(summary||'Thông tin chi tiết về chương trình được đồng bộ từ hệ thống quản trị.')}</p><div class="program-detail-status"><span class="program-status ${activeLike(selected.status)?'is-active':''}"><i></i>${esc(publicStatusLabel(selected.status))}</span></div><div class="actions"><a class="portal-button" href="#form/class">${bi('Đăng ký tham gia','Register Now')} <span>→</span></a><a class="secondary" href="mailto:lienhe@skyfirst.io.vn?subject=${encodeURIComponent('Quan tâm chương trình: '+selected.title)}">${bi('Liên hệ tư vấn','Contact Advisor')}</a></div></div>${sceneArt(programArtKind(selected))}</section><section class="program-detail-content"><div class="program-detail-main"><span class="section-kicker">${bi('THÔNG TIN CHƯƠNG TRÌNH','PROGRAM OVERVIEW')}</span><h2>${esc(selected.title)}</h2><p>${esc(summary||'Hãy liên hệ Hệ thống Thông tin Số Sky First để được hướng dẫn thêm về chương trình này.')}</p>${firstText(data,['content','details','learning_outcomes'])?`<div class="program-long-copy">${esc(firstText(data,['content','details','learning_outcomes'])).replace(/\n/g,'<br>')}</div>`:''}</div><aside class="program-detail-facts"><h3>${bi('Thông tin tổng quan','Key Facts')}</h3>${detailRows.length?detailRows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''):`<p>Thông tin bổ sung đang được cập nhật từ hệ thống quản trị.</p>`}<a href="mailto:support@skyfirst.io.vn?subject=${encodeURIComponent('Hỏi về chương trình: '+selected.title)}">${bi('Cần hỗ trợ?','Need help?')} <span>support@skyfirst.io.vn</span></a></aside></section>`;return;
    }
    setMeta(bi('Chương trình','Programs'),'Khám phá các chương trình giáo dục và cộng đồng trên Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-programs"><div class="catalog-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('CHƯƠNG TRÌNH','PROGRAMS')}</h1><p>${bi('Khám phá các chương trình đào tạo, lớp học kỹ năng và hoạt động phát triển cộng đồng theo dữ liệu thực tế.','Explore educational classes, skill training, and community programs from verified database records.')}</p><div class="catalog-search"><span>⌕</span><input id="programSearch" type="search" placeholder="${bi('Tìm chương trình, cấp độ, đơn vị...','Search programs, levels, units...')}" aria-label="Tìm chương trình"><button type="button" id="programSearchBtn">${bi('Tìm kiếm','Search')} <span>→</span></button></div><div class="catalog-filter-row" role="group" aria-label="Lọc chương trình"><button class="is-active" type="button" data-program-filter="all">${bi('Tất cả','All')}</button><button type="button" data-program-filter="education">${bi('Đào tạo','Education')}</button><button type="button" data-program-filter="community">${bi('Cộng đồng','Community')}</button></div></div>${sceneArt('program')}</section>${renderSystemPageCmsZone('/chuong-trinh')}<section class="catalog-section"><div class="catalog-section-head"><div><span class="section-kicker">${bi('DANH MỤC CHƯƠNG TRÌNH','PROGRAM DIRECTORY')}</span><h2>${bi('Chương trình đang triển khai','Active Programs')}</h2><p>${bi('Chọn từng chương trình để xem chi tiết lịch trình, trạng thái mở đăng ký và biểu mẫu liên quan.','Select a program to view schedules, registration status, and online forms.')}</p></div><span class="catalog-live-note"><i></i>${bi('Dữ liệu thực tế','Live D1 Data')}</span></div><div class="program-catalog-grid" id="programCatalogGrid">${items.map((x,i)=>programCard(x,i,'catalog')).join('')||`<div class="catalog-empty">${sceneArt('program')}<div><h3>Chưa có chương trình công khai</h3><p>Chương trình sẽ xuất hiện tại đây khi được cập nhật và công bố từ hệ thống quản trị.</p><a href="mailto:lienhe@skyfirst.io.vn">Liên hệ hỗ trợ →</a></div></div>`}</div><p class="catalog-no-results" id="programNoResults" hidden>${bi('Không tìm thấy chương trình phù hợp với từ khóa này.','No programs match your filter criteria.')}</p></section>`;
    const search=document.getElementById('programSearch'),grid=document.getElementById('programCatalogGrid'),noResults=document.getElementById('programNoResults');let activeFilter='all';
    const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.program-card').forEach(card=>{const text=(card.dataset.search||card.textContent||'').toLocaleLowerCase('vi');const category=card.dataset.category||'education';const matchText=!q||text.includes(q);const matchCat=activeFilter==='all'||(activeFilter==='education'?category==='education':category==='community');card.hidden=!(matchText&&matchCat);if(!card.hidden)count++});if(noResults)noResults.hidden=count>0||!items.length};
    grid?.querySelectorAll('.program-card').forEach((card,i)=>{const x=items[i];if(!x)return;card.dataset.search=[x.title,x.level,x.unit_code,x.status,jsonObject(x.data_json).description].join(' ');card.dataset.category=/sfec|education|đào tạo|tiếng anh|reading|listening|speaking|lớp/i.test([x.unit_code,x.title].join(' '))?'education':'community'});
    search?.addEventListener('input',apply);document.getElementById('programSearchBtn')?.addEventListener('click',apply);document.querySelectorAll('[data-program-filter]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.programFilter;document.querySelectorAll('[data-program-filter]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));return;
  }
  if(kind==='events'){
    updateActiveNav('events');
    const d=await api('/api/public/events'),items=visiblePublicItems(d.items||[]);const selected=detailId?items.find(x=>String(x.id)===String(detailId)):null;
    if(detailId){if(!selected){setMeta('Không tìm thấy sự kiện','Sự kiện không tồn tại hoặc chưa được công khai.');app.innerHTML=`<section class="detail-missing"><div>${sceneArt('events')}</div><span class="section-kicker">HOẠT ĐỘNG & SỰ KIỆN</span><h1>Không tìm thấy sự kiện</h1><p>Sự kiện này có thể đã được gỡ khỏi danh sách công khai hoặc đường dẫn không còn hợp lệ.</p><a class="portal-button" href="/su-kien">Quay lại danh sách sự kiện →</a></section>`;return;}
      const data=jsonObject(selected.data_json),summary=firstText(data,['summary','description','short_description','intro','content']);setMeta(selected.title,summary||'Thông tin sự kiện Sky First.');
      app.innerHTML=`<section class="event-detail-hero"><div class="event-detail-copy"><a class="back-link" href="/su-kien">← ${bi('Tất cả sự kiện','All Events')}</a><span class="hero-eyebrow">${esc(selected.unit_code||'Sky First')}</span><h1>${esc(selected.title)}</h1><p>${esc(summary||'Thông tin chi tiết sự kiện được đồng bộ từ hệ thống quản trị.')}</p><div class="event-detail-meta"><span>◷ ${esc(selected.start_at?fmt(selected.start_at):'Thời gian đang cập nhật')}</span><span class="program-status ${activeLike(selected.status)?'is-active':''}"><i></i>${esc(publicStatusLabel(selected.status))}</span></div><div class="actions"><a class="portal-button" href="#form/event">${bi('Đăng ký tham gia','Register')} <span>→</span></a><a class="secondary" href="mailto:lienhe@skyfirst.io.vn?subject=${encodeURIComponent('Hỏi về sự kiện: '+selected.title)}">${bi('Liên hệ ban tổ chức','Contact Organizers')}</a></div></div>${sceneArt('events')}</section><section class="program-detail-content"><div class="program-detail-main"><span class="section-kicker">${bi('THÔNG TIN SỰ KIỆN','EVENT DETAILS')}</span><h2>${esc(selected.title)}</h2><p>${esc(summary||'Vui lòng liên hệ Hệ thống Thông tin Số Sky First để được hướng dẫn thêm.')}</p></div><aside class="program-detail-facts"><h3>${bi('Thông tin tổng quan','Overview')}</h3><div><span>${bi('Đơn vị','Unit')}</span><b>${esc(selected.unit_code||'Sky First')}</b></div><div><span>${bi('Bắt đầu','Start')}</span><b>${esc(selected.start_at?fmt(selected.start_at):'Chưa cập nhật')}</b></div><div><span>${bi('Kết thúc','End')}</span><b>${esc(selected.end_at?fmt(selected.end_at):'Chưa cập nhật')}</b></div><div><span>${bi('Trạng thái','Status')}</span><b>${esc(publicStatusLabel(selected.status))}</b></div></aside></section>`;return;}
    setMeta(bi('Sự kiện & Hoạt động','Events & Activities'),'Lịch sự kiện và hoạt động thực tế trên Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-events"><div class="catalog-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${bi('SỰ KIỆN','EVENTS')} <strong>${bi('& HOẠT ĐỘNG','& ACTIVITIES')}</strong></h1><p>${bi('Theo dõi lịch sự kiện, thời gian tổ chức và trạng thái đăng ký thực tế. Không tạo sự kiện mẫu giả lập.','Track verified event schedules, venues, and registration availability.')}</p><div class="catalog-search"><span>⌕</span><input id="eventSearch" type="search" placeholder="${bi('Tìm sự kiện, hoạt động...','Search events, activities...')}" aria-label="Tìm sự kiện"><button type="button" id="eventSearchBtn">${bi('Tìm kiếm','Search')} <span>→</span></button></div><div class="catalog-filter-row" role="group" aria-label="Lọc sự kiện"><button class="is-active" type="button" data-event-filter="all">▦ ${bi('Tất cả','All')}</button><button type="button" data-event-filter="upcoming">▣ ${bi('Sắp diễn ra','Upcoming')}</button><button type="button" data-event-filter="ongoing">◉ ${bi('Đang diễn ra','Ongoing')}</button><button type="button" data-event-filter="past">◷ ${bi('Đã kết thúc','Completed')}</button></div></div>${sceneArt('events')}</section>${renderSystemPageCmsZone('/su-kien')}<section class="event-catalog-section"><div class="catalog-section-head"><div><span class="section-kicker">${bi('LỊCH SỰ KIỆN','EVENT SCHEDULE')}</span><h2>${bi('Danh sách sự kiện công khai','Public Events')}</h2><p>${bi('Trạng thái và thời gian sự kiện được hiển thị theo múi giờ Việt Nam (UTC+7).','Event times are displayed in Vietnam Standard Time (UTC+7).')}</p></div><span class="catalog-live-note"><i></i>${bi('Dữ liệu thực tế','Live D1 Data')}</span></div><div id="eventCatalogGrid" class="event-catalog-grid">${items.length?items.map(x=>{const data=jsonObject(x.data_json),status=publicStatusLabel(x.status);return `<a class="event-card" data-status="${esc(eventType(x))}" data-search="${esc([x.title,x.unit_code,status,firstText(data,['description','summary'])].join(' '))}" href="${esc(eventHref(x))}"><div class="event-card-visual">${sceneArt('events')}<span class="event-card-date">${esc(x.start_at?new Date(parseCttTime(x.start_at)).toLocaleDateString('vi-VN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}):'Đang cập nhật')}</span></div><div class="event-card-body"><span class="program-unit">${esc(x.unit_code||'Sky First')}</span><h3>${esc(x.title)}</h3><span class="program-status ${activeLike(x.status)?'is-active':''}"><i></i>${esc(status)}</span><span class="event-card-link">${bi('Xem chi tiết','View Details')} <b>→</b></span></div></a>`}).join(''):`<div class="event-empty">${sceneArt('events')}<div><h2>${bi('Chưa có sự kiện công khai','No public events yet')}</h2><p>${bi('Hiện tại chưa có sự kiện nào đang mở công khai trên hệ thống. Khi có sự kiện mới được công bố, thông tin sẽ hiển thị tại đây.','There are currently no open public events. New events will appear here once published.')}</p><a class="portal-button" href="/chuong-trinh">${bi('Xem các chương trình đang mở','Browse Active Programs')} <span>→</span></a></div></div>`}</div><p class="catalog-no-results" id="eventNoResults" hidden>${bi('Không có sự kiện phù hợp với bộ lọc hiện tại.','No events match the current filter.')}</p></section>`;
    const search=document.getElementById('eventSearch'),grid=document.getElementById('eventCatalogGrid'),noResults=document.getElementById('eventNoResults');let filter='all';const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.event-card').forEach(card=>{const yes=(!q||(card.dataset.search||'').toLocaleLowerCase('vi').includes(q))&&(filter==='all'||card.dataset.status===filter);card.hidden=!yes;if(yes)count++});if(noResults)noResults.hidden=count>0||!items.length};search?.addEventListener('input',apply);document.getElementById('eventSearchBtn')?.addEventListener('click',apply);document.querySelectorAll('[data-event-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.eventFilter;document.querySelectorAll('[data-event-filter]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));return;
  }
  if(kind==='news'){
    const d=await api('/api/public/news'),items=d.items||[];const selected=detailId?items.find(x=>String(x.slug||x.id)===String(detailId)||String(x.id)===String(detailId)):null;
    if(detailId){if(!selected){setMeta('Không tìm thấy bài viết','Tin tức không tồn tại hoặc không còn công khai.');app.innerHTML=`<section class="detail-missing"><div>${sceneArt('news')}</div><span class="section-kicker">THÔNG BÁO Sky First</span><h1>Không tìm thấy bài viết</h1><p>Bài viết này có thể đã được gỡ khỏi danh sách công khai hoặc đường dẫn không còn hợp lệ.</p><a class="portal-button" href="#news">Quay lại danh sách tin tức →</a></section>`;return;}
      setMeta(selected.title,String(selected.body||'').replace(/<[^>]*>/g,' ').slice(0,150));const tags=(()=>{try{return JSON.parse(selected.tags_json||'[]')}catch{return []}})();
      app.innerHTML=`<article class="news-detail-page"><div class="news-detail-head"><a class="back-link" href="#news">← ${bi('Tất cả tin tức','All Announcements')}</a><span class="hero-eyebrow">${bi('TIN TỨC & THÔNG BÁO','ANNOUNCEMENTS')}</span><h1>${esc(selected.title)}</h1><div class="news-detail-meta"><span>${esc(selected.published_at?fmt(selected.published_at):'Ngày đăng đang cập nhật')}</span>${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><div class="news-detail-cover">${sceneArt('news')}${selected.cover_file_id?`<img src="/media/${encodeURIComponent(selected.cover_file_id)}" alt="Ảnh đại diện: ${esc(selected.title)}" loading="lazy">`:`<em class="cover-default-note">MINH HỌA MẶC ĐỊNH · CHƯA CÓ ẢNH ĐẠI DIỆN</em>`}</div><div class="news-detail-body">${esc(String(selected.body||'').replace(/<[^>]*>/g,' ').trim()||'Nội dung bài viết đang được cập nhật.').replace(/\n/g,'<br>')}</div><div class="news-detail-foot"><span>${bi('Nội dung được công bố trên Hệ thống Thông tin Số Sky First.','Published on the Sky First Digital Information System.')}</span><a href="mailto:lienhe@skyfirst.io.vn?subject=${encodeURIComponent('Trao đổi về tin: '+selected.title)}">${bi('Liên hệ','Contact')} <span>→</span></a></div></article>`;bindBrokenCoverImages(app,'.news-detail-cover','ẢNH ĐẠI DIỆN KHÔNG TẢI ĐƯỢC · MINH HỌA MẶC ĐỊNH');return;}
    setMeta(bi('Tin tức & Thông báo','Announcements & Updates'),'Tin tức và thông báo vận hành trên Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-news"><div class="catalog-hero-copy"><span class="hero-eyebrow">${bi('TIN TỨC & THÔNG BÁO','ANNOUNCEMENTS')}</span><h1>${bi('THÔNG BÁO','SYSTEM')} <strong>${bi('HỆ THỐNG','UPDATES')}</strong></h1><p>${bi('Các thông báo và tin tức hoạt động chính thức.','Official operational notices and news.')}</p><div class="catalog-search"><span>⌕</span><input id="newsSearch" type="search" placeholder="${bi('Tìm tin tức, thông báo...','Search announcements...')}" aria-label="Tìm tin tức"><button type="button" id="newsSearchBtn">${bi('Tìm kiếm','Search')} <span>→</span></button></div></div>${sceneArt('news')}</section><section class="catalog-section news-catalog-section"><div class="news-catalog-grid" id="newsCatalogGrid">${items.length?items.map((x,i)=>`<a class="news-catalog-card ${i===0?'is-featured':''}" data-search="${esc([x.title,String(x.body||'').replace(/<[^>]*>/g,' '),x.tags_json].join(' '))}" href="${esc(storyHref(x))}"><div class="news-catalog-cover">${sceneArt('news')}${x.cover_file_id?`<img src="/media/${encodeURIComponent(x.cover_file_id)}" alt="Ảnh đại diện: ${esc(x.title)}" loading="lazy">`:''}${x.cover_file_id?'':`<em class="cover-default-note">MINH HỌA MẶC ĐỊNH · CHƯA CÓ ẢNH ĐẠI DIỆN</em>`}<span>${i===0?bi('TIN NỔI BẬT','FEATURED'):bi('THÔNG BÁO','NOTICE')}</span></div><div class="news-catalog-copy"><small>${esc(x.published_at?fmt(x.published_at):'Ngày đăng đang cập nhật')}</small><h3>${esc(x.title)}</h3><p>${esc(String(x.body||'').replace(/<[^>]*>/g,' ').slice(0,200))}</p><b>${bi('Đọc chi tiết','Read More')} <span>→</span></b></div></a>`).join(''):`<div class="catalog-empty">${sceneArt('news')}<div><h3>Chưa có tin tức công khai</h3><p>Các thông báo mới sẽ xuất hiện tại đây khi được xuất bản.</p></div></div>`}</div><p class="catalog-no-results" id="newsNoResults" hidden>Không tìm thấy bài viết phù hợp.</p></section>`;
    const search=document.getElementById('newsSearch'),grid=document.getElementById('newsCatalogGrid'),noResults=document.getElementById('newsNoResults');const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.news-catalog-card').forEach(card=>{const yes=!q||(card.dataset.search||'').toLocaleLowerCase('vi').includes(q);card.hidden=!yes;if(yes)count++});if(noResults)noResults.hidden=count>0||!items.length};search?.addEventListener('input',apply);document.getElementById('newsSearchBtn')?.addEventListener('click',apply);bindBrokenCoverImages(app,'.news-catalog-cover','ẢNH ĐẠI DIỆN KHÔNG TẢI ĐƯỢC · MINH HỌA MẶC ĐỊNH');return;
  }
  if(kind==='resources'){
    updateActiveNav('resources');
    const d=await api('/api/public/resources'),items=d.items||[];
    setMeta(bi('Thư viện Tài liệu & PDF','Document & PDF Library'),'Thư viện tài liệu số, văn bản, hướng dẫn có phân loại, xem trước PDF trực tiếp và kiểm soát tải xuống.');
    const categories=[...new Set(items.map(x=>x.category||x.doc_type||'Tài liệu'))];
    const previewDocId=new URLSearchParams(location.search).get('preview')||detailId||'';
    const previewDoc=previewDocId?items.find(x=>String(x.id)===String(previewDocId)||String(x.code)===String(previewDocId)):null;
    app.innerHTML=`<section class="catalog-hero catalog-hero-utility"><div class="catalog-hero-copy"><span class="hero-eyebrow">THƯ VIỆN PDF & TÀI LIỆU SỐ · Sky First</span><h1>${bi('TÀI LIỆU','DOCUMENTS')} <strong>${bi('& HƯỚNG DẪN','& GUIDES')}</strong></h1><p>${bi('Tra cứu, xem trước trực tiếp tệp PDF và tải xuống các tài liệu, quy chế, hướng dẫn được phép công bố trên Hệ thống Thông tin Số Sky First.','Search, preview PDFs inline, and download official documents, regulations, and guides published on the Sky First Digital Information System.')}</p><div class="catalog-search"><span>⌕</span><input id="docSearch" type="search" placeholder="${bi('Tìm theo tên tài liệu, mã văn bản, từ khóa...','Search by title, document code, keywords...')}" aria-label="Tìm tài liệu"><button type="button" id="docSearchBtn">${bi('Tìm kiếm','Search')} <span>→</span></button></div><div class="catalog-filter-row" id="docCategoryFilters"><button class="is-active" type="button" data-doc-cat="all">${bi('Tất cả danh mục','All Categories')}</button>${categories.map(c=>`<button type="button" data-doc-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>${sceneArt('utility')}</section>
    ${renderSystemPageCmsZone('/tai-lieu')}
    <section class="catalog-section utility-catalog">
      ${previewDoc&&previewDoc.preview_url?`<div class="card pdf-preview-panel" style="margin-bottom:28px;"><div class="toolbar"><div style="margin-right:auto"><span class="pill">${esc(previewDoc.code)} · ${bi('Phiên bản','Version')} v${esc(previewDoc.current_version||1)}</span><h2 style="margin:6px 0 0">${esc(bi(previewDoc.title,previewDoc.title_en))}</h2></div>${previewDoc.download_url?`<a class="portal-button" href="${esc(previewDoc.download_url)}">${bi('Tải xuống PDF →','Download PDF →')}</a>`:''}<a class="secondary" href="/tai-lieu">${bi('Đóng xem trước','Close Preview')}</a></div><iframe src="${esc(previewDoc.preview_url)}" title="Xem trước PDF: ${esc(previewDoc.title)}" style="width:100%;height:620px;border:1px solid var(--dip-line);border-radius:14px;margin-top:14px;"></iframe></div>`:''}
      <div class="catalog-section-head"><div><span class="section-kicker">${bi('THƯ VIỆN TÀI LIỆU CÔNG KHAI','PUBLIC DOCUMENT REPOSITORY')}</span><h2>${bi('Danh mục tài liệu & văn bản','Official Documents & Manuals')}</h2><p>${bi('Chỉ hiển thị các tài liệu có trạng thái công khai và còn hiệu lực.','Displays only public documents with active validity status.')}</p></div></div>
      ${items.length?`<div class="resource-list utility-resource-list" id="docCatalogList">${items.map(x=>`<article class="doc-item-row" data-cat="${esc(x.category||x.doc_type||'Tài liệu')}" data-search="${esc([x.title,x.title_en,x.code,x.doc_type,x.category,x.description,x.keywords].join(' '))}"><i>${icon('resource')}</i><div><span>${esc(x.code)} · ${esc(bi(x.category||x.doc_type||'TÀI LIỆU',x.category_en||x.category||'DOCUMENT'))} · v${esc(x.current_version||1)}</span><h3>${esc(bi(x.title,x.title_en))}</h3>${x.description?`<p class="small muted">${esc(bi(x.description,x.description_en))}</p>`:''}<small>${bi('Cập nhật:','Updated:')} ${esc(x.issued_at?fmt(x.issued_at):fmt(x.updated_at))}</small></div><div class="actions">${x.preview_url?`<a class="secondary" href="/tai-lieu?preview=${encodeURIComponent(x.id)}">${bi('Xem trước PDF','Preview PDF')}</a>`:''}${x.download_url?`<a class="portal-button" href="${esc(x.download_url)}">${bi('Tải xuống →','Download →')}</a>`:`<span class="small muted">${bi('Chỉ xem trực tuyến','Inline preview only')}</span>`}</div></article>`).join('')}</div><p class="catalog-no-results" id="docNoResults" hidden>${bi('Không tìm thấy tài liệu phù hợp với điều kiện lọc.','No documents match your filter criteria.')}</p>`:`<div class="utility-public-note">${bi('Hiện chưa có tài liệu công khai được xuất bản trong thư viện. Khi quản trị viên tải lên và công bố tài liệu PDF, danh sách sẽ hiển thị tại đây.','No public documents have been published yet. Approved PDF documents will appear here.')}</div>`}
    </section>`;
    const search=document.getElementById('docSearch'),list=document.getElementById('docCatalogList'),noRes=document.getElementById('docNoResults');let activeCat='all';
    const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;list?.querySelectorAll('.doc-item-row').forEach(row=>{const yes=(!q||(row.dataset.search||'').toLocaleLowerCase('vi').includes(q))&&(activeCat==='all'||row.dataset.cat===activeCat);row.hidden=!yes;if(yes)count++});if(noRes)noRes.hidden=count>0||!items.length};
    search?.addEventListener('input',apply);document.getElementById('docSearchBtn')?.addEventListener('click',apply);
    document.querySelectorAll('[data-doc-cat]').forEach(btn=>btn.addEventListener('click',()=>{activeCat=btn.dataset.docCat;document.querySelectorAll('[data-doc-cat]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));
    return;
  }
}

function bindBrokenCoverImages(root,selector,label){
  root.querySelectorAll(`${selector} img`).forEach(img=>img.addEventListener('error',()=>{
    const container=img.parentElement;img.remove();if(!container||container.querySelector('.cover-default-note'))return;
    const note=document.createElement('em');note.className='cover-default-note';note.textContent=label;container.appendChild(note);
  },{once:true}));
}

function eventType(item={}){const s=String(item.status||'').toLowerCase();if(/đã kết thúc|hoàn thành|kết thúc|completed|ended|past/.test(s))return 'past';if(/đang diễn ra|đang tổ chức|ongoing|live/.test(s))return 'ongoing';const now=Date.now(),start=Date.parse(item.start_at||'');const end=Date.parse(item.end_at||'');if(Number.isFinite(end)&&end>0&&end<now)return 'past';if(Number.isFinite(start)&&start>0&&start<=now&&(!Number.isFinite(end)||!end||end>=now))return 'ongoing';return 'upcoming'}

const searchState={items:[],filter:'all',index:-1,timer:null,query:''};
let searchReturnFocus=null;
function openSearch(seed=''){const el=document.getElementById('searchCenter');if(!el)return;searchReturnFocus=document.activeElement;el.hidden=false;el.setAttribute('aria-hidden','false');document.body.classList.add('searching');const input=document.getElementById('globalSearch');input.value=seed||'';input.focus();renderRecent();if(input.value.trim().length>=2)doSearch(input.value)}
function closeSearch(){const el=document.getElementById('searchCenter');if(!el)return;el.hidden=true;el.setAttribute('aria-hidden','true');document.body.classList.remove('searching');searchReturnFocus?.focus?.();searchReturnFocus=null}
function recent(){try{return JSON.parse(localStorage.getItem('sfn_recent_searches')||'[]')}catch{return[]}}
function saveRecent(q){const a=[q,...recent().filter(x=>x!==q)].slice(0,6);localStorage.setItem('sfn_recent_searches',JSON.stringify(a))}
function renderRecent(){const el=document.getElementById('recentSearches'),a=recent(),suggestions=['Chương trình','Sự kiện','Tài liệu','Biểu mẫu','Chứng nhận','Tài trợ','An toàn'];if(!el)return;el.innerHTML=`${a.length?`<span>${bi('Tìm gần đây','Recent Searches')}</span><div>${a.map(q=>`<button type="button" data-recent="${esc(q)}">${esc(q)}</button>`).join('')}</div>`:''}<span>${bi('Gợi ý tra cứu','Suggested Topics')}</span><div>${suggestions.map(q=>`<button type="button" data-recent="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;el.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{const q=b.dataset.recent;document.getElementById('globalSearch').value=q;doSearch(q)})}
function resultHref(x){if(x.type==='credential')return `/gcn/${encodeURIComponent(x.ref)}`;if(x.type==='form')return `/#form/${encodeURIComponent(x.ref)}`;if(x.type==='event')return `/su-kien/${encodeURIComponent(x.ref)}`;if(x.type==='program')return `/chuong-trinh/${encodeURIComponent(x.ref)}`;if(x.type==='unit')return '/#units';if(x.type==='resource')return `/tai-lieu?preview=${encodeURIComponent(x.ref)}`;if(x.type==='sponsorship')return `/tai-tro/${encodeURIComponent(x.ref)}`;if(x.type==='cms_page')return `/trang/${encodeURIComponent(x.ref)}`;if(x.type==='news')return `/#news/${encodeURIComponent(x.ref)}`;if(x.type==='page')return x.ref||'/';return '/'}
function highlight(value){const text=String(value??''),q=searchState.query.trim();if(!q)return esc(text);const parts=text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig'));return parts.map(p=>p.toLowerCase()===q.toLowerCase()?`<mark>${esc(p)}</mark>`:esc(p)).join('')}
const SEARCH_TYPE_LABELS={all:'Tất cả',page:'Chức năng',program:'Chương trình',event:'Sự kiện',resource:'Tài liệu',form:'Biểu mẫu',credential:'Chứng nhận',sponsorship:'Tài trợ',cms_page:'Trang thông tin',news:'Thông báo',unit:'Đơn vị'};
function renderSearch(){const out=document.getElementById('globalResults'),filters=document.getElementById('searchFilters');if(!out||!filters)return;const cats=[...new Set(searchState.items.map(x=>x.type))];filters.innerHTML=searchState.items.length?['all',...cats].map(c=>`<button type="button" class="${searchState.filter===c?'active':''}" data-filter="${c}">${esc(SEARCH_TYPE_LABELS[c]||c)}</button>`).join(''):'';filters.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{searchState.filter=b.dataset.filter;searchState.index=-1;renderSearch()});const items=searchState.items.filter(x=>searchState.filter==='all'||x.type===searchState.filter);out.innerHTML=items.length?`<div class="search-count">${items.length} ${bi('kết quả phù hợp','matching results')}</div>${items.map((x,i)=>`<a class="search-result ${i===searchState.index?'active':''}" data-result-index="${i}" href="${resultHref(x)}"><i>${icon(x.type)}</i><span><small>${esc(SEARCH_TYPE_LABELS[x.type]||x.type)}</small><b>${highlight(x.title)}</b><em>${highlight(x.description||'')}</em></span><strong>→</strong></a>`).join('')}`:`<div class="search-zero"><i>⌕</i><h3>${bi('Không tìm thấy kết quả phù hợp','No matching results found')}</h3><p>${bi('Hãy thử từ khóa ngắn hơn, tên chương trình, sự kiện, tài liệu hoặc mã chứng nhận chính xác.','Try a shorter keyword, program title, document code, or exact credential code.')}</p></div>`}
async function doSearch(q){q=String(q||'').trim();searchState.query=q;if(q.length<2){searchState.items=[];renderSearch();return}const out=document.getElementById('globalResults');if(out)out.innerHTML=`<div class="loading">${bi('Đang tìm kiếm trên Hệ thống Thông tin Số Sky First…','Searching Sky First Digital Information System…')}</div>`;try{const d=await api(`/api/public/search?q=${encodeURIComponent(q)}`);searchState.items=d.items||[];searchState.filter='all';searchState.index=-1;saveRecent(q);renderRecent();renderSearch();event(searchState.items.length?'search_success':'search_zero_result',{category:'search',count:searchState.items.length})}catch(e){if(out)out.innerHTML=failCard(e.message)}}

function initShell(){
  normalizeVisibleBrand(document.body);
  if(typeof MutationObserver!=='undefined'){
    const brandObserver=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData') normalizeVisibleBrand(record.target.parentElement||document.body);
        for(const node of record.addedNodes||[]) if(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.DOCUMENT_FRAGMENT_NODE) normalizeVisibleBrand(node);
      }
    });
    brandObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  const mt=document.getElementById('menuToggle'),nav=document.getElementById('mainNav');
  if(mt&&nav)mt.onclick=()=>{const open=nav.classList.toggle('mobile-open');mt.setAttribute('aria-expanded',String(open))};
  document.querySelectorAll('.lang-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    const appEl=document.getElementById('app');
    const savedInputs=captureFormInputs(appEl);
    applyLanguage(btn.dataset.lang);
    if(appEl && !document.body.classList.contains('admin-mode')){
      const rawHash=(location.hash||'').slice(1);
      const [route,param]=rawHash.split('/');
      await render({app:appEl,path:location.pathname.replace(/\/+$/,'/')||'/',route:route||'',param:param?decodeURIComponent(param):''});
      restoreFormInputs(appEl,savedInputs);
    }
  }));
  applyLanguage(getLang());
  ensurePublicConfig();
  document.getElementById('searchOpen')?.addEventListener('click',()=>openSearch(''));
  document.getElementById('searchClose')?.addEventListener('click',closeSearch);
  const input=document.getElementById('globalSearch');
  if(input)input.addEventListener('input',e=>{clearTimeout(searchState.timer);searchState.timer=setTimeout(()=>doSearch(e.target.value),180)});
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();openSearch('')}
    if(e.key==='Escape'&&!document.getElementById('searchCenter')?.hidden)closeSearch();
    if(!document.getElementById('searchCenter')?.hidden&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
      e.preventDefault();const items=[...document.querySelectorAll('.search-result')];if(!items.length)return;
      searchState.index=Math.max(0,Math.min(items.length-1,searchState.index+(e.key==='ArrowDown'?1:-1)));
      items.forEach((x,i)=>x.classList.toggle('active',i===searchState.index));
      items[searchState.index]?.scrollIntoView({block:'nearest'});
    }
    if(!document.getElementById('searchCenter')?.hidden&&e.key==='Enter'&&searchState.index>=0){
      const items=[...document.querySelectorAll('.search-result')];items[searchState.index]?.click();
    }
  });
}

function canRender(path,route){
  if(['/','/tra-cuu','/gcn','/ho-so','/bieu-mau','/chuong-trinh','/su-kien','/tai-lieu','/tai-tro','/an-toan','/gioi-thieu','/ho-tro','/tim-kiem'].includes(path)) return true;
  if(['/gcn/','/chuong-trinh/','/su-kien/','/tai-lieu/','/tai-tro/','/trang/'].some(p=>path.startsWith(p))) return true;
  return ['home','forms','lookup','classes','events','units','news','programs','activities','resources','utilities','sponsorship','safety','page','about','support','fields','ecosystem','connect','privacy','terms'].includes(route);
}

async function render(ctx){
  document.body.classList.add('public-digital');
  document.body.classList.remove('admin-mode');
  const {app,path,route,param}=ctx;
  const pathSegs=path.split('/').filter(Boolean);
  const pathDetail=pathSegs[1]?decodeURIComponent(pathSegs[1]):'';

  // Hash-based subroutes take precedence when present on "/"
  if(route==='lookup') return lookupCenter(app);
  if(route==='forms') return formCenter(app);
  if(route==='about') return aboutCenter(app);
  if(route==='support') return supportCenter(app);
  if(route==='classes'||route==='programs') return programsPage(app,'classes',param||'');
  if(route==='events'||route==='activities') return programsPage(app,'events',param||'');
  if(route==='units'||route==='ecosystem') return programsPage(app,'units');
  if(route==='news') return programsPage(app,'news',param||'');
  if(route==='resources'||route==='utilities') return programsPage(app,'resources',param||'');
  if(route==='sponsorship') return sponsorshipCenter(app,param||'');
  if(route==='safety'||route==='privacy') return safetyCenter(app);
  if(route==='page') return cmsPageCenter(app,param||'');

  // Path-based routes
  if(path==='/gioi-thieu') return aboutCenter(app);
  if(path==='/ho-tro') return supportCenter(app);
  if(path==='/tra-cuu') return lookupCenter(app);
  if(path==='/gcn'||path.startsWith('/gcn/')) return credentialCenter(app,path);
  if(path==='/ho-so') return caseCenter(app);
  if(path==='/bieu-mau') return formCenter(app);
  if(path==='/chuong-trinh'||path.startsWith('/chuong-trinh/')) return programsPage(app,'classes',pathDetail||param||'');
  if(path==='/su-kien'||path.startsWith('/su-kien/')) return programsPage(app,'events',pathDetail||param||'');
  if(path==='/tai-lieu'||path.startsWith('/tai-lieu/')) return programsPage(app,'resources',pathDetail||param||'');
  if(path==='/tai-tro'||path.startsWith('/tai-tro/')) return sponsorshipCenter(app,pathDetail||param||'');
  if(path==='/an-toan') return safetyCenter(app);
  if(path.startsWith('/trang/')) return cmsPageCenter(app,pathDetail||param||'');
  if(path==='/tim-kiem'){await home(app);openSearch(new URLSearchParams(location.search).get('q')||'');return;}

  return home(app);
}

window.SkyFirstDigital={canRender,render,openSearch,applyLanguage,renderVisualBlock};
initShell();
