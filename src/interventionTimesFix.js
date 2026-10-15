import { supabase } from "./supabase";

const BUILD = "2026-10-16-intervention-times";

function getDurationMinutes(arrival, departure) {
  if (!arrival || !departure) return null;
  const [ah, am] = String(arrival).slice(0, 5).split(":").map(Number);
  const [dh, dm] = String(departure).slice(0, 5).split(":").map(Number);
  if (![ah, am, dh, dm].every(Number.isFinite)) return null;
  let minutes = (dh * 60 + dm) - (ah * 60 + am);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function formatDuration(minutes) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

function extractOSNumber(modal) {
  const value = modal?.querySelector(".modal-header h2")?.textContent?.trim() || "";
  const match = value.match(/-(\d{4})-(\d+)$/);
  if (!match) return null;
  return Number(match[2]);
}

async function findIntervention(modal) {
  const osNumber = extractOSNumber(modal);
  if (!Number.isFinite(osNumber)) throw new Error("Impossible d'identifier le numéro de l'OS.");

  const { data: order, error: orderError } = await supabase
    .from("work_orders")
    .select("id, os_number, creation_date")
    .eq("os_number", osNumber)
    .order("creation_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order?.id) throw new Error("OS introuvable.");

  const { data: intervention, error: interventionError } = await supabase
    .from("interventions")
    .select("id, work_order_id, arrival_time, departure_time")
    .eq("work_order_id", order.id)
    .maybeSingle();
  if (interventionError) throw interventionError;
  if (!intervention?.id) throw new Error("Aucune intervention n'est encore associée à cet OS. Planifiez d'abord l'OS.");
  return intervention;
}

function styleCard(card) {
  card.style.marginTop = "18px";
  card.style.padding = "16px";
  card.style.border = "1px solid #d9e0e7";
  card.style.borderRadius = "12px";
  card.style.background = "#fff";
}

function mount(modal) {
  if (!modal || modal.dataset.setomInterventionTimes === BUILD) return;
  const heading = Array.from(modal.querySelectorAll("h3")).find((node) => node.textContent?.trim() === "Travaux réalisés");
  if (!heading) return;

  modal.dataset.setomInterventionTimes = BUILD;
  const fieldset = heading.closest(".os-section")?.querySelector("fieldset");
  const readOnly = Boolean(fieldset?.disabled);
  const card = document.createElement("div");
  card.className = "setom-intervention-times-card";
  styleCard(card);
  card.innerHTML = `
    <h4 style="margin:0 0 12px">🕐 Horaires d'intervention</h4>
    <p style="margin:0 0 14px;color:#667085;font-size:13px">Heures réellement passées sur le chantier. Elles seront utilisées ensuite pour le suivi du temps et des coûts de main-d'œuvre.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
      <div><label>Heure d'arrivée</label><input class="setom-arrival-time" type="time" step="60" /></div>
      <div><label>Heure de départ</label><input class="setom-departure-time" type="time" step="60" /></div>
      <div><label>Durée sur chantier</label><div class="setom-duration" style="min-height:40px;display:flex;align-items:center;padding:0 12px;border:1px solid #d0d5dd;border-radius:8px;background:#f8fafc;font-weight:700">—</div></div>
    </div>
    <div class="setom-times-message" style="margin-top:10px;font-size:12px;color:#667085;min-height:18px"></div>
  `;

  const target = heading.parentElement;
  const workCard = target?.querySelector(".os-work-card");
  if (workCard) workCard.insertBefore(card, workCard.querySelector("hr") || workCard.firstChild);
  else heading.insertAdjacentElement("afterend", card);

  const arrivalInput = card.querySelector(".setom-arrival-time");
  const departureInput = card.querySelector(".setom-departure-time");
  const duration = card.querySelector(".setom-duration");
  const message = card.querySelector(".setom-times-message");
  arrivalInput.disabled = readOnly;
  departureInput.disabled = readOnly;

  function refreshDuration() {
    const minutes = getDurationMinutes(arrivalInput.value, departureInput.value);
    duration.textContent = formatDuration(minutes);
    if (minutes != null && departureInput.value < arrivalInput.value) {
      duration.title = "Calculée jusqu'au lendemain.";
    } else {
      duration.title = "";
    }
  }

  let intervention = null;
  let loading = true;

  async function load() {
    try {
      intervention = await findIntervention(modal);
      arrivalInput.value = intervention.arrival_time ? String(intervention.arrival_time).slice(0, 5) : "";
      departureInput.value = intervention.departure_time ? String(intervention.departure_time).slice(0, 5) : "";
      refreshDuration();
      message.textContent = readOnly ? "Lecture seule — horaires enregistrés." : "Modifiez les horaires puis quittez le champ pour enregistrer.";
    } catch (error) {
      console.error("SETOM — horaires d'intervention :", error);
      message.textContent = error?.message || "Impossible de charger les horaires.";
      message.style.color = "#b42318";
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (readOnly || loading || !intervention?.id) return;
    const arrival = arrivalInput.value || null;
    const departure = departureInput.value || null;
    refreshDuration();
    message.style.color = "#667085";
    message.textContent = "Enregistrement…";
    const { error } = await supabase
      .from("interventions")
      .update({ arrival_time: arrival, departure_time: departure })
      .eq("id", intervention.id);
    if (error) {
      console.error("SETOM — erreur enregistrement horaires :", error);
      message.style.color = "#b42318";
      message.textContent = "Impossible d'enregistrer les horaires : " + error.message;
      return;
    }
    message.style.color = "#027a48";
    message.textContent = "✓ Horaires enregistrés";
  }

  arrivalInput.addEventListener("change", save);
  departureInput.addEventListener("change", save);
  arrivalInput.addEventListener("input", refreshDuration);
  departureInput.addEventListener("input", refreshDuration);
  load();
}

function scan() {
  document.querySelectorAll(".os-detail-modal").forEach(mount);
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
scan();
