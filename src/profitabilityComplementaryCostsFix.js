import { supabase } from "./supabase";

const PANEL = "setom-profitability-detail-panel";
const money = (v) => `${Number(v || 0).toFixed(2)} €`;
let lastKey = "";

async function apply() {
  const panel = document.getElementById(PANEL);
  if (!panel) return;

  const date = document.getElementById("pd-date")?.value;
  const content = document.getElementById("pd-content");
  if (!date || !content || content.textContent.includes("Impossible de calculer")) return;

  const tbody = content.querySelector(".tbl tbody");
  const key = `${date}|${tbody?.innerText || ""}`;
  if (key === lastKey) return;
  lastKey = key;

  try {
    const [{ data: orders, error: ordersError }, { data: costs, error: costsError }] = await Promise.all([
      supabase.from("work_orders").select("id,os_number"),
      supabase.from("work_order_costs").select("work_order_id,amount,category").eq("cost_date", date),
    ]);

    if (ordersError) throw ordersError;
    if (costsError) throw costsError;

    const orderByOs = new Map((orders || []).map((o) => [String(o.os_number), o.id]));
    const costByOrder = new Map();
    for (const row of costs || []) {
      costByOrder.set(row.work_order_id, (costByOrder.get(row.work_order_id) || 0) + Number(row.amount || 0));
    }

    let totalExtra = 0;
    for (const tr of content.querySelectorAll(".tbl tbody tr")) {
      const firstCell = tr.querySelector("td strong");
      const os = firstCell?.textContent?.match(/OS\s+(.+)/)?.[1]?.trim();
      if (!os) continue;

      const extra = costByOrder.get(orderByOs.get(os)) || 0;
      if (!extra) continue;
      totalExtra += extra;

      const cells = tr.querySelectorAll("td");
      if (cells.length < 7) continue;

      const totalCell = cells[5];
      const marginCell = cells[6];
      const parseMoney = (text) => Number(String(text || "").replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
      const currentTotal = parseMoney(totalCell.textContent);
      const currentMargin = parseMoney(marginCell.textContent);
      const hasRevenue = !marginCell.textContent?.trim().startsWith("—");
      const newTotal = currentTotal + extra;
      const newMargin = currentMargin - extra;

      totalCell.innerHTML = `${money(newTotal)}<div class="muted">+ ${money(extra)} coûts complémentaires</div>`;
      if (hasRevenue) {
        const revenue = currentTotal + currentMargin;
        const pct = revenue ? (newMargin / revenue) * 100 : 0;
        marginCell.innerHTML = `${money(newMargin)}<div>${pct.toFixed(1)} %</div>`;
        marginCell.className = newMargin < 0 ? "bad" : "good";
      }
    }

    const cards = content.querySelectorAll(".grid:first-child .card");
    if (cards.length >= 6 && totalExtra) {
      const totalCostCard = cards[4];
      const marginCard = cards[5];
      const parseCard = (card) => Number(String(card?.textContent || "").replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
      const baseCost = parseCard(totalCostCard);
      const baseMargin = parseCard(marginCard);
      totalCostCard.querySelector("strong").textContent = money(baseCost + totalExtra);
      marginCard.querySelector("strong").textContent = money(baseMargin - totalExtra);
      marginCard.querySelector("strong").className = baseMargin - totalExtra < 0 ? "bad" : "good";

      let extraCard = content.querySelector(".setom-extra-cost-card");
      if (!extraCard) {
        extraCard = document.createElement("div");
        extraCard.className = "card setom-extra-cost-card";
        extraCard.innerHTML = `<div class="muted">Coûts complémentaires</div><strong style="font-size:28px"></strong><div class="muted">Camion • carburant • matériel • autres</div>`;
        marginCard.after(extraCard);
      }
      extraCard.querySelector("strong").textContent = money(totalExtra);
    }

    if (totalExtra && !content.querySelector(".setom-extra-cost-note")) {
      const note = document.createElement("div");
      note.className = "card setom-extra-cost-note";
      note.style.margin = "14px 0";
      note.innerHTML = `<strong>Coûts complémentaires intégrés</strong><div class="muted" style="margin-top:5px">Les coûts saisis dans « Coûts / OS » sont automatiquement déduits de la marge de chaque OS.</div>`;
      content.querySelector(".tablewrap")?.before(note);
    }
  } catch (error) {
    console.warn("SETOM : intégration coûts complémentaires", error);
  }
}

const observer = new MutationObserver(() => setTimeout(apply, 80));
observer.observe(document.documentElement, { subtree: true, childList: true });
setInterval(apply, 1200);
setTimeout(apply, 1800);
