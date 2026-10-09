(()=>{
  let currentLogo='/sfn-logo.png';
  let currentName='Trung Tâm Thành Viên Số Sky First';
  const localImage=(value)=>{
    const p=String(value||'').trim();
    if(p==='/sfn-logo.png')return p;
    return /^\/files\/site-assets\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:png|jpg|webp)$/i.test(p)?p:'/sfn-logo.png';
  };
  const color=(value,fallback)=>/^#[a-f0-9]{6}$/i.test(String(value||''))?String(value):fallback;
  const applyBrand=(root=document)=>{
    if(!root||root.nodeType!==1&&root!==document)return;
    const all=(selector)=>{const out=[];if(root.matches?.(selector))out.push(root);out.push(...(root.querySelectorAll?.(selector)||[]));return out};
    all('[data-site-name]').forEach(el=>el.textContent=currentName);
    all('img[data-brand-logo]').forEach(el=>{const expected=currentLogo;if(el.src!==new URL(expected,location.origin).href)el.src=expected;el.onerror=()=>{el.onerror=null;el.src='/sfn-logo.png'};});
  };
  const observer=new MutationObserver(records=>{for(const rec of records)for(const node of rec.addedNodes)if(node.nodeType===1)applyBrand(node)});
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  fetch('/api/public/portal-config',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data||typeof data!=='object')return;
    const b=data.brand&&typeof data.brand==='object'?data.brand:{};
    const root=document.documentElement;
    const primary=color(b.primaryColor,'#2563eb'),accent=color(b.accentColor,'#38bdf8'),nav=color(b.navColor,'#0b1220');
    root.style.setProperty('--blue',primary);root.style.setProperty('--cyan',accent);root.style.setProperty('--nav',nav);
    root.style.setProperty('--sf-blue',primary);root.style.setProperty('--sf-blue-2',accent);root.style.setProperty('--sf-navy',nav);
    root.style.setProperty('--ui-radius',Math.min(24,Math.max(8,Number(b.cornerRadius)||18))+'px');
    root.style.setProperty('--content-max-width',Math.min(1680,Math.max(1080,Number(b.contentMaxWidth)||1500))+'px');
    root.style.fontSize=Math.min(20,Math.max(14,Number(b.baseFontSize)||16))+'px';
    const fonts=['Arial','Verdana','Georgia','Tahoma','system'];const font=fonts.includes(b.fontFamily)?b.fontFamily:'system';
    root.style.fontFamily=font==='system'?'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif':font+',sans-serif';
    currentName=String(b.siteName||'Trung Tâm Thành Viên Số Sky First').slice(0,100);
    currentLogo=localImage(b.logoUrl);
    const titleBase=String(document.title||'').split(' · ')[0].trim();
    document.title=titleBase?`${titleBase} · ${currentName}`:currentName;
    applyBrand(document);
  }).catch(()=>{});
})();
