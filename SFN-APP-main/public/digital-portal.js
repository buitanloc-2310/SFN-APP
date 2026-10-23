const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function parseCttTime(value){
  const raw=String(value??'').trim();if(!raw)return NaN;
  if(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw))return Date.parse(raw);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return Date.parse(`${raw}T00:00:00+07:00`);
  const normalized=raw.includes('T')?raw:raw.replace(' ','T');
  return Date.parse(`${normalized}+07:00`);
}
const fmt=d=>{const ms=parseCttTime(d);return Number.isFinite(ms)?new Date(ms).toLocaleString("vi-VN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}):"—";};
const fmtVnd=n=>{const num=Number(n);if(!Number.isFinite(num))return "Chưa có dữ liệu";return new Intl.NumberFormat("vi-VN").format(Math.round(num))+" đồng";};
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
function setMeta(title,desc){
  document.title=`${normalizeBrandString(title)} — Hệ thống Thông tin Số Sky First`;
  document.querySelector('meta[name="description"]')?.setAttribute('content',normalizeBrandString(desc||'Hệ thống Thông tin Số Sky First (Sky First Digital Information System).'));
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content',normalizeBrandString(desc||'Hệ thống Thông tin Số Sky First.'));
}
function sectionHead(kicker,title,desc){return `<div class="dip-section-head"><div><span class="section-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div></div>`}
function empty(msg){return `<div class="dip-empty"><span>◇</span><p>${esc(msg)}</p></div>`}
function jsonObject(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value||'{}')}catch{return {}}}
function firstText(obj,keys){for(const key of keys){const v=obj?.[key];if(typeof v==='string'&&v.trim())return v.trim()}return ''}
function isHiddenPublicStatus(status=''){return /(^|\b)(nháp|draft|private|ẩn|đã ẩn|unpublished)(\b|$)/i.test(String(status||''))}
function visiblePublicItems(items=[]){return (items||[]).filter(x=>!isHiddenPublicStatus(x.status))}
function programArtKind(item={}){const t=String(item.title||'').toLowerCase();if(t.includes('reading')||t.includes('đọc'))return 'reading';if(t.includes('listening')||t.includes('nghe'))return 'listening';if(t.includes('speaking')||t.includes('nói'))return 'speaking';return 'program'}
function publicStatusLabel(status){const s=String(status||'').trim();if(!s)return 'Trạng thái đang cập nhật';if(/draft|nháp|private|ẩn/i.test(s))return 'Chưa công khai';return s}

const I18N = {
  vi: {
    brand_sub: "HỆ THỐNG THÔNG TIN SỐ",
    nav_home: "Trang chủ",
    nav_programs: "Chương trình",
    nav_events: "Sự kiện",
    nav_docs: "Tài liệu",
    nav_forms: "Biểu mẫu",
    nav_certs: "Chứng nhận",
    nav_cases: "Hồ sơ",
    nav_sponsorship: "Tài trợ",
    nav_safety: "An toàn",
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
    search_hint: "Chỉ tìm kiếm trên dữ liệu công khai. Dùng phím ↑ ↓ để chọn, Enter để mở."
  },
  en: {
    brand_sub: "DIGITAL INFORMATION SYSTEM",
    nav_home: "Home",
    nav_programs: "Programs",
    nav_events: "Events",
    nav_docs: "Documents",
    nav_forms: "Forms",
    nav_certs: "Certificates",
    nav_cases: "Records",
    nav_sponsorship: "Sponsorship",
    nav_safety: "Safety",
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
    search_hint: "Searches public records only. Use ↑ ↓ arrows to navigate, Enter to open."
  }
};

function getLang(){
  try{return localStorage.getItem('sfn_lang')==='en'?'en':'vi'}catch{return 'vi'}
}
function t(key){
  const lang=getLang();
  return I18N[lang]?.[key] || I18N.vi[key] || key;
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
 if(mode==='home')return `<article class="program-home-card ${index===0?'is-featured':''} art-${esc(kind)}"><div class="program-home-art">${sceneArt(kind)}</div><div class="program-home-copy"><span class="program-unit">${esc(item.unit_code||'Sky First')}</span><h3>${esc(normalizeBrandString(item.title))}</h3>${level}<p class="program-status-line">${esc(status)}</p><a href="${esc(programHref(item))}">Xem chi tiết chương trình <span>→</span></a></div></article>`;
 return `<article class="program-card"><div class="program-card-visual">${sceneArt(kind)}<span class="program-unit">${esc(item.unit_code||'Sky First')}</span></div><div class="program-card-body"><h3>${esc(normalizeBrandString(item.title))}</h3>${level}${desc?`<p>${esc(desc)}</p>`:`<p>Thông tin chi tiết của chương trình được đồng bộ từ hệ thống quản trị.</p>`}<div class="program-card-foot"><span class="program-status ${activeLike(item.status)?'is-active':''}"><i></i>${esc(status)}</span><a href="${esc(programHref(item))}">Xem chi tiết <b>→</b></a></div></div></article>`;
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
  setMeta('Hệ thống Thông tin Số Sky First','Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First.');
  const [news,classes,events,resources,config]=await Promise.allSettled([
    api('/api/public/news'),
    api('/api/public/classes'),
    api('/api/public/events'),
    api('/api/public/resources'),
    api('/api/config')
  ]);
  const n=news.value?.items||[], c=classes.value?.items||[], ev=events.value?.items||[], r=resources.value?.items||[];
  const newsHtml=n.length?`<div class="news-editorial"><a class="news-feature" href="${esc(storyHref(n[0]))}"><div class="news-feature-art">${sceneArt('news')}${n[0].cover_file_id?`<img src="/media/${encodeURIComponent(n[0].cover_file_id)}" alt="Ảnh đại diện: ${esc(n[0].title)}" loading="lazy">`:''}${n[0].cover_file_id?'':`<em class="cover-default-note">MINH HỌA MẶC ĐỊNH · CHƯA CÓ ẢNH ĐẠI DIỆN</em>`}</div><span>TIN NỔI BẬT</span><h3>${esc(n[0].title)}</h3><p>${esc(String(n[0].body||'').replace(/<[^>]*>/g,' ').slice(0,230))}</p><small>${n[0].published_at?fmt(n[0].published_at):''}</small><b class="news-card-cta">Đọc tin <span>→</span></b></a><div class="news-stack">${n.slice(1,5).map(x=>`<a href="${esc(storyHref(x))}"><span>THÔNG BÁO</span><b>${esc(x.title)}</b><small>${x.published_at?fmt(x.published_at):''}</small><strong>Đọc tin →</strong></a>`).join('')}</div></div>`:`<div class="beautiful-empty"><i>◧</i><div><h3>Chưa có tin tức công khai</h3><p>Tin mới và thông báo sẽ xuất hiện tại đây khi được xuất bản từ hệ thống quản trị.</p></div></div>`;

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

  <div class="home-operational-grid">
    <section class="dip-section live-v3 home-programs-panel" id="programs">
      ${sectionHead('CHƯƠNG TRÌNH ĐÀO TẠO & CỘNG ĐỒNG','Chương trình đang triển khai','Danh sách chương trình được đồng bộ từ dữ liệu đã công bố.')}
      <div class="program-spotlight">${visiblePublicItems(c).sort(comparePrograms).slice(0,3).map((x,i)=>programCard(x,i,'home')).join('')||`<div class="beautiful-empty"><i>◫</i><div><h3>Chưa có chương trình công khai</h3><p>Chương trình sẽ xuất hiện tại đây khi được cập nhật và công bố từ hệ thống quản trị.</p><a href="mailto:lienhe@skyfirst.io.vn">Liên hệ hỗ trợ →</a></div></div>`}</div>
      <a class="section-more-link" href="/chuong-trinh">Xem toàn bộ chương trình <span>→</span></a>
    </section>
    <div class="home-right-stack">
      <section class="dip-section tone home-events-panel" id="activities">
        ${sectionHead('SỰ KIỆN & HOẠT ĐỘNG','Lịch sự kiện và hoạt động thực tế','Theo dõi thời gian và trạng thái các sự kiện công khai.')}
        <div class="event-timeline" id="events">${visiblePublicItems(ev).slice(0,4).map(x=>`<a href="${esc(eventHref(x))}"><time>${x.start_at?fmt(x.start_at):'Thời gian đang cập nhật'}</time><div><small>${esc(x.unit_code||'Sky First')}</small><h3>${esc(x.title)}</h3><p>${esc(publicStatusLabel(x.status))}</p></div><span>→</span></a>`).join('')||`<div class="home-empty"><span aria-hidden="true">▦</span><b>Chưa có sự kiện công khai</b><p>Lịch sự kiện sẽ hiển thị khi được cập nhật và công bố.</p></div>`}</div>
        <a class="section-more-link" href="/su-kien">Xem tất cả sự kiện <span>→</span></a>
      </section>
      <section class="dip-section resources-v3 home-resources-panel" id="resources">
        ${sectionHead('THƯ VIỆN TÀI LIỆU SỐ','Tài liệu, văn bản và hướng dẫn','Tài liệu công khai có thể xem trước hoặc tải theo quyền truy cập.')}
        ${r.length?`<div class="resource-list">${r.slice(0,4).map(x=>`<article><i>${icon('resource')}</i><div><span>${esc(x.category||x.doc_type||'TÀI LIỆU')} · v${esc(x.current_version||1)}</span><h3>${esc(x.title)}</h3>${x.description?`<p class="muted small">${esc(x.description)}</p>`:''}</div><div class="actions">${x.preview_url?`<a class="secondary" href="/tai-lieu?preview=${encodeURIComponent(x.id)}">Xem trước</a>`:''}${x.download_url?`<a class="portal-button" href="${esc(x.download_url)}">Tải xuống →</a>`:''}</div></article>`).join('')}</div>`:`<div class="home-empty"><span aria-hidden="true">▤</span><b>Chưa có tài liệu công khai</b><p>Tài liệu và văn bản sẽ hiển thị khi được phê duyệt, công bố.</p></div>`}
        <a class="section-more-link" href="/tai-lieu">Mở Thư viện Tài liệu <span>→</span></a>
      </section>
    </div>
  </div>
  <div class="home-lower-grid">
    <section class="dip-section news-v3 home-news-panel" id="news">
      ${sectionHead('THÔNG BÁO & CẬP NHẬT','Thông tin vận hành và thông báo mới','Các thông báo đã được công bố trên hệ thống.')}
      ${newsHtml}
      <a class="section-more-link" href="#news">Xem thông báo mới <span>→</span></a>
    </section>
    <section class="home-about-panel" id="about">
      <span class="section-kicker">HỆ THỐNG Sky First</span>
      <h2>Thông tin số rõ ràng, thuận tiện và có kiểm soát</h2>
      <p>Tra cứu chương trình, sự kiện, tài liệu, biểu mẫu, hồ sơ và chứng nhận tại một điểm truy cập thống nhất.</p>
      <div class="home-about-pill-row"><span>Giáo dục</span><span>Môi trường</span><span>Cộng đồng</span></div>
      <a class="section-more-link" href="/an-toan">Xem hướng dẫn sử dụng an toàn <span>→</span></a>
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
    if(key==="sponsorship"){
      if(num>=1000000000) return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:2}).format(num/1000000000)+" tỷ đồng";
      if(num>=1000000) return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1}).format(num/1000000)+" triệu đồng";
      return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(num)+" đồng";
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

async function formCenter(app){
  updateActiveNav('forms');
  setMeta('Biểu mẫu điện tử','Hệ thống Biểu mẫu điện tử Sky First — tiếp nhận thông tin, chữ ký hình ảnh và tệp đính kèm an toàn.');
  const d=await api('/api/config'); const forms=d.forms||[];
  app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>BIỂU MẪU ĐIỆN TỬ</h1><p>Gửi đăng ký chương trình, hồ sơ tham gia và yêu cầu trực tuyến. Sau khi gửi thành công, hệ thống cấp mã hồ sơ để bạn tra cứu tiến trình xử lý tại mục <b>Hồ sơ (/ho-so)</b>.</p></section>
  <section class="dip-section tight">
    <div class="capability-strip"><span>Biểu mẫu nhiều bước</span><span>Điều kiện hiển thị linh hoạt</span><span>Tải tệp kiểm tra chữ ký byte</span><span>Hỗ trợ vẽ/tải ảnh chữ ký</span><span>Bảo vệ người dưới 18 tuổi</span><span>Xem lại trước khi gửi</span></div>
    <div class="notice" style="margin-bottom:24px;"><b>Lưu ý pháp lý về chữ ký trong biểu mẫu:</b> Trường chữ ký trên biểu mẫu thu nhận <i>chữ ký hình ảnh</i> do người dùng trực tiếp vẽ trên màn hình hoặc tải ảnh lên nhằm xác nhận thao tác gửi biểu mẫu. Đây <b>không phải</b> chữ ký số được chứng thực bởi tổ chức cung cấp dịch vụ chứng thực chữ ký số.</div>
    ${sectionHead('DANH MỤC BIỂU MẪU','Biểu mẫu đang mở tiếp nhận','Chọn biểu mẫu phù hợp với nhu cầu của bạn.')}
    <div class="form-center-grid">${forms.map(f=>`<article class="form-center-card"><div><span class="content-tag">${esc(f.prefix)}</span><h3>${esc(f.name)}</h3><p>${esc(f.description||'')}</p></div><div><small>${f.min_age?`Điều kiện tuổi: từ đủ ${esc(f.min_age)} tuổi`:'Theo điều kiện của chương trình'}</small><a class="portal-button" href="#form/${encodeURIComponent(f.id)}">Mở biểu mẫu <span>→</span></a></div></article>`).join('')||empty('Hiện chưa có biểu mẫu công khai đang mở.')}</div>
  </section>`;
  event('route_view',{category:'forms'});
}

function lookupShell(title,desc){return `<section class="page-hero compact lookup-entry-hero"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></section>`}

async function lookupCenter(app){
  updateActiveNav('gcn');
  setMeta('Tra cứu thông tin','Chọn phân hệ tra cứu Chứng nhận (/gcn) hoặc Hồ sơ (/ho-so) trên Hệ thống Thông tin Số Sky First.');
  app.innerHTML=lookupShell('TRUNG TÂM TRA CỨU','Chọn đúng phân hệ cần tra cứu: Chứng nhận đã phát hành (/gcn), Hồ sơ đã gửi (/ho-so) hoặc Minh bạch Tài trợ (/tai-tro).')+`<section class="lookup-choice-v3"><a class="lookup-choice paper" href="/gcn"><div class="choice-art"><span>✓</span><i>▦</i></div><small>CHỨNG NHẬN (/GCN)</small><h2>Tra cứu Giấy chứng nhận, Giấy xác nhận & Bằng khen</h2><p>Tra cứu tính hợp lệ và trạng thái hiệu lực bằng mã chứng nhận được in trên giấy.</p><b>Mở tra cứu chứng nhận →</b></a><a class="lookup-choice case" href="/ho-so"><div class="choice-art"><span>⌁</span><i>•••</i></div><small>HỒ SƠ (/HO-SO)</small><h2>Tra cứu tiến trình xử lý hồ sơ</h2><p>Xác minh bằng mã hồ sơ và địa chỉ email đã đăng ký để bảo vệ thông tin cá nhân.</p><b>Mở tra cứu hồ sơ →</b></a></section>`;
}

function credentialResult(x){return `<article class="verification-record ${statusClass(x.status_text)}"><div class="verify-state"><i>${x.status==='issued'?'✓':x.status==='revoked'?'!':'↻'}</i><div><span>KẾT QUẢ ĐỐI CHIẾU CHỨNG NHẬN</span><h2>${esc(x.status_text)}</h2></div></div><dl><div><dt>Mã chứng nhận</dt><dd>${esc(x.code)}</dd></div><div><dt>Loại văn bản</dt><dd>${esc(x.type)}</dd></div><div><dt>Người được ghi nhận</dt><dd>${esc(x.full_name)}</dd></div><div class="wide"><dt>Nội dung ghi nhận</dt><dd>${esc(x.content)}</dd></div>${x.program?`<div><dt>Chương trình / Hoạt động</dt><dd>${esc(x.program)}</dd></div>`:''}<div><dt>Đơn vị phát hành</dt><dd>${esc(x.unit_name)}</dd></div><div><dt>Ngày phát hành</dt><dd>${esc(x.issued_at?fmt(x.issued_at):'—')}</dd></div><div><dt>Trạng thái hiệu lực</dt><dd>${esc(x.status_text)}</dd></div>${x.replacement_code?`<div class="wide"><dt>Được thay thế bởi mã mới</dt><dd><a href="/gcn/${encodeURIComponent(x.replacement_code)}">${esc(x.replacement_code)}</a></dd></div>`:''}${x.revocation_reason?`<div class="wide"><dt>Lý do thu hồi</dt><dd>${esc(x.revocation_reason)}</dd></div>`:''}</dl><p class="record-note">Bản ghi này phản ánh trạng thái thực tế trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First. Chỉ hỗ trợ tra cứu bằng mã chứng nhận; không tra cứu bằng số điện thoại hoặc email.</p></article>`}
function failCard(msg){return `<div class="result-fail" role="alert"><i>×</i><div><h3>Không thể xác minh thông tin</h3><p>${esc(msg||'Không tìm thấy dữ liệu phù hợp với thông tin đã cung cấp.')}</p></div></div>`}

async function credentialCenter(app,path){
  updateActiveNav('gcn');
  setMeta('Tra cứu chứng nhận','Tra cứu Giấy chứng nhận, Giấy xác nhận và Bằng khen bằng mã chứng nhận trên Hệ thống Thông tin Số Sky First.');
  const pathCode=decodeURIComponent(path.split('/').filter(Boolean)[1]||''); const queryCode=new URLSearchParams(location.search).get('code')||''; const init=pathCode||queryCode;
  app.innerHTML=`<section class="lookup-hero credential-hero"><div class="lookup-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>TRA CỨU <strong>CHỨNG NHẬN</strong></h1><p>Xác thực trạng thái hiệu lực, thu hồi hoặc thay thế của Giấy chứng nhận, Giấy xác nhận và Bằng khen bằng mã chứng nhận.</p><div class="lookup-trust"><span>✓ Tra cứu duy nhất bằng mã chứng nhận</span><span>⌁ Đối chiếu trực tiếp cơ sở dữ liệu</span><span>▦ Hỗ trợ quét mã QR</span></div></div><div class="lookup-hero-art credential-art-new" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="credential-document"><span>Sky First</span><i>CHỨNG NHẬN</i><b>★</b><small>▦ QR</small></div><div class="credential-shield">✓</div></div></section><section class="lookup-search-panel credential-search credential-search-v3"><h2>Nhập mã chứng nhận để xác thực</h2><form id="credentialForm"><label for="credentialCode">Mã chứng nhận (GCN / GXN / BK)</label><div class="lookup-big"><span>⌕</span><input id="credentialCode" value="${esc(init)}" placeholder="Ví dụ: SFN-GCN-12345678 hoặc 001-GCN-SFN/2026" autocomplete="off" required><button type="submit">⌕ &nbsp; XÁC THỰC</button></div><div class="lookup-secondary-actions"><button class="secondary" type="button" id="scanQr">▦ &nbsp; Quét mã QR</button><a href="#huong-dan">Quy tắc xác thực chứng nhận ↓</a></div></form><div id="credentialOut" aria-live="polite"></div></section><section class="dip-section tight public-benefits credential-benefits"><article><i>✓</i><h3>Trạng thái minh bạch</h3><p>Phân biệt rõ chứng nhận đang có hiệu lực, đã bị thu hồi hoặc đã được thay thế bằng mã mới.</p></article><article><i>◇</i><h3>Không lộ dữ liệu cá nhân</h3><p>Hệ thống chỉ tra cứu theo mã chứng nhận, không cho phép tìm kiếm bằng số điện thoại hay email cá nhân.</p></article><article><i>▦</i><h3>Tương thích mã cũ & mới</h3><p>Hỗ trợ đồng thời mã định danh ngẫu nhiên mới và các mã chứng nhận đã phát hành trước đây.</p></article></section><section class="dip-section tone faq-v3" id="huong-dan"><details><summary>Vì sao hệ thống không hỗ trợ tra cứu chứng nhận bằng email hay số điện thoại?</summary><p>Để bảo vệ quyền riêng tư và ngăn việc dò tìm danh sách chứng nhận của người khác, Hệ thống Thông tin Số Sky First chỉ cho phép tra cứu khi có mã chứng nhận cụ thể hoặc quét trực tiếp mã QR in trên chứng nhận.</p></details><details><summary>Chứng nhận bị thu hồi hoặc thay thế hiển thị như thế nào?</summary><p>Nếu chứng nhận bị thu hồi, hệ thống hiển thị cảnh báo ĐÃ THU HỒI kèm lý do. Nếu chứng nhận được cấp lại do điều chỉnh thông tin, hệ thống hiển thị ĐÃ ĐƯỢC THAY THẾ và dẫn tới mã chứng nhận mới.</p></details></section>`;
  const form=document.getElementById('credentialForm'), input=document.getElementById('credentialCode'), out=document.getElementById('credentialOut');
  form.onsubmit=async e=>{e.preventDefault();const code=input.value.trim();if(!code)return;out.innerHTML='<div class="loading">Đang đối chiếu mã chứng nhận…</div>';try{const d=await api(`/api/public/credentials/${encodeURIComponent(code)}`);out.innerHTML=credentialResult(d.item);history.replaceState(null,'',`/gcn/${encodeURIComponent(d.item.code)}`);event('verification_success',{category:'credential'})}catch(err){out.innerHTML=failCard(err.message);event('verification_not_found',{category:'credential'})}};
  document.getElementById('scanQr').onclick=()=>openQrScanner(input,form); if(init) form.requestSubmit();
}

function openQrScanner(input,form){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){credentialScanMessage('Trình duyệt hiện tại chưa hỗ trợ quét QR trực tiếp từ camera. Vui lòng nhập mã chứng nhận vào ô tìm kiếm.');return}
  const wrap=document.createElement('div');wrap.className='qr-modal';wrap.innerHTML='<div><button type="button" aria-label="Đóng">✕</button><h2>Quét mã QR trên chứng nhận</h2><video autoplay playsinline muted></video><p>Đưa mã QR vào khung hình để tự động nhận diện.</p></div>';document.body.appendChild(wrap);const video=wrap.querySelector('video'),close=()=>{stream?.getTracks().forEach(t=>t.stop());wrap.remove()},detector=new BarcodeDetector({formats:['qr_code']});let stream=null;wrap.querySelector('button').onclick=close;navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(s=>{stream=s;video.srcObject=s;const tick=async()=>{if(!document.body.contains(wrap))return;try{const codes=await detector.detect(video);if(codes[0]?.rawValue){const raw=codes[0].rawValue;let value=raw;try{const u=new URL(raw);value=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||raw)}catch{}input.value=value;close();form.requestSubmit();return}}catch{}requestAnimationFrame(tick)};tick()}).catch(()=>{close();credentialScanMessage('Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera hoặc nhập mã chứng nhận thủ công.')});
}
function credentialScanMessage(message){const out=document.getElementById('credentialOut');if(out)out.innerHTML=`<div class="notice bad qr-scan-message" role="alert">${esc(message)}</div>`;}

function caseResult(x){const steps=['TIẾP NHẬN','KIỂM TRA','XỬ LÝ','CẦN BỔ SUNG','HOÀN TẤT'];const timeline=x.timeline||[];const seen=new Set(timeline.map(t=>t.label));return `<article class="case-record"><div class="case-head"><div><span>HỒ SƠ ĐÃ XÁC MINH</span><h2>${esc(x.code)}</h2></div><strong>${esc(x.status)}</strong></div><div class="case-meta"><div><span>Người đăng ký</span><b>${esc(x.full_name||'—')}</b></div><div><span>Biểu mẫu</span><b>${esc(x.form_name||x.form_id)}</b></div><div><span>Ngày tiếp nhận</span><b>${fmt(x.submitted_at)}</b></div><div><span>Hướng dẫn tiếp theo</span><b>${esc(x.next_action||'Theo dõi cập nhật')}</b></div></div><div class="timeline">${steps.map((s,i)=>{const ev=timeline.find(t=>t.label===s);const active=seen.has(s);return `<div class="${active?'done':''}"><i>${active?'✓':i+1}</i><span><b>${s}</b><small>${ev?.note?esc(ev.note):active?fmt(ev?.created_at):'Chưa đến bước này'}</small></span></div>`}).join('')}</div>${x.result?`<div class="case-result"><span>KẾT QUẢ XỬ LÝ</span><p>${esc(x.result)}</p></div>`:''}</article>`}

async function caseCenter(app){
  updateActiveNav('hoso');
  setMeta('Tra cứu hồ sơ','Tra cứu trạng thái xử lý hồ sơ trực tuyến trên Hệ thống Thông tin Số Sky First.');
  const qs=new URLSearchParams(location.search), init=qs.get('code')||'';
  app.innerHTML=`<section class="lookup-hero case-hero"><div class="lookup-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>TRA CỨU <strong>HỒ SƠ</strong></h1><p>Theo dõi tiến trình xử lý hồ sơ đã gửi. Để bảo vệ thông tin cá nhân và chống truy cập trái phép (IDOR), hệ thống kiểm tra đồng thời Mã hồ sơ và Email đăng ký ở phía máy chủ.</p><div class="lookup-trust"><span>◇ Xác thực 2 thông tin phía máy chủ</span><span>✓ Không lộ câu trả lời chi tiết</span></div></div><div class="lookup-hero-art case-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="case-folder">▤<span>HỒ SƠ</span></div><div class="case-magnifier">⌕</div><div class="case-lock">◇</div></div></section><section class="lookup-search-panel case-search"><form id="caseForm" class="case-form"><div class="lookup-form-title"><span>▤</span><div><h2>Nhập thông tin xác minh hồ sơ</h2><p>Vui lòng cung cấp đúng mã hồ sơ trên biên nhận và địa chỉ email đã dùng khi đăng ký.</p></div></div><div class="field"><label for="caseCode">Mã hồ sơ *</label><input id="caseCode" value="${esc(init)}" placeholder="Ví dụ: SFN-TV-2026-0001" autocomplete="off" required></div><div class="field"><label for="caseEmail">Email đã đăng ký *</label><input id="caseEmail" type="email" placeholder="Nhập email đã dùng khi nộp hồ sơ" autocomplete="email" required></div><button class="portal-button" type="submit">⌕ &nbsp; TRA CỨU HỒ SƠ <span>→</span></button><p class="privacy-hint">Địa chỉ email chỉ dùng để xác minh quyền tra cứu ở máy chủ, không được trả lại trong dữ liệu hiển thị.</p></form><div id="caseOut" aria-live="polite"></div></section>`;
  const f=document.getElementById('caseForm'),out=document.getElementById('caseOut');
  f.onsubmit=async e=>{e.preventDefault();out.innerHTML='<div class="loading">Đang kiểm tra hồ sơ…</div>';const code=document.getElementById('caseCode').value.trim(),email=document.getElementById('caseEmail').value.trim();try{const d=await api('/api/lookup/submission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,email})});out.innerHTML=caseResult(d.item)}catch(err){out.innerHTML=failCard('Không thể tra cứu hồ sơ với thông tin đã cung cấp. Vui lòng kiểm tra lại mã hồ sơ và email đăng ký.')}};
}

async function sponsorshipCenter(app,detailCode=''){
  updateActiveNav('sponsorship');
  setMeta('Minh bạch Tài trợ','Công khai minh bạch các chương trình vận động tài trợ, số tiền cam kết, thực nhận, đã chi và báo cáo đối soát.');
  if(detailCode){
    try{
      const d=await api(`/api/public/sponsorship/${encodeURIComponent(detailCode)}`);
      const c=d.campaign,txs=d.transactions||[],reps=d.reports||[];
      app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">MINH BẠCH TÀI TRỢ · ${esc(c.code)}</span><h1>${esc(c.title)}</h1><p>${esc(c.summary||c.purpose||'Thông tin chi tiết chương trình tài trợ đã được phê duyệt công khai.')}</p><div class="actions"><a class="secondary" href="/tai-tro" style="color:#fff;border-color:#ffffff55;background:#ffffff1a;">← Quay lại danh sách chương trình tài trợ</a></div></section>
      <section class="dip-section tight">
        <div class="sponsorship-metrics-grid">
          <article class="sp-metric-card"><small>01 · MỤC TIÊU TÀI TRỢ</small><strong>${esc(fmtVnd(c.target_amount))}</strong><span>Kinh phí mục tiêu của đợt vận động</span></article>
          <article class="sp-metric-card"><small>02 · SỐ TIỀN ĐÃ CAM KẾT</small><strong>${esc(fmtVnd(c.pledged_amount))}</strong><span>Khoản cam kết (chưa tính vào thực nhận)</span></article>
          <article class="sp-metric-card is-highlight"><small>03 · SỐ TIỀN THỰC NHẬN</small><strong>${esc(fmtVnd(c.received_amount))}</strong><span>Khoản đã thực tế tiếp nhận và xác minh</span></article>
          <article class="sp-metric-card"><small>04 · SỐ TIỀN ĐÃ CHI</small><strong>${esc(fmtVnd(c.disbursed_amount))}</strong><span>Khoản đã giải ngân theo mục đích</span></article>
          <article class="sp-metric-card"><small>05 · SỐ DƯ CÒN LẠI</small><strong>${esc(fmtVnd(c.remaining_amount))}</strong><span>Tính theo: Thực nhận trừ Đã chi</span></article>
        </div>
        <div class="card" style="margin-top:20px;">
          <h3>Thông tin chương trình & nguyên tắc đối soát</h3>
          <p><b>Mục đích sử dụng:</b> ${esc(c.purpose||c.summary||'Theo kế hoạch chương trình đã phê duyệt.')}</p>
          <p><b>Thời gian thực hiện:</b> ${esc(c.start_at?fmt(c.start_at):'Đang cập nhật')} — ${esc(c.end_at?fmt(c.end_at):'Đang cập nhật')} · <b>Cập nhật lần cuối:</b> ${esc(fmt(c.updated_at))}</p>
        </div>
        <h2 style="margin:32px 0 14px;">Nhật ký giao dịch thu / chi công khai đã xác minh</h2>
        ${txs.length?`<div class="card table-scroll"><table><thead><tr><th>Mã GD</th><th>Loại chỉ tiêu</th><th>Nội dung / Đơn vị (đã ẩn dữ liệu nhạy cảm)</th><th>Số tiền</th><th>Thời gian</th><th>Chứng từ</th></tr></thead><tbody>${txs.map(tx=>`<tr><td><b>${esc(tx.tx_code)}</b></td><td><span class="status">${esc(tx.tx_type==='pledge'?'Cam kết':tx.tx_type==='receipt'?'Thực nhận (Thu)':tx.tx_type==='disbursement'?'Giải ngân (Chi)':tx.tx_type)}</span></td><td><b>${esc(tx.public_party_label)}</b><br><span class="small muted">${esc(tx.purpose||'')}</span></td><td><b>${esc(fmtVnd(tx.amount))}</b></td><td>${esc(fmt(tx.occurred_at))}</td><td>${tx.voucher_file_id?`<a href="/api/files/${encodeURIComponent(tx.voucher_file_id)}" target="_blank" rel="noopener">Xem chứng từ ↗</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Chưa có giao dịch công khai nào được công bố cho chương trình này.')}
        <h2 style="margin:32px 0 14px;">Báo cáo & chứng từ tổng hợp</h2>
        ${reps.length?`<div class="resource-list">${reps.map(r=>`<article><i>▤</i><div><span>KỲ BÁO CÁO: ${esc(r.report_period||'Tổng hợp')}</span><h3>${esc(r.title)}</h3><p class="small muted">${esc(r.summary||'')}</p></div>${r.file_id?`<a class="portal-button" href="/api/files/${encodeURIComponent(r.file_id)}" target="_blank" rel="noopener">Mở báo cáo →</a>`:''}</article>`).join('')}</div>`:empty('Chưa có báo cáo định kỳ được xuất bản cho chương trình này.')}
      </section>`;
      return;
    }catch(err){
      app.innerHTML=lookupShell('MINH BẠCH TÀI TRỢ','Không tìm thấy chương trình tài trợ yêu cầu.')+`<section class="dip-section tight">${failCard(err.message)}<div class="actions" style="margin-top:16px;"><a class="portal-button" href="/tai-tro">Quay lại trang Tài trợ →</a></div></section>`;
      return;
    }
  }
  const d=await api('/api/public/sponsorship');
  const s=d.summary||{}, campaigns=d.campaigns||[], reports=d.reports||[];
  app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">MINH BẠCH TÀI CHÍNH & TÀI TRỢ</span><h1>CÔNG KHAI <strong>TÀI TRỢ</strong></h1><p>Module minh bạch tài trợ độc lập của Hệ thống Thông tin Số Sky First. Phân biệt rõ ràng 5 chỉ tiêu: Mục tiêu tài trợ, Số tiền đã cam kết, Số tiền thực nhận, Số tiền đã chi và Số tiền còn lại.</p></section>
  <section class="dip-section tight">
    ${s.has_data?`
      <div class="sponsorship-metrics-grid">
        <article class="sp-metric-card"><small>01 · MỤC TIÊU TÀI TRỢ</small><strong>${esc(fmtVnd(s.target_amount))}</strong><span>Tổng mục tiêu các chương trình công khai</span></article>
        <article class="sp-metric-card"><small>02 · SỐ TIỀN ĐÃ CAM KẾT</small><strong>${esc(fmtVnd(s.pledged_amount))}</strong><span>Khoản cam kết (tách biệt với thực nhận)</span></article>
        <article class="sp-metric-card is-highlight"><small>03 · SỐ TIỀN THỰC NHẬN</small><strong>${esc(fmtVnd(s.received_amount))}</strong><span>Tổng tiền thực nhận đã xác minh</span></article>
        <article class="sp-metric-card"><small>04 · SỐ TIỀN ĐÃ CHI</small><strong>${esc(fmtVnd(s.disbursed_amount))}</strong><span>Tổng tiền đã giải ngân có đối soát</span></article>
        <article class="sp-metric-card"><small>05 · SỐ DƯ CÒN LẠI</small><strong>${esc(fmtVnd(s.remaining_amount))}</strong><span>Bằng: Số tiền thực nhận trừ Số tiền đã chi</span></article>
      </div>
      <p class="small muted" style="margin:12px 0 28px;">Thời điểm cập nhật dữ liệu gần nhất: <b>${esc(s.updated_at?fmt(s.updated_at):'Đang cập nhật')}</b> · Đơn vị tiền tệ: <b>Đồng Việt Nam (VND)</b>.</p>
      ${sectionHead('CHƯƠNG TRÌNH & ĐỢT VẬN ĐỘNG','Danh sách chương trình tài trợ công khai','Chọn từng chương trình để xem chi tiết các khoản thu, chi và chứng từ đã được phê duyệt công bố.')}
      <div class="program-catalog-grid">${campaigns.map(c=>`<article class="program-card"><div class="program-card-body"><span class="content-tag">${esc(c.code)}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary||c.purpose||'')}</p><div class="sp-card-figures"><div><span>Mục tiêu:</span> <b>${esc(fmtVnd(c.target_amount))}</b></div><div><span>Cam kết:</span> <b>${esc(fmtVnd(c.pledged_amount))}</b></div><div><span>Thực nhận:</span> <b style="color:var(--dip-success)">${esc(fmtVnd(c.received_amount))}</b></div><div><span>Đã chi:</span> <b>${esc(fmtVnd(c.disbursed_amount))}</b></div></div><div class="program-card-foot"><span class="program-status is-active"><i></i>${esc(c.status==='active'?'Đang triển khai':c.status==='completed'?'Đã hoàn thành':c.status)}</span><a href="/tai-tro/${encodeURIComponent(c.code)}">Xem đối soát & chứng từ <b>→</b></a></div></div></article>`).join('')}</div>
      ${reports.length?`<div style="margin-top:44px;">${sectionHead('BÁO CÁO CÔNG KHAI','Báo cáo tài chính & chứng từ','Các báo cáo định kỳ đã được kiểm tra và phê duyệt công khai.')}<div class="resource-list">${reports.map(r=>`<article><i>▤</i><div><span>${esc(r.campaign_code)} · ${esc(r.report_period||'Báo cáo')}</span><h3>${esc(r.title)}</h3></div>${r.file_id?`<a class="portal-button" href="/api/files/${encodeURIComponent(r.file_id)}" target="_blank" rel="noopener">Xem tài liệu →</a>`:''}</article>`).join('')}</div></div>`:''}
    `:`
      <div class="beautiful-empty" style="margin-bottom:28px;">
        <i>♡</i>
        <div>
          <h3>Chưa có dữ liệu tài trợ công khai</h3>
          <p>Hiện tại chưa có chương trình vận động tài trợ hoặc báo cáo tài chính nào được phê duyệt công bố. Hệ thống tuân thủ nguyên tắc minh bạch: không hiển thị số liệu giả lập, không gộp tiền cam kết với tiền thực nhận và chỉ công bố sau khi đã qua quy trình đối soát.</p>
        </div>
      </div>
      <div class="public-benefits">
        <article><i>01</i><h3>Tách biệt Cam kết & Thực nhận</h3><p>Số tiền cam kết và số tiền thực nhận được theo dõi và hiển thị thành hai chỉ tiêu độc lập, tuyệt đối không cộng gộp.</p></article>
        <article><i>02</i><h3>Đối soát trước khi công bố</h3><p>Mọi khoản thu, khoản chi và báo cáo chứng từ phải được quản trị viên có thẩm quyền xác minh trước khi hiển thị công khai.</p></article>
        <article><i>03</i><h3>Bảo vệ dữ liệu nhà tài trợ</h3><p>Không công khai số tài khoản ngân hàng, số định danh cá nhân hoặc thông tin liên hệ riêng tư của nhà tài trợ.</p></article>
      </div>
    `}
  </section>`;
  event('route_view',{category:'sponsorship'});
}

async function safetyCenter(app){
  updateActiveNav('safety');
  setMeta('An toàn & Bảo mật số','Hướng dẫn bảo vệ tài khoản, cảnh báo mạo danh lừa đảo, chính sách quyền riêng tư và kênh báo cáo sự cố an toàn.');
  app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>AN TOÀN <strong>& BẢO MẬT SỐ</strong></h1><p>Hướng dẫn sử dụng hệ thống an toàn, bảo vệ dữ liệu cá nhân, nhận diện các hình thức mạo danh và kênh tiếp nhận báo cáo sự cố bảo mật chính thức.</p></section>
  <section class="dip-section tight">
    <div class="public-benefits">
      <article>
        <i>◇</i>
        <h3>1. Bảo vệ tài khoản & thông tin xác thực</h3>
        <p>Sử dụng mật khẩu tối thiểu 10 ký tự và bật xác thực hai bước (2FA/TOTP) đối với tài khoản quản trị. Tuyệt đối không chia sẻ mã OTP, liên kết kích hoạt tài khoản hoặc liên kết đặt lại mật khẩu cho bất kỳ ai.</p>
      </article>
      <article>
        <i>!</i>
        <h3>2. Cảnh báo mạo danh & lừa đảo</h3>
        <p>Sky First không bao giờ yêu cầu người dùng chuyển tiền để mua vị trí, chức danh hay giấy chứng nhận, và không bao giờ yêu cầu cung cấp mật khẩu qua email hoặc tin nhắn. Chỉ tin cậy tên miền chính thức <b>app.skyfirst.io.vn</b> và <b>skyfirst.io.vn</b>.</p>
      </article>
      <article>
        <i>▣</i>
        <h3>3. Quyền riêng tư & Dữ liệu cá nhân</h3>
        <p>Hệ thống chỉ thu thập dữ liệu cần thiết cho nghiệp vụ đăng ký, xử lý hồ sơ và xác thực chứng nhận. Mã hồ sơ chỉ hiển thị tiến trình khi xác minh đúng email đăng ký tại phía máy chủ.</p>
      </article>
    </div>

    <div class="admin-grid2" style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:22px;" id="privacy">
      <div class="card">
        <span class="section-kicker">HƯỚNG DẪN XỬ LÝ KHẨN CẤP</span>
        <h2>Khi nghi ngờ lộ thông tin hoặc bị truy cập trái phép</h2>
        <ol style="line-height:1.8;padding-left:20px;color:var(--dip-ink);">
          <li>Đổi mật khẩu ngay lập tức và sử dụng chức năng <b>“Đăng xuất tất cả thiết bị”</b> để thu hồi toàn bộ phiên đăng nhập đang hoạt động.</li>
          <li>Kiểm tra lại địa chỉ người gửi email: hệ thống tự động chỉ gửi từ <code>app@skyfirst.io.vn</code>; hỗ trợ kỹ thuật tại <code>support@skyfirst.io.vn</code>; liên hệ chung tại <code>lienhe@skyfirst.io.vn</code>.</li>
          <li>Nếu phát hiện trang web giả mạo, đường dẫn lạ hoặc nghi ngờ lộ dữ liệu hồ sơ, hãy gửi báo cáo ngay qua biểu mẫu bên cạnh để bộ phận kỹ thuật kiểm tra và khóa bảo vệ.</li>
        </ol>
        <div class="notice" style="margin-top:16px;">
          <b>Kênh liên hệ trực tiếp:</b><br>
          • Hỗ trợ kỹ thuật & bảo mật: <a href="mailto:support@skyfirst.io.vn">support@skyfirst.io.vn</a><br>
          • Liên hệ chung: <a href="mailto:lienhe@skyfirst.io.vn">lienhe@skyfirst.io.vn</a>
        </div>
      </div>

      <div class="card">
        <span class="section-kicker">KÊNH TIẾP NHẬN CHÍNH THỨC</span>
        <h2>Báo cáo sự cố an toàn, giả mạo hoặc quyền riêng tư</h2>
        <p class="small muted">Không nhập mật khẩu, khóa bí mật hoặc token xác thực vào nội dung báo cáo.</p>
        <form id="safetyReportForm">
          <div class="row2">
            <div class="field">
              <label for="srCategory">Phân loại sự cố *</label>
              <select id="srCategory" required>
                <option value="Giả mạo / Lừa đảo">Cảnh báo trang / tài khoản giả mạo</option>
                <option value="Truy cập trái phép">Nghi ngờ truy cập trái phép tài khoản</option>
                <option value="Lộ dữ liệu / Quyền riêng tư">Vấn đề quyền riêng tư / dữ liệu cá nhân</option>
                <option value="Lỗi bảo mật kỹ thuật">Báo cáo lỗ hổng / lỗi an toàn kỹ thuật</option>
                <option value="Khác">Vấn đề an toàn khác</option>
              </select>
            </div>
            <div class="field">
              <label for="srSeverity">Mức độ ưu tiên *</label>
              <select id="srSeverity" required>
                <option value="Trung bình">Trung bình</option>
                <option value="Cao">Cao</option>
                <option value="Khẩn cấp">Khẩn cấp</option>
                <option value="Thấp">Thấp</option>
              </select>
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <label for="srName">Họ và tên người báo cáo</label>
              <input id="srName" placeholder="Có thể để trống nếu báo cáo ẩn danh">
            </div>
            <div class="field">
              <label for="srEmail">Email nhận phản hồi</label>
              <input id="srEmail" type="email" placeholder="name@example.com">
            </div>
          </div>
          <div class="field">
            <label for="srTitle">Tiêu đề sự cố *</label>
            <input id="srTitle" required minlength="5" maxlength="200" placeholder="Tóm tắt ngắn gọn vấn đề phát hiện">
          </div>
          <div class="field">
            <label for="srUrl">Đường dẫn (URL) hoặc mã hồ sơ liên quan</label>
            <input id="srUrl" maxlength="400" placeholder="Ví dụ: https://... hoặc mã hồ sơ">
          </div>
          <div class="field">
            <label for="srDesc">Mô tả chi tiết *</label>
            <textarea id="srDesc" rows="4" required minlength="10" maxlength="4000" placeholder="Mô tả thời점, dấu hiệu phát hiện và nội dung cần kiểm tra (không ghi mật khẩu)..."></textarea>
          </div>
          <button type="submit" class="portal-button" id="srSubmitBtn">Gửi báo cáo an toàn →</button>
        </form>
        <div id="srResult" aria-live="polite" style="margin-top:14px;"></div>
      </div>
    </div>
  </section>`;

  const form=document.getElementById('safetyReportForm'), out=document.getElementById('srResult'), btn=document.getElementById('srSubmitBtn');
  form.onsubmit=async e=>{
    e.preventDefault();
    btn.disabled=true; btn.textContent='Đang gửi báo cáo…'; out.innerHTML='';
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
      out.innerHTML=`<div class="notice good"><b>Đã tiếp nhận báo cáo an toàn: ${esc(r.code)}</b><br>${esc(r.message)}</div>`;
    }catch(err){
      out.innerHTML=failCard(err.message);
    }finally{
      btn.disabled=false; btn.textContent='Gửi báo cáo an toàn →';
    }
  };
  event('route_view',{category:'safety'});
}

function renderVisualBlock(b={}){
  const type=b.type||'paragraph';
  const align=b.align||'left';
  const style=`text-align:${esc(align)};`;
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
  if(type==='callout'){
    const tone=['good','warn','bad'].includes(b.tone)?b.tone:'';
    return `<div class="cms-block notice ${tone}"><b>${esc(b.title||'Thông báo')}</b><p style="margin:6px 0 0">${esc(b.text||'')}</p></div>`;
  }
  if(type==='image'){
    const src=b.url||(b.fileId?`/api/files/${encodeURIComponent(b.fileId)}`:'');
    return src?`<figure class="cms-block cms-block-image" style="${style}"><img src="${esc(src)}" alt="${esc(b.alt||b.caption||'Hình ảnh')}" style="max-width:100%;border-radius:16px;">${b.caption?`<figcaption class="small muted">${esc(b.caption)}</figcaption>`:''}</figure>`:'';
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
    return `<div class="cms-block card table-scroll"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${(Array.isArray(r)?r:[]).map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if(type==='columns'){
    const cols=Array.isArray(b.columns)?b.columns:[];
    return `<div class="cms-block cms-block-columns" style="display:grid;grid-template-columns:repeat(${Math.max(1,cols.length)},1fr);gap:18px;">${cols.map(c=>`<div class="card"><h3>${esc(c.title||'')}</h3><p>${esc(c.body||'')}</p></div>`).join('')}</div>`;
  }
  if(type==='pdf_embed'){
    const fid=b.fileId||b.documentId||'';
    const src=fid.startsWith('/')?fid:(fid?`/api/files/${encodeURIComponent(fid)}`:'');
    return `<div class="cms-block card"><h3>${esc(b.title||'Tài liệu PDF đính kèm')}</h3>${src?`<iframe src="${esc(src)}" title="${esc(b.title||'PDF')}" style="width:100%;height:560px;border:1px solid var(--dip-line);border-radius:12px;"></iframe><div class="actions"><a class="portal-button" href="${esc(src)}?download=1">Tải xuống PDF →</a></div>`:`<p class="muted">Tài liệu PDF chưa được gắn hoặc tạm thời không khả dụng.</p>`}</div>`;
  }
  if(type==='form_embed'){
    const fid=b.formId||'member';
    return `<div class="cms-block card"><h3>${esc(b.title||'Biểu mẫu trực tuyến')}</h3><p class="muted">Nhấn vào nút bên dưới để mở và điền biểu mẫu trực tuyến.</p><a class="portal-button" href="/#form/${encodeURIComponent(fid)}">Mở biểu mẫu (${esc(fid)}) →</a></div>`;
  }
  return '';
}

async function cmsPageCenter(app,slug=''){
  try{
    const d=await api(`/api/public/pages/${encodeURIComponent(slug)}`);
    const page=d.item;
    setMeta(page.seo?.meta_title||page.title, page.seo?.meta_description||page.summary||'Trang nội dung Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="page-hero compact"><span class="hero-eyebrow">${esc(page.category||'TRANG NỘI DUNG')}</span><h1>${esc(page.title)}</h1>${page.summary?`<p>${esc(page.summary)}</p>`:''}</section>
    <section class="dip-section tight"><div class="cms-rendered-page" style="display:grid;gap:20px;max-width:980px;margin:0 auto;">${(page.blocks||[]).map(renderVisualBlock).join('')}</div></section>`;
  }catch(err){
    app.innerHTML=lookupShell('KHÔNG TÌM THẤY TRANG','Trang nội dung này chưa được xuất bản hoặc đường dẫn không tồn tại.')+`<section class="dip-section tight"><a class="portal-button" href="/">Về Trang chủ →</a></section>`;
  }
}

async function programsPage(app,kind,detailId=''){
  if(kind==='units'){
    const d=await api('/api/public/units');const items=d.items||[];setMeta('Đơn vị & Đối tác','Các đơn vị trực thuộc và đồng hành trong Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-ecosystem"><div class="catalog-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>ĐƠN VỊ <strong>& ĐỐI TÁC</strong></h1><p>Danh sách đơn vị trực thuộc và đối tác đồng hành được ghi nhận chính thức trên hệ thống.</p></div>${sceneArt('globe')}</section><section class="catalog-section"><div class="ecosystem-detail-grid">${items.map(x=>`<article class="ecosystem-detail-card"><span>${esc(x.code||'Sky First')}</span><h3>${esc(x.name)}</h3><p>${esc(x.unit_type||'')}</p><small>${esc(x.status||'Đang hoạt động')}</small></article>`).join('')||empty('Chưa có đơn vị công khai.')}</div></section>`;return;
  }
  if(kind==='classes'){
    updateActiveNav('programs');
    const d=await api('/api/public/classes');const items=visiblePublicItems(d.items||[]).sort(comparePrograms);const selected=detailId?items.find(x=>String(x.id)===String(detailId)):null;
    if(detailId){
      if(!selected){setMeta('Không tìm thấy chương trình','Chương trình không tồn tại hoặc chưa được công khai.');app.innerHTML=`<section class="detail-missing"><div>${sceneArt('program')}</div><span class="section-kicker">CHƯƠNG TRÌNH Sky First</span><h1>Không tìm thấy chương trình</h1><p>Chương trình này có thể đã được gỡ khỏi danh sách công khai hoặc đường dẫn không còn hợp lệ.</p><a class="portal-button" href="/chuong-trinh">Quay lại danh sách chương trình →</a></section>`;return;}
      const data=jsonObject(selected.data_json),schedule=jsonObject(selected.schedule_json),summary=firstText(data,['description','summary','short_description','intro','content']);
      const detailRows=[selected.level?['Cấp độ',selected.level]:null,selected.status?['Trạng thái',publicStatusLabel(selected.status)]:null,firstText(schedule,['schedule','time','days','duration'])?['Lịch học',firstText(schedule,['schedule','time','days','duration'])]:null,firstText(schedule,['format','mode','modality'])?['Hình thức',firstText(schedule,['format','mode','modality'])]:null,firstText(data,['location','venue'])?['Địa điểm',firstText(data,['location','venue'])]:null,selected.capacity?['Sức chứa',String(selected.capacity)]:null].filter(Boolean);
      setMeta(selected.title,summary||'Thông tin chương trình được đồng bộ từ hệ thống quản trị Sky First.');
      app.innerHTML=`<section class="program-detail-hero"><div class="program-detail-copy"><a class="back-link" href="/chuong-trinh">← Tất cả chương trình</a><span class="hero-eyebrow">${esc(selected.unit_code||'Sky First')}</span><h1>${esc(selected.title)}</h1>${selected.level?`<span class="program-level">${esc(selected.level)}</span>`:''}<p>${esc(summary||'Thông tin chi tiết về chương trình được đồng bộ từ hệ thống quản trị.')}</p><div class="program-detail-status"><span class="program-status ${activeLike(selected.status)?'is-active':''}"><i></i>${esc(publicStatusLabel(selected.status))}</span></div><div class="actions"><a class="portal-button" href="#form/class">Đăng ký tham gia <span>→</span></a><a class="secondary" href="mailto:lienhe@skyfirst.io.vn?subject=${encodeURIComponent('Quan tâm chương trình: '+selected.title)}">Liên hệ tư vấn</a></div></div>${sceneArt(programArtKind(selected))}</section><section class="program-detail-content"><div class="program-detail-main"><span class="section-kicker">THÔNG TIN CHƯƠNG TRÌNH</span><h2>${esc(selected.title)}</h2><p>${esc(summary||'Hãy liên hệ Hệ thống Thông tin Số Sky First để được hướng dẫn thêm về chương trình này.')}</p>${firstText(data,['content','details','learning_outcomes'])?`<div class="program-long-copy">${esc(firstText(data,['content','details','learning_outcomes'])).replace(/\n/g,'<br>')}</div>`:''}</div><aside class="program-detail-facts"><h3>Thông tin tổng quan</h3>${detailRows.length?detailRows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''):`<p>Thông tin bổ sung đang được cập nhật từ hệ thống quản trị.</p>`}<a href="mailto:support@skyfirst.io.vn?subject=${encodeURIComponent('Hỏi về chương trình: '+selected.title)}">Cần hỗ trợ? <span>support@skyfirst.io.vn</span></a></aside></section>`;return;
    }
    setMeta('Chương trình','Khám phá các chương trình giáo dục và cộng đồng trên Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-programs"><div class="catalog-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>CHƯƠNG TRÌNH</h1><p>Khám phá các chương trình đào tạo, lớp học kỹ năng và hoạt động phát triển cộng đồng theo dữ liệu thực tế.</p><div class="catalog-search"><span>⌕</span><input id="programSearch" type="search" placeholder="Tìm chương trình, cấp độ, đơn vị..." aria-label="Tìm chương trình"><button type="button" id="programSearchBtn">Tìm kiếm <span>→</span></button></div><div class="catalog-filter-row" role="group" aria-label="Lọc chương trình"><button class="is-active" type="button" data-program-filter="all">Tất cả</button><button type="button" data-program-filter="education">Đào tạo</button><button type="button" data-program-filter="community">Cộng đồng</button></div></div>${sceneArt('program')}</section><section class="catalog-section"><div class="catalog-section-head"><div><span class="section-kicker">DANH MỤC CHƯƠNG TRÌNH</span><h2>Chương trình đang triển khai</h2><p>Chọn từng chương trình để xem chi tiết lịch trình, trạng thái mở đăng ký và biểu mẫu liên quan.</p></div><span class="catalog-live-note"><i></i>Dữ liệu thực tế</span></div><div class="program-catalog-grid" id="programCatalogGrid">${items.map((x,i)=>programCard(x,i,'catalog')).join('')||`<div class="catalog-empty">${sceneArt('program')}<div><h3>Chưa có chương trình công khai</h3><p>Chương trình sẽ xuất hiện tại đây khi được cập nhật và công bố từ hệ thống quản trị.</p><a href="mailto:lienhe@skyfirst.io.vn">Liên hệ hỗ trợ →</a></div></div>`}</div><p class="catalog-no-results" id="programNoResults" hidden>Không tìm thấy chương trình phù hợp với từ khóa này.</p></section>`;
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
      app.innerHTML=`<section class="event-detail-hero"><div class="event-detail-copy"><a class="back-link" href="/su-kien">← Tất cả sự kiện</a><span class="hero-eyebrow">${esc(selected.unit_code||'Sky First')}</span><h1>${esc(selected.title)}</h1><p>${esc(summary||'Thông tin chi tiết sự kiện được đồng bộ từ hệ thống quản trị.')}</p><div class="event-detail-meta"><span>◷ ${esc(selected.start_at?fmt(selected.start_at):'Thời gian đang cập nhật')}</span><span class="program-status ${activeLike(selected.status)?'is-active':''}"><i></i>${esc(publicStatusLabel(selected.status))}</span></div><div class="actions"><a class="portal-button" href="#form/event">Đăng ký tham gia <span>→</span></a><a class="secondary" href="mailto:lienhe@skyfirst.io.vn?subject=${encodeURIComponent('Hỏi về sự kiện: '+selected.title)}">Liên hệ ban tổ chức</a></div></div>${sceneArt('events')}</section><section class="program-detail-content"><div class="program-detail-main"><span class="section-kicker">THÔNG TIN SỰ KIỆN</span><h2>${esc(selected.title)}</h2><p>${esc(summary||'Vui lòng liên hệ Hệ thống Thông tin Số Sky First để được hướng dẫn thêm.')}</p></div><aside class="program-detail-facts"><h3>Thông tin tổng quan</h3><div><span>Đơn vị</span><b>${esc(selected.unit_code||'Sky First')}</b></div><div><span>Bắt đầu</span><b>${esc(selected.start_at?fmt(selected.start_at):'Chưa cập nhật')}</b></div><div><span>Kết thúc</span><b>${esc(selected.end_at?fmt(selected.end_at):'Chưa cập nhật')}</b></div><div><span>Trạng thái</span><b>${esc(publicStatusLabel(selected.status))}</b></div></aside></section>`;return;}
    setMeta('Sự kiện & Hoạt động','Lịch sự kiện và hoạt động thực tế trên Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-events"><div class="catalog-hero-copy"><span class="hero-eyebrow">HỆ THỐNG THÔNG TIN SỐ · Sky First</span><h1>SỰ KIỆN <strong>& HOẠT ĐỘNG</strong></h1><p>Theo dõi lịch sự kiện, thời gian tổ chức và trạng thái đăng ký thực tế. Không tạo sự kiện mẫu giả lập.</p><div class="catalog-search"><span>⌕</span><input id="eventSearch" type="search" placeholder="Tìm sự kiện, hoạt động..." aria-label="Tìm sự kiện"><button type="button" id="eventSearchBtn">Tìm kiếm <span>→</span></button></div><div class="catalog-filter-row" role="group" aria-label="Lọc sự kiện"><button class="is-active" type="button" data-event-filter="all">▦ Tất cả</button><button type="button" data-event-filter="upcoming">▣ Sắp diễn ra</button><button type="button" data-event-filter="ongoing">◉ Đang diễn ra</button><button type="button" data-event-filter="past">◷ Đã kết thúc</button></div></div>${sceneArt('events')}</section><section class="event-catalog-section"><div class="catalog-section-head"><div><span class="section-kicker">LỊCH SỰ KIỆN</span><h2>Danh sách sự kiện công khai</h2><p>Trạng thái và thời gian sự kiện được hiển thị theo múi giờ Việt Nam (UTC+7).</p></div><span class="catalog-live-note"><i></i>Dữ liệu thực tế</span></div><div id="eventCatalogGrid" class="event-catalog-grid">${items.length?items.map(x=>{const data=jsonObject(x.data_json),status=publicStatusLabel(x.status);return `<a class="event-card" data-status="${esc(eventType(x))}" data-search="${esc([x.title,x.unit_code,status,firstText(data,['description','summary'])].join(' '))}" href="${esc(eventHref(x))}"><div class="event-card-visual">${sceneArt('events')}<span class="event-card-date">${esc(x.start_at?new Date(parseCttTime(x.start_at)).toLocaleDateString('vi-VN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}):'Đang cập nhật')}</span></div><div class="event-card-body"><span class="program-unit">${esc(x.unit_code||'Sky First')}</span><h3>${esc(x.title)}</h3><span class="program-status ${activeLike(x.status)?'is-active':''}"><i></i>${esc(status)}</span><span class="event-card-link">Xem chi tiết <b>→</b></span></div></a>`}).join(''):`<div class="event-empty">${sceneArt('events')}<div><h2>Chưa có sự kiện công khai</h2><p>Hiện tại chưa có sự kiện nào đang mở công khai trên hệ thống. Khi có sự kiện mới được công bố, thông tin sẽ hiển thị tại đây.</p><a class="portal-button" href="/chuong-trinh">Xem các chương trình đang mở <span>→</span></a></div></div>`}</div><p class="catalog-no-results" id="eventNoResults" hidden>Không có sự kiện phù hợp với bộ lọc hiện tại.</p></section>`;
    const search=document.getElementById('eventSearch'),grid=document.getElementById('eventCatalogGrid'),noResults=document.getElementById('eventNoResults');let filter='all';const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.event-card').forEach(card=>{const yes=(!q||(card.dataset.search||'').toLocaleLowerCase('vi').includes(q))&&(filter==='all'||card.dataset.status===filter);card.hidden=!yes;if(yes)count++});if(noResults)noResults.hidden=count>0||!items.length};search?.addEventListener('input',apply);document.getElementById('eventSearchBtn')?.addEventListener('click',apply);document.querySelectorAll('[data-event-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.eventFilter;document.querySelectorAll('[data-event-filter]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));return;
  }
  if(kind==='news'){
    const d=await api('/api/public/news'),items=d.items||[];const selected=detailId?items.find(x=>String(x.slug||x.id)===String(detailId)||String(x.id)===String(detailId)):null;
    if(detailId){if(!selected){setMeta('Không tìm thấy bài viết','Tin tức không tồn tại hoặc không còn công khai.');app.innerHTML=`<section class="detail-missing"><div>${sceneArt('news')}</div><span class="section-kicker">THÔNG BÁO Sky First</span><h1>Không tìm thấy bài viết</h1><p>Bài viết này có thể đã được gỡ khỏi danh sách công khai hoặc đường dẫn không còn hợp lệ.</p><a class="portal-button" href="#news">Quay lại danh sách tin tức →</a></section>`;return;}
      setMeta(selected.title,String(selected.body||'').replace(/<[^>]*>/g,' ').slice(0,150));const tags=(()=>{try{return JSON.parse(selected.tags_json||'[]')}catch{return []}})();
      app.innerHTML=`<article class="news-detail-page"><div class="news-detail-head"><a class="back-link" href="#news">← Tất cả tin tức</a><span class="hero-eyebrow">TIN TỨC & THÔNG BÁO</span><h1>${esc(selected.title)}</h1><div class="news-detail-meta"><span>${esc(selected.published_at?fmt(selected.published_at):'Ngày đăng đang cập nhật')}</span>${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><div class="news-detail-cover">${sceneArt('news')}${selected.cover_file_id?`<img src="/media/${encodeURIComponent(selected.cover_file_id)}" alt="Ảnh đại diện: ${esc(selected.title)}" loading="lazy">`:`<em class="cover-default-note">MINH HỌA MẶC ĐỊNH · CHƯA CÓ ẢNH ĐẠI DIỆN</em>`}</div><div class="news-detail-body">${esc(String(selected.body||'').replace(/<[^>]*>/g,' ').trim()||'Nội dung bài viết đang được cập nhật.').replace(/\n/g,'<br>')}</div><div class="news-detail-foot"><span>Nội dung được công bố trên Hệ thống Thông tin Số Sky First.</span><a href="mailto:lienhe@skyfirst.io.vn?subject=${encodeURIComponent('Trao đổi về tin: '+selected.title)}">Liên hệ <span>→</span></a></div></article>`;bindBrokenCoverImages(app,'.news-detail-cover','ẢNH ĐẠI DIỆN KHÔNG TẢI ĐƯỢC · MINH HỌA MẶC ĐỊNH');return;}
    setMeta('Tin tức & Thông báo','Tin tức và thông báo vận hành trên Hệ thống Thông tin Số Sky First.');
    app.innerHTML=`<section class="catalog-hero catalog-hero-news"><div class="catalog-hero-copy"><span class="hero-eyebrow">TIN TỨC & THÔNG BÁO</span><h1>THÔNG BÁO <strong>HỆ THỐNG</strong></h1><p>Các thông báo và tin tức hoạt động chính thức.</p><div class="catalog-search"><span>⌕</span><input id="newsSearch" type="search" placeholder="Tìm tin tức, thông báo..." aria-label="Tìm tin tức"><button type="button" id="newsSearchBtn">Tìm kiếm <span>→</span></button></div></div>${sceneArt('news')}</section><section class="catalog-section news-catalog-section"><div class="news-catalog-grid" id="newsCatalogGrid">${items.length?items.map((x,i)=>`<a class="news-catalog-card ${i===0?'is-featured':''}" data-search="${esc([x.title,String(x.body||'').replace(/<[^>]*>/g,' '),x.tags_json].join(' '))}" href="${esc(storyHref(x))}"><div class="news-catalog-cover">${sceneArt('news')}${x.cover_file_id?`<img src="/media/${encodeURIComponent(x.cover_file_id)}" alt="Ảnh đại diện: ${esc(x.title)}" loading="lazy">`:''}${x.cover_file_id?'':`<em class="cover-default-note">MINH HỌA MẶC ĐỊNH · CHƯA CÓ ẢNH ĐẠI DIỆN</em>`}<span>${i===0?'TIN NỔI BẬT':'THÔNG BÁO'}</span></div><div class="news-catalog-copy"><small>${esc(x.published_at?fmt(x.published_at):'Ngày đăng đang cập nhật')}</small><h3>${esc(x.title)}</h3><p>${esc(String(x.body||'').replace(/<[^>]*>/g,' ').slice(0,200))}</p><b>Đọc chi tiết <span>→</span></b></div></a>`).join(''):`<div class="catalog-empty">${sceneArt('news')}<div><h3>Chưa có tin tức công khai</h3><p>Các thông báo mới sẽ xuất hiện tại đây khi được xuất bản.</p></div></div>`}</div><p class="catalog-no-results" id="newsNoResults" hidden>Không tìm thấy bài viết phù hợp.</p></section>`;
    const search=document.getElementById('newsSearch'),grid=document.getElementById('newsCatalogGrid'),noResults=document.getElementById('newsNoResults');const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.news-catalog-card').forEach(card=>{const yes=!q||(card.dataset.search||'').toLocaleLowerCase('vi').includes(q);card.hidden=!yes;if(yes)count++});if(noResults)noResults.hidden=count>0||!items.length};search?.addEventListener('input',apply);document.getElementById('newsSearchBtn')?.addEventListener('click',apply);bindBrokenCoverImages(app,'.news-catalog-cover','ẢNH ĐẠI DIỆN KHÔNG TẢI ĐƯỢC · MINH HỌA MẶC ĐỊNH');return;
  }
  if(kind==='resources'){
    updateActiveNav('resources');
    const d=await api('/api/public/resources'),items=d.items||[];
    setMeta('Thư viện Tài liệu & PDF','Thư viện tài liệu số, văn bản, hướng dẫn có phân loại, xem trước PDF trực tiếp và kiểm soát tải xuống.');
    const categories=[...new Set(items.map(x=>x.category||x.doc_type||'Tài liệu'))];
    const previewDocId=new URLSearchParams(location.search).get('preview')||detailId||'';
    const previewDoc=previewDocId?items.find(x=>String(x.id)===String(previewDocId)||String(x.code)===String(previewDocId)):null;
    app.innerHTML=`<section class="catalog-hero catalog-hero-utility"><div class="catalog-hero-copy"><span class="hero-eyebrow">THƯ VIỆN PDF & TÀI LIỆU SỐ · Sky First</span><h1>TÀI LIỆU <strong>& HƯỚNG DẪN</strong></h1><p>Tra cứu, xem trước trực tiếp tệp PDF và tải xuống các tài liệu, quy chế, hướng dẫn được phép công bố trên Hệ thống Thông tin Số Sky First.</p><div class="catalog-search"><span>⌕</span><input id="docSearch" type="search" placeholder="Tìm theo tên tài liệu, mã văn bản, từ khóa..." aria-label="Tìm tài liệu"><button type="button" id="docSearchBtn">Tìm kiếm <span>→</span></button></div><div class="catalog-filter-row" id="docCategoryFilters"><button class="is-active" type="button" data-doc-cat="all">Tất cả danh mục</button>${categories.map(c=>`<button type="button" data-doc-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>${sceneArt('utility')}</section>
    <section class="catalog-section utility-catalog">
      ${previewDoc&&previewDoc.preview_url?`<div class="card pdf-preview-panel" style="margin-bottom:28px;"><div class="toolbar"><div style="margin-right:auto"><span class="pill">${esc(previewDoc.code)} · Phiên bản v${esc(previewDoc.current_version||1)}</span><h2 style="margin:6px 0 0">${esc(previewDoc.title)}</h2></div>${previewDoc.download_url?`<a class="portal-button" href="${esc(previewDoc.download_url)}">Tải xuống PDF →</a>`:''}<a class="secondary" href="/tai-lieu">Đóng xem trước</a></div><iframe src="${esc(previewDoc.preview_url)}" title="Xem trước PDF: ${esc(previewDoc.title)}" style="width:100%;height:620px;border:1px solid var(--dip-line);border-radius:14px;margin-top:14px;"></iframe></div>`:''}
      <div class="catalog-section-head"><div><span class="section-kicker">THƯ VIỆN TÀI LIỆU CÔNG KHAI</span><h2>Danh mục tài liệu & văn bản</h2><p>Chỉ hiển thị các tài liệu có trạng thái công khai và còn hiệu lực.</p></div></div>
      ${items.length?`<div class="resource-list utility-resource-list" id="docCatalogList">${items.map(x=>`<article class="doc-item-row" data-cat="${esc(x.category||x.doc_type||'Tài liệu')}" data-search="${esc([x.title,x.code,x.doc_type,x.category,x.description,x.keywords].join(' '))}"><i>${icon('resource')}</i><div><span>${esc(x.code)} · ${esc(x.category||x.doc_type||'TÀI LIỆU')} · Phiên bản v${esc(x.current_version||1)}</span><h3>${esc(x.title)}</h3>${x.description?`<p class="small muted">${esc(x.description)}</p>`:''}<small>Cập nhật: ${esc(x.issued_at?fmt(x.issued_at):fmt(x.updated_at))}</small></div><div class="actions">${x.preview_url?`<a class="secondary" href="/tai-lieu?preview=${encodeURIComponent(x.id)}">Xem trước PDF</a>`:''}${x.download_url?`<a class="portal-button" href="${esc(x.download_url)}">Tải xuống →</a>`:`<span class="small muted">Chỉ xem trực tuyến</span>`}</div></article>`).join('')}</div><p class="catalog-no-results" id="docNoResults" hidden>Không tìm thấy tài liệu phù hợp với điều kiện lọc.</p>`:`<div class="utility-public-note">Hiện chưa có tài liệu công khai được xuất bản trong thư viện. Khi quản trị viên tải lên và công bố tài liệu PDF, danh sách sẽ hiển thị tại đây.</div>`}
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
function renderRecent(){const el=document.getElementById('recentSearches'),a=recent(),suggestions=['Chương trình','Sự kiện','Tài liệu','Biểu mẫu','Chứng nhận','Tài trợ','An toàn'];if(!el)return;el.innerHTML=`${a.length?`<span>Tìm gần đây</span><div>${a.map(q=>`<button type="button" data-recent="${esc(q)}">${esc(q)}</button>`).join('')}</div>`:''}<span>Gợi ý tra cứu</span><div>${suggestions.map(q=>`<button type="button" data-recent="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;el.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{const q=b.dataset.recent;document.getElementById('globalSearch').value=q;doSearch(q)})}
function resultHref(x){if(x.type==='credential')return `/gcn/${encodeURIComponent(x.ref)}`;if(x.type==='form')return `/#form/${encodeURIComponent(x.ref)}`;if(x.type==='event')return `/su-kien/${encodeURIComponent(x.ref)}`;if(x.type==='program')return `/chuong-trinh/${encodeURIComponent(x.ref)}`;if(x.type==='unit')return '/#units';if(x.type==='resource')return `/tai-lieu?preview=${encodeURIComponent(x.ref)}`;if(x.type==='sponsorship')return `/tai-tro/${encodeURIComponent(x.ref)}`;if(x.type==='cms_page')return `/trang/${encodeURIComponent(x.ref)}`;if(x.type==='news')return `/#news/${encodeURIComponent(x.ref)}`;if(x.type==='page')return x.ref||'/';return '/'}
function highlight(value){const text=String(value??''),q=searchState.query.trim();if(!q)return esc(text);const parts=text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig'));return parts.map(p=>p.toLowerCase()===q.toLowerCase()?`<mark>${esc(p)}</mark>`:esc(p)).join('')}
const SEARCH_TYPE_LABELS={all:'Tất cả',page:'Chức năng',program:'Chương trình',event:'Sự kiện',resource:'Tài liệu',form:'Biểu mẫu',credential:'Chứng nhận',sponsorship:'Tài trợ',cms_page:'Trang thông tin',news:'Thông báo',unit:'Đơn vị'};
function renderSearch(){const out=document.getElementById('globalResults'),filters=document.getElementById('searchFilters');if(!out||!filters)return;const cats=[...new Set(searchState.items.map(x=>x.type))];filters.innerHTML=searchState.items.length?['all',...cats].map(c=>`<button type="button" class="${searchState.filter===c?'active':''}" data-filter="${c}">${esc(SEARCH_TYPE_LABELS[c]||c)}</button>`).join(''):'';filters.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{searchState.filter=b.dataset.filter;searchState.index=-1;renderSearch()});const items=searchState.items.filter(x=>searchState.filter==='all'||x.type===searchState.filter);out.innerHTML=items.length?`<div class="search-count">${items.length} kết quả phù hợp</div>${items.map((x,i)=>`<a class="search-result ${i===searchState.index?'active':''}" data-result-index="${i}" href="${resultHref(x)}"><i>${icon(x.type)}</i><span><small>${esc(SEARCH_TYPE_LABELS[x.type]||x.type)}</small><b>${highlight(x.title)}</b><em>${highlight(x.description||'')}</em></span><strong>→</strong></a>`).join('')}`:`<div class="search-zero"><i>⌕</i><h3>Không tìm thấy kết quả phù hợp</h3><p>Hãy thử từ khóa ngắn hơn, tên chương trình, sự kiện, tài liệu hoặc mã chứng nhận chính xác.</p></div>`}
async function doSearch(q){q=String(q||'').trim();searchState.query=q;if(q.length<2){searchState.items=[];renderSearch();return}const out=document.getElementById('globalResults');if(out)out.innerHTML='<div class="loading">Đang tìm kiếm trên Hệ thống Thông tin Số Sky First…</div>';try{const d=await api(`/api/public/search?q=${encodeURIComponent(q)}`);searchState.items=d.items||[];searchState.filter='all';searchState.index=-1;saveRecent(q);renderRecent();renderSearch();event(searchState.items.length?'search_success':'search_zero_result',{category:'search',count:searchState.items.length})}catch(e){if(out)out.innerHTML=failCard(e.message)}}

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
  document.querySelectorAll('.lang-btn').forEach(btn=>btn.addEventListener('click',()=>{
    applyLanguage(btn.dataset.lang);
    const appEl=document.getElementById('app');
    if(appEl && !document.body.classList.contains('admin-mode')){
      const rawHash=(location.hash||'').slice(1);
      const [route,param]=rawHash.split('/');
      render({app:appEl,path:location.pathname.replace(/\/+$/,'/')||'/',route:route||'',param:param?decodeURIComponent(param):''});
    }
  }));
  applyLanguage(getLang());
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
  if(['/','/tra-cuu','/gcn','/ho-so','/bieu-mau','/chuong-trinh','/su-kien','/tai-lieu','/tai-tro','/an-toan','/tim-kiem'].includes(path)) return true;
  if(['/gcn/','/chuong-trinh/','/su-kien/','/tai-lieu/','/tai-tro/','/trang/'].some(p=>path.startsWith(p))) return true;
  return ['home','forms','lookup','classes','events','units','news','programs','activities','resources','utilities','sponsorship','safety','page','about','fields','ecosystem','connect','privacy','terms'].includes(route);
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
  if(route==='classes'||route==='programs') return programsPage(app,'classes',param||'');
  if(route==='events'||route==='activities') return programsPage(app,'events',param||'');
  if(route==='units'||route==='ecosystem') return programsPage(app,'units');
  if(route==='news') return programsPage(app,'news',param||'');
  if(route==='resources'||route==='utilities') return programsPage(app,'resources',param||'');
  if(route==='sponsorship') return sponsorshipCenter(app,param||'');
  if(route==='safety'||route==='privacy') return safetyCenter(app);
  if(route==='page') return cmsPageCenter(app,param||'');

  // Path-based routes
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

window.SkyFirstDigital={canRender,render,openSearch,applyLanguage};
initShell();
