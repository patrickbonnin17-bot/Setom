from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
CSS = ROOT / "src" / "dashboardIntelligence.css"
s = MAIN.read_text(encoding="utf-8")

if 'import "./dashboardIntelligence.css";' not in s:
    marker = 'import "./dashboardCockpit.css";'
    if marker not in s:
        raise SystemExit("dashboard intelligence: cockpit css import not found")
    s = s.replace(marker, marker + '\nimport "./dashboardIntelligence.css";', 1)

component = r'''function DashboardOperationalIntelligence({ onNavigate }) {
  const [state, setState] = React.useState(() => window.setomOperationalIntelligence || null);
  React.useEffect(() => {
    const refresh = () => setState(window.setomOperationalIntelligence || null);
    refresh();
    window.addEventListener("setom:operational-intelligence", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("setom:operational-intelligence", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  if (!state) return <section className="setom-intelligence-panel"><div className="setom-intelligence-empty">Analyse chargement en préparation…</div></section>;
  const alerts = Array.isArray(state.alerts) ? state.alerts.slice(0, 5) : [];
  const fmt = (n) => Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)} t` : "—";
  return <section className="setom-intelligence-panel">
    <div className="setom-intelligence-head"><div><span className="setom-eyebrow">INTELLIGENCE OPÉRATIONNELLE</span><h2>Ce que SETOM détecte aujourd’hui</h2><p>Écarts de chargement et de consommation issus du pilotage réel.</p></div><button className="link-button" onClick={() => onNavigate("chargement")}>Ouvrir le chargement →</button></div>
    <div className="setom-intelligence-kpis"><div><span>Prévu</span><strong>{fmt(state.totalPlanned)}</strong></div><div><span>Chargé</span><strong>{fmt(state.totalLoaded)}</strong></div><div><span>Consommé</span><strong>{fmt(state.totalConsumed)}</strong></div><div className="warn"><span>À charger</span><strong>{fmt(state.remainingToLoad)}</strong></div><div className="warn"><span>Restant chargé</span><strong>{fmt(state.remainingLoaded)}</strong></div></div>
    {alerts.length ? <div className="setom-intelligence-alerts">{alerts.map((a, i) => <button key={`${a.orderId || "x"}-${i}`} className={`setom-intelligence-alert ${a.severity || "info"}`} onClick={() => onNavigate("os")}><span className="dot"/><span><strong>{a.osNumber || "OS"}</strong><small>{a.message}</small></span><b>{a.value != null ? `${Number(a.value).toFixed(1)} t` : "Voir"}</b></button>)}</div> : <div className="setom-intelligence-empty">Aucun écart significatif détecté pour le moment.</div>}
  </section>;
}
'''
if 'function DashboardOperationalIntelligence(' not in s:
    anchor = 'function LocalImagePreview({ file }) {'
    if anchor not in s:
        raise SystemExit("dashboard intelligence: insertion anchor not found")
    s = s.replace(anchor, component + '\n' + anchor, 1)

needle = 'function DashboardCockpit({'
if 'DashboardOperationalIntelligence' not in s[s.find(needle):s.find(needle)+8000]:
    marker = '    <section className="setom-dashboard-panel setom-dashboard-market">'
    pos = s.find(marker)
    if pos < 0:
        raise SystemExit("dashboard intelligence: market panel not found")
    end = s.find('\n  </section>;', pos)
    if end < 0:
        raise SystemExit("dashboard intelligence: dashboard end not found")
    s = s[:end] + '\n    <DashboardOperationalIntelligence onNavigate={onNavigate} />' + s[end:]

MAIN.write_text(s, encoding="utf-8")
CSS.write_text(r'''.setom-intelligence-panel{margin:0 0 14px;padding:16px;background:linear-gradient(180deg,#f9fcfe,#fff);border:1px solid #cfe1ec;border-radius:12px;box-shadow:0 4px 14px rgba(17,42,62,.045)}.setom-intelligence-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:12px}.setom-intelligence-head h2{margin:3px 0;font-size:16px;color:#102b43}.setom-intelligence-head p{margin:0;color:#748592;font-size:10px}.setom-intelligence-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}.setom-intelligence-kpis>div{padding:9px 10px;border:1px solid #e1e9ee;border-radius:8px;background:#fff}.setom-intelligence-kpis span{display:block;font-size:9px;color:#7b8b97}.setom-intelligence-kpis strong{display:block;margin-top:2px;font-size:17px;color:#17334d}.setom-intelligence-kpis .warn{border-color:#f1d9ae;background:#fffaf1}.setom-intelligence-alerts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.setom-intelligence-alert{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:9px;text-align:left;border:1px solid #e3e9ed;background:#fff;border-radius:8px;padding:8px;cursor:pointer}.setom-intelligence-alert:hover{background:#f7fafc}.setom-intelligence-alert .dot{width:7px;height:7px;border-radius:50%;background:#e39a2d}.setom-intelligence-alert.warning .dot{background:#e39a2d}.setom-intelligence-alert.critical .dot{background:#d94848}.setom-intelligence-alert span:nth-child(2){display:flex;flex-direction:column;min-width:0}.setom-intelligence-alert strong{font-size:10px;color:#17334d}.setom-intelligence-alert small{font-size:9px;color:#778894;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.setom-intelligence-alert b{font-size:9px;color:#b66b0c}.setom-intelligence-empty{padding:11px;border-radius:8px;background:#f5f8fa;color:#788995;font-size:10px;text-align:center}@media(max-width:900px){.setom-intelligence-kpis{grid-template-columns:repeat(3,1fr)}.setom-intelligence-alerts{grid-template-columns:1fr}}@media(max-width:600px){.setom-intelligence-head{align-items:flex-start;flex-direction:column}.setom-intelligence-kpis{grid-template-columns:repeat(2,1fr)}}''', encoding="utf-8")
print("SETOM: dashboard operational intelligence added")
