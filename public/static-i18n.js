const dict={
  "Không tìm thấy — Sky First":"Not Found — Sky First",
  "Không tìm thấy nội dung bạn yêu cầu.":"The requested content could not be found.",
  "Về Trang chủ":"Back to Home",
  "Lỗi hệ thống — Sky First":"System Error — Sky First",
  "Hệ thống tạm thời gặp lỗi":"The system is temporarily unavailable",
  "Vui lòng thử lại sau hoặc gửi yêu cầu hỗ trợ tại cổng SFN.":"Please try again later or contact SFN support.",
  "Thử lại":"Try again",
  "Sky First — Bảo trì":"Sky First — Maintenance",
  "Sky First đang bảo trì":"Sky First is under maintenance",
  "Hệ thống đang được bảo trì để bảo đảm hoạt động ổn định. Vui lòng quay lại sau.":"The system is being maintained to ensure reliable operation. Please return later.",
  "Đăng nhập Quản trị viên":"Administrator Sign In"
};
let lang=localStorage.getItem('sfn_lang')==='en'?'en':'vi';
function apply(){
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-vi]').forEach(el=>{el.textContent=lang==='en'?(el.dataset.en||el.dataset.vi):el.dataset.vi});
  document.title=lang==='en'?(dict[document.body.dataset.titleVi]||document.body.dataset.titleVi):document.body.dataset.titleVi;
  const b=document.getElementById('pageLangBtn');if(b)b.textContent=lang==='vi'?'EN':'VI';
}
document.getElementById('pageLangBtn')?.addEventListener('click',()=>{lang=lang==='vi'?'en':'vi';localStorage.setItem('sfn_lang',lang);apply()});
apply();
