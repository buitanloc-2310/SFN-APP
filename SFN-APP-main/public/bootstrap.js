const app=document.getElementById('app');
let appBundleLoaded=false;

function currentRoute(){
  const rawHash=(location.hash||'').slice(1);
  const [route,rawParam]=rawHash.split('/');
  let param=rawParam;try{if(param)param=decodeURIComponent(param)}catch{}
  const path=location.pathname.replace(/\/+$/,'/')||'/';
  return {path,route:route||'',param:param||''};
}

function needsAppBundle({path,route}){
  return path==='/admin'||path==='/admin/login'||path.startsWith('/admin/')||['admin','login','portal','form'].includes(route);
}

async function loadAppBundle(){
  if(appBundleLoaded)return;
  appBundleLoaded=true;
  await import('/app.js?v=20261025-home-stat-email-logo-fix-v1');
}

async function renderPublic(){
  const ctx=currentRoute();
  if(needsAppBundle(ctx)){await loadAppBundle();return;}
  if(!window.SkyFirstDigital?.canRender(ctx.path,ctx.route)){
    ctx.path='/';ctx.route='home';ctx.param='';
  }
  try{await window.SkyFirstDigital.render({app,...ctx});}
  catch(err){
    app.innerHTML=`<section class="system-state"><span class="hero-eyebrow">TRẠNG THÁI DỊCH VỤ</span><h1>Hệ thống đang gặp sự cố khi xử lý yêu cầu</h1><p>Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ kỹ thuật tại support@skyfirst.io.vn.</p><a class="portal-button" href="/">Về Trang chủ →</a></section>`;
  }
}

function applyTheme(theme){
  document.body.classList.toggle('dark',theme==='dark');
  try{localStorage.setItem('sfn_theme',theme)}catch{}
}
applyTheme((()=>{try{return localStorage.getItem('sfn_theme')||'light'}catch{return 'light'}})());
document.getElementById('themeBtn')?.addEventListener('click',()=>applyTheme(document.body.classList.contains('dark')?'light':'dark'));

window.addEventListener('hashchange',()=>{if(!appBundleLoaded)renderPublic()});
window.addEventListener('popstate',()=>{if(!appBundleLoaded)renderPublic()});
renderPublic();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js?v=20261025-home-stat-email-logo-fix-v1',{updateViaCache:'none'}).then(reg=>{
    reg.update().catch(()=>{});
  }).catch(()=>{});
  let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController){hadController=true;return;}
    try{
      if(sessionStorage.getItem('sfn_sw_reloaded_home_stat_email_logo_fix_v1')==='1')return;
      sessionStorage.setItem('sfn_sw_reloaded_home_stat_email_logo_fix_v1','1');
    }catch{}
    location.reload();
  });
}
