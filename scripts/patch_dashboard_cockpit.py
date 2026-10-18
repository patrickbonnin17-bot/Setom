from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
CSS = ROOT / "src" / "dashboardCockpit.css"

s = MAIN.read_text(encoding="utf-8")

if 'import "./dashboardCockpit.css";' not in s:
    marker = 'import "./style.css";'
    if marker not in s:
        raise SystemExit("SETOM dashboard: style import marker not found")
    s = s.replace(marker, marker + '\nimport "./dashboardCockpit.css";', 1)

component = r'''function DashboardCockpit({ osList, dbTeams, dbMaterials, appSettings, onOpenOS, onNavigate }) {
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const active = (osList || []).filter((os) => !["Archivé", "Annulé", "Payé"].includes(os.status));
  const plannedToday = active.filter((os) => os.plannedDate === isoToday || os.day === today.toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase()));
  const late = active.filter((os) => os.plannedDate && os.plannedDate < isoToday && !["Travaux réalisés", "Travaux effectués", "Validé", "Validé avec réserve", "Payé"].includes(os.status));
  const inWork = active.filter((os) => ["En travaux", "Travaux en cours"].includes(os.status));
  const control = active.filter((os) => ["Constat à vérifier", "Constat de facturation", "En attente de validation", "Contrôle"].includes(os.status));
  const reserves = active.filter((os) => (os.constatStatus === "Validé avec réserve" || os.status === "Réserve") && !os.reserveResolvedAt);
  const planned = active.filter((os) => os.plannedDate);
  const unassigned = active.filter((os) => !os.teamId);
  const materialNames = new Map((dbMaterials || []).map((m) => [m.name, m]));
  const tonnage = plannedToday.reduce((sum, os) => {
    const direct = Number(os.plannedTonnage ?? os.tonnage ?? os.materialTonnage ?? 0);
    if (Number.isFinite(direct) && direct > 0) return sum + direct;
    const surface = Number(os.quantity || os.surface || 0);
    const material = materialNames.get(os.material || os.work);
    const capacity = Number(material?.indicative_capacity_m2 || 0);
    return sum + (capacity > 0 && surface > 0 ? surface / capacity : 0);
  }, 0);
  const progress = active.length ? Math.round((planned.length / active.length) * 100) : 0;

  const nextAction = (os) => {
    if (!os.teamId && ["Nouveau", "À planifier", "Planifié"].includes(os.status)) return { label: "Affecter une équipe", tone: "blue" };
    if (["Planifié"].includes(os.status)) return { label: "Démarrer les travaux", tone: "blue" };
    if (["En travaux", "Travaux en cours"].includes(os.status)) return { label: "Terminer les mesures et transmettre", tone: "orange" };
    if (["Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation"].includes(os.status)) return { label: "Contrôler le constat", tone: "purple" };
    if (os.status === "Réserve" || os.constatStatus === "Validé avec réserve") return { label: "Corriger la réserve", tone: "red" };
    if (["Validé", "Payé", "Archivé"].includes(os.status)) return { label: "Dossier à jour", tone: "green" };
    return { label: "Préparer la prochaine étape", tone: "blue" };
  };

  const actionOS = [...active].sort((a, b) => {
    const rank = (os) => ({ red: 0, orange: 1, purple: 2, blue: 3, green: 4 }[nextAction(os).tone] ?? 5);
    return rank(a) - rank(b);
  }).slice(0, 7);

  const kpis = [
    ["À traiter aujourd’hui", plannedToday.length, "OS planifiés", "blue"],
    ["OS en retard", late.length, "à reprogrammer", "red"],
    ["En travaux", inWork.length, "équipes mobilisées", "orange"],
    ["Constats à contrôler", control.length, "avant validation", "purple"],
    ["Réserves ouvertes", reserves.length, "à lever", "red"],
    ["Tonnage prévu", tonnage > 0 ? `${tonnage.toFixed(1)} t` : "—", "chargement du jour", "green"],
  ];

  return <section className="setom-dashboard-cockpit">
    <header className="setom-dashboard-hero">
      <div><span className="setom-eyebrow">COCKPIT OPÉRATIONNEL</span><h1>Bonjour, bienvenue sur SETOM</h1><p>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · {appSettings?.company_name || "Suivi des interventions"}</p></div>
      <div className="setom-dashboard-hero-actions"><button className="secondary" onClick={() => onNavigate("planning")}>Planning</button><button className="primary" onClick={() => onNavigate("os")}>Voir les OS</button></div>
    </header>

    <div className="setom-dashboard-kpis">{kpis.map(([label, value, hint, tone]) => <button key={label} className={`setom-dashboard-kpi ${tone}`} onClick={() => onNavigate(label === "Tonnage prévu" ? "chargement" : label === "À traiter aujourd’hui" ? "planning" : "os")}><span>{label}</span><strong>{value}</strong><small>{hint}</small></button>)}</div>

    <div className="setom-dashboard-main-grid">
      <section className="setom-dashboard-panel setom-dashboard-actions-panel"><div className="setom-panel-title"><div><span className="setom-eyebrow">PRIORITÉS</span><h2>OS nécessitant une action</h2></div><span>{actionOS.length} dossier{actionOS.length > 1 ? "s" : ""}</span></div>
        {actionOS.length === 0 ? <div className="setom-dashboard-empty">Aucune action urgente. Le tableau de bord est à jour.</div> : <div className="setom-action-list">{actionOS.map((os) => { const action = nextAction(os); return <button className="setom-action-row" key={os.dbId || os.id} onClick={() => onOpenOS(os)}><span className={`setom-action-dot ${action.tone}`}></span><span className="setom-action-content"><strong>{os.id}</strong><small>{os.address || "Adresse non renseignée"}</small></span><span className={`setom-action-badge ${action.tone}`}>{action.label}</span><span className="setom-action-arrow">›</span></button>; })}</div>}
      </section>

      <section className="setom-dashboard-panel"><div className="setom-panel-title"><div><span className="setom-eyebrow">ACTIVITÉ DU JOUR</span><h2>Interventions planifiées</h2></div><button className="link-button" onClick={() => onNavigate("planning")}>Ouvrir le planning →</button></div>
        <div className="setom-today-summary"><div><strong>{plannedToday.length}</strong><span>OS</span></div><div><strong>{inWork.filter((os) => plannedToday.includes(os)).length}</strong><span>en cours</span></div><div><strong>{unassigned.filter((os) => plannedToday.includes(os)).length}</strong><span>sans équipe</span></div><div><strong>{tonnage > 0 ? tonnage.toFixed(1) : "—"}</strong><span>tonnes</span></div></div>
        <div className="setom-progress-block"><div><span>Planification du parc actif</span><b>{progress}%</b></div><div className="setom-progress-track"><i style={{ width: `${progress}%` }} /></div></div>
        <div className="setom-team-list">{(dbTeams || []).filter((t) => t.active !== false).slice(0, 5).map((team) => { const count = plannedToday.filter((os) => os.teamId === team.id).length; return <div key={team.id}><span className="setom-team-avatar">{String(team.name || "?").slice(0, 1).toUpperCase()}</span><span>{team.name}</span><b>{count} OS</b></div>; })}</div>
      </section>
    </div>

    <section className="setom-dashboard-panel setom-dashboard-market"><div className="setom-panel-title"><div><span className="setom-eyebrow">PILOTAGE DU MARCHÉ</span><h2>Vue synthétique SETOM</h2></div><span>{active.length} OS actifs</span></div><div className="setom-market-grid"><div><span>OS actifs</span><strong>{active.length}</strong></div><div><span>Planifiés</span><strong>{planned.length}</strong></div><div><span>En retard</span><strong>{late.length}</strong></div><div><span>Sans équipe</span><strong>{unassigned.length}</strong></div><div><span>Réserves</span><strong>{reserves.length}</strong></div></div></section>
  </section>;
}
'''

if 'function DashboardCockpit(' not in s:
    anchor = 'function LocalImagePreview({ file }) {'
    if anchor not in s:
        raise SystemExit("SETOM dashboard: component insertion anchor not found")
    s = s.replace(anchor, component + '\n' + anchor, 1)

# Replace only the existing dashboard render block, keeping all other pages untouched.
if 'className="setom-dashboard-cockpit"' not in s[s.find('function App()'):]:
    pattern = re.compile(r'\{page === "dashboard" && \(.*?\n\s*\{page === "os" && \(', re.S)
    match = pattern.search(s)
    if not match:
        raise SystemExit("SETOM dashboard: dashboard render block not found before OS page")
    replacement = '''{page === "dashboard" && <DashboardCockpit osList={osList} dbTeams={dbTeams} dbMaterials={dbMaterials} appSettings={appSettings} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />}\n\n      {page === "os" && ('''
    s = s[:match.start()] + replacement + s[match.end():]

MAIN.write_text(s, encoding="utf-8")

CSS.write_text(r'''/* SETOM Dashboard Cockpit — operational overview */
.setom-dashboard-cockpit{max-width:1480px;margin:0 auto;padding:4px 0 28px;color:#102b43}.setom-dashboard-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px 26px;margin-bottom:16px;border-radius:14px;background:linear-gradient(115deg,#062a45 0%,#0b466d 68%,#087fd7 100%);color:#fff;box-shadow:0 8px 24px rgba(6,42,69,.15)}.setom-dashboard-hero h1{margin:5px 0 4px;font-size:26px;letter-spacing:-.02em}.setom-dashboard-hero p{margin:0;color:rgba(255,255,255,.78);font-size:12px}.setom-eyebrow{font-size:9px;letter-spacing:.12em;font-weight:900;color:#6e8596}.setom-dashboard-hero .setom-eyebrow{color:#8ed0ff}.setom-dashboard-hero-actions{display:flex;gap:8px}.setom-dashboard-hero-actions button{min-width:110px}.setom-dashboard-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}.setom-dashboard-kpi{border:1px solid #dbe6ed;background:#fff;border-radius:11px;padding:13px;text-align:left;min-height:112px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;box-shadow:0 3px 12px rgba(17,42,62,.045);transition:.15s}.setom-dashboard-kpi:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(17,42,62,.08)}.setom-dashboard-kpi>span{font-size:10px;font-weight:800;color:#64788a}.setom-dashboard-kpi strong{font-size:27px;line-height:1;color:#102b43}.setom-dashboard-kpi small{font-size:9px;color:#8a99a5}.setom-dashboard-kpi.blue{border-top:3px solid #0788ee}.setom-dashboard-kpi.red{border-top:3px solid #d94848}.setom-dashboard-kpi.orange{border-top:3px solid #ef9a35}.setom-dashboard-kpi.purple{border-top:3px solid #7758c8}.setom-dashboard-kpi.green{border-top:3px solid #28a56a}.setom-dashboard-main-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:14px}.setom-dashboard-panel{background:#fff;border:1px solid #dbe5ec;border-radius:12px;padding:16px;box-shadow:0 4px 14px rgba(17,42,62,.045);margin-bottom:14px}.setom-panel-title{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:13px}.setom-panel-title h2{font-size:16px;margin:3px 0 0;color:#102b43}.setom-panel-title>span{font-size:10px;color:#718391;font-weight:700}.setom-action-list{display:flex;flex-direction:column}.setom-action-row{display:grid;grid-template-columns:9px minmax(0,1fr) auto 18px;align-items:center;gap:10px;width:100%;padding:10px 5px;border:0;border-top:1px solid #edf1f4;background:#fff;text-align:left;cursor:pointer}.setom-action-row:first-child{border-top:0}.setom-action-row:hover{background:#f7fafc}.setom-action-dot{width:8px;height:8px;border-radius:50%}.setom-action-dot.red{background:#d94848}.setom-action-dot.orange{background:#ef9a35}.setom-action-dot.purple{background:#7758c8}.setom-action-dot.blue{background:#0788ee}.setom-action-dot.green{background:#28a56a}.setom-action-content{min-width:0;display:flex;flex-direction:column}.setom-action-content strong{font-size:11px;color:#17334d}.setom-action-content small{font-size:9px;color:#7a8b98;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.setom-action-badge{font-size:9px;font-weight:800;padding:5px 7px;border-radius:999px;white-space:nowrap}.setom-action-badge.red{background:#fff0f0;color:#b53131}.setom-action-badge.orange{background:#fff5e8;color:#a35d0d}.setom-action-badge.purple{background:#f2effd;color:#6544b4}.setom-action-badge.blue{background:#eaf5ff;color:#0870bd}.setom-action-badge.green{background:#eaf8f1;color:#218353}.setom-action-arrow{font-size:20px;color:#a1adb6}.setom-dashboard-empty{padding:28px;text-align:center;color:#81909b;background:#f7fafc;border-radius:9px;font-size:11px}.setom-today-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:15px}.setom-today-summary>div{padding:10px;border-radius:8px;background:#f5f8fa;border:1px solid #e5ebef}.setom-today-summary strong{display:block;font-size:19px;color:#102b43}.setom-today-summary span{font-size:9px;color:#748592}.setom-progress-block{margin-bottom:15px}.setom-progress-block>div:first-child{display:flex;justify-content:space-between;font-size:10px;color:#627686;margin-bottom:6px}.setom-progress-block b{color:#102b43}.setom-progress-track{height:8px;background:#e8eef2;border-radius:99px;overflow:hidden}.setom-progress-track i{display:block;height:100%;background:linear-gradient(90deg,#0788ee,#28a56a);border-radius:99px}.setom-team-list{display:flex;flex-direction:column;gap:6px}.setom-team-list>div{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #edf1f4;font-size:10px}.setom-team-list b{font-size:9px;color:#607688}.setom-team-avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#eaf5ff;color:#0870bd;font-weight:900}.setom-market{margin-top:0}.setom-market-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.setom-market-grid>div{padding:12px;background:#f7fafc;border:1px solid #e3ebf0;border-radius:8px}.setom-market-grid span{display:block;font-size:9px;color:#718391}.setom-market-grid strong{display:block;margin-top:4px;font-size:20px;color:#102b43}.link-button{border:0;background:none;color:#0875c4;font-size:10px;font-weight:800;cursor:pointer}.setom-dashboard-hero .primary{background:#fff!important;color:#076fb8!important}.setom-dashboard-hero .secondary{background:rgba(255,255,255,.1)!important;color:#fff!important;border-color:rgba(255,255,255,.25)!important}
@media(max-width:1150px){.setom-dashboard-kpis{grid-template-columns:repeat(3,1fr)}.setom-dashboard-main-grid{grid-template-columns:1fr}.setom-market-grid{grid-template-columns:repeat(5,1fr)}}
@media(max-width:720px){.setom-dashboard-hero{align-items:flex-start;flex-direction:column;padding:18px}.setom-dashboard-hero h1{font-size:21px}.setom-dashboard-hero-actions{width:100%}.setom-dashboard-hero-actions button{flex:1}.setom-dashboard-kpis{grid-template-columns:repeat(2,1fr)}.setom-dashboard-kpi{min-height:100px}.setom-dashboard-main-grid{display:block}.setom-today-summary{grid-template-columns:repeat(2,1fr)}.setom-market-grid{grid-template-columns:repeat(2,1fr)}.setom-action-row{grid-template-columns:8px minmax(0,1fr) 18px}.setom-action-badge{display:none}}
''', encoding="utf-8")
print("SETOM: dashboard cockpit applied")
