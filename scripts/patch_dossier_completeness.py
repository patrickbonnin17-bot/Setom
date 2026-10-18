from pathlib import Path

root = Path(__file__).resolve().parents[1]
main = root / "src" / "main.jsx"
text = main.read_text(encoding="utf-8")

import_marker = 'import "./targetUiV2.css";'
import_line = 'import "./dossierCompleteness.css";'
if import_marker in text and import_line not in text:
    text = text.replace(import_marker, import_marker + "\n" + import_line, 1)

marker = '<div className="os-v2-photo-callout">'
checklist = '''<div className="os-dossier-checklist">
      <div className="os-dossier-checklist-head">
        <div><strong>Contrôle du dossier</strong><span>SETOM vérifie les éléments essentiels avant de passer à l'étape suivante.</span></div>
        <span className="os-dossier-checklist-badge">{[
          !!(os.address && String(os.address).trim()),
          Array.isArray(os.attachments) && os.attachments.some((a) => ["avant_travaux", "avant travaux", "avant"].includes(String(a.category || a.type || "").toLowerCase())),
          !!(os.realized_surface_m2 || os.actual_surface_m2 || os.realizedSurfaceM2),
          Array.isArray(os.attachments) && os.attachments.some((a) => ["apres_travaux", "après travaux", "apres", "travaux_realises"].includes(String(a.category || a.type || "").toLowerCase())),
          !!os.constat
        ].filter(Boolean).length}/5</span>
      </div>
      <div className="os-dossier-checklist-grid">
        <button type="button" className="os-check-item" onClick={() => setActiveTab("resume")}><span className="os-check-icon">{os.address ? "✓" : "!"}</span><span><b>Informations OS</b><small>{os.address ? "Adresse renseignée" : "Adresse à compléter"}</small></span></button>
        <button type="button" className="os-check-item" onClick={() => setActiveTab("photos")}><span className="os-check-icon">{Array.isArray(os.attachments) && os.attachments.some((a) => ["avant_travaux", "avant travaux", "avant"].includes(String(a.category || a.type || "").toLowerCase())) ? "✓" : "!"}</span><span><b>Photo avant travaux</b><small>État initial du chantier</small></span></button>
        <button type="button" className="os-check-item" onClick={() => setActiveTab("travaux")}><span className="os-check-icon">{(os.realized_surface_m2 || os.actual_surface_m2 || os.realizedSurfaceM2) ? "✓" : "!"}</span><span><b>Mesures réelles</b><small>Surface / épaisseur / quantités</small></span></button>
        <button type="button" className="os-check-item" onClick={() => setActiveTab("photos")}><span className="os-check-icon">{Array.isArray(os.attachments) && os.attachments.some((a) => ["apres_travaux", "après travaux", "apres", "travaux_realises"].includes(String(a.category || a.type || "").toLowerCase())) ? "✓" : "!"}</span><span><b>Photos après travaux</b><small>Preuve de réalisation</small></span></button>
        <button type="button" className="os-check-item" onClick={() => setActiveTab("constat")}><span className="os-check-icon">{os.constat ? "✓" : "!"}</span><span><b>Constat</b><small>{os.constat ? "Disponible" : "À générer / vérifier"}</small></span></button>
      </div>
    </div>
    '''
if marker in text and 'os-dossier-checklist' not in text:
    text = text.replace(marker, checklist + marker, 1)

main.write_text(text, encoding="utf-8")
