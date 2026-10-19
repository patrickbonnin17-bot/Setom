import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Ruler, Save, Trash2 } from "lucide-react";

const BPU_CATALOG = [
  { code: "ENR-NOIR", label: "Enrobé noir", unit: "m²" },
  { code: "ENR-COUL", label: "Plus-value enrobé couleur", unit: "m²" },
  { code: "SCI", label: "Sciage", unit: "ml" },
  { code: "JNT", label: "Joints", unit: "ml" },
  { code: "BAC", label: "Bouche à clé", unit: "U" },
  { code: "DEM", label: "Démolition", unit: "m²" },
  { code: "CIRC", label: "Circulation / signalisation temporaire", unit: "forfait" },
  { code: "MARQ", label: "Marquage / peinture", unit: "forfait" },
];

const MATERIAL_DENSITIES = [
  { match: /enrob/i, density: 2.35 },
  { match: /béton/i, density: 2.40 },
  { match: /grave-?émulsion/i, density: 2.20 },
];

const blankMeasurements = {
  length: "",
  width: "",
  thickness: "6",
  sawingLength: "",
  jointLength: "",
  valveCount: "",
  circulation: "",
  marking: "",
};

function number(value) {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function densityForMaterial(material) {
  const found = MATERIAL_DENSITIES.find(item => item.match.test(String(material || "")));
  return found?.density || 2.35;
}

function Input({ label, unit, value, onChange, step = "0.01", placeholder = "0" }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#657388" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="number" min="0" step={step} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={{ width: "100%", height: 40, border: "1px solid #d9e1ea", borderRadius: 9, padding: "0 11px", fontSize: 12, fontWeight: 700, outline: "none" }} />
        <span style={{ minWidth: 35, color: "#7d899b", fontSize: 11 }}>{unit}</span>
      </div>
    </label>
  );
}

function ServiceLine({ line, onRemove }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 28px", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid #edf0f4" }}>
      <span style={{ fontSize: 9, color: "#176fe5", fontWeight: 900 }}>{line.code}</span>
      <div><b style={{ fontSize: 11 }}>{line.label}</b><small style={{ display: "block", marginTop: 3, color: "#8995a7", fontSize: 9 }}>{line.unit}</small></div>
      <b style={{ fontSize: 11, textAlign: "right" }}>{line.quantity} {line.unit}</b>
      <button className="icon-btn" style={{ width: 28, height: 28, border: 0 }} onClick={onRemove} aria-label="Supprimer"><Trash2 size={14}/></button>
    </div>
  );
}

export default function WorkMeasurements({ os, updateOs, onSaved }) {
  const saved = os.measurements || {};
  const [m, setM] = useState({ ...blankMeasurements, ...saved });
  const [services, setServices] = useState(os.bpuLines || []);
  const [bpuOpen, setBpuOpen] = useState(false);
  const [selectedBpu, setSelectedBpu] = useState(BPU_CATALOG[0].code);
  const [bpuQty, setBpuQty] = useState("");
  const [savedAt, setSavedAt] = useState("");

  const surface = useMemo(() => number(m.length) * number(m.width), [m.length, m.width]);
  const volume = useMemo(() => surface * number(m.thickness) / 100, [surface, m.thickness]);
  const density = useMemo(() => densityForMaterial(os.material), [os.material]);
  const calculatedTonnage = useMemo(() => volume * density, [volume, density]);
  const selectedService = BPU_CATALOG.find(x => x.code === selectedBpu) || BPU_CATALOG[0];

  const set = (key, value) => setM(current => ({ ...current, [key]: value }));

  const addService = () => {
    const quantity = number(bpuQty);
    if (!quantity) return;
    setServices(current => [...current, {
      id: `${selectedService.code}-${Date.now()}`,
      code: selectedService.code,
      label: selectedService.label,
      unit: selectedService.unit,
      quantity,
    }]);
    setBpuQty("");
    setBpuOpen(false);
  };

  const save = () => {
    updateOs({
      actualSurface: Number(surface.toFixed(2)) || null,
      actualTonnage: Number(calculatedTonnage.toFixed(2)) || null,
      measurements: {
        ...m,
        length: number(m.length),
        width: number(m.width),
        thickness: number(m.thickness),
        sawingLength: number(m.sawingLength),
        jointLength: number(m.jointLength),
        valveCount: number(m.valveCount),
        circulation: number(m.circulation),
        marking: number(m.marking),
        surface: Number(surface.toFixed(2)),
        volume: Number(volume.toFixed(3)),
        density,
        calculatedTonnage: Number(calculatedTonnage.toFixed(2)),
      },
      bpuLines: services,
    });
    setSavedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    onSaved?.();
  };

  return (
    <div style={{ marginTop: 17, display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(330px,.75fr)", gap: 16 }}>
        <section className="card">
          <div className="section-title"><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Ruler size={17} color="#176fe5"/> Mesures de l'intervention</div><span>Mesure réelle après intervention</span></div>
          <div style={{ marginTop: 17, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <Input label="Longueur" unit="m" value={m.length} onChange={v => set("length", v)} />
            <Input label="Largeur" unit="m" value={m.width} onChange={v => set("width", v)} />
            <Input label="Épaisseur" unit="cm" step="0.1" value={m.thickness} onChange={v => set("thickness", v)} />
          </div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, background: "#f5f8fc", border: "1px solid #e5eaf1" }}><small style={{ color: "#8290a4", fontSize: 9 }}>Surface calculée</small><strong style={{ display: "block", marginTop: 4, fontSize: 21 }}>{surface.toFixed(2)} <small style={{ fontSize: 10, color: "#8290a4" }}>m²</small></strong></div>
            <div style={{ padding: 14, borderRadius: 10, background: "#f5f8fc", border: "1px solid #e5eaf1" }}><small style={{ color: "#8290a4", fontSize: 9 }}>Volume théorique</small><strong style={{ display: "block", marginTop: 4, fontSize: 21 }}>{volume.toFixed(3)} <small style={{ fontSize: 10, color: "#8290a4" }}>m³</small></strong></div>
            <div style={{ padding: 14, borderRadius: 10, background: "#eef5ff", border: "1px solid #d7e7ff" }}><small style={{ color: "#5c7aa4", fontSize: 9 }}>Surface prévue OS</small><strong style={{ display: "block", marginTop: 4, fontSize: 21, color: "#176fe5" }}>{os.plannedSurface || 0} <small style={{ fontSize: 10 }}>m²</small></strong></div>
            <div style={{ padding: 14, borderRadius: 10, background: "#edf9f1", border: "1px solid #d2efdc" }}><small style={{ color: "#4c7d5d", fontSize: 9 }}>Tonnage réel calculé</small><strong style={{ display: "block", marginTop: 4, fontSize: 21, color: "#159957" }}>{calculatedTonnage.toFixed(2)} <small style={{ fontSize: 10 }}>t</small></strong><small style={{ display: "block", marginTop: 3, color: "#7b8b80", fontSize: 8 }}>Densité {density.toFixed(2)} t/m³</small></div>
          </div>
          <div style={{ marginTop: 17, display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn primary" onClick={save}><Save size={15}/> Enregistrer les mesures</button>
            {savedAt && <span style={{ color: "#159957", fontSize: 10, fontWeight: 800 }}><Check size={13} style={{ verticalAlign: "-2px" }}/> Enregistré à {savedAt}</span>}
          </div>
        </section>

        <section className="card">
          <div className="section-title"><div>Travaux complémentaires</div><span>Quantités réellement exécutées</span></div>
          <div style={{ marginTop: 17, display: "grid", gap: 13 }}>
            <Input label="Longueur sciage" unit="ml" value={m.sawingLength} onChange={v => set("sawingLength", v)} />
            <Input label="Longueur joints" unit="ml" value={m.jointLength} onChange={v => set("jointLength", v)} />
            <Input label="Bouche à clé" unit="U" step="1" value={m.valveCount} onChange={v => set("valveCount", v)} />
            <Input label="Circulation" unit="forfait" step="1" value={m.circulation} onChange={v => set("circulation", v)} />
            <Input label="Marquage / peinture" unit="forfait" step="1" value={m.marking} onChange={v => set("marking", v)} />
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-title"><div><b>Prestations BPU réalisées</b><span>Les lignes sont rattachées aux quantités réellement constatées.</span></div><button className="btn small primary" onClick={() => setBpuOpen(v => !v)}><Plus size={14}/> Ajouter une prestation du BPU</button></div>
        {bpuOpen && <div style={{ marginTop: 16, padding: 15, borderRadius: 11, background: "#f7faff", border: "1px solid #dce9fb", display: "grid", gridTemplateColumns: "minmax(260px,1fr) 150px auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 7 }}><span style={{ fontSize: 9, fontWeight: 800, color: "#68768a" }}>Prestation du BPU</span><div style={{ position: "relative" }}><select value={selectedBpu} onChange={e => setSelectedBpu(e.target.value)} style={{ width: "100%", height: 40, appearance: "none", border: "1px solid #d7e0ea", borderRadius: 9, padding: "0 35px 0 11px", background: "#fff", fontSize: 11, fontWeight: 700 }}>{BPU_CATALOG.map(item => <option key={item.code} value={item.code}>{item.code} — {item.label} ({item.unit})</option>)}</select><ChevronDown size={15} style={{ position: "absolute", right: 10, top: 12, pointerEvents: "none", color: "#8290a4" }}/></div></label>
          <Input label={`Quantité (${selectedService.unit})`} unit={selectedService.unit} value={bpuQty} onChange={setBpuQty} step={selectedService.unit === "U" || selectedService.unit === "forfait" ? "1" : "0.01"}/>
          <button className="btn primary" onClick={addService}>Ajouter</button>
        </div>}
        <div style={{ marginTop: 13 }}>{services.length === 0 ? <div style={{ padding: "24px 10px", textAlign: "center", color: "#8a96a7", fontSize: 11 }}>Aucune prestation BPU ajoutée. Ajoutez uniquement ce qui a réellement été exécuté.</div> : services.map(line => <ServiceLine key={line.id} line={line} onRemove={() => setServices(current => current.filter(x => x.id !== line.id))}/>)}</div>
        {services.length > 0 && <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}><button className="btn primary" onClick={save}><Save size={14}/> Enregistrer les mesures et le BPU</button></div>}
      </section>

      <section style={{ padding: "12px 15px", border: "1px solid #e1e8f1", borderRadius: 10, background: "#fbfcfe", color: "#78869a", fontSize: 10, lineHeight: 1.55 }}><b style={{ color: "#445269" }}>Règle SETOM :</b> le tonnage est calculé automatiquement à partir des mesures réellement saisies : longueur × largeur × épaisseur × densité du matériau. Pour l'enrobé, la densité de référence est actuellement de 2,35 t/m³ ; elle sera ensuite pilotable depuis le référentiel Matériaux.</section>
    </div>
  );
}
