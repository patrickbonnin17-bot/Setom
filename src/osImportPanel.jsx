import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabase";

const FIELD_ALIASES = {
  address: ["adresse", "address", "rue", "localisation", "location"],
  postalCode: ["code postal", "codepostal", "cp", "postal code", "postcode"],
  city: ["ville", "commune", "city"],
  sector: ["secteur", "sector", "zone"],
  material: ["materiau", "matériau", "material", "type de matériau", "type materiau", "type matériau"],
  materialDetail: ["detail matériau", "détail matériau", "detail materiau", "détail materiau", "materiau detail", "material detail", "enrobe", "enrobé"],
  rehabilitationZone: ["zone de réfection", "zone de réfection", "zone", "réfection", "rehabilitation zone"],
  roadSurface: ["surface chaussée", "surface chaussee", "chaussée m2", "chaussee m2", "surface route", "surface voirie"],
  sidewalkSurface: ["surface trottoir", "surface trottoir m2", "trottoir m2"],
  surface: ["surface", "surface m2", "surface m²", "quantite", "quantité", "m2", "m²"],
  particularities: ["particularités", "particularites", "observations", "commentaires", "commentaire", "details", "détails"],
  sourceNumber: ["numero", "numéro", "n°", "no", "os", "n° os", "numero os", "numéro os"]
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberValue(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function findColumn(headers, aliases) {
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalize(header) }));
  const normalizedAliases = aliases.map(normalize);
  const exact = normalizedHeaders.find((header) => normalizedAliases.includes(header.normalized));
  if (exact) return exact.raw;
  return normalizedHeaders.find((header) => normalizedAliases.some((alias) => alias && (header.normalized.includes(alias) || alias.includes(header.normalized))))?.raw || "";
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
        resolve(rows);
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(reader.error || new Error("Impossible de lire le fichier."));
    reader.readAsArrayBuffer(file);
  });
}

function resolveMatch(value, items, fields) {
  const target = normalize(value);
  if (!target) return null;
  return items.find((item) => fields.some((field) => normalize(item[field]) === target)) || items.find((item) => fields.some((field) => normalize(item[field]).includes(target) || target.includes(normalize(item[field])))) || null;
}

export default function OSImportPanel({ currentProfile, dbSectors = [], dbMaterials = [], onImported }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [duplicates, setDuplicates] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const canImport = ["admin", "bureau"].includes(currentProfile?.role);

  const analyze = (data) => {
    const nextHeaders = data.length ? Object.keys(data[0]) : [];
    const nextMapping = Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, findColumn(nextHeaders, aliases)]));
    const nextErrors = {};
    data.forEach((row, index) => {
      const address = String(row[nextMapping.address] || "").trim();
      const sector = String(row[nextMapping.sector] || "").trim();
      const material = String(row[nextMapping.material] || row[nextMapping.materialDetail] || "").trim();
      if (!address || !sector || !material) nextErrors[index] = [!address ? "adresse" : "", !sector ? "secteur" : "", !material ? "matériau" : ""].filter(Boolean).join(", ");
    });
    setHeaders(nextHeaders);
    setMapping(nextMapping);
    setRows(data);
    setSelected(new Set(data.map((_, index) => index)));
    setErrors(nextErrors);
    setDuplicates(new Set());
    setResult(null);
    setMessage("");
  };

  async function inspectDuplicates(data, map) {
    const { data: existing, error } = await supabase.from("work_orders").select("address, city, material_detail");
    if (error) throw error;
    const existingKeys = new Set((existing || []).map((item) => [normalize(item.address), normalize(item.city), normalize(item.material_detail)].join("|")));
    const found = new Set();
    data.forEach((row, index) => {
      const key = [normalize(row[map.address]), normalize(row[map.city]), normalize(row[map.materialDetail] || row[map.material])].join("|");
      if (key !== "||" && existingKeys.has(key)) found.add(index);
    });
    setDuplicates(found);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(""); setResult(null);
    try {
      const data = await readFile(file);
      if (!data.length) throw new Error("Le fichier ne contient aucune ligne exploitable.");
      analyze(data);
      const nextHeaders = Object.keys(data[0]);
      const nextMapping = Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, findColumn(nextHeaders, aliases)]));
      await inspectDuplicates(data, nextMapping);
    } catch (error) { setMessage(error?.message || "Impossible de lire le fichier."); }
  }

  const readyIndexes = useMemo(() => [...selected].filter((index) => !errors[index] && !duplicates.has(index)), [selected, errors, duplicates]);

  function toggle(index) {
    setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  }

  async function importRows() {
    if (!readyIndexes.length || busy) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) throw new Error("Connexion requise pour importer les OS.");
      const payload = [];
      const rejected = [];
      for (const index of readyIndexes) {
        const row = rows[index];
        const sectorValue = String(row[mapping.sector] || "").trim();
        const materialValue = String(row[mapping.material] || row[mapping.materialDetail] || "").trim();
        const sector = resolveMatch(sectorValue, dbSectors, ["name"]);
        const material = resolveMatch(materialValue, dbMaterials, ["name", "category"]);
        if (!sector) { rejected.push({ index, reason: `Secteur « ${sectorValue} » introuvable` }); continue; }
        const materialDetail = String(row[mapping.materialDetail] || row[mapping.material] || "").trim();
        const roadSurface = numberValue(row[mapping.roadSurface]);
        const sidewalkSurface = numberValue(row[mapping.sidewalkSurface]);
        const genericSurface = numberValue(row[mapping.surface]);
        const zone = String(row[mapping.rehabilitationZone] || "").trim() || (roadSurface != null ? "Chaussée" : sidewalkSurface != null ? "Trottoir" : "Autre");
        payload.push({
          address: String(row[mapping.address] || "").trim(),
          postal_code: String(row[mapping.postalCode] || "").trim() || null,
          city: String(row[mapping.city] || "").trim() || null,
          sector_id: sector.id,
          material_detail: materialDetail || material?.name || material?.category || null,
          rehabilitation_zone: zone,
          rehabilitation_other_detail: zone === "Autre" ? String(row[mapping.rehabilitationZone] || "").trim() || null : null,
          planned_surface_m2: genericSurface ?? roadSurface ?? sidewalkSurface ?? 0,
          planned_road_surface_m2: roadSurface,
          planned_sidewalk_surface_m2: sidewalkSurface,
          particularities: String(row[mapping.particularities] || "").trim() || null,
          status: "À planifier",
          created_by: authData.user.id,
          updated_by: authData.user.id
        });
      }
      if (!payload.length) throw new Error("Aucune ligne valide à importer.");
      const { data: inserted, error } = await supabase.from("work_orders").insert(payload).select("id");
      if (error) throw error;
      setResult({ imported: inserted?.length || payload.length, skipped: rejected.length + duplicates.size, rejected });
      setMessage(`✅ ${inserted?.length || payload.length} OS importé(s).`);
      setSelected(new Set());
      onImported?.();
    } catch (error) {
      setMessage(error?.message || "Impossible d'importer les OS.");
    } finally { setBusy(false); }
  }

  if (!canImport) return null;

  return <>
    <button className="secondary" type="button" onClick={() => { setOpen(true); setMessage(""); }}>📥 Importer des OS</button>
    {open && <div className="modal-overlay"><div className="modal" style={{ maxWidth: 1100, width: "calc(100vw - 32px)" }}>
      <div className="modal-header"><h2>📥 Importer des OS</h2><button className="secondary" type="button" onClick={() => setOpen(false)}>✕</button></div>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="card"><strong>Excel ou CSV</strong><p style={{ margin: "6px 0 10px", color: "#667085" }}>Les colonnes sont détectées automatiquement. Aucun numéro d’OS n’est imposé : la numérotation SETOM reste gérée par la base.</p><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} /></div>
        {headers.length > 0 && <div className="card"><strong>Correspondance des colonnes</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, marginTop: 10 }}>{Object.entries(mapping).filter(([field]) => field !== "sourceNumber").map(([field, value]) => <label key={field} style={{ fontSize: 12 }}>{field}<select value={value} onChange={(e) => setMapping((current) => ({ ...current, [field]: e.target.value }))} style={{ width: "100%" }}><option value="">— non renseigné —</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div></div>}
        {rows.length > 0 && <div className="card" style={{ overflow: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}><strong>Aperçu — {rows.length} ligne(s)</strong><span style={{ fontSize: 13, color: "#667085" }}>{readyIndexes.length} prête(s) à importer</span></div><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr><th></th><th>Adresse</th><th>Ville</th><th>Secteur</th><th>Matériau</th><th>État</th></tr></thead><tbody>{rows.slice(0, 100).map((row, index) => <tr key={index} style={{ opacity: selected.has(index) ? 1 : .45 }}><td><input type="checkbox" checked={selected.has(index)} onChange={() => toggle(index)} /></td><td>{row[mapping.address]}</td><td>{row[mapping.city]}</td><td>{row[mapping.sector]}</td><td>{row[mapping.materialDetail] || row[mapping.material]}</td><td>{errors[index] ? `⚠️ ${errors[index]}` : duplicates.has(index) ? "⚠️ Doublon" : "✓ OK"}</td></tr>)}</tbody></table>{rows.length > 100 && <p style={{ color: "#667085" }}>Aperçu limité aux 100 premières lignes ; l’import peut porter sur toutes les lignes sélectionnées.</p>}</div>}
        {message && <div className="card" style={{ borderLeft: "4px solid #1976d2" }}>{message}</div>}
        {result?.rejected?.length > 0 && <div className="card"><strong>Erreurs non importées</strong><ul>{result.rejected.map((item) => <li key={item.index}>Ligne {item.index + 2} : {item.reason}</li>)}</ul></div>}
        <div className="modal-actions"><button className="secondary" type="button" onClick={() => setOpen(false)}>Fermer</button><button className="primary" type="button" disabled={!readyIndexes.length || busy} onClick={importRows}>{busy ? "Import en cours…" : `Importer ${readyIndexes.length} OS`}</button></div>
      </div>
    </div></div>}
  </>;
}
