import { supabase } from "./supabase";

const PANEL_ID = "setom-travaux-material-panel";
const norm = (v) => String(v || "").trim().toLowerCase();
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function getOsNumber() {
  const modal = document.querySelector(".os-detail-modal");
  const title = modal?.querySelector(".modal-header h2")?.textContent?.trim() || "";
  const match = title.match(/OS-(?:\d{4}-)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function activeTravauxTab() {
  const modal = document.querySelector(".os-detail-modal");
  if (!modal) return false;
  const active = [...modal.querySelectorAll(".os-tab.active")].some((el) => /travaux/i.test(el.textContent || ""));
  return active;
}

function addStyle() {
  if (document.getElementById("setom-travaux-material-style")) return;
  const style = document.createElement("style");
  style.id = "setom-travaux-material-style";
  style.textContent = `
    #${PANEL_ID}{margin-top:18px;border:1px solid #dbe3ee;border-radius:16px;background:linear-gradient(135deg,#f8fbff,#fff);padding:16px;box-shadow:0 6px 20px rgba(20,50,90,.06)}
    #${PANEL_ID} .stm-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
    #${PANEL_ID} .stm-title{font-weight:800;color:#102a56;font-size:16px}
    #${PANEL_ID} .stm-sub{font-size:12px;color:#667085;margin-top:3px}
    #${PANEL_ID} .stm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    #${PANEL_ID} .stm-card{background:#fff;border:1px solid #e3e9f1;border-radius:12px;padding:11px}
    #${PANEL_ID} .stm-label{font-size:11px;color:#667085}
    #${PANEL_ID} .stm-value{font-size:17px;font-weight:800;color:#102a56;margin-top:4px}
    #${PANEL_ID} .stm-form{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px}
    #${PANEL_ID} label{font-size:11px;color:#667085;display:flex;flex-direction:column;gap:5px}
    #${PANEL_ID} input{height:38px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px;width:120px;background:#fff}
    #${PANEL_ID} button{height:38px;border:0;border-radius:9px;padding:0 14px;font-weight:700;cursor:pointer;background:#0759d6;color:#fff}
    #${PANEL_ID} button.secondary{background:#edf3fb;color:#173a6b}
    #${PANEL_ID} .stm-msg{font-size:12px;margin-top:8px;color:#475467}
    #${PANEL_ID} .stm-warn{color:#b54708;font-weight:700}
    @media(max-width:800px){#${PANEL_ID} .stm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

async function loadContext(osNumber) {
  const { data: os, error } = await supabase.from("work_orders").select("id,os_number,planned_surface_m2,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2,material_id,material_detail").eq("os_number", osNumber).maybeSingle();
  if (error || !os) throw error || new Error("OS introuvable");
  const { data: intervention } = await supabase.from("interventions").select("id,planned_date,planned_surface_m2,actual_surface_m2,material_id").eq("work_order_id", os.id).maybeSingle();
  let material = null;
  const materialId = intervention?.material_id || os.material_id;
  if (materialId) {
    const result = await supabase.from("materials").select("id,name,density_t_m3,default_thickness_cm,purchase_price_per_t").eq("id", materialId).maybeSingle();
    material = result.data || null;
  }
  if (!material && os.material_detail) {
    const result = await supabase.from("materials").select("id,name,density_t_m3,default_thickness_cm,purchase_price_per_t").ilike("name", `%${String(os.material_detail).split(" ")[0]}%`).limit(1).maybeSingle();
    material = result.data || null;
  }
  const date = intervention?.planned_date || new Date().toISOString().slice(0, 10);
  const { data: load } = material ? await supabase.from("truck_daily_loads").select("id,loaded_quantity,unit,material_id").eq("load_date", date).eq("material_id", material.id).maybeSingle() : { data: null };
  const { data: consumptions } = material ? await supabase.from("truck_material_consumptions").select("quantity,unit,estimated").eq("consumption_date", date).eq("material_id", material.id) : { data: [] };
  const consumed = (consumptions || []).reduce((sum, row) => sum + (norm(row.unit) === "t" ? num(row.quantity) : 0), 0);
  const actualSurface = intervention?.actual_surface_m2 || os.actual_road_surface_m2 || os.actual_sidewalk_surface_m2 || os.actual_other_surface_m2 || 0;
  const plannedSurface = intervention?.planned_surface_m2 || os.planned_surface_m2 || 0;
  const density = num(material?.density_t_m3);
  const thickness = num(material?.default_thickness_cm);
  const estimatedTonnes = density > 0 && thickness > 0 && actualSurface > 0 ? actualSurface * (thickness / 100) * density : 0;
  const plannedTonnes = density > 0 && thickness > 0 && plannedSurface > 0 ? plannedSurface * (thickness / 100) * density : 0;
  const loaded = num(load?.loaded_quantity);
  const remainingBefore = Math.max(0, loaded - consumed);
  return { os, intervention, material, date, load, consumed, actualSurface, plannedSurface, density, thickness, estimatedTonnes, plannedTonnes, loaded, remainingBefore };
}

function renderPanel(ctx) {
  addStyle();
  let panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();
  const host = document.querySelector(".os-detail-modal .os-tab-content");
  if (!host) return;
  panel = document.createElement("section");
  panel.id = PANEL_ID;
  const m = ctx.material;
  const estimated = ctx.estimatedTonnes;
  const remainingAfterEstimated = Math.max(0, ctx.remainingBefore - estimated);
  panel.innerHTML = `
    <div class="stm-head"><div><div class="stm-title">🚚 Matériaux & tonnage</div><div class="stm-sub">Estimation automatique à partir des mesures réelles, de l'épaisseur et de la densité du matériau.</div></div><span class="os-status-badge" style="background:#eef6ff;color:#0759d6;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800">${m?.name || "Matériau non associé"}</span></div>
    <div class="stm-grid">
      <div class="stm-card"><div class="stm-label">Surface prévue</div><div class="stm-value">${ctx.plannedSurface.toFixed(2)} m²</div></div>
      <div class="stm-card"><div class="stm-label">Surface réalisée</div><div class="stm-value">${ctx.actualSurface.toFixed(2)} m²</div></div>
      <div class="stm-card"><div class="stm-label">Tonnage estimé</div><div class="stm-value">${estimated.toFixed(2)} t</div></div>
      <div class="stm-card"><div class="stm-label">Reste camion estimé</div><div class="stm-value">${remainingAfterEstimated.toFixed(2)} t</div></div>
    </div>
    <div class="stm-form">
      <label>Chargement du jour (t)<input id="stm-load" type="number" min="0" step="0.01" value="${ctx.loaded || ""}" ${m ? "" : "disabled"}></label>
      <label>Consommé réel (t)<input id="stm-actual" type="number" min="0" step="0.01" value="${ctx.estimatedTonnes ? ctx.estimatedTonnes.toFixed(2) : ""}" ${m ? "" : "disabled"}></label>
      <button id="stm-save" ${m ? "" : "disabled"}>Enregistrer</button>
      <button id="stm-refresh" class="secondary">Actualiser</button>
    </div>
    <div class="stm-msg" id="stm-msg">${m ? `Densité : ${ctx.density || "—"} t/m³ · Épaisseur de référence : ${ctx.thickness || "—"} cm · Chargé : ${ctx.loaded.toFixed(2)} t · Déjà consommé : ${ctx.consumed.toFixed(2)} t` : "Associez un matériau avec densité et épaisseur dans Paramètres pour activer le calcul."}</div>
  `;
  host.appendChild(panel);
  panel.querySelector("#stm-refresh")?.addEventListener("click", () => refresh());
  panel.querySelector("#stm-save")?.addEventListener("click", async () => {
    if (!ctx.material || !ctx.intervention) return;
    const loadValue = num(panel.querySelector("#stm-load")?.value);
    const actualValue = num(panel.querySelector("#stm-actual")?.value);
    const msg = panel.querySelector("#stm-msg");
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    try {
      if (loadValue > 0) {
        if (ctx.load?.id) {
          const { error } = await supabase.from("truck_daily_loads").update({ loaded_quantity: loadValue, unit: "t", updated_at: new Date().toISOString() }).eq("id", ctx.load.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("truck_daily_loads").insert({ load_date: ctx.date, material_id: ctx.material.id, loaded_quantity: loadValue, unit: "t", created_by: userId });
          if (error) throw error;
        }
      }
      if (actualValue > 0) {
        const { error } = await supabase.from("truck_material_consumptions").insert({ work_order_id: ctx.os.id, intervention_id: ctx.intervention.id, material_id: ctx.material.id, consumption_date: ctx.date, quantity: actualValue, unit: "t", estimated: false, source: "travaux_reels", created_by: userId });
        if (error) throw error;
      }
      if (msg) msg.textContent = "✅ Chargement et consommation enregistrés.";
      setTimeout(refresh, 500);
    } catch (error) {
      if (msg) { msg.textContent = `Impossible d'enregistrer : ${error?.message || "erreur inconnue"}`; msg.className = "stm-msg stm-warn"; }
    }
  });
}

async function refresh() {
  if (!activeTravauxTab()) return;
  const osNumber = getOsNumber();
  if (!osNumber) return;
  try {
    const ctx = await loadContext(osNumber);
    renderPanel(ctx);
  } catch (error) {
    console.warn("SETOM matériaux/tonnage :", error);
  }
}

let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 120);
}

const observer = new MutationObserver(scheduleRefresh);
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("setom:planning-updated", scheduleRefresh);
addStyle();
scheduleRefresh();
