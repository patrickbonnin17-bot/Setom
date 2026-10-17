import { supabase } from "./supabase";

function parseOSNumber(text) {
  const match = String(text || "").match(/OS-\d{4}-(\d+)/i);
  return match ? Number(match[1]) : null;
}

function findWorkOrderId() {
  const heading = Array.from(document.querySelectorAll("h1,h2,h3")).find((node) => /OS-\d{4}-\d+/i.test(node.textContent || ""));
  return parseOSNumber(heading?.textContent);
}

function showQualityModal({ errors = [], warnings = [], totalAmount = null, lineCount = null }) {
  const old = document.getElementById("setom-constat-quality-modal");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "setom-constat-quality-modal";
  overlay.innerHTML = `
    <div class="setom-quality-backdrop"></div>
    <div class="setom-quality-card" role="dialog" aria-modal="true">
      <div class="setom-quality-head"><div><div class="setom-quality-kicker">SETOM · CONTRÔLE</div><h2>Vérification du constat</h2><p>Le constat automatique doit être contrôlé avant sa validation.</p></div><button type="button" class="setom-quality-close">×</button></div>
      <div class="setom-quality-summary"><div><span>Lignes</span><strong>${lineCount ?? "—"}</strong></div><div><span>Total</span><strong>${totalAmount == null ? "—" : Number(totalAmount).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"}</strong></div><div><span>Contrôle</span><strong>${errors.length ? "À corriger" : warnings.length ? "À confirmer" : "OK"}</strong></div></div>
      ${errors.length ? `<section class="setom-quality-section setom-quality-error"><h3>⚠ Contrôles bloquants</h3><ul>${errors.map((item) => `<li>${item}</li>`).join("")}</ul></section>` : ""}
      ${warnings.length ? `<section class="setom-quality-section setom-quality-warning"><h3>Attention</h3><ul>${warnings.map((item) => `<li>${item}</li>`).join("")}</ul></section>` : ""}
      ${!errors.length && !warnings.length ? `<section class="setom-quality-section setom-quality-success"><h3>✓ Constat conforme</h3><p>Les lignes, quantités, BPU et montant sont cohérents. Vous pouvez poursuivre la validation.</p></section>` : ""}
      <div class="setom-quality-actions"><button type="button" class="setom-quality-cancel">${errors.length ? "Fermer" : "Annuler"}</button>${!errors.length ? `<button type="button" class="setom-quality-confirm">Valider le constat</button>` : ""}</div>
    </div>`;
  const style = document.createElement("style");
  style.id = "setom-constat-quality-style";
  style.textContent = `#setom-constat-quality-modal{position:fixed;inset:0;z-index:99999;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.setom-quality-backdrop{position:absolute;inset:0;background:rgba(8,24,52,.48);backdrop-filter:blur(3px)}.setom-quality-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(620px,calc(100vw - 28px));max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(8,24,52,.28);border:1px solid #dfe7f2}.setom-quality-head{display:flex;justify-content:space-between;gap:18px;padding:24px 26px 18px;background:linear-gradient(135deg,#0b2348,#1466c3);color:#fff;border-radius:20px 20px 0 0}.setom-quality-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;opacity:.78;margin-bottom:5px}.setom-quality-head h2{margin:0;font-size:23px}.setom-quality-head p{margin:6px 0 0;font-size:13px;opacity:.86}.setom-quality-close{border:0;background:rgba(255,255,255,.13);color:#fff;width:34px;height:34px;border-radius:10px;font-size:24px;cursor:pointer}.setom-quality-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 22px 4px}.setom-quality-summary div{padding:12px 14px;border:1px solid #e4eaf2;border-radius:12px;background:#f8fafc}.setom-quality-summary span{display:block;color:#6b7890;font-size:11px}.setom-quality-summary strong{display:block;margin-top:4px;color:#10274b;font-size:17px}.setom-quality-section{margin:14px 22px 0;padding:14px 16px;border-radius:13px}.setom-quality-section h3{margin:0 0 8px;font-size:14px}.setom-quality-section p{margin:0;font-size:13px;line-height:1.45}.setom-quality-section ul{margin:0;padding-left:20px;font-size:13px;line-height:1.55}.setom-quality-error{background:#fff1f1;border:1px solid #f2c3c3;color:#9e1c1c}.setom-quality-warning{background:#fff8e8;border:1px solid #f2d48b;color:#7b5700}.setom-quality-success{background:#edf9f1;border:1px solid #b9e2c4;color:#176b32}.setom-quality-actions{display:flex;justify-content:flex-end;gap:10px;padding:20px 22px 22px}.setom-quality-actions button{border:0;border-radius:11px;padding:11px 17px;font-weight:700;cursor:pointer}.setom-quality-cancel{background:#edf1f6;color:#263953}.setom-quality-confirm{background:#1168d7;color:#fff;box-shadow:0 6px 16px rgba(17,104,215,.22)}@media(max-width:600px){.setom-quality-summary{grid-template-columns:1fr}.setom-quality-head{padding:20px}.setom-quality-card{max-height:calc(100vh - 20px)}.setom-quality-actions{position:sticky;bottom:0;background:#fff}.setom-quality-confirm,.setom-quality-cancel{flex:1}}`;
  document.head.appendChild(style); document.body.appendChild(overlay);
  const close = () => { overlay.remove(); style.remove(); };
  overlay.querySelector(".setom-quality-close")?.addEventListener("click", close);
  overlay.querySelector(".setom-quality-backdrop")?.addEventListener("click", close);
  overlay.querySelector(".setom-quality-cancel")?.addEventListener("click", close);
  return { waitForConfirm: () => new Promise((resolve) => { overlay.querySelector(".setom-quality-confirm")?.addEventListener("click", () => { close(); resolve(true); }); if (errors.length) resolve(false); }) };
}

async function validateConstatFromPatch(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Contrôle...";
  try {
    const osNumber = findWorkOrderId();
    if (!osNumber) throw new Error("Impossible d'identifier l'OS à valider.");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Connexion requise pour valider le constat.");
    const { data: workOrder, error: workOrderError } = await supabase.from("work_orders").select("id,status").eq("os_number", osNumber).maybeSingle();
    if (workOrderError) throw workOrderError;
    if (!workOrder) throw new Error("OS introuvable dans la base de données.");
    const { data: constat, error: constatError } = await supabase.from("constats").select("id,status,total_amount").eq("work_order_id", workOrder.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (constatError) throw constatError;
    if (!constat) throw new Error("Constat introuvable pour cet OS.");

    // A Brouillon can now enter the quality-control/validation flow.
    // The database RPC remains the final authority on whether validation is allowed.
    if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }

    const { data: quality, error: qualityError } = await supabase.rpc("check_constat_before_validation", { p_work_order_id: workOrder.id, p_constat_id: constat.id });
    if (qualityError) throw qualityError;
    const errors = Array.isArray(quality?.errors) ? quality.errors : [];
    const warnings = Array.isArray(quality?.warnings) ? quality.warnings : [];
    const modal = showQualityModal({ errors, warnings, totalAmount: quality?.total_amount ?? constat.total_amount, lineCount: quality?.line_count ?? null });
    const confirmed = await modal.waitForConfirm();
    if (!confirmed) return;
    button.textContent = "Validation...";
    const { data, error } = await supabase.rpc("validate_constat_for_work_order", { p_work_order_id: workOrder.id, p_constat_id: constat.id, p_user_id: userData.user.id });
    if (error) throw error;
    if (data?.constat_status !== "Validé") throw new Error("La validation du constat n'a pas été confirmée par la base de données.");
    window.location.reload();
  } catch (error) {
    console.error("Erreur validation du constat :", error);
    alert("Impossible de valider le constat :\n\n" + (error?.message || "Erreur inconnue"));
    button.disabled = false; button.textContent = originalText;
  }
}

function installConstatValidationPatch() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target) return;
    const label = (target.textContent || "").replace(/\s+/g, " ").trim();
    if (!label.includes("Valider le constat")) return;
    event.preventDefault(); event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    void validateConstatFromPatch(target);
  }, true);
}
installConstatValidationPatch();
