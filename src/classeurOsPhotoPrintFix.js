import { supabase } from "./supabase";

const STYLE_ID = "setom-photo-print-fix-style";

const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));

function osNumber(row) {
  const text = row.getAttribute("data-os-number") || row.textContent || "";
  const m = text.match(/OS(?:[-\s]\d{4})?[-\s]?(\d{1,6})/i);
  return m ? Number(m[1]) : null;
}

async function loadData(number) {
  if (!number) return null;
  const { data: order } = await supabase.from("work_orders").select("id, os_number, creation_date, deadline_date, address, city, material_detail, planned_surface_m2, planned_road_surface_m2, planned_sidewalk_surface_m2, particularities, is_night, rehabilitation_zone").eq("os_number", number).maybeSingle();
  if (!order) return null;
  const { data: attachments } = await supabase.from("attachments").select("id, category, storage_path, file_name, mime_type, created_at").eq("work_order_id", order.id).like("mime_type", "image/%").order("created_at", { ascending: true });
  const photos = { before: [], after: [] };
  for (const item of attachments || []) {
    if (!item.storage_path) continue;
    const { data } = await supabase.storage.from("setom-files").createSignedUrl(item.storage_path, 3600);
    if (!data?.signedUrl) continue;
    (item.category === "travaux_realises" ? photos.after : photos.before).push(data.signedUrl);
  }
  return { order, photos };
}

function photo(url, label) {
  return url ? `<div class="spp-photo"><span>${esc(label)}</span><img src="${esc(url)}" /></div>` : `<div class="spp-photo spp-empty"><span>${esc(label)}</span><b>Photo non disponible</b></div>`;
}

function html(data, row) {
  const o = data.order, p = data.photos;
  const no = `OS-${new Date(o.creation_date).getFullYear()}-${String(o.os_number).padStart(5,"0")}`;
  const address = [o.address, o.postal_code, o.city].filter(Boolean).join(" — ");
  const planned = o.planned_surface_m2 != null ? `${o.planned_surface_m2} m²` : "—";
  const surface = [o.planned_road_surface_m2 ? `Chaussée : ${o.planned_road_surface_m2} m²` : "", o.planned_sidewalk_surface_m2 ? `Trottoir : ${o.planned_sidewalk_surface_m2} m²` : ""].filter(Boolean).join(" · ");
  const allPhotos = [p.before[0], p.after[0], p.after[1], p.after[2]];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche ${esc(no)}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#17202a}.sheet{width:210mm;min-height:297mm;padding:11mm;margin:auto}.head{display:flex;justify-content:space-between;border-bottom:2px solid #17202a;padding-bottom:6mm}.brand{font-size:22px;font-weight:800}.title{font-size:24px;font-weight:800}.meta{text-align:right;font-size:11px;color:#667085}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:7mm}.card{border:1px solid #d0d5dd;border-radius:8px;padding:9px}.wide{grid-column:1/-1}.label{font-size:9px;text-transform:uppercase;color:#667085;font-weight:700}.value{font-size:14px;font-weight:700;margin-top:4px}.section{margin-top:6mm}.section h2{font-size:13px;border-bottom:1px solid #d0d5dd;padding-bottom:4px}.photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}.spp-photo{height:45mm;border:1px solid #d0d5dd;border-radius:8px;overflow:hidden;position:relative;background:#f6f7f9}.spp-photo img{width:100%;height:100%;object-fit:cover}.spp-photo span{position:absolute;z-index:2;top:5px;left:5px;background:rgba(17,24,39,.8);color:#fff;padding:3px 5px;border-radius:5px;font-size:9px;font-weight:700}.spp-empty{display:flex;align-items:center;justify-content:center;flex-direction:column;color:#98a2b3}.spp-empty b{font-size:10px;margin-top:4px}.checks{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px}.check{border:1px solid #d0d5dd;border-radius:6px;padding:7px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:8px}.signbox{height:25mm;border:1px solid #d0d5dd;border-radius:8px;padding:7px;font-size:10px;color:#667085}@page{size:A4;margin:0}@media print{.sheet{margin:0}}</style></head><body><main class="sheet"><div class="head"><div><div class="brand">SETOM</div><div class="title">Fiche d'intervention — ${esc(no)}</div></div><div class="meta">${o.is_night ? "Travaux de nuit" : "Travaux de jour"}<br>${new Date().toLocaleDateString("fr-FR")}</div></div><div class="grid"><div class="card wide"><div class="label">Adresse</div><div class="value">${esc(address)}</div></div><div class="card"><div class="label">Travaux / matériau</div><div class="value">${esc(o.material_detail || "—")}</div></div><div class="card"><div class="label">Surface prévue</div><div class="value">${esc(planned)}</div></div>${surface ? `<div class="card wide"><div class="label">Détail surfaces</div><div class="value">${esc(surface)}</div></div>` : ""}<div class="card"><div class="label">Échéance</div><div class="value">${esc(o.deadline_date || "—")}</div></div><div class="card"><div class="label">Zone de réfection</div><div class="value">${esc(o.rehabilitation_zone || "—")}</div></div></div><div class="section"><h2>Consignes / particularités</h2><div class="card">${esc(o.particularities || "À compléter sur chantier.")}</div></div><div class="section"><h2>Photos chantier</h2><div class="photos">${photo(allPhotos[0],"Photo avant / OS")}${photo(allPhotos[1],"Photo après / travaux")}${photo(allPhotos[2],"Photo travaux")}${photo(allPhotos[3],"Photo travaux")}</div></div><div class="section"><h2>Mesures réelles</h2><div class="grid" style="margin-top:0"><div class="card">Surface chaussée : __________ m²</div><div class="card">Surface trottoir : __________ m²</div><div class="card">Épaisseur : __________ cm</div><div class="card">Quantité complémentaire : __________</div></div></div><div class="section"><h2>Contrôle</h2><div class="checks"><div class="check">☐ Travaux conformes</div><div class="check">☐ Nettoyage effectué</div><div class="check">☐ Signalisation retirée</div><div class="check">☐ Photos transmises</div></div></div><div class="section"><h2>Signatures</h2><div class="sign"><div class="signbox">Chef d'équipe<br><br>Signature :</div><div class="signbox">Contrôle / validation<br><br>Signature :</div></div></div></main><script>window.onload=()=>setTimeout(()=>window.print(),500)</script></body></html>`;
}

async function printRow(row) {
  const number = osNumber(row);
  const data = await loadData(number);
  if (!data) { alert("Impossible de charger les données de l'OS pour la fiche."); return; }
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) { alert("Autorisez les fenêtres contextuelles pour imprimer la fiche OS."); return; }
  win.document.open(); win.document.write(html(data, row)); win.document.close();
}

function install() {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style"); style.id = STYLE_ID; style.textContent = ".setom-classeur-print-os{display:none!important}.setom-classeur-photo-print{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:6px 9px;font-weight:700;cursor:pointer;font-size:12px}.setom-classeur-photo-print:hover{background:#f8fafc}"; document.head.appendChild(style);
  }
  document.querySelectorAll(".setom-binder-card,.setom-week-binder-row").forEach((row) => {
    if (row.querySelector(".setom-classeur-photo-print")) return;
    const button = document.createElement("button"); button.type="button"; button.className="setom-classeur-photo-print"; button.textContent="🖨️ Fiche"; button.title="Imprimer la fiche avec les photos"; button.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation();printRow(row)});
    const actions = row.querySelector(".setom-binder-actions") || row; actions.appendChild(button);
  });
}

install();
new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
setInterval(install,1500);
