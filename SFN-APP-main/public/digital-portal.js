const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function parseCttTime(value){
  const raw=String(value??'').trim();if(!raw)return NaN;
  if(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw))return Date.parse(raw);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return Date.parse(`${raw}T00:00:00+07:00`);
  const normalized=raw.includes('T')?raw:raw.replace(' ','T');
  return Date.parse(`${normalized}+07:00`);
}

function getLang(){
  try{return localStorage.getItem('sfn_lang')==='en'?'en':'vi'}catch{return 'vi'}
}

const fmt=d=>{
  const ms=parseCttTime(d);
  const locale=getLang()==='en'?'en-US':'vi-VN';
  return Number.isFinite(ms)?new Date(ms).toLocaleString(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}):"—";
};

const fmtVnd=n=>{
  const num=Number(n);
  if(!Number.isFinite(num))return getLang()==='en'?"No public data":"Chưa có dữ liệu";
  const locale=getLang()==='en'?'en-US':'vi-VN';
  return new Intl.NumberFormat(locale).format(Math.round(num))+(getLang()==='en'?" VND":" ₫");
};

const api=async(path,options={})=>{
  const r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.headers||{})}});
  const ct=r.headers.get("content-type")||"";
  const d=ct.includes("application/json")?await r.json():await r.text();
  if(!r.ok){
    const e=new Error(d?.message||d?.error||`HTTP ${r.status}`);
    e.status=r.status;e.data=d;throw e;
  }
  return d;
};

const event=(name,meta={})=>fetch('/api/public/analytics',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({event:name,route:location.pathname,device_class:innerWidth<700?'mobile':innerWidth<1100?'tablet':'desktop',...meta})
}).catch(()=>{});

/*
 * Mục 5 & Mục 15: Hệ thống biểu tượng SVG đơn sắc, đồng nhất nét vẽ (stroke-width="1.8", currentColor)
 */
export function svgIcon(name, size=20){
  const s = Number(size)||20;
  const paths = {
    home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"></path>',
    document: '<rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="13" y2="16"></line>',
    program: '<rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="13" y2="16"></line>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"></rect><line x1="8" y1="2" x2="8" y2="6"></line><line x1="16" y1="2" x2="16" y2="6"></line><line x1="3" y1="9" x2="21" y2="9"></line><rect x="7" y="12" width="3" height="3" rx="0.5"></rect>',
    event: '<rect x="3" y="4" width="18" height="17" rx="2"></rect><line x1="8" y1="2" x2="8" y2="6"></line><line x1="16" y1="2" x2="16" y2="6"></line><line x1="3" y1="9" x2="21" y2="9"></line>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>',
    resource: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>',
    form: '<rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line>',
    "shield-check": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>',
    verify: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>',
    credential: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>',
    "file-search": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><circle cx="11.5" cy="14.5" r="2.5"></circle><line x1="13.5" y1="16.5" x2="15.5" y2="18.5"></line>',
    case: '<rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="13" y2="16"></line>',
    handshake: '<path d="M11 17l-4-4 3-3 4 4 6-6 3 3-9 9-3-3z"></path><path d="M4 11l4-4 3 3"></path>',
    sponsorship: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"></path>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"></path>',
    "shield-lock": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><rect x="9.5" y="11" width="5" height="4" rx="1"></rect><path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11"></path>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    search: '<circle cx="11" cy="11" r="7"></circle><line x1="20" y1="20" x2="16.2" y2="16.2"></line>',
    qr: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="3" height="3"></rect><line x1="19" y1="14" x2="21" y2="14"></line><line x1="14" y1="19" x2="21" y2="19"></line>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><polyline points="3 7 12 13 21 7"></polyline>',
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    info: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    server: '<rect x="3" y="4" width="18" height="6" rx="2"></rect><rect x="3" y="14" width="18" height="6" rx="2"></rect><line x1="7" y1="7" x2="7.01" y2="7"></line><line x1="7" y1="17" x2="7.01" y2="17"></line>',
    "eye-off": '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
    gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    send: '<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>'
  };
  const body = paths[name] || paths.document;
  return `<svg class="sfn-svg-icon" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const icon=n=>svgIcon(n, 18);

function statusClass(s=''){
  s=String(s).toLowerCase();
  return s.includes('thu hồi')||s.includes('revoked')||s.includes('hết hiệu lực')||s.includes('expired')?'bad':
    s.includes('thay thế')||s.includes('supersed')?'warn':
    s.includes('xác thực')||s.includes('issued')||s.includes('hoàn tất')||s.includes('có hiệu lực')||s.includes('valid')?'good':'';
}

function setMeta(title,desc){
  const sys = getLang()==='en' ? 'Sky First Digital Information System' : 'Hệ thống Thông tin Số Sky First';
  document.title=`${title} — ${sys}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content',desc||sys);
}

function sectionHead(kicker,title,desc){
  return `<div class="dip-section-head"><div><span class="section-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div></div>`;
}

function empty(msg){
  return `<div class="dip-empty"><span>${svgIcon('search',28)}</span><p>${esc(msg)}</p></div>`;
}

function jsonObject(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value||'{}')}catch{return {}}}
function firstText(obj,keys){for(const key of keys){const v=obj?.[key];if(typeof v==='string'&&v.trim())return v.trim()}return ''}
function isHiddenPublicStatus(status=''){return /(^|\b)(nháp|draft|private|ẩn|đã ẩn|unpublished|đã thu hồi|revoked)(\b|$)/i.test(String(status||''))}
function visiblePublicItems(items=[]){return (items||[]).filter(x=>!isHiddenPublicStatus(x.status))}
function programArtKind(item={}){const t=String(item.title||'').toLowerCase();if(t.includes('reading')||t.includes('đọc'))return 'reading';if(t.includes('listening')||t.includes('nghe'))return 'listening';if(t.includes('speaking')||t.includes('nói'))return 'speaking';return 'program'}

function publicStatusLabel(status){
  const s=String(status||'').trim();
  const en=getLang()==='en';
  if(!s)return en?'Status updating':'Trạng thái đang cập nhật';
  if(/draft|nháp|private|ẩn/i.test(s))return en?'Unpublished':'Chưa công khai';
  if(en){
    const map={
      'Đang hoạt động':'Active',
      'Đang mở':'Open',
      'Đang diễn ra':'Ongoing',
      'Sắp diễn ra':'Upcoming',
      'Đã kết thúc':'Completed',
      'Đã tiếp nhận':'Received',
      'Đang xử lý':'In Progress',
      'Cần bổ sung':'Supplement Required',
      'Đã duyệt':'Approved',
      'Hoàn tất':'Completed',
      'Có hiệu lực':'Valid'
    };
    return map[s]||s;
  }
  return s;
}

/*
 * Mục 8 & Mục 14: Từ điển song ngữ tập trung (Việt Nam - Tiếng Anh) cho toàn bộ giao diện tĩnh và động
 */
const I18N = {
  vi: {
    skip_nav: "Bỏ qua điều hướng",
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
    hero_badge: "HỆ THỐNG THÔNG TIN SỐ SKY FIRST",
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
    stat_sponsorship: "Tổng tiền tài trợ",
    live_data: "Dữ liệu thực tế",
    footer_brand_top: "HỆ THỐNG THÔNG TIN SỐ",
    footer_desc: "Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First.",
    footer_col_services: "Chức năng số",
    footer_col_lookup: "Tra cứu & Minh bạch",
    footer_col_contact: "Liên hệ & Hỗ trợ",
    footer_privacy: "Quyền riêng tư & Bảo vệ dữ liệu",
    footer_copyright: "© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.",
    footer_citation: "Mọi thông tin trích dẫn phải ghi rõ nguồn và dẫn liên kết đến nội dung gốc khi có thể; không làm sai lệch nội dung và phải tuân thủ quy định về quyền tác giả, sở hữu trí tuệ và bảo vệ dữ liệu cá nhân.",
    footer_admin_login: "Đăng Nhập Quản Trị",
    search_header: "TÌM KIẾM HỆ THỐNG",
    search_eyebrow: "TÌM KIẾM TRÊN HỆ THỐNG THÔNG TIN SỐ SKY FIRST",
    search_title: "Khám phá thông tin & dịch vụ số",
    search_hint: "Chỉ tìm kiếm trên dữ liệu công khai. Dùng phím ↑ ↓ để chọn, Enter để mở.",
    policy_notice: "Hệ thống chỉ cung cấp các thông tin được phép công khai theo chính sách dữ liệu của Sky First Network. Thông tin cá nhân và dữ liệu nội bộ không thuộc phạm vi công khai phải được bảo vệ, không trả về trong phản hồi tra cứu hoặc hiển thị trên giao diện người dùng.",
    query_time_notice: "Kết quả tra cứu phản ánh trạng thái của bản ghi trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First tại thời điểm thực hiện truy vấn.",
    ev_hero_title_1: "SỰ KIỆN",
    ev_hero_title_2: "HOẠT ĐỘNG",
    ev_hero_desc: "Theo dõi lịch sự kiện, thời gian tổ chức và trạng thái đăng ký thực tế. Không tạo sự kiện mẫu giả lập.",
    ev_search_ph: "Tìm sự kiện, hoạt động...",
    ev_filter_all: "Tất cả",
    ev_filter_upcoming: "Sắp diễn ra",
    ev_filter_ongoing: "Đang diễn ra",
    ev_filter_past: "Đã kết thúc",
    ev_sec_kicker: "DANH SÁCH SỰ KIỆN",
    ev_sec_title: "Danh sách sự kiện công khai",
    ev_sec_desc: "Trạng thái và thời gian sự kiện được hiển thị theo múi giờ Việt Nam (UTC+7).",
    ev_empty_title: "Chưa có sự kiện công khai",
    ev_empty_desc: "Hiện tại chưa có sự kiện nào đang mở công khai trên hệ thống. Khi có sự kiện mới được công bố, thông tin sẽ hiển thị tại đây.",
    ev_empty_cta: "Xem các chương trình đang mở",
    doc_badge: "THƯ VIỆN TÀI LIỆU SỐ SKY FIRST",
    doc_title_1: "TÀI LIỆU",
    doc_title_2: "HƯỚNG DẪN",
    doc_desc: "Tra cứu, xem trực tuyến hoặc tải PDF và tài liệu đã được phê duyệt, công bố trên Hệ thống Thông tin Số Sky First.",
    doc_search_ph: "Tìm theo tên tài liệu, mã văn bản, từ khóa...",
    doc_filter_all: "Tất cả tài liệu",
    doc_sec_kicker: "THƯ VIỆN TÀI LIỆU CÔNG KHAI",
    doc_sec_title: "Danh mục tài liệu & văn bản",
    doc_sec_desc: "Chỉ hiển thị các tài liệu đã được phê duyệt và công bố trên Hệ thống.",
    doc_empty_title: "Chưa có tài liệu công khai",
    doc_empty_desc: "Hiện chưa có tài liệu công khai được xuất bản trên hệ thống. Khi tài liệu mới được phê duyệt và công bố, thông tin sẽ hiển thị tại đây.",
    cert_title_1: "TRA CỨU",
    cert_title_2: "CHỨNG NHẬN",
    cert_desc: "Xác thực trạng thái hiệu lực, thu hồi hoặc thay thế của Giấy chứng nhận, Giấy xác nhận và Bằng khen do Hệ thống Thông tin Số Sky First cấp.",
    cert_pill_1: "Tra cứu bằng mã chứng nhận",
    cert_pill_2: "Đối chiếu trực tiếp cơ sở dữ liệu",
    cert_pill_3: "Hỗ trợ quét mã QR",
    cert_box_title: "Nhập mã chứng nhận để xác thực",
    cert_label: "Mã chứng nhận (GCN / GXN / BK)",
    cert_ph: "Ví dụ: SFN-GCN-12345678 hoặc 001-GCN-SFN/2026",
    cert_btn: "XÁC THỰC",
    cert_qr_btn: "Quét mã QR",
    cert_rule_link: "Quy tắc xác thực chứng nhận",
    cert_c1_title: "Trạng thái minh bạch",
    cert_c1_desc: "Phản ánh rõ chứng nhận đang có hiệu lực, hết hiệu lực, đã bị thu hồi hoặc đã được thay thế bằng mã mới.",
    cert_c2_title: "Không lộ dữ liệu cá nhân",
    cert_c2_desc: "Chỉ hiển thị các thông tin được phép công khai theo chính sách dữ liệu; ẩn tuyệt đối dữ liệu cá nhân nhạy cảm và ghi chú nội bộ.",
    cert_c3_title: "Tương thích mã cũ & mới",
    cert_c3_desc: "Hỗ trợ đồng thời mã định danh ngẫu nhiên mới và các mã chứng nhận đã phát hành trước đây.",
    cert_faq_kicker: "CÂU HỎI THƯỜNG GẶP",
    cert_faq_title: "Giải đáp thắc mắc về tra cứu chứng nhận",
    cert_faq_desc: "Tổng hợp các câu hỏi phổ biến khi tra cứu chứng nhận trên Hệ thống Thông tin Số Sky First.",
    cert_faq_q1: "Chính sách bảo vệ dữ liệu khi tra cứu chứng nhận được áp dụng như thế nào?",
    cert_faq_a1: "Hệ thống chỉ cung cấp các thông tin được phép công khai theo chính sách dữ liệu của Sky First Network. Thông tin cá nhân và dữ liệu nội bộ không thuộc phạm vi công khai được bảo vệ nghiêm ngặt và không trả về trên giao diện người dùng.",
    cert_faq_q2: "Chứng nhận bị thu hồi hoặc thay thế hiển thị như thế nào?",
    cert_faq_a2: "Nếu chứng nhận bị thu hồi, hệ thống hiển thị cảnh báo ĐÃ THU HỒI kèm lý do. Nếu chứng nhận được cấp lại do điều chỉnh thông tin, hệ thống hiển thị ĐÃ ĐƯỢC THAY THẾ và dẫn tới mã chứng nhận mới.",
    case_title_1: "TRA CỨU",
    case_title_2: "HỒ SƠ",
    case_desc: "Theo dõi tiến trình xử lý hồ sơ đã gửi. Để bảo vệ thông tin cá nhân và chống truy cập trái phép (IDOR), hệ thống kiểm tra đồng thời Mã hồ sơ và Email đăng ký ở phía máy chủ.",
    case_pill_1: "Xác thực 2 thông tin phía máy chủ",
    case_pill_2: "Không lưu trữ chi tiết",
    case_box_title: "Nhập thông tin xác minh hồ sơ",
    case_box_desc: "Vui lòng cung cấp đúng mã hồ sơ trên biên nhận và địa chỉ email đã đăng ký.",
    case_code_label: "Mã hồ sơ *",
    case_code_ph: "Ví dụ: SFN-TV-2026-0001",
    case_email_label: "Email đã đăng ký *",
    case_email_ph: "Nhập email đã dùng khi nộp hồ sơ",
    case_btn: "TRA CỨU HỒ SƠ",
    case_hint: "Địa chỉ email chỉ dùng để xác minh quyền tra cứu ở máy chủ, không được trả lại trong dữ liệu hiển thị.",
    case_f1_title: "Bảo vệ dữ liệu cá nhân",
    case_f1_desc: "Thông tin được xử lý an toàn và bảo mật.",
    case_f2_title: "Đối chiếu thông tin phía máy chủ",
    case_f2_desc: "Xác thực 2 thông tin để đảm bảo chính xác.",
    case_f3_title: "Không hiển thị dữ liệu nhạy cảm",
    case_f3_desc: "Hệ thống chỉ hiển thị thông tin được phép.",
    sp_badge: "MINH BẠCH TÀI CHÍNH & TÀI TRỢ",
    sp_title_1: "CÔNG KHAI",
    sp_title_2: "TÀI TRỢ",
    sp_desc: "Module minh bạch tài trợ độc lập của Hệ thống Thông tin Số Sky First. Phân biệt rõ ràng 5 chỉ tiêu: Mục tiêu tài trợ, Số tiền đã cam kết, Số tiền thực nhận, Số tiền đã chi và Số tiền còn lại.",
    sp_pill_1: "Minh bạch, rõ ràng",
    sp_pill_2: "Đối soát công khai",
    sp_pill_3: "Bảo vệ dữ liệu",
    sp_empty_title: "Chưa có dữ liệu tài trợ công khai",
    sp_empty_desc: "Hiện tại chưa có chương trình vận động tài trợ hoặc báo cáo tài chính nào được phê duyệt công bố.",
    sp_c1_title: "Tách biệt Cam kết & Thực nhận",
    sp_c1_desc: "Số tiền cam kết và số tiền thực nhận được theo dõi và hiển thị thành hai chỉ tiêu độc lập, tuyệt đối không cộng gộp.",
    sp_c2_title: "Đối soát trước khi công bố",
    sp_c2_desc: "Mọi khoản thu, khoản chi và báo cáo chứng từ phải được quản trị viên có thẩm quyền xác minh trước khi hiển thị công khai.",
    sp_c3_title: "Bảo vệ dữ liệu nhà tài trợ",
    sp_c3_desc: "Không công khai số tài khoản ngân hàng, số định danh cá nhân hoặc thông tin liên hệ riêng tư của nhà tài trợ.",
    sp_faq_q1: "Vì sao hệ thống không hỗ trợ tra cứu thông tin tài trợ chi tiết?",
    sp_faq_a1: "Nhằm bảo vệ quyền riêng tư của nhà tài trợ và tuân thủ quy định bảo vệ dữ liệu cá nhân, hệ thống chỉ công bố các báo cáo tổng hợp và giao dịch đã được đối soát, ẩn danh hóa thông tin nhạy cảm.",
    sp_faq_q2: "Chính sách bảo mật thông tin nhà tài trợ như thế nào?",
    sp_faq_a2: "Thông tin liên hệ, số tài khoản ngân hàng và định danh cá nhân của nhà tài trợ được bảo mật tại máy chủ và không bao giờ hiển thị trên giao diện công khai.",
    safe_title_1: "AN TOÀN",
    safe_title_2: "BẢO MẬT SỐ",
    safe_desc: "Hướng dẫn sử dụng hệ thống an toàn, bảo vệ dữ liệu cá nhân, nhận diện các hình thức mạo danh và kênh tiếp nhận báo cáo sự cố bảo mật chính thức.",
    safe_c1_title: "1. Bảo vệ tài khoản & thông tin xác thực",
    safe_c1_desc: "Sử dụng mật khẩu tối thiểu 10 ký tự và bật xác thực hai bước (2FA/TOTP) đối với tài khoản quản trị. Tuyệt đối không chia sẻ mã OTP, liên kết kích hoạt tài khoản hoặc liên kết đặt lại mật khẩu cho bất kỳ ai.",
    safe_c2_title: "2. Cảnh báo mạo danh & lừa đảo",
    safe_c2_desc: "Sky First không bao giờ yêu cầu người dùng chuyển tiền để mua vị trí, chức danh hay giấy chứng nhận, và không bao giờ yêu cầu cung cấp mật khẩu qua email hoặc tin nhắn. Chỉ tin cậy tên miền chính thức: app.skyfirst.io.vn và skyfirst.io.vn.",
    safe_c3_title: "3. Quyền riêng tư & Dữ liệu cá nhân",
    safe_c3_desc: "Hệ thống chỉ thu thập dữ liệu cần thiết cho nghiệp vụ đăng ký, xử lý hồ sơ và xác thực chứng nhận. Mã hồ sơ chỉ hiển thị tiến trình khi xác minh đúng email đăng ký tại phía máy chủ.",
    safe_em_kicker: "HƯỚNG DẪN XỬ LÝ KHẨN CẤP",
    safe_em_title: "Khi nghi ngờ lộ thông tin hoặc bị truy cập trái phép",
    safe_em_1: "Đổi mật khẩu ngay lập tức và sử dụng chức năng “Đăng xuất tất cả thiết bị” để thu hồi toàn bộ phiên đăng nhập đang hoạt động.",
    safe_em_2: "Kiểm tra lại địa chỉ người gửi email: Hệ thống tự động chỉ gửi từ @skyfirst.io.vn. Hỗ trợ kỹ thuật tại support@skyfirst.io.vn, vui lòng liên hệ chúng tôi tại skyfirst.io.vn.",
    safe_em_3: "Nếu phát hiện trang web giả mạo, đường dẫn lạ hoặc nghi ngờ lộ dữ liệu hồ sơ, hãy gửi báo cáo ngay qua biểu mẫu bên cạnh để bộ phận kỹ thuật kiểm tra và khóa bảo vệ.",
    safe_contact_title: "Kênh liên hệ trực tiếp:",
    safe_contact_tech: "Hỗ trợ kỹ thuật & bảo mật:",
    safe_contact_gen: "Liên hệ chung:",
    safe_form_kicker: "KÊNH TIẾP NHẬN CHÍNH THỨC",
    safe_form_title: "Báo cáo sự cố an toàn, giả mạo hoặc quyền riêng tư",
    safe_form_note: "Không nhập mật khẩu, khóa bí mật hoặc token xác thực vào nội dung báo cáo.",
    safe_f_cat: "Phân loại sự cố *",
    safe_f_sev: "Mức độ ưu tiên *",
    safe_f_name: "Họ và tên người báo cáo",
    safe_f_name_ph: "Có thể để trống nếu báo cáo ẩn danh",
    safe_f_email: "Email nhận phản hồi",
    safe_f_title: "Tiêu đề sự cố *",
    safe_f_title_ph: "Tóm tắt ngắn gọn vấn đề phát hiện",
    safe_f_url: "Đường dẫn (URL) hoặc mã hồ sơ liên quan",
    safe_f_url_ph: "Ví dụ: https://... hoặc mã hồ sơ",
    safe_f_desc: "Mô tả chi tiết *",
    safe_f_desc_ph: "Mô tả thời gian, dấu hiệu phát hiện và nội dung cần kiểm tra (không ghi mật khẩu)...",
    safe_f_btn: "Gửi báo cáo an toàn"
  },
  en: {
    skip_nav: "Skip to content",
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
    hero_badge: "SKY FIRST DIGITAL INFORMATION SYSTEM",
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
    card_cert_desc: "Verify issued certificates",
    card_safe_title: "Safety",
    card_safe_desc: "Data protection & personal privacy",
    card_sp_title: "Sponsorship",
    card_sp_desc: "Public financial & sponsorship transparency",
    stat_programs: "Programs & events",
    stat_members: "Community members",
    stat_certificates: "Issued certificates",
    stat_partners: "Partners & units",
    stat_sponsorship: "Total sponsorship",
    live_data: "Live database",
    footer_brand_top: "DIGITAL INFORMATION SYSTEM",
    footer_desc: "Explore, verify, register, and manage educational programs, events, documents, forms, certificates, and community support services of Sky First.",
    footer_col_services: "Digital Services",
    footer_col_lookup: "Lookup & Transparency",
    footer_col_contact: "Contact & Support",
    footer_privacy: "Privacy & Data Protection",
    footer_copyright: "© 2026 Sky First Digital Information System. All rights reserved.",
    footer_citation: "All cited information must clearly credit the source and link to the original content when possible; citations must not distort original content and must comply with copyright, intellectual property, and personal data protection regulations.",
    footer_admin_login: "Admin Login",
    search_header: "SYSTEM SEARCH",
    search_eyebrow: "SKY FIRST DIGITAL INFORMATION SYSTEM SEARCH",
    search_title: "Discover public information & services",
    search_hint: "Searches public records only. Use ↑ ↓ arrows to navigate, Enter to open.",
    policy_notice: "The system only provides information permitted for public disclosure under Sky First Network's data policy. Personal information and non-public internal data are protected and never returned in lookup responses or displayed on the user interface.",
    query_time_notice: "The lookup result reflects the state of the record in the Sky First Digital Information System database at the exact time of the query.",
    ev_hero_title_1: "EVENTS",
    ev_hero_title_2: "ACTIVITIES",
    ev_hero_desc: "Track real event schedules, dates, and registration statuses. No simulated or placeholder events.",
    ev_search_ph: "Search events, activities...",
    ev_filter_all: "All",
    ev_filter_upcoming: "Upcoming",
    ev_filter_ongoing: "Ongoing",
    ev_filter_past: "Completed",
    ev_sec_kicker: "EVENT DIRECTORY",
    ev_sec_title: "Public Events List",
    ev_sec_desc: "Event statuses and schedules are displayed in Vietnam Time (UTC+7).",
    ev_empty_title: "No Public Events Available",
    ev_empty_desc: "There are currently no public events open on the system. New events will appear here once published.",
    ev_empty_cta: "View Open Programs",
    doc_badge: "SKY FIRST DIGITAL DOCUMENT LIBRARY",
    doc_title_1: "DOCUMENTS",
    doc_title_2: "GUIDELINES",
    doc_desc: "Search, preview online, or download approved PDFs and official documents published on the Sky First Digital Information System.",
    doc_search_ph: "Search by document title, code, keywords...",
    doc_filter_all: "All documents",
    doc_sec_kicker: "PUBLIC DOCUMENT LIBRARY",
    doc_sec_title: "Document & Regulation Catalog",
    doc_sec_desc: "Displays only approved and officially published documents on the System.",
    doc_empty_title: "No Public Documents Available",
    doc_empty_desc: "There are currently no public documents published on the system. Approved documents will appear here.",
    cert_title_1: "CERTIFICATE",
    cert_title_2: "VERIFICATION",
    cert_desc: "Verify the validity, revocation, or replacement status of Certificates, Confirmations, and Merits issued by the Sky First Digital Information System.",
    cert_pill_1: "Verify by certificate code",
    cert_pill_2: "Direct database verification",
    cert_pill_3: "QR code scanning supported",
    cert_box_title: "Enter Certificate Code to Verify",
    cert_label: "Certificate Code (GCN / GXN / BK)",
    cert_ph: "Example: SFN-GCN-12345678 or 001-GCN-SFN/2026",
    cert_btn: "VERIFY",
    cert_qr_btn: "Scan QR Code",
    cert_rule_link: "Certificate verification rules",
    cert_c1_title: "Transparent Status",
    cert_c1_desc: "Clearly reflects whether a certificate is valid, expired, revoked, or superseded by a new code.",
    cert_c2_title: "Personal Data Protection",
    cert_c2_desc: "Displays only information permitted by Sky First Network's data policy; strictly protects sensitive personal and internal data.",
    cert_c3_title: "Legacy & New Code Compatible",
    cert_c3_desc: "Supports both new randomized identification codes and previously issued legacy certificate codes.",
    cert_faq_kicker: "FREQUENTLY ASKED QUESTIONS",
    cert_faq_title: "Certificate Lookup Questions",
    cert_faq_desc: "Common questions regarding certificate verification on the Sky First Digital Information System.",
    cert_faq_q1: "How is personal data protected during certificate verification?",
    cert_faq_a1: "The system only provides information permitted for public disclosure under Sky First Network's data policy. Sensitive personal data and internal notes are strictly protected and never returned.",
    cert_faq_q2: "How are revoked or replaced certificates displayed?",
    cert_faq_a2: "If a certificate is revoked, the system displays a REVOKED warning with the reason. If re-issued due to updates, it displays SUPERSEDED and links to the replacement code.",
    case_title_1: "APPLICATION",
    case_title_2: "LOOKUP",
    case_desc: "Track the processing progress of your submitted application. To protect personal privacy and prevent unauthorized access (IDOR), the server verifies both your Reference ID and Registered Email simultaneously.",
    case_pill_1: "Dual server-side verification",
    case_pill_2: "Zero sensitive detail exposure",
    case_box_title: "Enter Application Verification Details",
    case_box_desc: "Please provide the exact Reference ID from your receipt and your registered email address.",
    case_code_label: "Reference ID *",
    case_code_ph: "Example: SFN-TV-2026-0001",
    case_email_label: "Registered Email *",
    case_email_ph: "Enter the email used during submission",
    case_btn: "LOOKUP APPLICATION",
    case_hint: "Your email address is used solely for server-side authorization and is never returned in the displayed response.",
    case_f1_title: "Personal Data Protection",
    case_f1_desc: "Information is processed safely and securely.",
    case_f2_title: "Server-Side Verification",
    case_f2_desc: "Dual-factor check ensures accurate authorization.",
    case_f3_title: "No Sensitive Data Exposure",
    case_f3_desc: "Only permitted status information is displayed.",
    sp_badge: "FINANCIAL & SPONSORSHIP TRANSPARENCY",
    sp_title_1: "PUBLIC",
    sp_title_2: "SPONSORSHIP",
    sp_desc: "Independent sponsorship transparency module of the Sky First Digital Information System. Clearly separates 5 metrics: Target Amount, Pledged Amount, Received Amount, Disbursed Amount, and Remaining Balance.",
    sp_pill_1: "Clear & transparent",
    sp_pill_2: "Public reconciliation",
    sp_pill_3: "Donor data protection",
    sp_empty_title: "No Public Sponsorship Data Available",
    sp_empty_desc: "There are currently no sponsorship campaigns or financial reports approved for public disclosure.",
    sp_c1_title: "Separate Pledged & Received",
    sp_c1_desc: "Pledged amounts and actual received amounts are tracked and displayed as two independent metrics, never combined.",
    sp_c2_title: "Reconciled Before Publication",
    sp_c2_desc: "Every receipt, disbursement, and voucher report must be verified by authorized administrators before public display.",
    sp_c3_title: "Donor Privacy Protection",
    sp_c3_desc: "Bank account numbers, personal IDs, and private contact details of donors are never disclosed publicly.",
    sp_faq_q1: "Why doesn't the system support detailed individual donor lookup?",
    sp_faq_a1: "To protect donor privacy and comply with personal data protection regulations, the system publishes reconciled campaign summaries and anonymized transaction vouchers.",
    sp_faq_q2: "How is donor information protected?",
    sp_faq_a2: "Contact details, bank accounts, and personal identification numbers of donors are secured on the server and never exposed on the public interface.",
    safe_title_1: "DIGITAL",
    safe_title_2: "SAFETY & SECURITY",
    safe_desc: "Guidelines for safe system usage, personal data protection, impersonation fraud awareness, and the official security incident reporting channel.",
    safe_c1_title: "1. Account & Credential Protection",
    safe_c1_desc: "Use a password of at least 10 characters and enable two-factor authentication (2FA/TOTP) for administrator accounts. Never share OTP codes, activation links, or password reset links with anyone.",
    safe_c2_title: "2. Impersonation & Fraud Warning",
    safe_c2_desc: "Sky First never asks users to transfer money for positions, titles, or certificates, and never asks for passwords via email or chat. Only trust official domains: app.skyfirst.io.vn and skyfirst.io.vn.",
    safe_c3_title: "3. Privacy & Personal Data",
    safe_c3_desc: "The system collects only data necessary for registration, application processing, and certificate verification. Application progress is shown only after server-side email verification.",
    safe_em_kicker: "EMERGENCY RESPONSE GUIDE",
    safe_em_title: "If You Suspect Data Exposure or Unauthorized Access",
    safe_em_1: "Change your password immediately and use “Revoke all sessions” to invalidate all active sign-in sessions.",
    safe_em_2: "Verify the sender email address: Automated system emails come only from @skyfirst.io.vn. Technical support is at support@skyfirst.io.vn.",
    safe_em_3: "If you discover a phishing website, suspicious link, or suspected record leak, submit a report immediately via the form beside this guide so our technical team can investigate.",
    safe_contact_title: "Direct Contact Channels:",
    safe_contact_tech: "Technical & security support:",
    safe_contact_gen: "General inquiries:",
    safe_form_kicker: "OFFICIAL INTAKE CHANNEL",
    safe_form_title: "Report a Safety, Impersonation, or Privacy Incident",
    safe_form_note: "Do not enter passwords, secret keys, or authentication tokens in the report body.",
    safe_f_cat: "Incident Category *",
    safe_f_sev: "Priority Level *",
    safe_f_name: "Reporter Full Name",
    safe_f_name_ph: "Leave blank to report anonymously",
    safe_f_email: "Contact Email for Response",
    safe_f_title: "Incident Title *",
    safe_f_title_ph: "Brief summary of the issue",
    safe_f_url: "Related URL or Reference Code",
    safe_f_url_ph: "Example: https://... or application code",
    safe_f_desc: "Detailed Description *",
    safe_f_desc_ph: "Describe when it occurred, indicators observed, and details to verify (never include passwords)...",
    safe_f_btn: "Submit Safety Report"
  }
};

function t(key){
  const lang=getLang();
  return I18N[lang]?.[key] || I18N.vi[key] || key;
}

let cachedConfig = null;

function syncDynamicNavigation(cfg){
  if(!cfg) return;
  cachedConfig = cfg;
  const lang = getLang();
  const navList = Array.isArray(cfg.navigation) ? cfg.navigation : [];
  if(navList.length){
    const headerItems = navList.filter(x=>x.location==='header' && !x.parent_id);
    const subItemsMap = new Map();
    for(const sub of navList.filter(x=>x.location==='header' && x.parent_id)){
      const arr = subItemsMap.get(sub.parent_id)||[];
      arr.push(sub);
      subItemsMap.set(sub.parent_id, arr);
    }
    const navEl = document.getElementById('mainNav');
    if(navEl && headerItems.length){
      const matchKeyForUrl = u => {
        if(u==='/') return 'home';
        if(u.startsWith('/chuong-trinh')) return 'programs';
        if(u.startsWith('/su-kien')) return 'events';
        if(u.startsWith('/tai-lieu')) return 'resources';
        if(u.startsWith('/bieu-mau')) return 'forms';
        if(u.startsWith('/gcn')) return 'gcn';
        if(u.startsWith('/ho-so')) return 'hoso';
        if(u.startsWith('/tai-tro')) return 'sponsorship';
        if(u.startsWith('/an-toan')) return 'safety';
        return '';
      };
      navEl.innerHTML = headerItems.map(item=>{
        const lbl = lang==='en'?(item.label_en||item.label_vi):item.label_vi;
        const subs = subItemsMap.get(item.id)||[];
        const targetAttr = item.target==='_blank'?' target="_blank" rel="noopener"':'';
        if(subs.length){
          return `<div class="nav-dropdown"><a class="nav-pill" href="${esc(item.url)}" data-nav-match="${esc(matchKeyForUrl(item.url))}"${targetAttr}><span>${esc(lbl)}</span></a><div class="nav-dropdown-menu">${subs.map(s=>`<a href="${esc(s.url)}"${s.target==='_blank'?' target="_blank" rel="noopener"':''}>${esc(lang==='en'?(s.label_en||s.label_vi):s.label_vi)}</a>`).join('')}</div></div>`;
        }
        return `<a class="nav-pill" href="${esc(item.url)}" data-nav-match="${esc(matchKeyForUrl(item.url))}"${targetAttr}><span>${esc(lbl)}</span></a>`;
      }).join('');
    }
  }
  const copyEl = document.getElementById('footerCopyright');
  if(copyEl){
    copyEl.textContent = lang==='en' ? (cfg.footer_copyright_en || I18N.en.footer_copyright) : (cfg.footer_copyright || I18N.vi.footer_copyright);
  }
  const citEl = document.getElementById('footerCitation');
  if(citEl){
    citEl.textContent = lang==='en' ? (cfg.footer_citation_en || I18N.en.footer_citation) : (cfg.footer_citation || I18N.vi.footer_citation);
  }
  const descEl = document.getElementById('footerDescription');
  if(descEl){
    descEl.textContent = lang==='en' ? (cfg.footer_description_en || I18N.en.footer_desc) : (cfg.footer_description || I18N.vi.footer_desc);
  }
  const admLink = document.getElementById('footerAdminLoginLink');
  if(admLink){
    admLink.href = cfg.admin_login_url || 'https://app.skyfirst.io.vn/admin/login';
    admLink.textContent = t('footer_admin_login');
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
  if(cachedConfig) syncDynamicNavigation(cachedConfig);
  const hs=document.getElementById('homeSearch')||document.getElementById('staticSearch');
  if(hs) hs.placeholder=t('search_placeholder');
}

/*
 * Minh họa đồ họa banner 3D SVG bám sát 9 ảnh tham chiếu (Mục 7 & Mục 15)
 */
function bannerArt(kind='events'){
  if(kind==='events'){
    return `<div class="ref-banner-art" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236" fill="none">
        <ellipse cx="195" cy="212" rx="98" ry="22" fill="#0ea5e9" fill-opacity="0.22" stroke="#38bdf8" stroke-opacity="0.55" stroke-width="2"/>
        <ellipse cx="195" cy="206" rx="76" ry="15" fill="#38bdf8" fill-opacity="0.18"/>
        <rect x="78" y="42" width="54" height="54" rx="12" fill="#1e40af" fill-opacity="0.55" stroke="#60a5fa" stroke-opacity="0.5"/>
        <rect x="91" y="55" width="28" height="26" rx="4" fill="#fff"/>
        <rect x="91" y="55" width="28" height="8" rx="2" fill="#0284c7"/>
        <rect x="54" y="116" width="52" height="56" rx="12" fill="#1e3a8a" fill-opacity="0.6" stroke="#38bdf8" stroke-opacity="0.45"/>
        <rect x="68" y="130" width="24" height="28" rx="3" fill="#38bdf8" fill-opacity="0.85"/>
        <rect x="256" y="64" width="58" height="58" rx="12" fill="#1e40af" fill-opacity="0.55" stroke="#60a5fa" stroke-opacity="0.5"/>
        <circle cx="285" cy="86" r="8" fill="#fff"/>
        <path d="M271 108c0-7 6-12 14-12s14 5 14 12" fill="#fff"/>
        <path d="M138 78h104l22 118H124L138 78z" fill="#1d4ed8"/>
        <rect x="122" y="74" width="116" height="122" rx="16" transform="rotate(-6 122 74)" fill="#ffffff" stroke="#93c5fd" stroke-width="2"/>
        <path d="M122 90a16 16 0 0 1 16-16h84a16 16 0 0 1 16 16v18H122V90z" transform="rotate(-6 122 74)" fill="#0284c7"/>
        <g transform="rotate(-6 122 74)">
          <rect x="138" y="120" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="162" y="120" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="186" y="120" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="210" y="120" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="138" y="142" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="162" y="142" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="186" y="142" width="18" height="15" rx="3" fill="#0284c7"/>
          <rect x="210" y="142" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="138" y="164" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="162" y="164" width="18" height="15" rx="3" fill="#dbeafe"/>
          <rect x="186" y="164" width="18" height="15" rx="3" fill="#dbeafe"/>
        </g>
      </svg>
    </div>`;
  }
  if(kind==='resources'){
    return `<div class="ref-banner-art" aria-hidden="true">
      <svg viewBox="0 0 360 240" width="340" height="226" fill="none">
        <rect x="78" y="54" width="66" height="86" rx="10" fill="#1e3a8a" fill-opacity="0.55" stroke="#38bdf8" stroke-opacity="0.4"/>
        <rect x="236" y="34" width="62" height="78" rx="10" fill="#1e3a8a" fill-opacity="0.45" stroke="#38bdf8" stroke-opacity="0.35"/>
        <rect x="138" y="36" width="106" height="138" rx="14" fill="#0ea5e9" fill-opacity="0.28" stroke="#7dd3fc" stroke-width="2"/>
        <rect x="154" y="62" width="44" height="10" rx="5" fill="#bae6fd"/>
        <rect x="154" y="84" width="74" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="154" y="102" width="74" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="154" y="120" width="74" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="154" y="138" width="52" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="210" y="118" width="68" height="68" rx="14" fill="#0369a1" fill-opacity="0.85" stroke="#7dd3fc" stroke-width="1.8"/>
        <circle cx="240" cy="148" r="14" stroke="#ffffff" stroke-width="3.5"/>
        <line x1="251" y1="159" x2="263" y2="171" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    </div>`;
  }
  if(kind==='credential'){
    return `<div class="ref-banner-art" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236" fill="none">
        <ellipse cx="196" cy="214" rx="94" ry="20" fill="#0284c7" fill-opacity="0.28" stroke="#38bdf8" stroke-opacity="0.6" stroke-width="2"/>
        <rect x="134" y="26" width="118" height="164" rx="14" transform="rotate(6 134 26)" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="2"/>
        <g transform="rotate(6 134 26)">
          <text x="193" y="54" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="800">SKY FIRST</text>
          <text x="193" y="70" text-anchor="middle" fill="#0369a1" font-size="12" font-weight="800">CHỨNG NHẬN</text>
          <circle cx="193" cy="100" r="16" fill="#f59e0b"/>
          <polygon points="193,90 196,97 203,97 197,101 199,108 193,104 187,108 189,101 183,97 190,97" fill="#fff"/>
          <rect x="177" y="132" width="32" height="32" rx="4" fill="#fff" stroke="#0284c7" stroke-width="1.5"/>
          <rect x="181" y="136" width="8" height="8" fill="#0f172a"/>
          <rect x="197" y="136" width="8" height="8" fill="#0f172a"/>
          <rect x="181" y="152" width="8" height="8" fill="#0f172a"/>
          <rect x="193" y="148" width="10" height="10" fill="#0284c7"/>
        </g>
        <path d="M256 126l34 12v28c0 24-34 38-34 38s-34-14-34-38v-28l34-12z" fill="#0284c7" stroke="#bae6fd" stroke-width="2.5"/>
        <polyline points="243 164 253 174 271 154" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;
  }
  if(kind==='case'){
    return `<div class="ref-banner-art" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236" fill="none">
        <ellipse cx="192" cy="208" rx="96" ry="20" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="1.8"/>
        <rect x="122" y="32" width="114" height="152" rx="14" fill="#0ea5e9" fill-opacity="0.25" stroke="#7dd3fc" stroke-width="2"/>
        <rect x="138" y="54" width="34" height="36" rx="6" fill="#bae6fd"/>
        <circle cx="155" cy="67" r="6" fill="#0369a1"/>
        <path d="M145 84c0-5 4-9 10-9s10 4 10 9" fill="#0369a1"/>
        <rect x="180" y="60" width="40" height="7" rx="3.5" fill="#bae6fd"/>
        <rect x="180" y="74" width="32" height="7" rx="3.5" fill="#7dd3fc"/>
        <rect x="138" y="104" width="82" height="8" rx="4" fill="#bae6fd"/>
        <rect x="138" y="120" width="82" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="138" y="136" width="68" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="138" y="152" width="54" height="8" rx="4" fill="#7dd3fc"/>
        <circle cx="222" cy="146" r="34" fill="#0284c7" fill-opacity="0.55" stroke="#e0f2fe" stroke-width="5"/>
        <line x1="247" y1="171" x2="275" y2="199" stroke="#bae6fd" stroke-width="9" stroke-linecap="round"/>
      </svg>
    </div>`;
  }
  if(kind==='sponsorship'){
    return `<div class="ref-banner-art" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236" fill="none">
        <ellipse cx="195" cy="212" rx="102" ry="22" fill="#0284c7" fill-opacity="0.24" stroke="#38bdf8" stroke-opacity="0.6" stroke-width="2"/>
        <rect x="138" y="28" width="112" height="152" rx="16" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="2"/>
        <circle cx="194" cy="68" r="18" fill="#0284c7"/>
        <text x="194" y="74" text-anchor="middle" fill="#fff" font-size="14" font-weight="800">S</text>
        <rect x="160" y="100" width="68" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="160" y="116" width="68" height="8" rx="4" fill="#7dd3fc"/>
        <rect x="160" y="132" width="50" height="8" rx="4" fill="#7dd3fc"/>
        <ellipse cx="118" cy="126" rx="26" ry="9" fill="#38bdf8"/>
        <ellipse cx="118" cy="142" rx="26" ry="9" fill="#0284c7"/>
        <ellipse cx="118" cy="158" rx="26" ry="9" fill="#0369a1"/>
        <circle cx="130" cy="164" r="28" fill="#0ea5e9" stroke="#bae6fd" stroke-width="2.5"/>
        <text x="130" y="174" text-anchor="middle" fill="#fff" font-size="28" font-weight="800">$</text>
        <path d="M252 108l34 12v28c0 24-34 38-34 38s-34-14-34-38v-28l34-12z" fill="#0ea5e9" stroke="#bae6fd" stroke-width="2.5"/>
        <polyline points="239 146 249 156 267 136" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;
  }
  if(kind==='safety'){
    return `<div class="ref-banner-art" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236" fill="none">
        <ellipse cx="196" cy="214" rx="92" ry="18" stroke="#38bdf8" stroke-opacity="0.5" stroke-width="2"/>
        <rect x="236" y="54" width="76" height="28" rx="6" fill="#1e3a8a" stroke="#38bdf8" stroke-opacity="0.5"/>
        <rect x="236" y="90" width="76" height="28" rx="6" fill="#1e3a8a" stroke="#38bdf8" stroke-opacity="0.5"/>
        <rect x="236" y="126" width="76" height="28" rx="6" fill="#1e3a8a" stroke="#38bdf8" stroke-opacity="0.5"/>
        <rect x="74" y="114" width="68" height="48" rx="10" fill="#0284c7" fill-opacity="0.45" stroke="#7dd3fc" stroke-width="1.5"/>
        <path d="M188 32l64 22v52c0 46-64 74-64 74s-64-28-64-74V54l64-22z" fill="#0284c7" fill-opacity="0.65" stroke="#bae6fd" stroke-width="3"/>
        <rect x="164" y="96" width="48" height="40" rx="8" fill="#ffffff"/>
        <path d="M174 96V82a14 14 0 0 1 28 0v14" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <circle cx="188" cy="113" r="4.5" fill="#0284c7"/>
        <rect x="185.5" y="116" width="5" height="10" rx="2" fill="#0284c7"/>
      </svg>
    </div>`;
  }
  return `<div class="ref-banner-art" aria-hidden="true">${svgIcon('document',84)}</div>`;
}

function emptyIllustrationSvg(){
  return `<div class="sfn-empty-illustration" aria-hidden="true">
    <svg viewBox="0 0 180 120" width="150" height="100" fill="none">
      <rect x="28" y="16" width="112" height="78" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <path d="M28 26a10 10 0 0 1 10-10h92a10 10 0 0 1 10 10v8H28v-8z" fill="#93c5fd"/>
      <circle cx="38" cy="25" r="2.2" fill="#fff"/>
      <circle cx="46" cy="25" r="2.2" fill="#fff"/>
      <circle cx="54" cy="25" r="2.2" fill="#fff"/>
      <circle cx="46" cy="50" r="5" fill="#e2e8f0"/>
      <rect x="58" y="46" width="54" height="8" rx="4" fill="#e2e8f0"/>
      <circle cx="46" cy="68" r="5" fill="#e2e8f0"/>
      <rect x="58" y="64" width="42" height="8" rx="4" fill="#e2e8f0"/>
      <circle cx="116" cy="68" r="20" fill="#ffffff" stroke="#3b82f6" stroke-width="4"/>
      <line x1="131" y1="83" x2="147" y2="99" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>
    </svg>
  </div>`;
}

function storyHref(item){return `#news/${encodeURIComponent(item.slug||item.id||'')}`}
function programHref(item){return `/chuong-trinh/${encodeURIComponent(item.id||'')}`}
function eventHref(item){return `/su-kien/${encodeURIComponent(item.id||'')}`}
function activeLike(status=''){return /đang hoạt động|đang mở|active|open|ongoing|đang diễn ra/i.test(String(status||''))}
function comparePrograms(a,b){const rank=x=>{const t=String(x.title||'').toLowerCase();if(/tiếng anh trung cấp|b1\s*-?\s*b2/.test(t))return 0;if(/reading/.test(t))return 1;if(/listening/.test(t))return 2;if(/speaking/.test(t))return 3;return 4};return rank(a)-rank(b)}

function programCard(item,index=0,mode='catalog'){
  const data=jsonObject(item.data_json),schedule=jsonObject(item.schedule_json);
  const desc=firstText(data,['description','summary','short_description','intro','content']);
  const status=publicStatusLabel(item.status),timeText=firstText(schedule,['schedule','time','days','duration','format']);
  return `<article class="program-card program-card-${esc(mode)}"><div class="program-card-body"><div class="program-card-meta"><span class="program-unit">${esc(item.unit_code||'SKY FIRST')}</span>${item.level?`<span class="program-level">${esc(item.level)}</span>`:''}</div><h3><a href="${esc(programHref(item))}">${esc(item.title)}</a></h3>${desc?`<p>${esc(desc)}</p>`:`<p class="program-card-placeholder">${esc(getLang()==='en'?'Program details are synchronized from the administration system.':'Thông tin chi tiết chương trình được cập nhật từ hệ thống quản trị.')}</p>`}<div class="program-card-foot"><span class="program-status ${activeLike(item.status)?'is-active':''}"><i></i>${esc(status)}</span>${timeText?`<small>${esc(timeText)}</small>`:''}<a href="${esc(programHref(item))}">${esc(getLang()==='en'?'Details':'Chi tiết')} <b>→</b></a></div></div></article>`;
}

function updateActiveNav(activeKey){
  document.querySelectorAll('#mainNav a.nav-pill').forEach(a=>{
    const match=a.dataset.navMatch===activeKey;
    a.classList.toggle('is-active',match);
    if(match) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
}

/*
 * Mục 7: Giao diện Trang chủ (/) bám sát ảnh tham chiếu image_2e9469.jpg
 */
async function home(app){
  updateActiveNav('home');
  setMeta(t('hero_title_top')+' SKY FIRST',t('hero_desc'));
  const [classes,events,resources,config]=await Promise.allSettled([
    api('/api/public/classes'),
    api('/api/public/events'),
    api('/api/public/resources'),
    api('/api/config')
  ]);
  if(config.status==='fulfilled' && config.value){
    syncDynamicNavigation(config.value);
    updateActiveNav('home');
  }
  const c=classes.value?.items||[], ev=events.value?.items||[], r=resources.value?.items||[];
  const cfgVal=config.status==='fulfilled'?config.value:{};
  const navList=Array.isArray(cfgVal?.navigation)?cfgVal.navigation:[];
  const quickItems=navList.filter(x=>x.location==='quick_access');
  const lang=getLang();

  const quickPillsHtml = quickItems.length
    ? quickItems.map(item=>`<a href="${esc(item.url)}"><b>${esc(lang==='en'?(item.label_en||item.label_vi):item.label_vi)}</b></a>`).join('')
    : `
      <a href="/chuong-trinh"><b data-i18n="nav_programs">${esc(t('nav_programs'))}</b></a>
      <a href="/su-kien"><b data-i18n="nav_events">${esc(t('nav_events'))}</b></a>
      <a href="/bieu-mau"><b data-i18n="nav_forms">${esc(t('nav_forms'))}</b></a>
      <a href="/gcn"><b data-i18n="nav_certs">${esc(t('nav_certs'))}</b></a>
      <a href="/ho-so"><b data-i18n="nav_cases">${esc(t('nav_cases'))}</b></a>
      <a href="/tai-tro"><b data-i18n="nav_sponsorship">${esc(t('nav_sponsorship'))}</b></a>
      <a href="/an-toan"><b data-i18n="nav_safety">${esc(t('nav_safety'))}</b></a>
    `;

  app.innerHTML=`
  <section class="sfn-clean-hero" id="heroSection">
    <div class="sfn-clean-hero-inner">
      <div class="sfn-hero-badge"><span aria-hidden="true">+</span> <b data-i18n="hero_badge">${esc(t('hero_badge'))}</b></div>
      <h1><span data-i18n="hero_title_top">${esc(t('hero_title_top'))}</span><strong>SKY FIRST</strong></h1>
      <p class="sfn-hero-desc" data-i18n="hero_desc">${esc(t('hero_desc'))}</p>
      <div class="sfn-search-bar" role="search">
        <label class="sr-only" for="homeSearch">${esc(t('search_btn'))}</label>
        <span class="sfn-search-icon" aria-hidden="true">${svgIcon('search',18)}</span>
        <input id="homeSearch" type="search" placeholder="${esc(t('search_placeholder'))}" autocomplete="off">
        <button id="homeSearchBtn" type="button"><span data-i18n="search_btn">${esc(t('search_btn'))}</span> <span aria-hidden="true">→</span></button>
      </div>
      <div class="sfn-quick-pills" aria-label="Truy cập nhanh">
        <span class="sfn-quick-label" data-i18n="quick_label">${esc(t('quick_label'))}</span>
        ${quickPillsHtml}
      </div>

      <div class="sfn-feature-cards-grid" aria-label="Các phân hệ chức năng chính">
        <a class="sfn-fcard fcard-blue" href="/chuong-trinh">
          <div class="sfn-fcard-icon" aria-hidden="true">${svgIcon('document',22)}</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_prog_title">${esc(t('card_prog_title'))}</h2>
            <p data-i18n="card_prog_desc">${esc(t('card_prog_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-purple" href="/su-kien">
          <div class="sfn-fcard-icon" aria-hidden="true">${svgIcon('calendar',22)}</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_ev_title">${esc(t('card_ev_title'))}</h2>
            <p data-i18n="card_ev_desc">${esc(t('card_ev_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-teal" href="/tai-lieu">
          <div class="sfn-fcard-icon" aria-hidden="true">${svgIcon('folder',22)}</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_doc_title">${esc(t('card_doc_title'))}</h2>
            <p data-i18n="card_doc_desc">${esc(t('card_doc_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-amber" href="/gcn">
          <div class="sfn-fcard-icon" aria-hidden="true">${svgIcon('shield-check',22)}</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_cert_title">${esc(t('card_cert_title'))}</h2>
            <p data-i18n="card_cert_desc">${esc(t('card_cert_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-navy" href="/an-toan">
          <div class="sfn-fcard-icon" aria-hidden="true">${svgIcon('shield',22)}</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_safe_title">${esc(t('card_safe_title'))}</h2>
            <p data-i18n="card_safe_desc">${esc(t('card_safe_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
        <a class="sfn-fcard fcard-green" href="/tai-tro">
          <div class="sfn-fcard-icon" aria-hidden="true">${svgIcon('handshake',22)}</div>
          <div class="sfn-fcard-body">
            <h2 data-i18n="card_sp_title">${esc(t('card_sp_title'))}</h2>
            <p data-i18n="card_sp_desc">${esc(t('card_sp_desc'))}</p>
          </div>
          <span class="sfn-fcard-arrow" aria-hidden="true">→</span>
        </a>
      </div>

      <div class="sfn-stats-bar home-stats-5" id="homeStats" aria-label="Chỉ số vận hành hệ thống">
        <div class="sfn-stat-item">
          <div>
            <strong data-stat="programs">0</strong>
            <span data-stat-label="programs" data-i18n="stat_programs">${esc(t('stat_programs'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <div>
            <strong data-stat="members">0</strong>
            <span data-stat-label="members" data-i18n="stat_members">${esc(t('stat_members'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <div>
            <strong data-stat="certificates">0</strong>
            <span data-stat-label="certificates" data-i18n="stat_certificates">${esc(t('stat_certificates'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <div>
            <strong data-stat="partners">0</strong>
            <span data-stat-label="partners" data-i18n="stat_partners">${esc(t('stat_partners'))}</span>
          </div>
        </div>
        <div class="sfn-stat-item">
          <div>
            <strong data-stat="sponsorship">0 ₫</strong>
            <span data-stat-label="sponsorship" data-i18n="stat_sponsorship">${esc(t('stat_sponsorship'))}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  ${visiblePublicItems(c).length?`
  <section class="dip-section live-v3" id="programs">
    ${sectionHead(lang==='en'?'EDUCATIONAL & COMMUNITY PROGRAMS':'CHƯƠNG TRÌNH ĐÀO TẠO & CỘNG ĐỒNG',lang==='en'?'Active Programs':'Chương trình đang triển khai',lang==='en'?'Program data is synchronized directly from the administration system.':'Dữ liệu chương trình và lớp học được đồng bộ trực tiếp từ hệ thống quản trị.')}
    <div class="program-spotlight">${visiblePublicItems(c).sort(comparePrograms).slice(0,4).map((x,i)=>programCard(x,i,'home')).join('')}</div>
    <a class="section-more-link" href="/chuong-trinh">${esc(lang==='en'?'View all programs':'Xem toàn bộ chương trình')} <span>→</span></a>
  </section>`:''}

  ${visiblePublicItems(ev).length?`
  <section class="dip-section tone" id="activities">
    ${sectionHead(lang==='en'?'EVENTS & ACTIVITIES':'SỰ KIỆN & HOẠT ĐỘNG',lang==='en'?'Public Event Schedule':'Lịch sự kiện và hoạt động thực tế','')}
    <div class="event-timeline" id="events">${visiblePublicItems(ev).slice(0,6).map(x=>`<a href="${esc(eventHref(x))}"><time>${x.start_at?fmt(x.start_at):'—'}</time><div><small>${esc(x.unit_code||'SKY FIRST')}</small><h3>${esc(x.title)}</h3><p>${esc(publicStatusLabel(x.status))}</p></div><span>→</span></a>`).join('')}</div>
  </section>`:''}

  ${r.length?`
  <section class="dip-section resources-v3" id="resources">
    ${sectionHead(lang==='en'?'DIGITAL DOCUMENT LIBRARY':'THƯ VIỆN TÀI LIỆU SỐ',lang==='en'?'Documents & Guidelines':'Tài liệu, văn bản và hướng dẫn','')}
    <div class="resource-list">${r.slice(0,6).map(x=>`<article><i>${svgIcon('folder',20)}</i><div><span>${esc(x.category||x.doc_type||'TÀI LIỆU')} · v${esc(x.current_version||1)}</span><h3>${esc(x.title)}</h3></div><div class="actions">${x.preview_url?`<a class="secondary" href="/tai-lieu?preview=${encodeURIComponent(x.id)}">${esc(lang==='en'?'Preview':'Xem trước')}</a>`:''}${x.download_url?`<a class="portal-button" href="${esc(x.download_url)}">${esc(lang==='en'?'Download →':'Tải xuống →')}</a>`:''}</div></article>`).join('')}</div>
  </section>`:''}`;

  const statConfig=cfgVal?.home_stats||{};
  const d1Vals=statConfig.d1_values||{};
  const fmtStat=(n,key)=>{
    const num=Number(n)||0;
    if(key==="sponsorship"){
      if(num===0) return "0 ₫";
      return new Intl.NumberFormat(lang==='en'?'en-US':'vi-VN',{maximumFractionDigits:0}).format(num)+" ₫";
    }
    return new Intl.NumberFormat(lang==='en'?'en-US':'vi-VN',{maximumFractionDigits:0}).format(num);
  };
  document.querySelectorAll("[data-stat]").forEach(el=>{
    const key=el.dataset.stat;
    const rawValue=statConfig.source==="manual"?statConfig.values?.[key]:d1Vals[key];
    const num=Number(rawValue);
    el.textContent=Number.isFinite(num)&&num>=0 ? fmtStat(num,key) : (key==="sponsorship"?"0 ₫":"0");
  });
  document.getElementById('homeSearchBtn')?.addEventListener('click',()=>openSearch(document.getElementById('homeSearch')?.value||''));
  document.getElementById('homeSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openSearch(e.currentTarget.value)}});
  event('route_view',{category:'home'});
}

async function formCenter(app){
  updateActiveNav('forms');
  const lang=getLang();
  setMeta(t('nav_forms'),t('hero_desc'));
  const d=await api('/api/config');
  syncDynamicNavigation(d);
  updateActiveNav('forms');
  const forms=d.forms||[];
  app.innerHTML=`<section class="sfn-ref-banner">
    <div class="sfn-ref-banner-inner">
      <div class="sfn-ref-banner-copy">
        <span class="sfn-banner-pill">${esc(t('hero_badge'))}</span>
        <h1>${esc(lang==='en'?'DIGITAL':'BIỂU MẪU')} <em>${esc(lang==='en'?'FORMS':'ĐIỆN TỬ')}</em></h1>
        <p>${esc(lang==='en'?'Submit program registrations, applications, and requests online. Upon submission, you receive a Reference ID to track progress under Records (/ho-so).':'Gửi đăng ký chương trình, hồ sơ tham gia và yêu cầu trực tuyến. Sau khi gửi thành công, hệ thống cấp mã hồ sơ để bạn tra cứu tiến trình xử lý tại mục Hồ sơ (/ho-so).')}</p>
      </div>
      ${bannerArt('resources')}
    </div>
  </section>
  <section class="dip-section tight">
    ${sectionHead(lang==='en'?'AVAILABLE FORMS':'DANH MỤC BIỂU MẪU',lang==='en'?'Open Digital Forms':'Biểu mẫu đang mở tiếp nhận',lang==='en'?'Select a form below to start your submission.':'Chọn biểu mẫu phù hợp với nhu cầu của bạn.')}
    <div class="form-center-grid">${forms.map(f=>`<article class="form-center-card"><div><span class="content-tag">${esc(f.prefix)}</span><h3>${esc(f.name)}</h3><p>${esc(f.description||'')}</p></div><div><small>${f.min_age?`${esc(lang==='en'?'Minimum age:':'Điều kiện tuổi: từ đủ')} ${esc(f.min_age)}`:''}</small><a class="portal-button" href="#form/${encodeURIComponent(f.id)}">${esc(lang==='en'?'Open Form':'Mở biểu mẫu')} <span>→</span></a></div></article>`).join('')||empty(lang==='en'?'No public forms are currently open.':'Hiện chưa có biểu mẫu công khai đang mở.')}</div>
  </section>`;
  event('route_view',{category:'forms'});
}

function lookupShell(title,desc){
  return `<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><span class="sfn-banner-pill">${esc(t('hero_badge'))}</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></div></div></section>`;
}

async function lookupCenter(app){
  updateActiveNav('gcn');
  const lang=getLang();
  setMeta(lang==='en'?'Lookup Center':'Trung tâm Tra cứu',t('hero_desc'));
  app.innerHTML=lookupShell(lang==='en'?'LOOKUP CENTER':'TRUNG TÂM TRA CỨU',lang==='en'?'Select the verification module: Issued Certificates (/gcn), Submitted Records (/ho-so), or Public Sponsorship (/tai-tro).':'Chọn đúng phân hệ cần tra cứu: Chứng nhận đã phát hành (/gcn), Hồ sơ đã gửi (/ho-so) hoặc Công khai Tài trợ (/tai-tro).')+
  `<section class="lookup-choice-v3"><a class="lookup-choice paper" href="/gcn"><div class="choice-art"><span>${svgIcon('shield-check',24)}</span></div><small>CHỨNG NHẬN (/GCN)</small><h2>${esc(lang==='en'?'Verify Certificates, Confirmations & Merits':'Tra cứu Giấy chứng nhận, Giấy xác nhận & Bằng khen')}</h2><p>${esc(t('cert_desc'))}</p><b>${esc(lang==='en'?'Open Certificate Verification →':'Mở tra cứu chứng nhận →')}</b></a><a class="lookup-choice case" href="/ho-so"><div class="choice-art"><span>${svgIcon('file-search',24)}</span></div><small>HỒ SƠ (/HO-SO)</small><h2>${esc(lang==='en'?'Track Application Progress':'Tra cứu tiến trình xử lý hồ sơ')}</h2><p>${esc(t('case_desc'))}</p><b>${esc(lang==='en'?'Open Record Lookup →':'Mở tra cứu hồ sơ →')}</b></a></section>`;
}

/*
 * Mục 1: Hiển thị kết quả tra cứu chứng nhận tuân thủ chính sách công khai dữ liệu
 */
function credentialResult(x, meta={}){
  const lang=getLang();
  const stText=lang==='en'?(x.status_text_en||x.status_text):x.status_text;
  const policyText=lang==='en'?(meta.policy_notice_en||t('policy_notice')):(meta.policy_notice||t('policy_notice'));
  const timeText=lang==='en'?(meta.query_time_notice_en||t('query_time_notice')):(meta.query_time_notice||t('query_time_notice'));
  return `<article class="verification-record ${statusClass(x.status_text)}">
    <div class="verify-state">
      <i>${x.status==='issued'?svgIcon('check',22):svgIcon('info',22)}</i>
      <div>
        <span>${esc(lang==='en'?'CERTIFICATE VERIFICATION RESULT':'KẾT QUẢ ĐỐI CHIẾU CHỨNG NHẬN')}</span>
        <h2>${esc(stText)}</h2>
      </div>
    </div>
    <dl>
      <div><dt>${esc(lang==='en'?'Certificate Code':'Mã chứng nhận')}</dt><dd>${esc(x.code)}</dd></div>
      <div><dt>${esc(lang==='en'?'Document Type':'Loại văn bản')}</dt><dd>${esc(x.type)}</dd></div>
      <div><dt>${esc(lang==='en'?'Recipient Name':'Người được ghi nhận')}</dt><dd>${esc(x.full_name)}</dd></div>
      <div class="wide"><dt>${esc(lang==='en'?'Citation / Achievement':'Nội dung ghi nhận')}</dt><dd>${esc(x.content)}</dd></div>
      ${x.program?`<div><dt>${esc(lang==='en'?'Program / Activity':'Chương trình / Hoạt động')}</dt><dd>${esc(x.program)}</dd></div>`:''}
      <div><dt>${esc(lang==='en'?'Issuing Authority':'Đơn vị phát hành')}</dt><dd>${esc(x.unit_name)}</dd></div>
      <div><dt>${esc(lang==='en'?'Issue Date':'Ngày phát hành')}</dt><dd>${esc(x.issued_at?fmt(x.issued_at):'—')}</dd></div>
      <div><dt>${esc(lang==='en'?'Validity Status':'Trạng thái hiệu lực')}</dt><dd>${esc(stText)}</dd></div>
      ${x.replacement_code?`<div class="wide"><dt>${esc(lang==='en'?'Superseded By New Code':'Được thay thế bởi mã mới')}</dt><dd><a href="/gcn/${encodeURIComponent(x.replacement_code)}">${esc(x.replacement_code)}</a></dd></div>`:''}
      ${x.revocation_reason?`<div class="wide"><dt>${esc(lang==='en'?'Revocation / Update Reason':'Lý do thu hồi / điều chỉnh')}</dt><dd>${esc(x.revocation_reason)}</dd></div>`:''}
    </dl>
    <p class="record-note">${esc(timeText)} ${esc(policyText)}</p>
  </article>`;
}

function failCard(msg){
  const lang=getLang();
  return `<div class="result-fail" role="alert"><i>×</i><div><h3>${esc(lang==='en'?'Verification Failed':'Không thể xác minh thông tin')}</h3><p>${esc(msg||(lang==='en'?'No matching record found for the provided query.':'Không tìm thấy dữ liệu phù hợp với thông tin đã cung cấp.'))}</p><p class="small muted" style="margin-top:6px;">${esc(t('query_time_notice'))}</p></div></div>`;
}

/*
 * Mục 1 & Mục 7: Trang Tra cứu Chứng nhận (/gcn) bám sát ảnh tham chiếu image_2eeac4.jpg
 */
async function credentialCenter(app,path){
  updateActiveNav('gcn');
  setMeta(t('nav_certs'),t('cert_desc'));
  const pathCode=decodeURIComponent(path.split('/').filter(Boolean)[1]||'');
  const queryCode=new URLSearchParams(location.search).get('code')||'';
  const init=pathCode||queryCode;

  app.innerHTML=`
  <section class="sfn-ref-banner sfn-banner-cert">
    <div class="sfn-ref-banner-inner">
      <div class="sfn-ref-banner-copy">
        <span class="sfn-banner-pill">${esc(t('hero_badge'))}</span>
        <h1>${esc(t('cert_title_1'))} <em>${esc(t('cert_title_2'))}</em></h1>
        <p>${esc(t('cert_desc'))}</p>
        <div class="sfn-banner-trust-pills">
          <span>${svgIcon('shield-check',15)} ${esc(t('cert_pill_1'))}</span>
          <span>${svgIcon('server',15)} ${esc(t('cert_pill_2'))}</span>
          <span>${svgIcon('qr',15)} ${esc(t('cert_pill_3'))}</span>
        </div>
      </div>
      ${bannerArt('credential')}
    </div>
  </section>

  <section class="sfn-floating-lookup-card">
    <div class="sfn-lookup-card-head">
      <div class="sfn-lookup-head-icon">${svgIcon('search',24)}</div>
      <div>
        <h2>${esc(t('cert_box_title'))}</h2>
      </div>
    </div>
    <form id="credentialForm" class="sfn-cert-form">
      <label for="credentialCode">${esc(t('cert_label'))}</label>
      <div class="sfn-cert-input-row">
        <div class="sfn-cert-input-wrap">
          <span class="sfn-input-icon">${svgIcon('search',18)}</span>
          <input id="credentialCode" value="${esc(init)}" placeholder="${esc(t('cert_ph'))}" autocomplete="off" required>
        </div>
        <button type="submit" class="sfn-cert-submit-btn">${svgIcon('shield-check',18)} <span>${esc(t('cert_btn'))}</span> <span aria-hidden="true">→</span></button>
      </div>
      <div class="sfn-cert-sub-actions">
        <button class="sfn-qr-btn" type="button" id="scanQr">${svgIcon('qr',16)} <span>${esc(t('cert_qr_btn'))}</span></button>
        <a class="sfn-rule-link" href="#huong-dan">${svgIcon('info',15)} <span>${esc(t('cert_rule_link'))} ›</span></a>
      </div>
    </form>
    <div class="sfn-lookup-policy-box">
      <p>${esc(t('policy_notice'))}</p>
      <p class="sfn-policy-sub">${esc(t('query_time_notice'))}</p>
    </div>
    <div id="credentialOut" aria-live="polite"></div>
  </section>

  <section class="sfn-three-info-cards">
    <article class="sfn-info-card">
      <div class="sfn-info-icon">${svgIcon('check',20)}</div>
      <div>
        <h3>${esc(t('cert_c1_title'))}</h3>
        <p>${esc(t('cert_c1_desc'))}</p>
      </div>
    </article>
    <article class="sfn-info-card">
      <div class="sfn-info-icon">${svgIcon('shield',20)}</div>
      <div>
        <h3>${esc(t('cert_c2_title'))}</h3>
        <p>${esc(t('cert_c2_desc'))}</p>
      </div>
    </article>
    <article class="sfn-info-card">
      <div class="sfn-info-icon">${svgIcon('document',20)}</div>
      <div>
        <h3>${esc(t('cert_c3_title'))}</h3>
        <p>${esc(t('cert_c3_desc'))}</p>
      </div>
    </article>
  </section>

  <section class="sfn-faq-section" id="huong-dan">
    <div class="sfn-faq-head">
      <span class="section-kicker">${esc(t('cert_faq_kicker'))}</span>
      <h2>${esc(t('cert_faq_title'))}</h2>
      <p>${esc(t('cert_faq_desc'))}</p>
    </div>
    <div class="sfn-faq-list">
      <details>
        <summary><span class="sfn-faq-qicon">?</span> <b>${esc(t('cert_faq_q1'))}</b></summary>
        <div class="sfn-faq-body"><p>${esc(t('cert_faq_a1'))}</p></div>
      </details>
      <details>
        <summary><span class="sfn-faq-qicon">?</span> <b>${esc(t('cert_faq_q2'))}</b></summary>
        <div class="sfn-faq-body"><p>${esc(t('cert_faq_a2'))}</p></div>
      </details>
    </div>
  </section>`;

  const form=document.getElementById('credentialForm'), input=document.getElementById('credentialCode'), out=document.getElementById('credentialOut');
  form.onsubmit=async e=>{
    e.preventDefault();
    const code=input.value.trim();
    if(!code)return;
    out.innerHTML=`<div class="loading">${esc(getLang()==='en'?'Verifying certificate record…':'Đang đối chiếu mã chứng nhận…')}</div>`;
    try{
      const d=await api(`/api/public/credentials/${encodeURIComponent(code)}`);
      out.innerHTML=credentialResult(d.item, d);
      history.replaceState(null,'',`/gcn/${encodeURIComponent(d.item.code)}`);
      event('verification_success',{category:'credential'});
    }catch(err){
      out.innerHTML=failCard(err.message);
      event('verification_not_found',{category:'credential'});
    }
  };
  document.getElementById('scanQr').onclick=()=>openQrScanner(input,form);
  if(init) form.requestSubmit();
}

function openQrScanner(input,form){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){
    credentialScanMessage(getLang()==='en'?'Your browser does not support direct camera QR scanning. Please enter the certificate code manually.':'Trình duyệt hiện tại chưa hỗ trợ quét QR trực tiếp từ camera. Vui lòng nhập mã chứng nhận vào ô tìm kiếm.');
    return;
  }
  const wrap=document.createElement('div');
  wrap.className='qr-modal';
  wrap.innerHTML=`<div><button type="button" aria-label="Close">✕</button><h2>${esc(t('cert_qr_btn'))}</h2><video autoplay playsinline muted></video><p>${esc(getLang()==='en'?'Align the QR code inside the frame.':'Đưa mã QR vào khung hình để tự động nhận diện.')}</p></div>`;
  document.body.appendChild(wrap);
  const video=wrap.querySelector('video'),close=()=>{stream?.getTracks().forEach(tr=>tr.stop());wrap.remove()},detector=new BarcodeDetector({formats:['qr_code']});
  let stream=null;
  wrap.querySelector('button').onclick=close;
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(s=>{
    stream=s;video.srcObject=s;
    const tick=async()=>{
      if(!document.body.contains(wrap))return;
      try{
        const codes=await detector.detect(video);
        if(codes[0]?.rawValue){
          const raw=codes[0].rawValue;
          let value=raw;
          try{const u=new URL(raw);value=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||raw)}catch{}
          input.value=value;close();form.requestSubmit();return;
        }
      }catch{}
      requestAnimationFrame(tick);
    };
    tick();
  }).catch(()=>{
    close();
    credentialScanMessage(getLang()==='en'?'Cannot access camera. Please check camera permissions or enter the code manually.':'Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera hoặc nhập mã chứng nhận thủ công.');
  });
}

function credentialScanMessage(message){
  const out=document.getElementById('credentialOut');
  if(out)out.innerHTML=`<div class="notice bad qr-scan-message" role="alert">${esc(message)}</div>`;
}

function caseResult(x, meta={}){
  const lang=getLang();
  const steps=['TIẾP NHẬN','KIỂM TRA','XỬ LÝ','CẦN BỔ SUNG','HOÀN TẤT'];
  const timeline=x.timeline||[];
  const seen=new Set(timeline.map(tl=>tl.label));
  const timeText=lang==='en'?(meta.query_time_notice_en||t('query_time_notice')):(meta.query_time_notice||t('query_time_notice'));
  return `<article class="case-record" style="margin-top:20px;">
    <div class="case-head">
      <div><span>${esc(lang==='en'?'VERIFIED APPLICATION RECORD':'HỒ SƠ ĐÃ XÁC MINH')}</span><h2>${esc(x.code)}</h2></div>
      <strong>${esc(publicStatusLabel(x.status))}</strong>
    </div>
    <div class="case-meta">
      <div><span>${esc(lang==='en'?'Applicant':'Người đăng ký')}</span><b>${esc(x.full_name||'—')}</b></div>
      <div><span>${esc(lang==='en'?'Form':'Biểu mẫu')}</span><b>${esc(x.form_name||x.form_id)}</b></div>
      <div><span>${esc(lang==='en'?'Submitted At':'Ngày tiếp nhận')}</span><b>${fmt(x.submitted_at)}</b></div>
      <div><span>${esc(lang==='en'?'Next Step':'Hướng dẫn tiếp theo')}</span><b>${esc(x.next_action||'—')}</b></div>
    </div>
    <div class="timeline">${steps.map((s,i)=>{
      const ev=timeline.find(tl=>tl.label===s);
      const active=seen.has(s);
      return `<div class="${active?'done':''}"><i>${active?'✓':i+1}</i><span><b>${esc(s)}</b><small>${ev?.note?esc(ev.note):active?fmt(ev?.created_at):(lang==='en'?'Pending':'Chưa đến bước này')}</small></span></div>`;
    }).join('')}</div>
    ${x.result?`<div class="case-result"><span>${esc(lang==='en'?'PROCESSING OUTCOME':'KẾT QUẢ XỬ LÝ')}</span><p>${esc(x.result)}</p></div>`:''}
    <p class="record-note" style="margin-top:12px;font-size:12px;color:#64748b;">${esc(timeText)}</p>
  </article>`;
}

/*
 * Mục 1 & Mục 7: Trang Tra cứu Hồ sơ (/ho-so) bám sát ảnh tham chiếu image_2eeee2.jpg
 */
async function caseCenter(app){
  updateActiveNav('hoso');
  setMeta(t('nav_cases'),t('case_desc'));
  const qs=new URLSearchParams(location.search), init=qs.get('code')||'';

  app.innerHTML=`
  <section class="sfn-ref-banner sfn-banner-case">
    <div class="sfn-ref-banner-inner">
      <div class="sfn-ref-banner-copy">
        <span class="sfn-banner-pill">${esc(t('hero_badge'))}</span>
        <h1>${esc(t('case_title_1'))} <em>${esc(t('case_title_2'))}</em></h1>
        <p>${esc(t('case_desc'))}</p>
        <div class="sfn-banner-trust-pills">
          <span>${svgIcon('shield-check',15)} ${esc(t('case_pill_1'))}</span>
          <span>${svgIcon('lock',15)} ${esc(t('case_pill_2'))}</span>
        </div>
      </div>
      ${bannerArt('case')}
    </div>
  </section>

  <section class="sfn-floating-lookup-card sfn-case-card">
    <div class="sfn-lookup-card-head">
      <div class="sfn-lookup-head-icon">${svgIcon('document',24)}</div>
      <div>
        <h2>${esc(t('case_box_title'))}</h2>
        <p>${esc(t('case_box_desc'))}</p>
      </div>
    </div>
    <form id="caseForm" class="sfn-case-form">
      <div class="field">
        <label for="caseCode">${esc(t('case_code_label'))}</label>
        <div class="sfn-input-with-icon">
          <span>${svgIcon('document',17)}</span>
          <input id="caseCode" value="${esc(init)}" placeholder="${esc(t('case_code_ph'))}" autocomplete="off" required>
        </div>
      </div>
      <div class="field">
        <label for="caseEmail">${esc(t('case_email_label'))}</label>
        <div class="sfn-input-with-icon">
          <span>${svgIcon('mail',17)}</span>
          <input id="caseEmail" type="email" placeholder="${esc(t('case_email_ph'))}" autocomplete="email" required>
        </div>
      </div>
      <button class="sfn-case-submit-btn" type="submit">${svgIcon('search',17)} <span>${esc(t('case_btn'))} →</span></button>
      <p class="sfn-case-privacy-hint">${svgIcon('info',14)} <span>${esc(t('case_hint'))}</span></p>
    </form>
    <div id="caseOut" aria-live="polite"></div>
  </section>

  <section class="sfn-three-info-cards sfn-case-bottom-badges">
    <article class="sfn-info-card">
      <div class="sfn-info-icon">${svgIcon('shield-check',20)}</div>
      <div>
        <h3>${esc(t('case_f1_title'))}</h3>
        <p>${esc(t('case_f1_desc'))}</p>
      </div>
    </article>
    <article class="sfn-info-card">
      <div class="sfn-info-icon">${svgIcon('server',20)}</div>
      <div>
        <h3>${esc(t('case_f2_title'))}</h3>
        <p>${esc(t('case_f2_desc'))}</p>
      </div>
    </article>
    <article class="sfn-info-card">
      <div class="sfn-info-icon">${svgIcon('eye-off',20)}</div>
      <div>
        <h3>${esc(t('case_f3_title'))}</h3>
        <p>${esc(t('case_f3_desc'))}</p>
      </div>
    </article>
  </section>`;

  const f=document.getElementById('caseForm'),out=document.getElementById('caseOut');
  f.onsubmit=async e=>{
    e.preventDefault();
    out.innerHTML=`<div class="loading">${esc(getLang()==='en'?'Checking application record…':'Đang kiểm tra hồ sơ…')}</div>`;
    const code=document.getElementById('caseCode').value.trim(),email=document.getElementById('caseEmail').value.trim();
    try{
      const d=await api('/api/lookup/submission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,email})});
      out.innerHTML=caseResult(d.item, d);
    }catch(err){
      out.innerHTML=failCard(getLang()==='en'?'Could not verify application with the provided Reference ID and Email.':'Không thể tra cứu hồ sơ với thông tin đã cung cấp. Vui lòng kiểm tra lại mã hồ sơ và email đăng ký.');
    }
  };
}

/*
 * Mục 7: Trang Công khai Tài trợ (/tai-tro) bám sát ảnh tham chiếu image_2ef98b.jpg
 */
async function sponsorshipCenter(app,detailCode=''){
  updateActiveNav('sponsorship');
  const lang=getLang();
  setMeta(t('nav_sponsorship'),t('sp_desc'));
  if(detailCode){
    try{
      const d=await api(`/api/public/sponsorship/${encodeURIComponent(detailCode)}`);
      const c=d.campaign,txs=d.transactions||[],reps=d.reports||[];
      app.innerHTML=`<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><span class="sfn-banner-pill">${esc(t('sp_badge'))} · ${esc(c.code)}</span><h1>${esc(c.title)}</h1><p>${esc(c.summary||c.purpose||'')}</p><div class="actions" style="margin-top:14px;"><a class="secondary" href="/tai-tro" style="color:#fff;border-color:#ffffff55;background:#ffffff1a;">← ${esc(lang==='en'?'Back to Sponsorship':'Quay lại danh sách chương trình tài trợ')}</a></div></div>${bannerArt('sponsorship')}</div></section>
      <section class="dip-section tight">
        <div class="sponsorship-metrics-grid">
          <article class="sp-metric-card"><small>01 · MỤC TIÊU TÀI TRỢ</small><strong>${esc(fmtVnd(c.target_amount))}</strong><span>Kinh phí mục tiêu của đợt vận động</span></article>
          <article class="sp-metric-card"><small>02 · SỐ TIỀN ĐÃ CAM KẾT</small><strong>${esc(fmtVnd(c.pledged_amount))}</strong><span>Khoản cam kết (chưa tính vào thực nhận)</span></article>
          <article class="sp-metric-card is-highlight"><small>03 · SỐ TIỀN THỰC NHẬN</small><strong>${esc(fmtVnd(c.received_amount))}</strong><span>Khoản đã thực tế tiếp nhận và xác minh</span></article>
          <article class="sp-metric-card"><small>04 · SỐ TIỀN ĐÃ CHI</small><strong>${esc(fmtVnd(c.disbursed_amount))}</strong><span>Khoản đã giải ngân theo mục đích</span></article>
          <article class="sp-metric-card"><small>05 · SỐ DƯ CÒN LẠI</small><strong>${esc(fmtVnd(c.remaining_amount))}</strong><span>Tính theo: Thực nhận trừ Đã chi</span></article>
        </div>
        <h2 style="margin:32px 0 14px;">Nhật ký giao dịch thu / chi công khai đã xác minh</h2>
        ${txs.length?`<div class="card table-scroll"><table><thead><tr><th>Mã GD</th><th>Loại chỉ tiêu</th><th>Nội dung / Đơn vị</th><th>Số tiền</th><th>Thời gian</th><th>Chứng từ</th></tr></thead><tbody>${txs.map(tx=>`<tr><td><b>${esc(tx.tx_code)}</b></td><td><span class="status">${esc(tx.tx_type==='pledge'?'Cam kết':tx.tx_type==='receipt'?'Thực nhận (Thu)':tx.tx_type==='disbursement'?'Giải ngân (Chi)':tx.tx_type)}</span></td><td><b>${esc(tx.public_party_label)}</b><br><span class="small muted">${esc(tx.purpose||'')}</span></td><td><b>${esc(fmtVnd(tx.amount))}</b></td><td>${esc(fmt(tx.occurred_at))}</td><td>${tx.voucher_file_id?`<a href="/api/files/${encodeURIComponent(tx.voucher_file_id)}" target="_blank" rel="noopener">Xem chứng từ ↗</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Chưa có giao dịch công khai nào được công bố cho chương trình này.')}
        ${reps.length?`<h2 style="margin:32px 0 14px;">Báo cáo & chứng từ tổng hợp</h2><div class="resource-list">${reps.map(r=>`<article><i>${svgIcon('document',20)}</i><div><span>KỲ BÁO CÁO: ${esc(r.report_period||'Tổng hợp')}</span><h3>${esc(r.title)}</h3><p class="small muted">${esc(r.summary||'')}</p></div>${r.file_id?`<a class="portal-button" href="/api/files/${encodeURIComponent(r.file_id)}" target="_blank" rel="noopener">Mở báo cáo →</a>`:''}</article>`).join('')}</div>`:''}
      </section>`;
      return;
    }catch(err){
      app.innerHTML=lookupShell(t('sp_badge'),err.message)+`<section class="dip-section tight"><a class="portal-button" href="/tai-tro">Quay lại trang Tài trợ →</a></section>`;
      return;
    }
  }

  const d=await api('/api/public/sponsorship');
  const s=d.summary||{}, campaigns=d.campaigns||[], reports=d.reports||[];

  app.innerHTML=`
  <section class="sfn-ref-banner sfn-banner-sponsorship">
    <div class="sfn-ref-banner-inner">
      <div class="sfn-ref-banner-copy">
        <span class="sfn-banner-pill">${esc(t('sp_badge'))}</span>
        <h1>${esc(t('sp_title_1'))} <em>${esc(t('sp_title_2'))}</em></h1>
        <p>${esc(t('sp_desc'))}</p>
        <div class="sfn-banner-trust-pills">
          <span>${svgIcon('shield-check',15)} ${esc(t('sp_pill_1'))}</span>
          <span>${svgIcon('chart',15)} ${esc(t('sp_pill_2'))}</span>
          <span>${svgIcon('lock',15)} ${esc(t('sp_pill_3'))}</span>
        </div>
      </div>
      ${bannerArt('sponsorship')}
    </div>
  </section>

  <section class="dip-section tight">
    ${s.has_data?`
      <div class="sponsorship-metrics-grid" style="margin-bottom:24px;">
        <article class="sp-metric-card"><small>01 · MỤC TIÊU TÀI TRỢ</small><strong>${esc(fmtVnd(s.target_amount))}</strong><span>Tổng mục tiêu các chương trình công khai</span></article>
        <article class="sp-metric-card"><small>02 · SỐ TIỀN ĐÃ CAM KẾT</small><strong>${esc(fmtVnd(s.pledged_amount))}</strong><span>Khoản cam kết (tách biệt với thực nhận)</span></article>
        <article class="sp-metric-card is-highlight"><small>03 · SỐ TIỀN THỰC NHẬN</small><strong>${esc(fmtVnd(s.received_amount))}</strong><span>Tổng tiền thực nhận đã xác minh</span></article>
        <article class="sp-metric-card"><small>04 · SỐ TIỀN ĐÃ CHI</small><strong>${esc(fmtVnd(s.disbursed_amount))}</strong><span>Tổng tiền đã giải ngân có đối soát</span></article>
        <article class="sp-metric-card"><small>05 · SỐ DƯ CÒN LẠI</small><strong>${esc(fmtVnd(s.remaining_amount))}</strong><span>Bằng: Số tiền thực nhận trừ Số tiền đã chi</span></article>
      </div>
      <div class="program-catalog-grid" style="margin-bottom:28px;">${campaigns.map(c=>`<article class="program-card"><div class="program-card-body"><span class="content-tag">${esc(c.code)}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary||c.purpose||'')}</p><div class="sp-card-figures"><div><span>Mục tiêu:</span> <b>${esc(fmtVnd(c.target_amount))}</b></div><div><span>Cam kết:</span> <b>${esc(fmtVnd(c.pledged_amount))}</b></div><div><span>Thực nhận:</span> <b style="color:var(--dip-success)">${esc(fmtVnd(c.received_amount))}</b></div><div><span>Đã chi:</span> <b>${esc(fmtVnd(c.disbursed_amount))}</b></div></div><div class="program-card-foot"><span class="program-status is-active"><i></i>${esc(c.status==='active'?'Đang triển khai':c.status==='completed'?'Đã hoàn thành':c.status)}</span><a href="/tai-tro/${encodeURIComponent(c.code)}">Xem đối soát & chứng từ <b>→</b></a></div></div></article>`).join('')}</div>
    `:`
      <div class="sfn-sp-empty-banner">
        <div class="sfn-sp-empty-icon">${svgIcon('heart',24)}</div>
        <div>
          <h3>${esc(t('sp_empty_title'))}</h3>
          <p>${esc(t('sp_empty_desc'))}</p>
        </div>
      </div>
    `}

    <div class="sfn-sp-numbered-cards">
      <article class="sfn-sp-num-card">
        <div class="sfn-sp-num-top">
          <span class="sfn-sp-icon">${svgIcon('document',22)}</span>
          <em>01</em>
        </div>
        <h3>${esc(t('sp_c1_title'))}</h3>
        <p>${esc(t('sp_c1_desc'))}</p>
      </article>
      <article class="sfn-sp-num-card">
        <div class="sfn-sp-num-top">
          <span class="sfn-sp-icon">${svgIcon('gear',22)}</span>
          <em>02</em>
        </div>
        <h3>${esc(t('sp_c2_title'))}</h3>
        <p>${esc(t('sp_c2_desc'))}</p>
      </article>
      <article class="sfn-sp-num-card">
        <div class="sfn-sp-num-top">
          <span class="sfn-sp-icon">${svgIcon('shield-check',22)}</span>
          <em>03</em>
        </div>
        <h3>${esc(t('sp_c3_title'))}</h3>
        <p>${esc(t('sp_c3_desc'))}</p>
      </article>
    </div>

    <div class="sfn-faq-list" style="margin-top:24px;">
      <details>
        <summary><span class="sfn-faq-qicon">?</span> <b>${esc(t('sp_faq_q1'))}</b></summary>
        <div class="sfn-faq-body"><p>${esc(t('sp_faq_a1'))}</p></div>
      </details>
      <details>
        <summary><span class="sfn-faq-qicon">?</span> <b>${esc(t('sp_faq_q2'))}</b></summary>
        <div class="sfn-faq-body"><p>${esc(t('sp_faq_a2'))}</p></div>
      </details>
    </div>
  </section>`;
  event('route_view',{category:'sponsorship'});
}

/*
 * Mục 7: Trang An toàn & Bảo mật số (/an-toan) bám sát ảnh tham chiếu image_2efde8.jpg
 */
async function safetyCenter(app){
  updateActiveNav('safety');
  const lang=getLang();
  setMeta(t('nav_safety'),t('safe_desc'));

  app.innerHTML=`
  <section class="sfn-ref-banner sfn-banner-safety">
    <div class="sfn-ref-banner-inner">
      <div class="sfn-ref-banner-copy">
        <span class="sfn-banner-pill">${esc(t('hero_badge'))}</span>
        <h1>${esc(t('safe_title_1'))} &amp; <em>${esc(t('safe_title_2'))}</em></h1>
        <p>${esc(t('safe_desc'))}</p>
      </div>
      ${bannerArt('safety')}
    </div>
  </section>

  <section class="dip-section tight">
    <div class="sfn-safety-top-cards">
      <article class="sfn-safety-card">
        <div class="sfn-safety-icon is-blue">${svgIcon('shield',22)}</div>
        <h3>${esc(t('safe_c1_title'))}</h3>
        <p>${esc(t('safe_c1_desc'))}</p>
      </article>
      <article class="sfn-safety-card">
        <div class="sfn-safety-icon is-amber">${svgIcon('warning',22)}</div>
        <h3>${esc(t('safe_c2_title'))}</h3>
        <p>${esc(t('safe_c2_desc'))}</p>
      </article>
      <article class="sfn-safety-card">
        <div class="sfn-safety-icon is-blue">${svgIcon('lock',22)}</div>
        <h3>${esc(t('safe_c3_title'))}</h3>
        <p>${esc(t('safe_c3_desc'))}</p>
      </article>
    </div>

    <div class="sfn-safety-bottom-grid" id="privacy">
      <div class="sfn-safety-guide-card">
        <div class="sfn-safety-panel-head">
          <span class="sfn-panel-icon">${svgIcon('book',20)}</span>
          <div>
            <span class="section-kicker">${esc(t('safe_em_kicker'))}</span>
            <h2>${esc(t('safe_em_title'))}</h2>
          </div>
        </div>
        <div class="sfn-emergency-steps">
          <div class="sfn-em-step">
            <span class="sfn-em-badge">01</span>
            <p>${esc(t('safe_em_1'))}</p>
          </div>
          <div class="sfn-em-step">
            <span class="sfn-em-badge">02</span>
            <p>${esc(t('safe_em_2'))}</p>
          </div>
          <div class="sfn-em-step">
            <span class="sfn-em-badge">03</span>
            <p>${esc(t('safe_em_3'))}</p>
          </div>
        </div>
        <div class="sfn-direct-contact-box">
          <div class="sfn-dc-icon">${svgIcon('headset',22)}</div>
          <div>
            <b>${esc(t('safe_contact_title'))}</b>
            <ul>
              <li>${esc(t('safe_contact_tech'))} <a href="mailto:support@skyfirst.io.vn">support@skyfirst.io.vn</a></li>
              <li>${esc(t('safe_contact_gen'))} <a href="mailto:lienhe@skyfirst.io.vn">lienhe@skyfirst.io.vn</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="sfn-safety-form-card">
        <div class="sfn-safety-panel-head">
          <span class="sfn-panel-icon">${svgIcon('document',20)}</span>
          <div>
            <span class="section-kicker">${esc(t('safe_form_kicker'))}</span>
            <h2>${esc(t('safe_form_title'))}</h2>
          </div>
        </div>
        <p class="small muted" style="margin:4px 0 14px;">${esc(t('safe_form_note'))}</p>
        <form id="safetyReportForm">
          <div class="row2">
            <div class="field">
              <label for="srCategory">${esc(t('safe_f_cat'))}</label>
              <select id="srCategory" required>
                <option value="Giả mạo / Lừa đảo">${esc(lang==='en'?'Impersonation / Phishing page':'Cảnh báo trang / tài khoản giả mạo')}</option>
                <option value="Truy cập trái phép">${esc(lang==='en'?'Suspected unauthorized access':'Nghi ngờ truy cập trái phép tài khoản')}</option>
                <option value="Lộ dữ liệu / Quyền riêng tư">${esc(lang==='en'?'Privacy / Personal data issue':'Vấn đề quyền riêng tư / dữ liệu cá nhân')}</option>
                <option value="Lỗi bảo mật kỹ thuật">${esc(lang==='en'?'Technical security vulnerability':'Báo cáo lỗ hổng / lỗi an toàn kỹ thuật')}</option>
                <option value="Khác">${esc(lang==='en'?'Other safety issue':'Vấn đề an toàn khác')}</option>
              </select>
            </div>
            <div class="field">
              <label for="srSeverity">${esc(t('safe_f_sev'))}</label>
              <select id="srSeverity" required>
                <option value="Trung bình">${esc(lang==='en'?'Medium':'Trung bình')}</option>
                <option value="Cao">${esc(lang==='en'?'High':'Cao')}</option>
                <option value="Khẩn cấp">${esc(lang==='en'?'Critical':'Khẩn cấp')}</option>
                <option value="Thấp">${esc(lang==='en'?'Low':'Thấp')}</option>
              </select>
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <label for="srName">${esc(t('safe_f_name'))}</label>
              <input id="srName" placeholder="${esc(t('safe_f_name_ph'))}">
            </div>
            <div class="field">
              <label for="srEmail">${esc(t('safe_f_email'))}</label>
              <input id="srEmail" type="email" placeholder="name@example.com">
            </div>
          </div>
          <div class="field">
            <label for="srTitle">${esc(t('safe_f_title'))}</label>
            <input id="srTitle" required minlength="5" maxlength="200" placeholder="${esc(t('safe_f_title_ph'))}">
          </div>
          <div class="field">
            <label for="srUrl">${esc(t('safe_f_url'))}</label>
            <input id="srUrl" maxlength="400" placeholder="${esc(t('safe_f_url_ph'))}">
          </div>
          <div class="field">
            <label for="srDesc">${esc(t('safe_f_desc'))}</label>
            <textarea id="srDesc" rows="4" required minlength="10" maxlength="4000" placeholder="${esc(t('safe_f_desc_ph'))}"></textarea>
          </div>
          <button type="submit" class="portal-button sfn-send-safety-btn" id="srSubmitBtn">${svgIcon('send',16)} <span>${esc(t('safe_f_btn'))} →</span></button>
        </form>
        <div id="srResult" aria-live="polite" style="margin-top:14px;"></div>
      </div>
    </div>
  </section>`;

  const form=document.getElementById('safetyReportForm'), out=document.getElementById('srResult'), btn=document.getElementById('srSubmitBtn');
  form.onsubmit=async e=>{
    e.preventDefault();
    btn.disabled=true;
    out.innerHTML='';
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
      out.innerHTML=`<div class="notice good"><b>${esc(lang==='en'?'Safety report recorded:':'Đã tiếp nhận báo cáo an toàn:')} ${esc(r.code)}</b><br>${esc(r.message)}</div>`;
    }catch(err){
      out.innerHTML=failCard(err.message);
    }finally{
      btn.disabled=false;
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
    return src?`<figure class="cms-block cms-block-image" style="${style}"><img src="${esc(src)}" alt="${esc(b.alt||b.caption||'Hình ảnh')}" loading="lazy" style="max-width:100%;border-radius:16px;">${b.caption?`<figcaption class="small muted">${esc(b.caption)}</figcaption>`:''}</figure>`:'';
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
    app.innerHTML=`<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><span class="sfn-banner-pill">${esc(page.category||'TRANG NỘI DUNG')}</span><h1>${esc(page.title)}</h1>${page.summary?`<p>${esc(page.summary)}</p>`:''}</div></div></section>
    <section class="dip-section tight"><div class="cms-rendered-page" style="display:grid;gap:20px;max-width:980px;margin:0 auto;">${(page.blocks||[]).map(renderVisualBlock).join('')}</div></section>`;
  }catch(err){
    app.innerHTML=lookupShell('KHÔNG TÌM THẤY TRANG','Trang nội dung này chưa được xuất bản hoặc đường dẫn không tồn tại.')+`<section class="dip-section tight"><a class="portal-button" href="/">Về Trang chủ →</a></section>`;
  }
}

/*
 * Mục 7: Các trang Chương trình (/chuong-trinh), Sự kiện (/su-kien - image_2e9431.jpg) và Tài liệu (/tai-lieu - image_2e94e3.jpg)
 */
async function programsPage(app,kind,detailId=''){
  const lang=getLang();
  if(kind==='units'){
    const d=await api('/api/public/units');const items=d.items||[];setMeta(lang==='en'?'Partners & Units':'Đơn vị & Đối tác','');
    app.innerHTML=`<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><span class="sfn-banner-pill">${esc(t('hero_badge'))}</span><h1>${esc(lang==='en'?'PARTNERS':'ĐƠN VỊ')} <em>&amp; ${esc(lang==='en'?'UNITS':'ĐỐI TÁC')}</em></h1><p>${esc(lang==='en'?'Official units and partners recorded on the Sky First Digital Information System.':'Danh sách đơn vị trực thuộc và đối tác đồng hành được ghi nhận chính thức trên hệ thống.')}</p></div></div></section><section class="catalog-section"><div class="ecosystem-detail-grid">${items.map(x=>`<article class="ecosystem-detail-card"><span>${esc(x.code||'SKY FIRST')}</span><h3>${esc(x.name)}</h3><p>${esc(x.unit_type||'')}</p><small>${esc(publicStatusLabel(x.status||'Đang hoạt động'))}</small></article>`).join('')||empty(lang==='en'?'No public units available.':'Chưa có đơn vị công khai.')}</div></section>`;
    return;
  }

  if(kind==='classes'){
    updateActiveNav('programs');
    const d=await api('/api/public/classes');
    const items=visiblePublicItems(d.items||[]).sort(comparePrograms);
    const selected=detailId?items.find(x=>String(x.id)===String(detailId)):null;
    if(detailId){
      if(!selected){
        app.innerHTML=`<section class="detail-missing"><span class="section-kicker">CHƯƠNG TRÌNH SKY FIRST</span><h1>${esc(lang==='en'?'Program Not Found':'Không tìm thấy chương trình')}</h1><p>${esc(lang==='en'?'This program may have been unpublished or moved.':'Chương trình này có thể đã được gỡ khỏi danh sách công khai hoặc đường dẫn không còn hợp lệ.')}</p><a class="portal-button" href="/chuong-trinh">← ${esc(lang==='en'?'Back to Programs':'Quay lại danh sách chương trình')}</a></section>`;
        return;
      }
      const data=jsonObject(selected.data_json),schedule=jsonObject(selected.schedule_json),summary=firstText(data,['description','summary','short_description','intro','content']);
      const detailRows=[selected.level?['Cấp độ',selected.level]:null,selected.status?['Trạng thái',publicStatusLabel(selected.status)]:null,firstText(schedule,['schedule','time','days','duration'])?['Lịch học',firstText(schedule,['schedule','time','days','duration'])]:null,firstText(schedule,['format','mode','modality'])?['Hình thức',firstText(schedule,['format','mode','modality'])]:null,firstText(data,['location','venue'])?['Địa điểm',firstText(data,['location','venue'])]:null,selected.capacity?['Sức chứa',String(selected.capacity)]:null].filter(Boolean);
      setMeta(selected.title,summary||'');
      app.innerHTML=`<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><a class="back-link" href="/chuong-trinh" style="color:#bae6fd;">← ${esc(lang==='en'?'All Programs':'Tất cả chương trình')}</a><span class="sfn-banner-pill">${esc(selected.unit_code||'SKY FIRST')}</span><h1>${esc(selected.title)}</h1><p>${esc(summary||'')}</p><div class="actions" style="margin-top:16px;"><a class="portal-button" href="#form/class">${esc(lang==='en'?'Register Now →':'Đăng ký tham gia →')}</a></div></div></div></section><section class="program-detail-content"><div class="program-detail-main"><span class="section-kicker">THÔNG TIN CHƯƠNG TRÌNH</span><h2>${esc(selected.title)}</h2><p>${esc(summary||'Hãy liên hệ Hệ thống Thông tin Số Sky First để được hướng dẫn thêm về chương trình này.')}</p></div><aside class="program-detail-facts"><h3>Thông tin tổng quan</h3>${detailRows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</aside></section>`;
      return;
    }
    setMeta(t('nav_programs'),t('card_prog_desc'));
    app.innerHTML=`
    <section class="sfn-ref-banner sfn-banner-programs">
      <div class="sfn-ref-banner-inner">
        <div class="sfn-ref-banner-copy">
          <span class="sfn-banner-pill">${esc(t('hero_badge'))}</span>
          <h1>${esc(lang==='en'?'EDUCATIONAL':'CHƯƠNG TRÌNH')} &amp; <em>${esc(lang==='en'?'COMMUNITY PROGRAMS':'CỘNG ĐỒNG')}</em></h1>
          <p>${esc(lang==='en'?'Explore training courses, skill classes, and community development activities backed by live system data.':'Khám phá các chương trình đào tạo, lớp học kỹ năng và hoạt động phát triển cộng đồng theo dữ liệu thực tế.')}</p>
          <div class="sfn-banner-search-box">
            <span class="sfn-search-icon">${svgIcon('search',18)}</span>
            <input id="programSearch" type="search" placeholder="${esc(lang==='en'?'Search programs, levels, units...':'Tìm chương trình, cấp độ, đơn vị...')}">
            <button type="button" id="programSearchBtn">${esc(t('search_btn'))} <span>→</span></button>
          </div>
          <div class="sfn-banner-filter-pills" role="group">
            <button class="is-active" type="button" data-program-filter="all">${svgIcon('grid',14)} <span>${esc(t('ev_filter_all'))}</span></button>
            <button type="button" data-program-filter="education">${svgIcon('book',14)} <span>${esc(lang==='en'?'Education':'Đào tạo')}</span></button>
            <button type="button" data-program-filter="community">${svgIcon('handshake',14)} <span>${esc(lang==='en'?'Community':'Cộng đồng')}</span></button>
          </div>
        </div>
        ${bannerArt('resources')}
      </div>
    </section>
    <section class="catalog-section">
      <div class="catalog-section-head">
        <div>
          <span class="section-kicker">${esc(lang==='en'?'PROGRAM CATALOG':'DANH MỤC CHƯƠNG TRÌNH')}</span>
          <h2>${esc(lang==='en'?'Active Public Programs':'Chương trình đang triển khai')}</h2>
          <p>${esc(lang==='en'?'Select a program to view schedule details and registration forms.':'Chọn từng chương trình để xem chi tiết lịch trình, trạng thái mở đăng ký và biểu mẫu liên quan.')}</p>
        </div>
        <span class="catalog-live-note"><i></i>${esc(t('live_data'))}</span>
      </div>
      <div class="program-catalog-grid" id="programCatalogGrid">
        ${items.length?items.map((x,i)=>programCard(x,i,'catalog')).join(''):`
          <div class="sfn-clean-empty-card" style="grid-column:1/-1;">
            ${emptyIllustrationSvg()}
            <h3>${esc(lang==='en'?'No Public Programs Available':'Chưa có chương trình công khai')}</h3>
            <p>${esc(lang==='en'?'New programs will appear here as soon as they are published from the administration portal.':'Chương trình sẽ xuất hiện tại đây khi được cập nhật và công bố từ hệ thống quản trị.')}</p>
          </div>
        `}
      </div>
      <p class="catalog-no-results" id="programNoResults" hidden>${esc(lang==='en'?'No matching programs found.':'Không tìm thấy chương trình phù hợp với từ khóa này.')}</p>
    </section>`;
    const search=document.getElementById('programSearch'),grid=document.getElementById('programCatalogGrid'),noResults=document.getElementById('programNoResults');let activeFilter='all';
    const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.program-card').forEach(card=>{const text=(card.dataset.search||card.textContent||'').toLocaleLowerCase('vi');const category=card.dataset.category||'education';const matchText=!q||text.includes(q);const matchCat=activeFilter==='all'||(activeFilter==='education'?category==='education':category==='community');card.hidden=!(matchText&&matchCat);if(!card.hidden)count++});if(noResults)noResults.hidden=count>0||!items.length};
    grid?.querySelectorAll('.program-card').forEach((card,i)=>{const x=items[i];if(!x)return;card.dataset.search=[x.title,x.level,x.unit_code,x.status,jsonObject(x.data_json).description].join(' ');card.dataset.category=/sfec|education|đào tạo|tiếng anh|reading|listening|speaking|lớp/i.test([x.unit_code,x.title].join(' '))?'education':'community'});
    search?.addEventListener('input',apply);document.getElementById('programSearchBtn')?.addEventListener('click',apply);document.querySelectorAll('[data-program-filter]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.programFilter;document.querySelectorAll('[data-program-filter]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));
    return;
  }

  /*
   * Mục 7: Trang Sự kiện & Hoạt động (/su-kien) bám sát ảnh tham chiếu image_2e9431.jpg
   */
  if(kind==='events'){
    updateActiveNav('events');
    const d=await api('/api/public/events'),items=visiblePublicItems(d.items||[]);
    const selected=detailId?items.find(x=>String(x.id)===String(detailId)):null;
    if(detailId){
      if(!selected){
        app.innerHTML=`<section class="detail-missing"><span class="section-kicker">HOẠT ĐỘNG & SỰ KIỆN</span><h1>${esc(lang==='en'?'Event Not Found':'Không tìm thấy sự kiện')}</h1><a class="portal-button" href="/su-kien">← ${esc(lang==='en'?'Back to Events':'Quay lại danh sách sự kiện')}</a></section>`;
        return;
      }
      const data=jsonObject(selected.data_json),summary=firstText(data,['summary','description','short_description','intro','content']);
      setMeta(selected.title,summary||'');
      app.innerHTML=`<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><a class="back-link" href="/su-kien" style="color:#bae6fd;">← ${esc(lang==='en'?'All Events':'Tất cả sự kiện')}</a><span class="sfn-banner-pill">${esc(selected.unit_code||'SKY FIRST')}</span><h1>${esc(selected.title)}</h1><p>${esc(summary||'')}</p><div class="actions" style="margin-top:16px;"><a class="portal-button" href="#form/event">${esc(lang==='en'?'Register Now →':'Đăng ký tham gia →')}</a></div></div>${bannerArt('events')}</div></section>`;
      return;
    }
    setMeta(t('nav_events'),t('ev_hero_desc'));
    app.innerHTML=`
    <section class="sfn-ref-banner sfn-banner-events">
      <div class="sfn-ref-banner-inner">
        <div class="sfn-ref-banner-copy">
          <span class="sfn-banner-pill">${esc(t('hero_badge'))}</span>
          <h1>${esc(t('ev_hero_title_1'))} &amp;<br><em>${esc(t('ev_hero_title_2'))}</em></h1>
          <p>${esc(t('ev_hero_desc'))}</p>
          <div class="sfn-banner-search-box">
            <span class="sfn-search-icon">${svgIcon('search',18)}</span>
            <input id="eventSearch" type="search" placeholder="${esc(t('ev_search_ph'))}" aria-label="${esc(t('ev_search_ph'))}">
            <button type="button" id="eventSearchBtn">${esc(t('search_btn'))} <span>→</span></button>
          </div>
          <div class="sfn-banner-filter-pills" role="group" aria-label="Lọc sự kiện">
            <button class="is-active" type="button" data-event-filter="all">${svgIcon('grid',14)} <span>${esc(t('ev_filter_all'))}</span></button>
            <button type="button" data-event-filter="upcoming">${svgIcon('calendar',14)} <span>${esc(t('ev_filter_upcoming'))}</span></button>
            <button type="button" data-event-filter="ongoing"><i class="dot-green"></i> <span>${esc(t('ev_filter_ongoing'))}</span></button>
            <button type="button" data-event-filter="past"><i class="dot-slate"></i> <span>${esc(t('ev_filter_past'))}</span></button>
          </div>
        </div>
        ${bannerArt('events')}
      </div>
    </section>

    <section class="event-catalog-section">
      <div class="catalog-section-head">
        <div>
          <span class="section-kicker">${esc(t('ev_sec_kicker'))}</span>
          <h2>${esc(t('ev_sec_title'))}</h2>
          <p>${esc(t('ev_sec_desc'))}</p>
        </div>
        <span class="catalog-live-note"><i></i>${esc(t('live_data'))}</span>
      </div>
      <div id="eventCatalogGrid" class="event-catalog-grid">
        ${items.length?items.map(x=>{
          const data=jsonObject(x.data_json),status=publicStatusLabel(x.status);
          return `<a class="event-card" data-status="${esc(eventType(x))}" data-search="${esc([x.title,x.unit_code,status,firstText(data,['description','summary'])].join(' '))}" href="${esc(eventHref(x))}"><div class="event-card-body"><span class="program-unit">${esc(x.unit_code||'SKY FIRST')}</span><h3>${esc(x.title)}</h3><span class="program-status ${activeLike(x.status)?'is-active':''}"><i></i>${esc(status)}</span><span class="event-card-link">${esc(lang==='en'?'View details':'Xem chi tiết')} <b>→</b></span></div></a>`;
        }).join(''):`
          <div class="sfn-clean-empty-card" style="grid-column:1/-1;">
            ${emptyIllustrationSvg()}
            <h2>${esc(t('ev_empty_title'))}</h2>
            <p>${esc(t('ev_empty_desc'))}</p>
            <a class="sfn-empty-cta-btn" href="/chuong-trinh">${esc(t('ev_empty_cta'))} <span>→</span></a>
          </div>
        `}
      </div>
      <p class="catalog-no-results" id="eventNoResults" hidden>${esc(lang==='en'?'No matching events found.':'Không có sự kiện phù hợp với bộ lọc hiện tại.')}</p>
    </section>`;
    const search=document.getElementById('eventSearch'),grid=document.getElementById('eventCatalogGrid'),noResults=document.getElementById('eventNoResults');let filter='all';
    const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;grid?.querySelectorAll('.event-card').forEach(card=>{const yes=(!q||(card.dataset.search||'').toLocaleLowerCase('vi').includes(q))&&(filter==='all'||card.dataset.status===filter);card.hidden=!yes;if(yes)count++});if(noResults)noResults.hidden=count>0||!items.length};
    search?.addEventListener('input',apply);document.getElementById('eventSearchBtn')?.addEventListener('click',apply);
    document.querySelectorAll('[data-event-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.eventFilter;document.querySelectorAll('[data-event-filter]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));
    return;
  }

  if(kind==='news'){
    const d=await api('/api/public/news'),items=d.items||[];
    const selected=detailId?items.find(x=>String(x.slug||x.id)===String(detailId)||String(x.id)===String(detailId)):null;
    if(detailId && selected){
      setMeta(selected.title,'');
      app.innerHTML=`<article class="news-detail-page"><div class="news-detail-head"><a class="back-link" href="#news">← ${esc(lang==='en'?'All News':'Tất cả tin tức')}</a><span class="hero-eyebrow">TIN TỨC & THÔNG BÁO</span><h1>${esc(selected.title)}</h1></div><div class="news-detail-body">${esc(String(selected.body||'').replace(/<[^>]*>/g,' ').trim()).replace(/\n/g,'<br>')}</div></article>`;
      return;
    }
    setMeta(lang==='en'?'News & Announcements':'Tin tức & Thông báo','');
    app.innerHTML=`<section class="sfn-ref-banner"><div class="sfn-ref-banner-inner"><div class="sfn-ref-banner-copy"><span class="sfn-banner-pill">TIN TỨC & THÔNG BÁO</span><h1>THÔNG BÁO <em>HỆ THỐNG</em></h1></div></div></section><section class="catalog-section"><div class="news-catalog-grid">${items.length?items.map(x=>`<a class="news-catalog-card" href="${esc(storyHref(x))}"><div class="news-catalog-copy"><small>${esc(x.published_at?fmt(x.published_at):'')}</small><h3>${esc(x.title)}</h3><p>${esc(String(x.body||'').replace(/<[^>]*>/g,' ').slice(0,200))}</p></div></a>`).join(''):empty('Chưa có tin tức công khai.')}</div></section>`;
    return;
  }

  /*
   * Mục 7: Trang Tài liệu & Hướng dẫn (/tai-lieu) bám sát ảnh tham chiếu image_2e94e3.jpg
   */
  if(kind==='resources'){
    updateActiveNav('resources');
    const d=await api('/api/public/resources'),items=d.items||[];
    setMeta(t('nav_docs'),t('doc_desc'));
    const categories=[...new Set(items.map(x=>x.category||x.doc_type||'Tài liệu'))];
    const previewDocId=new URLSearchParams(location.search).get('preview')||detailId||'';
    const previewDoc=previewDocId?items.find(x=>String(x.id)===String(previewDocId)||String(x.code)===String(previewDocId)):null;

    app.innerHTML=`
    <section class="sfn-ref-banner sfn-banner-docs">
      <div class="sfn-ref-banner-inner">
        <div class="sfn-ref-banner-copy">
          <span class="sfn-banner-pill">${esc(t('doc_badge'))}</span>
          <h1>${esc(t('doc_title_1'))} &amp;<br><em>${esc(t('doc_title_2'))}</em></h1>
          <p>${esc(t('doc_desc'))}</p>
          <div class="sfn-banner-search-box">
            <span class="sfn-search-icon">${svgIcon('search',18)}</span>
            <input id="docSearch" type="search" placeholder="${esc(t('doc_search_ph'))}" aria-label="${esc(t('doc_search_ph'))}">
            <button type="button" id="docSearchBtn">${esc(t('search_btn'))} <span>→</span></button>
          </div>
          <div class="sfn-banner-filter-pills" id="docCategoryFilters">
            <button class="is-active" type="button" data-doc-cat="all">${svgIcon('folder',14)} <span>${esc(t('doc_filter_all'))}</span></button>
            ${categories.map(c=>`<button type="button" data-doc-cat="${esc(c)}">${svgIcon('document',14)} <span>${esc(c)}</span></button>`).join('')}
          </div>
        </div>
        ${bannerArt('resources')}
      </div>
    </section>

    <section class="catalog-section utility-catalog">
      ${previewDoc&&previewDoc.preview_url?`<div class="card pdf-preview-panel" style="margin-bottom:28px;"><div class="toolbar"><div style="margin-right:auto"><span class="pill">${esc(previewDoc.code)} · v${esc(previewDoc.current_version||1)}</span><h2 style="margin:6px 0 0">${esc(previewDoc.title)}</h2></div>${previewDoc.download_url?`<a class="portal-button" href="${esc(previewDoc.download_url)}">${esc(lang==='en'?'Download PDF →':'Tải xuống PDF →')}</a>`:''}<a class="secondary" href="/tai-lieu">${esc(lang==='en'?'Close Preview':'Đóng xem trước')}</a></div><iframe src="${esc(previewDoc.preview_url)}" title="${esc(previewDoc.title)}" style="width:100%;height:620px;border:1px solid var(--dip-line);border-radius:14px;margin-top:14px;"></iframe></div>`:''}
      <div class="catalog-section-head">
        <div>
          <span class="section-kicker">${esc(t('doc_sec_kicker'))}</span>
          <h2>${esc(t('doc_sec_title'))}</h2>
          <p>${esc(t('doc_sec_desc'))}</p>
        </div>
      </div>
      ${items.length?`
        <div class="resource-list utility-resource-list" id="docCatalogList">
          ${items.map(x=>`<article class="doc-item-row" data-cat="${esc(x.category||x.doc_type||'Tài liệu')}" data-search="${esc([x.title,x.code,x.doc_type,x.category,x.description,x.keywords].join(' '))}"><i>${svgIcon('folder',20)}</i><div><span>${esc(x.code)} · ${esc(x.category||x.doc_type||'TÀI LIỆU')} · v${esc(x.current_version||1)}</span><h3>${esc(x.title)}</h3>${x.description?`<p class="small muted">${esc(x.description)}</p>`:''}<small>${esc(x.issued_at?fmt(x.issued_at):fmt(x.updated_at))}</small></div><div class="actions">${x.preview_url?`<a class="secondary" href="/tai-lieu?preview=${encodeURIComponent(x.id)}">${esc(lang==='en'?'Preview PDF':'Xem trước PDF')}</a>`:''}${x.download_url?`<a class="portal-button" href="${esc(x.download_url)}">${esc(lang==='en'?'Download →':'Tải xuống →')}</a>`:`<span class="small muted">${esc(lang==='en'?'Online view only':'Chỉ xem trực tuyến')}</span>`}</div></article>`).join('')}
        </div>
        <p class="catalog-no-results" id="docNoResults" hidden>${esc(lang==='en'?'No matching documents found.':'Không tìm thấy tài liệu phù hợp với điều kiện lọc.')}</p>
      `:`
        <div class="sfn-clean-empty-card">
          ${emptyIllustrationSvg()}
          <h2>${esc(t('doc_empty_title'))}</h2>
          <p>${esc(t('doc_empty_desc'))}</p>
        </div>
      `}
    </section>`;
    const search=document.getElementById('docSearch'),list=document.getElementById('docCatalogList'),noRes=document.getElementById('docNoResults');let activeCat='all';
    const apply=()=>{const q=(search?.value||'').trim().toLocaleLowerCase('vi');let count=0;list?.querySelectorAll('.doc-item-row').forEach(row=>{const yes=(!q||(row.dataset.search||'').toLocaleLowerCase('vi').includes(q))&&(activeCat==='all'||row.dataset.cat===activeCat);row.hidden=!yes;if(yes)count++});if(noRes)noRes.hidden=count>0||!items.length};
    search?.addEventListener('input',apply);document.getElementById('docSearchBtn')?.addEventListener('click',apply);
    document.querySelectorAll('[data-doc-cat]').forEach(btn=>btn.addEventListener('click',()=>{activeCat=btn.dataset.docCat;document.querySelectorAll('[data-doc-cat]').forEach(b=>b.classList.toggle('is-active',b===btn));apply()}));
    return;
  }
}

function eventType(item={}){
  const s=String(item.status||'').toLowerCase();
  if(/đã kết thúc|hoàn thành|kết thúc|completed|ended|past/.test(s))return 'past';
  if(/đang diễn ra|đang tổ chức|ongoing|live/.test(s))return 'ongoing';
  const now=Date.now(),start=Date.parse(item.start_at||''),end=Date.parse(item.end_at||'');
  if(Number.isFinite(end)&&end>0&&end<now)return 'past';
  if(Number.isFinite(start)&&start>0&&start<=now&&(!Number.isFinite(end)||!end||end>=now))return 'ongoing';
  return 'upcoming';
}

const searchState={items:[],filter:'all',index:-1,timer:null,query:''};
let searchReturnFocus=null;
function openSearch(seed=''){const el=document.getElementById('searchCenter');if(!el)return;searchReturnFocus=document.activeElement;el.hidden=false;el.setAttribute('aria-hidden','false');document.body.classList.add('searching');const input=document.getElementById('globalSearch');input.value=seed||'';input.focus();renderRecent();if(input.value.trim().length>=2)doSearch(input.value)}
function closeSearch(){const el=document.getElementById('searchCenter');if(!el)return;el.hidden=true;el.setAttribute('aria-hidden','true');document.body.classList.remove('searching');searchReturnFocus?.focus?.();searchReturnFocus=null}
function recent(){try{return JSON.parse(localStorage.getItem('sfn_recent_searches')||'[]')}catch{return[]}}
function saveRecent(q){const a=[q,...recent().filter(x=>x!==q)].slice(0,6);localStorage.setItem('sfn_recent_searches',JSON.stringify(a))}
function renderRecent(){const el=document.getElementById('recentSearches'),a=recent(),suggestions=['Chương trình','Sự kiện','Tài liệu','Biểu mẫu','Chứng nhận','Tài trợ','An toàn'];if(!el)return;el.innerHTML=`${a.length?`<span>${esc(getLang()==='en'?'Recent searches':'Tìm gần đây')}</span><div>${a.map(q=>`<button type="button" data-recent="${esc(q)}">${esc(q)}</button>`).join('')}</div>`:''}<span>${esc(getLang()==='en'?'Suggested topics':'Gợi ý tra cứu')}</span><div>${suggestions.map(q=>`<button type="button" data-recent="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;el.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{const q=b.dataset.recent;document.getElementById('globalSearch').value=q;doSearch(q)})}
function resultHref(x){if(x.type==='credential')return `/gcn/${encodeURIComponent(x.ref)}`;if(x.type==='form')return `/#form/${encodeURIComponent(x.ref)}`;if(x.type==='event')return `/su-kien/${encodeURIComponent(x.ref)}`;if(x.type==='program')return `/chuong-trinh/${encodeURIComponent(x.ref)}`;if(x.type==='unit')return '/#units';if(x.type==='resource')return `/tai-lieu?preview=${encodeURIComponent(x.ref)}`;if(x.type==='sponsorship')return `/tai-tro/${encodeURIComponent(x.ref)}`;if(x.type==='cms_page')return `/trang/${encodeURIComponent(x.ref)}`;if(x.type==='news')return `/#news/${encodeURIComponent(x.ref)}`;if(x.type==='page')return x.ref||'/';return '/'}
function highlight(value){const text=String(value??''),q=searchState.query.trim();if(!q)return esc(text);const parts=text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig'));return parts.map(p=>p.toLowerCase()===q.toLowerCase()?`<mark>${esc(p)}</mark>`:esc(p)).join('')}
const SEARCH_TYPE_LABELS={all:'Tất cả',page:'Chức năng',program:'Chương trình',event:'Sự kiện',resource:'Tài liệu',form:'Biểu mẫu',credential:'Chứng nhận',sponsorship:'Tài trợ',cms_page:'Trang thông tin',news:'Thông báo',unit:'Đơn vị'};
function renderSearch(){const out=document.getElementById('globalResults'),filters=document.getElementById('searchFilters');if(!out||!filters)return;const cats=[...new Set(searchState.items.map(x=>x.type))];filters.innerHTML=searchState.items.length?['all',...cats].map(c=>`<button type="button" class="${searchState.filter===c?'active':''}" data-filter="${c}">${esc(SEARCH_TYPE_LABELS[c]||c)}</button>`).join(''):'';filters.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{searchState.filter=b.dataset.filter;searchState.index=-1;renderSearch()});const items=searchState.items.filter(x=>searchState.filter==='all'||x.type===searchState.filter);out.innerHTML=items.length?`<div class="search-count">${items.length} ${esc(getLang()==='en'?'matching results':'kết quả phù hợp')}</div>${items.map((x,i)=>`<a class="search-result ${i===searchState.index?'active':''}" data-result-index="${i}" href="${resultHref(x)}"><i>${icon(x.type)}</i><span><small>${esc(SEARCH_TYPE_LABELS[x.type]||x.type)}</small><b>${highlight(x.title)}</b><em>${highlight(x.description||'')}</em></span><strong>→</strong></a>`).join('')}`:`<div class="search-zero"><i>${svgIcon('search',28)}</i><h3>${esc(getLang()==='en'?'No matching results found':'Không tìm thấy kết quả phù hợp')}</h3><p>${esc(getLang()==='en'?'Try a shorter keyword, program title, event, document, or exact certificate code.':'Hãy thử từ khóa ngắn hơn, tên chương trình, sự kiện, tài liệu hoặc mã chứng nhận chính xác.')}</p></div>`}
async function doSearch(q){q=String(q||'').trim();searchState.query=q;if(q.length<2){searchState.items=[];renderSearch();return}const out=document.getElementById('globalResults');if(out)out.innerHTML=`<div class="loading">${esc(getLang()==='en'?'Searching Sky First Digital Information System…':'Đang tìm kiếm trên Hệ thống Thông tin Số Sky First…')}</div>`;try{const d=await api(`/api/public/search?q=${encodeURIComponent(q)}`);searchState.items=d.items||[];searchState.filter='all';searchState.index=-1;saveRecent(q);renderRecent();renderSearch();event(searchState.items.length?'search_success':'search_zero_result',{category:'search',count:searchState.items.length})}catch(e){if(out)out.innerHTML=failCard(e.message)}}

function initShell(){
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
  api('/api/config').then(cfg=>syncDynamicNavigation(cfg)).catch(()=>{});
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

window.SkyFirstDigital={canRender,render,openSearch,applyLanguage,svgIcon};
initShell();
