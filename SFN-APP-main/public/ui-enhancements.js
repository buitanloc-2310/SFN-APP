(() => {
  const menu=document.getElementById("mainNav");
  const toggle=document.getElementById("menuToggle");
  toggle?.addEventListener("click",()=>{
    const open=menu?.classList.toggle("open");
    toggle.setAttribute("aria-expanded",String(!!open));
  });
  document.querySelectorAll(".nav-trigger").forEach(btn=>{
    btn.addEventListener("click",e=>{
      if(window.innerWidth<=900){
        e.preventDefault();
        btn.parentElement.classList.toggle("open");
      }
    });
  });
  document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>{
    if(window.innerWidth<=900) menu?.classList.remove("open");
  }));
})();
