
(() => {
  const DICT = new Map([
    ["Đăng nhập","Sign in"],["Đăng nhập hệ thống","System sign in"],["Đăng ký tham gia","Join / Register"],
    ["Truy cập nhanh","Quick access"],["Tin mới","Latest news"],["Chưa có tin.","No news yet."],["Mở","Open"],
    ["Đăng ký & Biểu mẫu","Registration & Forms"],["Lớp học & Chương trình giáo dục","Classes & Education Programs"],
    ["Hoạt động & Sự kiện","Activities & Events"],["Đơn vị trực thuộc","Affiliated Units"],["Tin tức & Cập nhật","News & Updates"],
    ["Tra cứu & Xác thực","Lookup & Verification"],["Đăng nhập Sky First","Sky First Sign In"],
    ["Bạn là Học sinh/Học viên?","Are you a Student/Learner?"],["Bạn là Thành viên?","Are you a Member?"],
    ["Bạn là Quản trị viên?","Are you an Administrator?"],["Học sinh/Học viên","Student/Learner"],["Thành viên","Member"],
    ["Quản trị viên","Administrator"],["Tiếp tục với Google","Continue with Google"],["Tạo tài khoản","Create account"],
    ["Đăng xuất","Sign out"],["Trang chủ","Home"],["Tìm kiếm","Search"],["Lưu","Save"],["Sửa","Edit"],["Xóa","Delete"],
    ["Thêm","Add"],["Đóng","Close"],["Hủy","Cancel"],["Thông tin","Information"],["Họ và tên","Full name"],
    ["Mô tả","Description"],["Lớp học","Classes"],["Nhiệm vụ","Tasks"],["Điểm danh","Attendance"],["Có mặt","Present"],
    ["Có phép","Excused"],["Vắng","Absent"],["Hỗ trợ & Ticket","Support & Tickets"],["Mã","Code"],["Loại","Type"],
    ["Ưu tiên","Priority"],["Cài đặt","Settings"],["Tổng quan","Dashboard"],["Tài khoản & Phân quyền","Accounts & Permissions"],
    ["Hồ sơ nhân sự","Personnel records"],["Hồ sơ đăng ký","Applications"],["Tin tức & CMS","News & CMS"],["Email","Email"],
    ["Sao lưu & Phục hồi","Backup & Restore"],["Audit Log","Audit Log"],["File & Minh chứng","Files & Evidence"],
    ["GCN & GXN","Certificates"],["Kho văn bản","Document repository"]
  ]);

  let lang = localStorage.getItem("sfn_lang")==="en" ? "en" : "vi";
  const original = new WeakMap();

  function exactTranslate(text){
    if(!text) return text;
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2];
    return m[1] + (DICT.get(core) || core) + m[3];
  }

  function translateNode(root=document.body){
    document.documentElement.lang = lang;
    root.querySelectorAll?.("[data-vi][data-en]").forEach(el=>{
      el.textContent = lang==="en" ? el.dataset.en : el.dataset.vi;
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const p=node.parentElement;
        if(!p || ["SCRIPT","STYLE","TEXTAREA"].includes(p.tagName) || p.closest("[data-vi][data-en]")) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const n of nodes){
      if(!original.has(n)) original.set(n,n.nodeValue);
      n.nodeValue = lang==="en" ? exactTranslate(original.get(n)) : original.get(n);
    }

    const btn=document.getElementById("langBtn");
    if(btn) btn.textContent = lang==="vi" ? "EN" : "VI";
  }

  document.getElementById("langBtn")?.addEventListener("click",()=>{
    lang = lang==="vi" ? "en" : "vi";
    localStorage.setItem("sfn_lang",lang);
    translateNode(document.body);
  });

  const menu=document.getElementById("mainNav");
  const toggle=document.getElementById("menuToggle");
  toggle?.addEventListener("click",()=>{
    const open=menu?.classList.toggle("open");
    toggle.setAttribute("aria-expanded",String(!!open));
  });
  document.querySelectorAll(".nav-trigger").forEach(btn=>{
    btn.addEventListener("click",e=>{
      if(window.innerWidth<=900){
        e.preventDefault();
        btn.parentElement.classList.toggle("open");
      }
    });
  });
  document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>{
    if(window.innerWidth<=900) menu?.classList.remove("open");
  }));

  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false; translateNode(document.body);});
  });
  observer.observe(document.getElementById("app") || document.body,{childList:true,subtree:true});

  translateNode(document.body);
})();
