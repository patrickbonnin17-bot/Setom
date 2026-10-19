import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Copy, FileText, MapPin, MoreHorizontal, Pencil, Play, Save } from "lucide-react";
import { DOSSIER_TYPES, STATUS, canSubmitForChiefValidation } from "./model";
import WorkMeasurements from "./WorkMeasurements";
import "./os-detail.css";

const tabs = [
  ["informations", "Informations"],
  ["travaux", "Travaux"],
  ["photos", "Photos"],
  ["documents", "Documents"],
  ["suivi", "Suivi"],
];

function Badge({ status }) {
  const tone = status === STATUS.PLANNED ? "planned" : status === STATUS.IN_PROGRESS ? "progress" : status === STATUS.CREATED ? "created" : "neutral";
  return <span className={`os-detail-badge ${tone}`}>{status}</span>;
}

function InfoRow({ label, value }) {
  return <div className="os-info-row"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function PhotoTile({ label, required, exists, onAdd }) {
  return (
    <div className="os-photo-tile">
      <div className="os-photo-tile-head"><strong>{label}</strong>{required && <small>Obligatoire</small>}</div>
      {exists ? <div className="os-photo-done"><CheckCircle2 size={18}/><span>Photo enregistrée</span></div> : <button className="os-photo-add" onClick={onAdd}><Camera size={20}/><span>Ajouter une photo</span></button>}
    </div>
  );
}

function MapPreview() {
  return <div className="os-map-preview"><div className="map-road r1"/><div className="map-road r2"/><div className="map-road r3"/><div className="map-road r4"/><div className="map-pin"><MapPin size={21} fill="currentColor"/></div><span className="map-label">Chantier</span></div>;
}

export default function OsDossierDetail({ os, onBack, updateOs }) {
  const [tab, setTab] = useState("informations");
  const internal = os.type === DOSSIER_TYPES.INTERNAL;

  const startWork = () => {
    updateOs({ status: STATUS.IN_PROGRESS });
    setTab("travaux");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveMeasurements = () => setTab("photos");
  const photos = os.photos || {};
  const canSubmit = canSubmitForChiefValidation(os);

  const submitForValidation = () => {
    if (!canSubmit) return;
    updateOs({ status: STATUS.WAITING_CHIEF });
  };

  return (
    <div className="os-detail">
      <div className="os-detail-bluebar">
        <button className="os-back" onClick={onBack}><ArrowLeft size={16}/> OS</button>
        <span>Détail d'un OS</span>
      </div>

      <div className="os-detail-header">
        <div>
          <div className="os-detail-number">OS n°{os.number.replace(/^OS-/, "")}</div>
          <div className="os-detail-address">{os.address}</div>
        </div>
        <Badge status={os.status}/>
      </div>

      <div className="os-detail-tabs">
        {tabs.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === "informations" && (
        <>
          <div className="os-detail-info-grid">
            <section className="os-info-card">
              <InfoRow label="Adresse" value={os.address}/>
              <InfoRow label="Type" value={internal ? "Travail interne Eurovia" : "Reprise enrobé"}/>
              <InfoRow label="Client" value={os.client}/>
              <InfoRow label="Marché" value={os.market}/>
              <InfoRow label="Matériau" value={`${os.material}${os.color ? ` · ${os.color}` : ""}`}/>
              <InfoRow label="Surface estimée" value={`${os.plannedSurface || 0} m²`}/>
              <InfoRow label="Surface réalisée" value={os.actualSurface ? `${os.actualSurface} m²` : "—"}/>
              <InfoRow label="Secteur" value={os.sector}/>
              <InfoRow label="Date prévue" value={os.plannedDay || "À planifier"}/>
              <InfoRow label="État" value={os.status}/>
              <InfoRow label="Créé par" value={`${os.creator || "—"} · ${new Date(os.createdAt).toLocaleDateString("fr-FR")}`}/>
            </section>

            <aside className="os-detail-visuals">
              <MapPreview/>
              <button className="os-map-button"><MapPin size={14}/> Voir sur la carte</button>
              <div className="os-site-photo"><div><Camera size={20}/><span>Photo chantier</span></div></div>
            </aside>
          </div>

          <div className="os-detail-actions">
            <button className="os-action secondary"><Pencil size={14}/> Modifier</button>
            <button className="os-action secondary"><Copy size={14}/> Dupliquer</button>
            <button className="os-action secondary icon"><MoreHorizontal size={16}/></button>
            {os.status === STATUS.PLANNED && <button className="os-action primary" onClick={startWork}><Play size={14}/> Passer en travaux</button>}
            {os.status === STATUS.CREATED && <button className="os-action primary" onClick={() => updateOs({ status: STATUS.PLANNED })}><Save size={14}/> Planifier</button>}
            {os.status === STATUS.IN_PROGRESS && <button className={`os-action ${canSubmit ? "primary" : "disabled"}`} disabled={!canSubmit} onClick={submitForValidation}><ArrowRight size={14}/> Soumettre pour validation</button>}
          </div>
        </>
      )}

      {tab === "travaux" && (
        <div className="os-detail-tab-content">
          <WorkMeasurements os={os} updateOs={updateOs} onSaved={saveMeasurements}/>
          <div className="os-work-next"><span>Après l'enregistrement des mesures, SETOM ouvre automatiquement l'étape Photos.</span><button onClick={saveMeasurements}>Continuer vers Photos <ArrowRight size={14}/></button></div>
        </div>
      )}

      {tab === "photos" && (
        <div className="os-detail-tab-content">
          <div className="os-photos-intro"><div><h3>Photos de l'intervention</h3><p>Avant et Après / Travaux réalisés sont obligatoires pour poursuivre la validation.</p></div><span>{photos.Avant && photos.Après ? "2 / 2 obligatoires" : "À compléter"}</span></div>
          <div className="os-photo-grid"><PhotoTile label="Avant" required exists={photos.Avant} onAdd={() => updateOs({ photos: { ...photos, Avant: true } })}/><PhotoTile label="Pendant" exists={photos.Pendant} onAdd={() => updateOs({ photos: { ...photos, Pendant: true } })}/><PhotoTile label="Après / Travaux réalisés" required exists={photos.Après} onAdd={() => updateOs({ photos: { ...photos, Après: true } })}/></div>
          <div className="os-photo-footer"><span>{photos.Avant && photos.Après ? "Dossier photo complet." : "Ajoutez les deux photos obligatoires pour soumettre le dossier."}</span>{os.status === STATUS.IN_PROGRESS && <button className={`os-action ${photos.Avant && photos.Après ? "primary" : "disabled"}`} disabled={!(photos.Avant && photos.Après)} onClick={submitForValidation}>Soumettre pour validation <ArrowRight size={14}/></button>}</div>
        </div>
      )}

      {tab === "documents" && <div className="os-detail-tab-content"><section className="os-empty-card"><FileText size={28}/><h3>Documents du dossier</h3><p>Plans, bons de livraison et pièces du marché seront rattachés ici.</p><button className="os-action secondary">Ajouter un document</button></section></div>}

      {tab === "suivi" && <div className="os-detail-tab-content"><section className="os-empty-card"><CheckCircle2 size={28}/><h3>Suivi et traçabilité</h3><p>Créé par {os.creator || "—"} · {new Date(os.createdAt).toLocaleString("fr-FR")}</p><p>Statut actuel : <strong>{os.status}</strong></p></section></div>}
    </div>
  );
}
