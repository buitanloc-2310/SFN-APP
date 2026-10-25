import {json, readJson, uid, sha256, sha256Hex, ipHash, escapeHtml, pbkdf2, newSalt, magicBytesOk, isSafeSvgText, csvEscape, NAPAS_BANKS, resolveNapasBank} from "./utils.js";
import {getAuthUser, requireAuth, requirePermission, createInvitedAccount} from "./auth.js";
import {hasPermission, hasAnyPermission, highestRoleLevel, roleLevel, canAccessScope} from "./permissions.js";
import {sendTemplatedEmail, renderEmailContent} from "./email.js";
import {resolveOperationalState} from "./index.js";

let runtimeSchemaHealed = false;
let lastUsedDbRef = null;

export async function ensureAdminRuntimeSchema(env, force = false) {
  if (!env?.DB) return;
  if (runtimeSchemaHealed && lastUsedDbRef === env.DB && !force) return;
  try {
    // 1. Ensure all core and V5..V14 tables exist if migrations were not run on production D1
    const createTableddls = [
      `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER,
        actor_email TEXT,
        action TEXT NOT NULL DEFAULT 'Thao tác quản trị',
        entity_type TEXT,
        entity_id TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        ip_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS counters (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS case_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_code TEXT NOT NULL,
        event_type TEXT NOT NULL DEFAULT 'status',
        public_label TEXT NOT NULL,
        public_note TEXT,
        status TEXT,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS upload_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        field_key TEXT,
        filename TEXT NOT NULL,
        mime TEXT,
        size INTEGER NOT NULL DEFAULT 0,
        client_sha256 TEXT,
        r2_key TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'created',
        submission_code TEXT,
        finalized_at TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS form_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        config_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS term_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term_code TEXT NOT NULL,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        change_note TEXT NOT NULL DEFAULT '',
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS issued_document_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        document_type TEXT NOT NULL DEFAULT 'GCN',
        lookup_code TEXT NOT NULL UNIQUE,
        random_digits TEXT,
        code_version TEXT NOT NULL DEFAULT 'v3',
        is_primary INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sponsorship_campaigns (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        website_id TEXT NOT NULL DEFAULT 'app',
        title TEXT NOT NULL,
        summary TEXT,
        purpose TEXT,
        target_amount INTEGER NOT NULL DEFAULT 0,
        pledged_amount INTEGER NOT NULL DEFAULT 0,
        received_amount INTEGER NOT NULL DEFAULT 0,
        disbursed_amount INTEGER NOT NULL DEFAULT 0,
        pending_amount INTEGER NOT NULL DEFAULT 0,
        refunded_amount INTEGER NOT NULL DEFAULT 0,
        adjusted_amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'VND',
        start_at TEXT,
        end_at TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        visibility TEXT NOT NULL DEFAULT 'internal',
        bank_name TEXT NOT NULL DEFAULT '',
        bank_bin TEXT NOT NULL DEFAULT '',
        bank_account_no TEXT NOT NULL DEFAULT '',
        bank_account_name TEXT NOT NULL DEFAULT '',
        approved_by INTEGER,
        approved_at TEXT,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sponsorship_transactions (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        tx_code TEXT NOT NULL UNIQUE,
        tx_type TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        expected_amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'VND',
        public_party_label TEXT NOT NULL,
        private_donor_info_json TEXT NOT NULL DEFAULT '{}',
        purpose TEXT,
        voucher_file_id TEXT,
        occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        verification_status TEXT NOT NULL DEFAULT 'pending',
        payment_state TEXT NOT NULL DEFAULT 'pending',
        is_public INTEGER NOT NULL DEFAULT 0,
        provider_tx_id TEXT,
        reference_code TEXT NOT NULL DEFAULT '',
        recipient_account TEXT NOT NULL DEFAULT '',
        reconciliation_note TEXT NOT NULL DEFAULT '',
        verified_by INTEGER,
        verified_at TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sponsorship_reports (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        title TEXT NOT NULL,
        report_period TEXT,
        file_id TEXT,
        summary TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        approved_by INTEGER,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sponsorship_payment_intents (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        reference_code TEXT NOT NULL UNIQUE,
        expected_amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'VND',
        donor_label TEXT NOT NULL DEFAULT 'Nhà tài trợ ẩn danh',
        donor_email TEXT NOT NULL DEFAULT '',
        purpose TEXT NOT NULL DEFAULT '',
        recipient_bank_bin TEXT NOT NULL DEFAULT '',
        recipient_account_no TEXT NOT NULL DEFAULT '',
        recipient_account_name TEXT NOT NULL DEFAULT '',
        qr_payload TEXT NOT NULL DEFAULT '',
        payment_state TEXT NOT NULL DEFAULT 'qr_generated',
        linked_tx_id TEXT,
        reported_at TEXT,
        webhook_received_at TEXT,
        verified_at TEXT,
        reconciled_at TEXT,
        expires_at TEXT,
        ip_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sponsorship_audit_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT,
        transaction_id TEXT,
        action TEXT NOT NULL,
        previous_state_json TEXT NOT NULL DEFAULT '{}',
        new_state_json TEXT NOT NULL DEFAULT '{}',
        reason TEXT NOT NULL DEFAULT '',
        actor_user_id INTEGER,
        actor_email TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS safety_reports (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'Trung bình',
        reporter_name TEXT,
        reporter_email TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_url TEXT,
        evidence_file_id TEXT,
        status TEXT NOT NULL DEFAULT 'Đã tiếp nhận',
        resolution_note TEXT,
        assigned_to INTEGER,
        ip_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS websites (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        description TEXT,
        logo_url TEXT DEFAULT '/assets/sfn-logo-tight.png',
        primary_color TEXT DEFAULT '#0759b8',
        navy_color TEXT DEFAULT '#071b35',
        status TEXT NOT NULL DEFAULT 'active',
        maintenance_mode TEXT NOT NULL DEFAULT 'normal',
        maintenance_title TEXT NOT NULL DEFAULT '',
        maintenance_message TEXT NOT NULL DEFAULT '',
        maintenance_eta TEXT,
        config_json TEXT NOT NULL DEFAULT '{}',
        theme_json TEXT NOT NULL DEFAULT '{}',
        seo_json TEXT NOT NULL DEFAULT '{}',
        i18n_json TEXT NOT NULL DEFAULT '{}',
        updated_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cms_pages (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL DEFAULT 'app',
        slug TEXT NOT NULL,
        page_type TEXT NOT NULL DEFAULT 'custom',
        route_path TEXT,
        locale TEXT NOT NULL DEFAULT 'vi',
        translation_group_id TEXT,
        title TEXT NOT NULL,
        title_en TEXT NOT NULL DEFAULT '',
        summary TEXT,
        summary_en TEXT NOT NULL DEFAULT '',
        cover_file_id TEXT,
        category TEXT DEFAULT 'general',
        tags_json TEXT NOT NULL DEFAULT '[]',
        seo_json TEXT NOT NULL DEFAULT '{}',
        seo_en_json TEXT NOT NULL DEFAULT '{}',
        blocks_json TEXT NOT NULL DEFAULT '[]',
        blocks_en_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        author_id INTEGER,
        submitted_by INTEGER,
        submitted_at TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        review_note TEXT,
        published_by INTEGER,
        published_at TEXT,
        scheduled_at TEXT,
        unpublished_at TEXT,
        wp_post_id INTEGER,
        wp_sync_meta_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(website_id, slug)
      )`,
      `CREATE TABLE IF NOT EXISTS cms_page_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        blocks_json TEXT NOT NULL DEFAULT '[]',
        seo_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        note TEXT,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cms_shared_blocks (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL DEFAULT 'app',
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        block_type TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cms_templates (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        description TEXT,
        blocks_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1,
        file_id TEXT NOT NULL,
        filename TEXT,
        mime TEXT,
        size INTEGER DEFAULT 0,
        sha256 TEXT,
        change_note TEXT,
        is_current INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS email_template_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_key TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        subject_template TEXT NOT NULL,
        html_template TEXT NOT NULL,
        text_template TEXT,
        updated_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS menus (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL DEFAULT 'app',
        location TEXT NOT NULL,
        name TEXT NOT NULL,
        items_json TEXT NOT NULL DEFAULT '[]',
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(website_id, location)
      )`,
      `CREATE TABLE IF NOT EXISTS system_incidents (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        website_id TEXT NOT NULL DEFAULT 'app',
        severity TEXT NOT NULL DEFAULT 'warning',
        category TEXT NOT NULL DEFAULT 'system',
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        resolution_note TEXT,
        created_by INTEGER,
        resolved_by INTEGER,
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS xanh_external_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'xanh-sky-first',
        external_code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        form_name TEXT,
        external_status TEXT NOT NULL DEFAULT 'Đã tiếp nhận',
        source_submitted_at TEXT,
        source_tracking_url TEXT,
        payload_hash TEXT,
        received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source, external_code)
      )`
    ];
    for (const ddl of createTableddls) {
      try { await env.DB.prepare(ddl).run(); } catch {}
    }

    // 2. Ensure all additive columns exist across existing tables
    const additiveColumns = {
      audit_log: [
        ["actor_user_id", "INTEGER"],
        ["actor_email", "TEXT"],
        ["action", "TEXT NOT NULL DEFAULT 'Thao tác quản trị'"],
        ["entity_type", "TEXT"],
        ["entity_id", "TEXT"],
        ["details_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["ip_hash", "TEXT"],
        ["created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"]
      ],
      settings: [
        ["updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
        ["updated_by", "INTEGER"]
      ],
      forms: [
        ["description", "TEXT"],
        ["audience", "TEXT NOT NULL DEFAULT 'public'"],
        ["min_age", "INTEGER"],
        ["enabled", "INTEGER NOT NULL DEFAULT 1"],
        ["recipient_email", "TEXT NOT NULL DEFAULT 'app@skyfirst.io.vn'"],
        ["version", "INTEGER NOT NULL DEFAULT 1"],
        ["config_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
        ["updated_by", "INTEGER"]
      ],
      terms: [
        ["scope", "TEXT"],
        ["status", "TEXT NOT NULL DEFAULT 'published'"],
        ["updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
        ["updated_by", "INTEGER"]
      ],
      submissions: [
        ["next_action", "TEXT"],
        ["result_summary", "TEXT"],
        ["public_meta_json", "TEXT NOT NULL DEFAULT '{}'"]
      ],
      files: [
        ["email_token", "TEXT"],
        ["sha256", "TEXT"],
        ["upload_state", "TEXT NOT NULL DEFAULT 'ready'"],
        ["replaced_by_file_id", "TEXT"],
        ["deleted_at", "TEXT"]
      ],
      certificates: [
        ["email", "TEXT NOT NULL DEFAULT ''"],
        ["phone", "TEXT NOT NULL DEFAULT ''"],
        ["public_id", "TEXT"],
        ["legacy_code", "TEXT"],
        ["supersedes_id", "TEXT"],
        ["superseded_by_id", "TEXT"],
        ["revoked_at", "TEXT"],
        ["revocation_reason", "TEXT"],
        ["immutable_snapshot_json", "TEXT"]
      ],
      backups: [
        ["sha256", "TEXT"],
        ["table_counts_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["kind", "TEXT NOT NULL DEFAULT 'manual'"],
        ["verified_at", "TEXT"]
      ],
      auth_tokens: [
        ["attempt_count", "INTEGER NOT NULL DEFAULT 0"]
      ],
      sponsorship_campaigns: [
        ["bank_name", "TEXT NOT NULL DEFAULT ''"],
        ["bank_bin", "TEXT NOT NULL DEFAULT '970422'"],
        ["bank_account_no", "TEXT NOT NULL DEFAULT ''"],
        ["bank_account_name", "TEXT NOT NULL DEFAULT 'SKY FIRST NETWORK'"],
        ["pending_amount", "INTEGER NOT NULL DEFAULT 0"],
        ["refunded_amount", "INTEGER NOT NULL DEFAULT 0"],
        ["adjusted_amount", "INTEGER NOT NULL DEFAULT 0"]
      ],
      sponsorship_transactions: [
        ["expected_amount", "INTEGER NOT NULL DEFAULT 0"],
        ["payment_state", "TEXT NOT NULL DEFAULT 'pending'"],
        ["provider_tx_id", "TEXT"],
        ["reference_code", "TEXT NOT NULL DEFAULT ''"],
        ["recipient_account", "TEXT NOT NULL DEFAULT ''"],
        ["reconciliation_note", "TEXT NOT NULL DEFAULT ''"],
        ["updated_by", "INTEGER"],
        ["updated_at", "TEXT"]
      ],
      websites: [
        ["maintenance_mode", "TEXT NOT NULL DEFAULT 'normal'"],
        ["maintenance_title", "TEXT NOT NULL DEFAULT ''"],
        ["maintenance_message", "TEXT NOT NULL DEFAULT ''"],
        ["maintenance_eta", "TEXT"],
        ["theme_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["seo_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["i18n_json", "TEXT NOT NULL DEFAULT '{}'"]
      ],
      cms_pages: [
        ["page_type", "TEXT NOT NULL DEFAULT 'custom'"],
        ["route_path", "TEXT"],
        ["locale", "TEXT NOT NULL DEFAULT 'vi'"],
        ["translation_group_id", "TEXT"],
        ["title_en", "TEXT NOT NULL DEFAULT ''"],
        ["summary_en", "TEXT NOT NULL DEFAULT ''"],
        ["blocks_en_json", "TEXT NOT NULL DEFAULT '[]'"],
        ["seo_en_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["scheduled_at", "TEXT"],
        ["unpublished_at", "TEXT"],
        ["wp_post_id", "INTEGER"],
        ["wp_sync_meta_json", "TEXT NOT NULL DEFAULT '{}'"]
      ]
    };

    for (const [tbl, colSpecs] of Object.entries(additiveColumns)) {
      let existingCols = new Set();
      try {
        const rs = await env.DB.prepare(`PRAGMA table_info(${tbl})`).all();
        existingCols = new Set((rs.results || []).map(x => String(x.name || "")));
      } catch {}
      if (!existingCols.size) continue;
      for (const [colName, colDef] of colSpecs) {
        if (!existingCols.has(colName)) {
          try {
            await env.DB.prepare(`ALTER TABLE ${tbl} ADD COLUMN ${colName} ${colDef}`).run();
          } catch {}
        }
      }
    }

    // 3. Ensure default website 'app' and core system pages exist in cms_pages so sys_programs / sys_forms / sys_credentials never 404 on unmigrated DBs
    try {
      await env.DB.prepare("INSERT OR IGNORE INTO websites(id,code,name,domain,description,status) VALUES('app','APP','Hệ thống Thông tin Số Sky First','app.skyfirst.io.vn','Hệ thống thông tin và dịch vụ số trung tâm Sky First','active')").run();
      const defaultSysPages = [
        ["sys_home", "system-home", "/", "Hệ thống Thông tin Số Sky First", "Sky First Digital Information System"],
        ["sys_about", "gioi-thieu", "/gioi-thieu", "Giới thiệu Hệ thống Thông tin Số Sky First", "About Sky First Digital Information System"],
        ["sys_programs", "system-programs", "/chuong-trinh", "Chương trình & Lớp học Cộng đồng", "Community Programs & Classes"],
        ["sys_events", "system-events", "/su-kien", "Sự kiện & Hoạt động", "Events & Activities"],
        ["sys_sponsorship", "system-sponsorship", "/tai-tro", "Minh bạch Tài trợ & Đối soát Tài chính", "Sponsorship Transparency & Financial Reconciliation"],
        ["sys_resources", "system-resources", "/tai-lieu", "Thư viện Tài liệu & Văn bản PDF", "Document & PDF Library"],
        ["sys_forms", "system-forms", "/bieu-mau", "Biểu mẫu Điện tử Trực tuyến", "Online Electronic Forms"],
        ["sys_cases", "system-cases", "/ho-so", "Tra cứu Tiến trình Hồ sơ", "Application Status Lookup"],
        ["sys_lookup", "system-lookup", "/tra-cuu", "Trung tâm Tra cứu & Xác thực Tập trung", "Central Verification & Lookup Hub"],
        ["sys_credentials", "system-credentials", "/gcn", "Xác thực Chứng nhận, Xác nhận & Bằng khen", "Credential Verification (GCN / GXN / BK)"],
        ["sys_safety", "system-safety", "/an-toan", "An toàn Thông tin & Báo cáo Sự cố Số", "Digital Safety & Incident Reporting"],
        ["sys_support", "ho-tro", "/ho-tro", "Trung tâm Hỗ trợ & Liên hệ Công tác", "Support & Official Contact Center"],
        ["sys_login", "system-admin-login", "/admin/login", "Đăng nhập Cổng Quản trị Hệ thống", "System Administration Portal Sign In"]
      ];
      for (const [id, slug, routePath, titleVi, titleEn] of defaultSysPages) {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO cms_pages(id,website_id,slug,page_type,route_path,title,title_en,status,version,blocks_json,blocks_en_json,seo_json,seo_en_json) VALUES(?,'app',?,'system',?,?,?,'published',1,'[]','[]','{}','{}')"
        ).bind(id, slug, routePath, titleVi, titleEn).run();
      }
    } catch {}

    adminSchemaCache.clear();
    runtimeSchemaHealed = true;
    lastUsedDbRef = env.DB;
  } catch (err) {
    console.warn("ENSURE_ADMIN_RUNTIME_SCHEMA_WARN", err);
  }
}

async function audit(env,request,user,action,entityType="",entityId="",details={}){
  // Fault-tolerant audit writer: auto-heals audit_log if needed and NEVER crashes Admin mutations with 500
  try{
    if(!env?.DB) return;
    let cols=await adminTableColumns(env,"audit_log");
    if(!cols.has("action")){
      adminSchemaCache.delete("cols:audit_log");
      adminSchemaCache.delete("table:audit_log");
      await ensureAdminRuntimeSchema(env, true);
      cols=await adminTableColumns(env,"audit_log");
    }
    const validActorId=await resolveValidUserId(env,user?.id);
    const values={
      actor_user_id:validActorId,
      actor_email:String(user?.email||""),
      action:String(action||"Thao tác quản trị"),
      entity_type:String(entityType||""),
      entity_id:String(entityId||""),
      details_json:JSON.stringify(details??{}),
      ip_hash:await ipHash(request)
    };
    const fields=Object.keys(values).filter(key=>cols.has(key));
    if(!fields.length) return;
    const placeholders=fields.map(()=>"?").join(",");
    await env.DB.prepare(`INSERT INTO audit_log(${fields.join(",")}) VALUES(${placeholders})`)
      .bind(...fields.map(key=>values[key])).run();
  }catch(err){
    console.warn("ADMIN_AUDIT_NON_FATAL_WARN",String(err?.message||err));
  }
}
async function setting(env,key,fallback=null){
  const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
  if(!r) return fallback; try{return JSON.parse(r.value_json)}catch{return r.value_json}
}
const adminSchemaCache=new Map();
async function adminTableColumns(env,table){
  const key=`cols:${table}`;if(adminSchemaCache.has(key))return adminSchemaCache.get(key);
  try{const rs=await env.DB.prepare(`PRAGMA table_info(${table})`).all();const cols=new Set((rs.results||[]).map(x=>String(x.name||"")));adminSchemaCache.set(key,cols);return cols}catch{return new Set()}
}
async function adminTableExists(env,table){
  const key=`table:${table}`;if(adminSchemaCache.has(key))return adminSchemaCache.get(key);
  try{const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();const ok=!!row;adminSchemaCache.set(key,ok);return ok}catch{return false}
}

async function adminSchemaDiagnostics(env){
  const required={
    audit_log:["action","details_json"],
    settings:["key","value_json"],
    users:["id","email","status"],
    forms:["id","name","enabled"],
    certificates:["id","cert_type","full_name","email","phone","content","status"],
    certificate_history:["certificate_id","action"],
    approvals:["id","entity_type","entity_id","status"],
    files:["id","r2_key","visibility","deleted_at"],
    documents:["id","code","title","status"],
    cms_pages:["id","website_id","slug","title","status"],
    websites:["id","code","domain","status"],
    term_revisions:["term_code","version","body"],
    issued_document_codes:["document_id","lookup_code","is_active"],
    sponsorship_payment_intents:["id","campaign_id","reference_code","expected_amount","payment_state"]
  };
  const checks=[];
  for(const [table,expected] of Object.entries(required)){
    const exists=await adminTableExists(env,table);
    if(!exists){checks.push({table,ok:false,missing_table:true,missing_columns:expected});continue;}
    const cols=await adminTableColumns(env,table);
    const missing=expected.filter(col=>!cols.has(col));
    checks.push({table,ok:missing.length===0,missing_table:false,missing_columns:missing});
  }
  return {ok:checks.every(x=>x.ok),checked_at:new Date().toISOString(),checks};
}
function isOwnerUser(user){return (user?.roles||[]).some(r=>r.role_id==="owner")}
async function nextCounter(env,key){
  await env.DB.prepare("INSERT OR IGNORE INTO counters(key,value) VALUES(?,0)").bind(key).run();
  const r=await env.DB.prepare("UPDATE counters SET value=value+1 WHERE key=? RETURNING value").bind(key).first();
  return Number(r?.value||1);
}

export async function runScheduledCmsPublishing(env){
  if(!env?.DB || !(await adminTableExists(env,"cms_pages"))) return {published:0,unpublished:0};
  const cols=await adminTableColumns(env,"cms_pages");
  if(!cols.has("scheduled_at")) return {published:0,unpublished:0};
  let published=0,unpublished=0;
  try{
    const pubRes=await env.DB.prepare("UPDATE cms_pages SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE status='scheduled' AND scheduled_at IS NOT NULL AND datetime(scheduled_at)<=datetime('now')").run();
    published=Number(pubRes?.meta?.changes||0);
  }catch{}
  if(cols.has("unpublished_at")){
    try{
      const unpubRes=await env.DB.prepare("UPDATE cms_pages SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE status='published' AND unpublished_at IS NOT NULL AND datetime(unpublished_at)<=datetime('now')").run();
      unpublished=Number(unpubRes?.meta?.changes||0);
    }catch{}
  }
  return {published,unpublished};
}

function sanitizeGutenbergHtmlToText(html=""){
  return String(html||"")
    .replace(/<script[\s\S]*?<\/script>/gi,"")
    .replace(/<style[\s\S]*?<\/style>/gi,"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/p>/gi,"\n")
    .replace(/<[^>]+>/g,"")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/&quot;/g,'"')
    .trim();
}

export function convertWordPressToSkyFirstBlocks(wpInput){
  const blocks=[];
  let idx=1;
  const nextId=()=>`wpb_${idx++}`;
  if(Array.isArray(wpInput?.blocks)){
    for(const b of wpInput.blocks){
      const bName=String(b.blockName||b.type||"paragraph").replace(/^core\//,"");
      const attrs=b.attrs||{};
      const text=sanitizeGutenbergHtmlToText(b.innerHTML||b.text||b.content||"");
      if(bName==="heading"){
        blocks.push({id:nextId(),type:"heading",level:`h${attrs.level||2}`,text:text||attrs.content||"Tiêu đề"});
      }else if(bName==="image"){
        blocks.push({id:nextId(),type:"image",url:String(attrs.url||b.url||""),alt:String(attrs.alt||b.alt||""),caption:String(attrs.caption||text||"")});
      }else if(bName==="quote"||bName==="pullquote"||bName==="callout"){
        blocks.push({id:nextId(),type:"callout",tone:attrs.tone||"info",title:String(attrs.title||"Trích dẫn / Lưu ý"),text});
      }else if(bName==="columns" && Array.isArray(b.innerBlocks||b.columns)){
        const cols=(b.innerBlocks||b.columns).map((col,cIdx)=>({
          title:String(col.title||`Cột ${cIdx+1}`),
          body:sanitizeGutenbergHtmlToText(col.innerHTML||col.body||col.text||"")
        }));
        blocks.push({id:nextId(),type:"columns",columns:cols});
      }else if(bName==="table"){
        blocks.push({id:nextId(),type:"table",title:String(attrs.title||"Bảng dữ liệu"),headers:Array.isArray(b.headers)?b.headers:["Cột 1","Cột 2"],rows:Array.isArray(b.rows)?b.rows:[]});
      }else if(bName==="buttons"||bName==="button"||bName==="cta"){
        blocks.push({id:nextId(),type:"cta",title:String(attrs.title||text||"Hành động"),text:String(attrs.text||""),ctaText:String(attrs.ctaText||text||"Xem chi tiết"),ctaHref:String(attrs.url||attrs.ctaHref||"/")});
      }else if(text){
        blocks.push({id:nextId(),type:"paragraph",text});
      }
    }
    return blocks;
  }
  const rawContent=String(wpInput?.content?.rendered||wpInput?.content||wpInput?.raw_html||"");
  if(!rawContent.trim()) return blocks;
  const commentRegex=/<!--\s*wp:([a-z0-9/-]+)(?:\s+(\{[\s\S]*?\}))?\s*-->([\s\S]*?)<!--\s*\/wp:\1\s*-->/gi;
  let match;
  let matchedAny=false;
  while((match=commentRegex.exec(rawContent))!==null){
    matchedAny=true;
    const bType=match[1].replace(/^core\//,"");
    let attrs={}; try{if(match[2]) attrs=JSON.parse(match[2]);}catch{}
    const inner=match[3]||"";
    const text=sanitizeGutenbergHtmlToText(inner);
    if(bType==="heading"){
      blocks.push({id:nextId(),type:"heading",level:`h${attrs.level||2}`,text:text||"Tiêu đề"});
    }else if(bType==="quote"){
      blocks.push({id:nextId(),type:"callout",tone:"info",title:attrs.citation||"Ghi chú",text});
    }else if(bType==="image"){
      const imgMatch=inner.match(/src=["']([^"']+)["']/i);
      const altMatch=inner.match(/alt=["']([^"']*)["']/i);
      blocks.push({id:nextId(),type:"image",url:attrs.url||(imgMatch?imgMatch[1]:""),alt:altMatch?altMatch[1]:"",caption:text});
    }else if(text){
      blocks.push({id:nextId(),type:"paragraph",text});
    }
  }
  if(!matchedAny){
    const paragraphs=rawContent.split(/<\/p>|\n\n+/i).map(sanitizeGutenbergHtmlToText).filter(Boolean);
    for(const pText of paragraphs){
      blocks.push({id:nextId(),type:"paragraph",text:pText});
    }
  }
  return blocks;
}

export function exportSkyFirstBlocksToGutenberg(page){
  let blocks=[]; try{blocks=typeof page.blocks==="string"?JSON.parse(page.blocks):page.blocks||JSON.parse(page.blocks_json||"[]");}catch{}
  const wpBlocks=blocks.map(b=>{
    if(b.type==="heading"){
      const lvl=Number(String(b.level||"h2").replace(/\D/g,""))||2;
      return `<!-- wp:heading {"level":${lvl}} -->\n<h${lvl}>${escapeHtml(b.text||b.title||"")}</h${lvl}>\n<!-- /wp:heading -->`;
    }
    if(b.type==="hero"){
      return `<!-- wp:cover {"customOverlayColor":"#071b35"} -->\n<div class="wp-block-cover"><h1>${escapeHtml(b.title||"")}</h1><p>${escapeHtml(b.subtitle||"")}</p></div>\n<!-- /wp:cover -->`;
    }
    if(b.type==="callout"){
      return `<!-- wp:quote -->\n<blockquote class="wp-block-quote"><strong>${escapeHtml(b.title||"")}</strong><p>${escapeHtml(b.text||"")}</p></blockquote>\n<!-- /wp:quote -->`;
    }
    if(b.type==="image"){
      return `<!-- wp:image {"url":"${escapeHtml(b.url||"")}"} -->\n<figure class="wp-block-image"><img src="${escapeHtml(b.url||"")}" alt="${escapeHtml(b.alt||"")}"/><figcaption>${escapeHtml(b.caption||"")}</figcaption></figure>\n<!-- /wp:image -->`;
    }
    return `<!-- wp:paragraph -->\n<p>${escapeHtml(b.text||b.title||"")}</p>\n<!-- /wp:paragraph -->`;
  });
  return {
    schema:"skyfirst-wp-gutenberg-v1",
    id:page.id,
    website_id:page.website_id||"app",
    slug:page.slug,
    title:{rendered:page.title,en:page.title_en||""},
    excerpt:{rendered:page.summary||"",en:page.summary_en||""},
    status:page.status,
    gutenberg_content:wpBlocks.join("\n\n"),
    structured_blocks:blocks
  };
}

export function credentialKind(certType="", customPrefix=""){
  const explicit=String(customPrefix||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(explicit.length>=2&&explicit.length<=8) return explicit;
  const raw=String(certType||"").trim();
  const upper=raw.toUpperCase();
  if(/^[A-Z0-9]{2,8}$/.test(upper)) return upper;
  const t=raw.toLowerCase();
  if(t.includes("bằng khen")||t.includes("bang khen")||t==="bk") return "BK";
  if(t.includes("xác nhận")||t.includes("xac nhan")||t==="gxn") return "GXN";
  if(t.includes("chứng nhận")||t.includes("chung nhan")||t==="gcn") return "GCN";
  if(t.includes("quyết định")||t.includes("quyet dinh")||t==="qd") return "QD";
  if(t.includes("chứng chỉ")||t.includes("chung chi")||t==="cc") return "CC";
  if(t.includes("thư khen")||t.includes("thu khen")||t==="tk") return "TK";
  if(t.includes("thư cảm ơn")||t.includes("thu cam on")||t==="tco") return "TCO";
  if(t.includes("công nhận")||t.includes("cong nhan")||t==="cn") return "CN";
  const words=raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^A-Za-z0-9\s]/g," ").trim().split(/\s+/).filter(Boolean);
  if(words.length>=2){
    const initials=words.map(w=>w[0].toUpperCase()).join("").slice(0,6);
    if(initials.length>=2) return initials;
  }
  if(words.length===1 && words[0].length>=2) return words[0].toUpperCase().slice(0,6);
  return "GCN";
}

async function generateCredentialCode(env,certType,customPrefix=""){
  const kind=credentialKind(certType,customPrefix),cols=await adminTableColumns(env,"certificates");
  const identifiers=["code","public_id","legacy_code"].filter(x=>cols.has(x));
  const hasRegistry=await adminTableExists(env,"issued_document_codes");
  for(let attempt=0;attempt<64;attempt++){
    const bytes=new Uint32Array(1); crypto.getRandomValues(bytes);
    const n=10000000+(bytes[0]%90000000),code=`SFN-${kind}-${n}`;
    let exists=null;
    if(identifiers.length){
      const where=identifiers.map(x=>`${x}=?`).join(" OR ");
      exists=await env.DB.prepare(`SELECT id FROM certificates WHERE ${where} LIMIT 1`).bind(...identifiers.map(()=>code)).first();
    }
    if(!exists&&hasRegistry){exists=await env.DB.prepare("SELECT document_id id FROM issued_document_codes WHERE lookup_code=? LIMIT 1").bind(code).first()}
    if(!exists) return code;
  }
  throw new Error("CREDENTIAL_ID_COLLISION_RETRY_EXHAUSTED");
}
function parseBodyJson(row,key,fallback={}){
  try{
    const val=row?.[key];
    if(val===undefined||val===null||val==="") return fallback;
    return typeof val==="string"?JSON.parse(val):val;
  }catch{return fallback}
}
async function resolveValidUserId(env,userId){
  if(!userId||!env?.DB) return null;
  try{
    const u=await env.DB.prepare("SELECT id FROM users WHERE id=? LIMIT 1").bind(userId).first();
    return u?u.id:null;
  }catch{return null;}
}
async function notifyUser(env,userId,title,body,type="",link=""){
  if(!userId) return;
  await env.DB.prepare("INSERT INTO notifications(id,user_id,title,body,notif_type,link) VALUES(?,?,?,?,?,?)")
    .bind(uid("notif"),userId,title,body,type,link).run();
}
async function userByEmail(env,email){
  return env.DB.prepare("SELECT id,email,full_name FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
}
async function ensureRoleGrantAllowed(actor,roleId){
  if(roleId==="owner") return false;
  if(isOwnerUser(actor)) return true;
  if((actor.roles||[]).some(r=>r.role_id==="super_admin")) return roleId!=="owner";
  return roleLevel(roleId)<highestRoleLevel(actor) && !["owner","super_admin"].includes(roleId);
}
async function listUserRoles(env,userId){
  const rs=await env.DB.prepare("SELECT role_id,scope_unit_code,granted_at,expires_at FROM user_roles WHERE user_id=?").bind(userId).all();
  return rs.results||[];
}

const PUBLIC_CACHE_PATH={news:"/api/public/news",classes:"/api/public/classes",events:"/api/public/events",units:"/api/public/units",documents:"/api/public/resources",sponsorship:"/api/public/sponsorship",pages:"/api/public/pages"};
function invalidatePublicCache(url,paths,ctx){
  try{
    if(typeof caches==="undefined" || !caches?.default?.delete) return;
    const unique=[...new Set((paths||[]).filter(Boolean))];if(!unique.length)return;
    const work=Promise.allSettled(unique.map(path=>{
      try{return caches.default.delete(new Request(new URL(path,url.origin),{method:"GET"}));}
      catch{return Promise.resolve(false);}
    }));
    if(ctx?.waitUntil)ctx.waitUntil(work);else return work;
  }catch{}
}

const GENERIC = {
  news:{
    permission:"news.manage",table:"news",id:"id",
    fields:["title","slug","body","status","published_at","tags_json","cover_file_id"],
    defaults:{status:"published",tags_json:"[]"}
  },
  classes:{
    permission:"class.manage",table:"classes",id:"id",
    fields:["unit_code","title","level","status","schedule_json","capacity","data_json"],
    defaults:{unit_code:"SFEC",status:"Đang mở đăng ký",schedule_json:"{}",data_json:"{}"}
  },
  events:{
    permission:"event.manage",table:"events",id:"id",
    fields:["unit_code","title","start_at","end_at","status","capacity","data_json"],
    defaults:{unit_code:"SFN",status:"Sắp diễn ra",data_json:"{}"}
  },
  units:{
    permission:"unit.manage",table:"units",id:"code",
    fields:["name","unit_type","manager_name","email","status","data_json"],
    defaults:{status:"Đang hoạt động",data_json:"{}"}
  },
  documents:{
    permission:"document.manage",table:"documents",id:"id",
    fields:["code","doc_type","title","visibility","status","file_id","issued_at","metadata_json"],
    defaults:{visibility:"internal",status:"Có hiệu lực",metadata_json:"{}"}
  },
  tasks:{
    permission:"task.manage",table:"tasks",id:"id",
    fields:["title","description","assigned_to","unit_code","status","priority","due_at"],
    defaults:{status:"Cần làm",priority:"Bình thường"}
  }
};

async function makeInsert(env,table,idField,idValue,fields,data){
  const liveCols=await adminTableColumns(env,table);
  const cols=[idField],vals=[idValue],qs=["?"];
  for(const f of fields){
    if(liveCols.size && !liveCols.has(f)) continue;
    cols.push(f);vals.push(data[f]??null);qs.push("?");
  }
  return {sql:`INSERT INTO ${table}(${cols.join(",")}) VALUES(${qs.join(",")})`,vals};
}
async function makeUpdate(env,table,idField,idValue,fields,data){
  const liveCols=await adminTableColumns(env,table);
  const sets=[],vals=[];
  for(const f of fields){
    if(liveCols.size && !liveCols.has(f)) continue;
    if(f in data){sets.push(`${f}=?`);vals.push(data[f]);}
  }
  if(!sets.length) return null;
  vals.push(idValue);
  const hasUpdatedAt=!liveCols.size||liveCols.has("updated_at");
  return {sql:`UPDATE ${table} SET ${sets.join(",")}${hasUpdatedAt&&["news","classes","events","units","documents","tasks"].includes(table)?",updated_at=CURRENT_TIMESTAMP":""} WHERE ${idField}=?`,vals};
}
async function upsertSettingRow(env,key,valObj,userId=null){
  const jsonStr=typeof valObj==="string"?valObj:JSON.stringify(valObj);
  const sCols=await adminTableColumns(env,"settings");
  const validUid=await resolveValidUserId(env,userId);
  if(sCols.has("updated_by")&&sCols.has("updated_at")){
    await env.DB.prepare("INSERT INTO settings(key,value_json,updated_by) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by")
      .bind(key,jsonStr,validUid).run();
  }else if(sCols.has("updated_at")){
    await env.DB.prepare("INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP")
      .bind(key,jsonStr).run();
  }else{
    await env.DB.prepare("INSERT OR REPLACE INTO settings(key,value_json) VALUES(?,?)")
      .bind(key,jsonStr).run();
  }
}

// Danh sách bảng theo thứ tự phụ thuộc cha -> con (Topological Order) phục vụ sao lưu và phục hồi nguyên tử
export const BACKUP_TABLES=[
  "roles","users","user_roles","settings","modules","terms","forms","form_revisions","counters",
  "units","unit_members","people","people_history","teaching_scopes",
  "submissions","files","case_events","internal_requests",
  "classes","class_enrollments","attendance","events","event_registrations",
  "news","documents","document_versions","certificates","certificate_history","issued_document_codes",
  "approvals","interviews","evaluations","tickets","ticket_messages","notifications",
  "email_templates","email_template_versions","tasks","data_requests",
  "sponsorship_campaigns","sponsorship_payment_intents","sponsorship_transactions","sponsorship_reports","sponsorship_audit_trail",
  "safety_reports","websites","menus","cms_pages","cms_page_revisions","cms_shared_blocks","cms_templates","system_incidents","xanh_external_submissions"
];

export async function buildBackupSnapshot(env,kind="manual",actorId=null){
  const snapshot={
    schema_version:"skyfirst-enterprise-2026",
    kind,
    created_at:new Date().toISOString(),
    table_counts:{},
    tables:{}
  };
  for(const t of BACKUP_TABLES){
    if(!(await adminTableExists(env,t))) continue;
    const rs=await env.DB.prepare(`SELECT * FROM ${t}`).all();
    let rows=rs.results||[];
    if(t==="users"){
      rows=rows.map(u=>({...u,password_hash:"[REDACTED_SECRET]",password_salt:"[REDACTED_SECRET]",totp_secret:null}));
    }
    snapshot.tables[t]=rows;
    snapshot.table_counts[t]=rows.length;
  }
  const raw=JSON.stringify(snapshot);
  const checksum=await sha256Hex(raw);
  const size=new TextEncoder().encode(raw).length;
  const idB=uid("backup");
  const prefix=kind==="cron"?"backups/cron":kind==="pre_restore"?"backups/pre-restore":"backups";
  const key=`${prefix}/${new Date().toISOString().slice(0,10)}/${idB}.json`;
  if(env.FILES){
    await env.FILES.put(key,raw,{httpMetadata:{contentType:"application/json"},customMetadata:{sha256:checksum,kind}});
  }
  const bCols=await adminTableColumns(env,"backups");
  if(bCols.has("sha256")&&bCols.has("table_counts_json")){
    await env.DB.prepare("INSERT INTO backups(id,r2_key,size,sha256,table_counts_json,kind,created_by,verified_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .bind(idB,key,size,checksum,JSON.stringify(snapshot.table_counts),kind,actorId).run();
  }else{
    await env.DB.prepare("INSERT INTO backups(id,r2_key,size,created_by) VALUES(?,?,?,?)")
      .bind(idB,key,size,actorId).run();
  }
  return {id:idB,r2_key:key,size,sha256:checksum,table_counts:snapshot.table_counts};
}

export async function recalculateCampaignTotals(env,campaignId){
  const [verRows,pendRows]=await env.DB.batch([
    env.DB.prepare("SELECT tx_type, COALESCE(SUM(amount),0) AS total FROM sponsorship_transactions WHERE campaign_id=? AND verification_status='verified' GROUP BY tx_type").bind(campaignId),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM sponsorship_transactions WHERE campaign_id=? AND verification_status='pending' AND tx_type IN ('receipt','pledge')").bind(campaignId)
  ]);
  let pledged=0,receipts=0,disbursed=0,refunded=0,adjusted=0;
  for(const r of verRows.results||[]){
    const amt=Number(r.total||0);
    if(r.tx_type==="pledge") pledged+=amt;
    else if(r.tx_type==="receipt") receipts+=amt;
    else if(r.tx_type==="disbursement") disbursed+=amt;
    else if(r.tx_type==="refund") refunded+=amt;
    else if(r.tx_type==="adjustment") adjusted+=amt;
  }
  // Không bao giờ ép số dư âm về 0 — phản ánh trung thực thực nhận và số dư thực tế
  const received=receipts-refunded+adjusted;
  const remaining=received-disbursed;
  const pending=Number(pendRows.results?.[0]?.total||0);
  const campCols=await adminTableColumns(env,"sponsorship_campaigns");
  if(campCols.has("pending_amount")&&campCols.has("refunded_amount")&&campCols.has("adjusted_amount")){
    await env.DB.prepare("UPDATE sponsorship_campaigns SET pledged_amount=?,received_amount=?,disbursed_amount=?,pending_amount=?,refunded_amount=?,adjusted_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(pledged,received,disbursed,pending,refunded,adjusted,campaignId).run();
  }else{
    await env.DB.prepare("UPDATE sponsorship_campaigns SET pledged_amount=?,received_amount=?,disbursed_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(pledged,received,disbursed,campaignId).run();
  }
  return {pledged,received,disbursed,pending,refunded,adjusted,remaining,is_overspent:remaining<0};
}

async function recordSponsorshipAudit(env,{campaign_id=null,transaction_id=null,action,reason="",previous_state=null,new_state=null,actor_user_id=null,actor_email=""}){
  if(!(await adminTableExists(env,"sponsorship_audit_trail"))) return;
  try{
    await env.DB.prepare("INSERT INTO sponsorship_audit_trail(campaign_id,transaction_id,action,previous_state_json,new_state_json,reason,actor_user_id,actor_email) VALUES(?,?,?,?,?,?,?,?)")
      .bind(campaign_id,transaction_id,action,previous_state?JSON.stringify(previous_state):"{}",new_state?JSON.stringify(new_state):"{}",String(reason||""),actor_user_id,actor_email||"").run();
  }catch{}
}

async function findPagesUsingSharedBlock(env, sharedKey, sharedId) {
  if (!(await adminTableExists(env, "cms_pages"))) return [];
  const kLike = `%${sharedKey}%`;
  const idLike = `%${sharedId}%`;
  const cols = await adminTableColumns(env, "cms_pages");
  const sql = cols.has("blocks_en_json")
    ? "SELECT id, website_id, slug, title, status FROM cms_pages WHERE blocks_json LIKE ? OR blocks_json LIKE ? OR blocks_en_json LIKE ? OR blocks_en_json LIKE ?"
    : "SELECT id, website_id, slug, title, status FROM cms_pages WHERE blocks_json LIKE ? OR blocks_json LIKE ?";
  const binds = cols.has("blocks_en_json") ? [kLike, idLike, kLike, idLike] : [kLike, idLike];
  const rs = await env.DB.prepare(sql).bind(...binds).all();
  return rs.results || [];
}

export async function adminRoute(request,env,url,ctx){
  if(!url.pathname.startsWith("/api/admin/")) return null;
  await ensureAdminRuntimeSchema(env);
  const user=await getAuthUser(request,env);
  const authDeny=requireAuth(user);
  if(authDeny) return authDeny;
  const p=url.pathname;

  if(p==="/api/admin/dashboard"&&request.method==="GET"){
    const deny=requirePermission(user,"dashboard.view");if(deny)return deny;
    const safeCount=async(sql)=>{try{const r=await env.DB.prepare(sql).first();return {results:[{c:Number(r?.c||0)}]};}catch{return {results:[{c:0}]};}};
    const safeAll=async(sql)=>{try{const r=await env.DB.prepare(sql).all();return {results:r.results||[]};}catch{return {results:[]};}};
    const [subs,pending,approvedSubs,rejectedSubs,formsCount,people,certs,revokedCerts,supersededCerts,docsCount,pubDocsCount,tickets,approvals,tasks,emailStats,recentAudit,timeSeries]=await Promise.all([
      safeCount("SELECT COUNT(*) c FROM submissions"),
      safeCount("SELECT COUNT(*) c FROM submissions WHERE status IN ('Đã tiếp nhận','Đang xem xét','Cần bổ sung','Mời phỏng vấn','Đang đánh giá')"),
      safeCount("SELECT COUNT(*) c FROM submissions WHERE status IN ('Đã duyệt','Hoàn tất','Đã hoàn tất')"),
      safeCount("SELECT COUNT(*) c FROM submissions WHERE status IN ('Không phù hợp','Từ chối','Đã lưu trữ')"),
      safeCount("SELECT COUNT(*) c FROM forms WHERE enabled=1"),
      safeCount("SELECT COUNT(*) c FROM people WHERE status='Đang hoạt động'"),
      safeCount("SELECT COUNT(*) c FROM certificates WHERE status='issued'"),
      safeCount("SELECT COUNT(*) c FROM certificates WHERE status='revoked'"),
      safeCount("SELECT COUNT(*) c FROM certificates WHERE status='superseded'"),
      safeCount("SELECT COUNT(*) c FROM documents"),
      safeCount("SELECT COUNT(*) c FROM documents WHERE visibility='public' AND status='Có hiệu lực'"),
      safeCount("SELECT COUNT(*) c FROM tickets WHERE status NOT IN ('Đã đóng','Đã giải quyết')"),
      safeCount("SELECT COUNT(*) c FROM approvals WHERE status='pending'"),
      safeCount("SELECT COUNT(*) c FROM tasks WHERE status NOT IN ('Hoàn thành','Đã hủy')"),
      safeAll("SELECT status, COUNT(*) c FROM email_logs GROUP BY status"),
      safeAll("SELECT id,actor_email,action,entity_type,entity_id,created_at FROM audit_log ORDER BY id DESC LIMIT 12"),
      safeAll("SELECT substr(created_at,1,10) AS day, COUNT(*) AS c FROM submissions GROUP BY substr(created_at,1,10) ORDER BY day DESC LIMIT 14")
    ]);
    let cmsTotal=0,cmsPublished=0,safetyOpen=0,incidentsOpen=0;
    if(await adminTableExists(env,"cms_pages")){
      const [cAll,cPub]=await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) c FROM cms_pages"),
        env.DB.prepare("SELECT COUNT(*) c FROM cms_pages WHERE status='published'")
      ]);
      cmsTotal=Number(cAll.results?.[0]?.c||0);
      cmsPublished=Number(cPub.results?.[0]?.c||0);
    }
    if(await adminTableExists(env,"safety_reports")){
      const sr=await env.DB.prepare("SELECT COUNT(*) c FROM safety_reports WHERE status NOT IN ('Đã xử lý','Đã đóng')").first();
      safetyOpen=Number(sr?.c||0);
    }
    if(await adminTableExists(env,"system_incidents")){
      const ir=await env.DB.prepare("SELECT COUNT(*) c FROM system_incidents WHERE status!='resolved'").first();
      incidentsOpen=Number(ir?.c||0);
    }
    const emailMap={sent:0,pending:0,failed:0};
    for(const r of emailStats.results||[]){
      if(r.status==="sent"||r.status==="accepted_by_provider") emailMap.sent+=Number(r.c||0);
      else if(r.status==="pending") emailMap.pending+=Number(r.c||0);
      else if(r.status==="failed") emailMap.failed+=Number(r.c||0);
    }
    const providerConfigured=!!(env.RESEND_API_KEY||env.EMAIL?.send);
    const opState = await resolveOperationalState(env, "app");
    const warnings=[];
    if(opState.mode!=="normal"){
      warnings.push({level:"warn",code:"NON_NORMAL_OPERATIONAL_MODE",message:`Hệ thống đang vận hành ở chế độ "${opState.mode}".`});
    }
    if(!providerConfigured){
      warnings.push({level:"warn",code:"EMAIL_PROVIDER_NOT_CONFIGURED",message:"Chưa cấu hình khóa gửi email thực tế (RESEND_API_KEY hoặc EMAIL binding). Các email tự động đang được ghi nhận ở trạng thái chờ cấu hình (pending)."});
    }
    if(Number(approvals.results?.[0]?.c||0)>0){
      warnings.push({level:"info",code:"PENDING_APPROVALS",message:`Đang có ${approvals.results[0].c} yêu cầu chờ phê duyệt trong Trung tâm Phê duyệt.`});
    }
    if(safetyOpen>0){
      warnings.push({level:"warn",code:"OPEN_SAFETY_REPORTS",message:`Đang có ${safetyOpen} báo cáo an toàn số cần xác minh và xử lý.`});
    }
    if(incidentsOpen>0){
      warnings.push({level:"warn",code:"OPEN_SYSTEM_INCIDENTS",message:`Đang có ${incidentsOpen} sự cố vận hành chưa đóng trong Trung tâm Sự cố.`});
    }
    if(emailMap.failed>0){
      warnings.push({level:"bad",code:"EMAIL_DELIVERY_ERRORS",message:`Có ${emailMap.failed} email gặp lỗi khi gửi tới nhà cung cấp. Vui lòng kiểm tra Trung tâm Email.`});
    }
    return json({
      counts:{
        submissions:subs.results?.[0]?.c||0,
        pending:pending.results?.[0]?.c||0,
        approved_submissions:approvedSubs.results?.[0]?.c||0,
        rejected_submissions:rejectedSubs.results?.[0]?.c||0,
        forms:formsCount.results?.[0]?.c||0,
        people:people.results?.[0]?.c||0,
        certificates:certs.results?.[0]?.c||0,
        revoked_certificates:revokedCerts.results?.[0]?.c||0,
        superseded_certificates:supersededCerts.results?.[0]?.c||0,
        documents:docsCount.results?.[0]?.c||0,
        published_documents:pubDocsCount.results?.[0]?.c||0,
        cms_pages:cmsTotal,
        published_pages:cmsPublished,
        tickets:tickets.results?.[0]?.c||0,
        approvals:approvals.results?.[0]?.c||0,
        tasks:tasks.results?.[0]?.c||0,
        safety_open:safetyOpen,
        incidents_open:incidentsOpen
      },
      operational_state:opState,
      email_breakdown:{...emailMap,provider_configured:providerConfigured},
      email_status:{...emailMap,provider_configured:providerConfigured},
      recent_audit:recentAudit.results||[],
      warnings,
      time_series:(timeSeries.results||[]).reverse()
    });
  }

  if(p==="/api/admin/xanh-submissions"&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const q=String(url.searchParams.get("q")||"").trim().slice(0,120);
    let sql="SELECT id,source,external_code,full_name,email,form_name,external_status,source_submitted_at,source_tracking_url,received_at,updated_at FROM xanh_external_submissions WHERE 1=1",vals=[];
    if(q){sql+=" AND (external_code LIKE ? OR full_name LIKE ? OR email LIKE ?)";vals.push(`%${q}%`,`%${q}%`,`%${q}%`)}
    sql+=" ORDER BY received_at DESC LIMIT 500";
    const rs=await env.DB.prepare(sql).bind(...vals).all();return json({items:rs.results||[]});
  }

  if(p==="/api/admin/submissions"&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const status=url.searchParams.get("status"),form=url.searchParams.get("form"),q=url.searchParams.get("q");
    let sql="SELECT code,form_id,full_name,email,status,assigned_to,score,internal_note,created_at,updated_at FROM submissions WHERE 1=1",vals=[];
    if(!hasPermission(user,"submission.manage")&&!hasPermission(user,"approval.decide")&&hasPermission(user,"submission.manage_assigned")){
      sql+=" AND assigned_to=?";vals.push(user.id);
    }
    if(status){sql+=" AND status=?";vals.push(status)}
    if(form){sql+=" AND form_id=?";vals.push(form)}
    if(q){sql+=" AND (code LIKE ? OR full_name LIKE ? OR email LIKE ?)";vals.push(`%${q}%`,`%${q}%`,`%${q}%`)}
    sql+=" ORDER BY id DESC LIMIT 1000";
    const rs=await env.DB.prepare(sql).bind(...vals).all();
    return json({items:rs.results||[]});
  }

  const subMatch=p.match(/^\/api\/admin\/submissions\/([^/]+)$/);
  if(subMatch&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const row=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(decodeURIComponent(subMatch[1])).first();
    if(!row)return json({error:"NOT_FOUND"},404);
    if(!hasPermission(user,"submission.manage")&&!hasPermission(user,"approval.decide")&&hasPermission(user,"submission.manage_assigned")&&Number(row.assigned_to)!==Number(user.id)){
      return json({error:"FORBIDDEN",message:"Bạn chỉ được xem hồ sơ được phân công xử lý."},403);
    }
    const files=await env.DB.prepare("SELECT id,field_key,filename,mime,size,created_at FROM files WHERE submission_code=? AND (deleted_at IS NULL)").bind(row.code).all();
    return json({item:{...row,answers:parseBodyJson(row,"answers_json"),terms:parseBodyJson(row,"terms_snapshot_json",[])},files:files.results||[]});
  }

  if(subMatch&&request.method==="PATCH"){
    const code=decodeURIComponent(subMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(!current)return json({error:"NOT_FOUND"},404);
    const canManageAll=hasPermission(user,"submission.manage");
    const canManageAssigned=hasPermission(user,"submission.manage_assigned")&&Number(current.assigned_to)===Number(user.id);
    if(!canManageAll&&!canManageAssigned) return json({error:"FORBIDDEN",permission:"submission.manage"},403);
    const allowed=canManageAll?["status","assigned_to","score","internal_note","next_action","result_summary"]:["status","score","internal_note","next_action","result_summary"];
    const sets=[],vals=[];
    for(const k of allowed) if(k in body){sets.push(`${k}=?`);vals.push(body[k])}
    if(sets.length){
      vals.push(code); await env.DB.prepare(`UPDATE submissions SET ${sets.join(",")},updated_at=CURRENT_TIMESTAMP WHERE code=?`).bind(...vals).run();
    }
    if(body.status&&body.status!==current.status){
      const publicLabel={
        "Đã tiếp nhận":"TIẾP NHẬN","Đang xem xét":"KIỂM TRA","Đang kiểm tra":"KIỂM TRA","Đang xử lý":"XỬ LÝ",
        "Cần bổ sung":"CẦN BỔ SUNG","Mời phỏng vấn":"XỬ LÝ","Đang đánh giá":"XỬ LÝ","Đã duyệt":"HOÀN TẤT","Hoàn tất":"HOÀN TẤT","Đã hoàn tất":"HOÀN TẤT"
      }[body.status]||String(body.status).toUpperCase();
      await env.DB.prepare("INSERT INTO case_events(submission_code,event_type,public_label,public_note,status,created_by) VALUES(?,?,?,?,?,?)")
        .bind(code,"status",publicLabel,String(body.note||body.next_action||""),body.status,user.id).run();
    }
    await audit(env,request,user,"Cập nhật hồ sơ","submission",code,{status:body.status,assigned_to:body.assigned_to,score:body.score,next_action:body.next_action,result_summary:body.result_summary});
    if(body.status&&current.email&&body.status!==current.status){
      const emailVars={
        code,
        full_name:current.full_name||current.email,
        status:body.status,
        requirement_note:body.note||body.next_action||"Vui lòng kiểm tra thông tin hồ sơ trên hệ thống.",
        result_summary:body.result_summary||body.note||`Hồ sơ đã chuyển sang trạng thái: ${body.status}.`,
        note_block:body.note?`<p>${escapeHtml(body.note)}</p>`:""
      };
      if(body.status==="Cần bổ sung"){
        await sendTemplatedEmail(env,"information_required",current.email,emailVars);
      }else if(["Đã duyệt","Hoàn tất","Đã hoàn tất","Không phù hợp"].includes(body.status)){
        await sendTemplatedEmail(env,"application_result",current.email,emailVars);
      }else{
        await sendTemplatedEmail(env,"status_update",current.email,emailVars);
      }
      if(current.user_id) await notifyUser(env,current.user_id,`Hồ sơ ${code}: ${body.status}`,body.note||"","submission",`/ho-so?code=${encodeURIComponent(code)}`);
    }
    return json({ok:true});
  }

  const convertMatch=p.match(/^\/api\/admin\/submissions\/([^/]+)\/convert-person$/);
  if(convertMatch&&request.method==="POST"){
    const deny=requirePermission(user,"people.manage");if(deny)return deny;
    const code=decodeURIComponent(convertMatch[1]);
    const s=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(!s)return json({error:"NOT_FOUND"},404);
    const exists=await env.DB.prepare("SELECT id FROM people WHERE source_submission_code=?").bind(code).first();
    if(exists)return json({error:"ALREADY_CONVERTED"},409);
    const a=parseBodyJson(s,"answers_json");
    let linked=await userByEmail(env,s.email||"");
    const res=await env.DB.prepare("INSERT INTO people(user_id,source_submission_code,full_name,email,phone,unit_code,position,status,joined_at,profile_json) VALUES(?,?,?,?,?,?,?,'Đang hoạt động',date('now'),?)")
      .bind(linked?.id||null,code,s.full_name||"",s.email||"",a.phone||"",a.area||a.volunteer_type||"SFN",a.position||s.form_id,JSON.stringify({teaching_scope:a.teaching_scope||null})).run();
    const pid=res.meta.last_row_id;
    await env.DB.prepare("INSERT INTO people_history(person_id,event_type,details_json,created_by) VALUES(?,'Tiếp nhận',?,?)")
      .bind(pid,JSON.stringify({source_submission_code:code}),user.id).run();
    await audit(env,request,user,"Tiếp nhận thành hồ sơ nhân sự","person",String(pid),{source:code});
    return json({ok:true,person_id:pid});
  }

  if(p==="/api/admin/users"&&request.method==="GET"){
    const deny=requirePermission(user,"user.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT id,email,full_name,status,email_verified,must_change_password,totp_enabled,created_at FROM users ORDER BY id DESC LIMIT 1000").all();
    const actorIsOwner=isOwnerUser(user);
    const items=[];
    for(const u of rs.results||[]){
      const roles=await listUserRoles(env,u.id);
      const isOwner=roles.some(r=>r.role_id==="owner");
      if(isOwner&&!actorIsOwner) continue;
      items.push({...u,roles,is_owner:isOwner});
    }
    return json({items});
  }

  if(p==="/api/admin/users"&&request.method==="POST"){
    return createInvitedAccount(request,env,user,await readJson(request));
  }

  const rolesMatch=p.match(/^\/api\/admin\/users\/(\d+)\/roles$/);
  if(rolesMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"user.manage");if(deny)return deny;
    const targetId=Number(rolesMatch[1]),body=await readJson(request)||{},roles=Array.isArray(body.roles)?body.roles:[];
    const target=await env.DB.prepare("SELECT id,email FROM users WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"NOT_FOUND"},404);
    const targetRoles=await listUserRoles(env,targetId);
    if(targetRoles.some(r=>r.role_id==="owner")&&!isOwnerUser(user)) return json({error:"OWNER_PROTECTED"},403);
    if(roles.some(r=>(r.role_id||r)==="owner")) return json({error:"OWNER_ROLE_NOT_ASSIGNABLE_HERE"},403);
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com" && !(user.roles||[]).some(r=>r.role_id==="super_admin"))
      return json({error:"PROTECTED_SUPER_ADMIN"},403);
    for(const r of roles) if(!(await ensureRoleGrantAllowed(user,r.role_id||r))) return json({error:"ROLE_TOO_HIGH",role:r.role_id||r},403);
    const existing=await listUserRoles(env,targetId);
    for(const old of existing){
      if(old.role_id==="super_admin"&&target.email.toLowerCase()==="skyfirst.ec@gmail.com"&&!roles.some(r=>(r.role_id||r)==="super_admin"))
        return json({error:"ROOT_SUPER_ADMIN_CANNOT_BE_REMOVED"},403);
    }
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com") await env.DB.prepare("DELETE FROM user_roles WHERE user_id=? AND role_id!='super_admin'").bind(targetId).run(); else await env.DB.prepare("DELETE FROM user_roles WHERE user_id=?").bind(targetId).run();
    for(const r0 of roles){
      const role=typeof r0==="string"?r0:r0.role_id,scope=typeof r0==="string"?"":(r0.scope_unit_code||""),expires=typeof r0==="string"?null:(r0.expires_at||null);
      if(role==="super_admin"&&target.email.toLowerCase()!=="skyfirst.ec@gmail.com"&&!(user.roles||[]).some(r=>r.role_id==="super_admin")) continue;
      await env.DB.prepare("INSERT OR REPLACE INTO user_roles(user_id,role_id,scope_unit_code,granted_by,expires_at) VALUES(?,?,?,?,?)")
        .bind(targetId,role,scope,user.id,expires).run();
    }
    await audit(env,request,user,"Cập nhật quyền tài khoản","user",String(targetId),{roles});
    return json({ok:true,roles:await listUserRoles(env,targetId)});
  }

  const userResetMatch=p.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
  if(userResetMatch&&request.method==="POST"){
    const deny=requirePermission(user,"user.manage");if(deny)return deny;
    const targetId=Number(userResetMatch[1]),target=await env.DB.prepare("SELECT id,email,full_name FROM users WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"NOT_FOUND"},404);
    const targetRoles=await listUserRoles(env,targetId);
    if(targetRoles.some(r=>r.role_id==="owner")&&!isOwnerUser(user)) return json({error:"OWNER_PROTECTED"},403);
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com")return json({error:"ROOT_SUPER_ADMIN_PROTECTED"},403);
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%",rnd=new Uint8Array(16);crypto.getRandomValues(rnd);
    let temp="SFN!";for(const b of rnd)temp+=chars[b%chars.length];
    const salt=newSalt(),hash=await pbkdf2(temp,salt,100000);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,password_iterations=100000,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,targetId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId)
    ]);
    await sendTemplatedEmail(env,"account_invite",target.email,{full_name:target.full_name||target.email,email:target.email,temp_password:temp});
    await audit(env,request,user,"Đặt lại mật khẩu tạm thời","user",String(targetId),{});
    return json({ok:true,temp_password:temp});
  }

  const userStatusMatch=p.match(/^\/api\/admin\/users\/(\d+)\/status$/);
  if(userStatusMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"user.manage");if(deny)return deny;
    const targetId=Number(userStatusMatch[1]),body=await readJson(request)||{},status=String(body.status||"active");
    const target=await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"NOT_FOUND"},404);
    const targetRoles=await listUserRoles(env,targetId);
    if(targetRoles.some(r=>r.role_id==="owner")){
      if(!isOwnerUser(user)) return json({error:"OWNER_PROTECTED"},403);
      if(status!=="active") return json({error:"OWNER_CANNOT_BE_DISABLED"},409);
    }
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com"&&status!=="active") return json({error:"ROOT_SUPER_ADMIN_PROTECTED"},403);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,targetId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId)
    ]);
    await audit(env,request,user,"Đổi trạng thái tài khoản","user",String(targetId),{status});
    return json({ok:true});
  }

  if(p==="/api/admin/people"&&request.method==="GET"){
    const deny=requirePermission(user,"people.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM people ORDER BY id DESC LIMIT 1000").all();
    const items=(rs.results||[]).filter(row=>canAccessScope(user,row.unit_code||""));
    return json({items});
  }

  if(p==="/api/admin/modules"&&request.method==="GET"){
    const deny=requirePermission(user,"dashboard.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM modules ORDER BY sort_order").all();return json({items:rs.results||[]});
  }
  if(p==="/api/admin/modules"&&request.method==="PUT"){
    const deny=requirePermission(user,"module.manage");if(deny)return deny;
    const body=await readJson(request)||{},items=Array.isArray(body.items)?body.items:[];
    for(const x of items) await env.DB.prepare("UPDATE modules SET enabled=? WHERE key=?").bind(x.enabled?1:0,x.key).run();
    await audit(env,request,user,"Cập nhật trạng thái Modules","module","*",{count:items.length});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  if(p==="/api/admin/media"&&request.method==="GET"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    if(!env.FILES)return json({error:"STORAGE_UNAVAILABLE"},503);
    const list=await env.FILES.list({prefix:"public-media/",limit:500});
    return json({items:(list.objects||[]).map(o=>({
      key:o.key.slice("public-media/".length),size:o.size,uploaded:o.uploaded,etag:o.etag,
      is_heavy:Number(o.size||0)>500*1024,
      url:`/media/${encodeURIComponent(o.key.slice("public-media/".length)).replaceAll("%2F","/")}`
    }))});
  }
  if(p==="/api/admin/media/audit"&&request.method==="GET"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const [filesRs,docsRs,certsRs,subsRs,settingsRs,newsRs,pagesRs]=await env.DB.batch([
      env.DB.prepare("SELECT id,filename,mime,size,r2_key,visibility,submission_code,created_at FROM files WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500"),
      env.DB.prepare("SELECT id,code,title,file_id,visibility,status FROM documents"),
      env.DB.prepare("SELECT id,code,file_id FROM certificates WHERE file_id IS NOT NULL"),
      env.DB.prepare("SELECT code,answers_json FROM submissions"),
      env.DB.prepare("SELECT key,value_json FROM settings"),
      env.DB.prepare("SELECT id,title,cover_file_id FROM news WHERE cover_file_id IS NOT NULL"),
      await adminTableExists(env,"cms_pages") ? env.DB.prepare("SELECT id,slug,cover_file_id,blocks_json FROM cms_pages") : env.DB.prepare("SELECT 1 WHERE 0")
    ]);
    let docVerSet = new Set();
    if(await adminTableExists(env,"document_versions")){
      const dv=await env.DB.prepare("SELECT file_id FROM document_versions").all();
      for(const r of dv.results||[]) if(r.file_id) docVerSet.add(r.file_id);
    }
    let spRefSet = new Set();
    if(await adminTableExists(env,"sponsorship_transactions")){
      const st=await env.DB.prepare("SELECT voucher_file_id FROM sponsorship_transactions WHERE voucher_file_id IS NOT NULL").all();
      for(const r of st.results||[]) if(r.voucher_file_id) spRefSet.add(r.voucher_file_id);
    }
    if(await adminTableExists(env,"sponsorship_reports")){
      const sr=await env.DB.prepare("SELECT file_id FROM sponsorship_reports WHERE file_id IS NOT NULL").all();
      for(const r of sr.results||[]) if(r.file_id) spRefSet.add(r.file_id);
    }
    const allSubsText = (subsRs.results||[]).map(s=>s.answers_json||"").join(" ");
    const allPagesText = (pagesRs.results||[]).map(pg=>`${pg.cover_file_id||""} ${pg.blocks_json||""}`).join(" ");
    const docFileSet = new Set((docsRs.results||[]).map(d=>d.file_id).filter(Boolean));
    const certFileSet = new Set((certsRs.results||[]).map(c=>c.file_id).filter(Boolean));

    const orphanFiles=[], heavyFiles=[], missingObjects=[];
    for(const f of filesRs.results||[]){
      const used = Boolean(
        f.submission_code ||
        docFileSet.has(f.id) ||
        docVerSet.has(f.id) ||
        certFileSet.has(f.id) ||
        spRefSet.has(f.id) ||
        allSubsText.includes(f.id) ||
        allPagesText.includes(f.id)
      );
      if(!used) orphanFiles.push(f);
      const maxRecommended = (f.mime||"").startsWith("image/") ? 500*1024 : 5*1024*1024;
      if(Number(f.size||0) > maxRecommended) heavyFiles.push({...f, threshold_bytes:maxRecommended});
      if(env.FILES && f.r2_key){
        const head = await env.FILES.head(f.r2_key);
        if(!head) missingObjects.push(f);
      }
    }
    const brokenDocs = (docsRs.results||[]).filter(d=>d.visibility==="public" && d.status==="Có hiệu lực" && !d.file_id);
    const totalFilesCount = (filesRs.results||[]).length;
    return json({
      ok:true,
      summary:{
        total_files:totalFilesCount,
        in_use_count:Math.max(0,totalFilesCount-orphanFiles.length),
        orphan_count:orphanFiles.length,
        orphan_files_count:orphanFiles.length,
        heavy_files_count:heavyFiles.length,
        missing_r2_objects_count:missingObjects.length,
        broken_references_count:brokenDocs.length+missingObjects.length,
        public_docs_missing_file_count:brokenDocs.length
      },
      items:filesRs.results||[],
      broken_references:brokenDocs,
      orphan_files:orphanFiles,
      heavy_files:heavyFiles,
      missing_objects:missingObjects,
      public_docs_missing_file:brokenDocs
    });
  }
  if(p==="/api/admin/media"&&request.method==="POST"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    if(!env.FILES)return json({error:"STORAGE_UNAVAILABLE"},503);
    const fd=await request.formData(),file=fd.get("file");
    if(!file||typeof file!=="object"||!("size" in file)||!file.size)return json({error:"FILE_REQUIRED"},400);
    if(file.size>15*1024*1024)return json({error:"FILE_TOO_LARGE",max_mb:15},400);
    const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","image/svg+xml","application/pdf"]);
    if(!allowed.has(file.type))return json({error:"IMAGE_TYPE_NOT_ALLOWED",message:"Chỉ hỗ trợ JPG, PNG, WEBP, GIF, SVG an toàn hoặc PDF."},400);
    const bytes=await file.arrayBuffer();
    if(!magicBytesOk(file.type,bytes.slice(0,256)))return json({error:"IMAGE_SIGNATURE_MISMATCH",message:"Nội dung file không khớp định dạng đã chọn."},400);
    if(file.type==="image/svg+xml"){
      const svgText=new TextDecoder().decode(bytes);
      if(!isSafeSvgText(svgText)){
        return json({error:"UNSAFE_SVG_REJECTED",message:"Tệp SVG chứa thẻ script hoặc thuộc tính sự kiện không an toàn."},400);
      }
    }
    const safe=String(file.name||"image").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120)||"image";
    const key=`${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safe}`;
    await env.FILES.put(`public-media/${key}`,bytes,{httpMetadata:{contentType:file.type}});
    await audit(env,request,user,"Upload ảnh giao diện","media",key,{size:file.size,mime:file.type});
    return json({ok:true,key,url:`/media/${key}`,size:file.size,mime:file.type},201);
  }
  const mediaMatch=p.match(/^\/api\/admin\/media\/(.+)$/);
  if(mediaMatch&&request.method==="DELETE"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    if(!env.FILES)return json({error:"STORAGE_UNAVAILABLE"},503);
    const key=decodeURIComponent(mediaMatch[1]);
    if(!key||key.includes(".."))return json({error:"INVALID_PATH"},400);
    const mediaUrl=`/media/${key}`;
    const queries=[
      env.DB.prepare("SELECT COUNT(*) c FROM settings WHERE value_json LIKE ?").bind(`%${mediaUrl}%`),
      env.DB.prepare("SELECT COUNT(*) c FROM news WHERE cover_file_id=?").bind(key)
    ];
    if(await adminTableExists(env,"cms_pages")){
      queries.push(env.DB.prepare("SELECT COUNT(*) c FROM cms_pages WHERE cover_file_id=? OR blocks_json LIKE ?").bind(key,`%${mediaUrl}%`));
    }
    const batchUse=await env.DB.batch(queries);
    const refs=batchUse.reduce((s,r)=>s+Number(r.results?.[0]?.c||0),0);
    if(refs>0)return json({error:"ASSET_IN_USE",message:"Tài nguyên đang được dùng trong cấu hình, bài viết hoặc trang CMS. Hãy gỡ khỏi nội dung trước khi xóa.",references:refs},409);
    await env.FILES.delete(`public-media/${key}`);
    await audit(env,request,user,"Xóa ảnh giao diện","media",key,{});
    return json({ok:true});
  }

  // ================= DESIGN SYSTEM & MENU MANAGER (/api/admin/design-system & /api/admin/menus) =================
  if(p==="/api/admin/design-system"&&request.method==="GET"){
    if(!hasAnyPermission(user,["settings.manage","cms.view","cms.edit"])) return json({error:"FORBIDDEN"},403);
    const ds=await setting(env,"design_system",{});
    return json({ok:true,design_system:ds});
  }
  if(p==="/api/admin/design-system"&&request.method==="PUT"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const curr=await setting(env,"design_system",{});
    const next={...curr,...(body.design_system||body)};
    await upsertSettingRow(env,"design_system",next,user.id);
    await audit(env,request,user,"Cập nhật Hệ thống Thiết kế (Design System)","settings","design_system",next);
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,design_system:next});
  }

  if(p==="/api/admin/menus"&&request.method==="GET"){
    if(!hasAnyPermission(user,["settings.manage","cms.view","cms.edit"])) return json({error:"FORBIDDEN"},403);
    if(!(await adminTableExists(env,"menus"))) return json({items:[]});
    const site=String(url.searchParams.get("website_id")||"app").trim();
    const rs=await env.DB.prepare("SELECT * FROM menus WHERE website_id=? ORDER BY location").bind(site).all();
    const items=(rs.results||[]).map(m=>{
      let list=[]; try{list=JSON.parse(m.items_json||"[]")}catch{}
      return {...m,items:list,items_json:undefined};
    });
    return json({items});
  }
  const menuLocMatch=p.match(/^\/api\/admin\/menus\/([^/]+)$/);
  if(menuLocMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["settings.manage","cms.edit"])) return json({error:"FORBIDDEN"},403);
    const location=decodeURIComponent(menuLocMatch[1]);
    const body=await readJson(request)||{};
    const site=String(body.website_id||"app").trim();
    if(!canAccessScope(user,site)) return json({error:"FORBIDDEN"},403);
    const items=Array.isArray(body.items)?body.items:[];
    const name=String(body.name||`Menu ${location}`).trim();
    const id=`menu_${site}_${location}`;
    await env.DB.prepare("INSERT INTO menus(id,website_id,location,name,items_json,updated_by,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(website_id,location) DO UPDATE SET name=excluded.name,items_json=excluded.items_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
      .bind(id,site,location,name,JSON.stringify(items),user.id).run();
    await audit(env,request,user,"Cập nhật Menu điều hướng","menu",id,{website_id:site,location,count:items.length});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,id,website_id:site,location,items});
  }

  // ================= TRUNG TÂM TRẠNG THÁI, BẢO TRÌ, SỨC KHỎE & PHÁT HÀNH (/api/admin/system/*) =================
  if((p==="/api/admin/system/state"||p==="/api/admin/maintenance-config")&&request.method==="GET"){
    if(!hasAnyPermission(user,["settings.manage","dashboard.view"])) return json({error:"FORBIDDEN"},403);
    const state=await resolveOperationalState(env,url.searchParams.get("website_id")||"app");
    return json({ok:true,state,maintenance_config:state});
  }
  if((p==="/api/admin/system/state"||p==="/api/admin/maintenance-config")&&request.method==="PUT"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const validModes=["normal","manual_maintenance","scheduled_maintenance","emergency_maintenance","read_only","publishing_paused"];
    const nextMode=validModes.includes(body.mode)?body.mode:"normal";
    const currCfg=(await setting(env,"maintenance_config",{}))||{};
    const nextCfg={
      ...currCfg,
      mode:nextMode,
      title_vi:body.title_vi??body.title??currCfg.title_vi??"Hệ thống Thông tin Số Sky First đang bảo trì",
      title_en:body.title_en??currCfg.title_en??"Sky First Digital Information System Under Maintenance",
      message_vi:body.message_vi??body.message??currCfg.message_vi??"Hệ thống đang được nâng cấp kỹ thuật để đảm bảo an toàn và chất lượng dịch vụ.",
      message_en:body.message_en??currCfg.message_en??"The system is undergoing technical maintenance to ensure security and service quality.",
      reason:body.reason??currCfg.reason??"",
      scheduled_start:body.scheduled_start??currCfg.scheduled_start??"",
      scheduled_end:body.scheduled_end??currCfg.scheduled_end??"",
      eta:body.eta??currCfg.eta??"",
      show_pre_banner:body.show_pre_banner!==undefined?Boolean(body.show_pre_banner):Boolean(currCfg.show_pre_banner),
      pre_banner_vi:body.pre_banner_vi??currCfg.pre_banner_vi??"",
      pre_banner_en:body.pre_banner_en??currCfg.pre_banner_en??"",
      contact_email:body.contact_email??currCfg.contact_email??"support@skyfirst.io.vn",
      hotline:body.hotline??currCfg.hotline??"0924 910 210",
      allow_lookup:body.allow_lookup!==false,
      allow_admin_bypass:body.allow_admin_bypass!==false,
      bypass_roles:Array.isArray(body.bypass_roles)?body.bypass_roles:(currCfg.bypass_roles||["owner","super_admin","system_admin"])
    };
    const isMaint=["manual_maintenance","scheduled_maintenance","emergency_maintenance"].includes(nextMode);
    await upsertSettingRow(env,"system_operational_mode",nextMode,user.id);
    await upsertSettingRow(env,"maintenance_mode",isMaint,user.id);
    await upsertSettingRow(env,"maintenance_config",nextCfg,user.id);
    await upsertSettingRow(env,"maintenance_title",nextCfg.title_vi,user.id);
    await upsertSettingRow(env,"maintenance_text",nextCfg.message_vi,user.id);
    await audit(env,request,user,`Chuyển trạng thái vận hành hệ thống: ${nextMode}`,"system_state",nextMode,nextCfg);
    invalidatePublicCache(url,["/api/config"],ctx);
    const nextState=await resolveOperationalState(env,"app");
    return json({ok:true,state:nextState,maintenance_config:nextState});
  }

  if(p==="/api/admin/system/pre-reopen-check"&&(request.method==="POST"||request.method==="GET")){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const checks=[];
    try{
      const c=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users WHERE status='active') AS u, (SELECT COUNT(*) FROM forms WHERE enabled=1) AS f, (SELECT COUNT(*) FROM websites WHERE status='active') AS w").first();
      checks.push({key:"d1_database",label:"Kết nối cơ sở dữ liệu & bảng cốt lõi",ok:Number(c?.u||0)>0 && Number(c?.f||0)>0,detail:`Users: ${c?.u||0}, Active Forms: ${c?.f||0}, Active Websites: ${c?.w||0}`});
    }catch(e){
      checks.push({key:"d1_database",label:"Kết nối cơ sở dữ liệu",ok:false,detail:String(e.message||e)});
    }
    try{
      if(env.FILES){
        await env.FILES.list({limit:1});
        checks.push({key:"r2_storage",label:"Kết nối kho lưu trữ tệp",ok:true,detail:"Đọc danh sách tệp thành công"});
      }else{
        checks.push({key:"r2_storage",label:"Kết nối kho lưu trữ tệp",ok:false,detail:"Thiếu FILES binding"});
      }
    }catch(e){
      checks.push({key:"r2_storage",label:"Kết nối kho lưu trữ tệp",ok:false,detail:String(e.message||e)});
    }
    const bk=await env.DB.prepare("SELECT id,sha256,created_at FROM backups ORDER BY created_at DESC LIMIT 1").first();
    checks.push({key:"recent_backup",label:"Bản sao lưu dữ liệu SHA-256",ok:Boolean(bk?.id),detail:bk?`Bản sao lưu gần nhất: ${bk.id} (${bk.created_at})`:"Chưa có bản sao lưu nào"});
    const allOk=checks.every(c=>c.ok);
    await audit(env,request,user,"Chạy kiểm tra an toàn trước khi mở lại hệ thống (Pre-reopen Check)","system_state","pre_reopen",{all_ok:allOk,checks});
    return json({ok:true,ready_to_reopen:allOk,checks});
  }

  if(p==="/api/admin/system/health"&&request.method==="GET"){
    if(!hasAnyPermission(user,["dashboard.view","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const services={};
    // 1. D1 Database
    try{
      const t0=Date.now();
      const row=await env.DB.prepare("SELECT COUNT(*) AS tables_count FROM sqlite_master WHERE type='table'").first();
      services.d1={
        configured:!!env.DB,
        operational:Number(row?.tables_count||0)>10,
        latency_ms:Date.now()-t0,
        tables_count:Number(row?.tables_count||0),
        database_name:"sfn-app-db"
      };
    }catch(e){
      services.d1={configured:!!env.DB,operational:false,error:String(e.message||e)};
    }
    // 2. R2 Storage
    try{
      const t0=Date.now();
      if(env.FILES){
        const ls=await env.FILES.list({limit:5});
        services.r2={configured:true,operational:true,latency_ms:Date.now()-t0,sample_objects:(ls.objects||[]).length};
      }else{
        services.r2={configured:false,operational:false};
      }
    }catch(e){
      services.r2={configured:!!env.FILES,operational:false,error:String(e.message||e)};
    }
    // 3. Email Provider (telemetry must not break the health endpoint if a table is missing).
    const emailConfigured=Boolean(env.RESEND_API_KEY||env.EMAIL?.send);
    try{
      const emailStats=await env.DB.prepare("SELECT status, COUNT(*) c FROM email_logs GROUP BY status").all();
      services.email={configured:emailConfigured,operational:emailConfigured,mode:emailConfigured?"live_provider":"logged_pending_fallback",stats:emailStats.results||[]};
    }catch(e){
      services.email={configured:emailConfigured,operational:false,mode:emailConfigured?"live_provider":"logged_pending_fallback",stats:[],error:String(e.message||e)};
    }
    // 3b. Required schema compatibility used by Admin mutation workflows.
    try{services.schema=await adminSchemaDiagnostics(env)}catch(e){services.schema={ok:false,checks:[],error:String(e.message||e)}}
    // 4. Webhooks & Turnstile
    services.webhooks={
      xanh_intake_configured:String(env.XANH_CTT_SHARED_SECRET||"").length>=32,
      sponsorship_payment_configured:String(env.PAYMENT_WEBHOOK_SECRET||env.SPONSORSHIP_WEBHOOK_SECRET||"").length>=32,
      turnstile_configured:Boolean(env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY)
    };
    // 5. Latest Backup
    try{
      const latestBackup=await env.DB.prepare("SELECT id,r2_key,size,sha256,kind,created_at,verified_at FROM backups ORDER BY created_at DESC LIMIT 1").first();
      services.backups={latest:latestBackup||null,has_verified_backup:Boolean(latestBackup?.sha256)};
    }catch(e){services.backups={latest:null,has_verified_backup:false,error:String(e.message||e)}}
    return json({
      ok:Boolean(services.d1?.operational && services.r2?.operational && services.schema?.ok),
      checked_at:new Date().toISOString(),
      operational_state:await resolveOperationalState(env,"app"),
      services
    });
  }

  if(p==="/api/admin/system/incidents"&&request.method==="GET"){
    if(!hasAnyPermission(user,["dashboard.view","settings.manage","safety.view"])) return json({error:"FORBIDDEN"},403);
    if(!(await adminTableExists(env,"system_incidents"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT * FROM system_incidents ORDER BY created_at DESC LIMIT 200").all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/admin/system/incidents"&&request.method==="POST"){
    if(!hasAnyPermission(user,["settings.manage","safety.manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    if(!body.title) return json({error:"INVALID_INPUT",message:"Tiêu đề sự cố là bắt buộc."},400);
    const id=uid("inc"),code=`INC-${new Date().getFullYear()}-${String(await nextCounter(env,"incident")).padStart(4,"0")}`;
    await env.DB.prepare("INSERT INTO system_incidents(id,code,website_id,severity,category,title,description,status,created_by) VALUES(?,?,?,?,?,?,?,'open',?)")
      .bind(id,code,String(body.website_id||"app"),body.severity||"warning",body.category||"system",String(body.title).trim(),String(body.description||body.summary||""),user.id).run();
    await audit(env,request,user,"Ghi nhận sự cố vận hành","system_incident",code,{severity:body.severity,title:body.title});
    return json({ok:true,id,code},201);
  }
  const incMatch=p.match(/^\/api\/admin\/system\/incidents\/([^/]+)$/);
  if(incMatch&&request.method==="PATCH"){
    if(!hasAnyPermission(user,["settings.manage","safety.manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(incMatch[1]),body=await readJson(request)||{};
    const nextStatus=body.status||"resolved";
    await env.DB.prepare("UPDATE system_incidents SET status=?,resolution_note=?,resolved_by=CASE WHEN ?='resolved' THEN ? ELSE resolved_by END,resolved_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? OR code=?")
      .bind(nextStatus,String(body.resolution_note||""),nextStatus,user.id,nextStatus,id,id).run();
    await audit(env,request,user,"Cập nhật sự cố vận hành","system_incident",id,{status:nextStatus,resolution_note:body.resolution_note||""});
    return json({ok:true});
  }

  if(p==="/api/admin/system/qa-check"&&request.method==="GET"){
    if(!hasAnyPermission(user,["dashboard.view","settings.manage","cms.view"])) return json({error:"FORBIDDEN"},403);
    const issues=[];
    if(await adminTableExists(env,"cms_pages")){
      const pgCols=await adminTableColumns(env,"cms_pages");
      const pages=await env.DB.prepare("SELECT id,website_id,slug,title,title_en,summary,seo_json,blocks_json,status FROM cms_pages WHERE status='published'").all();
      for(const pg of pages.results||[]){
        let seo={}; try{seo=JSON.parse(pg.seo_json||"{}")}catch{}
        if(!seo.meta_title || !seo.meta_description){
          issues.push({category:"seo",severity:"warning",entity:`cms_page:${pg.slug}`,message:`Trang "${pg.title}" (${pg.slug}) thiếu meta_title hoặc meta_description SEO.`});
        }
        if(pgCols.has("title_en") && !pg.title_en){
          issues.push({category:"i18n",severity:"info",entity:`cms_page:${pg.slug}`,message:`Trang "${pg.title}" (${pg.slug}) chưa có bản dịch tiêu đề tiếng Anh (title_en).`});
        }
      }
    }
    const pubDocs=await env.DB.prepare("SELECT id,code,title,file_id FROM documents WHERE visibility='public' AND status='Có hiệu lực'").all();
    for(const d of pubDocs.results||[]){
      if(!d.file_id){
        issues.push({category:"document",severity:"warning",entity:`document:${d.code}`,message:`Tài liệu công khai "${d.title}" (${d.code}) chưa gắn tệp PDF (file_id).`});
      }
    }
    if(await adminTableExists(env,"sponsorship_campaigns")){
      const camps=await env.DB.prepare("SELECT code,title,bank_account_no FROM sponsorship_campaigns WHERE visibility='public' AND status='active'").all();
      for(const c of camps.results||[]){
        if(!c.bank_account_no){
          issues.push({category:"sponsorship",severity:"info",entity:`campaign:${c.code}`,message:`Chiến dịch tài trợ công khai "${c.title}" (${c.code}) chưa cấu hình số tài khoản ngân hàng nhận đối soát.`});
        }
      }
    }
    return json({
      ok:true,
      checked_at:new Date().toISOString(),
      issues_count:issues.length,
      release_ready:issues.filter(i=>i.severity==="critical").length===0,
      checks:[
        {name:"CMS & SEO Metadata",ok:issues.filter(i=>i.category==="seo"&&i.severity==="critical").length===0,detail:`${issues.filter(i=>i.category==="seo").length} cảnh báo SEO`},
        {name:"Song ngữ VI/EN (i18n)",ok:true,detail:`${issues.filter(i=>i.category==="i18n").length} lưu ý bản dịch`},
        {name:"Tài liệu PDF công khai",ok:issues.filter(i=>i.category==="document").length===0,detail:`${issues.filter(i=>i.category==="document").length} tài liệu thiếu file`},
        {name:"Đối soát Tài trợ & VietQR",ok:true,detail:"Đã kích hoạt kiểm tra VietQR & HMAC Webhook"}
      ],
      issues
    });
  }

  if(p==="/api/admin/settings"&&request.method==="GET"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT key,value_json,updated_at FROM settings ORDER BY key").all();
    return json({items:(rs.results||[]).map(x=>({...x,value:parseBodyJson(x,"value_json",x.value_json)}))});
  }
  if(p==="/api/admin/settings"&&request.method==="PUT"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const body=await readJson(request)||{},items=body.items||{};
    for(const [k,v] of Object.entries(items)){
      await upsertSettingRow(env,k,v,user.id);
    }
    await audit(env,request,user,"Cập nhật cài đặt hệ thống","settings","*",{keys:Object.keys(items)});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  if(p==="/api/admin/forms"&&request.method==="GET"){
    const deny=requirePermission(user,"form.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json,updated_at FROM forms ORDER BY rowid").all();
    return json({items:(rs.results||[]).map(x=>{
      let cfg={}; try{cfg=JSON.parse(x.config_json||"{}")}catch{}
      const wfStatus=cfg.workflow_status||(x.enabled?"published":"draft");
      return {...x,workflow_status:wfStatus,config:{...cfg,workflow_status:wfStatus},config_json:undefined};
    })});
  }
  if(p==="/api/admin/forms"&&request.method==="POST"){
    const deny=requirePermission(user,"form.manage");if(deny)return deny;
    const body=await readJson(request)||{},idForm=String(body.id||uid("form")).trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    if(!idForm||!body.name||!body.prefix||!body.config) return json({error:"INVALID_INPUT",message:"Vui lòng nhập đầy đủ mã định danh, tên biểu mẫu, tiền tố và cấu hình câu hỏi."},400);
    const existing=await env.DB.prepare("SELECT id FROM forms WHERE id=?").bind(idForm).first();
    if(existing) return json({error:"DUPLICATE_FORM_ID",message:`Biểu mẫu với mã "${idForm}" đã tồn tại.`},409);
    const wantPublish=(body.publish===true || body.enabled===true || body.enabled===1) && (hasPermission(user,"form.approve")||hasPermission(user,"approval.decide"));
    const enabledVal=wantPublish?1:0;
    const wfStatus=wantPublish?"published":"draft";
    const cfg={...body.config};
    cfg.form_type=cfg.form_type||body.form_type||"general";
    cfg.workflow_status=wfStatus;
    if(typeof cfg.profile_photo_required!=="boolean") cfg.profile_photo_required=false;
    if(typeof cfg.signature_required!=="boolean") cfg.signature_required=false;
    const cfgJson=JSON.stringify(cfg);
    await env.DB.prepare("INSERT INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json,updated_by) VALUES(?,?,?,?,?,?,?,?,1,?,?)")
      .bind(idForm,String(body.name).trim(),String(body.prefix).trim().toUpperCase(),body.description||"",body.audience||"public",body.min_age??null,enabledVal,body.recipient_email||"app@skyfirst.io.vn",cfgJson,user.id).run();
    try{await env.DB.prepare("INSERT INTO form_revisions(form_id,version,config_json,status,created_by) VALUES(?,1,?,?,?)").bind(idForm,cfgJson,wfStatus,user.id).run();}catch{}
    await audit(env,request,user,"Tạo biểu mẫu","form",idForm,{name:body.name,version:1,workflow_status:wfStatus,enabled:enabledVal});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,id:idForm,version:1,workflow_status:wfStatus,enabled:enabledVal},200);
  }
  const formRevsMatch=p.match(/^\/api\/admin\/forms\/([^/]+)\/revisions$/);
  if(formRevsMatch&&request.method==="GET"){
    const deny=requirePermission(user,"form.view");if(deny)return deny;
    const fid=decodeURIComponent(formRevsMatch[1]);
    if(!(await adminTableExists(env,"form_revisions"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT id,form_id,version,status,created_by,created_at FROM form_revisions WHERE form_id=? ORDER BY version DESC LIMIT 50").bind(fid).all();
    return json({items:rs.results||[]});
  }
  const formWorkflowMatch=p.match(/^\/api\/admin\/forms\/([^/]+)\/workflow$/);
  if(formWorkflowMatch&&request.method==="POST"){
    const fid=decodeURIComponent(formWorkflowMatch[1]),body=await readJson(request)||{};
    const action=String(body.action||"").trim();
    const current=await env.DB.prepare("SELECT * FROM forms WHERE id=?").bind(fid).first();
    if(!current) return json({error:"NOT_FOUND",message:"Không tìm thấy biểu mẫu."},404);
    let cfg={}; try{cfg=JSON.parse(current.config_json||"{}")}catch{}
    let nextWf=cfg.workflow_status||(current.enabled?"published":"draft");
    let nextEnabled=Number(current.enabled||0);
    if(action==="submit_review"){
      const deny=requirePermission(user,"form.manage");if(deny)return deny;
      nextWf="pending_review";
      nextEnabled=0;
    }else if(action==="approve"||action==="publish"){
      if(!hasAnyPermission(user,["form.approve","approval.decide"])) return json({error:"FORBIDDEN",message:"Cần quyền phê duyệt biểu mẫu (form.approve) để công bố biểu mẫu ra cổng công khai."},403);
      nextWf=action==="approve"?"approved":"published";
      nextEnabled=action==="publish"?1:0;
      cfg.approved_by=user.id;
      cfg.approved_at=new Date().toISOString();
      if(action==="publish") cfg.published_at=new Date().toISOString();
    }else if(action==="pause"||action==="draft"){
      const deny=requirePermission(user,"form.manage");if(deny)return deny;
      nextWf=action==="pause"?"paused":"draft";
      nextEnabled=0;
    }else if(action==="restore_version"){
      const deny=requirePermission(user,"form.manage");if(deny)return deny;
      const targetVer=Number(body.version||0);
      const rev=await env.DB.prepare("SELECT * FROM form_revisions WHERE form_id=? AND version=?").bind(fid,targetVer).first();
      if(!rev) return json({error:"REVISION_NOT_FOUND",message:"Không tìm thấy phiên bản biểu mẫu yêu cầu."},404);
      let revCfg={}; try{revCfg=JSON.parse(rev.config_json||"{}")}catch{}
      revCfg.workflow_status="draft";
      const nextVer=Number(current.version||1)+1;
      const nextCfgJson=JSON.stringify(revCfg);
      await env.DB.prepare("UPDATE forms SET enabled=0,version=?,config_json=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?")
        .bind(nextVer,nextCfgJson,user.id,fid).run();
      try{await env.DB.prepare("INSERT INTO form_revisions(form_id,version,config_json,status,created_by) VALUES(?,?,?,'draft',?)").bind(fid,nextVer,nextCfgJson,user.id).run();}catch{}
      await audit(env,request,user,"Khôi phục phiên bản biểu mẫu","form",fid,{restored_from:targetVer,version:nextVer});
      invalidatePublicCache(url,["/api/config"],ctx);
      return json({ok:true,version:nextVer,workflow_status:"draft",enabled:0});
    }else{
      return json({error:"INVALID_ACTION",message:"Thao tác quy trình biểu mẫu không hợp lệ."},400);
    }
    cfg.workflow_status=nextWf;
    if(body.note) cfg.review_note=String(body.note).trim();
    const cfgJson=JSON.stringify(cfg);
    await env.DB.prepare("UPDATE forms SET enabled=?,config_json=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?")
      .bind(nextEnabled,cfgJson,user.id,fid).run();
    try{await env.DB.prepare("UPDATE form_revisions SET status=? WHERE form_id=? AND version=?").bind(nextWf,fid,current.version).run();}catch{}
    await audit(env,request,user,`Chuyển trạng thái biểu mẫu (${nextWf})`,"form",fid,{action,workflow_status:nextWf,enabled:nextEnabled,note:body.note||""});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,workflow_status:nextWf,enabled:nextEnabled});
  }
  const formMatch=p.match(/^\/api\/admin\/forms\/([^/]+)$/);
  if(formMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"form.manage");if(deny)return deny;
    const fid=decodeURIComponent(formMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM forms WHERE id=?").bind(fid).first();if(!current)return json({error:"NOT_FOUND"},404);
    const curCfg=parseBodyJson(current,"config_json",{});
    const mergedCfg={...curCfg,...(body.config||{})};
    const wantEnabled = body.enabled !== undefined ? (body.enabled===false||body.enabled===0?0:1) : Number(current.enabled||0);
    if(wantEnabled===1 && Number(current.enabled||0)===0 && !hasAnyPermission(user,["form.approve","approval.decide"])){
      return json({error:"FORBIDDEN",message:"Cần quyền phê duyệt biểu mẫu (form.approve) để mở công khai biểu mẫu."},403);
    }
    mergedCfg.workflow_status = body.workflow_status || (wantEnabled===1 ? "published" : (mergedCfg.workflow_status==="published" ? "draft" : (mergedCfg.workflow_status||"draft")));
    const nextVersion=Number(current.version)+1,nextConfig=JSON.stringify(mergedCfg);
    await env.DB.prepare("UPDATE forms SET name=?,prefix=?,description=?,audience=?,min_age=?,enabled=?,recipient_email=?,version=?,config_json=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?")
      .bind(body.name||current.name,body.prefix||current.prefix,body.description??current.description,body.audience||current.audience,body.min_age??current.min_age,wantEnabled,body.recipient_email||current.recipient_email,nextVersion,nextConfig,user.id,fid).run();
    try{await env.DB.prepare("INSERT INTO form_revisions(form_id,version,config_json,status,created_by) VALUES(?,?,?,?,?)").bind(fid,nextVersion,nextConfig,mergedCfg.workflow_status,user.id).run();}catch{}
    await audit(env,request,user,"Cập nhật biểu mẫu","form",fid,{version:nextVersion,workflow_status:mergedCfg.workflow_status,enabled:wantEnabled});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,version:nextVersion,workflow_status:mergedCfg.workflow_status,enabled:wantEnabled});
  }

  if(p==="/api/admin/terms"&&request.method==="GET"){
    if(!hasAnyPermission(user,["term.view","form.view"])) return json({error:"FORBIDDEN",permission:"term.view"},403);
    const rs=await env.DB.prepare("SELECT * FROM terms ORDER BY code").all();return json({items:rs.results||[]});
  }
  if(p==="/api/admin/terms"&&request.method==="POST"){
    if(!hasAnyPermission(user,["term.manage","form.manage"])) return json({error:"FORBIDDEN",permission:"term.manage"},403);
    const body=await readJson(request)||{};
    const code=String(body.code||"").trim().toUpperCase();
    const name=String(body.name||"").trim();
    const version=String(body.version||"01/2026").trim();
    const scope=String(body.scope||"Toàn hệ thống").trim();
    const content=String(body.body||"").trim();
    const status=["draft","published","archived"].includes(body.status)?body.status:"draft";
    if(!code||!name||!content) return json({error:"INVALID_INPUT",message:"Mã điều khoản, tên điều khoản và nội dung là bắt buộc."},400);
    const existing=await env.DB.prepare("SELECT code FROM terms WHERE code=?").bind(code).first();
    if(existing) return json({error:"DUPLICATE_TERM_CODE",message:`Điều khoản mã "${code}" đã tồn tại.`},409);
    await env.DB.prepare("INSERT INTO terms(code,name,version,scope,body,status,updated_at,updated_by) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,?)")
      .bind(code,name,version,scope,content,status,user.id).run();
    if(await adminTableExists(env,"term_revisions")){
      try{
        await env.DB.prepare("INSERT INTO term_revisions(term_code,name,version,scope,body,status,change_note,created_by) VALUES(?,?,?,?,?,?,?,?)")
          .bind(code,name,version,scope,content,status,String(body.change_note||"Tạo mới điều khoản"),user.id).run();
      }catch{}
    }
    await audit(env,request,user,"Tạo điều khoản mới","term",code,{name,version,status});
    return json({ok:true,code,version,status},201);
  }
  const termRevMatch=p.match(/^\/api\/admin\/terms\/(.+)\/revisions$/);
  if(termRevMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["term.view","form.view"])) return json({error:"FORBIDDEN",permission:"term.view"},403);
    const code=decodeURIComponent(termRevMatch[1]);
    if(!(await adminTableExists(env,"term_revisions"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT * FROM term_revisions WHERE term_code=? ORDER BY id DESC LIMIT 50").bind(code).all();
    return json({items:rs.results||[]});
  }
  const termMatch=p.match(/^\/api\/admin\/terms\/(.+)$/);
  if(termMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["term.manage","form.manage"])) return json({error:"FORBIDDEN",permission:"term.manage"},403);
    const code=decodeURIComponent(termMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM terms WHERE code=?").bind(code).first();
    if(!current) return json({error:"NOT_FOUND",message:"Không tìm thấy điều khoản cần cập nhật."},404);
    const nextName=String(body.name||current.name).trim();
    const nextVersion=String(body.version||current.version).trim();
    const nextScope=String(body.scope??current.scope??"").trim();
    const nextBody=String(body.body??current.body??"");
    const nextStatus=["draft","published","archived"].includes(body.status)?body.status:(current.status||"published");
    if(await adminTableExists(env,"term_revisions")){
      try{
        const hasPrev=await env.DB.prepare("SELECT id FROM term_revisions WHERE term_code=? LIMIT 1").bind(code).first();
        if(!hasPrev){
          await env.DB.prepare("INSERT INTO term_revisions(term_code,name,version,scope,body,status,change_note,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)")
            .bind(code,current.name,current.version,current.scope||"",current.body||"",current.status||"published","Phiên bản gốc trước khi cập nhật",current.updated_by||user.id,current.updated_at||new Date().toISOString()).run();
        }
      }catch{}
    }
    await env.DB.prepare("UPDATE terms SET name=?,version=?,scope=?,body=?,status=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE code=?")
      .bind(nextName,nextVersion,nextScope,nextBody,nextStatus,user.id,code).run();
    if(await adminTableExists(env,"term_revisions")){
      try{
        await env.DB.prepare("INSERT INTO term_revisions(term_code,name,version,scope,body,status,change_note,created_by) VALUES(?,?,?,?,?,?,?,?)")
          .bind(code,nextName,nextVersion,nextScope,nextBody,nextStatus,String(body.change_note||"Cập nhật nội dung điều khoản"),user.id).run();
      }catch{}
    }
    await audit(env,request,user,"Cập nhật điều khoản","term",code,{version:nextVersion,status:nextStatus});
    return json({ok:true,version:nextVersion,status:nextStatus});
  }

  const genericList=p.match(/^\/api\/admin\/content\/(news|classes|events|units|documents|tasks)$/);
  if(genericList&&request.method==="GET"){
    const type=genericList[1],g=GENERIC[type];
    const canView=hasPermission(user,g.permission)||(type==="documents"&&hasPermission(user,"document.view"))||(type==="units"&&hasPermission(user,"unit.view"));
    if(!canView) return json({error:"FORBIDDEN",permission:g.permission},403);
    const rs=await env.DB.prepare(`SELECT * FROM ${g.table} ORDER BY rowid DESC LIMIT 1500`).all();
    const items=(rs.results||[]).filter(row=>{
      const scopeCode = row.unit_code || (type==="units" ? row.code : "");
      return !scopeCode || canAccessScope(user, scopeCode);
    });
    return json({items});
  }
  if(genericList&&request.method==="POST"){
    const type=genericList[1],g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const body=await readJson(request)||{},data={...g.defaults,...body};
    const idValue=body[g.id]|| (g.id==="code"?String(body.code||"").trim():uid(type.slice(0,3)));
    if(!idValue) return json({error:"MISSING_ID"},400);
    const ins=await makeInsert(env,g.table,g.id,idValue,g.fields,data);
    await env.DB.prepare(ins.sql).bind(...ins.vals).run();
    if(type==="documents" && data.file_id && await adminTableExists(env,"document_versions")){
      try{
        const fMeta=await env.DB.prepare("SELECT filename,mime,size,sha256 FROM files WHERE id=?").bind(data.file_id).first();
        await env.DB.prepare("INSERT INTO document_versions(id,document_id,version_number,file_id,filename,mime,size,sha256,change_note,is_current,created_by) VALUES(?,?,1,?,?,?,?,?,'Phiên bản khởi tạo',1,?)")
          .bind(uid("docver"),String(idValue),data.file_id,fMeta?.filename||"",fMeta?.mime||"application/pdf",fMeta?.size||0,fMeta?.sha256||null,user.id).run();
      }catch{}
    }
    await audit(env,request,user,`Tạo ${type}`,type,String(idValue),data);invalidatePublicCache(url,[PUBLIC_CACHE_PATH[type]],ctx);return json({ok:true,id:idValue});
  }
  const genericOne=p.match(/^\/api\/admin\/content\/(news|classes|events|units|documents|tasks)\/([^/]+)$/);
  if(genericOne&&request.method==="PUT"){
    const [_,type,idRaw]=genericOne,g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const idValue=decodeURIComponent(idRaw),body=await readJson(request)||{},upd=await makeUpdate(env,g.table,g.id,idValue,g.fields,body);
    if(upd) await env.DB.prepare(upd.sql).bind(...upd.vals).run();
    await audit(env,request,user,`Cập nhật ${type}`,type,idValue,body);invalidatePublicCache(url,[PUBLIC_CACHE_PATH[type]],ctx);return json({ok:true});
  }
  if(genericOne&&request.method==="DELETE"){
    const [_,type,idRaw]=genericOne,g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const idValue=decodeURIComponent(idRaw);
    if(type==="documents" && await adminTableExists(env,"cms_pages")){
      const pageRef=await env.DB.prepare("SELECT COUNT(*) c FROM cms_pages WHERE blocks_json LIKE ?").bind(`%${idValue}%`).first();
      if(Number(pageRef?.c||0)>0) return json({error:"DOCUMENT_IN_USE",message:"Tài liệu đang được nhúng trên trang nội dung CMS. Vui lòng gỡ khỏi trang trước khi xóa.",references:Number(pageRef.c)},409);
    }
    await env.DB.prepare(`DELETE FROM ${g.table} WHERE ${g.id}=?`).bind(idValue).run();
    await audit(env,request,user,`Xóa ${type}`,type,idValue,{});invalidatePublicCache(url,[PUBLIC_CACHE_PATH[type]],ctx);return json({ok:true});
  }

  if(p==="/api/admin/teaching-scopes"&&request.method==="GET"){
    const deny=requirePermission(user,"people.view");if(deny)return deny;
    const rs=await env.DB.prepare(`SELECT ts.*,p.full_name,p.email FROM teaching_scopes ts JOIN people p ON p.id=ts.person_id ORDER BY ts.created_at DESC LIMIT 1000`).all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/admin/teaching-scopes"&&request.method==="POST"){
    const deny=requirePermission(user,"people.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.person_id||!body.scope)return json({error:"INVALID_INPUT"},400);
    const idT=uid("teach");
    await env.DB.prepare("INSERT INTO teaching_scopes(id,person_id,scope,status,assessment_note,approved_by,approved_at) VALUES(?,?,?,?,?,?,CASE WHEN ?='Đã duyệt' THEN CURRENT_TIMESTAMP ELSE NULL END)")
      .bind(idT,body.person_id,body.scope,body.status||"Đang đánh giá",body.assessment_note||"",body.status==="Đã duyệt"?user.id:null,body.status||"Đang đánh giá").run();
    await audit(env,request,user,"Tạo phạm vi giảng dạy","teaching_scope",idT,body);return json({ok:true,id:idT});
  }
  const teachMatch=p.match(/^\/api\/admin\/teaching-scopes\/([^/]+)$/);
  if(teachMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"people.manage");if(deny)return deny;
    const idT=decodeURIComponent(teachMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE teaching_scopes SET status=?,assessment_note=?,approved_by=CASE WHEN ?='Đã duyệt' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='Đã duyệt' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(body.status||"Đang đánh giá",body.assessment_note||"",body.status||"",user.id,body.status||"",idT).run();
    await audit(env,request,user,"Cập nhật phạm vi giảng dạy","teaching_scope",idT,body);return json({ok:true});
  }

  if(p==="/api/admin/data-requests"&&request.method==="GET"){
    const deny=requirePermission(user,"privacy.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM data_requests ORDER BY created_at DESC LIMIT 1000").all();return json({items:rs.results||[]});
  }
  const dataReqMatch=p.match(/^\/api\/admin\/data-requests\/([^/]+)$/);
  if(dataReqMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"privacy.manage");if(deny)return deny;
    const idR=decodeURIComponent(dataReqMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE data_requests SET status=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.status||"Đang xử lý",body.note||"",idR).run();
    await audit(env,request,user,"Xử lý yêu cầu quyền riêng tư","data_request",idR,body);return json({ok:true});
  }

  if(p==="/api/admin/approvals"&&request.method==="POST"){
    const can=hasPermission(user,"approval.request")||hasPermission(user,"submission.manage")||hasPermission(user,"approval.manage");
    if(!can)return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};if(!body.entity_type||!body.entity_id||!body.action)return json({error:"INVALID_INPUT"},400);
    const idA=uid("approval");
    await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at,note) VALUES(?,?,?,?,?,?,'pending',?,?)")
      .bind(idA,body.entity_type,body.entity_id,body.action,user.id,body.assigned_role||"network_secretary",body.due_at||null,body.note||"").run();
    await audit(env,request,user,"Gửi yêu cầu phê duyệt","approval",idA,body);return json({ok:true,id:idA});
  }

  if(p==="/api/admin/approvals"&&request.method==="GET"){
    const deny=requirePermission(user,"approval.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT a.*,u.full_name requester,d.full_name decider FROM approvals a LEFT JOIN users u ON u.id=a.requested_by LEFT JOIN users d ON d.id=a.decided_by ORDER BY a.created_at DESC LIMIT 1000").all();
    return json({items:rs.results||[]});
  }
  const approvalMatch=p.match(/^\/api\/admin\/approvals\/([^/]+)$/);
  if(approvalMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"approval.decide");if(deny)return deny;
    const idA=decodeURIComponent(approvalMatch[1]),body=await readJson(request)||{},status=body.status;
    if(!["approved","rejected","needs_more_info"].includes(status))return json({error:"INVALID_STATUS"},400);
    const a=await env.DB.prepare("SELECT * FROM approvals WHERE id=?").bind(idA).first();if(!a)return json({error:"NOT_FOUND"},404);
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
    if(status==="approved" && a.requested_by && Number(a.requested_by)===Number(user.id) && !isRoot){
      return json({error:"SELF_APPROVAL_FORBIDDEN",message:"Nguyên tắc kiểm soát hai bước: Người tạo đề nghị không được tự phê duyệt yêu cầu do chính mình gửi."},403);
    }
    await env.DB.prepare("UPDATE approvals SET status=?,note=?,decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(status,body.note||"",user.id,idA).run();
    if(a.entity_type==="certificate"&&status==="approved"){
      await env.DB.prepare("UPDATE certificates SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id,a.entity_id).run();
    }
    await audit(env,request,user,"Quyết định phê duyệt","approval",idA,{status,note:body.note||""});return json({ok:true});
  }

  if(p==="/api/admin/certificates"&&request.method==="GET"){
    const deny=requirePermission(user,"certificate.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM certificates ORDER BY created_at DESC LIMIT 1000").all();
    const items=(rs.results||[]).map(c=>{
      const meta=parseBodyJson(c,"metadata_json",{});
      return {...c,phone:c.phone||meta.phone||meta.phone_number||"",metadata:meta};
    });
    return json({items});
  }
  if(p==="/api/admin/certificates"&&request.method==="POST"){
    const deny=requirePermission(user,"certificate.request");if(deny)return deny;
    const body=await readJson(request)||{};
    const fullName=String(body.full_name||"").trim();
    const content=String(body.content||"").trim();
    const certType=String(body.cert_type||"").trim();
    if(!fullName||!content||!certType)return json({error:"INVALID_INPUT",message:"Họ tên người được cấp, loại tài liệu/chứng nhận và nội dung là bắt buộc."},400);
    const email=String(body.email||"").trim().toLowerCase();
    const rawMeta=(body.metadata&&typeof body.metadata==="object")?{...body.metadata}:{};
    const phone=String(body.phone??rawMeta.phone??rawMeta.phone_number??"").trim();
    if(phone) rawMeta.phone=phone;
    const customPrefix=String(body.prefix||body.type_prefix||body.doc_prefix||"").trim().toUpperCase();
    if(customPrefix) rawMeta.type_prefix=customPrefix;
    if(body.legacy_code) rawMeta.legacy_code=String(body.legacy_code).trim();
    const idC=uid("cert"),token=uid("verify");
    const certCols=await adminTableColumns(env,"certificates");
    const insCols=["id","cert_type","full_name","email","content","status","requested_by","verification_token","metadata_json"];
    const insVals=[idC,certType,fullName,email,content,body.status==="draft"?"draft":"pending_approval",user.id,token,JSON.stringify(rawMeta)];
    if(certCols.has("phone")){insCols.push("phone");insVals.push(phone);}
    if(certCols.has("legacy_code")&&body.legacy_code){insCols.push("legacy_code");insVals.push(String(body.legacy_code).trim());}
    if(certCols.has("file_id")&&body.file_id){insCols.push("file_id");insVals.push(String(body.file_id).trim());}
    await env.DB.prepare(`INSERT INTO certificates(${insCols.join(",")}) VALUES(${insCols.map(()=>"?").join(",")})`)
      .bind(...insVals).run();
    await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Khởi tạo bản ghi',?,?)")
      .bind(idC,body.note||`Tạo đề nghị cấp ${certType}`,user.id).run();
    const idA=uid("approval");
    await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at) VALUES(?,'certificate',?,'Phê duyệt cấp chứng nhận/văn bản',?,'network_secretary','pending',datetime('now','+7 days'))")
      .bind(idA,idC,user.id).run();
    await audit(env,request,user,"Đề nghị cấp chứng nhận/văn bản","certificate",idC,{cert_type:certType,approval:idA});
    return json({ok:true,id:idC,approval_id:idA,prefix:credentialKind(certType,customPrefix)});
  }
  const certHistoryMatch=p.match(/^\/api\/admin\/certificates\/([^/]+)\/history$/);
  if(certHistoryMatch&&request.method==="GET"){
    const deny=requirePermission(user,"certificate.view");if(deny)return deny;
    const idC=decodeURIComponent(certHistoryMatch[1]);
    const [cert,history]=await env.DB.batch([
      env.DB.prepare("SELECT * FROM certificates WHERE id=? OR code=?").bind(idC,idC),
      env.DB.prepare("SELECT action,note,actor_id,created_at FROM certificate_history WHERE certificate_id=? ORDER BY created_at DESC,id DESC").bind(idC)
    ]);
    const item=cert.results?.[0];if(!item)return json({error:"NOT_FOUND"},404);
    const histRows=item.id!==idC
      ? (await env.DB.prepare("SELECT action,note,actor_id,created_at FROM certificate_history WHERE certificate_id=? ORDER BY created_at DESC,id DESC").bind(item.id).all()).results||[]
      : (history.results||[]);
    const meta=parseBodyJson(item,"metadata_json",{});
    return json({item:{...item,phone:item.phone||meta.phone||"",metadata:meta},history:histRows});
  }

  const certMatch=p.match(/^\/api\/admin\/certificates\/([^/]+)$/);
  if(certMatch&&request.method==="GET"){
    const deny=requirePermission(user,"certificate.view");if(deny)return deny;
    const idC=decodeURIComponent(certMatch[1]);
    const item=await env.DB.prepare("SELECT * FROM certificates WHERE id=? OR code=?").bind(idC,idC).first();
    if(!item)return json({error:"NOT_FOUND"},404);
    const meta=parseBodyJson(item,"metadata_json",{});
    const history=await env.DB.prepare("SELECT action,note,actor_id,created_at FROM certificate_history WHERE certificate_id=? ORDER BY created_at DESC,id DESC").bind(item.id).all();
    return json({item:{...item,phone:item.phone||meta.phone||"",metadata:meta},history:history.results||[]});
  }

  if(certMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["certificate.request","certificate.issue","certificate.approve"])) return json({error:"FORBIDDEN"},403);
    const idC=decodeURIComponent(certMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM certificates WHERE id=?").bind(idC).first();
    if(!current)return json({error:"NOT_FOUND"},404);
    if(["revoked","superseded"].includes(current.status)){
      return json({error:"IMMUTABLE_RECORD_STATE",message:"Không được phép chỉnh sửa trực tiếp bản ghi đã thu hồi hoặc đã được thay thế."},409);
    }
    const certCols=await adminTableColumns(env,"certificates");
    const curMeta=parseBodyJson(current,"metadata_json",{});
    const nextMeta={...curMeta,...(body.metadata&&typeof body.metadata==="object"?body.metadata:{})};
    const nextPhone=body.phone!==undefined?String(body.phone||"").trim():(current.phone||curMeta.phone||"");
    if(nextPhone) nextMeta.phone=nextPhone;
    const nextEmail=body.email!==undefined?String(body.email||"").trim().toLowerCase():(current.email||"");

    if(current.status==="issued"){
      // Issued records: core identity (code, full_name, cert_type, content) is immutable (must use supersede to change); only contact/file/supplementary metadata can be updated.
      if((body.full_name&&String(body.full_name).trim()!==current.full_name) || (body.content&&String(body.content).trim()!==current.content) || (body.cert_type&&String(body.cert_type).trim()!==current.cert_type)){
        return json({error:"ISSUED_CORE_FIELDS_IMMUTABLE",message:"Chứng nhận đã phát hành không được sửa trực tiếp họ tên, loại hoặc nội dung ghi nhận. Vui lòng sử dụng chức năng Thay thế (Supersede) để cấp mã mới."},409);
      }
      const sets=["email=?","metadata_json=?","updated_at=CURRENT_TIMESTAMP"],vals=[nextEmail,JSON.stringify(nextMeta)];
      if(certCols.has("phone")){sets.push("phone=?");vals.push(nextPhone);}
      if(certCols.has("file_id")&&body.file_id!==undefined){sets.push("file_id=?");vals.push(body.file_id||null);}
      vals.push(idC);
      await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Cập nhật thông tin liên hệ/đính kèm',?,?)")
        .bind(idC,String(body.note||"Cập nhật thông tin bổ sung"),user.id).run();
      await audit(env,request,user,"Cập nhật thông tin bổ sung chứng nhận","certificate",idC,{email:nextEmail,phone:nextPhone});
      return json({ok:true,id:idC,status:current.status});
    }

    // Draft / pending_approval / approved records before issuance
    const nextName=String(body.full_name||current.full_name).trim();
    const nextType=String(body.cert_type||current.cert_type).trim();
    const nextContent=String(body.content||current.content).trim();
    if(!nextName||!nextType||!nextContent) return json({error:"INVALID_INPUT"},400);
    const sets=["cert_type=?","full_name=?","email=?","content=?","metadata_json=?","updated_at=CURRENT_TIMESTAMP"];
    const vals=[nextType,nextName,nextEmail,nextContent,JSON.stringify(nextMeta)];
    if(certCols.has("phone")){sets.push("phone=?");vals.push(nextPhone);}
    if(certCols.has("file_id")&&body.file_id!==undefined){sets.push("file_id=?");vals.push(body.file_id||null);}
    if(certCols.has("legacy_code")&&body.legacy_code!==undefined){sets.push("legacy_code=?");vals.push(body.legacy_code?String(body.legacy_code).trim():null);}
    vals.push(idC);
    await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
    await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Chỉnh sửa thông tin',?,?)")
      .bind(idC,String(body.note||"Chỉnh sửa thông tin trước khi phát hành"),user.id).run();
    await audit(env,request,user,"Chỉnh sửa đề nghị chứng nhận","certificate",idC,{cert_type:nextType,full_name:nextName});
    return json({ok:true,id:idC,status:current.status});
  }

  if(certMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["certificate.issue","certificate.approve","certificate.request"])) return json({error:"FORBIDDEN"},403);
    const idC=decodeURIComponent(certMatch[1]);
    const current=await env.DB.prepare("SELECT * FROM certificates WHERE id=?").bind(idC).first();
    if(!current)return json({error:"NOT_FOUND"},404);
    // Strict lifecycle rule: Issued, revoked, or superseded records must NEVER be deleted (audit & verification integrity)
    if(["issued","revoked","superseded"].includes(current.status) || current.code || current.issued_at){
      return json({
        error:"CANNOT_DELETE_ISSUED_CREDENTIAL",
        message:"Không được phép xóa bản ghi chứng nhận đã phát hành, đã thu hồi hoặc đã thay thế để bảo toàn lịch sử đối soát. Vui lòng sử dụng thao tác Thu hồi (Revoke) hoặc Thay thế (Supersede)."
      },409);
    }
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin","system_admin"].includes(r.role_id));
    if(current.status==="approved" && !isRoot && !hasPermission(user,"certificate.issue")){
      return json({error:"FORBIDDEN",message:"Chỉ người có thẩm quyền phát hành hoặc Quản trị viên hệ thống mới được hủy đề nghị đã duyệt."},403);
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM approvals WHERE entity_type='certificate' AND entity_id=?").bind(idC),
      env.DB.prepare("DELETE FROM certificate_history WHERE certificate_id=?").bind(idC),
      env.DB.prepare("DELETE FROM certificates WHERE id=?").bind(idC)
    ]);
    await audit(env,request,user,"Xóa bản ghi đề nghị chứng nhận chưa phát hành","certificate",idC,{full_name:current.full_name,cert_type:current.cert_type,previous_status:current.status});
    return json({ok:true,deleted_id:idC});
  }

  if(certMatch&&request.method==="PATCH"){
    const idC=decodeURIComponent(certMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM certificates WHERE id=?").bind(idC).first();if(!current)return json({error:"NOT_FOUND"},404);

    if(body.action==="update"||body.action==="edit"){
      if(!hasAnyPermission(user,["certificate.request","certificate.issue","certificate.approve"])) return json({error:"FORBIDDEN"},403);
      if(["revoked","superseded"].includes(current.status)){
        return json({error:"IMMUTABLE_RECORD_STATE",message:"Không được phép chỉnh sửa bản ghi đã thu hồi hoặc đã thay thế."},409);
      }
      if(current.status==="issued" && ((body.full_name&&String(body.full_name).trim()!==current.full_name) || (body.content&&String(body.content).trim()!==current.content) || (body.cert_type&&String(body.cert_type).trim()!==current.cert_type))){
        return json({error:"ISSUED_CORE_FIELDS_IMMUTABLE",message:"Chứng nhận đã phát hành không được sửa trực tiếp họ tên, loại hoặc nội dung ghi nhận."},409);
      }
      const certCols=await adminTableColumns(env,"certificates");
      const curMeta=parseBodyJson(current,"metadata_json",{});
      const nextMeta={...curMeta,...(body.metadata&&typeof body.metadata==="object"?body.metadata:{})};
      const nextPhone=body.phone!==undefined?String(body.phone||"").trim():(current.phone||curMeta.phone||"");
      if(nextPhone) nextMeta.phone=nextPhone;
      const nextEmail=body.email!==undefined?String(body.email||"").trim().toLowerCase():(current.email||"");
      const nextName=current.status==="issued"?current.full_name:String(body.full_name||current.full_name).trim();
      const nextType=current.status==="issued"?current.cert_type:String(body.cert_type||current.cert_type).trim();
      const nextContent=current.status==="issued"?current.content:String(body.content||current.content).trim();
      const sets=["cert_type=?","full_name=?","email=?","content=?","metadata_json=?","updated_at=CURRENT_TIMESTAMP"];
      const vals=[nextType,nextName,nextEmail,nextContent,JSON.stringify(nextMeta)];
      if(certCols.has("phone")){sets.push("phone=?");vals.push(nextPhone);}
      if(certCols.has("file_id")&&body.file_id!==undefined){sets.push("file_id=?");vals.push(body.file_id||null);}
      vals.push(idC);
      await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Chỉnh sửa thông tin',?,?)").bind(idC,String(body.note||"Cập nhật thông tin"),user.id).run();
      await audit(env,request,user,"Chỉnh sửa chứng nhận","certificate",idC,{cert_type:nextType,full_name:nextName});
      return json({ok:true,id:idC});
    }

    if(body.action==="approve"){
      if(!hasAnyPermission(user,["certificate.approve","approval.decide"])) return json({error:"FORBIDDEN",permission:"certificate.approve"},403);
      if(!["pending_approval","draft"].includes(current.status)){
        return json({error:"INVALID_STATE_TRANSITION",message:`Không thể phê duyệt bản ghi đang ở trạng thái "${current.status}".`},409);
      }
      const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
      if(current.requested_by && Number(current.requested_by)===Number(user.id) && !isRoot){
        return json({error:"SELF_APPROVAL_FORBIDDEN",message:"Nguyên tắc kiểm soát hai bước: Người tạo đề nghị không được tự phê duyệt yêu cầu do chính mình gửi."},403);
      }
      await env.DB.batch([
        env.DB.prepare("UPDATE certificates SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id,idC),
        env.DB.prepare("UPDATE approvals SET status='approved',note=?,decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE entity_type='certificate' AND entity_id=? AND status='pending'").bind(String(body.note||"Đã phê duyệt"),user.id,idC),
        env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Phê duyệt',?,?)").bind(idC,String(body.note||"Đã phê duyệt đủ điều kiện phát hành"),user.id)
      ]);
      await audit(env,request,user,"Phê duyệt đề nghị chứng nhận","certificate",idC,{note:body.note||""});
      return json({ok:true,status:"approved"});
    }

    if(body.action==="issue"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(current.status!=="approved")return json({error:"NOT_APPROVED",message:"Bản ghi phải được phê duyệt trước khi phát hành chính thức."},409);
      if(current.code||current.issued_at)return json({error:"ALREADY_ISSUED"},409);
      const curMeta=parseBodyJson(current,"metadata_json",{});
      const code=await generateCredentialCode(env,current.cert_type,body.prefix||body.type_prefix||curMeta.type_prefix||"");
      const immutableSnapshot={
        code,cert_type:current.cert_type,full_name:current.full_name,email:current.email||"",phone:current.phone||curMeta.phone||"",
        content:current.content,metadata:curMeta
      };
      const certCols=await adminTableColumns(env,"certificates"),sets=["code=?","status='issued'","issued_by=?","issued_at=CURRENT_TIMESTAMP","updated_at=CURRENT_TIMESTAMP"],vals=[code,user.id];
      if(certCols.has("public_id")){sets.splice(1,0,"public_id=?");vals.splice(1,0,code)}
      if(certCols.has("immutable_snapshot_json")){sets.push("immutable_snapshot_json=?");vals.push(JSON.stringify(immutableSnapshot))}
      vals.push(idC);
      await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
      if(await adminTableExists(env,"issued_document_codes")){
        try{await env.DB.prepare("INSERT OR IGNORE INTO issued_document_codes(document_id,document_type,lookup_code,random_digits,code_version,is_primary,is_active) VALUES(?,?,?,?, 'v3',1,1)")
          .bind(idC,credentialKind(current.cert_type,body.type_prefix||curMeta.type_prefix||""),code,code.split("-").pop()).run()}catch(err){console.error("CREDENTIAL_REGISTRY_SYNC",err)}
      }
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Phát hành',?,?)").bind(idC,body.note||"",user.id).run();
      if(current.supersedes_id){
        await env.DB.prepare("UPDATE certificates SET status='superseded',superseded_by_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('issued','revoked')")
          .bind(idC,current.supersedes_id).run();
        if(await adminTableExists(env,"issued_document_codes")){
          try{await env.DB.prepare("UPDATE issued_document_codes SET is_active=0 WHERE document_id=?").bind(current.supersedes_id).run()}catch{}
        }
        await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Được thay thế',?,?)")
          .bind(current.supersedes_id,`Thay thế bởi ${code}`,user.id).run();
      }
      if(current.email){
        const certUrl=`${env.APP_URL||"https://app.skyfirst.io.vn"}/gcn/${encodeURIComponent(code)}`;
        const mailTask=sendTemplatedEmail(env,"certificate_issued",current.email,{
          recipient_name:current.full_name,
          full_name:current.full_name,
          certificate_code:code,
          code,
          cert_type:current.cert_type,
          content:current.content,
          certificate_url:certUrl
        });
        if(ctx?.waitUntil) ctx.waitUntil(mailTask); else await mailTask;
      }
      await audit(env,request,user,"Phát hành Credential","certificate",idC,{code,registry:"ONE_SKY_FIRST"});return json({ok:true,code});
    }
    if(body.action==="revoke"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(!["issued","superseded"].includes(current.status))return json({error:"NOT_ISSUED"},409);
      const reason=String(body.note||body.reason||"").trim();
      const certCols=await adminTableColumns(env,"certificates"),sets=["status='revoked'","updated_at=CURRENT_TIMESTAMP"],vals=[];
      if(certCols.has("revoked_at")) sets.push("revoked_at=CURRENT_TIMESTAMP");
      if(certCols.has("revocation_reason")){sets.push("revocation_reason=?");vals.push(reason)}
      vals.push(idC);await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
      if(await adminTableExists(env,"issued_document_codes")){try{await env.DB.prepare("UPDATE issued_document_codes SET is_active=0 WHERE document_id=?").bind(idC).run()}catch{}}
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Thu hồi',?,?)").bind(idC,reason,user.id).run();
      if(current.email){
        const cCode=current.public_id||current.code||idC;
        const certUrl=`${env.APP_URL||"https://app.skyfirst.io.vn"}/gcn/${encodeURIComponent(cCode)}`;
        const mailTask=sendTemplatedEmail(env,"certificate_revoked",current.email,{
          recipient_name:current.full_name,
          full_name:current.full_name,
          certificate_code:cCode,
          code:cCode,
          cert_type:current.cert_type,
          status:"ĐÃ THU HỒI",
          revocation_reason:reason||"Thu hồi theo quyết định quản trị",
          certificate_url:certUrl
        });
        if(ctx?.waitUntil) ctx.waitUntil(mailTask); else await mailTask;
      }
      await audit(env,request,user,"Thu hồi Credential","certificate",idC,{previous_status:current.status,new_status:"revoked",reason});return json({ok:true});
    }
    if(body.action==="supersede"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(current.status!=="issued")return json({error:"ONLY_ISSUED_CAN_BE_SUPERSEDED"},409);
      const certCols=await adminTableColumns(env,"certificates");
      if(!certCols.has("supersedes_id")) return json({error:"FEATURE_TEMPORARILY_UNAVAILABLE",message:"Chức năng thay thế giấy chưa tương thích với cấu trúc dữ liệu hiện tại."},503);
      const replacementId=uid("cert"),token=uid("verify");
      const curMeta=parseBodyJson(current,"metadata_json",{});
      const meta={...curMeta,...(body.metadata&&typeof body.metadata==="object"?body.metadata:{}),replacement_reason:String(body.note||body.reason||"").trim(),replaces_code:current.public_id||current.code||idC};
      const nextName=String(body.full_name||current.full_name).trim();
      const nextType=String(body.cert_type||current.cert_type).trim();
      const nextContent=String(body.content||current.content).trim();
      const nextEmail=String(body.email??current.email??"").trim().toLowerCase();
      const nextPhone=String(body.phone??current.phone??curMeta.phone??"").trim();
      if(nextPhone) meta.phone=nextPhone;
      const insCols=["id","cert_type","full_name","email","content","status","requested_by","verification_token","metadata_json","supersedes_id"];
      const insVals=[replacementId,nextType,nextName,nextEmail,nextContent,"pending_approval",user.id,token,JSON.stringify(meta),idC];
      if(certCols.has("phone")){insCols.push("phone");insVals.push(nextPhone);}
      await env.DB.prepare(`INSERT INTO certificates(${insCols.join(",")}) VALUES(${insCols.map(()=>"?").join(",")})`)
        .bind(...insVals).run();
      const idA=uid("approval");
      await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at) VALUES(?,'certificate',?,'Phê duyệt credential thay thế',?,'network_secretary','pending',datetime('now','+7 days'))")
        .bind(idA,replacementId,user.id).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Khởi tạo thay thế',?,?)").bind(idC,body.note||"",user.id).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Bản ghi thay thế được tạo',?,?)").bind(replacementId,`Thay thế cho ${current.code||idC}`,user.id).run();
      await audit(env,request,user,"Khởi tạo Credential thay thế","certificate",idC,{replacement_id:replacementId,approval:idA});
      return json({ok:true,replacement_id:replacementId,approval_id:idA});
    }
    return json({error:"INVALID_ACTION"},400);
  }

  if(p==="/api/admin/interviews"&&request.method==="POST"){
    const deny=requirePermission(user,"interview.manage");if(deny)return deny;
    const body=await readJson(request)||{},idI=uid("interview");
    await env.DB.prepare("INSERT INTO interviews(id,submission_code,scheduled_at,meeting_url,status,notes,created_by) VALUES(?,?,?,?,?,?,?)")
      .bind(idI,body.submission_code,body.scheduled_at||null,body.meeting_url||"",body.status||"scheduled",body.notes||"",user.id).run();
    if(body.submission_code){
      try{
        const sub=await env.DB.prepare("SELECT code,full_name,email,form_id FROM submissions WHERE code=?").bind(body.submission_code).first();
        if(sub?.email){
          await sendTemplatedEmail(env,"interview_scheduled",sub.email,{
            code:sub.code,
            full_name:sub.full_name||sub.email,
            scheduled_at:body.scheduled_at||"Sẽ thông báo chi tiết",
            meeting_url:body.meeting_url||"https://app.skyfirst.io.vn/ho-so",
            notes:body.notes||"Vui lòng kiểm tra lịch hẹn phỏng vấn.",
            status:"Mời phỏng vấn"
          });
        }
      }catch{}
    }
    await audit(env,request,user,"Tạo lịch phỏng vấn","interview",idI,body);return json({ok:true,id:idI});
  }
  if(p==="/api/admin/evaluations"&&request.method==="POST"){
    const deny=requirePermission(user,"evaluation.manage");if(deny)return deny;
    const body=await readJson(request)||{},idE=uid("eval");
    await env.DB.prepare("INSERT INTO evaluations(id,submission_code,evaluator_id,score_json,recommendation,note) VALUES(?,?,?,?,?,?)")
      .bind(idE,body.submission_code,user.id,JSON.stringify(body.score||{}),body.recommendation||"",body.note||"").run();
    await audit(env,request,user,"Đánh giá ứng viên","evaluation",idE,body);return json({ok:true,id:idE});
  }

  if(p==="/api/admin/tickets"&&request.method==="GET"){
    if(!hasAnyPermission(user,["ticket.manage","ticket.manage_assigned"])) return json({error:"FORBIDDEN",permission:"ticket.manage"},403);
    const onlyAssigned=!hasPermission(user,"ticket.manage")&&hasPermission(user,"ticket.manage_assigned");
    const rs=onlyAssigned
      ? await env.DB.prepare("SELECT * FROM tickets WHERE assigned_to=? ORDER BY created_at DESC LIMIT 1000").bind(user.id).all()
      : await env.DB.prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 1000").all();
    return json({items:rs.results||[]});
  }
  const ticketMatch=p.match(/^\/api\/admin\/tickets\/([^/]+)$/);
  if(ticketMatch&&request.method==="PATCH"){
    const idT=decodeURIComponent(ticketMatch[1]),body=await readJson(request)||{},sets=[],vals=[];
    const current=await env.DB.prepare("SELECT * FROM tickets WHERE id=?").bind(idT).first();
    if(!current) return json({error:"NOT_FOUND"},404);
    const canAll=hasPermission(user,"ticket.manage");
    const canAssigned=hasPermission(user,"ticket.manage_assigned")&&Number(current.assigned_to)===Number(user.id);
    if(!canAll&&!canAssigned) return json({error:"FORBIDDEN",permission:"ticket.manage"},403);
    for(const k of (canAll?["priority","status","assigned_to","subject"]:["priority","status"])) if(k in body){sets.push(`${k}=?`);vals.push(body[k])}
    if(sets.length){vals.push(idT);await env.DB.prepare(`UPDATE tickets SET ${sets.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...vals).run()}
    if(body.message){
      await env.DB.prepare("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_type,body) VALUES(?,?,'staff',?)").bind(idT,user.id,body.message).run();
      if(current.email){
        try{
          await sendTemplatedEmail(env,"support_ticket_reply",current.email,{
            full_name:current.submitter_name||current.email,
            ticket_code:current.code||idT,
            subject:current.subject||"Yêu cầu hỗ trợ",
            status:body.status||current.status||"Đang xử lý",
            reply_message:body.message
          });
        }catch{}
      }
    }
    await audit(env,request,user,"Cập nhật ticket","ticket",idT,body);return json({ok:true});
  }

  if(p==="/api/admin/email-templates"&&request.method==="GET"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const rs=await env.DB.prepare("SELECT * FROM email_templates ORDER BY key").all();return json({items:rs.results||[]});
  }
  const emailTpl=p.match(/^\/api\/admin\/email-templates\/([^/]+)$/);
  if(emailTpl&&request.method==="PUT"){
    const deny=requirePermission(user,"email.manage");if(deny)return deny;
    const key=decodeURIComponent(emailTpl[1]),body=await readJson(request)||{};
    if(!body.subject_template || !body.html_template) return json({error:"INVALID_INPUT",message:"Tiêu đề và nội dung HTML của mẫu email là bắt buộc."},400);
    await env.DB.prepare("INSERT INTO email_templates(key,subject_template,html_template,text_template,enabled,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET subject_template=excluded.subject_template,html_template=excluded.html_template,text_template=excluded.text_template,enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP")
      .bind(key,body.subject_template,body.html_template,body.text_template||"",body.enabled===false?0:1).run();
    if(await adminTableExists(env,"email_template_versions")){
      try{
        const vRow=await env.DB.prepare("SELECT COALESCE(MAX(version),0)+1 AS v FROM email_template_versions WHERE template_key=?").bind(key).first();
        await env.DB.prepare("INSERT INTO email_template_versions(template_key,version,subject_template,html_template,text_template,updated_by) VALUES(?,?,?,?,?,?)")
          .bind(key,Number(vRow?.v||1),body.subject_template,body.html_template,body.text_template||"",user.id).run();
      }catch{}
    }
    await audit(env,request,user,"Cập nhật mẫu email","email_template",key,{enabled:body.enabled!==false});return json({ok:true});
  }
  const emailPreviewMatch=p.match(/^\/api\/admin\/email-templates\/([^/]+)\/preview$/);
  if(emailPreviewMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const key=decodeURIComponent(emailPreviewMatch[1]),body=await readJson(request)||{};
    const row=await env.DB.prepare("SELECT * FROM email_templates WHERE key=?").bind(key).first();
    if(!row) return json({error:"NOT_FOUND"},404);
    const vIn = body.vars || {};
    const sampleVars={
      full_name: vIn.full_name || vIn.recipient_name || "Nguyễn Văn A",
      recipient_name: vIn.recipient_name || vIn.full_name || "Nguyễn Văn A",
      email: vIn.email || "nguyenvana@example.com",
      code: vIn.code || vIn.reference_code || vIn.request_id || "SFN-TV-2026-0001",
      application_code: vIn.application_code || vIn.code || vIn.reference_code || "SFN-TV-2026-0001",
      form_name: vIn.form_name || vIn.program_title || "Đăng ký Thành viên Sky First",
      program_name: vIn.program_name || vIn.program_title || "Tiếng Anh Cộng đồng SFEC",
      submitted_at: vIn.submitted_at || "22/10/2026 14:30",
      status: vIn.status || "Đã tiếp nhận",
      certificate_code: vIn.certificate_code || vIn.reference_code || "SFN-GCN-12345678",
      cert_type: vIn.cert_type || "Giấy chứng nhận",
      content: vIn.content || "Hoàn thành xuất sắc chương trình hoạt động cộng đồng.",
      certificate_url: vIn.certificate_url || "https://app.skyfirst.io.vn/gcn/SFN-GCN-12345678",
      requirement_note: vIn.requirement_note || "Vui lòng bổ sung minh chứng học tập hoặc kinh nghiệm liên quan.",
      result_summary: vIn.result_summary || "Hồ sơ đạt yêu cầu tuyển chọn vòng 1.",
      activation_link: vIn.activation_link || "https://app.skyfirst.io.vn/?reset=sample-token",
      ticket_code: vIn.ticket_code || vIn.reference_code || "SFN-SAFE-2026-0001",
      subject: vIn.subject || "Hỗ trợ tra cứu thông tin",
      campaign_code: vIn.campaign_code || "SFN-TT-2026-01",
      campaign_title: vIn.campaign_title || "Học bổng & Học liệu Cộng đồng 2026",
      target_amount: vIn.target_amount || "100.000.000 đồng",
      pledged_amount: vIn.pledged_amount || "60.000.000 đồng",
      received_amount: vIn.received_amount || "45.000.000 đồng",
      ...vIn
    };
    const rendered=renderEmailContent({
      key,
      subject_template:body.subject_template??row.subject_template,
      html_template:body.html_template??row.html_template,
      text_template:body.text_template??row.text_template
    },sampleVars);
    return json({ok:true,preview:rendered});
  }
  const emailTestMatch=p.match(/^\/api\/admin\/email-templates\/([^/]+)\/test$/);
  if(emailTestMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["email.send_test","email.manage"])) return json({error:"FORBIDDEN",permission:"email.send_test"},403);
    const key=decodeURIComponent(emailTestMatch[1]),body=await readJson(request)||{};
    const to=String(body.to_email||user.email||"").trim().toLowerCase();
    if(!to||!to.includes("@")) return json({error:"INVALID_EMAIL",message:"Địa chỉ email nhận thử không hợp lệ."},400);
    const res=await sendTemplatedEmail(env,key,to,{
      full_name:user.full_name||"Quản trị viên",
      recipient_name:user.full_name||"Quản trị viên",
      email:to,
      code:"SFN-TEST-0001",
      form_name:"Kiểm thử mẫu email hệ thống",
      program_name:"Chương trình kiểm thử",
      submitted_at:new Date().toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}),
      status:"Kiểm thử mẫu email",
      certificate_code:"SFN-GCN-00000000",
      cert_type:"Giấy chứng nhận (Thử nghiệm)",
      content:"Nội dung kiểm thử hiển thị mẫu email.",
      certificate_url:"https://app.skyfirst.io.vn/gcn",
      requirement_note:"Nội dung kiểm thử yêu cầu bổ sung thông tin.",
      result_summary:"Nội dung kiểm thử thông báo kết quả xử lý.",
      activation_link:"https://app.skyfirst.io.vn/admin/login",
      ticket_code:"SFN-TICKET-TEST",
      subject:"Kiểm thử gửi email",
      campaign_code:"SFN-TT-TEST",
      campaign_title:"Chiến dịch kiểm thử",
      target_amount:"0 đồng",
      pledged_amount:"0 đồng",
      received_amount:"0 đồng",
      ...(body.vars||{})
    },{skipDedupe:true});
    await audit(env,request,user,"Gửi thử mẫu email","email_template",key,{to,ok:res.ok,pending:!!res.pending,error:res.error||""});
    return json({ok:res.ok,pending:!!res.pending,error:res.error||null,message:res.ok?"Đã gửi email thử tới nhà cung cấp.":res.pending?"Đã ghi nhận vào nhật ký (chưa cấu hình RESEND_API_KEY / EMAIL binding).":res.error});
  }
  const emailVersionsMatch=p.match(/^\/api\/admin\/email-templates\/([^/]+)\/versions$/);
  if(emailVersionsMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const key=decodeURIComponent(emailVersionsMatch[1]);
    if(!(await adminTableExists(env,"email_template_versions"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT id,template_key,version,subject_template,updated_by,created_at FROM email_template_versions WHERE template_key=? ORDER BY version DESC LIMIT 50").bind(key).all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/admin/email-logs"&&request.method==="GET"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const rs=await env.DB.prepare("SELECT * FROM email_logs ORDER BY id DESC LIMIT 1000").all();return json({items:rs.results||[]});
  }

  if(p==="/api/admin/audit"&&request.method==="GET"){
    const deny=requirePermission(user,"audit.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 2000").all();return json({items:rs.results||[]});
  }

  if(p==="/api/admin/search"&&request.method==="GET"){
    const deny=requirePermission(user,"search.use");if(deny)return deny;
    const q=String(url.searchParams.get("q")||"").trim();if(q.length<2)return json({items:[]});
    const like=`%${q}%`;
    const [s,pe,c,d,t]=await env.DB.batch([
      env.DB.prepare("SELECT 'submission' kind,code ref,full_name title,status detail FROM submissions WHERE code LIKE ? OR full_name LIKE ? OR email LIKE ? LIMIT 30").bind(like,like,like),
      env.DB.prepare("SELECT 'person' kind,CAST(id AS TEXT) ref,full_name title,COALESCE(position,'') detail FROM people WHERE full_name LIKE ? OR email LIKE ? LIMIT 30").bind(like,like),
      env.DB.prepare("SELECT 'certificate' kind,COALESCE(code,id) ref,full_name title,content detail FROM certificates WHERE code LIKE ? OR full_name LIKE ? LIMIT 30").bind(like,like),
      env.DB.prepare("SELECT 'document' kind,code ref,title,doc_type detail FROM documents WHERE code LIKE ? OR title LIKE ? LIMIT 30").bind(like,like),
      env.DB.prepare("SELECT 'ticket' kind,code ref,COALESCE(subject,submitter_name) title,status detail FROM tickets WHERE code LIKE ? OR subject LIKE ? OR submitter_name LIKE ? LIMIT 30").bind(like,like,like)
    ]);
    return json({items:[...(s.results||[]),...(pe.results||[]),...(c.results||[]),...(d.results||[]),...(t.results||[])]});
  }

  if(p==="/api/admin/backup"&&request.method==="POST"){
    const deny=requirePermission(user,"backup.create");if(deny)return deny;
    const res=await buildBackupSnapshot(env,"manual",user.id);
    await audit(env,request,user,"Tạo bản sao dữ liệu","backup",res.id,{key:res.r2_key,sha256:res.sha256,size:res.size});
    return json({ok:true,id:res.id,r2_key:res.r2_key,sha256:res.sha256,size:res.size,table_counts:res.table_counts});
  }
  if(p==="/api/admin/backups"&&request.method==="GET"){
    const deny=requirePermission(user,"backup.create");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM backups ORDER BY created_at DESC LIMIT 100").all();return json({items:rs.results||[]});
  }
  const verifyBackupMatch=p.match(/^\/api\/admin\/backups\/([^/]+)\/verify$/);
  if(verifyBackupMatch&&request.method==="GET"){
    const deny=requirePermission(user,"backup.create");if(deny)return deny;
    const idB=decodeURIComponent(verifyBackupMatch[1]);
    const b=await env.DB.prepare("SELECT * FROM backups WHERE id=?").bind(idB).first();
    if(!b) return json({error:"NOT_FOUND"},404);
    const obj=await env.FILES?.get(b.r2_key);
    if(!obj) return json({ok:false,error:"BACKUP_OBJECT_NOT_FOUND"},404);
    const raw=await obj.text();
    const actualSha=await sha256Hex(raw);
    if(b.sha256 && b.sha256!==actualSha){
      return json({ok:false,error:"BACKUP_CHECKSUM_MISMATCH",expected:b.sha256,actual:actualSha},409);
    }
    let parsed=null;
    try{parsed=JSON.parse(raw)}catch{return json({ok:false,error:"BACKUP_CORRUPTED_JSON"},409)}
    if(!parsed||typeof parsed.tables!=="object") return json({ok:false,error:"BACKUP_INVALID_STRUCTURE"},409);
    return json({ok:true,id:idB,sha256:actualSha,table_counts:parsed.table_counts||{},tables:Object.keys(parsed.tables)});
  }

  if(p==="/api/admin/export/submissions.csv"&&request.method==="GET"){
    const deny=requirePermission(user,"export.use");if(deny)return deny;
    const fId=url.searchParams.get("form_id")||url.searchParams.get("form")||"";
    const st=url.searchParams.get("status")||"";
    let sql="SELECT code,form_id,full_name,email,status,score,created_at,updated_at FROM submissions WHERE 1=1";
    const binds=[];
    if(fId){sql+=" AND form_id=?";binds.push(fId);}
    if(st){sql+=" AND status=?";binds.push(st);}
    sql+=" ORDER BY id DESC";
    const rs=await env.DB.prepare(sql).bind(...binds).all();
    const rows=["code,form_id,full_name,email,status,score,created_at,updated_at"];
    for(const x of rs.results||[])rows.push([x.code,x.form_id,x.full_name,x.email,x.status,x.score,x.created_at,x.updated_at].map(csvEscape).join(","));
    await audit(env,request,user,"Xuất CSV hồ sơ","submission","csv",{form_id:fId,status:st,count:(rs.results||[]).length});
    return new Response("\ufeff"+rows.join("\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=SFN_submissions.csv"}});
  }

  if(p==="/api/admin/export/sponsorship.csv"&&request.method==="GET"){
    if(!hasAnyPermission(user,["sponsorship.view","sponsorship.manage","sponsorship.approve","export.use"])) return json({error:"FORBIDDEN"},403);
    const campId=url.searchParams.get("campaign_id")||"";
    let sql="SELECT t.tx_code,c.code AS campaign_code,t.tx_type,t.amount,t.expected_amount,t.currency,t.verification_status,t.payment_state,t.is_public,t.reference_code,t.provider_tx_id,t.public_party_label,t.purpose,t.reconciliation_note,t.occurred_at,t.verified_at FROM sponsorship_transactions t JOIN sponsorship_campaigns c ON c.id=t.campaign_id WHERE 1=1";
    const binds=[];
    if(campId){sql+=" AND t.campaign_id=?";binds.push(campId);}
    sql+=" ORDER BY t.occurred_at DESC";
    const rs=await env.DB.prepare(sql).bind(...binds).all();
    const rows=["tx_code,campaign_code,tx_type,amount,expected_amount,currency,verification_status,payment_state,is_public,reference_code,provider_tx_id,public_party_label,purpose,reconciliation_note,occurred_at,verified_at"];
    for(const x of rs.results||[]){
      rows.push([x.tx_code,x.campaign_code,x.tx_type,x.amount,x.expected_amount,x.currency,x.verification_status,x.payment_state,x.is_public,x.reference_code,x.provider_tx_id,x.public_party_label,x.purpose,x.reconciliation_note,x.occurred_at,x.verified_at].map(csvEscape).join(","));
    }
    await audit(env,request,user,"Xuất CSV giao dịch đối soát tài trợ","sponsorship_transaction","csv",{campaign_id:campId,count:(rs.results||[]).length});
    return new Response("\ufeff"+rows.join("\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=SFN_sponsorship_reconciliation.csv"}});
  }

  if(p==="/api/admin/upload"&&request.method==="POST"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const fd=await request.formData(),file=fd.get("file");
    if(!file||typeof file!=="object"||!("size" in file)||!file.size)return json({error:"FILE_REQUIRED"},400);
    const maxMb=Number(await setting(env,"max_upload_mb",10));if(file.size>maxMb*1024*1024)return json({error:"FILE_TOO_LARGE"},400);
    const allowed=new Set(["image/jpeg","image/png","image/webp","application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
    if(!file.type||!allowed.has(file.type))return json({error:"FILE_TYPE_NOT_ALLOWED"},400);
    const bytes=await file.arrayBuffer();
    if(!magicBytesOk(file.type,bytes.slice(0,16)))return json({error:"FILE_SIGNATURE_MISMATCH",message:"Nội dung tệp không khớp với định dạng khai báo."},400);
    const idF=uid("file"),safe=String(file.name||"file").replace(/[^\p{L}\p{N}._-]+/gu,"_").slice(0,120),key=`private/admin/${new Date().getUTCFullYear()}/${idF}/${safe}`;
    const hash=await sha256(bytes);
    await env.FILES.put(key,bytes,{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{sha256:hash}});
    const fileCols=await adminTableColumns(env,"files");
    if(fileCols.has("sha256")){
      await env.DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility,sha256) VALUES(?,?,?,?,?,?,?,?)")
        .bind(idF,user.id,key,safe,file.type||"",file.size||0,fd.get("visibility")==="public"?"public":"private",hash).run();
    }else{
      await env.DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility) VALUES(?,?,?,?,?,?,?)")
        .bind(idF,user.id,key,safe,file.type||"",file.size||0,fd.get("visibility")==="public"?"public":"private").run();
    }
    await audit(env,request,user,"Upload file","file",idF,{filename:safe,size:file.size});
    return json({ok:true,id:idF,filename:safe});
  }

  if(p==="/api/admin/files"&&request.method==="GET"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const fileCols=await adminTableColumns(env,"files");
    const hasDeletedAt=fileCols.has("deleted_at");
    const hasSha256=fileCols.has("sha256");
    const selectCols=["id","submission_code","field_key","filename","mime","size","visibility","created_at"];
    if(hasSha256) selectCols.push("sha256");
    if(hasDeletedAt) selectCols.push("deleted_at");
    const q=String(url.searchParams.get("q")||"").trim().toLowerCase();
    const vis=String(url.searchParams.get("visibility")||"all").trim();
    const page=Math.max(1,Number(url.searchParams.get("page")||1));
    const pageSize=Math.min(200,Math.max(10,Number(url.searchParams.get("limit")||50)));
    const whereClause=hasDeletedAt?"WHERE deleted_at IS NULL":"";
    const rs=await env.DB.prepare(`SELECT ${selectCols.join(",")} FROM files ${whereClause} ORDER BY created_at DESC LIMIT 1000`).all();
    let allItems=rs.results||[];
    if(vis==="public"||vis==="private") allItems=allItems.filter(f=>f.visibility===vis);
    if(q) allItems=allItems.filter(f=>[f.id,f.filename,f.mime,f.submission_code,f.field_key].join(" ").toLowerCase().includes(q));
    const total=allItems.length;
    const paged=url.searchParams.has("page") ? allItems.slice((page-1)*pageSize, page*pageSize) : allItems;
    return json({items:paged,total,page,page_size:pageSize,total_pages:Math.max(1,Math.ceil(total/pageSize))});
  }

  const fileMatch=p.match(/^\/api\/admin\/files\/([^/]+)$/);
  if(fileMatch&&request.method==="DELETE"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const idF=decodeURIComponent(fileMatch[1]),f=await env.DB.prepare("SELECT r2_key FROM files WHERE id=?").bind(idF).first();
    if(!f)return json({error:"NOT_FOUND"},404);
    const refQueries=[
      env.DB.prepare("SELECT COUNT(*) c FROM documents WHERE file_id=?").bind(idF),
      env.DB.prepare("SELECT COUNT(*) c FROM certificates WHERE file_id=?").bind(idF),
      env.DB.prepare("SELECT COUNT(*) c FROM submissions WHERE answers_json LIKE ?").bind(`%${idF}%`)
    ];
    if(await adminTableExists(env,"document_versions")) refQueries.push(env.DB.prepare("SELECT COUNT(*) c FROM document_versions WHERE file_id=?").bind(idF));
    if(await adminTableExists(env,"sponsorship_transactions")) refQueries.push(env.DB.prepare("SELECT COUNT(*) c FROM sponsorship_transactions WHERE voucher_file_id=?").bind(idF));
    if(await adminTableExists(env,"sponsorship_reports")) refQueries.push(env.DB.prepare("SELECT COUNT(*) c FROM sponsorship_reports WHERE file_id=?").bind(idF));
    if(await adminTableExists(env,"cms_pages")) refQueries.push(env.DB.prepare("SELECT COUNT(*) c FROM cms_pages WHERE cover_file_id=? OR blocks_json LIKE ?").bind(idF,`%${idF}%`));
    const refResults=await env.DB.batch(refQueries);
    const refs=refResults.reduce((acc,r)=>acc+Number(r.results?.[0]?.c||0),0);
    if(refs>0)return json({error:"ASSET_IN_USE",message:"File đang được dùng bởi hồ sơ, tài liệu, báo cáo tài trợ, trang CMS hoặc credential. Không thể xóa an toàn.",references:refs},409);
    await env.FILES.delete(f.r2_key);await env.DB.prepare("DELETE FROM files WHERE id=?").bind(idF).run();
    await audit(env,request,user,"Xóa file","file",idF,{});return json({ok:true});
  }

  if(p==="/api/admin/class-enrollments"&&request.method==="GET"){
    const deny=requirePermission(user,"class.manage");if(deny)return deny;
    const classId=url.searchParams.get("class_id");
    const rs=classId
      ? await env.DB.prepare("SELECT * FROM class_enrollments WHERE class_id=? ORDER BY id DESC").bind(classId).all()
      : await env.DB.prepare("SELECT * FROM class_enrollments ORDER BY id DESC LIMIT 1500").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/attendance"&&request.method==="POST"){
    const deny=requirePermission(user,"class.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.class_id||!body.enrollment_id||!body.session_date||!body.status)return json({error:"INVALID_INPUT"},400);
    await env.DB.prepare("INSERT INTO attendance(class_id,enrollment_id,session_date,status,note,marked_by) VALUES(?,?,?,?,?,?) ON CONFLICT(class_id,enrollment_id,session_date) DO UPDATE SET status=excluded.status,note=excluded.note,marked_by=excluded.marked_by")
      .bind(body.class_id,body.enrollment_id,body.session_date,body.status,body.note||"",user.id).run();
    await audit(env,request,user,"Điểm danh lớp","attendance",String(body.enrollment_id),body);return json({ok:true});
  }

  if(p==="/api/admin/event-registrations"&&request.method==="GET"){
    const deny=requirePermission(user,"event.manage");if(deny)return deny;
    const eventId=url.searchParams.get("event_id");
    const rs=eventId
      ? await env.DB.prepare("SELECT * FROM event_registrations WHERE event_id=? ORDER BY id DESC").bind(eventId).all()
      : await env.DB.prepare("SELECT * FROM event_registrations ORDER BY id DESC LIMIT 1500").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/event-checkin"&&request.method==="POST"){
    const deny=requirePermission(user,"event.manage");if(deny)return deny;
    const body=await readJson(request)||{},code=String(body.checkin_code||"");
    const r=await env.DB.prepare("SELECT id FROM event_registrations WHERE checkin_code=?").bind(code).first();
    if(!r)return json({error:"CHECKIN_NOT_FOUND"},404);
    await env.DB.prepare("UPDATE event_registrations SET checked_in_at=CURRENT_TIMESTAMP,status='Đã check-in' WHERE id=?").bind(r.id).run();
    await audit(env,request,user,"Check-in sự kiện","event_registration",String(r.id),{});return json({ok:true});
  }

  const restoreMatch=p.match(/^\/api\/admin\/backups\/([^/]+)\/restore$/);
  if(restoreMatch&&request.method==="POST"){
    if(!(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id)))return json({error:"SUPER_ADMIN_REQUIRED"},403);
    const idB=decodeURIComponent(restoreMatch[1]);
    const b=await env.DB.prepare("SELECT * FROM backups WHERE id=?").bind(idB).first();if(!b)return json({error:"NOT_FOUND"},404);
    const obj=await env.FILES.get(b.r2_key);if(!obj)return json({error:"BACKUP_OBJECT_NOT_FOUND"},404);
    const raw=await obj.text();
    const actualSha=await sha256Hex(raw);
    if(b.sha256 && b.sha256!==actualSha){
      return json({error:"BACKUP_CHECKSUM_MISMATCH",message:"Mã kiểm tra toàn vẹn SHA-256 của bản sao lưu không khớp. Từ chối phục hồi để bảo vệ dữ liệu.",expected:b.sha256,actual:actualSha},409);
    }
    let snap=null;
    try{snap=JSON.parse(raw)}catch{return json({error:"BACKUP_CORRUPTED_JSON"},409)}
    if(!snap||typeof snap.tables!=="object") return json({error:"BACKUP_INVALID_STRUCTURE"},409);

    // Tạo bản sao lưu an toàn trước khi phục hồi (pre-restore snapshot)
    const preRestore=await buildBackupSnapshot(env,"pre_restore",user.id);

    // Bảo toàn thông tin xác thực mật khẩu của người dùng hiện có nếu bản sao lưu đã ẩn password_hash
    const existingUsersRs=await env.DB.prepare("SELECT id,password_hash,password_salt,password_iterations,totp_secret FROM users").all();
    const userSecretMap=new Map((existingUsersRs.results||[]).map(u=>[Number(u.id),u]));

    const insertOrder=BACKUP_TABLES;
    const allowed=new Set(insertOrder);
    const stmts=[];
    // Xóa bảng con trước bảng cha trong cùng một batch nguyên tử
    for(const table of [...insertOrder].reverse()){
      if(!(table in (snap.tables||{}))||!(await adminTableExists(env,table)))continue;
      stmts.push(env.DB.prepare(`DELETE FROM ${table}`));
    }
    // Khôi phục bảng cha trước bảng con trong cùng một batch nguyên tử
    for(const table of insertOrder){
      if(!allowed.has(table)||!(table in (snap.tables||{}))||!(await adminTableExists(env,table)))continue;
      const liveCols=await adminTableColumns(env,table);
      for(const rawRow of snap.tables[table]||[]){
        const row={...rawRow};
        if(table==="users"){
          const prev=userSecretMap.get(Number(row.id));
          if(row.password_hash==="[REDACTED_SECRET]"&&prev){
            row.password_hash=prev.password_hash;
            row.password_salt=prev.password_salt;
            row.password_iterations=prev.password_iterations;
            if(!row.totp_secret) row.totp_secret=prev.totp_secret;
          }
        }
        const cols=Object.keys(row).filter(c=>liveCols.has(c)); if(!cols.length)continue;
        const sql=`INSERT INTO ${table}(${cols.join(",")}) VALUES(${cols.map(()=>"?").join(",")})`;
        stmts.push(env.DB.prepare(sql).bind(...cols.map(c=>row[c])));
      }
    }
    if(stmts.length){
      await env.DB.batch(stmts);
    }
    await audit(env,request,user,"Phục hồi dữ liệu từ backup","backup",idB,{pre_restore_backup_id:preRestore.id,sha256:actualSha,tables:Object.keys(snap.tables||{})});
    return json({ok:true,restored_backup_id:idB,pre_restore_backup_id:preRestore.id,sha256:actualSha});
  }

  // ================= MODULE TÀI TRỢ & MINH BẠCH TÀI CHÍNH (/api/admin/sponsorship) =================
  if(p==="/api/admin/sponsorship"&&request.method==="GET"){
    if(!hasAnyPermission(user,["sponsorship.view","sponsorship.manage","sponsorship.approve"])) return json({error:"FORBIDDEN",permission:"sponsorship.view"},403);
    if(!(await adminTableExists(env,"sponsorship_campaigns"))) return json({campaigns:[],transactions:[],reports:[],payment_intents:[],audit_trail:[]});
    const queries=[
      env.DB.prepare("SELECT * FROM sponsorship_campaigns ORDER BY created_at DESC LIMIT 200"),
      env.DB.prepare("SELECT t.*,c.code AS campaign_code,c.title AS campaign_title FROM sponsorship_transactions t JOIN sponsorship_campaigns c ON c.id=t.campaign_id ORDER BY t.occurred_at DESC,t.created_at DESC LIMIT 500"),
      env.DB.prepare("SELECT r.*,c.code AS campaign_code,c.title AS campaign_title FROM sponsorship_reports r JOIN sponsorship_campaigns c ON c.id=r.campaign_id ORDER BY r.created_at DESC LIMIT 200")
    ];
    const hasIntents=await adminTableExists(env,"sponsorship_payment_intents");
    const hasAudit=await adminTableExists(env,"sponsorship_audit_trail");
    if(hasIntents) queries.push(env.DB.prepare("SELECT * FROM sponsorship_payment_intents ORDER BY created_at DESC LIMIT 200"));
    if(hasAudit) queries.push(env.DB.prepare("SELECT * FROM sponsorship_audit_trail ORDER BY created_at DESC LIMIT 200"));
    const batchRes=await env.DB.batch(queries);
    const campaigns=(batchRes[0].results||[]).map(c=>{
      const rec=Number(c.received_amount||0),dis=Number(c.disbursed_amount||0),rem=rec-dis;
      return {...c,remaining_amount:rem,is_overspent:rem<0};
    });
    return json({
      campaigns,
      transactions:batchRes[1].results||[],
      reports:batchRes[2].results||[],
      napas_banks:NAPAS_BANKS,
      payment_intents:hasIntents?(batchRes[3]?.results||[]):[],
      audit_trail:hasAudit?(batchRes[hasIntents?4:3]?.results||[]):[]
    });
  }

  if(p==="/api/admin/sponsorship/campaigns"&&request.method==="POST"){
    const deny=requirePermission(user,"sponsorship.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const title=String(body.title||"").trim(),code=String(body.code||"").trim().toUpperCase();
    if(!title||!code) return json({error:"INVALID_INPUT",message:"Mã và tên chương trình tài trợ là bắt buộc."},400);
    const target=Math.max(0,Math.round(Number(body.target_amount||0)));
    const wantPublic=body.visibility==="public";
    if(wantPublic && !hasPermission(user,"sponsorship.approve")) return json({error:"FORBIDDEN",message:"Cần quyền phê duyệt tài trợ (sponsorship.approve) để công khai chương trình."},403);
    const id=uid("spcamp");
    const resolvedBank=resolveNapasBank({bank_bin:body.bank_bin,bank_code:body.bank_code,bank_name:body.bank_name});
    const finalBankBin=String(body.bank_bin||resolvedBank?.bin||"").replace(/\D/g,"");
    const finalBankName=String(body.bank_name||resolvedBank?.short_name||resolvedBank?.name||"").trim();
    const finalAccNo=String(body.bank_account_no||"").trim();
    const finalAccName=String(body.bank_account_name||(finalAccNo?"SKY FIRST NETWORK":"")).trim();
    const campCols=await adminTableColumns(env,"sponsorship_campaigns");
    if(campCols.has("bank_account_no")){
      await env.DB.prepare("INSERT INTO sponsorship_campaigns(id,code,website_id,title,summary,purpose,target_amount,pledged_amount,received_amount,disbursed_amount,currency,start_at,end_at,status,visibility,bank_name,bank_bin,bank_account_no,bank_account_name,approved_by,approved_at,created_by) VALUES(?,?,?,?,?,?,?,0,0,0,'VND',?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id,code,String(body.website_id||"app"),title,String(body.summary||""),String(body.purpose||""),target,body.start_at||null,body.end_at||null,body.status||"active",wantPublic?"public":"draft",finalBankName,finalBankBin,finalAccNo,finalAccName,wantPublic?user.id:null,wantPublic?new Date().toISOString():null,user.id).run();
    }else{
      await env.DB.prepare("INSERT INTO sponsorship_campaigns(id,code,website_id,title,summary,purpose,target_amount,pledged_amount,received_amount,disbursed_amount,currency,start_at,end_at,status,visibility,approved_by,approved_at,created_by) VALUES(?,?,?,?,?,?,?,0,0,0,'VND',?,?,?,?,?,?,?)")
        .bind(id,code,String(body.website_id||"app"),title,String(body.summary||""),String(body.purpose||""),target,body.start_at||null,body.end_at||null,body.status||"active",wantPublic?"public":"draft",wantPublic?user.id:null,wantPublic?new Date().toISOString():null,user.id).run();
    }
    await recordSponsorshipAudit(env,{campaign_id:id,action:"create_campaign",reason:body.purpose||title,new_state:{code,title,target_amount:target,visibility:wantPublic?"public":"draft"},actor_user_id:user.id,actor_email:user.email});
    await audit(env,request,user,"Tạo chương trình tài trợ","sponsorship_campaign",id,{code,title,target_amount:target,visibility:wantPublic?"public":"draft"});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true,id,code},201);
  }

  const spCampMatch=p.match(/^\/api\/admin\/sponsorship\/campaigns\/([^/]+)$/);
  if(spCampMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["sponsorship.manage","sponsorship.approve"])) return json({error:"FORBIDDEN",permission:"sponsorship.manage"},403);
    const id=decodeURIComponent(spCampMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM sponsorship_campaigns WHERE id=?").bind(id).first();
    if(!current) return json({error:"NOT_FOUND"},404);
    const nextVis=body.visibility??current.visibility;
    if(nextVis==="public" && current.visibility!=="public" && !hasPermission(user,"sponsorship.approve")){
      return json({error:"FORBIDDEN",message:"Chỉ người có quyền phê duyệt tài trợ mới được công khai chương trình."},403);
    }
    const target=body.target_amount!==undefined?Math.max(0,Math.round(Number(body.target_amount||0))):current.target_amount;
    const resolvedBank=resolveNapasBank({
      bank_bin:body.bank_bin??current.bank_bin,
      bank_code:body.bank_code,
      bank_name:body.bank_name??current.bank_name
    });
    const finalBankBin=body.bank_bin!==undefined ? String(body.bank_bin||resolvedBank?.bin||"").replace(/\D/g,"") : (resolvedBank?.bin||current.bank_bin||"");
    const finalBankName=body.bank_name!==undefined ? String(body.bank_name||resolvedBank?.short_name||"").trim() : (current.bank_name||resolvedBank?.short_name||"");
    const finalAccNo=body.bank_account_no!==undefined ? String(body.bank_account_no).trim() : (current.bank_account_no||"");
    const finalAccName=body.bank_account_name!==undefined ? String(body.bank_account_name).trim() : (current.bank_account_name||"");
    const campCols=await adminTableColumns(env,"sponsorship_campaigns");
    if(campCols.has("bank_account_no")){
      await env.DB.prepare("UPDATE sponsorship_campaigns SET title=?,summary=?,purpose=?,target_amount=?,start_at=?,end_at=?,status=?,visibility=?,bank_name=?,bank_bin=?,bank_account_no=?,bank_account_name=?,approved_by=CASE WHEN ?='public' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='public' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.title||current.title,body.summary??current.summary,body.purpose??current.purpose,target,body.start_at??current.start_at,body.end_at??current.end_at,body.status||current.status,nextVis,finalBankName,finalBankBin,finalAccNo,finalAccName,nextVis,user.id,nextVis,id).run();
    }else{
      await env.DB.prepare("UPDATE sponsorship_campaigns SET title=?,summary=?,purpose=?,target_amount=?,start_at=?,end_at=?,status=?,visibility=?,approved_by=CASE WHEN ?='public' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='public' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.title||current.title,body.summary??current.summary,body.purpose??current.purpose,target,body.start_at??current.start_at,body.end_at??current.end_at,body.status||current.status,nextVis,nextVis,user.id,nextVis,id).run();
    }
    await recordSponsorshipAudit(env,{campaign_id:id,action:"update_campaign",reason:body.reason||"Cập nhật chương trình tài trợ",previous_state:{status:current.status,visibility:current.visibility,target_amount:current.target_amount},new_state:{status:body.status||current.status,visibility:nextVis,target_amount:target},actor_user_id:user.id,actor_email:user.email});
    await audit(env,request,user,"Cập nhật chương trình tài trợ","sponsorship_campaign",id,{status:body.status||current.status,visibility:nextVis,target_amount:target});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true});
  }

  if(p==="/api/admin/sponsorship/transactions"&&request.method==="POST"){
    const deny=requirePermission(user,"sponsorship.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const campaignId=String(body.campaign_id||"").trim();
    const txType=String(body.tx_type||"receipt").trim();
    const amount=Math.round(Number(body.amount||0));
    const validType=["pledge","receipt","disbursement","adjustment","refund"].includes(txType);
    const validAmount=txType==="adjustment"?(Number.isFinite(amount)&&amount!==0):(Number.isFinite(amount)&&amount>0);
    if(!campaignId||!validType||!validAmount){
      return json({error:"INVALID_INPUT",message:"Vui lòng chọn chương trình, loại giao dịch hợp lệ và số tiền hợp lệ (khác 0 với điều chỉnh, lớn hơn 0 với các loại giao dịch khác)."},400);
    }
    const purpose=String(body.purpose||body.reason||"").trim().slice(0,500);
    if(["adjustment","refund","disbursement"].includes(txType)&&!purpose){
      return json({error:"REASON_REQUIRED",message:"Giao dịch giải ngân, hoàn tiền hoặc điều chỉnh đối soát bắt buộc phải ghi rõ mục đích / lý do."},400);
    }
    const camp=await env.DB.prepare("SELECT id,code FROM sponsorship_campaigns WHERE id=?").bind(campaignId).first();
    if(!camp) return json({error:"CAMPAIGN_NOT_FOUND"},404);
    const id=uid("sptx"),txCode=body.tx_code?String(body.tx_code).trim().toUpperCase():`TX-${camp.code}-${await nextCounter(env,`sptx:${camp.code}`)}`;
    const dupCode=await env.DB.prepare("SELECT id FROM sponsorship_transactions WHERE tx_code=?").bind(txCode).first();
    if(dupCode) return json({error:"DUPLICATE_TX_CODE",message:"Mã giao dịch đã tồn tại."},409);
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
    if(body.verification_status==="verified"&&!hasPermission(user,"sponsorship.approve")){
      return json({error:"FORBIDDEN",permission:"sponsorship.approve",message:"Bạn không có quyền tự xác nhận đối soát giao dịch."},403);
    }
    const autoVerify=body.verification_status==="verified"&&hasPermission(user,"sponsorship.approve");
    const paymentState=autoVerify?(txType==="refund"?"refunded":txType==="adjustment"?"adjusted":"verified"):"pending";
    const txCols=await adminTableColumns(env,"sponsorship_transactions");
    if(txCols.has("payment_state")){
      await env.DB.prepare("INSERT INTO sponsorship_transactions(id,campaign_id,tx_code,tx_type,amount,expected_amount,currency,public_party_label,purpose,voucher_file_id,occurred_at,verification_status,payment_state,reference_code,provider_tx_id,reconciliation_note,is_public,verified_by,verified_at,created_by) VALUES(?,?,?,?,?,?,'VND',?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id,campaignId,txCode,txType,amount,body.expected_amount??amount,String(body.public_party_label||"Nhà tài trợ / Đơn vị thụ hưởng").slice(0,160),purpose,body.voucher_file_id||null,body.occurred_at||new Date().toISOString(),autoVerify?"verified":"pending",paymentState,String(body.reference_code||""),body.provider_tx_id||null,String(body.reconciliation_note||""),body.is_public?1:0,autoVerify?user.id:null,autoVerify?new Date().toISOString():null,user.id).run();
    }else{
      await env.DB.prepare("INSERT INTO sponsorship_transactions(id,campaign_id,tx_code,tx_type,amount,currency,public_party_label,purpose,voucher_file_id,occurred_at,verification_status,is_public,verified_by,verified_at,created_by) VALUES(?,?,?,?,?,'VND',?,?,?,?,?,?,?,?,?)")
        .bind(id,campaignId,txCode,txType,amount,String(body.public_party_label||"Nhà tài trợ / Đơn vị thụ hưởng").slice(0,160),purpose,body.voucher_file_id||null,body.occurred_at||new Date().toISOString(),autoVerify?"verified":"pending",body.is_public?1:0,autoVerify?user.id:null,autoVerify?new Date().toISOString():null,user.id).run();
    }
    const totals=await recalculateCampaignTotals(env,campaignId);
    await recordSponsorshipAudit(env,{campaign_id:campaignId,transaction_id:id,action:"create_transaction",reason:purpose,new_state:{tx_code:txCode,tx_type:txType,amount,verification_status:autoVerify?"verified":"pending",is_root_auto_verify:autoVerify&&isRoot,totals},actor_user_id:user.id,actor_email:user.email});
    await audit(env,request,user,"Ghi nhận giao dịch tài trợ","sponsorship_transaction",id,{tx_code:txCode,tx_type:txType,amount,verified:autoVerify,totals});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true,id,tx_code:txCode,totals},201);
  }

  const spTxMatch=p.match(/^\/api\/admin\/sponsorship\/transactions\/([^/]+)$/);
  if(spTxMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"sponsorship.approve");if(deny)return deny;
    const id=decodeURIComponent(spTxMatch[1]),body=await readJson(request)||{};
    const tx=await env.DB.prepare("SELECT * FROM sponsorship_transactions WHERE id=?").bind(id).first();
    if(!tx) return json({error:"NOT_FOUND"},404);
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
    if(body.verification_status==="verified" && tx.created_by && Number(tx.created_by)===Number(user.id) && !isRoot){
      return json({error:"SELF_APPROVAL_FORBIDDEN",message:"Nguyên tắc tách biệt nhiệm vụ tài chính: Người tạo giao dịch không được tự xác nhận đối soát giao dịch do chính mình khởi tạo."},403);
    }
    const vStatus=["pending","verified","rejected"].includes(body.verification_status)?body.verification_status:tx.verification_status;
    const isPub=body.is_public!==undefined?(body.is_public?1:0):tx.is_public;
    const note=String(body.reconciliation_note||body.reason||tx.reconciliation_note||"").trim();
    const txCols=await adminTableColumns(env,"sponsorship_transactions");
    if(txCols.has("payment_state")){
      const pState=body.payment_state||(vStatus==="verified"?(tx.tx_type==="refund"?"refunded":tx.tx_type==="adjustment"?"adjusted":"verified"):vStatus==="rejected"?"rejected":"pending");
      await env.DB.prepare("UPDATE sponsorship_transactions SET verification_status=?,payment_state=?,reconciliation_note=?,is_public=?,verified_by=?,verified_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(vStatus,pState,note,isPub,user.id,id).run();
    }else{
      await env.DB.prepare("UPDATE sponsorship_transactions SET verification_status=?,is_public=?,verified_by=?,verified_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(vStatus,isPub,user.id,id).run();
    }
    const totals=await recalculateCampaignTotals(env,tx.campaign_id);
    await recordSponsorshipAudit(env,{campaign_id:tx.campaign_id,transaction_id:id,action:"verify_transaction",reason:note||`Cập nhật trạng thái đối soát: ${vStatus}`,previous_state:{verification_status:tx.verification_status,is_public:tx.is_public},new_state:{verification_status:vStatus,is_public:isPub,totals},actor_user_id:user.id,actor_email:user.email});
    await audit(env,request,user,"Xác nhận đối soát giao dịch tài trợ","sponsorship_transaction",id,{verification_status:vStatus,is_public:isPub,reason:note,totals});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true,totals});
  }

  if(p==="/api/admin/sponsorship/reports"&&request.method==="POST"){
    const deny=requirePermission(user,"sponsorship.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.campaign_id||!body.title) return json({error:"INVALID_INPUT",message:"Chương trình và tiêu đề báo cáo là bắt buộc."},400);
    const publish=body.status==="published"&&hasPermission(user,"sponsorship.approve");
    const id=uid("sprep");
    await env.DB.prepare("INSERT INTO sponsorship_reports(id,campaign_id,title,report_period,file_id,summary,status,approved_by,published_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,body.campaign_id,String(body.title).trim(),String(body.report_period||""),body.file_id||null,String(body.summary||""),publish?"published":"draft",publish?user.id:null,publish?new Date().toISOString():null).run();
    await recordSponsorshipAudit(env,{campaign_id:body.campaign_id,action:"create_report",reason:body.title,new_state:{id,title:body.title,status:publish?"published":"draft"},actor_user_id:user.id,actor_email:user.email});
    await audit(env,request,user,"Tạo báo cáo minh bạch tài trợ","sponsorship_report",id,{title:body.title,status:publish?"published":"draft"});
    invalidatePublicCache(url,["/api/public/sponsorship"],ctx);
    return json({ok:true,id},201);
  }
  const spRepMatch=p.match(/^\/api\/admin\/sponsorship\/reports\/([^/]+)$/);
  if(spRepMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["sponsorship.manage","sponsorship.approve"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(spRepMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM sponsorship_reports WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    const nextStatus=body.status||curr.status;
    if(nextStatus==="published" && !hasPermission(user,"sponsorship.approve")) return json({error:"FORBIDDEN"},403);
    await env.DB.prepare("UPDATE sponsorship_reports SET title=?,report_period=?,file_id=?,summary=?,status=?,approved_by=CASE WHEN ?='published' THEN ? ELSE approved_by END,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE id=?")
      .bind(body.title||curr.title,body.report_period??curr.report_period,body.file_id??curr.file_id,body.summary??curr.summary,nextStatus,nextStatus,user.id,nextStatus,id).run();
    await audit(env,request,user,"Cập nhật báo cáo minh bạch tài trợ","sponsorship_report",id,{status:nextStatus});
    invalidatePublicCache(url,["/api/public/sponsorship"],ctx);
    return json({ok:true});
  }
  if(spRepMatch&&request.method==="DELETE"){
    const deny=requirePermission(user,"sponsorship.approve");if(deny)return deny;
    const id=decodeURIComponent(spRepMatch[1]);
    await env.DB.prepare("DELETE FROM sponsorship_reports WHERE id=?").bind(id).run();
    await audit(env,request,user,"Xóa báo cáo tài trợ","sponsorship_report",id,{});
    invalidatePublicCache(url,["/api/public/sponsorship"],ctx);
    return json({ok:true});
  }

  // ================= MODULE AN TOÀN & BÁO CÁO SỰ CỐ (/api/admin/safety-reports) =================
  if(p==="/api/admin/safety-reports"&&request.method==="GET"){
    if(!hasAnyPermission(user,["safety.view","safety.manage","ticket.manage"])) return json({error:"FORBIDDEN",permission:"safety.view"},403);
    if(!(await adminTableExists(env,"safety_reports"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT * FROM safety_reports ORDER BY created_at DESC LIMIT 500").all();
    return json({items:rs.results||[]});
  }
  const safeMatch=p.match(/^\/api\/admin\/safety-reports\/([^/]+)$/);
  if(safeMatch&&request.method==="PATCH"){
    if(!hasAnyPermission(user,["safety.manage","ticket.manage"])) return json({error:"FORBIDDEN",permission:"safety.manage"},403);
    const id=decodeURIComponent(safeMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE safety_reports SET status=?,severity=COALESCE(?,severity),resolution_note=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=? OR code=?")
      .bind(body.status||"Đang xác minh",body.severity||null,String(body.resolution_note||""),body.assigned_to||user.id,id,id).run();
    await audit(env,request,user,"Xử lý báo cáo sự cố an toàn","safety_report",id,body);
    return json({ok:true});
  }

  // ================= THƯ VIỆN PDF & PHIÊN BẢN TÀI LIỆU (/api/admin/documents/:id/versions) =================
  const docVerMatch=p.match(/^\/api\/admin\/documents\/([^/]+)\/versions$/);
  if(docVerMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["document.view","document.manage"])) return json({error:"FORBIDDEN",permission:"document.view"},403);
    const docId=decodeURIComponent(docVerMatch[1]);
    const doc=await env.DB.prepare("SELECT * FROM documents WHERE id=? OR code=?").bind(docId,docId).first();
    if(!doc) return json({error:"NOT_FOUND"},404);
    const rs=await env.DB.prepare("SELECT * FROM document_versions WHERE document_id=? ORDER BY version_number DESC").bind(doc.id).all();
    return json({document:doc,versions:rs.results||[]});
  }
  if(docVerMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["document.manage","document.version_manage"])) return json({error:"FORBIDDEN",permission:"document.version_manage"},403);
    const docId=decodeURIComponent(docVerMatch[1]),body=await readJson(request)||{};
    const doc=await env.DB.prepare("SELECT * FROM documents WHERE id=? OR code=?").bind(docId,docId).first();
    if(!doc) return json({error:"NOT_FOUND"},404);
    const fileId=String(body.file_id||"").trim();
    if(!fileId) return json({error:"FILE_REQUIRED"},400);
    const fMeta=await env.DB.prepare("SELECT * FROM files WHERE id=?").bind(fileId).first();
    if(!fMeta) return json({error:"FILE_NOT_FOUND"},404);
    const maxRow=await env.DB.prepare("SELECT COALESCE(MAX(version_number),0)+1 AS next_v FROM document_versions WHERE document_id=?").bind(doc.id).first();
    const nextV=Number(maxRow?.next_v||1),verId=uid("docver");
    await env.DB.batch([
      env.DB.prepare("UPDATE document_versions SET is_current=0 WHERE document_id=?").bind(doc.id),
      env.DB.prepare("INSERT INTO document_versions(id,document_id,version_number,file_id,filename,mime,size,sha256,change_note,is_current,created_by) VALUES(?,?,?,?,?,?,?,?,?,1,?)")
        .bind(verId,doc.id,nextV,fileId,fMeta.filename||"",fMeta.mime||"application/pdf",fMeta.size||0,fMeta.sha256||null,String(body.change_note||`Cập nhật phiên bản v${nextV}`),user.id),
      env.DB.prepare("UPDATE documents SET file_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(fileId,doc.id)
    ]);
    await audit(env,request,user,"Cập nhật phiên bản tài liệu PDF","document",doc.id,{version:nextV,file_id:fileId,change_note:body.change_note||""});
    invalidatePublicCache(url,["/api/public/resources"],ctx);
    return json({ok:true,version_id:verId,version_number:nextV},201);
  }
  const docVerRestoreMatch=p.match(/^\/api\/admin\/documents\/([^/]+)\/versions\/([^/]+)\/restore$/);
  if(docVerRestoreMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["document.manage","document.version_manage"])) return json({error:"FORBIDDEN",permission:"document.version_manage"},403);
    const docId=decodeURIComponent(docVerRestoreMatch[1]),verId=decodeURIComponent(docVerRestoreMatch[2]);
    const ver=await env.DB.prepare("SELECT * FROM document_versions WHERE id=? AND document_id=?").bind(verId,docId).first();
    if(!ver) return json({error:"VERSION_NOT_FOUND"},404);
    await env.DB.batch([
      env.DB.prepare("UPDATE document_versions SET is_current=0 WHERE document_id=?").bind(docId),
      env.DB.prepare("UPDATE document_versions SET is_current=1 WHERE id=?").bind(verId),
      env.DB.prepare("UPDATE documents SET file_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(ver.file_id,docId)
    ]);
    await audit(env,request,user,"Khôi phục phiên bản tài liệu","document",docId,{restored_version:ver.version_number,file_id:ver.file_id});
    invalidatePublicCache(url,["/api/public/resources"],ctx);
    return json({ok:true,version_number:ver.version_number});
  }

  const docLifecycleMatch=p.match(/^\/api\/admin\/documents\/([^/]+)\/lifecycle$/);
  if(docLifecycleMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["document.manage","document.approve"])) return json({error:"FORBIDDEN",permission:"document.manage"},403);
    const docId=decodeURIComponent(docLifecycleMatch[1]),body=await readJson(request)||{};
    const doc=await env.DB.prepare("SELECT * FROM documents WHERE id=? OR code=?").bind(docId,docId).first();
    if(!doc) return json({error:"NOT_FOUND"},404);
    const action=String(body.action||"").trim();
    const reason=String(body.reason||body.note||"").trim();
    let meta={}; try{meta=JSON.parse(doc.metadata_json||"{}")}catch{}
    const history=Array.isArray(meta.lifecycle_history)?meta.lifecycle_history:[];
    let nextStatus=doc.status,nextVis=doc.visibility;

    if(action==="publish"){
      nextStatus="Có hiệu lực"; nextVis="public";
    }else if(action==="unpublish"){
      nextStatus="Ngừng công bố"; nextVis="internal";
    }else if(action==="revoke"){
      nextStatus="Đã thu hồi"; nextVis="internal";
      meta.revoked_at=new Date().toISOString();
      meta.revocation_reason=reason||"Thu hồi theo quy trình quản trị";
    }else if(action==="replace"){
      nextStatus="Đã thay thế"; nextVis="internal";
      meta.replaced_by_code=String(body.replacement_code||"").trim();
      meta.replacement_reason=reason||"Thay thế bằng tài liệu mới";
    }else if(action==="restore"){
      nextStatus="Có hiệu lực"; nextVis=body.visibility||"public";
    }else if(action==="link_record"){
      meta.related_record_code=String(body.related_record_code||"").trim();
    }else{
      return json({error:"INVALID_ACTION"},400);
    }

    history.unshift({
      action,
      previous_status:doc.status,
      new_status:nextStatus,
      previous_visibility:doc.visibility,
      new_visibility:nextVis,
      reason,
      related_record_code:meta.related_record_code||"",
      actor_id:user.id,
      actor_email:user.email,
      timestamp:new Date().toISOString()
    });
    meta.lifecycle_history=history.slice(0,50);

    await env.DB.prepare("UPDATE documents SET status=?,visibility=?,metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(nextStatus,nextVis,JSON.stringify(meta),doc.id).run();
    await audit(env,request,user,`Vòng đời tài liệu: ${action}`,"document",doc.id,{previous_status:doc.status,new_status:nextStatus,previous_visibility:doc.visibility,new_visibility:nextVis,reason,related_record_code:meta.related_record_code||""});
    invalidatePublicCache(url,["/api/public/resources"],ctx);
    return json({ok:true,status:nextStatus,visibility:nextVis,metadata:meta});
  }

  // ================= QUẢN LÝ ĐA WEBSITE (/api/admin/websites) =================
  if(p==="/api/admin/websites"&&request.method==="GET"){
    if(!hasAnyPermission(user,["website.view","website.manage","cms.view","settings.manage"])) return json({error:"FORBIDDEN",permission:"website.view"},403);
    if(!(await adminTableExists(env,"websites"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT * FROM websites ORDER BY CASE WHEN id='app' THEN 0 ELSE 1 END, id ASC").all();
    const items=(rs.results||[]).filter(w=>canAccessScope(user,w.id)||canAccessScope(user,w.code));
    return json({items});
  }
  if(p==="/api/admin/websites"&&request.method==="POST"){
    const deny=requirePermission(user,"website.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const id=String(body.id||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    const code=String(body.code||id.toUpperCase()).trim().toUpperCase();
    const name=String(body.name||"").trim(),domain=String(body.domain||"").trim().toLowerCase();
    if(!id||!name||!domain) return json({error:"INVALID_INPUT",message:"Mã định danh, tên hiển thị và tên miền là bắt buộc."},400);
    await env.DB.prepare("INSERT INTO websites(id,code,name,domain,description,logo_url,primary_color,navy_color,status,config_json,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,code,name,domain,String(body.description||""),body.logo_url||"/assets/sfn-logo-tight.png",body.primary_color||"#0759b8",body.navy_color||"#071b35",body.status||"active",JSON.stringify(body.config||{}),user.id).run();
    await audit(env,request,user,"Thêm website vào hệ thống quản trị","website",id,{code,name,domain});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,id},201);
  }
  const siteMatch=p.match(/^\/api\/admin\/websites\/([^/]+)$/);
  if(siteMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"website.manage");if(deny)return deny;
    const id=decodeURIComponent(siteMatch[1]),body=await readJson(request)||{};
    if(!canAccessScope(user,id)) return json({error:"FORBIDDEN",message:"Tài khoản không có quyền quản trị phạm vi website này."},403);
    const curr=await env.DB.prepare("SELECT * FROM websites WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    const wCols=await adminTableColumns(env,"websites");
    if(wCols.has("maintenance_mode")){
      await env.DB.prepare("UPDATE websites SET name=?,domain=?,description=?,logo_url=?,primary_color=?,navy_color=?,status=?,maintenance_mode=?,maintenance_title=?,maintenance_message=?,maintenance_eta=?,config_json=?,theme_json=?,seo_json=?,i18n_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.name||curr.name,body.domain||curr.domain,body.description??curr.description,body.logo_url||curr.logo_url,body.primary_color||curr.primary_color,body.navy_color||curr.navy_color,body.status||curr.status,body.maintenance_mode??curr.maintenance_mode??"normal",body.maintenance_title??curr.maintenance_title??"",body.maintenance_message??curr.maintenance_message??"",body.maintenance_eta??curr.maintenance_eta??null,body.config?JSON.stringify(body.config):curr.config_json,body.theme?JSON.stringify(body.theme):(curr.theme_json||"{}"),body.seo?JSON.stringify(body.seo):(curr.seo_json||"{}"),body.i18n?JSON.stringify(body.i18n):(curr.i18n_json||"{}"),user.id,id).run();
    }else{
      await env.DB.prepare("UPDATE websites SET name=?,domain=?,description=?,logo_url=?,primary_color=?,navy_color=?,status=?,config_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.name||curr.name,body.domain||curr.domain,body.description??curr.description,body.logo_url||curr.logo_url,body.primary_color||curr.primary_color,body.navy_color||curr.navy_color,body.status||curr.status,body.config?JSON.stringify(body.config):curr.config_json,user.id,id).run();
    }
    await audit(env,request,user,"Cập nhật cấu hình website","website",id,{status:body.status||curr.status,domain:body.domain||curr.domain});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }
  if(siteMatch&&request.method==="DELETE"){
    const deny=requirePermission(user,"website.manage");if(deny)return deny;
    const id=decodeURIComponent(siteMatch[1]);
    if(["app","main","ctt","mail","member","sfec","exam"].includes(id)){
      return json({error:"CORE_WEBSITE_PROTECTED",message:"Website thuộc danh mục hệ sinh thái cốt lõi của Sky First, không được xóa."},409);
    }
    const pgRef=await env.DB.prepare("SELECT COUNT(*) c FROM cms_pages WHERE website_id=?").bind(id).first();
    if(Number(pgRef?.c||0)>0) return json({error:"WEBSITE_IN_USE",message:"Website đang có trang nội dung CMS liên kết.",references:Number(pgRef.c)},409);
    await env.DB.prepare("DELETE FROM websites WHERE id=?").bind(id).run();
    await audit(env,request,user,"Xóa website khỏi danh mục","website",id,{});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  // ================= CMS & TRÌNH DỰNG TRANG TRỰC QUAN KÉO THẢ (/api/admin/cms/*) =================
  if(p==="/api/admin/cms/run-scheduled"&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.publish","cms.edit","news.manage"])) return json({error:"FORBIDDEN"},403);
    const res=await runScheduledCmsPublishing(env);
    return json({ok:true,published_count:res.published,unpublished_count:res.unpublished});
  }
  if(p==="/api/admin/cms/pages"&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.approve","cms.publish","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.view"},403);
    if(!(await adminTableExists(env,"cms_pages"))) return json({items:[],templates:[],shared_blocks:[]});
    try{await runScheduledCmsPublishing(env);}catch{}
    const site=String(url.searchParams.get("website_id")||"").trim();
    if(site && !canAccessScope(user,site)) return json({error:"FORBIDDEN",message:"Bạn không có quyền truy cập phạm vi website này."},403);
    const pgCols=await adminTableColumns(env,"cms_pages");
    const orderExpr=pgCols.has("page_type")?"CASE WHEN page_type='system' THEN 0 ELSE 1 END, updated_at DESC":"updated_at DESC";
    const pagesRs=site
      ? await env.DB.prepare(`SELECT * FROM cms_pages WHERE website_id=? ORDER BY ${orderExpr} LIMIT 300`).bind(site).all()
      : await env.DB.prepare(`SELECT * FROM cms_pages ORDER BY ${orderExpr} LIMIT 300`).all();
    const tplRs=(await adminTableExists(env,"cms_templates")) ? await env.DB.prepare("SELECT * FROM cms_templates ORDER BY name").all() : {results:[]};
    const sbRs=(await adminTableExists(env,"cms_shared_blocks")) ? await env.DB.prepare("SELECT * FROM cms_shared_blocks ORDER BY name").all() : {results:[]};
    const pages=(pagesRs.results||[]).filter(pg=>canAccessScope(user,pg.website_id));
    const sharedBlocks=[];
    for(const sb of sbRs.results||[]){
      const usedBy=pages.filter(pg=>(pg.blocks_json||"").includes(sb.key)||(pg.blocks_json||"").includes(sb.id)||((pg.blocks_en_json||"").includes(sb.key)));
      sharedBlocks.push({...sb,affected_pages_count:usedBy.length,affected_pages:usedBy.map(u=>({id:u.id,slug:u.slug,title:u.title}))});
    }
    return json({items:pages,templates:tplRs.results||[],shared_blocks:sharedBlocks});
  }

  if(p==="/api/admin/cms/pages"&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.edit"},403);
    const body=await readJson(request)||{};
    const websiteId=String(body.website_id||"app").trim();
    if(!canAccessScope(user,websiteId)) return json({error:"FORBIDDEN",message:"Không có quyền tạo trang trên website này."},403);
    const title=String(body.title||"").trim();
    const slug=String(body.slug||"").trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
    if(!title||!slug) return json({error:"INVALID_INPUT",message:"Tiêu đề và đường dẫn (slug) là bắt buộc."},400);
    const dup=await env.DB.prepare("SELECT id FROM cms_pages WHERE website_id=? AND slug=?").bind(websiteId,slug).first();
    if(dup) return json({error:"SLUG_EXISTS",message:"Đường dẫn trang đã tồn tại trên website này."},409);
    const id=uid("page");
    const blocksJson=JSON.stringify(Array.isArray(body.blocks)?body.blocks:[]);
    const blocksEnJson=JSON.stringify(Array.isArray(body.blocks_en)?body.blocks_en:[]);
    const seoJson=JSON.stringify(body.seo||{});
    const seoEnJson=JSON.stringify(body.seo_en||{});
    const tagsJson=JSON.stringify(Array.isArray(body.tags)?body.tags:[]);
    const pgCols=await adminTableColumns(env,"cms_pages");
    if(pgCols.has("page_type")){
      await env.DB.batch([
        env.DB.prepare("INSERT INTO cms_pages(id,website_id,slug,page_type,route_path,locale,title,title_en,summary,summary_en,cover_file_id,category,tags_json,seo_json,seo_en_json,blocks_json,blocks_en_json,status,version,author_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',1,?)")
          .bind(id,websiteId,slug,body.page_type||"custom",body.route_path||`/trang/${slug}`,body.locale||"vi",title,String(body.title_en||""),String(body.summary||""),String(body.summary_en||""),body.cover_file_id||null,String(body.category||"general"),tagsJson,seoJson,seoEnJson,blocksJson,blocksEnJson,user.id),
        env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,1,?,?,?,'draft','Khởi tạo trang',?)")
          .bind(id,title,blocksJson,seoJson,user.id)
      ]);
    }else{
      await env.DB.batch([
        env.DB.prepare("INSERT INTO cms_pages(id,website_id,slug,title,summary,cover_file_id,category,tags_json,seo_json,blocks_json,status,version,author_id) VALUES(?,?,?,?,?,?,?,?,?,?,'draft',1,?)")
          .bind(id,websiteId,slug,title,String(body.summary||""),body.cover_file_id||null,String(body.category||"general"),tagsJson,seoJson,blocksJson,user.id),
        env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,1,?,?,?,'draft','Khởi tạo trang',?)")
          .bind(id,title,blocksJson,seoJson,user.id)
      ]);
    }
    await audit(env,request,user,"Tạo trang CMS","cms_page",id,{website_id:websiteId,slug,title});
    return json({ok:true,id,slug},201);
  }

  const cmsPageMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)$/);
  if(cmsPageMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.approve","cms.publish","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.view"},403);
    const id=decodeURIComponent(cmsPageMatch[1]);
    const page=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(id,id).first();
    if(!page) return json({error:"NOT_FOUND",message:"Không tìm thấy trang nội dung yêu cầu."},404);
    if(!canAccessScope(user,page.website_id)) return json({error:"FORBIDDEN"},403);
    let revsList=[];
    if(await adminTableExists(env,"cms_page_revisions")){
      try{
        const revs=await env.DB.prepare("SELECT id,version,title,status,note,created_by,created_at FROM cms_page_revisions WHERE page_id=? ORDER BY version DESC LIMIT 50").bind(page.id).all();
        revsList=revs.results||[];
      }catch{}
    }
    const isSys=page.page_type==="system"||String(page.id||"").startsWith("sys_");
    return json({
      item:{
        ...page,
        page_type:isSys?"system":(page.page_type||"custom"),
        blocks:parseBodyJson(page,"blocks_json",[]),
        blocks_en:parseBodyJson(page,"blocks_en_json",[]),
        seo:parseBodyJson(page,"seo_json",{}),
        seo_en:parseBodyJson(page,"seo_en_json",{}),
        tags:parseBodyJson(page,"tags_json",[])
      },
      revisions:revsList
    });
  }

  if(cmsPageMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["cms.edit","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.edit"},403);
    const id=decodeURIComponent(cmsPageMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(id,id).first();
    if(!curr) return json({error:"NOT_FOUND",message:"Không tìm thấy trang nội dung cần cập nhật."},404);
    const targetId=curr.id;
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const isSys=curr.page_type==="system"||String(targetId||"").startsWith("sys_");
    const nextVersion=Number(curr.version||1)+1;
    const title=String(body.title||curr.title||"").trim();
    if(!title) return json({error:"INVALID_INPUT",message:"Tiêu đề trang không được để trống."},400);
    const slug=isSys?curr.slug:(body.slug?String(body.slug).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,""):curr.slug);
    if(!slug) return json({error:"INVALID_INPUT",message:"Đường dẫn (slug) không hợp lệ."},400);
    if(slug!==curr.slug){
      const dup=await env.DB.prepare("SELECT id FROM cms_pages WHERE website_id=? AND slug=? AND id!=? LIMIT 1").bind(curr.website_id,slug,targetId).first();
      if(dup) return json({error:"SLUG_EXISTS",message:"Đường dẫn (slug) này đã tồn tại trên website hiện tại."},409);
    }
    const normalizeJsonArr=(val,fallback)=>{
      if(val===undefined) return fallback||"[]";
      if(Array.isArray(val)) return JSON.stringify(val);
      if(typeof val==="string"){try{const p=JSON.parse(val);return Array.isArray(p)?JSON.stringify(p):"[]";}catch{return "[]";}}
      return "[]";
    };
    const normalizeJsonObj=(val,fallback)=>{
      if(val===undefined) return fallback||"{}";
      if(val&&typeof val==="object"&&!Array.isArray(val)) return JSON.stringify(val);
      if(typeof val==="string"){try{const p=JSON.parse(val);return (p&&typeof p==="object"&&!Array.isArray(p))?JSON.stringify(p):"{}";}catch{return "{}";}}
      return "{}";
    };
    const blocksJson=normalizeJsonArr(body.blocks,curr.blocks_json);
    const blocksEnJson=normalizeJsonArr(body.blocks_en,curr.blocks_en_json);
    const seoJson=normalizeJsonObj(body.seo,curr.seo_json);
    const seoEnJson=normalizeJsonObj(body.seo_en,curr.seo_en_json);
    const tagsJson=normalizeJsonArr(body.tags,curr.tags_json);
    const nextStatus=(["approved","published"].includes(curr.status)&&!hasPermission(user,"cms.publish"))?"draft":curr.status;
    const pgCols=await adminTableColumns(env,"cms_pages");
    const validActorId=await resolveValidUserId(env,user?.id);

    const updSets=["slug=?","title=?","summary=?","cover_file_id=?","category=?","tags_json=?","seo_json=?","blocks_json=?","status=?","version=?","updated_at=CURRENT_TIMESTAMP"];
    const updVals=[slug,title,String(body.summary??curr.summary??""),body.cover_file_id??curr.cover_file_id??null,String(body.category||curr.category||"general"),tagsJson,seoJson,blocksJson,nextStatus,nextVersion];
    if(pgCols.has("title_en")){updSets.push("title_en=?");updVals.push(String(body.title_en??curr.title_en??""));}
    if(pgCols.has("summary_en")){updSets.push("summary_en=?");updVals.push(String(body.summary_en??curr.summary_en??""));}
    if(pgCols.has("seo_en_json")){updSets.push("seo_en_json=?");updVals.push(seoEnJson);}
    if(pgCols.has("blocks_en_json")){updSets.push("blocks_en_json=?");updVals.push(blocksEnJson);}
    if(pgCols.has("scheduled_at")){updSets.push("scheduled_at=?");updVals.push(body.scheduled_at!==undefined?body.scheduled_at:(curr.scheduled_at??null));}
    if(pgCols.has("unpublished_at")){updSets.push("unpublished_at=?");updVals.push(body.unpublished_at!==undefined?body.unpublished_at:(curr.unpublished_at??null));}
    if(pgCols.has("page_type")&&isSys){updSets.push("page_type='system'");}
    updVals.push(targetId);

    await env.DB.prepare(`UPDATE cms_pages SET ${updSets.join(",")} WHERE id=?`).bind(...updVals).run();
    if(await adminTableExists(env,"cms_page_revisions")){
      try{
        await env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,?,?,?,?,?,?,?)")
          .bind(targetId,nextVersion,title,blocksJson,seoJson,nextStatus,String(body.note||`Lưu phiên bản v${nextVersion}`),validActorId).run();
      }catch(revErr){console.warn("CMS_REVISION_INSERT_WARN",revErr);}
    }
    await audit(env,request,user,"Cập nhật trang CMS","cms_page",targetId,{version:nextVersion,status:nextStatus});
    if(nextStatus==="published") invalidatePublicCache(url,["/api/public/pages","/api/config"],ctx);
    return json({ok:true,id:targetId,version:nextVersion,status:nextStatus});
  }

  if(cmsPageMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["cms.publish","cms.template_manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(cmsPageMatch[1]);
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(id,id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    if(curr.page_type==="system"||String(curr.id||"").startsWith("sys_")) return json({error:"SYSTEM_PAGE_PROTECTED",message:"Trang hệ thống cốt lõi không được phép xóa (chỉ được phép chỉnh sửa nội dung/bố cục)."},409);
    await env.DB.prepare("DELETE FROM cms_pages WHERE id=?").bind(curr.id).run();
    await audit(env,request,user,"Xóa trang CMS","cms_page",curr.id,{slug:curr.slug});
    invalidatePublicCache(url,["/api/public/pages"],ctx);
    return json({ok:true});
  }

  const cmsDuplicateMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)\/duplicate$/);
  if(cmsDuplicateMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","news.manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(cmsDuplicateMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(id,id).first();
    if(!curr) return json({error:"NOT_FOUND",message:"Không tìm thấy trang gốc để nhân bản."},404);
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const newId=uid("page");
    let baseSlug=String(body.slug||`${curr.slug}-ban-sao`).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"")||"trang-ban-sao";
    let newSlug=body.slug?baseSlug:`${baseSlug}-${Math.floor(100+Math.random()*900)}`;
    for(let attempt=0;attempt<20;attempt++){
      const exists=await env.DB.prepare("SELECT id FROM cms_pages WHERE website_id=? AND slug=? LIMIT 1").bind(curr.website_id,newSlug).first();
      if(!exists) break;
      newSlug=`${baseSlug}-${Math.floor(1000+Math.random()*9000)}-${attempt+1}`;
    }
    const newTitle=String(body.title||`${curr.title} (Bản sao)`).trim();
    const pgCols=await adminTableColumns(env,"cms_pages");
    const validActorId=await resolveValidUserId(env,user?.id);
    const safeWebsiteId=(await env.DB.prepare("SELECT id FROM websites WHERE id=? LIMIT 1").bind(curr.website_id).first())?.id || "app";
    const insCols=["id","website_id","slug","title","summary","cover_file_id","category","tags_json","seo_json","blocks_json","status","version","author_id"];
    const insVals=[newId,safeWebsiteId,newSlug,newTitle,curr.summary||"",curr.cover_file_id||null,curr.category||"general",curr.tags_json||"[]",curr.seo_json||"{}",curr.blocks_json||"[]","draft",1,validActorId];
    if(pgCols.has("page_type")){insCols.push("page_type");insVals.push("custom");}
    if(pgCols.has("route_path")){insCols.push("route_path");insVals.push(`/trang/${newSlug}`);}
    if(pgCols.has("locale")){insCols.push("locale");insVals.push(curr.locale||"vi");}
    if(pgCols.has("title_en")){insCols.push("title_en");insVals.push(curr.title_en?`${curr.title_en} (Copy)`:"");}
    if(pgCols.has("summary_en")){insCols.push("summary_en");insVals.push(curr.summary_en||"");}
    if(pgCols.has("seo_en_json")){insCols.push("seo_en_json");insVals.push(curr.seo_en_json||"{}");}
    if(pgCols.has("blocks_en_json")){insCols.push("blocks_en_json");insVals.push(curr.blocks_en_json||"[]");}

    await env.DB.prepare(`INSERT INTO cms_pages(${insCols.join(",")}) VALUES(${insCols.map(()=>"?").join(",")})`).bind(...insVals).run();
    if(await adminTableExists(env,"cms_page_revisions")){
      try{
        await env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,1,?,?,?,'draft',?,?)")
          .bind(newId,newTitle,curr.blocks_json||"[]",curr.seo_json||"{}",`Nhân bản từ trang ${curr.slug}`,validActorId).run();
      }catch(revErr){console.warn("CMS_DUPLICATE_REVISION_WARN",revErr);}
    }
    await audit(env,request,user,"Nhân bản trang CMS","cms_page",newId,{source_id:curr.id,slug:newSlug});
    return json({ok:true,id:newId,slug:newSlug,title:newTitle},201);
  }

  const cmsPreviewMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)\/preview$/);
  if(cmsPreviewMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.approve","cms.publish"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(cmsPreviewMatch[1]);
    const lang=(url.searchParams.get("lang")||"vi").toLowerCase()==="en"?"en":"vi";
    const page=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(id,id).first();
    if(!page) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,page.website_id)) return json({error:"FORBIDDEN"},403);
    let blocksVi=[],blocksEn=[],seoVi={},seoEn={};
    try{blocksVi=JSON.parse(page.blocks_json||"[]")}catch{}
    try{blocksEn=JSON.parse(page.blocks_en_json||"[]")}catch{}
    try{seoVi=JSON.parse(page.seo_json||"{}")}catch{}
    try{seoEn=JSON.parse(page.seo_en_json||"{}")}catch{}
    const rawBlocks = lang==="en"&&blocksEn.length?blocksEn:blocksVi;
    const resolvedBlocks = [];
    for (const b of rawBlocks) {
      if (b && b.type === "shared_block" && (b.sharedKey || b.sharedId)) {
        const sbRow = await env.DB.prepare("SELECT * FROM cms_shared_blocks WHERE key=? OR id=? LIMIT 1").bind(b.sharedKey||b.sharedId, b.sharedKey||b.sharedId).first();
        if (sbRow) {
          let sbCfg = {}; try { sbCfg = JSON.parse(sbRow.config_json || "{}"); } catch {}
          resolvedBlocks.push({
            ...b,
            resolved_shared_block: {
              key: sbRow.key,
              name: sbRow.name,
              title: lang==="en" && sbCfg.title_en ? sbCfg.title_en : (sbCfg.title || sbRow.name),
              text: lang==="en" && sbCfg.text_en ? sbCfg.text_en : (sbCfg.text || "")
            }
          });
          continue;
        }
      }
      resolvedBlocks.push(b);
    }
    const previewItem = {
      ...page,
      lang,
      title:lang==="en"&&page.title_en?page.title_en:page.title,
      summary:lang==="en"&&page.summary_en?page.summary_en:page.summary,
      blocks:resolvedBlocks,
      blocks_vi:blocksVi,
      blocks_en:blocksEn,
      seo:lang==="en"&&Object.keys(seoEn).length?seoEn:seoVi
    };
    return json({
      ok:true,
      is_preview:true,
      lang,
      item:previewItem,
      preview:previewItem
    });
  }

  const cmsWorkflowMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)\/workflow$/);
  if(cmsWorkflowMatch&&request.method==="POST"){
    const rawId=decodeURIComponent(cmsWorkflowMatch[1]),body=await readJson(request)||{};
    const action=String(body.action||"").trim();
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(rawId,rawId).first();
    if(!curr) return json({error:"NOT_FOUND",message:"Không tìm thấy trang CMS."},404);
    const id=curr.id;
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
    const isSys=curr.page_type==="system"||String(id||"").startsWith("sys_");
    const opState=await resolveOperationalState(env,curr.website_id);
    const validActorId=await resolveValidUserId(env,user?.id);

    if(action==="submit_review"){
      if(!hasAnyPermission(user,["cms.submit_review","cms.edit","news.manage"])) return json({error:"FORBIDDEN"},403);
      await env.DB.prepare("UPDATE cms_pages SET status='pending_review',submitted_by=?,submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(validActorId,id).run();
      await audit(env,request,user,"Gửi duyệt trang CMS","cms_page",id,{website_id:curr.website_id});
      return json({ok:true,status:"pending_review"});
    }
    if(action==="approve"){
      if(!hasPermission(user,"cms.approve")) return json({error:"FORBIDDEN",permission:"cms.approve"},403);
      const creatorId=curr.submitted_by||curr.author_id;
      if(creatorId && Number(creatorId)===Number(user.id) && !isRoot){
        return json({error:"SELF_APPROVAL_FORBIDDEN",message:"Người biên tập không mặc nhiên được tự duyệt trang do chính mình gửi."},403);
      }
      await env.DB.prepare("UPDATE cms_pages SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(validActorId,String(body.note||"Đã phê duyệt nội dung"),id).run();
      await audit(env,request,user,"Phê duyệt trang CMS","cms_page",id,{website_id:curr.website_id,note:body.note||""});
      return json({ok:true,status:"approved"});
    }
    if(action==="reject"){
      if(!hasPermission(user,"cms.approve")) return json({error:"FORBIDDEN",permission:"cms.approve"},403);
      await env.DB.prepare("UPDATE cms_pages SET status='draft',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(validActorId,String(body.note||"Yêu cầu chỉnh sửa lại"),id).run();
      await audit(env,request,user,"Từ chối duyệt trang CMS","cms_page",id,{website_id:curr.website_id,note:body.note||""});
      return json({ok:true,status:"draft"});
    }
    if(action==="publish"){
      if(!hasPermission(user,"cms.publish")) return json({error:"FORBIDDEN",permission:"cms.publish"},403);
      if(opState.is_publishing_paused){
        return json({error:"PUBLISHING_PAUSED",message:"Hệ thống đang ở chế độ Tạm khóa xuất bản (Publishing Paused). Không thể xuất bản trang mới lúc này."},423);
      }
      if(!["approved","published"].includes(curr.status) && !isRoot && !isSys){
        return json({error:"MUST_BE_APPROVED_FIRST",message:"Trang phải được phê duyệt trước khi xuất bản ra công khai."},409);
      }
      let blocks=[]; try{blocks=JSON.parse(curr.blocks_json||"[]")}catch{}
      if(!curr.title || (!blocks.length && !isSys)){
        return json({error:"PUBLISH_VALIDATION_FAILED",message:"Không thể xuất bản trang thiếu tiêu đề hoặc chưa có khối nội dung nào."},400);
      }
      await env.DB.prepare("UPDATE cms_pages SET status='published',published_by=?,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(validActorId,id).run();
      await audit(env,request,user,"Xuất bản trang CMS","cms_page",id,{website_id:curr.website_id,slug:curr.slug});
      invalidatePublicCache(url,["/api/public/pages","/api/config"],ctx);
      return json({ok:true,status:"published"});
    }
    if(action==="schedule"){
      if(!hasPermission(user,"cms.publish")) return json({error:"FORBIDDEN",permission:"cms.publish"},403);
      const schedAt=String(body.scheduled_at||curr.scheduled_at||"").trim();
      if(!schedAt) return json({error:"SCHEDULE_TIME_REQUIRED",message:"Vui lòng chọn thời điểm hẹn giờ xuất bản (scheduled_at)."},400);
      if(!["approved","published","scheduled"].includes(curr.status) && !isRoot){
        return json({error:"MUST_BE_APPROVED_FIRST",message:"Trang phải được phê duyệt trước khi lên lịch xuất bản."},409);
      }
      await env.DB.prepare("UPDATE cms_pages SET status='scheduled',scheduled_at=?,unpublished_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(schedAt,body.unpublished_at||curr.unpublished_at||null,id).run();
      await audit(env,request,user,"Lên lịch xuất bản trang CMS","cms_page",id,{scheduled_at:schedAt});
      return json({ok:true,status:"scheduled",scheduled_at:schedAt});
    }
    if(action==="unpublish"){
      if(!hasPermission(user,"cms.publish")) return json({error:"FORBIDDEN",permission:"cms.publish"},403);
      await env.DB.prepare("UPDATE cms_pages SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
      await audit(env,request,user,"Gỡ xuất bản trang CMS","cms_page",id,{website_id:curr.website_id,slug:curr.slug});
      invalidatePublicCache(url,["/api/public/pages","/api/config"],ctx);
      return json({ok:true,status:"archived"});
    }
    return json({error:"INVALID_WORKFLOW_ACTION"},400);
  }

  const cmsRestoreMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)\/restore-version$/);
  if(cmsRestoreMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","cms.publish"])) return json({error:"FORBIDDEN",permission:"cms.edit"},403);
    const id=decodeURIComponent(cmsRestoreMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const rev=await env.DB.prepare("SELECT * FROM cms_page_revisions WHERE page_id=? AND version=?").bind(id,Number(body.version||0)).first();
    if(!rev) return json({error:"REVISION_NOT_FOUND"},404);
    const nextVer=Number(curr.version||1)+1;
    await env.DB.batch([
      env.DB.prepare("UPDATE cms_pages SET title=?,blocks_json=?,seo_json=?,status='draft',version=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(rev.title,rev.blocks_json,rev.seo_json,nextVer,id),
      env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,?,?,?,?,'draft',?,?)")
        .bind(id,nextVer,rev.title,rev.blocks_json,rev.seo_json,`Khôi phục từ phiên bản v${rev.version}`,user.id)
    ]);
    await audit(env,request,user,"Khôi phục phiên bản trang CMS","cms_page",id,{from_version:rev.version,new_version:nextVer});
    return json({ok:true,version:nextVer});
  }

  // ================= CMS TEMPLATES & SHARED BLOCKS CRUD (/api/admin/cms/templates & /api/admin/cms/shared-blocks) =================
  if(p==="/api/admin/cms/templates"&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.template_manage"])) return json({error:"FORBIDDEN"},403);
    const rs=await env.DB.prepare("SELECT * FROM cms_templates ORDER BY name").all();
    return json({items:(rs.results||[]).map(t=>({...t,blocks:parseBodyJson(t,"blocks_json",[])}))});
  }
  if(p==="/api/admin/cms/templates"&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.template_manage","cms.publish"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const name=String(body.name||"").trim();
    const key=String(body.key||name).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-");
    if(!name||!key) return json({error:"INVALID_INPUT"},400);
    const id=uid("tpl");
    const blocksJson=JSON.stringify(Array.isArray(body.blocks)?body.blocks:[]);
    await env.DB.prepare("INSERT INTO cms_templates(id,key,name,category,description,blocks_json) VALUES(?,?,?,?,?,?)")
      .bind(id,key,name,String(body.category||"general"),String(body.description||""),blocksJson).run();
    await audit(env,request,user,"Tạo mẫu trang CMS (Template)","cms_template",id,{key,name});
    return json({ok:true,id,key},201);
  }
  const tplMatch=p.match(/^\/api\/admin\/cms\/templates\/([^/]+)$/);
  if(tplMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["cms.template_manage","cms.publish"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(tplMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_templates WHERE id=? OR key=?").bind(id,id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    await env.DB.prepare("UPDATE cms_templates SET name=?,category=?,description=?,blocks_json=? WHERE id=?")
      .bind(body.name||curr.name,body.category||curr.category,body.description??curr.description,body.blocks?JSON.stringify(body.blocks):curr.blocks_json,curr.id).run();
    await audit(env,request,user,"Cập nhật mẫu trang CMS","cms_template",curr.id,{name:body.name||curr.name});
    return json({ok:true});
  }
  if(tplMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["cms.template_manage","cms.publish"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(tplMatch[1]);
    await env.DB.prepare("DELETE FROM cms_templates WHERE id=? OR key=?").bind(id,id).run();
    await audit(env,request,user,"Xóa mẫu trang CMS","cms_template",id,{});
    return json({ok:true});
  }

  if(p==="/api/admin/cms/shared-blocks"&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.template_manage"])) return json({error:"FORBIDDEN"},403);
    const rs=await env.DB.prepare("SELECT * FROM cms_shared_blocks ORDER BY name").all();
    const items=[];
    for(const sb of rs.results||[]){
      const affected=await findPagesUsingSharedBlock(env,sb.key,sb.id);
      let cfg={}; try{cfg=JSON.parse(sb.config_json||"{}")}catch{}
      items.push({...sb,config:cfg,affected_pages_count:affected.length,affected_pages:affected});
    }
    return json({items});
  }
  if(p==="/api/admin/cms/shared-blocks"&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","cms.template_manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const name=String(body.name||"").trim();
    const key=String(body.key||name).trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-");
    if(!name||!key) return json({error:"INVALID_INPUT"},400);
    const id=body.id||uid("sb");
    const mergedCfg=body.config||{...(body.block||{}),title_en:body.block_en?.title||body.block?.title_en||"",text_en:body.block_en?.text||body.block?.text_en||""};
    const cfgJson=JSON.stringify(mergedCfg);
    const blockType=String(body.block_type||body.block?.type||"callout");
    await env.DB.prepare("INSERT INTO cms_shared_blocks(id,website_id,key,name,block_type,config_json,status,updated_by,updated_at) VALUES(?,?,?,?,?,?,'active',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET name=excluded.name,block_type=excluded.block_type,config_json=excluded.config_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
      .bind(id,String(body.website_id||"app"),key,name,blockType,cfgJson,user.id).run();
    const affected=await findPagesUsingSharedBlock(env,key,id);
    await audit(env,request,user,"Lưu khối dùng chung (Shared Block)","cms_shared_block",id,{key,name,affected:affected.length});
    invalidatePublicCache(url,["/api/config","/api/public/pages"],ctx);
    return json({ok:true,id,key,affected_pages_count:affected.length,affected_pages:affected,warning:`${affected.length} trang bị ảnh hưởng`},200);
  }
  const sbMatch=p.match(/^\/api\/admin\/cms\/shared-blocks\/([^/]+)$/);
  if(sbMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["cms.edit","cms.template_manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(sbMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_shared_blocks WHERE id=? OR key=?").bind(id,id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    const affected=await findPagesUsingSharedBlock(env,curr.key,curr.id);
    await env.DB.prepare("UPDATE cms_shared_blocks SET name=?,block_type=?,config_json=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(body.name||curr.name,body.block_type||curr.block_type,body.config?JSON.stringify(body.config):curr.config_json,body.status||curr.status,user.id,curr.id).run();
    await audit(env,request,user,"Cập nhật khối dùng chung","cms_shared_block",curr.id,{affected_pages:affected.length});
    invalidatePublicCache(url,["/api/config","/api/public/pages"],ctx);
    return json({
      ok:true,
      affected_pages_count:affected.length,
      affected_pages:affected,
      impact_warning:affected.length>0?`Khối dùng chung này đang được sử dụng trên ${affected.length} trang. Thay đổi đã tự động cập nhật trên các trang liên quan.`:null
    });
  }
  if(sbMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["cms.template_manage","cms.publish"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(sbMatch[1]);
    const curr=await env.DB.prepare("SELECT * FROM cms_shared_blocks WHERE id=? OR key=?").bind(id,id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    const affected=await findPagesUsingSharedBlock(env,curr.key,curr.id);
    if(affected.length>0){
      return json({
        error:"SHARED_BLOCK_IN_USE",
        message:`Không thể xóa khối dùng chung "${curr.name}" vì đang được nhúng trên ${affected.length} trang CMS.`,
        affected_pages_count:affected.length,
        affected_pages:affected
      },409);
    }
    await env.DB.prepare("DELETE FROM cms_shared_blocks WHERE id=?").bind(curr.id).run();
    await audit(env,request,user,"Xóa khối dùng chung","cms_shared_block",curr.id,{});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  // ================= WORDPRESS HEADLESS & GUTENBERG ADAPTER (/api/admin/cms/wordpress/*) =================
  if(p==="/api/admin/cms/wordpress/config"&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const cfg=await setting(env,"wordpress_integration_config",{enabled:false,mode:"headless_rest_adapter",wp_base_url:"",allow_gutenberg_import:true,allow_json_export:true});
    return json({ok:true,config:cfg});
  }
  if(p==="/api/admin/cms/wordpress/config"&&request.method==="PUT"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const curr=await setting(env,"wordpress_integration_config",{});
    const next={...curr,...body,security_policy:"sanitize_structured_blocks_only"};
    await env.DB.prepare("INSERT INTO settings(key,value_json,updated_by) VALUES('wordpress_integration_config',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by")
      .bind(JSON.stringify(next),user.id).run();
    await audit(env,request,user,"Cập nhật cấu hình tích hợp WordPress Headless","settings","wordpress_integration_config",next);
    return json({ok:true,config:next});
  }
  if(p==="/api/admin/cms/wordpress/import"&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","cms.template_manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const websiteId=String(body.website_id||"app").trim();
    if(!canAccessScope(user,websiteId)) return json({error:"FORBIDDEN"},403);
    const rawTitle=String(body.title?.rendered||body.title||"Trang nhập từ WordPress").trim();
    const rawSlug=String(body.slug||rawTitle).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"")||`wp-${Date.now()}`;
    const convertedBlocks=convertWordPressToSkyFirstBlocks(body);
    if(!convertedBlocks.length){
      return json({error:"EMPTY_WP_CONTENT",message:"Không tìm thấy khối nội dung hợp lệ trong dữ liệu WordPress/Gutenberg đầu vào."},400);
    }
    const existing=await env.DB.prepare("SELECT id,version FROM cms_pages WHERE website_id=? AND slug=?").bind(websiteId,rawSlug).first();
    const blocksJson=JSON.stringify(convertedBlocks);
    const wpMetaJson=JSON.stringify({wp_post_id:body.id||body.wp_post_id||null,imported_at:new Date().toISOString(),imported_by:user.email});
    if(existing){
      const nextVer=Number(existing.version||1)+1;
      await env.DB.batch([
        env.DB.prepare("UPDATE cms_pages SET title=?,blocks_json=?,status='draft',version=?,wp_post_id=?,wp_sync_meta_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(rawTitle,blocksJson,nextVer,body.id||null,wpMetaJson,existing.id),
        env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,?,?,?,'{}','draft','Đồng bộ từ WordPress Gutenberg',?)")
          .bind(existing.id,nextVer,rawTitle,blocksJson,user.id)
      ]);
      await audit(env,request,user,"Đồng bộ cập nhật trang từ WordPress Gutenberg","cms_page",existing.id,{slug:rawSlug,blocks_count:convertedBlocks.length});
      return json({ok:true,id:existing.id,slug:rawSlug,blocks_count:convertedBlocks.length,imported_blocks_count:convertedBlocks.length,blocks:convertedBlocks,updated:true});
    }
    const id=uid("page");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO cms_pages(id,website_id,slug,page_type,route_path,title,summary,blocks_json,status,version,author_id,wp_post_id,wp_sync_meta_json) VALUES(?,?,?,'wp_synced',?,?,?,?,'draft',1,?,?,?)")
        .bind(id,websiteId,rawSlug,`/trang/${rawSlug}`,rawTitle,sanitizeGutenbergHtmlToText(body.excerpt?.rendered||body.summary||""),blocksJson,user.id,body.id||null,wpMetaJson),
      env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,1,?,?,'{}','draft','Nhập mới từ WordPress Gutenberg',?)")
        .bind(id,rawTitle,blocksJson,user.id)
    ]);
    await audit(env,request,user,"Nhập trang mới từ WordPress Gutenberg","cms_page",id,{slug:rawSlug,blocks_count:convertedBlocks.length});
    return json({ok:true,id,slug:rawSlug,blocks_count:convertedBlocks.length,imported_blocks_count:convertedBlocks.length,blocks:convertedBlocks,created:true},201);
  }
  const wpExportMatch=p.match(/^\/api\/admin\/cms\/(?:wordpress\/export\/([^/]+)|pages\/([^/]+)\/wordpress-export)$/);
  if(wpExportMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(wpExportMatch[1]||wpExportMatch[2]);
    const page=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=? OR slug=?").bind(id,id).first();
    if(!page) return json({error:"NOT_FOUND"},404);
    const pkg=exportSkyFirstBlocksToGutenberg(page);
    return json({ok:true,wordpress_package:pkg,wp_payload:{title:page.title,slug:page.slug,content:pkg.gutenberg_content,blocks:pkg.structured_blocks}});
  }

  return json({error:"ADMIN_ROUTE_NOT_FOUND"},404);
}
