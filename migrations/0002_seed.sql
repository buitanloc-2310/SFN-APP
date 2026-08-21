PRAGMA foreign_keys = ON;
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('super_admin','Quản trị viên cấp cao',100,'Toàn quyền hệ thống, cấp/thu hồi mọi vai trò.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('system_admin','Quản trị viên hệ thống',90,'Quản trị hệ thống trừ các thao tác bảo vệ Super Admin gốc.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('network_secretary','Tổng Thư ký Mạng lưới',80,'Phê duyệt nghiệp vụ theo thẩm quyền Mạng lưới.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('office','Văn phòng Sky First Network',70,'Văn thư, hồ sơ, cấp số, phát hành, thủ tục nội bộ.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('hr','Ban Nhân sự',70,'Tuyển dụng, hồ sơ nhân sự, đánh giá, đề nghị ghi nhận.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('communications','Ban Truyền thông',60,'Tin tức, nội dung, nhận diện và truyền thông.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('external_events','Ban Đối ngoại và Sự kiện',60,'Hợp tác, đối ngoại, sự kiện và điều phối.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('unit_admin','Quản trị viên đơn vị trực thuộc',50,'Quản trị trong phạm vi đơn vị được giao.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('handler','Nhân sự xử lý hồ sơ',40,'Xử lý hồ sơ/ticket theo phạm vi được giao.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('member','Thành viên SFN',20,'Quyền nội bộ của Thành viên được SFN cấp.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('volunteer','Tình nguyện viên',20,'Quyền Tình nguyện viên được SFN cấp.');
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES('student','Học sinh/Học viên',10,'Quyền người học.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('accounts','Tài khoản & Xác thực','Hệ thống',1,10,'Đăng nhập, mật khẩu, Google OAuth, 2FA, phiên đăng nhập.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('permissions','Phân quyền','Hệ thống',1,20,'Vai trò, cấp quyền, lịch sử quyền.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('recruitment','Tuyển dụng','Nhân sự',1,30,'Hồ sơ, phỏng vấn, đánh giá, ghi chú.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('people','Hồ sơ nhân sự điện tử','Nhân sự',1,40,'Thành viên, Core Team, TNV, lịch sử chức danh/đơn vị.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('forms','Biểu mẫu','Hệ thống',1,50,'Form Builder, phiên bản, phân nhánh, upload.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('volunteer_teaching','TNV Dạy học','Giáo dục',1,60,'Phạm vi giảng dạy, đánh giá chuyên môn.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('classes','Lớp học','Giáo dục',1,70,'Lớp, học viên, lịch, điểm danh.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('events','Sự kiện','Hoạt động',1,80,'Đăng ký, danh sách, check-in, feedback.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('certificates','GCN & GXN','Nghiệp vụ',1,90,'Đề nghị, phê duyệt, phát hành, QR/tra cứu, thu hồi/cấp lại.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('documents','Kho văn bản','Nghiệp vụ',1,100,'QĐ/TB/KH/QC/BB/BC và tra cứu văn bản.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('units','Đơn vị trực thuộc','Tổ chức',1,110,'SFEC và các đơn vị trực thuộc.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('cms','Tin tức & CMS','Truyền thông',1,120,'Tin tức, trang chủ, banner, chuyên mục.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('approvals','Trung tâm phê duyệt','Nghiệp vụ',1,130,'Hàng đợi phê duyệt thống nhất.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('notifications','Thông báo','Hệ thống',1,140,'Thông báo trong app theo vai trò/người dùng.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('support','Hỗ trợ & Ticket','Hệ thống',1,150,'Hỗ trợ, phản ánh, khiếu nại, lịch sử trao đổi.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('files','Tài liệu & File','Hệ thống',1,160,'R2, quyền truy cập, upload minh chứng.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('search','Tìm kiếm toàn hệ thống','Hệ thống',1,170,'Hồ sơ, nhân sự, GCN, văn bản, ticket.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('exports','Xuất dữ liệu','Hệ thống',1,180,'CSV/Excel-ready export.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('tasks','Nhiệm vụ & Bàn giao','Nội bộ',1,190,'Việc cần làm, deadline, bàn giao.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('privacy','Trung tâm Quyền riêng tư','Hệ thống',1,200,'Yêu cầu cập nhật/xóa dữ liệu, retention.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('backup','Sao lưu & Phục hồi','Hệ thống',1,210,'Backup tự động và thủ công.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('audit','Nhật ký hệ thống','Hệ thống',1,220,'Ai làm gì, lúc nào.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('maintenance','Bảo trì & Trang lỗi','Hệ thống',1,230,'404, bảo trì, lỗi hệ thống.');
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES('pwa','PWA & Mobile','Trải nghiệm',1,240,'Cài như app, responsive, cache shell.');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('app_name','"Mạng lưới Giáo dục và Phát triển Cộng đồng Sky First"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('app_short_name','"Sky First Network"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('app_url','"https://volunteer.skyfirst.io.vn"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('website','"https://www.skyfirst.io.vn"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('receiver_email','"skyfirst.ec@gmail.com"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('super_admin_email','"skyfirst.ec@gmail.com"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('hotline','"0924 910 210"');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('maintenance_mode','false');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('rejected_application_retention_days','365');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('session_days','7');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('max_upload_mb','10');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('brand_slogan','"Kết nối tri thức – Lan tỏa giá trị – Kiến tạo tương lai."');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('member_self_grant','false');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('admin_self_registration','false');

INSERT OR IGNORE INTO settings(key,value_json) VALUES('hero_title','"Kết nối giáo dục. Phát triển cộng đồng."');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('hero_text','"Một cổng chung cho Thành viên, Core Team, Tình nguyện viên, Học sinh/Học viên, lớp học, hoạt động, hồ sơ, GCN/GXN và quản trị Sky First Network."');
INSERT OR IGNORE INTO settings(key,value_json) VALUES('hero_cover_url','"/assets/sfn-cover.png"');
INSERT OR IGNORE INTO terms(code,name,version,scope,body,status) VALUES('DK-01/2026/SFN','Điều khoản Tuyển chọn và Tham gia Core Team','22/08/2026','Core Team','# ĐIỀU KHOẢN TUYỂN CHỌN VÀ THAM GIA CORE TEAM

## SKY FIRST NETWORK (SFN)

### Áp dụng trong giai đoạn lâm thời năm 2026

**Mã tài liệu:** DK-01/2026/SFN
 **Ngày áp dụng:** 22/08/2026
**ĐIỀU 1. PHẠM VI VÀ ĐỐI TƯỢNG ÁP DỤNG**

1.  Điều khoản này quy định các nguyên tắc liên quan đến việc đăng ký, tuyển chọn, tiếp nhận, phân công, hoạt động, đánh giá và ghi nhận đối với **Core Team Sky First Network (SFN)**.
2. Điều khoản áp dụng đối với tất cả cá nhân đăng ký hoặc được tiếp nhận vào các vị trí Core Team thuộc:
3. Văn phòng Sky First Network;
4. Ban Nhân sự;
5. Ban Truyền thông;
6. Ban Đối ngoại & Sự kiện;
7. Các đơn vị khác được SFN bổ sung vào phạm vi tuyển Core Team trong từng thời kỳ.
8. Việc hoàn thành biểu mẫu đăng ký **không làm phát sinh quyền được tiếp nhận, bổ nhiệm hoặc giữ bất kỳ chức danh nào tại SFN**.
9. SFN có quyền xem xét mức độ phù hợp của ứng viên với vị trí đăng ký và nhu cầu nhân sự thực tế tại thời điểm tuyển chọn.

# ĐIỀU 2. ĐIỀU KIỆN ĐỘ TUỔI

1. **Tất cả ứng viên đăng ký Core Team phải từ đủ 18 tuổi trở lên tại thời điểm nộp hồ sơ.**
2. Quy định tại khoản 1 áp dụng đối với toàn bộ chức danh thuộc phạm vi Core Team, bao gồm nhưng không giới hạn:

- Trưởng Ban;
- Phó Trưởng Ban;
- Thư ký Ban;
- Chánh Văn phòng;
- Phó Chánh Văn phòng;
- Thư ký Văn phòng;
- Các vị trí phụ trách hoặc chức danh Core Team khác được công bố trong từng đợt tuyển.

3. Ứng viên chưa đủ 18 tuổi không thuộc đối tượng tuyển Core Team của đợt tuyển này nhưng có thể đăng ký các vị trí **thành viên, tình nguyện viên hoặc vị trí khác** nếu đáp ứng điều kiện của đợt tuyển tương ứng.
4. SFN có quyền yêu cầu ứng viên cung cấp thông tin cần thiết để xác minh việc đáp ứng điều kiện độ tuổi trước khi hoàn tất thủ tục tiếp nhận.

# ĐIỀU 3. NGUYÊN TẮC TUYỂN CHỌN

Việc tuyển chọn Core Team được thực hiện dựa trên các nguyên tắc:
**1. Tự nguyện:** Ứng viên chủ động đăng ký và có quyền dừng quá trình ứng tuyển trước khi được tiếp nhận.
**2. Phù hợp:** Việc đánh giá căn cứ vào yêu cầu của vị trí, năng lực, kinh nghiệm, trách nhiệm, thời gian tham gia và nhu cầu thực tế của SFN.
**3. Không tuyển theo hình thức:** Việc đăng ký chức danh không đồng nghĩa ứng viên sẽ được bổ nhiệm vào chức danh đó.
**4. Không mua bán chức danh:** SFN không thu tiền để đổi lấy việc tiếp nhận, bổ nhiệm, chức danh, giấy chứng nhận hoặc kết quả tuyển chọn.
**5. Minh bạch:** Ứng viên phải cung cấp thông tin trung thực và SFN có trách nhiệm thông tin phù hợp về quy trình tuyển chọn.

# ĐIỀU 4. QUY TRÌNH TUYỂN CHỌN

Quy trình có thể bao gồm:
**Vòng 1 – Tiếp nhận hồ sơ:**
 Ứng viên hoàn thành biểu mẫu đăng ký Core Team.
**Vòng 2 – Sàng lọc:**
 Hồ sơ được xem xét căn cứ vị trí đăng ký và tiêu chí tuyển chọn.
**Vòng 3 – Phỏng vấn/Trao đổi:**
 Ứng viên phù hợp được liên hệ để tham gia trao đổi trực tuyến.
**Vòng 4 – Đánh giá bổ sung:**
 Đối với một số vị trí, SFN có thể yêu cầu thực hiện nhiệm vụ đánh giá phù hợp với chức năng của vị trí.
**Vòng 5 – Thông báo kết quả:**
 Ứng viên được thông báo kết quả hoặc hướng dẫn bước tiếp theo qua kênh liên hệ đã cung cấp.
**Vòng 6 – Tiếp nhận và kiện toàn:**
 Ứng viên đạt yêu cầu được thực hiện thủ tục tiếp nhận, phân công hoặc kiện toàn chức danh theo thẩm quyền của SFN.
SFN áp dụng hình thức **tuyển cuốn chiếu** và có thể đóng từng vị trí khi đã tìm được nhân sự phù hợp.

# ĐIỀU 5. THÔNG TIN VÀ HỒ SƠ ỨNG VIÊN

1. Ứng viên có trách nhiệm cung cấp **đầy đủ, chính xác và trung thực** các thông tin được yêu cầu trong phạm vi phục vụ quá trình đăng ký, tuyển chọn và liên hệ của Sky First Network (SFN).
2. Trong quá trình tuyển chọn Core Team, SFN có thể tiếp nhận và xử lý các nhóm thông tin cần thiết, bao gồm:

- Họ và tên;
- Ngày, tháng, năm sinh;
- Tỉnh/Thành phố đang sinh sống;
- Email, số điện thoại/Zalo và thông tin liên hệ;
- Trường học, cơ sở giáo dục hoặc đơn vị đang học tập/công tác;
- Kinh nghiệm, kỹ năng và năng lực chuyên môn;
- Vị trí, đơn vị và nguyện vọng ứng tuyển;
- CV, Portfolio hoặc sản phẩm do ứng viên **tự nguyện cung cấp**;
- Nội dung trả lời phỏng vấn, bài đánh giá hoặc nhiệm vụ tuyển chọn (nếu có);
- Các thông tin khác thực sự cần thiết và có liên quan trực tiếp đến quá trình tuyển chọn.

3. SFN thực hiện việc thu thập thông tin theo nguyên tắc **phù hợp với mục đích tuyển chọn và giới hạn trong phạm vi cần thiết**; không yêu cầu ứng viên cung cấp những thông tin không cần thiết cho việc đánh giá hồ sơ tại vòng đăng ký ban đầu.
4. Trường hợp ứng viên vượt qua quá trình tuyển chọn và được đề nghị tiếp nhận vào Core Team, SFN có thể yêu cầu **bổ sung hoặc xác minh một số thông tin cần thiết** phục vụ việc hoàn thiện hồ sơ nhân sự, xác minh điều kiện tham gia hoặc thực hiện thủ tục tiếp nhận. Mục đích và phạm vi thông tin cần bổ sung phải được thông báo phù hợp cho cá nhân có liên quan.
5. Ứng viên có trách nhiệm bảo đảm các tài liệu, thành tích, kinh nghiệm, sản phẩm và thông tin được khai trong hồ sơ **thuộc về mình hoặc được phép sử dụng/cung cấp**.
6. Nghiêm cấm việc **giả mạo danh tính, cố ý khai sai độ tuổi, làm giả hồ sơ, thành tích hoặc cung cấp thông tin sai sự thật** nhằm tác động đến kết quả tuyển chọn.
7. Trường hợp phát hiện thông tin không chính xác hoặc cần cập nhật sau khi gửi hồ sơ, ứng viên có trách nhiệm **chủ động thông báo cho SFN để được hướng dẫn điều chỉnh**.
8. Trường hợp phát hiện hành vi cố ý gian dối hoặc giả mạo có ảnh hưởng đến kết quả tuyển chọn, SFN có thể **dừng xem xét hồ sơ hoặc xem xét lại kết quả tiếp nhận** theo quy định áp dụng.

# ĐIỀU 6. BẢO VỆ THÔNG TIN CÁ NHÂN

1. Thông tin ứng viên được thu thập nhằm phục vụ các mục đích cần thiết như:

- Tiếp nhận và đánh giá hồ sơ;
- Liên hệ ứng viên;
- Xác minh thông tin;
- Quản lý hồ sơ nhân sự sau khi được tiếp nhận;
- Thực hiện các thủ tục nội bộ có liên quan.

2. SFN không được tùy tiện công khai số Căn cước/Căn cước công dân, số điện thoại, địa chỉ email hoặc dữ liệu cá nhân khác của ứng viên.
3. Quyền truy cập dữ liệu phải được giới hạn cho cá nhân hoặc đơn vị có nhiệm vụ phù hợp.
4. Thông tin không được sử dụng cho mục đích không liên quan đến quá trình tuyển chọn hoặc quản lý nhân sự nếu chưa có căn cứ phù hợp.
5. Ứng viên có thể đề nghị cập nhật hoặc đính chính thông tin khi phát hiện dữ liệu không chính xác.

# ĐIỀU 7. TRÁCH NHIỆM CỦA CORE TEAM

Khi được tiếp nhận, nhân sự Core Team có trách nhiệm:

1. Thực hiện nhiệm vụ theo vị trí và phạm vi được giao;
2. Chủ động phối hợp với thành viên và đơn vị liên quan;
3. Tôn trọng thời hạn công việc và thông báo khi không thể hoàn thành nhiệm vụ đúng hạn;
4. Không sử dụng chức danh SFN để thực hiện hoạt động cá nhân ngoài phạm vi được giao;
5. Bảo vệ thông tin nội bộ, hồ sơ nhân sự và dữ liệu được tiếp cận trong quá trình làm việc;
6. Không tự ý đại diện SFN đưa ra cam kết với tổ chức/cá nhân bên ngoài khi chưa được giao thẩm quyền;
7. Tôn trọng thành viên, tình nguyện viên, người học, đối tác và người tham gia hoạt động;
8. Tuân thủ Quy chế tổ chức và hoạt động, quy định nội bộ và quyết định hợp lệ thuộc phạm vi áp dụng;
9. Chủ động báo cáo các vấn đề nghiêm trọng hoặc xung đột lợi ích có thể ảnh hưởng đến nhiệm vụ.

# ĐIỀU 8. QUYỀN LỢI CỦA CORE TEAM

Nhân sự Core Team được:

1. Tham gia vào quá trình xây dựng và vận hành đơn vị mình phụ trách;
2. Được cung cấp thông tin cần thiết để thực hiện nhiệm vụ;
3. Được đề xuất sáng kiến và góp ý đối với hoạt động thuộc phạm vi chuyên môn;
4. Được tham gia các chương trình, hoạt động và buổi chia sẻ nội bộ phù hợp;
5. Được ghi nhận quá trình tham gia và kết quả đóng góp;
6. Được xem xét cấp **Giấy chứng nhận, Giấy ghi nhận hoặc xác nhận quá trình tham gia** khi đáp ứng điều kiện;
7. Được xem xét giao thêm nhiệm vụ hoặc kiện toàn vị trí phù hợp căn cứ năng lực và nhu cầu thực tế;
8. Được đề nghị giải đáp những quy định, nhiệm vụ hoặc quyết định có ảnh hưởng trực tiếp đến phạm vi công việc của mình;
9. Được xin tạm ngừng hoặc thôi tham gia theo quy trình áp dụng.

# ĐIỀU 9. ĐÁNH GIÁ VÀ GHI NHẬN

1. Core Team được đánh giá dựa trên **quá trình tham gia thực tế**, không chỉ căn cứ chức danh.
2. Nội dung đánh giá có thể bao gồm:

- Mức độ hoàn thành nhiệm vụ;
- Trách nhiệm và tính chủ động;
- Khả năng phối hợp;
- Thời gian tham gia;
- Việc tuân thủ quy định;
- Kết quả và đóng góp thực tế.

3. Việc giữ chức danh Core Team **không mặc nhiên tạo quyền được cấp GCN**.
4. Ban Nhân sự thực hiện tổng hợp và đề nghị đối với các trường hợp đủ điều kiện ghi nhận theo quy định.
5. Hồ sơ đề nghị được chuyển qua quy trình nội bộ của SFN; **Tổng Thư ký Mạng lưới thực hiện xem xét, phê duyệt việc cấp GCN trong phạm vi thẩm quyền được quy định**.
6. Văn phòng SFN thực hiện việc cấp số, vào sổ, lưu trữ và phát hành sau khi được phê duyệt.

# ĐIỀU 10. BẢO MẬT VÀ SỬ DỤNG THÔNG TIN NỘI BỘ

Core Team không được tự ý:

- Công khai hồ sơ nhân sự;
- Chia sẻ tài liệu nội bộ chưa được phép công bố;
- Cung cấp dữ liệu người học/thành viên cho bên thứ ba;
- Đăng tải nội dung trao đổi nội bộ nhằm gây ảnh hưởng đến cá nhân hoặc Mạng lưới;
- Sử dụng dữ liệu SFN cho mục đích cá nhân.

Nghĩa vụ bảo vệ thông tin phù hợp vẫn được áp dụng đối với những dữ liệu cần bảo mật sau khi cá nhân thôi tham gia SFN.

# ĐIỀU 11. TRUYỀN THÔNG VÀ HÌNH ẢNH

1. Core Team có trách nhiệm sử dụng tên gọi, logo và nhận diện SFN đúng phạm vi được giao.
2. Không được tự ý tạo thông báo, tuyên bố hoặc tài khoản mang danh nghĩa chính thức của SFN khi chưa được phân công.
3. Việc sử dụng hình ảnh hoặc thông tin cá nhân của thành viên phải phù hợp với mục đích hoạt động và quy định bảo vệ dữ liệu.
4. Hoạt động hỗ trợ truyền thông cho đợt tuyển như theo dõi Fanpage, tương tác, chia sẻ hoặc giới thiệu đợt tuyển **không thay thế tiêu chí đánh giá năng lực của ứng viên**.

# ĐIỀU 12. TẠM NGỪNG, THÔI NHIỆM VỤ VÀ ĐIỀU CHUYỂN

Core Team có quyền đề nghị:

- Tạm ngừng hoạt động;
-  Thôi giữ chức danh;
- Chuyển vị trí;
- Chuyển đơn vị;

* Chấm dứt việc tham gia SFN.

Việc xử lý được thực hiện theo quy trình nhân sự của SFN và phải bảo đảm bàn giao tài liệu, tài khoản, dữ liệu và nhiệm vụ đang phụ trách trước khi hoàn tất thủ tục khi có yêu cầu bàn giao.

# ĐIỀU 13. XỬ LÝ VI PHẠM

Tùy tính chất và mức độ, trường hợp vi phạm có thể được:

- Nhắc nhở;
- Yêu cầu khắc phục;
- Tạm đình chỉ nhiệm vụ;
- Thu hồi quyền truy cập;
- Điều chuyển;
- Miễn nhiệm chức danh;
- Chấm dứt tư cách tham gia.

Đối với vấn đề nghiêm trọng, SFN có thể áp dụng biện pháp cần thiết để bảo vệ người tham gia, dữ liệu và hoạt động của Mạng lưới, đồng thời xử lý theo quy định pháp luật khi thuộc trường hợp cần thiết.
**ĐIỀU 14. CAM KẾT THỜI GIAN ĐỒNG HÀNH VÀ BÀN GIAO NHIỆM VỤ**

1. Core Team xác định định hướng **đồng hành lâu dài với Sky First Network và cam kết thời gian tham gia tối thiểu 12 (mười hai) tháng**, tính từ ngày chính thức được tiếp nhận hoặc quyết định giao nhiệm vụ/bổ nhiệm có hiệu lực.
2. Quy định này áp dụng đối với toàn bộ vị trí Core Team, bao gồm **Trưởng Ban, Phó Trưởng Ban, Thư ký Ban, Chánh Văn phòng, Phó Chánh Văn phòng, Thư ký Văn phòng và các chức danh Core Team khác** thuộc phạm vi áp dụng.
3. Trường hợp có nhu cầu thôi chức danh, thôi nhiệm vụ hoặc chấm dứt tham gia Core Team, cá nhân có trách nhiệm **thông báo trước ít nhất 30 (ba mươi) ngày**, trừ trường hợp bất khả kháng, khẩn cấp hoặc có hoàn cảnh đặc biệt.
4. Trong thời gian báo trước, cá nhân có trách nhiệm phối hợp duy trì công việc và thực hiện **bàn giao đầy đủ nhiệm vụ, hồ sơ, tài liệu, dữ liệu, tài khoản, quyền truy cập và các công việc đang xử lý** cho cá nhân hoặc đơn vị được chỉ định.
5. Cá nhân không được tự ý xóa, chiếm giữ, sao chép trái phép, thay đổi quyền truy cập hoặc tiếp tục sử dụng tài liệu, dữ liệu và tài khoản thuộc SFN sau khi kết thúc nhiệm vụ.
6. Trường hợp không thể hoàn thành đủ thời gian 12 tháng vì lý do chính đáng, cá nhân được quyền đề nghị thôi nhiệm vụ trước thời hạn và thực hiện thủ tục bàn giao theo quy định.
7. **Không áp dụng khoản phạt tài chính chỉ vì Core Team không hoàn thành đủ thời gian cam kết 12 tháng.** Tuy nhiên, thời gian và mức độ hoàn thành nhiệm vụ thực tế có thể được xem xét khi đánh giá kết quả hoạt động và điều kiện cấp giấy chứng nhận/giấy ghi nhận.
8. Nghĩa vụ bảo mật và bảo vệ dữ liệu vẫn tiếp tục được áp dụng sau khi cá nhân kết thúc nhiệm vụ đối với những thông tin thuộc phạm vi cần bảo mật.

# ĐIỀU 15. SỬA ĐỔI VÀ ÁP DỤNG ĐIỀU KHOẢN

1. Điều khoản này được áp dụng đối với đợt tuyển Core Team bắt đầu từ ngày **22/08/2026**.
2. SFN có thể sửa đổi hoặc bổ sung điều khoản khi cần thiết. Những thay đổi có ảnh hưởng đáng kể đến người đã được tiếp nhận cần được thông báo phù hợp.
3. Ứng viên được cung cấp liên kết để đọc Điều khoản trước khi xác nhận đăng ký.
4. Trường hợp ứng viên chưa hiểu một nội dung, ứng viên có thể lựa chọn **yêu cầu SFN giải đáp trước khi xác nhận đồng ý**.

**Điều khoản này được áp dụng thống nhất đối với các ứng viên đăng ký và nhân sự được tiếp nhận vào Core Team Sky First Network trong phạm vi quy định. Các cá nhân có liên quan có trách nhiệm nghiên cứu và thực hiện đầy đủ các nội dung nêu trên.**
**Mạng lưới Giáo dục và Phát triển Cộng đồng Sky First trân trọng thông báo./.**
**SKY FIRST NETWORK (SFN)**
*Mạng lưới Giáo dục và Phát triển Cộng đồng Sky First*
📧 Email: skyfirst.ec\@gmail.com
📧 Hỗ trợ: hotro\@skyfirst.io.vn
☎️ Hotline/Zalo: **0924 910 210**
🌐 Website:[ ](http://www.skyfirst.io.vn)[**www.skyfirst.io.vn**](http://www.skyfirst.io.vn) ','published');
INSERT OR IGNORE INTO terms(code,name,version,scope,body,status) VALUES('DK-02/2026/SFN','Điều khoản Đăng ký và Tham gia Tình nguyện viên','22/08/2026','Tình nguyện viên','# ĐIỀU KHOẢN ĐĂNG KÝ VÀ THAM GIA TÌNH NGUYỆN VIÊN
## SKY FIRST NETWORK (SFN)
**Mã tài liệu:** DK-02/2026/SFN

1. Tình nguyện viên tham gia trên nguyên tắc tự nguyện, không mua bán vị trí, chức danh hoặc giấy chứng nhận.
2. Ứng viên Tình nguyện viên thuộc đợt tuyển này phải từ đủ 18 tuổi tại thời điểm nộp hồ sơ.
3. Thông tin đăng ký phải chính xác, trung thực và chỉ được thu thập trong phạm vi cần thiết cho tuyển chọn, phân công, liên hệ và quản lý hoạt động.
4. Tình nguyện viên có trách nhiệm thực hiện nhiệm vụ đúng phạm vi được giao, tôn trọng thời hạn, phối hợp với đơn vị phụ trách và bảo vệ dữ liệu nội bộ.
5. Không được tự ý đại diện SFN cam kết với bên thứ ba, tự ý thu tiền, sử dụng chức danh SFN cho mục đích cá nhân hoặc phát hành giấy tờ mang danh nghĩa SFN khi chưa được giao thẩm quyền.
6. Tình nguyện viên dạy học chỉ được phụ trách các lớp/chương trình thuộc phạm vi đã được đánh giá và phê duyệt. Các phạm vi có thể gồm Lớp 9, Lớp 10, Lớp 11, Lớp 12, Tiếng Anh Cơ bản, Tiếng Anh Giao tiếp, IELTS và chương trình khác được công bố.
7. Tình nguyện viên dạy học phải chuẩn bị bài, bảo đảm thái độ sư phạm phù hợp, không công khai dữ liệu người học, không tự ý mời chào dạy thêm riêng và không sử dụng tài liệu trái phép.
8. Với người học chưa thành niên, tình nguyện viên phải tuân thủ quy trình bảo vệ người học, chỉ liên hệ trong phạm vi học tập qua kênh được cho phép và báo cáo sự việc bất thường cho đơn vị phụ trách.
9. Việc được tiếp nhận làm tình nguyện viên không đồng nghĩa tự động được quyền phụ trách mọi lớp/chương trình. SFN/SFEC có thể yêu cầu phỏng vấn, bài đánh giá, dạy thử hoặc minh chứng chuyên môn.
10. Kết quả hoạt động được đánh giá theo mức độ tham gia thực tế, trách nhiệm, chất lượng công việc và việc tuân thủ quy định; chức danh không mặc nhiên tạo quyền được cấp GCN/GXN.
11. Khi tạm ngừng hoặc kết thúc nhiệm vụ, tình nguyện viên phải bàn giao tài liệu, dữ liệu, tài khoản và công việc thuộc phạm vi được giao khi có yêu cầu.
12. SFN có thể nhắc nhở, yêu cầu khắc phục, tạm dừng nhiệm vụ, thu hồi quyền truy cập hoặc chấm dứt việc tham gia khi có vi phạm phù hợp với tính chất, mức độ.
13. SFN có thể sửa đổi điều khoản và phải công bố phiên bản áp dụng; hệ thống lưu phiên bản điều khoản mà người đăng ký đã xác nhận.
','published');
INSERT OR IGNORE INTO terms(code,name,version,scope,body,status) VALUES('PRIVACY/SFN','Thông báo Quyền riêng tư Sky First Network','21/08/2026','Toàn hệ thống','# THÔNG BÁO QUYỀN RIÊNG TƯ SFN
Sky First Network chỉ thu thập dữ liệu cần thiết cho đăng ký, tuyển chọn, quản lý thành viên/tình nguyện viên, lớp học, sự kiện, hỗ trợ và cấp GCN/GXN.
Dữ liệu nhạy cảm hoặc giấy tờ định danh không được yêu cầu ở vòng đăng ký ban đầu nếu không thật sự cần thiết.
Quyền truy cập dữ liệu được giới hạn theo vai trò và phạm vi công việc.
Người dùng có thể gửi yêu cầu cập nhật, đính chính hoặc yêu cầu xử lý dữ liệu qua Trung tâm Quyền riêng tư.
Hồ sơ không còn cần thiết được xử lý theo chính sách thời hạn lưu trữ do Super Admin cấu hình.
','published');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('member','Đăng ký Thành viên Sky First Network','SFN-TV','Dành cho cá nhân mong muốn tham gia Mạng lưới. Quyền Thành viên chỉ được SFN cấp sau khi hồ sơ được duyệt.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"member","name":"Đăng ký Thành viên Sky First Network","prefix":"SFN-TV","description":"Dành cho cá nhân mong muốn tham gia Mạng lưới. Quyền Thành viên chỉ được SFN cấp sau khi hồ sơ được duyệt.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Thông tin cá nhân","fields":[{"key":"full_name","label":"Họ và tên","type":"text","required":true},{"key":"dob","label":"Ngày sinh","type":"date","required":true},{"key":"gender","label":"Giới tính","type":"select","required":false,"options":["Nam","Nữ","Khác","Không muốn cung cấp"]},{"key":"city","label":"Tỉnh/Thành phố","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":true},{"key":"school","label":"Trường học/Cơ sở giáo dục/Đơn vị công tác","type":"text","required":false},{"key":"facebook","label":"Facebook cá nhân","type":"url","required":false}]},{"title":"Nguyện vọng tham gia","fields":[{"key":"area","label":"Đơn vị/Ban mong muốn tham gia","type":"select","required":true,"options":["Văn phòng Sky First Network","Ban Nhân sự","Ban Truyền thông","Ban Đối ngoại & Sự kiện","Đơn vị trực thuộc","Chưa xác định"]},{"key":"skills","label":"Kỹ năng/Thế mạnh nổi bật","type":"textarea","required":true},{"key":"experience","label":"Kinh nghiệm liên quan","type":"textarea","required":false},{"key":"why","label":"Vì sao bạn muốn tham gia Sky First Network?","type":"textarea","required":true},{"key":"availability","label":"Thời gian có thể tham gia mỗi tuần","type":"select","required":true,"options":["Dưới 2 giờ","2–4 giờ","4–6 giờ","6–8 giờ","Trên 8 giờ","Phụ thuộc từng tuần"]}]},{"title":"Xác nhận","fields":[{"key":"truth","label":"Tôi xác nhận thông tin cung cấp là trung thực.","type":"checkbox","required":true},{"key":"privacy","label":"Tôi đã đọc và đồng ý với Thông báo Quyền riêng tư SFN.","type":"checkbox","required":true}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('core','Đăng ký Core Team Sky First Network','SFN-CORE','Tuyển cuốn chiếu Core Team giai đoạn lâm thời. Ứng viên phải từ đủ 18 tuổi.','public',18,1,'skyfirst.ec@gmail.com',1,'{"id":"core","name":"Đăng ký Core Team Sky First Network","prefix":"SFN-CORE","description":"Tuyển cuốn chiếu Core Team giai đoạn lâm thời. Ứng viên phải từ đủ 18 tuổi.","audience":"public","min_age":18,"term_codes":["DK-01/2026/SFN","PRIVACY/SFN"],"sections":[{"title":"Thông tin cá nhân","fields":[{"key":"full_name","label":"Họ và tên","type":"text","required":true},{"key":"dob","label":"Ngày sinh","type":"date","required":true},{"key":"gender","label":"Giới tính","type":"select","required":false,"options":["Nam","Nữ","Khác","Không muốn cung cấp"]},{"key":"city","label":"Tỉnh/Thành phố","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":true},{"key":"school","label":"Trường học/Cơ sở giáo dục/Đơn vị công tác","type":"text","required":false},{"key":"facebook","label":"Facebook cá nhân","type":"url","required":false},{"key":"source","label":"Bạn biết SFN qua đâu?","type":"text","required":true},{"key":"referrer","label":"Người giới thiệu (nếu có)","type":"text","required":false}]},{"title":"Vị trí ứng tuyển","fields":[{"key":"area","label":"Đơn vị ứng tuyển","type":"select","required":true,"options":["Ban Nhân sự","Ban Truyền thông","Ban Đối ngoại & Sự kiện","Văn phòng Sky First Network"]},{"key":"position","label":"Vị trí ứng tuyển","type":"select","required":true,"options":["Trưởng Ban / Chánh Văn phòng","Phó Trưởng Ban / Phó Chánh Văn phòng","Thư ký Ban / Thư ký Văn phòng","Nhân sự nghiệp vụ Văn phòng"]},{"key":"second_choice","label":"Nguyện vọng 2","type":"text","required":false}]},{"title":"Năng lực & kinh nghiệm","fields":[{"key":"experience","label":"Kinh nghiệm liên quan","type":"textarea","required":true},{"key":"strengths","label":"03 thế mạnh nổi bật","type":"textarea","required":true},{"key":"tools","label":"Công cụ/phần mềm có thể sử dụng","type":"textarea","required":true},{"key":"cv","label":"CV","type":"file","required":false,"accept":["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]},{"key":"portfolio","label":"Portfolio/Minh chứng","type":"file","required":false,"accept":["application/pdf","image/png","image/jpeg"]}]},{"title":"Câu hỏi Core Team","fields":[{"key":"why_core","label":"Vì sao bạn lựa chọn Core Team SFN?","type":"textarea","required":true},{"key":"fit","label":"Vì sao bạn phù hợp với vị trí đăng ký?","type":"textarea","required":true},{"key":"first_90","label":"Bạn muốn đóng góp điều gì trong 03 tháng đầu?","type":"textarea","required":true},{"key":"late_deadline","label":"Một thành viên liên tục trễ deadline nhưng vẫn muốn tiếp tục tham gia. Bạn xử lý thế nào?","type":"textarea","required":true},{"key":"conflict","label":"Khi quan điểm của bạn khác quyết định chung của tập thể, bạn xử lý thế nào?","type":"textarea","required":true}]},{"title":"Thời gian & cam kết","fields":[{"key":"availability","label":"Thời gian có thể dành cho SFN mỗi tuần","type":"select","required":true,"options":["2–4 giờ","4–6 giờ","6–8 giờ","Trên 8 giờ","Phụ thuộc từng tuần"]},{"key":"commit_12","label":"Tôi xác nhận định hướng đồng hành tối thiểu 12 tháng.","type":"checkbox","required":true},{"key":"notice_30","label":"Nếu thôi nhiệm vụ, tôi sẽ báo trước ít nhất 30 ngày và bàn giao, trừ trường hợp đặc biệt.","type":"checkbox","required":true},{"key":"terms","label":"Tôi đã đọc, hiểu và đồng ý với DK-01/2026/SFN.","type":"checkbox","required":true}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('volunteer','Đăng ký Tình nguyện viên Sky First Network','SFN-TNV','TNV phải từ đủ 18 tuổi. TNV dạy học được đánh giá theo phạm vi chuyên môn.','public',18,1,'skyfirst.ec@gmail.com',1,'{"id":"volunteer","name":"Đăng ký Tình nguyện viên Sky First Network","prefix":"SFN-TNV","description":"TNV phải từ đủ 18 tuổi. TNV dạy học được đánh giá theo phạm vi chuyên môn.","audience":"public","min_age":18,"term_codes":["DK-02/2026/SFN","PRIVACY/SFN"],"sections":[{"title":"Thông tin cá nhân","fields":[{"key":"full_name","label":"Họ và tên","type":"text","required":true},{"key":"dob","label":"Ngày sinh","type":"date","required":true},{"key":"city","label":"Tỉnh/Thành phố","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":true},{"key":"school","label":"Trường học/Đơn vị hiện tại","type":"text","required":false},{"key":"photo","label":"Ảnh thẻ/ảnh đại diện hồ sơ","type":"file","required":false,"accept":["image/png","image/jpeg"]}]},{"title":"Lĩnh vực tình nguyện","fields":[{"key":"volunteer_type","label":"Nhóm Tình nguyện viên","type":"select","required":true,"options":["TNV Dạy học","TNV Truyền thông","TNV Sự kiện","TNV Cộng đồng","TNV Hỗ trợ vận hành"]},{"key":"teaching_scope","label":"Nếu là TNV Dạy học, chọn chương trình mong muốn","type":"select","required":false,"condition":{"key":"volunteer_type","equals":"TNV Dạy học"},"options":["Lớp 9","Lớp 10","Lớp 11","Lớp 12","Tiếng Anh Cơ bản","Tiếng Anh Giao tiếp","IELTS"]},{"key":"qualification","label":"Trình độ/chứng chỉ/năng lực liên quan","type":"textarea","required":true},{"key":"experience","label":"Kinh nghiệm tình nguyện/giảng dạy","type":"textarea","required":true},{"key":"availability","label":"Khung thời gian có thể tham gia","type":"textarea","required":true}]},{"title":"Đánh giá ban đầu dành cho TNV Dạy học","condition":{"key":"volunteer_type","equals":"TNV Dạy học"},"fields":[{"key":"teaching_exp","label":"Bạn từng dạy/trợ giảng đối tượng nào?","type":"textarea","required":true},{"key":"lesson_prep","label":"Bạn thường chuẩn bị một buổi học như thế nào?","type":"textarea","required":true},{"key":"weak_student","label":"Nếu học viên không theo kịp bài, bạn xử lý thế nào?","type":"textarea","required":true},{"key":"minor_safety","label":"Bạn hiểu thế nào về việc bảo vệ người học chưa thành niên?","type":"textarea","required":true},{"key":"scope_confirm","label":"Tôi hiểu rằng được nhận làm TNV không đồng nghĩa được phép dạy mọi lớp; phạm vi phải được phê duyệt.","type":"checkbox","required":true}]},{"title":"Xác nhận","fields":[{"key":"terms","label":"Tôi đã đọc, hiểu và đồng ý với DK-02/2026/SFN.","type":"checkbox","required":true},{"key":"truth","label":"Tôi xác nhận thông tin cung cấp là trung thực.","type":"checkbox","required":true}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('class','Đăng ký lớp học SFEC','SFEC-LH','Đăng ký các lớp/chương trình thuộc The Sky First English Club.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"class","name":"Đăng ký lớp học SFEC","prefix":"SFEC-LH","description":"Đăng ký các lớp/chương trình thuộc The Sky First English Club.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Thông tin học viên","fields":[{"key":"full_name","label":"Họ và tên học viên","type":"text","required":true},{"key":"dob","label":"Ngày sinh","type":"date","required":true},{"key":"email","label":"Email liên hệ","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":true},{"key":"school","label":"Trường/Lớp hiện tại","type":"text","required":false}]},{"title":"Nhu cầu học tập","fields":[{"key":"course","label":"Lớp/Chương trình muốn đăng ký","type":"select","required":true,"options":["Lớp 9","Lớp 10","Lớp 11","Lớp 12","Tiếng Anh Cơ bản","Tiếng Anh Giao tiếp","IELTS"]},{"key":"current_level","label":"Trình độ hiện tại","type":"textarea","required":true},{"key":"goal","label":"Mục tiêu học tập","type":"textarea","required":true},{"key":"weakness","label":"Kỹ năng/mảng muốn cải thiện","type":"textarea","required":false},{"key":"schedule","label":"Khung thời gian có thể học","type":"textarea","required":true}]},{"title":"Xác nhận","fields":[{"key":"rules","label":"Tôi đồng ý tuân thủ quy định lớp học được công bố cho chương trình.","type":"checkbox","required":true},{"key":"privacy","label":"Tôi đã đọc Thông báo Quyền riêng tư SFN.","type":"checkbox","required":true}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('event','Đăng ký hoạt động/sự kiện','SFN-SK','Workshop, tọa đàm, hoạt động cộng đồng và sự kiện.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"event","name":"Đăng ký hoạt động/sự kiện","prefix":"SFN-SK","description":"Workshop, tọa đàm, hoạt động cộng đồng và sự kiện.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Thông tin đăng ký","fields":[{"key":"full_name","label":"Họ và tên","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":true},{"key":"event_name","label":"Tên hoạt động/sự kiện","type":"text","required":true},{"key":"support_need","label":"Nhu cầu hỗ trợ/Ghi chú","type":"textarea","required":false},{"key":"confirm","label":"Tôi xác nhận đăng ký tham gia.","type":"checkbox","required":true}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('partner','Đề xuất hợp tác & đồng hành','SFN-HT','Dành cho CLB, dự án, cộng đồng hoặc đơn vị muốn kết nối cùng SFN.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"partner","name":"Đề xuất hợp tác & đồng hành","prefix":"SFN-HT","description":"Dành cho CLB, dự án, cộng đồng hoặc đơn vị muốn kết nối cùng SFN.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Thông tin đơn vị","fields":[{"key":"org_name","label":"Tên đơn vị/nhóm","type":"text","required":true},{"key":"full_name","label":"Người liên hệ","type":"text","required":true},{"key":"position","label":"Chức vụ/Vai trò","type":"text","required":false},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":true}]},{"title":"Nội dung đề xuất","fields":[{"key":"field","label":"Lĩnh vực hợp tác","type":"textarea","required":true},{"key":"proposal","label":"Nội dung và mục tiêu hợp tác","type":"textarea","required":true},{"key":"role_scope","label":"Vai trò/phạm vi phối hợp dự kiến","type":"textarea","required":true},{"key":"timeline","label":"Thời gian dự kiến","type":"text","required":false},{"key":"attachment","label":"Tài liệu đề xuất","type":"file","required":false,"accept":["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('project','Đề xuất dự án & sáng kiến','SFN-DA','Gửi dự án, chương trình hoặc sáng kiến mới đến SFN.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"project","name":"Đề xuất dự án & sáng kiến","prefix":"SFN-DA","description":"Gửi dự án, chương trình hoặc sáng kiến mới đến SFN.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Người đề xuất","fields":[{"key":"full_name","label":"Họ và tên","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":false}]},{"title":"Nội dung dự án","fields":[{"key":"project_name","label":"Tên dự án/sáng kiến","type":"text","required":true},{"key":"field","label":"Lĩnh vực","type":"text","required":true},{"key":"goal","label":"Mục tiêu","type":"textarea","required":true},{"key":"audience","label":"Đối tượng hướng tới","type":"textarea","required":true},{"key":"plan","label":"Kế hoạch triển khai sơ bộ","type":"textarea","required":true},{"key":"people","label":"Nhân sự dự kiến","type":"textarea","required":false},{"key":"resources","label":"Nguồn lực dự kiến","type":"textarea","required":false},{"key":"expected","label":"Kết quả kỳ vọng","type":"textarea","required":true},{"key":"attachment","label":"Tài liệu mô tả","type":"file","required":false,"accept":["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('unit','Đề nghị trở thành đơn vị trực thuộc','SFN-DV','Dành cho CLB/dự án/nhóm hoạt động muốn được SFN xem xét.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"unit","name":"Đề nghị trở thành đơn vị trực thuộc","prefix":"SFN-DV","description":"Dành cho CLB/dự án/nhóm hoạt động muốn được SFN xem xét.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Thông tin đơn vị","fields":[{"key":"unit_name","label":"Tên đơn vị","type":"text","required":true},{"key":"unit_type","label":"Loại hình","type":"select","required":true,"options":["Câu lạc bộ","Dự án","Chương trình","Nhóm học thuật/chuyên môn","Khác"]},{"key":"full_name","label":"Người phụ trách","type":"text","required":true},{"key":"email","label":"Email liên hệ","type":"email","required":true},{"key":"channels","label":"Kênh truyền thông hiện có","type":"textarea","required":false}]},{"title":"Hoạt động & cơ cấu","fields":[{"key":"mission","label":"Mục tiêu và lĩnh vực hoạt động","type":"textarea","required":true},{"key":"structure","label":"Cơ cấu/nhân sự hiện tại","type":"textarea","required":true},{"key":"activities","label":"Hoạt động đã/đang triển khai","type":"textarea","required":true},{"key":"reason","label":"Lý do mong muốn trở thành đơn vị trực thuộc SFN","type":"textarea","required":true},{"key":"commit","label":"Tôi hiểu việc gửi đề nghị không đồng nghĩa tự động được công nhận trực thuộc.","type":"checkbox","required":true}]}]}');
INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json) VALUES('support','Hỗ trợ / Phản ánh / Góp ý','SFN-HTRO','Gửi yêu cầu hỗ trợ, phản ánh, góp ý, khiếu nại hoặc báo lỗi hệ thống.','public',NULL,1,'skyfirst.ec@gmail.com',1,'{"id":"support","name":"Hỗ trợ / Phản ánh / Góp ý","prefix":"SFN-HTRO","description":"Gửi yêu cầu hỗ trợ, phản ánh, góp ý, khiếu nại hoặc báo lỗi hệ thống.","audience":"public","min_age":null,"term_codes":["PRIVACY/SFN"],"sections":[{"title":"Thông tin liên hệ","fields":[{"key":"full_name","label":"Họ và tên","type":"text","required":true},{"key":"email","label":"Email nhận phản hồi","type":"email","required":true},{"key":"phone","label":"Số điện thoại/Zalo","type":"text","required":false}]},{"title":"Nội dung","fields":[{"key":"request_type","label":"Loại yêu cầu","type":"select","required":true,"options":["Hỗ trợ","Phản ánh","Góp ý","Khiếu nại","Báo lỗi hệ thống","Khác"]},{"key":"related","label":"Đơn vị/Mã hồ sơ liên quan","type":"text","required":false},{"key":"content","label":"Nội dung chi tiết","type":"textarea","required":true},{"key":"evidence","label":"Minh chứng","type":"file","required":false,"accept":["application/pdf","image/png","image/jpeg"]}]}]}');
INSERT OR IGNORE INTO units(code,name,unit_type,manager_name,email,status,data_json) VALUES('SFEC','The Sky First English Club','Câu lạc bộ giáo dục','Trịnh Thị Yến Nhi','sfec.vanphong@gmail.com','Đang hoạt động','{"has_classes":true,"has_volunteers":true}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-L9','SFEC','Tiếng Anh Lớp 9','Lớp 9','Đang mở đăng ký','{}','{}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-L10','SFEC','Tiếng Anh Lớp 10','Lớp 10','Chuẩn bị mở','{}','{}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-L11','SFEC','Tiếng Anh Lớp 11','Lớp 11','Chuẩn bị mở','{}','{}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-L12','SFEC','Tiếng Anh Lớp 12','Lớp 12','Đang mở đăng ký','{}','{}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-BASIC','SFEC','Tiếng Anh Cơ bản','Cơ bản','Chuẩn bị mở','{}','{}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-COMM','SFEC','Tiếng Anh Giao tiếp','Giao tiếp','Chuẩn bị mở','{}','{}');
INSERT OR IGNORE INTO classes(id,unit_code,title,level,status,schedule_json,data_json) VALUES('SFEC-IELTS','SFEC','IELTS','IELTS','Chuẩn bị mở','{}','{}');
INSERT OR IGNORE INTO news(id,title,slug,body,status,published_at) VALUES('NEWS-WELCOME','Chào mừng đến với Sky First Network','chao-mung-sfn','Cổng SFN hỗ trợ đăng ký, hồ sơ, lớp học, hoạt động, GCN/GXN và quản trị Mạng lưới.','published',CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO news(id,title,slug,body,status,published_at) VALUES('NEWS-CORE-2026','Tuyển Core Team giai đoạn lâm thời','tuyen-core-team-2026','SFN tuyển cuốn chiếu các vị trí thuộc Văn phòng, Ban Nhân sự, Ban Truyền thông và Ban Đối ngoại & Sự kiện.','published',CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES('submission_internal','[SFN] Hồ sơ mới {{code}} — {{form_name}}','<h2>{{form_name}}</h2><p><b>Mã hồ sơ:</b> {{code}}</p><p><b>Người gửi:</b> {{full_name}} — {{email}}</p>{{answers_table}}<p>Tệp đính kèm được lưu bảo mật trong hệ thống.</p>','{{form_name}}\nMã hồ sơ: {{code}}\nNgười gửi: {{full_name}} — {{email}}\n{{answers_text}}',1);
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES('submission_confirmation','Sky First đã tiếp nhận hồ sơ {{code}}','<p>Xin chào {{full_name}},</p><p>Sky First Network đã tiếp nhận hồ sơ của bạn.</p><p><b>Mã hồ sơ: {{code}}</b></p><p>Bạn có thể dùng mã hồ sơ và email để tra cứu trạng thái.</p>','Sky First Network đã tiếp nhận hồ sơ {{code}}.',1);
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES('account_invite','Tài khoản Sky First Network của bạn','<p>Xin chào {{full_name}},</p><p>SFN đã cấp tài khoản cho bạn.</p><p>Email: <b>{{email}}</b><br>Mật khẩu tạm thời: <b>{{temp_password}}</b></p><p>Hệ thống sẽ yêu cầu đổi mật khẩu khi đăng nhập lần đầu.</p>','SFN đã cấp tài khoản {{email}}. Mật khẩu tạm thời: {{temp_password}}',1);
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES('verify_email','Xác minh email Sky First Network','<p>Vui lòng xác minh email bằng liên kết sau:</p><p><a href=''{{link}}''>Xác minh email</a></p>','Xác minh email: {{link}}',1);
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES('password_reset','Đặt lại mật khẩu Sky First Network','<p>Bạn đã yêu cầu đặt lại mật khẩu.</p><p><a href=''{{link}}''>Đặt lại mật khẩu</a></p><p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>','Đặt lại mật khẩu: {{link}}',1);
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES('status_update','Cập nhật hồ sơ {{code}} — {{status}}','<p>Hồ sơ <b>{{code}}</b> đã được cập nhật trạng thái: <b>{{status}}</b>.</p>{{note_block}}','Hồ sơ {{code}}: {{status}}',1);
INSERT OR IGNORE INTO users(email,full_name,password_salt,password_hash,password_iterations,status,email_verified,must_change_password) VALUES('skyfirst.ec@gmail.com','Super Admin — Sky First Network','O1M7291qarCiAr9hV1Dmxg','SaXoVmJuXw44JqrKthTOGUg3KftxgfLVMHlpbeSR8gc',150000,'active',1,1);
INSERT OR IGNORE INTO user_roles(user_id,role_id,scope_unit_code,granted_by) SELECT id,'super_admin','',id FROM users WHERE email='skyfirst.ec@gmail.com';
INSERT OR IGNORE INTO meta(key,value) VALUES('schema_version','1');