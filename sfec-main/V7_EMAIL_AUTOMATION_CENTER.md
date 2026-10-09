# SFEC — Email Automation Center (V7)

## What changed
- Shared email sender applies Times New Roman to HTML email content using inline-compatible embedded CSS, while preserving existing template layout.
- Admin Email area now shows provider readiness, allows one-recipient test sends, lists template/event enable switches, edits HTML/text/subject, shows detailed logs, and retries eligible failed/pending messages.
- Added email-status and email-test API routes and permission-guarded retry route. All use the existing `email.manage` permission and audit trail.
- Added additive D1 migration `0010_email_automation_center.sql`: retry payload column, templates for class enrollment, event registration, ticket updates, interview scheduling and system alerts, plus default sender/reply/alert settings.
- Sensitive account invitation messages are deliberately excluded from retry payload storage because the body may contain a temporary password.

## Existing source event inventory (confirmed in this source)
- Account invitation (`account_invite`) from admin account provisioning.
- Email verification (`verify_email`) and password reset (`password_reset`) through auth flows.
- Submission internal notification and confirmation, plus status update when admin changes submission status.
- New templates are now available for classes, events, tickets, interviews and system alerts, but the source must call those templates from the relevant event handlers before those categories send automatically. This is not claimed as complete event wiring.

## Required production setup
1. Review and apply migration 0010 to the intended D1 environment only after taking a backup.
2. Configure `RESEND_API_KEY` as a Worker secret and verify the sender domain, or configure the supported email binding.
3. Verify `MAIL_FROM` and recipient settings.
4. Log in with an account that has `email.manage`, use Email tự động → Gửi email thử.
5. Check provider logs and inbox/spam before enabling production sends.

## Safety
- No production deployment or production database migration was performed by this source edit.
- Existing backend, API, auth, database tables, and RBAC were not rewritten. The migration is additive.
- Retry payloads can include rendered content, so do not add secrets or unnecessary sensitive data to ordinary templates. Account invitation template is excluded from retry payload storage.
