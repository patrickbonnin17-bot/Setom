from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
main = root / "src" / "main.jsx"
text = main.read_text(encoding="utf-8")

import_marker = 'import "./targetUiFoundation.css";'
import_line = 'import "./targetUiV2.css";'
if import_line not in text:
    if import_marker not in text:
        raise SystemExit("targetUiFoundation import marker not found")
    text = text.replace(import_marker, import_marker + "\n" + import_line, 1)

flow_marker = '<div className="os-tabs">{tabs.map((tab)'
flow_block = '''<div className="os-v2-commandbar">
      <div className="os-v2-status-line">
        <span className="os-v2-status-dot" aria-hidden="true"></span>
        <strong>{os.status || "Nouveau"}</strong>
        <span className="os-v2-status-address">{os.address || "Adresse non renseignée"}</span>
      </div>
      <div className="os-v2-actions">
        {canManagePlanning && ["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status) && <button type="button" className="secondary" onClick={() => { setActiveTab("resume"); setOsEditError(""); setOsEditMode(true); }}>✏️ Modifier</button>}
        <button type="button" className="secondary" onClick={() => setActiveTab("photos")}>📷 Avant travaux</button>
        <button type="button" className="secondary" onClick={() => setActiveTab("travaux")}>🛠️ Travaux</button>
        {canViewBilling && <button type="button" className="secondary" onClick={() => setActiveTab("constat")}>📋 Constat</button>}
      </div>
    </div>
    <div className="os-v2-flow" aria-label="Progression de l'OS">
      {["Nouveau", "À planifier", "Planifié", "En travaux", "Réalisé", "Validé"].map((step, index) => {
        const current = String(os.status || "Nouveau");
        const aliases = { "En travaux": ["En travaux", "Travaux en cours"], "Réalisé": ["Réalisé", "Travaux réalisés", "Travaux effectués"], "Validé": ["Validé", "Validé avec réserve", "Payé", "Archivé"] };
        const states = aliases[step] || [step];
        const active = states.includes(current);
        const completed = ["En travaux", "Réalisé", "Validé"].indexOf(step) >= 0 && ["Réalisé", "Validé"].includes(step) && index < (["Nouveau", "À planifier", "Planifié", "En travaux", "Réalisé", "Validé"].indexOf(step));
        return <React.Fragment key={step}><div className={"os-v2-flow-step " + (active ? "active " : "") + (completed ? "completed" : "")}><span>{index + 1}</span><small>{step}</small></div>{index < 5 && <div className="os-v2-flow-line" />}</React.Fragment>;
      })}
    </div>
    <div className="os-tabs">{tabs.map((tab)'''
if flow_marker in text and 'className="os-v2-commandbar"' not in text:
    text = text.replace(flow_marker, flow_block, 1)

# Make the first photo action explicit inside the resume section without changing data logic.
resume_marker = '<div className="os-info-grid">'
photo_callout = '''<div className="os-v2-photo-callout">
      <div><strong>📷 État initial du chantier</strong><span>Ajoutez les photos avant travaux au dossier OS avant de commencer l'intervention.</span></div>
      <button type="button" className="primary" onClick={() => setActiveTab("photos")}>Ajouter une photo avant travaux</button>
    </div><div className="os-info-grid">'''
if resume_marker in text and 'os-v2-photo-callout' not in text:
    text = text.replace(resume_marker, photo_callout, 1)

# Remove the unsupported constat regeneration RPC. The canonical constat is refreshed
# from the final Travaux transmission and read through get_constat_for_work_order.
text = re.sub(
    r'\n      if \(!constatData && os\.status === "Travaux effectués".*?\n      }\n      if\(!cancelled\)',
    '\n      if(!cancelled)',
    text,
    flags=re.S,
)
text = re.sub(
    r'\n  async function regenerateConstatFromWorks\(\).*?\n\n  const canManagePlanning',
    '\n\n  const canManagePlanning',
    text,
    flags=re.S,
)
text = re.sub(
    r'\s*<button className="secondary" type="button"[^>]*onClick=\{regenerateConstatFromWorks\}>↻ Recalculer depuis les travaux</button>',
    '',
    text,
)

main.write_text(text, encoding="utf-8")
