import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const required=[
  'src/index.js','src/auth.js','src/public.js','src/admin.js','src/me.js','src/utils.js','src/email.js','src/permissions.js',
  'public/index.html','public/app.js','public/styles.css','public/sw.js','public/manifest.webmanifest',
  'migrations/0001_schema.sql','migrations/0002_seed.sql','wrangler.jsonc','FIRST_LOGIN_SUPER_ADMIN.txt'
];
let ok=true;
for(const f of required){if(!fs.existsSync(path.join(root,f))){console.error('MISSING',f);ok=false;}}
for(const f of [...fs.readdirSync(path.join(root,'src')).filter(x=>x.endsWith('.js')).map(x=>'src/'+x),'public/app.js','public/sw.js']){
  const r=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});
  if(r.status!==0){console.error('JS SYNTAX FAIL',f,r.stderr);ok=false;}
}
const publicText=['public/index.html','public/app.js','public/styles.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const bad of ['Enhanced V2','bản xem trước','mô phỏng Dashboard','test password']){
  if(publicText.toLowerCase().includes(bad.toLowerCase())){console.error('PUBLIC PREVIEW TEXT FOUND:',bad);ok=false;}
}
const first=fs.readFileSync(path.join(root,'FIRST_LOGIN_SUPER_ADMIN.txt'),'utf8');
if(publicText.includes(first.match(/Temporary password: (.+)/)?.[1]||'__never__')){console.error('TEMP PASSWORD LEAKED INTO PUBLIC');ok=false;}
const wr=fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
if(wr.includes('REPLACE_WITH_YOUR_D1_DATABASE_ID')) console.warn('NOTE: Điền D1 database_id trước khi deploy.');
if(ok){console.log('SFN Production Master validation: OK');process.exit(0)}
process.exit(1);
