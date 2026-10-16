import { supabase } from "./supabase";

const STYLE_ID = "setom-classeur-os-print-style";
const BUTTON_CLASS = "setom-classeur-print-os";
let observer = null;
let initialized = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[char]));
}

function readRow(row) {
  const strong = row.querySelector("strong");
  const spans = [...row.querySelectorAll("span")].map((node) => node.textContent.trim()).filter(Boolean);
  const number = strong?.textContent?.trim() || "OS";
  const address = spans[0] || "";
  const materialLine = spans[1] || "";
  const team = spans.find((value) => value.toLowerCase().startsWith("équipe")) || spans.find((value) => value.includes("Équipe")) || "";
  const status = row.querySelector(".setom-status-chip")?.textContent?.trim() || spans.find((value) => /^(Nouveau|Planifié|Travaux|À vérifier|Validé|Réserve|Payé|Archivé)/i.test(value)) || "";
  const surfaceMatch = materialLine.match(/([0-9]+(?:[.,][0-9]+)?)\s*m²/i);
  return {
    number,
    address,
    material: materialLine.replace(/\s*·\s*[0-9]+(?:[.,][0-9]+)?\s*m²/i, "").trim(),
    surface: surfaceMatch ? surfaceMatch[1].replace(",", ".") : "",
    team: team.replace(/^Équipe\s*:\s*/i, "").trim(),
    status
  };
}

async function loadExtraData(osNumber) {
  const numeric = String(osNumber).match(/(\d{1,})$/)?.[1];
  if (!numeric) return {};
  const { data, error } = await supabase
    .from("work_orders")
    .select("os_number, creation_date, deadline_date, material_detail, planned_surface_m2, planned_road_surface_m2, planned_sidewalk_surface_m2, particularities, is_night, rehabilitation_zone")
    .eq("os_number", Number(numeric))
    .maybeSingle();
  if (error || !data) return {};
  return data;
}

function printHtml(rowData, extra, dateLabel) {
  const surface = extra.planned_surface_m2 ?? rowData.surface;
  const road = extra.planned_road_surface_m2;
  const sidewalk = extra.planned_sidewalk_surface_m2;
  const surfaceDetails = [
    road != null && Number(road) > 0 ? `Chaussée : ${road} m²` : "",
    sidewalk != null && Number(sidewalk) > 0 ? `Trottoir : ${sidewalk} m²` : ""
  ].filter(Boolean).join(" · ");
  const night = extra.is_night ? "Travaux de nuit" : "Travaux de jour";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fiche ${esc(rowData.number)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#17202a;font-family:Arial,Helvetica,sans-serif}.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:12mm}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #17202a;padding-bottom:8mm}.brand{font-size:22px;font-weight:800}.title{font-size:25px;font-weight:800;margin-top:5px}.meta{text-align:right;font-size:12px;color:#475467}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8mm}.card{border:1px solid #cfd5dd;border-radius:8px;padding:10px;min-height:58px}.label{font-size:10px;text-transform:uppercase;color:#667085;font-weight:700;letter-spacing:.04em}.value{font-size:15px;font-weight:700;margin-top:5px}.wide{grid-column:1/-1}.section{margin-top:7mm}.section h2{font-size:14px;margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #d0d5dd}.lines{border:1px solid #cfd5dd;border-radius:8px;overflow:hidden}.line{min-height:32px;border-bottom:1px solid #e5e7eb;padding:7px}.line:last-child{border-bottom:0}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.photo{height:58mm;border:1px dashed #98a2b3;border-radius:8px;padding:8px;color:#98a2b3;font-size:11px}.checks{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:12px}.check{border:1px solid #d0d5dd;border-radius:7px;padding:8px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:12px}.signbox{height:30mm;border:1px solid #cfd5dd;border-radius:8px;padding:8px;font-size:10px;color:#667085}.footer{margin-top:7mm;font-size:9px;color:#667085;display:flex;justify-content:space-between}@media print{body{background:#fff}.sheet{margin:0;width:210mm;min-height:297mm}button{display:none}}@page{size:A4;margin:0}
</style></head><body><main class="sheet">
<div class="top"><div><div class="brand">SETOM</div><div class="title">Fiche d'intervention — ${esc(rowData.number)}</div></div><div class="meta">Classeur du ${esc(dateLabel)}<br>${esc(night)}</div></div>
<div class="grid"><div class="card wide"><div class="label">Adresse</div><div class="value">${esc(rowData.address)}</div></div>
<div class="card"><div class="label">Matériau / travaux</div><div class="value">${esc(extra.material_detail || rowData.material || "—")}</div></div>
<div class="card"><div class="label">Surface prévue</div><div class="value">${esc(surface != null && surface !== "" ? `${surface} m²` : "—")}</div></div>
<div class="card"><div class="label">Équipe</div><div class="value">${esc(rowData.team || "À affecter")}</div></div>
<div class="card"><div class="label">Statut</div><div class="value">${esc(rowData.status || "—")}</div></div>
<div class="card"><div class="label">Échéance</div><div class="value">${esc(extra.deadline_date || "—")}</div></div>
${surfaceDetails ? `<div class="card wide"><div class="label">Détail des surfaces</div><div class="value">${esc(surfaceDetails)}</div></div>` : ""}
${extra.rehabilitation_zone ? `<div class="card"><div class="label">Zone de réfection</div><div class="value">${esc(extra.rehabilitation_zone)}</div></div>` : ""}
</div>
<div class="section"><h2>Travaux à réaliser / consignes</h2><div class="lines"><div class="line">${esc(extra.particularities || "Consignes et particularités : à compléter sur chantier.")}</div><div class="line">Observations : __________________________________________________________________________________</div><div class="line">__________________________________________________________________________________________________</div></div></div>
<div class="section"><h2>Mesures réelles</h2><div class="grid" style="margin-top:0"><div class="card"><div class="label">Surface chaussée réelle</div><div class="value">__________ m²</div></div><div class="card"><div class="label">Surface trottoir réelle</div><div class="value">__________ m²</div></div><div class="card"><div class="label">Épaisseur</div><div class="value">__________ cm</div></div><div class="card"><div class="label">Quantité / unité complémentaire</div><div class="value">________________</div></div></div></div>
<div class="section"><h2>Photos chantier</h2><div class="photo-grid"><div class="photo">PHOTO AVANT / OS</div><div class="photo">PHOTO APRÈS / TRAVAUX RÉALISÉS</div></div></div>
<div class="section"><h2>Contrôle de fin d'intervention</h2><div class="checks"><div class="check">☐ Travaux conformes</div><div class="check">☐ Nettoyage effectué</div><div class="check">☐ Signalisation retirée</div><div class="check">☐ Photos transmises</div><div class="check">☐ Mesures réelles renseignées</div><div class="check">☐ Réserve / anomalie signalée</div></div></div>
<div class="section"><h2>Signatures / observations</h2><div class="sign"><div class="signbox">Chef d'équipe / intervenant<br><br>Signature :</div><div class="signbox">Contrôle / validation<br><br>Signature :</div></div></div>
<div class="footer"><span>Document opérationnel SETOM</span><span>${esc(rowData.number)}</span></div>
</main><script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`;
}

async function printRow(row) {
  const data = readRow(row);
  const dateLabel = document.querySelector(".setom-binder-head span")?.textContent?.trim() || new Date().toLocaleDateString("fr-FR");
  const extra = await loadExtraData(data.number);
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
  if (!win) { alert("La fenêtre d'impression a été bloquée par le navigateur. Autorisez les fenêtres contextuelles pour SETOM."); return; }
  win.document.open();
  win.document.write(printHtml(data, extra, dateLabel));
  win.document.close();
}

function addButtons() {
  document.querySelectorAll(".setom-binder-card").forEach((row) => {
    if (row.querySelector(`.${BUTTON_CLASS}`)) return;
    const actions = row.querySelector(".setom-binder-actions");
    if (!actions) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "🖨️ Fiche";
    button.title = "Imprimer la fiche OS";
    button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); printRow(row); });
    actions.appendChild(button);
  });

  document.querySelectorAll(".setom-week-binder-row").forEach((row) => {
    if (row.querySelector(`.${BUTTON_CLASS}`)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "🖨️";
    button.title = "Imprimer la fiche OS";
    button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); printRow(row); });
    row.appendChild(button);
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${BUTTON_CLASS}{border:1px solid #d0d5dd!important;background:#fff!important;color:#344054!important;border-radius:8px!important;padding:6px 9px!important;font-weight:700!important;cursor:pointer!important;font-size:12px!important;white-space:nowrap!important}
    .${BUTTON_CLASS}:hover{background:#f8fafc!important;border-color:#98a2b3!important}
    .setom-week-binder-row .${BUTTON_CLASS}{margin-left:auto;flex:0 0 auto}
    @media(max-width:700px){.setom-binder-actions{display:flex!important;flex-wrap:wrap;gap:5px}.setom-week-binder-row .${BUTTON_CLASS}{margin-left:0}}
  `;
  document.head.appendChild(style);
}

function install() {
  if (initialized) return;
  initialized = true;
  injectStyles();
  observer = new MutationObserver(() => addButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(addButtons, 500);
}

install();
