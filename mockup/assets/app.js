/* Creative C — app shell (sidebar/topbar/role switcher) for the CRM mockup.
   Static prototype: role switching only toggles [data-roles] visibility,
   it does not gate any real data. */
(function(){
  const NAV = [
    { group:"Vânzări", items:[
      { key:"dashboard", label:"Pipeline & Dashboard", href:"dashboard.html", ic:"◆", roles:["admin","manager","vanzari"] },
      { key:"clienti", label:"Clienți", href:"clienti.html", ic:"◇", roles:["admin","manager","vanzari"] },
      { key:"programari", label:"Programări", href:"programari.html", ic:"◔", roles:["admin","manager","vanzari"] },
    ]},
    { group:"Livrare", items:[
      { key:"proiecte", label:"Proiecte", href:"proiecte.html", ic:"▤", roles:["admin","manager","editor"] },
      { key:"editori", label:"Canale editori", href:"editori-canale.html", ic:"◈", roles:["admin","manager","editor"] },
      { key:"echipa", label:"Echipă", href:"echipa.html", ic:"◐", roles:["admin","manager"] },
    ]},
    { group:"Business", items:[
      { key:"documente", label:"Documente & Contracte", href:"documente.html", ic:"▥", roles:["admin","manager","vanzari"] },
      { key:"financiar", label:"Financiar", href:"financiar.html", ic:"◑", roles:["admin","manager"] },
      { key:"automatizari", label:"Automatizări", href:"automatizari.html", ic:"⚡", roles:["admin","manager"] },
    ]},
    { group:"Vitrine", items:[
      { key:"portal", label:"Portal client (preview)", href:"portal-client.html", ic:"⧉", roles:["admin","manager"], ext:"CLIENT" },
    ]},
    { group:"Sistem", items:[
      { key:"setari", label:"Setări & Roluri", href:"setari-roluri.html", ic:"⚙", roles:["admin"] },
    ]},
  ];

  const ROLE_LABEL = { admin:"Admin", manager:"Manager", vanzari:"Vânzări", editor:"Editor" };
  const ROLE_NOTE = {
    admin:"Acces complet: date, financiar, roluri, integrări.",
    manager:"Acces operațional complet, fără gestionarea rolurilor.",
    vanzari:"Pipeline, clienți, programări, documente. Fără financiar.",
    editor:"Doar canalul propriu și task-urile alocate din proiecte.",
  };

  function getRole(){ return localStorage.getItem('cc_role') || 'admin'; }
  function setRole(r){ localStorage.setItem('cc_role', r); }

  function renderSidebar(active){
    const role = getRole();
    let html = `<div class="brand">
        <div class="brand-mark">CC</div>
        <div><div class="brand-name">Creative C</div><div class="brand-sub">CRM intern · mockup</div></div>
      </div>`;
    NAV.forEach(g => {
      const visible = g.items.filter(i => i.roles.includes(role));
      if(!visible.length) return;
      html += `<div class="nav-group"><div class="nav-label">${g.group}</div>`;
      visible.forEach(i => {
        html += `<a class="nav-item ${i.key===active?'active':''}" href="${i.href}">
            <span class="ic">${i.ic}</span><span>${i.label}</span>
            ${i.ext ? `<span class="ext">${i.ext}</span>` : ``}
          </a>`;
      });
      html += `</div>`;
    });
    html += `<div class="sidebar-foot"><div class="role-note"><b>Vezi ca: ${ROLE_LABEL[role]}.</b><br>${ROLE_NOTE[role]}</div></div>`;
    return html;
  }

  function renderTopbar(title, sub){
    const role = getRole();
    return `
      <div class="crumb">${title}${sub? `<div class="sub">${sub}</div>`:``}</div>
      <div class="search">🔍 <span>Caută clienți, proiecte, facturi…</span></div>
      <div class="top-actions">
        <div class="role-switch">Rol previzualizare
          <select id="cc-role-select">
            ${Object.keys(ROLE_LABEL).map(r=>`<option value="${r}" ${r===role?'selected':''}>${ROLE_LABEL[r]}</option>`).join('')}
          </select>
        </div>
        <div class="icon-btn">🔔<span class="dot"></span></div>
        <div class="avatar">AX</div>
      </div>`;
  }

  function applyRoleVisibility(){
    const role = getRole();
    document.querySelectorAll('[data-roles]').forEach(el=>{
      const roles = el.getAttribute('data-roles').split(',').map(s=>s.trim());
      el.style.display = roles.includes(role) ? '' : 'none';
    });
  }

  const AppShell = {
    init(opts){
      const sidebar = document.getElementById('sidebar');
      const topbar = document.getElementById('topbar');
      if(sidebar) sidebar.innerHTML = renderSidebar(opts.active);
      if(topbar) topbar.innerHTML = renderTopbar(opts.title, opts.sub);
      applyRoleVisibility();
      const sel = document.getElementById('cc-role-select');
      if(sel) sel.addEventListener('change', e=>{
        setRole(e.target.value);
        if(sidebar) sidebar.innerHTML = renderSidebar(opts.active);
        applyRoleVisibility();
      });
    }
  };
  window.AppShell = AppShell;
})();
