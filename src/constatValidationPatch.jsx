import { supabase } from "./supabase";

function parseOSNumber(text) {
  const match = String(text || "").match(/OS-\d{4}-(\d+)/i);
  return match ? Number(match[1]) : null;
}

function findWorkOrderId() {
  const heading = Array.from(document.querySelectorAll("h1,h2,h3")).find((node) => /OS-\d{4}-\d+/i.test(node.textContent || ""));
  const osNumber = parseOSNumber(heading?.textContent);
  return osNumber;
}

async function validateConstatFromPatch(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Validation...";
  try {
    const osNumber = findWorkOrderId();
    if (!osNumber) throw new Error("Impossible d'identifier l'OS à valider.");

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Connexion requise pour valider le constat.");

    const { data: workOrder, error: workOrderError } = await supabase
      .from("work_orders")
      .select("id,status")
      .eq("os_number", osNumber)
      .maybeSingle();
    if (workOrderError) throw workOrderError;
    if (!workOrder) throw new Error("OS introuvable dans la base de données.");

    const { data: constat, error: constatError } = await supabase
      .from("constats")
      .select("id,status")
      .eq("work_order_id", workOrder.id)
      .maybeSingle();
    if (constatError) throw constatError;
    if (!constat) throw new Error("Constat introuvable pour cet OS.");

    if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status || "Brouillon")) {
      throw new Error(`Le constat ne peut plus être validé (statut : ${constat.status || "inconnu"}).`);
    }

    const confirmed = window.confirm("Valider ce constat de facturation ? L'OS passera automatiquement à « Travaux effectués ».");
    if (!confirmed) return;

    const { data, error } = await supabase.rpc("validate_constat_for_work_order", {
      p_work_order_id: workOrder.id,
      p_constat_id: constat.id,
      p_user_id: userData.user.id,
    });
    if (error) throw error;

    if (data?.constat_status !== "Validé") {
      throw new Error("La validation du constat n'a pas été confirmée par la base de données.");
    }

    window.location.reload();
  } catch (error) {
    console.error("Erreur validation du constat :", error);
    alert("Impossible de valider le constat :\n\n" + (error?.message || "Erreur inconnue"));
    button.disabled = false;
    button.textContent = originalText;
  }
}

function installConstatValidationPatch() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target) return;
    const label = (target.textContent || "").replace(/\s+/g, " ").trim();
    if (!label.includes("Valider le constat")) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    void validateConstatFromPatch(target);
  }, true);
}

installConstatValidationPatch();
