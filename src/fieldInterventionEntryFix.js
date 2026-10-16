import { supabase } from "./supabase";

const BUTTON_ID = "setom-real-start-intervention";
const STYLE_ID = "setom-real-start-intervention-style";
const HASH_PREFIX = "#setom-travaux-";

function getOSNumber(modal) {
  const text = modal?.textContent || "";
  const m = text.match(/OS[-\s]?(?:\d{4}[-\s]?)?(\d{3,8})/i);
  return m ? String(m[1]) : "";
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style"); s.id = STYLE_ID;
  s.textContent = `#${BUTTON_ID}{min-height:42px;padding:10px 16px;border:0;border-radius:10px;background:#1769e0;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(23,105,224,.2)}#${BUTTON_ID}[disabled]{opacity:.6;cursor:wait}`;
  document.head.appendChild(s);
}

async function start(osNumber) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error("Connexion requise pour démarrer l’intervention.");
  const { data: wo, error: woError } = await supabase.from("work_orders").select("id,status,os_number,planned_surface_m2").eq("os_number", Number(osNumber)).maybeSingle();
  if (woError) throw woError;
  if (!wo) throw new Error(`OS ${osNumber} introuvable.`);
  const { data: existing, error: readError } = await supabase.from("interventions").select("id,status,planned_date,planned_surface_m2,arrival_time").eq("work_order_id", wo.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (readError) throw readError;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  let interventionId = existing?.id || null;
  if (existing?.id) {
    const { error } = await supabase.from("interventions").update({ status: "En cours", planned_date: existing.planned_date || date, planned_surface_m2: existing.planned_surface_m2 ?? wo.planned_surface_m2 ?? null, arrival_time: existing.arrival_time || time }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { data: newRow, error } = await supabase.from("interventions").insert({ work_order_id: wo.id, type: "Intervention", status: "En cours", planned_date: date, planned_surface_m2: wo.planned_surface_m2 ?? null, arrival_time: time }).select("id").single();
    if (error) throw error;
    interventionId = newRow.id;
  }
  const { error: updateError } = await supabase.from("work_orders").update({ status: "En cours", updated_by: userData.user.id }).eq("id", wo.id);
  if (updateError) throw updateError;
  localStorage.setItem("setom:travaux-entry", JSON.stringify({ osNumber: String(osNumber), workOrderId: wo.id, interventionId, at: Date.now() }));
  window.location.hash = HASH_PREFIX + encodeURIComponent(String(osNumber));
  window.location.reload();
}

function addButton(modal) {
  if (!modal || modal.querySelector(`#${BUTTON_ID}`)) return;
  const header = modal.querySelector(".modal-header");
  if (!header) return;
  const buttons = header.querySelector("div:last-child");
  if (!buttons) return;
  const existing = Array.from(header.querySelectorAll("button")).some(b => /démarrer l.?intervention|continuer les travaux/i.test(b.textContent || ""));
  if (existing) return;
  const osNumber = getOSNumber(modal);
  if (!osNumber) return;
  installStyle();
  const b = document.createElement("button");
  b.id = BUTTON_ID;
  b.type = "button";
  b.textContent = "▶ DÉMARRER L’INTERVENTION";
  b.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    b.disabled = true;
    b.textContent = "Démarrage…";
    try {
      await start(osNumber);
    } catch (err) {
      b.disabled = false;
      b.textContent = "▶ DÉMARRER L’INTERVENTION";
      alert(err?.message || "Impossible de démarrer l’intervention.");
    }
  });
  buttons.insertBefore(b, buttons.firstChild);
}

function handleEntry() {
  const raw = localStorage.getItem("setom:travaux-entry");
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch { return; }
  if (!data?.osNumber) return;
  if (Date.now() - Number(data.at || 0) > 120000) { localStorage.removeItem("setom:travaux-entry"); return; }
  if (location.hash !== HASH_PREFIX + encodeURIComponent(String(data.osNumber))) return;
  localStorage.removeItem("setom:travaux-entry");
  const nav = Array.from(document.querySelectorAll("nav button")).find(b => /Travaux/.test(b.textContent || ""));
  if (nav) nav.click();
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const cards = Array.from(document.querySelectorAll(".os-list .os"));
    const card = cards.find(c => (c.textContent || "").includes(String(data.osNumber)));
    if (card) {
      const btn = Array.from(card.querySelectorAll("button")).find(b => /ouvrir l.?os|continuer les travaux|démarrer l.?intervention/i.test(b.textContent || ""));
      if (btn) { btn.click(); clearInterval(timer); history.replaceState(null, "", location.pathname + location.search); }
    }
    if (tries > 30) clearInterval(timer);
  }, 150);
}

function boot() {
  if (window.__setomEntryFixBooted) return;
  window.__setomEntryFixBooted = true;
  const run = () => {
    const modal = document.querySelector(".os-detail-modal");
    if (modal) addButton(modal);
    handleEntry();
  };
  const observer = new MutationObserver(() => requestAnimationFrame(run));
  observer.observe(document.body, { childList: true, subtree: true });
  run();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
