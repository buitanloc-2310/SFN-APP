const app=document.getElementById('app');
let appBundleLoaded=false;

function currentRoute(){
  const hash=(location.hash||'#home').slice(1);
  const [route,rawParam]=hash.split('/');
  let param=rawParam;try{if(param)param=decodeURIComponent(param)}catch{}
  return {path:location.pathname.replace(/\/+$/,'/')||'/',route,param};
}

function needsAppBundle({path,route}){
  return path==='/admin'||path==='/admin/login'||['admin','login','portal','form'].includes(route);
}

async function loadAppBundle(){
  if(appBundleLoaded)return;
  appBundleLoaded=true;
  await import('/app.js?v=20261010-v6');
}

async function renderPublic(){
  const ctx=currentRoute();
  if(needsAppBundle(ctx)){await loadAppBundle();return;}
  if(!window.SkyFirstDigital?.canRender(ctx.path,ctx.route)){
    ctx.path='/';ctx.route='home';ctx.param='';
  }
  try{await window.SkyFirstDigital.render({app,...ctx});}
  catch(err){
    app.innerHTML=`<section class="system-state"><span class="hero-eyebrow">SERVICE STATE</span><h1>Không thể tải nội dung lúc này</h1><p>${String(err?.message||'Vui lòng thử lại sau.').replace(/[&<>"']/g,'')}</p><a class="portal-button" href="/">Thử lại →</a></section>`;
  }
}

function applyTheme(theme){
  document.body.classList.toggle('dark',theme==='dark');
  try{localStorage.setItem('sfn_theme',theme)}catch{}
}
applyTheme((()=>{try{return localStorage.getItem('sfn_theme')||'light'}catch{return 'light'}})());
document.getElementById('themeBtn')?.addEventListener('click',()=>applyTheme(document.body.classList.contains('dark')?'light':'dark'));

window.addEventListener('hashchange',()=>{if(!appBundleLoaded)renderPublic()});
renderPublic();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js?v=20261010-v6',{updateViaCache:'none'}).then(reg=>{
    reg.update().catch(()=>{});
  }).catch(()=>{});
  let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController){hadController=true;return;}
    try{
      if(sessionStorage.getItem('sfn_sw_reloaded_v6')==='1')return;
      sessionStorage.setItem('sfn_sw_reloaded_v6','1');
    }catch{}
    location.reload();
  });
}
