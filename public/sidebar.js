// Shared sidebar component — Venice-style navigation (right side)
(function(){
  const path = location.pathname.replace(/\/$/,'') || '/';

  const NAV = [
    { href:'/chat', icon:'chat', label:'Chat' },
    { href:'/mcp', icon:'mcp', label:'MCP', badge:'New' },
    { href:'/terminal', icon:'terminal', label:'Terminal' },
    { href:'/agents', icon:'agents', label:'Agents' },
    { href:'/privacy', icon:'privacy', label:'x402 Privacy' },
    { hr: true },
    { href:'/settings', icon:'settings', label:'Settings' },
  ];

  const ICONS = {
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    mcp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    terminal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    agents: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    privacy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  };

  const css = document.createElement('style');
  css.textContent = `
    body { margin: 0; }
    .hs-layout { display: flex; min-height: 100vh; }
    .hs-sidebar {
      width: 220px; min-width: 220px;
      background: #0d0d14;
      border-left: 1px solid rgba(255,255,255,0.06);
      display: flex; flex-direction: column;
      position: fixed; top: 0; right: 0; bottom: 0;
      z-index: 1000;
      transition: transform 0.25s ease;
    }
    .hs-sidebar-header {
      padding: 20px 16px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    .hs-sidebar-header img { width: 28px; height: 28px; border-radius: 6px; }
    .hs-sidebar-header span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px; font-weight: 700; color: #fff;
      letter-spacing: -0.3px;
    }
    .hs-sidebar-nav { flex: 1; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
    .hs-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 8px;
      color: #94a3b8; text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px; font-weight: 500;
      transition: all 0.15s;
      position: relative;
    }
    .hs-nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .hs-nav-item.active { color: #fff; background: rgba(255,255,255,0.08); }
    .hs-nav-item .hs-badge {
      font-size: 9px; font-weight: 600;
      background: rgba(167,139,250,0.2); color: #a78bfa;
      padding: 2px 6px; border-radius: 4px;
      margin-left: auto;
    }
    .hs-nav-hr { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 12px; }
    .hs-sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; gap: 10px;
    }
    .hs-sidebar-footer a {
      color: #64748b; font-size: 11px; text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      transition: color 0.15s;
    }
    .hs-sidebar-footer a:hover { color: #fff; }
    .hs-main {
      flex: 1; margin-right: 220px; min-height: 100vh;
      background: #0a0a0f;
    }
    .hs-mobile-toggle {
      display: none;
      position: fixed; top: 12px; right: 12px; z-index: 1001;
      background: #111118; border: 1px solid rgba(255,255,255,0.1);
      color: #fff; width: 40px; height: 40px;
      border-radius: 8px; cursor: pointer;
      align-items: center; justify-content: center;
    }
    .hs-sidebar-close {
      display: none;
      position: absolute; top: 16px; left: 12px;
      background: none; border: none; color: #64748b;
      cursor: pointer; padding: 4px;
    }
    .hs-sidebar-close:hover { color: #fff; }
    .hs-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.6); z-index: 999;
    }
    @media (max-width: 768px) {
      .hs-sidebar { transform: translateX(100%); width: 260px; min-width: 260px; }
      .hs-sidebar.open { transform: translateX(0); }
      .hs-sidebar-close { display: block; }
      .hs-main { margin-right: 0; }
      .hs-mobile-toggle { display: flex; }
      .hs-overlay.open { display: block; }
    }
  `;
  document.head.appendChild(css);

  let navHTML = '';
  NAV.forEach(item => {
    if (item.hr) { navHTML += '<div class="hs-nav-hr"></div>'; return; }
    const active = path === item.href ? ' active' : '';
    const badge = item.badge ? `<span class="hs-badge">${item.badge}</span>` : '';
    navHTML += `<a class="hs-nav-item${active}" href="${item.href}">${ICONS[item.icon]}${item.label}${badge}</a>`;
  });

  const sidebar = document.createElement('div');
  sidebar.className = 'hs-sidebar';
  sidebar.innerHTML = `
    <button class="hs-sidebar-close" onclick="toggleSidebar()">${ICONS.close}</button>
    <div class="hs-sidebar-header">
      <a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
        <img src="/logo.png?v=4" alt="Logo">
        <span>hermes synth</span>
      </a>
    </div>
    <nav class="hs-sidebar-nav">${navHTML}</nav>
    <div class="hs-sidebar-footer">
      <a href="https://github.com/hermesSynth/hermes-synth" target="_blank">GitHub</a>
      <a href="https://x.com/HermesSynth" target="_blank">X / Twitter</a>
      <a href="/" style="margin-left:auto;">${ICONS.home}</a>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'hs-overlay';
  overlay.onclick = function(){ toggleSidebar(); };

  const toggle = document.createElement('button');
  toggle.className = 'hs-mobile-toggle';
  toggle.innerHTML = ICONS.menu;
  toggle.onclick = function(){ toggleSidebar(); };

  const mainWrap = document.createElement('div');
  mainWrap.className = 'hs-main';
  while (document.body.firstChild) {
    mainWrap.appendChild(document.body.firstChild);
  }

  const layout = document.createElement('div');
  layout.className = 'hs-layout';
  layout.appendChild(mainWrap);
  layout.appendChild(sidebar);

  document.body.appendChild(overlay);
  document.body.appendChild(toggle);
  document.body.appendChild(layout);

  window.toggleSidebar = function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  };
})();
