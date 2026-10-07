# DEFINITION OF DONE — CỔNG THÔNG TIN SỐ SKY FIRST

Không đánh dấu Production PASS cho tới khi các nhóm dưới đây được test trên staging có D1/R2 thật.

## CONTENT PASS
- [ ] Home không phải dashboard; có Discovery, Tin mới, Chương trình, Hoạt động, Sự kiện/Cơ hội/Tài nguyên/Cổng số/Hệ sinh thái/Kết nối.
- [ ] Header/Mega Menu không có Học viên/Thành viên/TNV/Login public.
- [ ] Footer compact, Privacy/Terms/Security/Support đúng.

## FUNCTION + SEARCH PASS
- [ ] `/`, `/tra-cuu`, `/gcn`, `/ho-so`, `/bieu-mau` tải trực tiếp và refresh không 404.
- [ ] `/` mở Search Center; debounce, keyboard, recent, suggestions, filter, highlight, deep links hoạt động.
- [ ] Search tìm được news/program/event/unit/resource/form và credential exact code.

## CREDENTIAL PASS
- [ ] Legacy code đã phát hành vẫn lookup nguyên dạng.
- [ ] Issue mới sinh `SFN-GCN/GXN/BK-#####` ngẫu nhiên và kiểm collision.
- [ ] Sau issue không sửa ID/core fields bằng CRUD thông thường.
- [ ] Revoke hiển thị trạng thái/lý do phù hợp.
- [ ] Supersede tạo replacement; credential cũ giữ history và trỏ replacement sau khi replacement được issue.
- [ ] QR mở `/gcn/{id}`; mã text vẫn dùng được khi không quét QR.

## CASE PASS
- [ ] Case ID một mình không trả dữ liệu riêng tư.
- [ ] Mã + lớp xác minh bổ sung đúng mới trả timeline/status/next action/result.
- [ ] Không echo email trong response tra cứu.

## FORM + UPLOAD + SIGNATURE PASS
- [ ] Classic + Multi-step + Guided render đúng mobile/desktop.
- [ ] Conditional logic ẩn/hiện và server validation khớp.
- [ ] Review Before Submit hiển thị trước submit cuối.
- [ ] Error summary + inline state + focus lỗi hoạt động bằng keyboard.
- [ ] Draft text phục hồi sau reload/mất kết nối; file/chữ ký không bị giả vờ “đã lưu draft”.
- [ ] Upload session có progress, retry/error state; object nằm R2, D1 chỉ metadata/reference.
- [ ] MIME/magic-byte/size validation chặn file sai.
- [ ] Signature vẽ bằng chuột/cảm ứng + upload alternative + clear/re-sign.
- [ ] Minor Mode thêm DOB/rule guardian/consent khi <18; không mặc định yêu cầu CCCD/giấy khai sinh.
- [ ] Submit thành công trả Digital Receipt + Case ID + next action + tracking link.

## ADMIN PASS
- [ ] Chỉ tài khoản Administrator đã tồn tại đăng nhập được.
- [ ] Public registration trả disabled/404.
- [ ] Google OAuth không tự tạo student/member account.
- [ ] Command Center và các khu Content/Programs/Activities/Forms/Cases/Credentials/Resources/Media/Support/System hoạt động.
- [ ] Form revision tăng version và giữ history.
- [ ] Audit log không duplicate request body/file lớn.

## D1/R2 ARCHITECTURE PASS
- [ ] Migration `0005` áp dụng thành công trên bản copy/staging DB.
- [ ] Không có binary/base64 PDF/image/signature trong D1.
- [ ] R2 chứa object; D1 chứa key/hash/metadata/status.
- [ ] Cleanup xóa upload session/file tạm hết hạn và dữ liệu telemetry cũ theo policy.

## ACCESSIBILITY + MOBILE PASS
- [ ] Keyboard-only dùng được menu, search, lookup, form, admin tác vụ chính.
- [ ] Search dialog giữ focus hợp lý và ESC đóng.
- [ ] Form label/error/status được screen reader nhận diện.
- [ ] `prefers-reduced-motion` giảm animation.
- [ ] 360px/390px/768px và desktop không overflow tác vụ QR/form/signature/upload.

## SECURITY PASS
- [ ] Admin auth/session/RBAC/2FA/reset flow được test.
- [ ] State-changing API chặn bad origin.
- [ ] Rate limit credential/case/upload/login hoạt động.
- [ ] Case enumeration không lộ dữ liệu.
- [ ] Credential random ID không được xem là secret.
- [ ] File private không mở được khi thiếu quyền/token.
- [ ] Security headers/CSP/Permissions-Policy hợp lệ.
- [ ] Không stack trace/secret ở 403/404/500/public errors.

## PERFORMANCE + RESILIENCE PASS
- [ ] Public Home không tải admin bundle `app.js` trước khi cần.
- [ ] API public cache hit ở edge; CMS update invalidate route liên quan.
- [ ] Không hero autoplay video/asset nặng bất hợp lý.
- [ ] Offline shell hiển thị được; form draft không mất toàn bộ text sau sự cố mạng.
- [ ] JS lỗi không làm semantic hero/quick links biến mất hoàn toàn.

## PRODUCTION PASS
- [ ] `npm run validate` PASS.
- [ ] Smoke test trên Worker URL PASS.
- [ ] D1/R2/email/Turnstile/OAuth theo cấu hình thực tế PASS.
- [ ] Mobile Chrome/Safari + desktop Chrome/Edge PASS.
- [ ] Backup/restore thử nghiệm PASS.
- [ ] Sau tất cả mục trên mới gắn/chuyển `ctt.skyfirst.io.vn` production.
