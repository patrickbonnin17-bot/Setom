import * as XLSX from "xlsx";
import { supabase } from "./supabase";

const ALIASES = {
  address: ["adresse", "address", "rue", "localisation", "location"],
  postalCode: ["code postal", "codepostal", "cp", "postcode"],
  city: ["ville", "commune", "city"],
  sector: ["secteur", "sector", "zone"],
  material: ["materiau", "matériau", "material", "type materiau", "type matériau"],
  materialDetail: ["detail materiau", "détail matériau", "materiau detail", "material detail", "enrobe", "enrobé"],
  zone: ["zone de réfection", "zone de refection", "rehabilitation zone", "réfection"],
  road: ["surface chaussée", "surface chaussee", "chaussée m2", "chaussee m2", "surface voirie"],
  sidewalk: ["surface trottoir", "surface trottoir m2", "trottoir m2"],
  surface: ["surface", "surface m2", "surface m²", "quantité", "quantite", "m2", "m²"],
  notes: ["particularités", "particularites", "observations", "commentaires", "commentaire", "détails", "details"]
};

const norm = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (v) => { if (v == null || String(v).trim() === "") return null; const n = Number(String(v).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };
function findColumn(headers, aliases) { const hs = headers.map((h) => [h, norm(h)]); const as = aliases.map(norm); return hs.find(([,n]) => as.includes(n))?.[0] || hs.find(([,n]) => as.some((a) => a && (n.includes(a) || a.includes(n))))?.[0] || ""; }
function match(value, items) { const n = norm(value); if (!n) return null; return items.find((x) => norm(x.name) === n) || items.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) || null; }
function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { try { const wb = XLSX.read(reader.result, { type: "array", cellDates: true }); const sheet = wb.Sheets[wb.SheetNames[0]]; resolve(XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })); } catch (e) { reject(e); } }; reader.onerror = () => reject(reader.error || new Error("Impossible de lire le fichier.")); reader.readAsArrayBuffer(file); }); }

async function init() {
  if (!document.body || document.querySelector("[data-setom-os-import]")) return true;
  const toolbar = [...document.querySelectorAll(".toolbar")].find((node) => node.querySelector("input[placeholder*='Rechercher OS']"));
  if (!toolbar) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["admin", "bureau"].includes(profile?.role)) return true;
  const button = document.createElement("button");
  button.type = "button"; button.className = "secondary"; button.textContent = "📥 Importer des OS"; button.dataset.setomOsImport = "1";
  toolbar.insertBefore(button, toolbar.firstChild);
  button.addEventListener("click", () => openModal(user.id));
  return true;
}

async function openModal(userId) {
  const overlay = document.createElement("div"); overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal" style="max-width:1100px;width:calc(100vw - 32px)"><div class="modal-header"><h2>📥 Importer des OS</h2><button type="button" class="secondary" data-close>✕</button></div><div data-body><div class="card"><strong>Excel ou CSV</strong><p style="margin:6px 0 10px;color:#667085">Les colonnes sont détectées automatiquement. Les numéros d’OS restent gérés par SETOM.</p><input type="file" accept=".xlsx,.xls,.csv" data-file /></div></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-close]").onclick = () => overlay.remove();
  const body = overlay.querySelector("[data-body]");
  const input = overlay.querySelector("[data-file]");
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    body.innerHTML = `<div class="card">Lecture du fichier…</div>`;
    try {
      const rows = await readFile(file); if (!rows.length) throw new Error("Le fichier ne contient aucune ligne exploitable.");
      const headers = Object.keys(rows[0]);
      const mapping = Object.fromEntries(Object.entries(ALIASES).map(([field, aliases]) => [field, findColumn(headers, aliases)]));
      const [{ data: sectors, error: sectorsError }, { data: materials, error: materialsError }, { data: existing, error: existingError }] = await Promise.all([
        supabase.from("sectors").select("id,name,active").eq("active", true),
        supabase.from("materials").select("id,name,category,active").eq("active", true),
        supabase.from("work_orders").select("address,city,material_detail")
      ]);
      if (sectorsError) throw sectorsError; if (materialsError) throw materialsError; if (existingError) throw existingError;
      const existingKeys = new Set((existing || []).map((r) => [norm(r.address), norm(r.city), norm(r.material_detail)].join("|")));
      const state = rows.map((row, index) => {
        const address = String(row[mapping.address] || "").trim();
        const sectorValue = String(row[mapping.sector] || "").trim();
        const materialValue = String(row[mapping.materialDetail] || row[mapping.material] || "").trim();
        const sector = match(sectorValue, sectors || []);
        const material = (materials || []).find((m) => norm(m.name) === norm(materialValue) || norm(m.category) === norm(materialValue)) || (materials || []).find((m) => norm(m.name).includes(norm(materialValue)) || norm(m.category).includes(norm(materialValue)));
        const key = [norm(address), norm(row[mapping.city]), norm(materialValue)].join("|");
        const duplicate = key !== "||" && existingKeys.has(key);
        return { index, row, selected: !!address && !!sector && !!material && !duplicate, address, sector, material, duplicate, reason: !address ? "Adresse manquante" : !sector ? `Secteur « ${sectorValue} » introuvable` : !material ? `Matériau « ${materialValue} » introuvable` : duplicate ? "Doublon détecté" : "OK" };
      });
      renderPreview(body, rows, headers, mapping, state, userId, sectors || [], materials || []);
    } catch (e) { body.innerHTML = `<div class="card" style="color:#b42318">❌ ${escapeHtml(e?.message || "Impossible de lire le fichier.")}</div><div class="modal-actions"><button type="button" class="secondary" data-close2>Fermer</button></div>`; body.querySelector("[data-close2]").onclick = () => overlay.remove(); }
  };
}

function renderPreview(body, rows, headers, mapping, state, userId, sectors, materials) {
  const selectedCount = () => state.filter((r) => r.selected && !r.duplicate).length;
  body.innerHTML = `<div class="card"><strong>Correspondance des colonnes</strong><div data-mapping style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:10px"></div></div><div class="card" style="overflow:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px"><strong>Aperçu — ${rows.length} ligne(s)</strong><span data-count></span></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th></th><th>Adresse</th><th>Ville</th><th>Secteur</th><th>Matériau</th><th>État</th></tr></thead><tbody data-table></tbody></table></div><div data-message></div><div class="modal-actions"><button type="button" class="secondary" data-cancel>Fermer</button><button type="button" class="primary" data-import>Importer</button></div>`;
  const mappingBox = body.querySelector("[data-mapping]");
  for (const [field, value] of Object.entries(mapping)) { if (field === "surface") continue; const label = document.createElement("label"); label.style.fontSize = "12px"; label.textContent = field; const select = document.createElement("select"); select.style.width = "100%"; select.innerHTML = `<option value="">— non renseigné —</option>` + headers.map((h) => `<option value="${escapeAttr(h)}" ${h === value ? "selected" : ""}>${escapeHtml(h)}</option>`).join(""); select.onchange = () => { mapping[field] = select.value; recompute(); refresh(); }; label.appendChild(select); mappingBox.appendChild(label); }
  body.querySelector("[data-cancel]").onclick = () => body.closest(".modal-overlay")?.remove();
  function recompute() { state.forEach((item) => { const address = String(item.row[mapping.address] || "").trim(); const sectorValue = String(item.row[mapping.sector] || "").trim(); const materialValue = String(item.row[mapping.materialDetail] || item.row[mapping.material] || "").trim(); item.sector = match(sectorValue, sectors); item.material = materials.find((m) => norm(m.name) === norm(materialValue) || norm(m.category) === norm(materialValue)) || materials.find((m) => norm(m.name).includes(norm(materialValue)) || norm(m.category).includes(norm(materialValue))); item.address = address; item.selected = !!address && !!item.sector && !!item.material && !item.duplicate; item.reason = !address ? "Adresse manquante" : !item.sector ? `Secteur « ${sectorValue} » introuvable` : !item.material ? `Matériau « ${materialValue} » introuvable` : item.duplicate ? "Doublon détecté" : "OK"; }); }
  const refresh = () => { body.querySelector("[data-count]").textContent = `${selectedCount()} ligne(s) prête(s)`; const table = body.querySelector("[data-table]"); table.innerHTML = ""; state.slice(0, 100).forEach((item) => { const tr = document.createElement("tr"); tr.style.opacity = item.selected && !item.duplicate ? "1" : ".45"; tr.innerHTML = `<td></td><td>${escapeHtml(item.row[mapping.address])}</td><td>${escapeHtml(item.row[mapping.city])}</td><td>${escapeHtml(item.row[mapping.sector])}</td><td>${escapeHtml(item.row[mapping.materialDetail] || item.row[mapping.material])}</td><td>${item.reason === "OK" ? "✓ OK" : "⚠️ " + escapeHtml(item.reason)}</td>`; const cb = document.createElement("input"); cb.type="checkbox"; cb.checked=item.selected; cb.disabled=!!item.duplicate; cb.onchange=()=>{item.selected=cb.checked;refresh();}; tr.firstChild.appendChild(cb); table.appendChild(tr); }); };
  refresh();
  body.querySelector("[data-import]").onclick = async () => {
    const ready = state.filter((r) => r.selected && !r.duplicate); if (!ready.length) return;
    const button = body.querySelector("[data-import]"); button.disabled = true; button.textContent = "Import en cours…";
    try {
      const payload = ready.map((item) => { const row = item.row; const road = num(row[mapping.road]); const sidewalk = num(row[mapping.sidewalk]); const surface = num(row[mapping.surface]); const zone = String(row[mapping.zone] || "").trim() || (road != null ? "Chaussée" : sidewalk != null ? "Trottoir" : "Autre"); return { address: String(row[mapping.address] || "").trim(), postal_code: String(row[mapping.postalCode] || "").trim() || null, city: String(row[mapping.city] || "").trim() || null, sector_id: item.sector.id, material_detail: String(row[mapping.materialDetail] || row[mapping.material] || item.material?.name || "").trim(), rehabilitation_zone: zone, rehabilitation_other_detail: zone === "Autre" ? String(row[mapping.zone] || "").trim() || null : null, planned_surface_m2: surface ?? road ?? sidewalk ?? 0, planned_road_surface_m2: road, planned_sidewalk_surface_m2: sidewalk, particularities: String(row[mapping.notes] || "").trim() || null, status: "À planifier", created_by: userId, updated_by: userId }; });
      const { data, error } = await supabase.from("work_orders").insert(payload).select("id");
      if (error) throw error;
      body.querySelector("[data-message]").innerHTML = `<div class="card" style="border-left:4px solid #1976d2">✅ ${data?.length || payload.length} OS importé(s). Les doublons et lignes invalides ont été écartés.</div>`;
      button.textContent = "Import terminé"; window.dispatchEvent(new Event("setom:planning-updated"));
    } catch (e) { body.querySelector("[data-message]").innerHTML = `<div class="card" style="color:#b42318">❌ ${escapeHtml(e?.message || "Import impossible")}</div>`; button.disabled=false; button.textContent=`Importer ${ready.length} OS`; }
  };
}

function escapeHtml(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;"); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g,"&#39;"); }

let attempts = 0;
async function boot() { const ready = await init().catch((error) => { console.error("[SETOM] Import OS:", error); return true; }); if (!ready && attempts++ < 30) setTimeout(boot, 500); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
window.addEventListener("setom:planning-updated", () => setTimeout(() => { attempts = 0; boot(); }, 200));
