# SFEC — Final Email Automation Handoff

## Scope
This source update expands the shared email automation center across the real event handlers identified in the source: account verification/reset/invitation, submission receipt/status changes, class enrollment, event registration, interview scheduling, support-ticket updates, account status and role updates, certificate request/status events, approval decisions, and privacy-request status changes. The new templates are inserted by migration 0011. Templates do not send by themselves: an event must call the shared sender.

All outgoing HTML email content is normalized to Times New Roman with Times/serif fallback. Admin routes use the existing `email.manage` permission and audit trail for email settings/templates/test/retry/log operations.

## Database install
- Preferred: deploy code, then use the existing Wrangler migration workflow so migration history stays consistent: `npm run db:migrate` (after checking the selected Cloudflare account and D1 database binding).
- Single SQL option: `SFEC_FINAL_EMAIL_INSTALL.sql` is for a database that has migrations 0001–0009 applied and migration 0010 not yet applied. Run it exactly once in the intended D1 database. It includes 0010 and 0011.
- If 0010 is already applied, do not run the combined SQL; apply only migration 0011 using Wrangler's migration workflow.
- Do not run on production until a D1 backup exists and the database binding/account has been verified.

## Provider setup
Set `RESEND_API_KEY` as a Cloudflare Worker secret (or configure the supported `EMAIL` binding), set `MAIL_FROM`, and verify the sender domain with the provider. Do not put API keys in source or SQL. `email_reply_to` and internal alert recipient settings are editable in the admin settings UI.

## Deploy
1. Review `wrangler.jsonc` and confirm the intended account/environment and D1 binding.
2. Back up D1.
3. Apply the appropriate migrations once.
4. Deploy the Worker source using the existing pipeline (`npm run deploy`) only after verifying credentials and environment.
5. Sign in as a role with `email.manage`; test email to a controlled mailbox, then verify provider response and inbox/spam.
6. Test every actual event and its recipient/template before enabling broad production use.

## Honest status
This archive is source + migration deliverable, not a production deployment. No production D1 migration, Worker deployment, DNS/provider verification, or real inbox delivery is claimed here. The migration and code still require environment-specific smoke tests. The single SQL file cannot deploy JavaScript routes or frontend code; both the database migration and Worker source deployment are required for the admin center and event hooks to run.
