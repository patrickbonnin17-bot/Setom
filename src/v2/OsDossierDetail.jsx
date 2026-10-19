import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ClipboardList, Copy, MapPin, MoreHorizontal, Pencil, Play, Plus, Save, Trash2, Truck, Users, X } from "lucide-react";
import { DOSSIER_TYPES, STATUS } from "./model";
import "./os-detail.css";
import "./os-workflow.css";

const BPU = [
  { code: "ENR-NOIR", label: "Enrobé noir", unit: "m²" },
  { code: "ENR-COUL", label: "Plus-value enrobé couleur", unit: "m²" },
  { code: "SCI", label: "Sciage", unit: "ml" },
  { code: "JNT", label: "Joints", unit: "ml" },
  { code: "BAC", label: "Bouche à clé", unit: "U" },
  { code: "DEM", label: "Démolition", unit: "m²" },
  { code: "CIRC", label: "Circulation / signalisation temporaire", unit: "forfait" },
  { code: "MARQ", label: "Marquage / peinture", unit: "forfait" },
];
const QUICK = ["SCI", "JNT", "BAC", "CIRC", "MARQ"];
const n = value => { const x = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const fmt = (value, digits = 2) => n(value).toFixed(digits).replace(".", ",");
const densityFor = material => /béton/i.test(material || "") ? 2.4 : /grave/i.test(material || "") ? 2.2 : 2.35;
const blankZone = kind => ({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, kind, length: "", width: "", thickness: "5" });
const newBpuLine = item => ({ id: `${item.code}-${Date.now()}-${Math.random().toString(16).slice(2)}`, code: item.code, label: item.label, unit: item.unit, quantity: "" });

function Badge({ status }) {
  const tone = status === STATUS.PLANNED ? "planned" : status === STATUS.IN_PROGRESS ? "progress" : status === STATUS.CREATED ? "created" : status === STATUS.CLIENT_VALIDATED || status === STATUS.DONE ? "green" : "";
  return <span className={`wf-badge ${tone}`}>{status}</span>;
}
function Field({ label, value, onChange, unit, step = "0.01" }) {
  return <label><span className="wf-field-label">{label}</span><div className="wf-input-wrap"><input className="wf-input" type="number" min="0" step={step} value={value} onChange={e => onChange(e.target.value)} />{unit && <em className="wf-unit">{unit}</em>}</div></label>;
}
function DetailMap() { return <div className="wf-map"><MapPin className="wf-pin" size={25} fill="currentColor" /></div>; }
function InfoRow({ label, value }) { return <div className="wf-info-row"><span>{label}</span><strong>{value || "—"}</strong></div>; }

function PhotoBox({ title, required, photo, onAdd }) {
  const inputRef = useRef(null);
  const handleFile = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onAdd(reader.result);
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  return <article className="wf-photo-card">
    <div className="wf-photo-title"><b>{title}</b>{required && <span className="wf-required">OBLIGATOIRE</span>}</div>
    <div className="wf-photo-frame">
      {photo ? <img src={photo} alt={title} /> : <div className="wf-photo-placeholder"><Camera size={28}/><span>Aucune photo</span></div>}
      {photo && <div className="wf-photo-actions"><button type="button" onClick={() => inputRef.current?.click()}><Camera size={14}/> Remplacer</button></div>}
    </div>
    {!photo && <div style={{padding:10}}><button type="button" className="wf-photo-add" onClick={() => inputRef.current?.click()}><Camera size={14}/> Ajouter une photo</button></div>}
    <input ref={inputRef} className="wf-photo-input" type="file" accept="image/*" capture="environment" onChange={handleFile}/>
  </article>;
}

export default function OsDossierDetail({ os, onBack, updateOs }) {
  const [step, setStep] = useState(os.status === STATUS.IN_PROGRESS ? 1 : 0);
  const [detailTab, setDetailTab] = useState("informations");
  const [zones, setZones] = useState(os.measurements?.zones?.length ? os.measurements.zones : [blankZone("Chaussée")]);
  const [services, setServices] = useState(os.bpuLines || []);
  const [selectedBpu, setSelectedBpu] = useState(BPU[0].code);
  const [material, setMaterial] = useState(os.material || "Enrobé noir");
  const [tonnage, setTonnage] = useState(os.materialData?.tonnage ? String(os.materialData.tonnage) : "");
  const [comments, setComments] = useState(os.comments || "");
  const [photos, setPhotos] = useState(os.photos || {});
  const [error, setError] = useState("");

  const totals = useMemo(() => zones.reduce((total, zone) => {
    const surface = n(zone.length) * n(zone.width);
    const volume = surface * n(zone.thickness) / 100;
    return { surface: total.surface + surface, volume: total.volume + volume };
  }, { surface: 0, volume: 0 }), [zones]);
  const density = densityFor(material);
  const estimatedTonnage = totals.volume * density;
  const internal = os.type === DOSSIER_TYPES.INTERNAL;
  const selectedItem = BPU.find(item => item.code === selectedBpu) || BPU[0];
  const patch = data => updateOs(data);

  const startWork = () => {
    patch({ status: STATUS.IN_PROGRESS });
    setStep(1);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const updateZone = (id, key, value) => setZones(current => current.map(zone => zone.id === id ? { ...zone, [key]: value } : zone));
  const addZone = kind => setZones(current => [...current, blankZone(kind)]);
  const removeZone = id => setZones(current => current.length > 1 ? current.filter(zone => zone.id !== id) : current);

  const addService = item => {
    if (services.some(line => line.code === item.code)) {
      setError(`${item.label} est déjà présent dans les travaux complémentaires.`);
      return;
    }
    setServices(current => [...current, newBpuLine(item)]);
    setSelectedBpu(item.code);
    setError("");
  };
  const updateService = (id, quantity) => setServices(current => current.map(line => line.id === id ? { ...line, quantity } : line));
  const removeService = id => setServices(current => current.filter(line => line.id !== id));

  const saveMeasures = () => {
    const invalidZone = zones.some(zone => n(zone.length) <= 0 || n(zone.width) <= 0 || n(zone.thickness) <= 0);
    const invalidService = services.some(line => n(line.quantity) <= 0);
    if (invalidZone) {
      setError("Renseignez une longueur, une largeur et une épaisseur valides pour chaque zone.");
      return;
    }
    if (invalidService) {
      setError("Une prestation BPU ajoutée doit avoir une quantité supérieure à 0.");
      return;
    }
    patch({
      actualSurface: Number(totals.surface.toFixed(2)),
      measurements: { zones, surface: Number(totals.surface.toFixed(2)), volume: Number(totals.volume.toFixed(3)) },
      bpuLines: services.map(line => ({ ...line, quantity: n(line.quantity) }))
    });
    setError("");
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveMaterials = () => {
    patch({ material, materialData: { density, tonnage: n(tonnage) || Number(estimatedTonnage.toFixed(2)) }, comments });
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setPhoto = (key, value) => setPhotos(current => ({ ...current, [key]: value }));
  const submit = () => {
    if (!photos.Avant || !photos.Après) {
      setError("Les photos Avant et Après / Travaux réalisés sont obligatoires pour soumettre l'intervention.");
      return;
    }
    patch({ photos, comments, status: STATUS.WAITING_CHIEF });
    setError("");
  };

  if (step === 0) {
    return <div className="setom-workflow-shell">
      <div className="wf-detail">
        <div className="wf-bluebar"><button onClick={onBack}><ArrowLeft size={17}/> OS</button><span>Détail d'un OS</span></div>
        <div className="wf-detail-head"><div><div className="wf-detail-number">OS n°{os.number.replace(/^OS-/, "")}</div><div className="wf-detail-address">{os.address}</div></div><Badge status={os.status}/></div>
        <div className="wf-detail-tabs">{[["informations","Informations"],["travaux","Travaux"],["photos","Photos"],["documents","Documents"],["suivi","Suivi"]].map(([id,label]) => <button key={id} className={detailTab === id ? "active" : ""} onClick={() => setDetailTab(id)}>{label}</button>)}</div>
        {detailTab === "informations" && <>
          <div className="wf-info-grid"><section className="wf-info-card">
            <InfoRow label="Adresse" value={os.address}/><InfoRow label="Type" value={internal ? "Travail interne Eurovia" : "Marché client"}/><InfoRow label="Matériau" value={os.material}/><InfoRow label="Surface estimée" value={`${os.plannedSurface || 0} m²`}/><InfoRow label="Surface réelle" value={os.actualSurface ? `${os.actualSurface} m²` : "—"}/><InfoRow label="Secteur" value={os.sector}/><InfoRow label="Date prévue" value={os.plannedDay || "À planifier"}/><InfoRow label="État" value={os.status}/><InfoRow label="Créé par" value={`${os.creator || "—"} · ${new Date(os.createdAt).toLocaleDateString("fr-FR")}`}/>
          </section><aside className="wf-visuals"><DetailMap/><button className="wf-map-btn"><MapPin size={14}/> Voir sur la carte</button><div className="wf-photo-empty"><Camera size={18}/> Photo chantier</div></aside></div>
        </>}
        {detailTab === "travaux" && <div className="wf-info-grid"><section className="wf-info-card"><InfoRow label="Travaux prévus" value={os.workDescription || "Réfection et remise en état"}/><InfoRow label="Surface prévue" value={`${os.plannedSurface || 0} m²`}/><InfoRow label="BPU" value={os.bpuCode || "BPU lié au marché"}/></section></div>}
        {detailTab === "photos" && <div className="wf-info-grid"><section className="wf-info-card"><InfoRow label="Avant" value={photos.Avant ? "Présente" : "À ajouter"}/><InfoRow label="Pendant" value={photos.Pendant ? "Présente" : "Facultative"}/><InfoRow label="Après" value={photos.Après ? "Présente" : "À ajouter"}/></section></div>}
        {(detailTab === "documents" || detailTab === "suivi") && <div className="wf-info-grid"><section className="wf-info-card"><p style={{margin:4,color:"#6b7c90"}}>Cette vue sera raccordée aux documents et à la traçabilité complète du dossier.</p></section></div>}
        <div className="wf-actions"><button className="wf-btn"><Pencil size={14}/> Modifier</button><button className="wf-btn"><Copy size={14}/> Dupliquer</button><button className="wf-btn"><MoreHorizontal size={15}/></button>{os.status === STATUS.PLANNED && <button className="wf-btn success" onClick={startWork}><Play size={15}/> Passer en travaux</button>}{os.status === STATUS.CREATED && <button className="wf-btn primary" onClick={() => patch({ status: STATUS.PLANNED })}><Save size={14}/> Planifier</button>}</div>
      </div>
    </div>;
  }

  return <div className="wf-field">
    <header className="wf-top"><div className="wf-top-left"><button onClick={() => setStep(step === 1 ? 0 : step - 1)}><ArrowLeft size={21}/></button><span className="wf-brand">SETOM</span><span className="wf-top-title">{["Intervention terrain","Saisie des mesures","Matériaux utilisés","Photos et validation"][step - 1]}</span></div><div className="wf-top-right"><span style={{fontSize:12,fontWeight:800}}>OS {os.number.replace(/^OS-/, "")}</span><button><MoreHorizontal size={21}/></button></div></header>
    <div className="wf-os-strip"><div><b>OS {os.number.replace(/^OS-/, "")}</b><span>{os.address}</span></div><Badge status={os.status}/></div>
    <main className="wf-body">
      {step === 1 && <StepIntervention os={os} onNext={startWorkFromStep} />}
      {step === 2 && <StepMeasures zones={zones} services={services} selectedBpu={selectedBpu} setSelectedBpu={setSelectedBpu} updateZone={updateZone} addZone={addZone} removeZone={removeZone} addService={addService} updateService={updateService} removeService={removeService} totals={totals} error={error} onBack={() => setStep(1)} onNext={saveMeasures} />}
      {step === 3 && <StepMaterials material={material} setMaterial={setMaterial} density={density} estimatedTonnage={estimatedTonnage} tonnage={tonnage} setTonnage={setTonnage} error={error} onBack={() => setStep(2)} onNext={saveMaterials} />}
      {step === 4 && <StepPhotos photos={photos} setPhoto={setPhoto} comments={comments} setComments={setComments} error={error} onBack={() => setStep(3)} onSubmit={submit} />}
    </main>
    <WorkflowStepper step={step}/>
  </div>;

  function startWorkFromStep() {
    patch({ status: STATUS.IN_PROGRESS });
    setStep(2);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function StepIntervention({ os, onNext }) {
  const estimated = n(os.plannedSurface) * n(os.thickness || 5) / 100 * densityFor(os.material);
  return <section className="wf-step">
    <div className="wf-intervention-head"><span className="wf-step-no">1</span><div><h2>OS {os.number.replace(/^OS-/, "")}</h2><p><MapPin size={15}/> {os.address}</p></div><Badge status={os.status}/></div>
    <div className="wf-grid4"><InfoTile icon="19" label="Date prévue" value={os.plannedDay || "À définir"}/><InfoTile icon={<Users size={16}/>} label="Équipe" value={os.team ? `Équipe ${os.team}` : "À affecter"}/><InfoTile icon={<Truck size={16}/>} label="Véhicule" value={os.vehicle || "Camion BV01"}/><InfoTile icon={<ClipboardList size={16}/>} label="Matériau principal" value={os.material}/></div>
    <div className="wf-hero"><span className="wf-hero-label">CHANTIER · {os.sector || "SECTEUR"}</span></div>
    <div className="wf-summary"><div className="wf-summary-title">Travaux prévus</div><span className="wf-summary-desc">{os.workDescription || "Réfection et remise en état de la zone d'intervention"}</span><div className="wf-metrics"><div className="wf-metric"><small>Surface prévue</small><b>{os.plannedSurface || 0} m²</b></div><div className="wf-metric"><small>Épaisseur</small><b>{os.thickness || 5} cm</b></div><div className="wf-metric"><small>Tonnage estimé</small><b>{fmt(estimated)} t</b></div></div></div>
    <div className="wf-subsection"><div className="wf-subtitle"><span>Zones d'intervention</span><div className="wf-zone-tabs"><button className="wf-zone-tab active" type="button">Chaussée</button><button className="wf-zone-tab" type="button">Trottoir</button></div></div><div style={{fontSize:12,color:"#718297"}}>Les zones détaillées seront saisies à l'étape suivante.</div></div>
    <div className="wf-subsection"><div className="wf-subtitle"><span>BPU lié</span><ArrowRight size={16}/></div><div style={{display:"flex",gap:8,alignItems:"center"}}><ClipboardList size={18} color="#1473e5"/><div><b>{os.bpuCode || "BPU lié au marché"}</b><div style={{fontSize:12,color:"#718297"}}>{os.material}</div></div></div></div>
    <div className="wf-nextbar"><span></span><button className="wf-btn success" onClick={onNext}><Play size={16}/> Démarrer l'intervention</button></div>
  </section>;
}
function InfoTile({ icon, label, value }) { return <div className="wf-tile"><small>{label}</small><b>{value}</b></div>; }

function StepMeasures({ zones, services, selectedBpu, setSelectedBpu, updateZone, addZone, removeZone, addService, updateService, removeService, totals, error, onBack, onNext }) {
  const selected = BPU.find(item => item.code === selectedBpu) || BPU[0];
  return <section className="wf-step">
    <div className="wf-subsection" style={{marginTop:0}}><div className="wf-subtitle"><span><b style={{fontSize:16}}>2 · Zones d'intervention</b></span><div className="wf-zone-tabs"><button type="button" className="wf-zone-tab active" onClick={() => addZone("Chaussée")}><Plus size={13}/> Chaussée</button><button type="button" className="wf-zone-tab" onClick={() => addZone("Trottoir")}><Plus size={13}/> Trottoir</button></div></div></div>
    <div className="wf-subsection"><div className="wf-subtitle"><span>Dimensions <small style={{display:"block",fontWeight:600,color:"#718297",marginTop:2}}>Longueur × largeur = surface · épaisseur = volume</small></span><button type="button" className="wf-add-zone" onClick={() => addZone("Chaussée")}><Plus size={14}/> Ajouter une zone</button></div>
      {zones.map((zone, index) => { const surface=n(zone.length)*n(zone.width); const volume=surface*n(zone.thickness)/100; return <div className="wf-zone-card" key={zone.id}><div className="wf-zone-head"><b>Zone {index + 1} — {zone.kind}</b>{zones.length > 1 && <button type="button" onClick={() => removeZone(zone.id)} title="Supprimer"><Trash2 size={15}/></button>}</div><div className="wf-fields"><Field label="Longueur" value={zone.length} onChange={value => updateZone(zone.id,"length",value)} unit="m"/><Field label="Largeur" value={zone.width} onChange={value => updateZone(zone.id,"width",value)} unit="m"/><div className="wf-calculated"><small>Surface calculée</small><b>{fmt(surface)} m²</b></div><Field label="Épaisseur" value={zone.thickness} onChange={value => updateZone(zone.id,"thickness",value)} unit="cm" step="0.1"/><div className="wf-calculated"><small>Volume</small><b>{fmt(volume,3)} m³</b></div></div></div>; })}
      <div className="wf-total"><div><small>Surface totale</small><b>{fmt(totals.surface)} m²</b></div><div><small>Volume total</small><b>{fmt(totals.volume,3)} m³</b></div><div><small>Tonnage estimé</small><b>{fmt(totals.volume * 2.35)} t</b></div></div>
    </div>
    <div className="wf-subsection wf-services"><div className="wf-subtitle"><span>Travaux complémentaires <small style={{display:"block",fontWeight:600,color:"#718297",marginTop:2}}>Prestations BPU réellement exécutées</small></span><span style={{fontSize:11,color:"#718297"}}>{services.length} prestation{services.length > 1 ? "s" : ""}</span></div>
      <div className="wf-service-picker"><select className="wf-select" value={selectedBpu} onChange={e => setSelectedBpu(e.target.value)}>{BPU.map(item => <option key={item.code} value={item.code}>{item.code} — {item.label} ({item.unit})</option>)}</select><button type="button" className="wf-btn primary" onClick={() => addService(selected)}>+ Ajouter</button><div style={{gridColumn:"1/-1",display:"flex",gap:7,flexWrap:"wrap",paddingTop:2}}>{QUICK.map(code => { const item=BPU.find(x=>x.code===code); return <button type="button" key={code} className="wf-add-zone" onClick={() => addService(item)}>{item.label}</button>; })}</div></div>
      {services.length === 0 && <div style={{padding:"18px 4px 4px",textAlign:"center",color:"#8492a2",fontSize:12}}>Aucune prestation complémentaire ajoutée. Ajoutez uniquement ce qui a réellement été exécuté.</div>}
      {services.map(line => <div className="wf-line" key={line.id}><div><span className="wf-line-title">{line.label}</span><span className="wf-line-code">{line.code}</span></div><input className="wf-input" type="number" min="0" step="0.01" value={line.quantity} placeholder="Quantité" onChange={e => updateService(line.id,e.target.value)}/><span className="wf-line-unit">{line.unit}</span><button type="button" className="wf-line-remove" onClick={() => removeService(line.id)} title="Supprimer"><X size={17}/></button></div>)}
    </div>
    {error && <div style={{marginTop:12,padding:"10px 12px",borderRadius:8,background:"#fff1f1",border:"1px solid #f1c3c3",color:"#b7353d",fontWeight:800,fontSize:12}}>{error}</div>}
    <div className="wf-nextbar"><button type="button" className="wf-btn" onClick={onBack}><ArrowLeft size={16}/> Retour</button><button type="button" className="wf-btn primary" onClick={onNext}><Save size={16}/> Enregistrer et continuer <ArrowRight size={16}/></button></div>
  </section>;
}

function StepMaterials({ material, setMaterial, density, estimatedTonnage, tonnage, setTonnage, error, onBack, onNext }) {
  const actual = n(tonnage) || estimatedTonnage;
  const capacity = 8;
  const remaining = Math.max(0, capacity - actual);
  return <section className="wf-step"><div className="wf-subsection" style={{marginTop:0}}><div className="wf-subtitle"><span><b style={{fontSize:16}}>3 · Matériaux utilisés</b><small style={{display:"block",fontWeight:600,color:"#718297",marginTop:2}}>Prévisionnel et consommation réelle</small></span></div></div>
    <div className="wf-material-grid"><div className="wf-card"><h3>Matériau principal</h3><select className="wf-material-select" value={material} onChange={e=>setMaterial(e.target.value)}><option>Enrobé noir</option><option>Enrobé rouge</option><option>Béton balayé</option><option>Grave-émulsion</option></select><div className="wf-material-kpis"><div className="wf-mini-kpi"><small>Densité</small><b>{fmt(density,2)} t/m³</b></div><div className="wf-mini-kpi"><small>Surface</small><b>{fmt(estimatedTonnage / density)} m²</b></div><div className="wf-mini-kpi"><small>Tonnage estimé</small><b>{fmt(estimatedTonnage)} t</b></div></div></div><div className="wf-card"><h3>Quantité réellement utilisée</h3><Field label="Tonnage réel" value={tonnage} onChange={setTonnage} unit="t"/><div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div className="wf-calculated"><small>Volume correspondant</small><b>{fmt(actual / density,3)} m³</b></div><div className="wf-calculated"><small>Reste camion estimé</small><b>{fmt(remaining)} t</b></div></div></div></div>
    <div className="wf-card" style={{marginTop:14}}><h3>Matériaux complémentaires</h3><button type="button" className="wf-add-zone"><Plus size={14}/> Ajouter un matériau</button><p style={{fontSize:12,color:"#7a899a",marginBottom:0}}>Cette liste sera enrichie avec le catalogue matériaux et les consommations réelles.</p></div>
    {error && <div style={{marginTop:12,color:"#b7353d",fontWeight:800,fontSize:12}}>{error}</div>}
    <div className="wf-nextbar"><button type="button" className="wf-btn" onClick={onBack}><ArrowLeft size={16}/> Retour</button><button type="button" className="wf-btn primary" onClick={onNext}>Enregistrer et continuer <ArrowRight size={16}/></button></div>
  </section>;
}

function StepPhotos({ photos, setPhoto, comments, setComments, error, onBack, onSubmit }) {
  const ready = Boolean(photos.Avant && photos.Après);
  return <section className="wf-step"><div className="wf-subsection" style={{marginTop:0}}><div className="wf-subtitle"><span><b style={{fontSize:16}}>4 · Photos et validation</b><small style={{display:"block",fontWeight:600,color:"#718297",marginTop:2}}>Avant et Après / Travaux réalisés sont obligatoires</small></span><span className={`wf-badge ${ready ? "green" : ""}`}>{ready ? "Dossier complet" : "À compléter"}</span></div></div>
    <div className="wf-photo-grid"><PhotoBox title="Avant travaux" required photo={photos.Avant} onAdd={value=>setPhoto("Avant",value)}/><PhotoBox title="Pendant travaux" photo={photos.Pendant} onAdd={value=>setPhoto("Pendant",value)}/><PhotoBox title="Après travaux" required photo={photos.Après} onAdd={value=>setPhoto("Après",value)}/></div>
    <div className="wf-card wf-comments"><h3>Commentaires</h3><textarea className="wf-textarea" value={comments} onChange={e=>setComments(e.target.value)} placeholder="Observations, compactage, conditions particulières…"/></div>
    <div className={`wf-validation ${ready ? "good" : "warn"}`}><div><b>{ready ? "Intervention prête pour validation" : "Photos obligatoires manquantes"}</b><div style={{fontSize:12,color:"#66788b",marginTop:3}}>{ready ? "Le dossier peut être soumis au chef de chantier." : "Ajoutez les photos Avant et Après / Travaux réalisés pour poursuivre."}</div></div><CheckCircle2 size={26} color={ready ? "#16a34a" : "#c58b20"}/></div>
    {error && <div style={{marginTop:12,padding:"10px 12px",borderRadius:8,background:"#fff1f1",border:"1px solid #f1c3c3",color:"#b7353d",fontWeight:800,fontSize:12}}>{error}</div>}
    <div className="wf-nextbar"><button type="button" className="wf-btn" onClick={onBack}><ArrowLeft size={16}/> Retour</button><button type="button" className="wf-btn success" disabled={!ready} onClick={onSubmit}><Check size={16}/> Soumettre pour validation</button></div>
  </section>;
}

function WorkflowStepper({ step }) {
  const labels = ["OS", "Mesures", "Matériaux", "Photos"];
  return <div className="wf-stepper"><div className="wf-stepper-inner">{labels.map((label,index) => { const number=index+1; const active=step===number; const done=step>number; return <React.Fragment key={label}><div className={`wf-step-item ${active ? "active" : ""} ${done ? "done" : ""}`}><span className="wf-step-dot">{done ? <Check size={13}/> : number}</span><span className="wf-step-label">{label}</span></div>{index<labels.length-1 && <div className={`wf-step-line ${done ? "done" : ""}`}/>}</React.Fragment>; })}</div></div>;
}