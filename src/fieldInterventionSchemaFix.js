import { supabase } from "./supabase";

const MODAL_ID = "setom-field-intervention-modal";

function currentModal() { return document.getElementById(MODAL_ID); }
function showError(modal, error) {
  const box = modal?.querySelector("#setom-field-error");
  if (box) box.innerHTML = `<div class="setom-error">${String(error?.message || error || "Erreur inconnue").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}</div>`;
}

async function saveFieldState({ mode }) {
  const modal = currentModal();
  if (!modal) return;
  const osText = modal.querySelector(".setom-field-sub")?.textContent || "";
  const match = osText.match(/OS\s+(\d+)/i);
  if (!match) throw new Error("Numéro d’OS introuvable.");
  const osNumber = Number(match[1]);
  const { data: workOrder, error: woError } = await supabase.from("work_orders").select("id,os_number,status,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2").eq("os_number", osNumber).maybeSingle();
  if (woError) throw woError;
  if (!workOrder) throw new Error(`OS ${osNumber} introuvable.`);

  const total = modal.querySelector("#setom-real-surface")?.value;
  const road = modal.querySelector("#setom-real-road")?.value;
  const sidewalk = modal.querySelector("#setom-real-sidewalk")?.value;
  const notes = modal.querySelector("#setom-work-notes")?.value?.trim() || null;
  const actualTotal = total !== "" && total != null ? Number(total) : (road !== "" && road != null ? Number(road || 0) : 0) + (sidewalk !== "" && sidewalk != null ? Number(sidewalk || 0) : 0);

  const woPatch = {};
  if (road !== "" && road != null) woPatch.actual_road_surface_m2 = Number(road);
  if (sidewalk !== "" && sidewalk != null) woPatch.actual_sidewalk_surface_m2 = Number(sidewalk);
  if (total !== "" && total != null && !Number.isNaN(Number(total))) {
    woPatch.actual_other_surface_m2 = Math.max(0, Number(total) - Number(road || 0) - Number(sidewalk || 0));
  }
  if (notes) woPatch.particularities = notes;
  if (mode === "start") woPatch.status = "En cours";
  if (mode === "finish") woPatch.status = "Travaux réalisés";
  if (mode === "reserve") woPatch.status = "À vérifier";
  if (Object.keys(woPatch).length) {
    const { error } = await supabase.from("work_orders").update(woPatch).eq("id", workOrder.id);
    if (error) throw error;
  }

  const { data: existing, error: interventionReadError } = await supabase.from("interventions").select("id").eq("work_order_id", workOrder.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (interventionReadError) throw interventionReadError;
  const now = new Date().toTimeString().slice(0, 8);
  const interventionPatch = {};
  if (mode === "start") { interventionPatch.status = "En cours"; interventionPatch.arrival_time = now; }
  if (mode === "finish") { interventionPatch.status = "Terminé"; interventionPatch.departure_time = now; }
  if (mode === "reserve") interventionPatch.status = "Reprise";
  if (actualTotal > 0) interventionPatch.actual_surface_m2 = actualTotal;
  if (notes) interventionPatch.notes = notes;

  if (existing?.id) {
    const { error } = await supabase.from("interventions").update(interventionPatch).eq("id", existing.id);
    if (error) throw error;
  } else if (Object.keys(interventionPatch).length) {
    const { error } = await supabase.from("interventions").insert({ work_order_id: workOrder.id, actual_surface_m2: actualTotal || null, ...interventionPatch });
    if (error) throw error;
  }

  const input = modal.querySelector("#setom-work-photos");
  for (const file of Array.from(input?.files || [])) {
    const safe = String(file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const category = mode === "reserve" ? "reserve_reprise" : "travaux";
    const path = `work-orders/${workOrder.id}/${category}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;
    const { error: uploadError } = await supabase.storage.from("setom-files").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
    if (uploadError) throw uploadError;
    const { error: attachmentError } = await supabase.from("attachments").insert({ work_order_id: workOrder.id, category, file_name: file.name, storage_path: path, mime_type: file.type || "image/jpeg", captured_at: new Date().toISOString() });
    if (attachmentError) throw attachmentError;
  }
}

async function handleClick(event) {
  const button = event.target?.closest?.("#setom-start-work,#setom-finish-work,#setom-save-work,#setom-save-reprise");
  if (!button) return;
  const modal = currentModal();
  if (!modal) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.disabled = true;
  try {
    const mode = button.id === "setom-start-work" ? "start" : button.id === "setom-finish-work" ? "finish" : button.id === "setom-save-reprise" ? "reserve" : "finish";
    await saveFieldState({ mode });
    modal.remove();
    window.dispatchEvent(new CustomEvent("setom:planning-updated"));
    window.dispatchEvent(new CustomEvent("setom:os-refresh"));
    setTimeout(() => window.location.reload(), 250);
  } catch (error) {
    button.disabled = false;
    showError(modal, error);
  }
}

document.addEventListener("click", handleClick, true);
