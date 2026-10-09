
import {
  json, readJson, randomToken, sha256, pbkdf2, newSalt, safeEq, parseCookies,
  sessionCookie, clearSessionCookie, ipHash, uid, rateLimit
} from "./utils.js";
import {hasPermission, highestRoleLevel, roleLevel} from "./permissions.js";
import {sendTemplatedEmail} from "./email.js";

const SESSION_SECONDS=7*24*60*60;

async function loadRoles(env,userId){
  const rs=await env.DB.prepare(`
    SELECT ur.role_id,ur.scope_unit_code,ur.expires_at,r.name,r.level
    FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=? AND (ur.expires_at IS NULL OR ur.expires_at>CURRENT_TIMESTAMP)
    ORDER BY r.level DESC
  `).bind(userId).all();
  return rs.results||[];
}

export async function getUserById(env,id){
  const u=await env.DB.prepare("SELECT id,email,full_name,status,email_verified,must_change_password,totp_enabled,created_at FROM users WHERE id=?").bind(id).first();
  if(!u) return null;
  u.roles=await loadRoles(env,u.id); return u;
}

export async function getAuthUser(request,env){
  const token=parseCookies(request).sfec_session;
  if(!token) return null;
  const hash=await sha256(token);
  const row=await env.DB.prepare(`
    SELECT s.user_id,s.expires_at,u.status
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP
  `).bind(hash).first();
  if(!row||row.status!=="active") return null;
  await env.DB.prepare("UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?").bind(hash).run();
  return getUserById(env,row.user_id);
}

export function requireAuth(user){
  if(!user) return json({error:"AUTH_REQUIRED"},401);
  return null;
}

export function requirePermission(user,p){
  if(!user) return json({error:"AUTH_REQUIRED"},401);
  if(!hasPermission(user,p)) return json({error:"FORBIDDEN",permission:p},403);
  return null;
}

async function createSession(request,env,userId){
  const token=randomToken(32), hash=await sha256(token);
  const exp=new Date(Date.now()+SESSION_SECONDS*1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(user_id,token_hash,user_agent,ip_hash,expires_at) VALUES(?,?,?,?,?)")
    .bind(userId,hash,(request.headers.get("user-agent")||"").slice(0,400),await ipHash(request),exp).run();
  return {token,exp};
}

async function verifyPassword(env,email,password){
  const u=await env.DB.prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  if(!u||!u.password_hash||u.status!=="active") return null;
  const got=await pbkdf2(password,u.password_salt,u.password_iterations||100000);
  return safeEq(got,u.password_hash)?u:null;
}

function parseTotpSecret(secret){ return secret || ""; }
const BASE32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(bytes){
  let bits=0,value=0,out="";
  for(const b of bytes){
    value=(value<<8)|b; bits+=8;
    while(bits>=5){out+=BASE32[(value>>>(bits-5))&31];bits-=5;}
  }
  if(bits>0) out+=BASE32[(value<<(5-bits))&31];
  return out;
}
function base32Decode(s){
  s=String(s||"").toUpperCase().replace(/[^A-Z2-7]/g,"");
  let bits=0,value=0,out=[];
  for(const c of s){
    const i=BASE32.indexOf(c); if(i<0) continue;
    value=(value<<5)|i; bits+=5;
    if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}
  }
  return new Uint8Array(out);
}
async function hotp(secret,counter,digits=6){
  const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const buf=new ArrayBuffer(8),view=new DataView(buf);
  view.setUint32(0,Math.floor(counter/0x100000000),false);view.setUint32(4,counter>>>0,false);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,buf));
  const off=sig[sig.length-1]&15;
  const bin=((sig[off]&127)<<24)|(sig[off+1]<<16)|(sig[off+2]<<8)|sig[off+3];
  return String(bin%(10**digits)).padStart(digits,"0");
}
async function verifyTotp(secret,code){
  const step=Math.floor(Date.now()/1000/30);
  for(let d=-1;d<=1;d++) if(await hotp(secret,step+d)===String(code||"").trim()) return true;
  return false;
}

export async function authRoute(request,env,url){
  const p=url.pathname;

  if(p==="/api/auth/me"&&request.method==="GET"){
    const user=await getAuthUser(request,env);
    return json({user});
  }

  if(p==="/api/auth/register"&&request.method==="POST"){
    const body=await readJson(request);
    const email=String(body?.email||"").trim().toLowerCase(),name=String(body?.full_name||"").trim(),password=String(body?.password||"");
    if(!email.includes("@")||name.length<2||password.length<10) return json({error:"INVALID_INPUT"},400);
    const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
    if(exists) return json({error:"EMAIL_EXISTS"},409);
    const salt=newSalt(),hash=await pbkdf2(password,salt,100000);
    const res=await env.DB.prepare("INSERT INTO users(email,full_name,password_salt,password_hash,password_iterations,status,email_verified,must_change_password) VALUES(?,?,?,?,100000,'active',0,0)")
      .bind(email,name,salt,hash).run();
    const idUser=res.meta.last_row_id;
    await env.DB.prepare("INSERT INTO user_roles(user_id,role_id,scope_unit_code) VALUES(?,'student','')").bind(idUser).run();
    const token=randomToken(32),tokenHash=await sha256(token),idTok=uid("verify");
    await env.DB.prepare("INSERT INTO auth_tokens(id,user_id,token_type,token_hash,expires_at) VALUES(?,?, 'verify_email', ?, datetime('now','+24 hours'))")
      .bind(idTok,idUser,tokenHash).run();
    const link=`${env.APP_URL}/?verify=${encodeURIComponent(token)}`;
    await sendTemplatedEmail(env,"verify_email",email,{full_name:name,email,link});
    return json({ok:true,message:"CHECK_EMAIL"});
  }

  if(p==="/api/auth/verify-email"&&request.method==="POST"){
    const body=await readJson(request),token=String(body?.token||"");
    const hash=await sha256(token);
    const row=await env.DB.prepare("SELECT id,user_id FROM auth_tokens WHERE token_type='verify_email' AND token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP").bind(hash).first();
    if(!row) return json({error:"INVALID_OR_EXPIRED_TOKEN"},400);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET email_verified=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.user_id),
      env.DB.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id)
    ]);
    return json({ok:true});
  }

  if(p==="/api/auth/login"&&request.method==="POST"){
    const rl=await rateLimit(env,`login:${await ipHash(request)}`,12,300); if(!rl.ok) return json({error:"RATE_LIMIT"},429);
    const body=await readJson(request);
    const email=String(body?.email||"").trim().toLowerCase(),password=String(body?.password||""),portal=String(body?.portal||"student");
    const u=await verifyPassword(env,email,password);
    if(!u) return json({error:"INVALID_CREDENTIALS"},401);
    if(!u.email_verified) return json({error:"EMAIL_NOT_VERIFIED"},403);
    const full=await getUserById(env,u.id);
    const roleIds=(full.roles||[]).map(r=>r.role_id);
    if(portal==="admin"&&!roleIds.some(r=>roleLevel(r)>=40)) return json({error:"ADMIN_ACCESS_NOT_GRANTED"},403);
    if(portal==="member"&&!roleIds.some(r=>["member","volunteer","handler","unit_admin","communications","external_events","hr","office","club_secretary","system_admin","super_admin"].includes(r)))
      return json({error:"MEMBER_ACCESS_NOT_GRANTED"},403);

    if(u.totp_enabled){
      const challenge=uid("2fa");
      await env.DB.prepare("INSERT INTO auth_tokens(id,user_id,token_type,token_hash,portal,expires_at) VALUES(?,?, 'login_2fa', ?, ?, datetime('now','+10 minutes'))")
        .bind(challenge,u.id,await sha256(challenge),portal).run();
      return json({needs_2fa:true,challenge});
    }

    const s=await createSession(request,env,u.id);
    return json({ok:true,user:full,must_change_password:!!u.must_change_password},200,{"set-cookie":sessionCookie(s.token)});
  }

  if(p==="/api/auth/login-2fa"&&request.method==="POST"){
    const body=await readJson(request),challenge=String(body?.challenge||""),code=String(body?.code||"");
    const row=await env.DB.prepare(`
      SELECT t.id,t.user_id,u.totp_secret,u.must_change_password
      FROM auth_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_type='login_2fa' AND t.token_hash=? AND t.used_at IS NULL AND t.expires_at>CURRENT_TIMESTAMP
    `).bind(await sha256(challenge)).first();
    if(!row||!(await verifyTotp(row.totp_secret,code))) return json({error:"INVALID_2FA"},401);
    await env.DB.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
    const s=await createSession(request,env,row.user_id),user=await getUserById(env,row.user_id);
    return json({ok:true,user,must_change_password:!!row.must_change_password},200,{"set-cookie":sessionCookie(s.token)});
  }

  if(p==="/api/auth/logout"&&request.method==="POST"){
    const token=parseCookies(request).sfec_session;
    if(token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
    return json({ok:true},200,{"set-cookie":clearSessionCookie()});
  }

  if(p==="/api/auth/change-password"&&request.method==="POST"){
    const user=await getAuthUser(request,env); const auth=requireAuth(user); if(auth) return auth;
    const body=await readJson(request),current=String(body?.current_password||""),next=String(body?.new_password||"");
    if(next.length<10) return json({error:"PASSWORD_TOO_SHORT"},400);
    const verified=await verifyPassword(env,user.email,current);
    if(!verified) return json({error:"CURRENT_PASSWORD_INVALID"},401);
    const salt=newSalt(),hash=await pbkdf2(next,salt,100000);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,password_iterations=100000,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)
    ]);
    const s=await createSession(request,env,user.id);
    return json({ok:true},200,{"set-cookie":sessionCookie(s.token)});
  }

  if(p==="/api/auth/forgot"&&request.method==="POST"){
    const body=await readJson(request),email=String(body?.email||"").trim().toLowerCase();
    const u=await env.DB.prepare("SELECT id,full_name,email FROM users WHERE email=? COLLATE NOCASE AND status='active'").bind(email).first();
    if(u){
      const token=randomToken(32),hash=await sha256(token),tid=uid("reset");
      await env.DB.prepare("INSERT INTO auth_tokens(id,user_id,token_type,token_hash,expires_at) VALUES(?,?, 'password_reset', ?, datetime('now','+30 minutes'))")
        .bind(tid,u.id,hash).run();
      const link=`${env.APP_URL}/?reset=${encodeURIComponent(token)}`;
      await sendTemplatedEmail(env,"password_reset",email,{full_name:u.full_name||"",email,link});
    }
    return json({ok:true});
  }

  if(p==="/api/auth/reset"&&request.method==="POST"){
    const body=await readJson(request),token=String(body?.token||""),next=String(body?.new_password||"");
    if(next.length<10) return json({error:"PASSWORD_TOO_SHORT"},400);
    const hashTok=await sha256(token);
    const row=await env.DB.prepare("SELECT id,user_id FROM auth_tokens WHERE token_type='password_reset' AND token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP").bind(hashTok).first();
    if(!row) return json({error:"INVALID_OR_EXPIRED_TOKEN"},400);
    const salt=newSalt(),hash=await pbkdf2(next,salt,100000);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,password_iterations=100000,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,row.user_id),
      env.DB.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id)
    ]);
    return json({ok:true});
  }

  if(p==="/api/auth/google/start"&&request.method==="GET"){
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_REDIRECT_URI) return json({error:"GOOGLE_OAUTH_NOT_CONFIGURED"},503);
    const portal=url.searchParams.get("portal")||"student",state=randomToken(24),hash=await sha256(state),idState=uid("oauth");
    await env.DB.prepare("INSERT INTO auth_tokens(id,token_type,token_hash,portal,expires_at) VALUES(?,'oauth_state',?,?,datetime('now','+10 minutes'))")
      .bind(idState,hash,portal).run();
    const q=new URLSearchParams({
      client_id:env.GOOGLE_CLIENT_ID,
      redirect_uri:env.GOOGLE_REDIRECT_URI,
      response_type:"code",
      scope:"openid email profile",
      state,
      prompt:"select_account"
    });
    return Response.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+q.toString(),302);
  }

  if(p==="/api/auth/google/callback"&&request.method==="GET"){
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REDIRECT_URI) return json({error:"GOOGLE_OAUTH_NOT_CONFIGURED"},503);
    const code=url.searchParams.get("code"),state=url.searchParams.get("state");
    if(!code||!state) return json({error:"OAUTH_INVALID"},400);
    const st=await env.DB.prepare("SELECT id,portal FROM auth_tokens WHERE token_type='oauth_state' AND token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP")
      .bind(await sha256(state)).first();
    if(!st) return json({error:"OAUTH_STATE_INVALID"},400);
    await env.DB.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(st.id).run();

    const tr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({
      code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.GOOGLE_REDIRECT_URI,grant_type:"authorization_code"
    })});
    if(!tr.ok) return json({error:"OAUTH_TOKEN_FAILED"},400);
    const tok=await tr.json();
    const pr=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{authorization:`Bearer ${tok.access_token}`}});
    if(!pr.ok) return json({error:"OAUTH_PROFILE_FAILED"},400);
    const profile=await pr.json();
    const email=String(profile.email||"").toLowerCase();
    let u=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
    if(!u){
      const res=await env.DB.prepare("INSERT INTO users(email,full_name,status,email_verified,must_change_password) VALUES(?,?,'active',1,0)")
        .bind(email,profile.name||email).run();
      u={id:res.meta.last_row_id};
      await env.DB.prepare("INSERT INTO user_roles(user_id,role_id,scope_unit_code) VALUES(?,'student','')").bind(u.id).run();
    }else{
      await env.DB.prepare("UPDATE users SET email_verified=1,full_name=COALESCE(full_name,?),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(profile.name||email,u.id).run();
    }
    const full=await getUserById(env,u.id),ids=(full.roles||[]).map(r=>r.role_id);
    if(st.portal==="admin"&&!ids.some(r=>roleLevel(r)>=40)) return Response.redirect(`${env.APP_URL}/?auth_error=ADMIN_ACCESS_NOT_GRANTED`,302);
    if(st.portal==="member"&&!ids.some(r=>["member","volunteer","handler","unit_admin","communications","external_events","hr","office","club_secretary","system_admin","super_admin"].includes(r)))
      return Response.redirect(`${env.APP_URL}/?auth_error=MEMBER_ACCESS_NOT_GRANTED`,302);
    const s=await createSession(request,env,u.id);
    return new Response(null,{status:302,headers:{"location":`${env.APP_URL}/?login=ok&portal=${encodeURIComponent(st.portal)}`,"set-cookie":sessionCookie(s.token)}});
  }

  if(p==="/api/me/2fa/setup"&&request.method==="POST"){
    const user=await getAuthUser(request,env); const auth=requireAuth(user); if(auth) return auth;
    const bytes=new Uint8Array(20);crypto.getRandomValues(bytes);const secret=base32Encode(bytes);
    await env.DB.prepare("UPDATE users SET totp_secret=?,totp_enabled=0 WHERE id=?").bind(secret,user.id).run();
    const issuer=encodeURIComponent("The Sky First English Club"),label=encodeURIComponent(user.email);
    const uri=`otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
    return json({secret,otpauth_uri:uri});
  }

  if(p==="/api/me/2fa/enable"&&request.method==="POST"){
    const user=await getAuthUser(request,env); const auth=requireAuth(user); if(auth) return auth;
    const body=await readJson(request),row=await env.DB.prepare("SELECT totp_secret FROM users WHERE id=?").bind(user.id).first();
    if(!row?.totp_secret||!(await verifyTotp(row.totp_secret,body?.code))) return json({error:"INVALID_2FA"},400);
    await env.DB.prepare("UPDATE users SET totp_enabled=1 WHERE id=?").bind(user.id).run();
    return json({ok:true});
  }

  if(p==="/api/me/2fa/disable"&&request.method==="POST"){
    const user=await getAuthUser(request,env); const auth=requireAuth(user); if(auth) return auth;
    const body=await readJson(request);
    const verified=await verifyPassword(env,user.email,String(body?.password||""));
    if(!verified) return json({error:"PASSWORD_INVALID"},401);
    await env.DB.prepare("UPDATE users SET totp_enabled=0,totp_secret=NULL WHERE id=?").bind(user.id).run();
    return json({ok:true});
  }

  if(p==="/api/me/sessions"&&request.method==="GET"){
    const user=await getAuthUser(request,env); const auth=requireAuth(user); if(auth) return auth;
    const rs=await env.DB.prepare("SELECT id,user_agent,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? ORDER BY last_seen_at DESC").bind(user.id).all();
    return json({sessions:rs.results||[]});
  }

  if(p==="/api/me/sessions/revoke-all"&&request.method==="POST"){
    const user=await getAuthUser(request,env); const auth=requireAuth(user); if(auth) return auth;
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();
    return json({ok:true},200,{"set-cookie":clearSessionCookie()});
  }

  return null;
}

export async function createInvitedAccount(request,env,actor,body){
  if(!hasPermission(actor,"user.manage")) return json({error:"FORBIDDEN"},403);
  const email=String(body?.email||"").trim().toLowerCase(),fullName=String(body?.full_name||"").trim();
  if(!email.includes("@")||fullName.length<2) return json({error:"INVALID_INPUT"},400);
  const roles=Array.isArray(body?.roles)?body.roles:[];
  const actorLevel=highestRoleLevel(actor);
  for(const r of roles){
    if(r==="super_admin"&&!(actor.roles||[]).some(x=>x.role_id==="super_admin")) return json({error:"CANNOT_GRANT_SUPER_ADMIN"},403);
    if(roleLevel(r)>=actorLevel && !(actor.roles||[]).some(x=>x.role_id==="super_admin")) return json({error:"ROLE_TOO_HIGH"},403);
  }
  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  if(exists) return json({error:"EMAIL_EXISTS"},409);
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%";
  const rnd=new Uint8Array(16);crypto.getRandomValues(rnd);
  let temp="SFEC!"; for(let i=0;i<rnd.length;i++) temp+=chars[rnd[i]%chars.length];
  const salt=newSalt(),hash=await pbkdf2(temp,salt,100000);
  const res=await env.DB.prepare("INSERT INTO users(email,full_name,password_salt,password_hash,password_iterations,status,email_verified,must_change_password) VALUES(?,?,?,?,100000,'active',1,1)")
    .bind(email,fullName,salt,hash).run();
  const uidUser=res.meta.last_row_id;
  for(const role of roles.length?roles:["student"]){
    await env.DB.prepare("INSERT OR IGNORE INTO user_roles(user_id,role_id,scope_unit_code,granted_by) VALUES(?,?,?,?)")
      .bind(uidUser,role,String(body?.scope_unit_code||""),actor.id).run();
  }
  await sendTemplatedEmail(env,"account_invite",email,{full_name:fullName,email,temp_password:temp});
  return json({ok:true,user_id:uidUser,temp_password:temp});
}
