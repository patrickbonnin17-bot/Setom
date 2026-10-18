from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
CSS = ROOT / "src" / "alertCenter.css"
s = MAIN.read_text(encoding="utf-8")

if 'import "./alertCenter.css";' not in s:
    marker = 'import "./style.css";'
    if marker not in s:
        raise SystemExit("SETOM alerts: style import marker not found")
    s = s.replace(marker, marker + '\nimport "./alertCenter.css";', 1)

component = r'''function AlertCenter({ osList = [], onOpenOS, onNavigate }) {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const alerts = [];
  (osList || []).forEach((os) => {
    const id = os.dbId || os.id;
    const label = os.id || "OS";
    if (os.plannedDate && os.plannedDate < iso && !["Travaux réalisés","Travaux effectués","Validé","Payé","Archivé","Annulé"].includes(os.status)) alerts.push({ id: `${id}-late`, tone: "red", title: "OS en retard", text: `${label} · intervention à reprogrammer`, os });
    if (["Travaux réalisés","Travaux effectués","Constat à vérifier","Constat de facturation"].includes(os.status)) alerts.push({ id: `${id}-control`, tone: "purple", title: "Constat à contrôler", text: `${label} · contrôle avant validation`, os });
    if (os.status === "Réserve" || os.constatStatus === "Validé avec réserve") alerts.push({ id: `${id}-reserve`, tone: "orange", title: "Réserve ouverte", text: `${label} · action nécessaire avant clôture`, os });
    if (["En travaux","Travaux en cours"].includes(os.status) && Number(os.workPhotoCount || os.travauxPhotoCount || 0) === 0) alerts.push({ id: `${id}-photo`, tone: "blue", title: "Photos travaux manquantes", text: `${label} · ajouter les photos de réalisation`, os });
    if (["Nouveau","À planifier","Planifié"].includes(os.status) && !os.teamId) alerts.push({ id: `${id}-team`, tone: "blue", title: "Équipe non affectée", text: `${label} · affecter une équipe`, os });
  });
  const priority = { red: 0, orange: 1, purple: 2, blue: 3 };
  alerts.sort((a,b) => (priority[a.tone] ?? 9) - (priority[b.tone] ?? 9));
  const visible = alerts.slice(0, 8);
  return <section className="setom-alert-center">
    <div className="setom-alert-head"><div><span>VIGILANCE OPÉRATIONNELLE</span><h2>Alertes à traiter</h2></div><div className="setom-alert-count">{alerts.length}</div></div>
    {visible.length ? <div className="setom-alert-list">{visible.map((alert) => <button className="setom-alert-row" key={alert.id} onClick={() => onOpenOS ? onOpenOS(alert.os) : onNavigate("os")}><i className={`setom-alert-dot ${alert.tone}`}></i><span><strong>{alert.title}</strong><small>{alert.text}</small></span><b>›</b></button>)}</div> : <div className="setom-alert-empty">Aucune alerte opérationnelle. Les dossiers actifs sont à jour.</div>}
    {alerts.length > 8 && <button className="setom-alert-more" onClick={() => onNavigate("os")}>Voir les {alerts.length} alertes dans les OS →</button>}
  </section>;
}
'''

if 'function AlertCenter(' not in s:
    anchor = 'function DashboardCockpit('
    idx = s.find(anchor)
    if idx == -1:
        raise SystemExit("SETOM alerts: dashboard anchor not found")
    s = s[:idx] + component + '\n' + s[idx:]

# Put the alert center immediately before the dashboard cockpit, so it is visible on the home page without replacing the existing dashboard.
if '<AlertCenter ' not in s:
    marker = 'page === "dashboard" && <DashboardCockpit '
    idx = s.find(marker)
    if idx == -1:
        raise SystemExit("SETOM alerts: dashboard render anchor not found")
    line_start = s.rfind('\n', 0, idx) + 1
    # Insert inside the dashboard branch before the cockpit component.
    s = s[:line_start] + '      <AlertCenter osList={osList} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />\n' + s[line_start:]

MAIN.write_text(s, encoding="utf-8")
CSS.write_text(r'''
.setom-alert-center{margin:0 auto 14px;max-width:1480px;background:#fff;border:1px solid #dbe5ec;border-radius:12px;padding:14px 16px;box-shadow:0 4px 14px rgba(17,42,62,.045)}
.setom-alert-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.setom-alert-head span{font-size:9px;letter-spacing:.12em;font-weight:900;color:#718391}.setom-alert-head h2{margin:3px 0 0;font-size:16px;color:#102b43}.setom-alert-count{min-width:30px;height:30px;padding:0 9px;border-radius:999px;background:#eef4f8;color:#17334d;display:grid;place-items:center;font-weight:900;font-size:12px}
.setom-alert-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.setom-alert-row{display:grid;grid-template-columns:8px minmax(0,1fr) 16px;gap:9px;align-items:center;padding:9px 8px;border:1px solid #edf1f4;border-radius:8px;background:#fbfcfd;text-align:left;cursor:pointer}.setom-alert-row:hover{background:#f5f9fc}.setom-alert-row>span{display:flex;flex-direction:column;min-width:0}.setom-alert-row strong{font-size:10px;color:#17334d}.setom-alert-row small{font-size:9px;color:#788995;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.setom-alert-row>b{font-size:18px;color:#9aa8b2}.setom-alert-dot{width:8px;height:8px;border-radius:50%}.setom-alert-dot.red{background:#d94848}.setom-alert-dot.orange{background:#ef9a35}.setom-alert-dot.purple{background:#7758c8}.setom-alert-dot.blue{background:#0788ee}.setom-alert-empty{padding:12px;border-radius:8px;background:#f5f8fa;color:#748592;font-size:10px}.setom-alert-more{margin-top:8px;border:0;background:transparent;color:#0874c1;font-weight:800;font-size:10px;cursor:pointer}
@media(max-width:800px){.setom-alert-list{grid-template-columns:1fr}.setom-alert-center{margin-left:0;margin-right:0}.setom-alert-row{min-height:50px}}
''', encoding="utf-8")
print("SETOM: alert center added")
