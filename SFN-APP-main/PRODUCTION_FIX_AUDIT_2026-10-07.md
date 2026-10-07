# Production Fix Audit — 2026-10-07

## Scope
- Preserve existing Cloudflare Workers / D1 / R2 / Auth architecture.
- No database reset and no new migration is required by this patch.
- Fix the four reported production issues and harden adjacent failure paths.

## Fixed
1. Public/Admin backend failures now emit a request reference in server logs and 500 responses.
2. Credential lookup is schema-tolerant and searches both `certificates` and the V3 `issued_document_codes` registry when available. Legacy and current status labels are normalized.
3. Issued-code generation checks both the certificate table and V3 registry for collisions; issuing/revoking synchronizes the registry when that table exists.
4. Discovery cards no longer absolutely-position the number over the heading; responsive breakpoints use 4/2/1 columns.
5. Public V3 visual system was calmed: large cyan/violet gradients were replaced by neutral light surfaces / navy sections with restrained blue accents.
6. Admin sidebar navigation now uses explicit event listeners (`data-admin-route`) instead of depending on inline `onclick` for navigation.
7. Admin route promises are awaited so UI errors are caught and shown rather than becoming unhandled promise rejections.
8. Current role catalog is recognized (`owner`, `content_admin`, `certificate_manager`, `reviewer`, `case_manager`, `editor`). Owner has level 1000 and backend permissions.
9. Owner account rows are hidden from lower administrators in `/api/admin/users`; owner role cannot be granted from the ordinary account-creation/role-editing flow.
10. Certificate history/issue/revoke paths tolerate older certificate schemas instead of crashing on optional V3 columns.

## Runtime note
Static validation can verify syntax and internal source consistency, but real D1/R2/Auth behavior still requires a deployed or Worker-local environment with bindings. This patch intentionally does not touch the remote production database.
