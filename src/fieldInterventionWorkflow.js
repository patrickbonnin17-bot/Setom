import { supabase } from "./supabase";

const STYLE_ID = "setom-field-intervention-style";
const MODAL_ID = "setom-field-intervention-modal";
const INJECTED = "data-setom-start-intervention";

function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}

function osNumberFromText(text) {
  const value = String(text || "");
  const matches = [
    value.match(/OS[-\s]?\d{4}[-\s]?(\d{3,8})/i),
    value.match(/(?:OS|ordre)\s*[#:]?\s*(\d{3,8})/i)
  ].filter(Boolean);
  if (!matches.length) return "";
  return String(matches[0][1]).replace(/\D/g, "");
}

function findCard(node) {
  let el = node?.closest?.("[data-os-number],[data-work-order-id],.setom-os-card,.setom-binder-card,.setom-map-order,article,li");
  if (el && el.textContent.length < 5000) return el;
  el = node?.parentElement;
  while (el && el !== document.body) {
    const text = el.textContent || "";
    if (text.length < 2500 && /\bOS[-\s]?(?:\d{4}[-\s]?)?\d{3,8}\b/i.test(text)) return el;
    el = el.parentElement;
  }
  return null;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .setom-start-intervention-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:42px;margin-top:10px;padding:9px 13px;border:0;border-radius:11px;background:#1769e0;color:#fff;font:800 13px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(23,105,224,.2)}
    .setom-start-intervention-btn:hover{filter:brightness(.96)}
    .setom-start-intervention-btn[disabled]{opacity:.55;cursor:wait}
    #${MODAL_ID}{position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #${MODAL_ID} .setom-field-panel{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 18px 60px rgba(0,0,0,.28)}
    #${MODAL_ID} .setom-field-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;z-index:2}
    #${MODAL_ID} .setom-field-title{font-size:20px;font-weight:850;color:#111827}
    #${MODAL_ID} .setom-field-sub{font-size:12px;color:#667085;margin-top:3px}
    #${MODAL_ID} .setom-close{border:0;background:#f2f4f7;border-radius:10px;width:36px;height:36px;font-size:20px;cursor:pointer}
    #${MODAL_ID} .setom-field-body{padding:18px 20px 22px}
    #${MODAL_ID} .setom-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    #${MODAL_ID} label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:750;color:#344054}
    #${MODAL_ID} input,#${MODAL_ID} textarea,#${MODAL_ID} select{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:10px;padding:10px 11px;font:500 14px/1.25 inherit;background:#fff;color:#101828}
    #${MODAL_ID} textarea{min-height:78px;resize:vertical}
    #${MODAL_ID} .setom-field-wide{grid-column:1/-1}
    #${MODAL_ID} .setom-section{margin-top:18px;padding-top:16px;border-top:1px solid #eaecf0}
    #${MODAL_ID} .setom-section h3{margin:0 0 10px;font-size:14px;color:#17202a}
    #${MODAL_ID} .setom-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    #${MODAL_ID} .setom-action{border:0;border-radius:11px;padding:11px 15px;font-weight:800;cursor:pointer}
    #${MODAL_ID} .setom-primary{background:#1769e0;color:#fff}
    #${MODAL_ID} .setom-success{background:#16803c;color:#fff}
    #${MODAL_ID} .setom-danger{background:#b42318;color:#fff}
    #${MODAL_ID} .setom-secondary{background:#eef2f6;color:#344054}
    #${MODAL_ID} .setom-note{padding:10px 12px;border-radius:10px;background:#f8fafc;color:#475467;font-size:12px;line-height:1.4}
    #${MODAL_ID} .setom-error{padding:10px 12px;border-radius:10px;background:#fff1f0;color:#b42318;font-size:12px;margin-top:10px}
    #${MODAL_ID} .setom-photo-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    #${MODAL_ID} .setom-photo-list img{width:76px;height:58px;object-fit:cover;border-radius:8px;border:1px solid #e4e7ec}
    @media(max-width:640px){#${MODAL_ID}{padding:0}#${MODAL_ID} .setom-field-panel{height:100%;max-height:none;border-radius:0}#${MODAL_ID} .setom-field-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

async function getWorkOrder(osNumber) {
  const { data, error } = await supabase.from("work_orders").select("*").eq("os_number", Number(osNumber)).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`OS ${osNumber} introuvable.`);
  return data;
}

async function uploadPhotos(workOrderId, files, category) {
  const rows = [];
  for (const file of Array.from(files || [])) {
    const safe = String(file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `work-orders/${workOrderId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;
    const { error: uploadError } = await supabase.storage.from("setom-files").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("setom-files").getPublicUrl(path);
    const url = publicData?.publicUrl || path;
    const { error: attachmentError } = await supabase.from("attachments").insert({ work_order_id: workOrderId, category, file_name: file.name, file_path: path, file_url: url, mime_type: file.type || "image/jpeg" });
    if (attachmentError) throw attachmentError;
    rows.push({ file, url });
  }
  return rows;
}

function closeModal() {
  document.getElementById(MODAL_ID)?.remove();
}

function notifyRefresh() {
  window.dispatchEvent(new CustomEvent("setom:planning-updated"));
  window.dispatchEvent(new CustomEvent("setom:os-refresh"));
  setTimeout(() => window.location.reload(), 350);
}

function openModal(workOrder, mode = "start") {
  closeModal();
  const isReserve = mode === "reserve" || workOrder.status === "Réserve";
  const isFinished = ["Travaux réalisés", "À vérifier", "Validé", "Payé", "Archivé"].includes(workOrder.status);
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  const title = isReserve ? "Reprise après réserve" : isFinished ? "Travaux — consulter / compléter" : "Démarrer l’intervention";
  const subtitle = `OS ${esc(workOrder.os_number)} · ${esc(workOrder.address)}${workOrder.city ? ` · ${esc(workOrder.city)}` : ""}`;
  modal.innerHTML = `
    <div class="setom-field-panel" role="dialog" aria-modal="true">
      <div class="setom-field-head"><div><div class="setom-field-title">${title}</div><div class="setom-field-sub">${subtitle}</div></div><button class="setom-close" type="button">×</button></div>
      <div class="setom-field-body">
        <div class="setom-note">Statut actuel : <strong>${esc(workOrder.status || "Nouveau")}</strong>. Le bouton de démarrage ouvre directement les renseignements terrain. Les photos sont enregistrées dans le dossier de l’OS.</div>
        ${isReserve ? `<div class="setom-section"><h3>🔴 Réserve à traiter</h3><div class="setom-note">Après reprise, ajoutez les photos de reprise et, si nécessaire, modifiez les quantités du constat avant de générer le nouveau constat.</div></div>` : ""}
        <div class="setom-section"><h3>📐 Mesures réelles</h3><div class="setom-field-grid">
          <label>Surface totale réelle (m²)<input id="setom-real-surface" type="number" min="0" step="0.01" value="${esc(workOrder.actual_surface_m2 ?? "")}" /></label>
          <label>Chaussée réelle (m²)<input id="setom-real-road" type="number" min="0" step="0.01" value="${esc(workOrder.actual_road_surface_m2 ?? "")}" /></label>
          <label>Trottoir réel (m²)<input id="setom-real-sidewalk" type="number" min="0" step="0.01" value="${esc(workOrder.actual_sidewalk_surface_m2 ?? "")}" /></label>
          <label>Épaisseur réelle (cm)<input id="setom-real-thickness" type="number" min="0" step="0.1" /></label>
          <label class="setom-field-wide">Observations / particularités<textarea id="setom-work-notes" placeholder="Mesures, difficultés, accès, finition…"></textarea></label>
        </div></div>
        <div class="setom-section"><h3>📸 Photos ${isReserve ? "de reprise" : "des travaux"}</h3>
          <label>Ajouter les photos<input id="setom-work-photos" type="file" accept="image/*" multiple capture="environment" /></label>
          <div id="setom-photo-preview" class="setom-photo-list"></div>
        </div>
        <div class="setom-section"><h3>🧾 Constat</h3><div class="setom-note">Le constat est généré après la fin des travaux. Une réserve conserve l’historique de l’ancien constat et ouvre une nouvelle version après reprise.</div></div>
        <div id="setom-field-error"></div>
        <div class="setom-actions">
          ${isReserve ? `<button id="setom-save-reprise" class="setom-action setom-primary">💾 Enregistrer la reprise</button>` : isFinished ? `<button id="setom-save-work" class="setom-action setom-primary">💾 Enregistrer les modifications</button>` : `<button id="setom-start-work" class="setom-action setom-primary">▶ Démarrer l’intervention</button><button id="setom-finish-work" class="setom-action setom-success">✓ Terminer les travaux</button>`}
          <button id="setom-cancel-work" class="setom-action setom-secondary">Fermer</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".setom-close")?.addEventListener("click", closeModal);
  modal.querySelector("#setom-cancel-work")?.addEventListener("click", closeModal);
  const photoInput = modal.querySelector("#setom-work-photos");
  photoInput?.addEventListener("change", () => {
    const box = modal.querySelector("#setom-photo-preview");
    box.innerHTML = "";
    Array.from(photoInput.files || []).forEach((file) => { const img = document.createElement("img"); img.src = URL.createObjectURL(file); img.alt = file.name; box.appendChild(img); });
  });

  async function save({ start = false, finish = false, reserve = false } = {}) {
    const errorBox = modal.querySelector("#setom-field-error");
    errorBox.innerHTML = "";
    const button = modal.querySelector(".setom-action:not(.setom-secondary)");
    if (button) button.disabled = true;
    try {
      const total = modal.querySelector("#setom-real-surface")?.value;
      const road = modal.querySelector("#setom-real-road")?.value;
      const sidewalk = modal.querySelector("#setom-real-sidewalk")?.value;
      const notes = modal.querySelector("#setom-work-notes")?.value || null;
      const patch = {
        ...(total !== "" ? { actual_surface_m2: Number(total) } : {}),
        ...(road !== "" ? { actual_road_surface_m2: Number(road) } : {}),
        ...(sidewalk !== "" ? { actual_sidewalk_surface_m2: Number(sidewalk) } : {}),
        ...(notes ? { particularities: notes } : {}),
        ...(start ? { status: "En cours" } : {}),
        ...(finish ? { status: "Travaux réalisés" } : {}),
        ...(reserve ? { status: "À vérifier" } : {})
      };
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("work_orders").update(patch).eq("id", workOrder.id);
        if (error) throw error;
      }
      if (workOrder.id) {
        const interventionPatch = {
          status: finish ? "Terminé" : start ? "En cours" : reserve ? "Reprise" : undefined,
          ...(start ? { arrival_time: new Date().toTimeString().slice(0,8) } : {}),
          ...(finish ? { departure_time: new Date().toTimeString().slice(0,8) } : {})
        };
        Object.keys(interventionPatch).forEach((key) => interventionPatch[key] === undefined && delete interventionPatch[key]);
        const { data: existing } = await supabase.from("interventions").select("id").eq("work_order_id", workOrder.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (existing?.id && Object.keys(interventionPatch).length) {
          const { error } = await supabase.from("interventions").update(interventionPatch).eq("id", existing.id);
          if (error) throw error;
        }
      }
      const files = Array.from(photoInput?.files || []);
      if (files.length) await uploadPhotos(workOrder.id, files, reserve ? "reserve_reprise" : "travaux");
      if (reserve) {
        try { await supabase.from("constats").update({ status: "À vérifier", reserve_resolved_at: new Date().toISOString() }).eq("work_order_id", workOrder.id).eq("status", "Réserve"); } catch (_) {}
      }
      closeModal();
      notifyRefresh();
    } catch (error) {
      if (button) button.disabled = false;
      errorBox.innerHTML = `<div class="setom-error">${esc(error?.message || "Impossible d’enregistrer l’intervention.")}</div>`;
    }
  }

  modal.querySelector("#setom-start-work")?.addEventListener("click", () => save({ start: true }));
  modal.querySelector("#setom-finish-work")?.addEventListener("click", () => save({ finish: true }));
  modal.querySelector("#setom-save-work")?.addEventListener("click", () => save({}));
  modal.querySelector("#setom-save-reprise")?.addEventListener("click", () => save({ reserve: true }));
}

async function handleStart(button) {
  const osNumber = button.dataset.osNumber;
  if (!osNumber) return;
  button.disabled = true;
  try {
    const workOrder = await getWorkOrder(osNumber);
    openModal(workOrder, workOrder.status === "Réserve" ? "reserve" : "start");
  } catch (error) {
    alert(error?.message || "Impossible d’ouvrir l’OS.");
  } finally {
    button.disabled = false;
  }
}

function injectButtons() {
  injectStyle();
  const candidates = Array.from(document.querySelectorAll("[data-os-number],[data-work-order-id],.setom-os-card,.setom-binder-card,.setom-map-order,article,li"));
  for (const candidate of candidates) {
    if (candidate.getAttribute(INJECTED) === "1") continue;
    const text = candidate.textContent || "";
    const osNumber = candidate.dataset.osNumber || osNumberFromText(text);
    if (!osNumber || text.length > 5000) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setom-start-intervention-btn";
    button.dataset.osNumber = osNumber;
    button.textContent = /Réserve/i.test(text) ? "↻ TRAITER LA RÉSERVE" : "▶ DÉMARRER L’INTERVENTION";
    button.addEventListener("click", (event) => { event.stopPropagation(); handleStart(button); });
    candidate.appendChild(button);
    candidate.setAttribute(INJECTED, "1");
  }
}

function boot() {
  injectButtons();
  const observer = new MutationObserver(() => injectButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(injectButtons, 1200);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
