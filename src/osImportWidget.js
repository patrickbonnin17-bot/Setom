import * as XLSX from "xlsx";
import { supabase } from "./supabase";

const STYLE_ID = "setom-os-import-style";
const MODAL_ID = "setom-os-import-modal";
const BTN_ID = "setom-os-import-button";

const norm = (v) => String(v ?? "").trim();
const key = (v) => norm(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const num = (v) => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const bool = (v) => /^(1|true|oui|yes|x|nuit)$/i.test(norm(v));

const aliases = {
  osnumber: ["osnumber", "numeroos", "numos", "os", "ordrede service"],
  address: ["address", "adresse", "adressechantier", "lieu"],
  postalcode: ["postalcode", "codepostal", "cp"],
  city: ["city", "commune", "ville"],
  sector: ["sector", "secteur"],
  material: ["material", "materiau", "materiaux", "famillemateriau"],
  materialdetail: ["materialdetail", "travaux", "typetravaux", "designation", "libelle"],
  surface: ["surface", "surfacem2", "quantite", "surfaceprevue"],
  roadsurface: ["roadsurface", "surfacechaussee", "chaussee", "m2chaussee"],
  sidewalksurface: ["sidewalksurface", "surfacetrottoir", "trottoir", "m2trottoir"],
  rehabilitationzone: ["rehabilitationzone", "zone", "zonerehabilitation", "typezone"],
  particularities: ["particularities", "particularites", "remarques", "observations", "commentaires"],
  requesterreference: ["requesterreference", "referencedemandeur", "reference", "refdemandeur"],
  creationdate: ["creationdate", "datedeclaration", "datecreation", "date"],
  night: ["isnight", "nuit", "travauxdenuit"]
};

function addStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    #${BTN_ID}{margin-left:8px!important;border:0!important;border-radius:10px!important;padding:9px 13px!important;background:#eef4ff!important;color:#155eef!important;font-weight:700!important;cursor:pointer!important}
    #${MODAL_ID}{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;padding:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .setom-import-panel{width:min(1100px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.25);padding:22px}
    .setom-import-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.setom-import-head h2{margin:0;font-size:21px}.setom-import-head p{margin:5px 0 0;color:#667085;font-size:13px}
    .setom-import-close{border:0;background:#f2f4f7;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:18px}
    .setom-import-drop{margin:18px 0;padding:20px;border:2px dashed #cbd5e1;border-radius:14px;text-align:center;background:#f8fafc}.setom-import-drop input{margin-top:10px}
    .setom-import-summary{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.setom-import-chip{padding:7px 10px;border-radius:999px;background:#f2f4f7;font-size:12px;font-weight:700}.setom-import-chip.bad{background:#fff1f2;color:#be123c}.setom-import-chip.ok{background:#ecfdf3;color:#027a48}
    .setom-import-table{width:100%;border-collapse:collapse;font-size:12px}.setom-import-table th,.setom-import-table td{padding:8px;border-bottom:1px solid #eaecf0;text-align:left;vertical-align:top}.setom-import-table th{position:sticky;top:0;background:#fff;z-index:1}.setom-import-row-bad{background:#fff7f7}.setom-import-warn{color:#b42318;font-weight:700}
    .setom-import-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.setom-import-actions button{border:0;border-radius:10px;padding:10px 15px;font-weight:700;cursor:pointer}.setom-import-cancel{background:#f2f4f7}.setom-import-create{background:#155eef;color:#fff}.setom-import-create:disabled{opacity:.45;cursor:not-allowed}
  `;
  document.head.appendChild(s);
}

function findHeader(headers, wanted) {
  const set = new Set(aliases[wanted] || [wanted]);
  return headers.find((h) => set.has(key(h))) || null;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const s = norm(value);
  if (!s) return new Date().toISOString().slice(0,10);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0,10) : d.toISOString().slice(0,10);
}

function deadline(date, days = 25) {
  const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + Number(days || 25)); return d.toISOString().slice(0,10);
}

function inferZone(row) {
  if (row.rehabilitationZone) return row.rehabilitationZone;
  if (row.roadSurface && row.sidewalkSurface) return "Chaussée + trottoir";
  if (row.roadSurface) return "Chaussée";
  if (row.sidewalkSurface) return "Trottoir";
  return "Autre";
}

async function loadReferenceData() {
  const [sectors, materials, settings] = await Promise.all([
    supabase.from("sectors").select("id,name,active").order("sort_order", { ascending: true }),
    supabase.from("materials").select("id,name,active").order("sort_order", { ascending: true }),
    supabase.from("app_settings").select("standard_delay_days,os_label").limit(1).maybeSingle()
  ]);
  return { sectors: sectors.data || [], materials: materials.data || [], settings: settings.data || {} };
}

function buildRows(rawRows) {
  return rawRows.filter((r) => Object.values(r).some((v) => norm(v))).map((r, index) => ({
    sourceRow: index + 2,
    sourceOS: norm(r.osNumber),
    address: norm(r.address), postalCode: norm(r.postalCode), city: norm(r.city), sector: norm(r.sector),
    material: norm(r.material), materialDetail: norm(r.materialDetail), surface: num(r.surface), roadSurface: num(r.roadSurface), sidewalkSurface: num(r.sidewalkSurface),
    rehabilitationZone: norm(r.rehabilitationZone), particularities: norm(r.particularities), requesterReference: norm(r.requesterReference),
    creationDate: parseDate(r.creationDate), isNight: bool(r.night),
    errors: []
  })).map((row) => { if (!row.address) row.errors.push("Adresse manquante"); if (!row.material && !row.materialDetail) row.errors.push("Matériau / type de travaux manquant"); row.rehabilitationZone = inferZone(row); if (!row.surface) row.surface = (row.roadSurface || 0) + (row.sidewalkSurface || 0) || null; return row; });
}

async function openModal() {
  if (document.getElementById(MODAL_ID)) return;
  addStyles();
  const modal = document.createElement("div"); modal.id = MODAL_ID;
  modal.innerHTML = `<div class="setom-import-panel"><div class="setom-import-head"><div><h2>📥 Importer des OS</h2><p>Import individuel ou en masse depuis Excel / CSV, avec contrôle avant création.</p></div><button class="setom-import-close">×</button></div><div class="setom-import-drop"><strong>Choisir un fichier Excel (.xlsx/.xls) ou CSV</strong><br><input type="file" accept=".xlsx,.xls,.csv,text/csv" /></div><div class="setom-import-summary" id="setom-import-summary"></div><div id="setom-import-preview"><div style="color:#667085;font-size:13px">Aucun fichier sélectionné.</div></div><div class="setom-import-actions"><button class="setom-import-cancel">Fermer</button><button class="setom-import-create" disabled>Créer les OS valides</button></div></div>`;
  document.body.appendChild(modal);
  const input = modal.querySelector("input[type=file]"); const preview = modal.querySelector("#setom-import-preview"); const summary = modal.querySelector("#setom-import-summary"); const create = modal.querySelector(".setom-import-create");
  let rows = [];
  modal.querySelectorAll(".setom-import-close,.setom-import-cancel").forEach((b) => b.addEventListener("click", () => modal.remove()));
  input.addEventListener("change", async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const headers = raw.length ? Object.keys(raw[0]) : [];
      const mapped = raw.map((r) => Object.fromEntries(Object.entries(aliases).map(([field]) => [field, findHeader(headers, field) ? r[findHeader(headers, field)] : "" ])));
      rows = buildRows(mapped);
      const refs = await loadReferenceData();
      const sectorNames = new Set(refs.sectors.filter((s) => s.active !== false).map((s) => key(s.name)));
      const materialNames = new Set(refs.materials.filter((m) => m.active !== false).map((m) => key(m.name)));
      for (const row of rows) {
        if (row.sector && !sectorNames.has(key(row.sector))) row.errors.push(`Secteur inconnu : ${row.sector}`);
        if (row.material && !materialNames.has(key(row.material))) row.errors.push(`Matériau inconnu : ${row.material}`);
      }
      const valid = rows.filter((r) => !r.errors.length).length;
      summary.innerHTML = `<span class="setom-import-chip">${rows.length} lignes</span><span class="setom-import-chip ok">${valid} prêtes</span><span class="setom-import-chip ${rows.length-valid ? "bad" : "ok"}">${rows.length-valid} à corriger</span>`;
      preview.innerHTML = `<div style="overflow:auto;max-height:390px"><table class="setom-import-table"><thead><tr><th>Ligne</th><th>N° source</th><th>Adresse</th><th>Travaux</th><th>Surface</th><th>Secteur</th><th>Statut</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.errors.length ? "setom-import-row-bad" : ""}"><td>${r.sourceRow}</td><td>${r.sourceOS || "—"}</td><td>${r.address || "—"}${r.city ? `<br>${r.postalCode} ${r.city}` : ""}</td><td>${r.materialDetail || r.material || "—"}</td><td>${r.surface ?? "—"} m²</td><td>${r.sector || "—"}</td><td>${r.errors.length ? `<span class="setom-import-warn">${r.errors.join(" · ")}</span>` : "✓ Prête"}</td></tr>`).join("")}</tbody></table></div>`;
      create.disabled = !valid;
      create.textContent = `Créer ${valid} OS valide${valid > 1 ? "s" : ""}`;
      create.onclick = async () => {
        create.disabled = true; create.textContent = "Création…";
        const { data: existing } = await supabase.from("work_orders").select("address,city,planned_surface_m2,material_detail,creation_date");
        const existingKeys = new Set((existing || []).map((x) => [key(x.address), key(x.city), Number(x.planned_surface_m2 || 0), key(x.material_detail), x.creation_date].join("|")));
        let created = 0, skipped = 0;
        for (const r of rows.filter((x) => !x.errors.length)) {
          const duplicateKey = [key(r.address), key(r.city), Number(r.surface || 0), key(r.materialDetail || r.material), r.creationDate].join("|");
          if (existingKeys.has(duplicateKey)) { skipped++; continue; }
          const sector = refs.sectors.find((s) => key(s.name) === key(r.sector));
          const material = refs.materials.find((m) => key(m.name) === key(r.material));
          const payload = {
            status: "Nouveau OS", creation_date: r.creationDate, deadline_date: deadline(r.creationDate, refs.settings.standard_delay_days || 25),
            address: r.address, postal_code: r.postalCode || null, city: r.city || null, sector_id: sector?.id || null,
            requester_reference: [r.sourceOS ? `OS source ${r.sourceOS}` : "", r.requesterReference].filter(Boolean).join(" — ") || null,
            material_id: material?.id || null, material_detail: r.materialDetail || r.material || null,
            planned_surface_m2: r.surface, planned_road_surface_m2: r.roadSurface, planned_sidewalk_surface_m2: r.sidewalkSurface,
            rehabilitation_zone: r.rehabilitationZone, particularities: r.particularities || null, is_night: r.isNight
          };
          const { error } = await supabase.from("work_orders").insert(payload);
          if (!error) { created++; existingKeys.add(duplicateKey); } else console.error("Import OS:", error);
        }
        modal.remove();
        window.dispatchEvent(new CustomEvent("setom:os-imported", { detail: { created, skipped } }));
        window.dispatchEvent(new CustomEvent("setom:planning-updated"));
        alert(`Import terminé : ${created} OS créé${created > 1 ? "s" : ""}${skipped ? `, ${skipped} doublon${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}.` : "."}`);
      };
    } catch (error) { console.error(error); preview.innerHTML = `<div class="setom-import-warn">Impossible de lire ce fichier : ${error?.message || error}</div>`; }
  });
}

function installButton() {
  if (document.getElementById(BTN_ID)) return;
  const candidates = [...document.querySelectorAll("button")];
  const newOS = candidates.find((b) => /nouvel os/i.test(b.textContent || ""));
  if (!newOS) return;
  const btn = document.createElement("button"); btn.id = BTN_ID; btn.type = "button"; btn.textContent = "📥 Importer OS"; btn.addEventListener("click", openModal);
  newOS.parentElement?.insertBefore(btn, newOS);
}

addStyles();
installButton();
new MutationObserver(installButton).observe(document.body, { childList: true, subtree: true });
