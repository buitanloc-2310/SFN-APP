-- Migration 0015: make the Sky First logo accessible to email clients.
-- Gmail and some other clients block data: image URLs, so rewrite only the branded logo
-- to the public HTTPS asset. Outgoing email has the same runtime safeguard in src/email.js.
UPDATE email_templates
SET html_template =
  substr(
    html_template,
    1,
    instr(html_template, 'src="data:image/png;base64,') + length('src="') - 1
  )
  || 'https://app.skyfirst.io.vn/assets/sfn-logo-tight.png'
  || substr(
    html_template,
    instr(html_template, 'src="data:image/png;base64,') + length('src="')
      + instr(
          substr(
            html_template,
            instr(html_template, 'src="data:image/png;base64,') + length('src="')
          ),
          '"'
        ) - 1
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE instr(html_template, 'src="data:image/png;base64,') > 0
  AND instr(html_template, 'alt="Sky First — Education & Community Development"') > 0;
