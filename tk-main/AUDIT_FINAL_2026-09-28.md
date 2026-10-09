# Member Sky First Network — Final Audit 2026-09-28

- Fixed Calendar GET permission mismatch: calendar.view OR calendar.manage can read admin calendar.
- Create/delete calendar remains restricted to calendar.manage.
- Expanded admin navigation eligibility so operational permissions can enter the admin area instead of being hidden by an incomplete allow-list.
- Public/member-facing brand text standardized to Sky First Network; SFN remains only in technical/public codes such as SFN-MEMBER-REQ and existing member codes.
- Removed public Gmail contact references; support contact uses support@skyfirst.io.vn.
- Preserved D1 schema and existing identifiers; no destructive migration added.
- npm run check: PASS.
- scripts/verify_release.py: PASS.
