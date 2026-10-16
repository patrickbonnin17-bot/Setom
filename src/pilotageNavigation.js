const PILOTAGE_NAV_ID = "setom-pilotage-nav-button";
const PILOTAGE_PAGE_ID = "setom-pilotage-page";
const PILOTAGE_ACTIONS_ID = "setom-pilotage-actions";

function findContainer() {
  return document.querySelector("main.container");
}

function ensurePilotagePage() {
  const container = findContainer();
  if (!container) return null;
  let page = document.getElementById(PILOTAGE_PAGE_ID);
  if (!page) {
    page = document.createElement("section");
    page.id = PILOTAGE_PAGE_ID;
    page.setAttribute("aria-label", "Pilotage chantier");
    page.innerHTML = `
      <div class="setom-pilotage-hero">
        <div>
          <div class="setom-pilotage-eyebrow">Pilotage chantier</div>
          <h2>Temps, coûts, matériaux et rentabilité</h2>
          <p>Le suivi opérationnel et financier de la journée, regroupé au même endroit.</p>
        </div>
        <span class="setom-pilotage-status">Gestion</span>
      </div>
      <div id="${PILOTAGE_ACTIONS_ID}" class="setom-pilotage-actions"></div>
    `;
    container.appendChild(page);
  }
  return page;
}

function ensurePilotageNav() {
  const nav = document.querySelector("main.container .nav");
  if (!nav) return null;
  if (document.getElementById(PILOTAGE_NAV_ID)) return document.getElementById(PILOTAGE_NAV_ID);
  const navButtons = Array.from(nav.querySelectorAll("button"));
  if (navButtons.length < 5) return null;
  const planning = navButtons.find((button) => /Planning/i.test(button.textContent || ""));
  if (!planning) return null;
  const button = document.createElement("button");
  button.id = PILOTAGE_NAV_ID;
  button.type = "button";
  button.textContent = "📊 Pilotage";
  button.className = "setom-pilotage-nav-button";
  planning.insertAdjacentElement("afterend", button);
  return button;
}

function setPilotageActive(active) {
  const container = findContainer();
  const nav = container?.querySelector(".nav");
  const page = ensurePilotagePage();
  if (!container || !nav || !page) return;
  const button = ensurePilotageNav();
  if (button) button.classList.toggle("active", active);

  Array.from(container.children).forEach((child) => {
    if (child === nav || child === page) return;
    if (active) {
      if (!child.dataset.setomPilotageDisplay) child.dataset.setomPilotageDisplay = child.style.display || "";
      child.style.display = "none";
    } else if (child.dataset.setomPilotageDisplay !== undefined) {
      child.style.display = child.dataset.setomPilotageDisplay;
      delete child.dataset.setomPilotageDisplay;
    }
  });
  page.style.display = active ? "block" : "none";
}

function bindNav() {
  const nav = document.querySelector("main.container .nav");
  if (!nav || nav.dataset.setomPilotageBound === "1") return;
  nav.dataset.setomPilotageBound = "1";
  nav.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.id === PILOTAGE_NAV_ID) {
      event.preventDefault();
      event.stopPropagation();
      setPilotageActive(true);
      return;
    }
    if (target.closest(".nav")) setPilotageActive(false);
  }, true);
}

function installStyles() {
  if (document.getElementById("setom-pilotage-page-style")) return;
  const style = document.createElement("style");
  style.id = "setom-pilotage-page-style";
  style.textContent = `
    #${PILOTAGE_PAGE_ID}{display:none;margin-top:4px}
    .setom-pilotage-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;margin-bottom:18px;border:1px solid #dbe3ee;border-radius:18px;background:linear-gradient(135deg,#ffffff,#f5f8fc);box-shadow:0 5px 18px rgba(15,23,42,.05)}
    .setom-pilotage-eyebrow{font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px}
    .setom-pilotage-hero h2{margin:0;font-size:24px;color:#17202a}
    .setom-pilotage-hero p{margin:6px 0 0;color:#667085;font-size:13px}
    .setom-pilotage-status{flex:0 0 auto;padding:7px 11px;border-radius:999px;background:#eef2f6;border:1px solid #dbe3ee;color:#475467;font-size:11px;font-weight:800}
    #${PILOTAGE_ACTIONS_ID}{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
    #${PILOTAGE_ACTIONS_ID}>button{position:static!important;inset:auto!important;z-index:auto!important;width:100%!important;min-height:76px!important;margin:0!important;padding:14px 12px!important;border-radius:12px!important;box-shadow:0 3px 10px rgba(15,23,42,.06)!important;white-space:normal!important;font-size:13px!important}
    #${PILOTAGE_ACTIONS_ID}>button:hover{transform:translateY(-2px);filter:brightness(.98)}
    .setom-pilotage-nav-button{font-weight:750}
    @media(max-width:1100px){#${PILOTAGE_ACTIONS_ID}{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:650px){.setom-pilotage-hero{align-items:flex-start;padding:18px;flex-direction:column}.setom-pilotage-hero h2{font-size:21px}.setom-pilotage-status{display:none}#${PILOTAGE_ACTIONS_ID}{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

installStyles();
let observer;
function tick() {
  ensurePilotagePage();
  ensurePilotageNav();
  bindNav();
  const page = document.getElementById(PILOTAGE_PAGE_ID);
  if (page?.style.display === "block") {
    const actions = document.getElementById(PILOTAGE_ACTIONS_ID);
    if (actions) {
      [
        "setom-daily-labor-cost-btn",
        "setom-materials-finance-widget-btn",
        "setom-materials-stock-widget-button",
        "setom-profitability-widget-btn"
      ].forEach((id) => {
        const button = document.getElementById(id);
        if (button && button.parentElement !== actions) actions.appendChild(button);
      });
    }
  }
}
observer = new MutationObserver(tick);
observer.observe(document.body, { childList: true, subtree: true });
setInterval(tick, 500);
tick();
