import { supabase } from "./supabase";

let validating = false;

function findValidationButton(target) {
  const button = target?.closest?.("button");
  if (!button) return null;
  const text = (button.textContent || "").trim().replace(/\s+/g, " ");
  return text.includes("Valider le constat") ? button : null;
}

async function validateFromModal(button) {
  if (validating) return;
  validating = true;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Validation...";

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) throw new Error("Connexion requise pour valider le constat.");

    const header = document.querySelector(".os-detail-modal .modal-header h2");
    const osLabel = (header?.textContent || "").trim();
    const match = osLabel.match(/OS-\d{4}-(\d+)/i);
    if (!match) throw new Error("Impossible d'identifier l'OS ouvert.");

    const osNumber = Number(match[1]);
    const { data: order, error: orderError } = await supabase
      .from("work_orders")
      .select("id, os_number, status")
      .eq("os_number", osNumber)
      .single();
    if (orderError || !order) throw orderError || new Error("OS introuvable.");

    const { data: constatPayload, error: constatError } = await supabase.rpc("get_constat_for_work_order", {
      p_work_order_id: order.id,
    });
    if (constatError) throw constatError;

    const constat = constatPayload?.constat;
    if (!constat?.id) throw new Error("Aucun constat de facturation n'est associé à cet OS.");
    if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status || "Brouillon")) {
      throw new Error(`Le constat ne peut plus être validé (statut : ${constat.status || "inconnu"}).`);
    }

    if (!window.confirm("Valider ce constat de facturation ? L'OS passera automatiquement à « Travaux effectués ».")) {
      button.disabled = false;
      button.textContent = originalText;
      validating = false;
      return;
    }

    const { data: result, error: validationError } = await supabase.rpc("validate_constat_for_work_order", {
      p_work_order_id: order.id,
      p_constat_id: constat.id,
      p_user_id: user.id,
    });
    if (validationError) throw validationError;

    if (result?.constat_status !== "Validé") {
      throw new Error("La validation n'a pas été confirmée par la base de données.");
    }

    window.location.reload();
  } catch (error) {
    console.error("Erreur validation constat (correctif interface) :", error);
    alert("Impossible de valider le constat :\n\n" + (error?.message || "Erreur inconnue"));
    button.disabled = false;
    button.textContent = originalText;
    validating = false;
  }
}

document.addEventListener("click", (event) => {
  const button = findValidationButton(event.target);
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void validateFromModal(button);
}, true);
