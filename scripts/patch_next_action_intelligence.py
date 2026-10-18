from pathlib import Path

root = Path(__file__).resolve().parents[1]
main = root / "src" / "main.jsx"
text = main.read_text(encoding="utf-8")

start_marker = '<div className="os-next-action">'
end_marker = '<div className="os-v2-photo-callout">'
start = text.find(start_marker)
end = text.find(end_marker, start + len(start_marker)) if start >= 0 else -1
if start < 0 or end < 0:
    raise SystemExit("SETOM next-action block not found; refusing to corrupt main.jsx")

block = '''<div className="os-next-action">
      {(() => {
        const status = String(os.status || "").trim();
        const hasBefore = Array.isArray(os.attachments) && os.attachments.some((a) => ["avant_travaux", "avant travaux", "avant"].includes(String(a.category || a.type || "").toLowerCase()));
        const hasAfter = Array.isArray(os.attachments) && os.attachments.some((a) => ["apres_travaux", "après travaux", "apres", "travaux_realises"].includes(String(a.category || a.type || "").toLowerCase()));
        const hasMeasurements = !!(os.realized_surface_m2 || os.actual_surface_m2 || os.realizedSurfaceM2);
        const hasConstat = !!os.constat;
        const hasReserve = !!(os.reserve || os.has_reserve || String(status).toLowerCase().includes("réserve"));
        let action = { label: "Vérifier le dossier", hint: "Contrôler les informations et choisir l'étape suivante.", tab: "resume" };

        if (!os.address) action = { label: "Compléter les informations de l'OS", hint: "Adresse et informations de base nécessaires au suivi.", tab: "resume" };
        else if (["Nouveau", "À planifier"].includes(status)) action = { label: "Planifier l'intervention", hint: "Affecter une date, une équipe et préparer l'intervention.", tab: "planning" };
        else if (status === "Planifié" && !hasBefore) action = { label: "Ajouter la photo avant travaux", hint: "Documenter l'état initial avant le démarrage du chantier.", tab: "photos" };
        else if (["Planifié", "En travaux", "Travaux en cours"].includes(status) && !hasMeasurements) action = { label: "Renseigner les mesures réelles", hint: "Saisir les surfaces et quantités réellement exécutées.", tab: "travaux" };
        else if (["En travaux", "Travaux en cours"].includes(status) && !hasAfter) action = { label: "Ajouter les photos après travaux", hint: "Conserver la preuve de réalisation avant transmission.", tab: "photos" };
        else if (["En travaux", "Travaux en cours"].includes(status)) action = { label: "Transmettre les travaux", hint: "Les mesures et preuves sont prêtes pour le contrôle.", tab: "travaux" };
        else if (["Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation", "À vérifier", "À valider"].includes(status) && !hasConstat) action = { label: "Contrôler le constat", hint: "Vérifier le constat automatique avant validation.", tab: "constat" };
        else if (["Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation", "À vérifier", "À valider"].includes(status)) action = { label: "Contrôler le constat", hint: "Relire les lignes, quantités et montant avant validation.", tab: "constat" };
        else if (status === "Contrôle") action = { label: "Valider le contrôle", hint: "Confirmer les travaux ou identifier une réserve.", tab: "constat" };
        else if (hasReserve || status === "Réserve" || status === "Validé avec réserve") action = { label: "Traiter la réserve", hint: "Corriger le point réservé puis transmettre les nouvelles preuves.", tab: "travaux" };
        else if (["Validation responsable", "Validation client", "Validé"].includes(status)) action = { label: "Vérifier la validation", hint: "Contrôler le dernier niveau de validation avant la suite financière.", tab: "resume" };
        else if (["Financier", "Payé", "Archivé"].includes(status)) action = { label: "Consulter le suivi financier", hint: "Vérifier le montant, la marge et l'état de règlement.", tab: "financier" };

        return <>
          <div className="os-next-action-copy">
            <span className="os-next-action-kicker">PROCHAINE ACTION</span>
            <strong>{action.label}</strong>
            <span className="os-next-action-hint">{action.hint}</span>
          </div>
          <button type="button" className="primary" onClick={() => setActiveTab(action.tab)}>Ouvrir</button>
        </>;
      })()}
    </div>
    '''

text = text[:start] + block + text[end:]
main.write_text(text, encoding="utf-8")
