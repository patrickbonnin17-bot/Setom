import { supabase } from "./supabase";

const STYLE_ID = "setom-os-photo-visual-style";
const CACHE = new Map();
let scheduled = false;

function getOsNumber(node) {
  const explicit = node.querySelector?.(".os-number, .setom-os-number, [data-os-number]")?.textContent || node.getAttribute?.("data-os-number") || "";
  const text = `${explicit} ${node.textContent || ""}`;
  const match = text.match(/OS(?:[-\s]\d{4})?[-\s]?(\d{1,6})/i);
  return match ? Number(match[1]) : null;
}

function addStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .setom-photo-thumb{width:78px!important;height:60px!important;flex:0 0 78px!important;object-fit:cover!important;border-radius:9px!important;background:#eef1f5!important;border:1px solid #e1e5ea!important;display:block!important}
    .setom-photo-thumb-wrap{width:78px;min-width:78px;height:60px;position:relative;overflow:hidden;border-radius:9px;flex:0 0 78px}
    .setom-photo-thumb-wrap.is-empty{display:flex;align-items:center;justify-content:center;background:#eef1f5;color:#98a2b3;font-size:20px}
    .setom-photo-thumb-wrap img{width:100%;height:100%;object-fit:cover;display:block}
    .setom-photo-count{position:absolute;right:4px;bottom:4px;padding:2px 5px;border-radius:8px;background:rgba(17,24,39,.78);color:#fff;font-size:10px;font-weight:700;line-height:1}
    .os.setom-photo-ready{display:flex!important;align-items:flex-start!important;gap:12px!important}
    .os.setom-photo-ready > .setom-os-content{min-width:0;flex:1}
    .planning-os.setom-photo-ready{display:flex!important;align-items:flex-start!important;gap:10px!important}
    .planning-os.setom-photo-ready > .setom-os-content{min-width:0;flex:1}
    .setom-photo-fallback{font-size:22px;line-height:1}
    @media(max-width:700px){.setom-photo-thumb,.setom-photo-thumb-wrap{width:68px!important;min-width:68px!important;height:54px!important}.os.setom-photo-ready{gap:9px!important}.planning-os.setom-photo-ready{gap:8px!important}}
  `;
  document.head.appendChild(style);
}

async function getPhotos(osNumber) {
  if (!osNumber) return [];
  if (CACHE.has(osNumber)) return CACHE.get(osNumber);
  const promise = (async () => {
    const { data: order } = await supabase.from("work_orders").select("id").eq("os_number", osNumber).maybeSingle();
    if (!order?.id) return [];
    const { data: attachments, error } = await supabase
      .from("attachments")
      .select("id, category, storage_path, mime_type, created_at")
      .eq("work_order_id", order.id)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: false });
    if (error || !attachments?.length) return [];
    const rows = [];
    for (const item of attachments.slice(0, 6)) {
      if (!item.storage_path) continue;
      const { data } = await supabase.storage.from("setom-files").createSignedUrl(item.storage_path, 3600);
      if (data?.signedUrl) rows.push({ ...item, url: data.signedUrl });
    }
    return rows;
  })();
  CACHE.set(osNumber, promise);
  return promise;
}

function ensureImage(node, photos) {
  if (!node || node.querySelector(".setom-photo-thumb-wrap")) return;
  const wrap = document.createElement("div");
  wrap.className = "setom-photo-thumb-wrap";
  if (!photos.length) {
    wrap.classList.add("is-empty");
    wrap.innerHTML = '<span class="setom-photo-fallback">📷</span>';
  } else {
    const img = document.createElement("img");
    img.className = "setom-photo-thumb";
    img.src = photos[0].url;
    img.alt = "Photo OS";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    wrap.appendChild(img);
    if (photos.length > 1) {
      const count = document.createElement("span");
      count.className = "setom-photo-count";
      count.textContent = `+${photos.length - 1}`;
      wrap.appendChild(count);
    }
  }
  const content = document.createElement("div");
  content.className = "setom-os-content";
  while (node.firstChild) content.appendChild(node.firstChild);
  node.appendChild(wrap);
  node.appendChild(content);
  node.classList.add("setom-photo-ready");
}

async function process(selector) {
  const nodes = [...document.querySelectorAll(selector)].filter((node) => !node.querySelector(".setom-photo-thumb-wrap"));
  if (!nodes.length) return;
  await Promise.all(nodes.map(async (node) => {
    const osNumber = getOsNumber(node);
    if (!osNumber) return;
    const photos = await getPhotos(osNumber);
    ensureImage(node, photos);
  }));
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(async () => {
    scheduled = false;
    try {
      addStyles();
      await process(".os");
      await process(".planning-os");
      await process(".setom-binder-card");
      await process(".setom-week-binder-row");
    } catch (error) {
      console.warn("SETOM photos visuelles :", error);
    }
  });
}

addStyles();
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
setTimeout(schedule, 700);
setInterval(schedule, 2500);
