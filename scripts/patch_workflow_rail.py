from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
text = MAIN.read_text(encoding="utf-8")

css_import = 'import "./workflowRail.css";'
if css_import not in text:
    marker = 'import "./targetUiV2.css";'
    if marker not in text:
        raise SystemExit("SETOM: targetUiV2 import marker not found")
    text = text.replace(marker, marker + "\n" + css_import, 1)

start = '    <div className="os-v2-flow" aria-label="Progression de l\'OS">'
end = '    <div className="os-tabs">{tabs.map((tab)'
if start in text and end in text:
    a = text.index(start)
    b = text.index(end, a)
    rail = '''    <div className="setom-workflow-rail" aria-label="Workflow SETOM complet">
      {[
        ["OS", "Nouveau"], ["Planification", "Planifié"], ["Travaux", "En travaux"],
        ["Travaux réalisés", "Travaux réalisés"], ["Constat automatique", "Constat"], ["Contrôle", "Contrôle"],
        ["Validation responsable", "Validation"], ["Validation client", "En attente"], ["Validé / Réserve", "Validé"],
        ["Financier", "Financier"], ["Payé", "Payé"], ["Archivé", "Archivé"]
      ].map(([label, key], index) => {
        const raw = String(os.status || "Nouveau");
        const normalized = { "Travaux en cours": "En travaux", "Travaux effectués": "Travaux réalisés", "Constat à vérifier": "Contrôle", "Constat de facturation": "Contrôle", "À vérifier": "Contrôle", "À valider": "Contrôle", "Validé avec réserve": "Réserve" }[raw] || raw;
        const currentIndex = ["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux réalisés", "Contrôle", "Validation responsable", "En attente de validation client", "Validé", "Financier", "Payé", "Archivé"].indexOf(normalized);
        const aliases = {
          "Planification": ["À planifier", "Planifié"], "Travaux": ["En travaux"], "Travaux réalisés": ["Travaux réalisés"],
          "Constat automatique": ["Contrôle"], "Contrôle": ["Contrôle"], "Validation responsable": ["Validation responsable"],
          "Validation client": ["En attente de validation client"], "Validé / Réserve": ["Validé", "Réserve"],
          "Financier": ["Financier"], "Payé": ["Payé"], "Archivé": ["Archivé"]
        };
        const active = (aliases[label] || [key]).includes(normalized) || (label === "OS" && normalized === "Nouveau");
        const done = currentIndex > index || normalized === "Payé" && index < 11 || normalized === "Archivé";
        return <div key={label} className={"setom-workflow-step " + (active ? "current " : "") + (done ? "done" : "") + (!active && !done ? "locked" : "")}><strong>{index + 1}. {label}</strong><span>{active ? "Étape en cours" : done ? "Terminé" : "À venir"}</span></div>;
      })}
    </div>
    <div className="setom-workflow-note"><strong>Règle SETOM :</strong><span>le passage financier n'est possible qu'après validation client ; le paiement précède toujours l'archivage.</span></div>
'''
    text = text[:a] + rail + text[b:]

MAIN.write_text(text, encoding="utf-8")
print("SETOM: canonical workflow rail applied")
