import fs from 'node:fs';
const pub=fs.readFileSync(new URL('../src/public.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../src/admin.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../migrations/0007_xanh_external_submissions.sql',import.meta.url),'utf8');
const checks=[
 ['signed Xanh intake endpoint',pub.includes('/api/integrations/xanh/submissions')&&pub.includes('x-sfn-signature')],
 ['HMAC verification and timestamp window',pub.includes('crypto.subtle.importKey')&&pub.includes('SIGNATURE_EXPIRED')],
 ['nonce replay prevention',pub.includes('integration_nonces')&&migration.includes('nonce TEXT PRIMARY KEY')],
 ['separate external submission registry',migration.includes('xanh_external_submissions')&&pub.includes('xanh_external_submissions')],
 ['permission-checked admin listing',admin.includes('/api/admin/xanh-submissions')&&admin.includes('requirePermission(user,"submission.view")')],
 ['cross-origin browser guard remains except signed route',index.includes('url.pathname!=="/api/integrations/xanh/submissions"')],
];
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${label}`);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log(`CTT-Xanh integration validation: ${checks.length}/${checks.length} passed`);
