import { supabase } from "./supabase";

const STYLE_ID = "setom-materials-stock-widget-style";
const ROOT_ID = "setom-materials-stock-widget";

function money(value) { return `${Number(value || 0).toFixed(2)} €`; }
function num(value) { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function surfaceOf(row) { return num(row.planned_surface_m2); }
function esc(value) { return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}-button{position:fixed;right:18px;bottom:18px;z-index:99990;border:0;border-radius:999px;padding:13px 17px;background:#172b4d;color:#fff;font-weight:800;box-shadow:0 8px 26px rgba(0,0,0,.2);cursor:pointer;font-size:14px}
    #${ROOT_ID}-panel{position:fixed;inset:18px;z-index:99991;background:#f8fafc;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.28);overflow:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202a}
    #${ROOT_ID}-panel .ms-head{position:sticky;top:0;background:#fff;border-bottom:1px solid #e4e7ec;padding:16px 18px;display:flex;justify-content:space-between;gap:12px;align-items:center;z-index:2}
    #${ROOT_ID}-panel .ms-body{padding:18px;max-width:1250px;margin:auto}
    #${ROOT_ID}-panel .ms-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    #${ROOT_ID}-panel .ms-card{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:14px}
    #${ROOT_ID}-panel table{width:100%;border-collapse:collapse;min-width:760px;background:#fff}
    #${ROOT_ID}-panel th,#${ROOT_ID}-panel td{text-align:left;padding:9px;border-bottom:1px solid #edf0f4;font-size:13px}
    #${ROOT_ID}-panel input{width:100%;box-sizing:border-box;padding:9px;border:1px solid #d0d5dd;border-radius:8px}
    #${ROOT_ID}-panel button{font:inherit}
    #${ROOT_ID}-panel .ms-primary{border:0;border-radius:8px;padding:9px 12px;background:#175cd3;color:#fff;font-weight:700;cursor:pointer}
    #${ROOT_ID}-panel .ms-secondary{border:1px solid #d0d5dd;border-radius:8px;padding:9px 12px;background:#fff;color:#344054;font-weight:700;cursor:pointer}
    #${ROOT_ID}-panel .ms-danger{color:#b42318;font-weight:800}
    #${ROOT_ID}-panel .ms-good{color:#027a48;font-weight:800}
    @media(max-width:700px){#${ROOT_ID}-panel{inset:0;border-radius:0}#${ROOT_ID}-button{right:12px;bottom:12px}.ms-body{padding:12px!important}}
  `;
  document.head.appendChild(style);
}

function getDateValue() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

async function loadData(date) {
  const [ordersResult, interventionsResult, materialsResult, loadsResult] = await Promise.all([
    supabase.from("work_orders").select("id,os_number,creation_date,status,address,city,material_detail,planned_surface_m2,material_id").in("status", ["Nouveau OS", "Planifié"]),
    supabase.from("interventions").select("work_order_id,planned_date,team_id"),
    supabase.from("materials").select("id,name,category,active,density_t_m3,default_thickness_cm,purchase_price_per_t").order("sort_order", { ascending: true }),
    supabase.from("truck_daily_loads").select("material_id,loaded_quantity,unit").eq("load_date", date)
  ]);
  for (const result of [ordersResult, interventionsResult, materialsResult, loadsResult]) if (result.error) throw result.error;
  const interventionsByOrder = new Map((interventionsResult.data || []).map((row) => [row.work_order_id, row]));
  const orders = (ordersResult.data || []).filter((order) => interventionsByOrder.get(order.id)?.planned_date === date);
  const materials = materialsResult.data || [];
  const loads = Object.fromEntries((loadsResult.data || []).map((row) => [row.material_id, String(row.loaded_quantity ?? "")]));
  return { orders, materials, loads };
}

function findMaterial(order, materials) {
  const text = `${order.material_detail || ""}`.toLocaleLowerCase("fr-FR");
  const byId = materials.find((m) => m.id === order.material_id);
  if (byId) return byId;
  return materials.find((m) => {
    const name = String(m.name || "").toLocaleLowerCase("fr-FR");
    const category = String(m.category || "").toLocaleLowerCase("fr-FR");
    return (name && text.includes(name)) || (category && text.includes(category));
  }) || null;
}

function calculate(orders, materials) {
  const rows = orders.map((order) => {
    const material = findMaterial(order, materials);
    const surface = surfaceOf(order);
    const thickness = num(material?.default_thickness_cm);
    const density = num(material?.density_t_m3);
    const volume = surface > 0 && thickness > 0 ? surface * thickness / 100 : 0;
    const tonnage = volume > 0 && density > 0 ? volume * density : 0;
    const cost = tonnage > 0 && material?.purchase_price_per_t != null ? tonnage * num(material.purchase_price_per_t) : 0;
    return { order, material, surface, thickness, density, volume, tonnage, cost };
  });
  const totals = new Map();
  for (const row of rows) {
    const key = row.material?.id || `missing:${row.order.material_detail || row.order.id}`;
    const previous = totals.get(key) || { material: row.material, surface: 0, volume: 0, tonnage: 0, cost: 0, missing: false };
    previous.surface += row.surface; previous.volume += row.volume; previous.tonnage += row.tonnage; previous.cost += row.cost;
    previous.missing ||= !row.material || row.thickness <= 0 || row.density <= 0;
    totals.set(key, previous);
  }
  return { rows, totals: [...totals.values()] };
}

async function renderPanel(date) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.innerHTML = `<div id="${ROOT_ID}-panel"><div class="ms-head"><div><strong style="font-size:19px">🚛 Préparation matériaux & stock camion</strong><div style="font-size:12px;color:#667085;margin-top:3px">Calcul prévisionnel de la journée</div></div><button id="setom-ms-close" class="ms-secondary">Fermer</button></div><div class="ms-body"><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px"><div><label style="display:block;font-size:12px;font-weight:700">Journée</label><input id="setom-ms-date" type="date" value="${esc(date)}"></div><button id="setom-ms-refresh" class="ms-secondary">↻ Actualiser</button></div><div id="setom-ms-content">Chargement…</div></div></div>`;
  document.getElementById("setom-ms-close").onclick = close;
  document.getElementById("setom-ms-date").onchange = (event) => renderPanel(event.target.value);
  document.getElementById("setom-ms-refresh").onclick = () => renderPanel(document.getElementById("setom-ms-date").value);
  const content = document.getElementById("setom-ms-content");
  try {
    const { orders, materials, loads } = await loadData(date);
    const { rows, totals } = calculate(orders, materials);
    const totalTonnage = totals.reduce((sum, row) => sum + row.tonnage, 0);
    const totalCost = totals.reduce((sum, row) => sum + row.cost, 0);
    content.innerHTML = `
      <div class="ms-grid" style="margin-bottom:14px">
        <div class="ms-card"><div style="color:#667085;font-size:12px">OS prévus</div><strong style="font-size:28px">${orders.length}</strong></div>
        <div class="ms-card"><div style="color:#667085;font-size:12px">TONNAGE À PRÉVOIR</div><strong style="font-size:28px">${totalTonnage.toFixed(2)} t</strong></div>
        <div class="ms-card"><div style="color:#667085;font-size:12px">Volume total</div><strong style="font-size:28px">${totals.reduce((s,r)=>s+r.volume,0).toFixed(2)} m³</strong></div>
        <div class="ms-card"><div style="color:#667085;font-size:12px">Coût matière estimé</div><strong style="font-size:28px">${money(totalCost)}</strong></div>
      </div>
      <div class="ms-card" style="margin-bottom:14px;overflow:auto"><h3 style="margin-top:0">Détail des OS</h3><table><thead><tr><th>OS</th><th>Matériau</th><th>Surface</th><th>Épaisseur</th><th>Volume</th><th>Tonnage</th><th>Coût</th></tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td>${esc(row.order.os_number)}</td><td>${esc(row.material?.name || row.order.material_detail || "Non paramétré")}</td><td>${row.surface.toFixed(2)} m²</td><td>${row.thickness ? row.thickness + " cm" : "⚠️ à définir"}</td><td>${row.volume ? row.volume.toFixed(3) + " m³" : "—"}</td><td><strong>${row.tonnage ? row.tonnage.toFixed(2) + " t" : "⚠️"}</strong></td><td>${row.material?.purchase_price_per_t != null && row.tonnage ? money(row.cost) : "—"}</td></tr>`).join("") : `<tr><td colspan="7">Aucun OS planifié pour cette journée.</td></tr>`}</tbody></table></div>
      <div class="ms-card"><h3 style="margin-top:0">📦 Chargement et reste camion</h3><div class="ms-grid">${totals.filter((row)=>row.material).map((row) => { const loaded=num(loads[row.material.id]); const remaining=loaded-row.tonnage; return `<div class="ms-card"><strong>${esc(row.material.name)}</strong><div style="font-size:13px;margin:7px 0">Besoin estimé : <strong>${row.tonnage.toFixed(2)} t</strong></div><label style="font-size:12px;font-weight:700">Quantité chargée (t)</label><div style="display:flex;gap:8px;margin-top:5px"><input id="setom-load-${row.material.id}" type="number" min="0" step="0.01" value="${esc(loads[row.material.id] || "")}"><button class="ms-primary" data-save-load="${row.material.id}">💾</button></div><div style="margin-top:9px" class="${remaining < 0 ? "ms-danger" : "ms-good"}">${remaining < 0 ? `⚠️ Il manque ${Math.abs(remaining).toFixed(2)} t` : `Reste estimé : ${remaining.toFixed(2)} t`}</div></div>`; }).join("") || `<div>Paramétrez les matériaux utilisés par les OS pour obtenir un calcul de tonnage.</div>`}</div></div>
      ${totals.some((row)=>row.missing) ? `<div class="ms-card" style="margin-top:14px;border-left:4px solid #f79009"><strong>⚠️ Paramètres à compléter</strong><p style="font-size:13px;color:#667085;margin-bottom:0">Une ou plusieurs matières n'ont pas de masse volumique ou d'épaisseur par défaut. Le tonnage affiché est alors incomplet. Ces paramètres sont modifiables ci-dessous.</p></div>` : ""}
      <div class="ms-card" style="margin-top:14px"><h3 style="margin-top:0">⚙️ Paramètres matériaux</h3><div style="overflow:auto"><table><thead><tr><th>Matériau</th><th>Masse volumique (t/m³)</th><th>Épaisseur défaut (cm)</th><th>Prix achat (€/t)</th><th></th></tr></thead><tbody>${materials.map((m)=>`<tr><td>${esc(m.name)}</td><td><input data-material-density="${m.id}" type="number" min="0.1" step="0.01" value="${esc(m.density_t_m3 ?? "")}"></td><td><input data-material-thickness="${m.id}" type="number" min="0.1" step="0.5" value="${esc(m.default_thickness_cm ?? "")}"></td><td><input data-material-price="${m.id}" type="number" min="0" step="0.01" value="${esc(m.purchase_price_per_t ?? "")}"></td><td><button class="ms-secondary" data-save-material="${m.id}">Enregistrer</button></td></tr>`).join("")}</tbody></table></div></div>`;

    root.querySelectorAll("[data-save-load]").forEach((button) => {
      button.onclick = async () => {
        const id = button.getAttribute("data-save-load");
        const input = document.getElementById(`setom-load-${id}`);
        const quantity = num(input?.value);
        if (!Number.isFinite(quantity) || quantity < 0) { alert("La quantité chargée doit être positive ou nulle."); return; }
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) { alert("Impossible de vérifier la connexion : " + authError.message); return; }
        const payload = { load_date: date, material_id: id, loaded_quantity: quantity, unit: "t", created_by: authData?.user?.id || null, updated_at: new Date().toISOString() };
        const { data: existing, error: lookupError } = await supabase.from("truck_daily_loads").select("id").eq("load_date", date).eq("material_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lookupError) { alert("Impossible de vérifier le chargement existant : " + lookupError.message); return; }
        const result = existing?.id
          ? await supabase.from("truck_daily_loads").update(payload).eq("id", existing.id)
          : await supabase.from("truck_daily_loads").insert(payload);
        if (result.error) alert("Impossible d'enregistrer le chargement : " + result.error.message); else renderPanel(date);
      };
    });
    root.querySelectorAll("[data-save-material]").forEach((button) => {
      button.onclick = async () => {
        const id = button.getAttribute("data-save-material");
        const density = num(root.querySelector(`[data-material-density="${id}"]`)?.value);
        const thickness = num(root.querySelector(`[data-material-thickness="${id}"]`)?.value);
        const priceRaw = root.querySelector(`[data-material-price="${id}"]`)?.value;
        const purchase = priceRaw === "" ? null : num(priceRaw);
        const { error } = await supabase.from("materials").update({ density_t_m3: density || null, default_thickness_cm: thickness || null, purchase_price_per_t: purchase }).eq("id", id);
        if (error) alert("Impossible d'enregistrer le matériau : " + error.message); else renderPanel(date);
      };
    });
  } catch (error) {
    content.innerHTML = `<div class="ms-card ms-danger">Impossible de charger les données : ${esc(error?.message || "Erreur inconnue")}</div>`;
  }
}

function close() { const root = document.getElementById(ROOT_ID); if (root) root.innerHTML = ""; }

function open() { ensureStyles(); const root = document.getElementById(ROOT_ID) || document.body.appendChild(Object.assign(document.createElement("div"), { id: ROOT_ID })); renderPanel(getDateValue()); }

function mountButton() {
  ensureStyles();
  if (document.getElementById(`${ROOT_ID}-button`)) return;
  const button = document.createElement("button");
  button.id = `${ROOT_ID}-button`;
  button.textContent = "🚛 Matériaux journée";
  button.onclick = open;
  document.body.appendChild(button);
}

window.addEventListener("load", mountButton);
setTimeout(mountButton, 1200);
setInterval(mountButton, 3000);
