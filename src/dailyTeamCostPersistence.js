import { supabase } from "./supabase";

const ID = "setom-daily-team-costs";
const KEY = "setom-daily-team-costs-v1";
const CATS = ["personnel", "vehicules", "materiaux", "materiel", "carburant", "autres"];
const DB_FIELDS = {
  personnel: "personnel_amount",
  vehicules: "vehicles_amount",
  materiaux: "materials_amount",
  materiel: "equipment_amount",
  carburant: "fuel_amount",
  autres: "other_amount"
};
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const dateOf = () => String(document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input")?.value || new Date().toISOString().slice(0, 10)).slice(0, 10);
const field = (key) => document.querySelector(`#${ID} [data-cat="${key}"]`);

function localRead(date) {
  try { return JSON.parse(localStorage.getItem(`${KEY}:${date}`) || "null"); } catch { return null; }
}
function localWrite(date, data) {
  try { localStorage.setItem(`${KEY}:${date}`, JSON.stringify(data)); } catch {}
}

async function readDb(date) {
  const r = await supabase.from("daily_team_costs").select("*").eq("cost_date", date).is("team_id", null).order("created_at", { ascending: false }).limit(1);
  if (r.error) return null;
  return r.data?.[0] || null;
}

async function fill(date) {
  const box = document.getElementById(ID);
  if (!box) return;
  const db = await readDb(date);
  const saved = db || localRead(date);
  if (!saved) return;
  for (const key of CATS) {
    const input = field(key);
    const dbKey = DB_FIELDS[key];
    if (input && saved[dbKey] != null) input.value = saved[dbKey];
  }
  box.dispatchEvent(new Event("input", { bubbles: true }));
  box.querySelectorAll("input").forEach(input => input.dispatchEvent(new Event("input", { bubbles: true })));
}

async function save(date) {
  const box = document.getElementById(ID);
  if (!box) return;
  const data = {};
  for (const key of CATS) data[DB_FIELDS[key]] = n(field(key)?.value);
  const hours = [...box.querySelectorAll("[data-hours]")].reduce((s, e) => s + n(e.value), 0);
  data.hours = hours;
  data.cost_date = date;
  data.team_id = null;
  localWrite(date, data);

  const existing = await readDb(date);
  if (existing?.id) {
    const r = await supabase.from("daily_team_costs").update({ ...data, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (r.error) throw r.error;
  } else {
    const r = await supabase.from("daily_team_costs").insert(data);
    if (r.error) throw r.error;
  }
}

function ensure() {
  const box = document.getElementById(ID);
  if (!box || box.dataset.persistenceReady === "1") return;
  box.dataset.persistenceReady = "1";
  const actions = box.querySelector("[data-action=save]")?.parentElement;
  if (!actions) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dt-save";
  button.style.marginRight = "8px";
  button.textContent = "💾 Sauvegarder la journée";
  actions.prepend(button);
  const date = dateOf();
  fill(date);
  button.onclick = async () => {
    const msg = box.querySelector("[data-msg]");
    try {
      await save(date);
      if (msg) { msg.className = "dt-msg"; msg.textContent = "✓ Coût journalier sauvegardé. Il sera conservé pour cette date."; }
    } catch (e) {
      if (msg) { msg.className = "dt-sub dt-warn"; msg.textContent = `⚠ Sauvegarde locale effectuée, Supabase indisponible : ${e.message || e}`; }
    }
  };
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(ensure, 250); }
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
setTimeout(ensure, 1200);
window.addEventListener("setom:planning-refresh", schedule);
