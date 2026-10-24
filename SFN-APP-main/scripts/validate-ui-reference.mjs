import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const index = read('public/index.html');
const portal = read('public/digital-portal.js');
const app = read('public/app.js');
const css = read('public/digital.css');
const boot = read('public/bootstrap.js');
const sw = read('public/sw.js');
let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; }
}

// Reference-to-source map: the two document screenshots are the same visual state,
// so both intentionally map to the same route and reusable component.
const refs = [
  ['01 · Sự kiện', portal.includes("programsPage(app,'events'") && portal.includes('eventSearch') && portal.includes('eventNoResults')],
  ['02 · Đăng nhập quản trị', app.includes('function renderLogin()') && app.includes('id="loginForm"') && app.includes('/api/auth/login')],
  ['03 · Footer', index.includes('class="dip-footer"') && index.includes('class="dip-footer-legal"') && index.includes('class="admin-entry-link"')],
  ['04 · Trang chủ', portal.includes('async function home(app)') && portal.includes('sfn-feature-cards-grid') && portal.includes('home-stats-5')],
  ['05 · Tài liệu', portal.includes("programsPage(app,'resources'") && portal.includes('docSearch')],
  ['06 · Tài liệu (ảnh trùng/biến thể cùng trạng thái)', portal.includes("programsPage(app,'resources'") && portal.includes('docSearch')],
  ['07 · Tra cứu hồ sơ', portal.includes('async function caseCenter(app)') && portal.includes('id=\"caseForm\"') && portal.includes('/api/lookup/submission')],
  ['08 · Công khai tài trợ', portal.includes('async function sponsorshipCenter') && portal.includes('sponsorship_campaigns') === false && portal.includes('Chưa có dữ liệu tài trợ công khai')],
  ['09 · An toàn & bảo mật', portal.includes('async function safetyCenter(app)') && portal.includes('Báo cáo sự cố') && portal.includes('safetyReportForm')],
  ['10 · Biểu mẫu điện tử', portal.includes('async function formCenter(app)') && portal.includes('Mở biểu mẫu') && portal.includes('app.skyfirst.io.vn')]
];
for (const [label, ok] of refs) check(ok, `Ảnh ${label}: đã ánh xạ tới mã nguồn`);

check(['fcard-blue','fcard-purple','fcard-teal','fcard-amber','fcard-navy','fcard-green'].every(c => portal.includes(c)), 'Trang chủ có đủ 6 thẻ chức năng theo màu riêng');
check(['programs','members','certificates','partners','sponsorship'].every(k => portal.includes(`data-stat="${k}"`)), 'Trang chủ có đủ 5 chỉ số lấy từ API');
const homeStart = portal.indexOf('async function home(app){');
const homeEnd = portal.indexOf('\nasync function aboutCenter', homeStart);
const homeSource = portal.slice(homeStart, homeEnd);
const homeTemplate = homeSource.slice(homeSource.indexOf('app.innerHTML=`'), homeSource.indexOf('`;\n\n  const statConfig'));
check(homeStart >= 0 && homeEnd > homeStart && !['home-operational-grid','home-lower-grid','home-programs-panel','home-events-panel','home-resources-panel','home-news-panel','home-about-panel','renderSystemPageCmsZone('/')'].some(s => homeSource.includes(s)), 'Trang chủ không còn các khối giao diện đã yêu cầu gỡ');
check(homeTemplate.length > 0 && !/\bD1\b|\bR2\b|Cổng dịch vụ công và dữ liệu xác thực trực tuyến|Mọi số liệu thống kê, danh mục chương trình/i.test(homeTemplate), 'Trang chủ không hiển thị nhãn hạ tầng hoặc callout kỹ thuật đã yêu cầu xóa');
check((homeSource.match(/api\('/g) || []).length === 1 && homeSource.includes("api('/api/config')"), 'Trang chủ chỉ tải API cấu hình cần cho phần giao diện còn giữ lại');
check(!/id="accountBtn"|header-login-btn/.test(index) && /href="\/admin\/login"/.test(index), 'Không có nút Đăng nhập trên header; có liên kết quản trị nhỏ tại footer');
check(/@media\s*\(max-width:\s*1180px\)/.test(css) && /@media\s*\(max-width:\s*760px\)/.test(css) && /@media\s*\(max-width:\s*420px\)/.test(css), 'CSS có breakpoint desktop/tablet/mobile');
check(boot.includes('/app.js?v=20261024-home-clean-v1') && boot.includes('/sw.js?v=20261024-home-clean-v1') && sw.includes('20261024-home-clean-v1') && index.includes('20261024-home-clean-v1'), 'Cache version của giao diện và service worker đồng bộ');
check(/normalizeBrandString/.test(portal) && portal.includes('text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi,protect);') && portal.includes('text.replace(/(?:[a-z0-9-]+\\.)*skyfirst\\.io\\.vn/gi,protect);') && /Sky First/.test(index), 'Có cơ chế chuẩn hóa thương hiệu, giữ nguyên email/miền kỹ thuật');

// Prevent accidental screenshot embedding: no reference screenshot names, data-URI full-page
// images, or CSS background pointing to provided screenshot names in app UI sources.
const uiFiles = ['public/index.html','public/digital-portal.js','public/app.js','public/styles.css','public/digital.css'];
const uiText = uiFiles.map(read).join('\n');
check(!/(?:Screenshot\s*2026|image\(\d+\)\.png|download\(\d*\)\.png|data:image\/(?:png|jpeg);base64,)/i.test(uiText), 'Không nhúng ảnh chụp giao diện vào HTML/CSS/JS');

console.log(`\nUI reference source validation: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
