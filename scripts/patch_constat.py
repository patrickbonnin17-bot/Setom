from pathlib import Path

p = Path('src/main.jsx')
s = p.read_text(encoding='utf-8')

# 1) Keep the secure constat reader/generator behaviour.
start = s.find('useEffect(() => {\n  if (!os?.dbId) return;\n  let cancelled = false;\n\n  async function loadConstat()')
if start == -1:
    raise SystemExit('Constat loading effect start not found')
end_marker = '}, [os?.dbId, os?.status]);'
end = s.find(end_marker, start)
if end == -1:
    raise SystemExit('Constat loading effect end not found')
end += len(end_marker)
replacement = '''useEffect(() => {
  if (!os?.dbId) return;
  let cancelled = false;

  async function loadConstat() {
    setConstatLoading(true);
    const { data: payload, error: readError } = await supabase.rpc(
      "get_constat_for_work_order",
      { p_work_order_id: os.dbId }
    );

    if (readError) {
      console.error("Erreur lecture constat :", readError);
      if (!cancelled) {
        setConstat(null);
        setConstatLines([]);
        setConstatLoading(false);
      }
      return;
    }

    let constatData = payload?.constat || null;
    let linesData = payload?.lines || [];

    if (!constatData && os.status === "Travaux effectués") {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const { error: rpcError } = await supabase.rpc(
        "generate_constat_for_work_order",
        { p_work_order_id: os.dbId, p_user_id: userId }
      );
      if (!rpcError) {
        const { data: refreshed, error: refreshError } = await supabase.rpc(
          "get_constat_for_work_order",
          { p_work_order_id: os.dbId }
        );
        if (!refreshError) {
          constatData = refreshed?.constat || null;
          linesData = refreshed?.lines || [];
        }
      } else {
        console.error("Erreur génération constat automatique :", rpcError);
      }
    }

    if (!cancelled) {
      setConstat(constatData);
      setConstatLines(linesData);
      setConstatLoading(false);
    }
  }

  loadConstat();
  return () => { cancelled = true; };
}, [os?.dbId, os?.status]);'''
s = s[:start] + replacement + s[end:]

# 2) Add manual editing state.
needle = 'const [constatLoading, setConstatLoading] = useState(false);'
if needle not in s:
    raise SystemExit('Constat state needle not found')
state_add = '''const [constatLoading, setConstatLoading] = useState(false);
const [constatEditMode, setConstatEditMode] = useState(false);
const [editableConstatLines, setEditableConstatLines] = useState([]);
const [constatEditObservations, setConstatEditObservations] = useState("");
const [constatSaving, setConstatSaving] = useState(false);'''
s = s.replace(needle, state_add, 1)

# 3) Add manual editing helpers immediately before the tabs declaration.
tabs_needle = '  const tabs = [\n'
if tabs_needle not in s:
    raise SystemExit('Tabs declaration not found')
helpers = '''  const constatLocked = ["Validé", "Validé avec réserve", "Payé", "Archivé"].includes(constat?.status);

  function startConstatEdit() {
    if (!constat || constatLocked) return;
    setEditableConstatLines((constatLines || []).map((line) => ({
      id: line.id,
      bpu_line_id: line.bpu_line_id || "",
      designation: line.designation || "",
      quantity: line.quantity ?? 0,
      unit: line.unit || "",
      unit_price: line.unit_price ?? 0,
      amount: line.amount ?? 0,
      thickness_cm: line.thickness_cm ?? "",
      observations: line.observations || "",
      actual_quantity: line.actual_quantity ?? "",
      billing_coefficient: line.billing_coefficient ?? "",
      reference_thickness_cm: line.reference_thickness_cm ?? "",
      actual_thickness_cm: line.actual_thickness_cm ?? "",
    })));
    setConstatEditObservations(constat.observations || "");
    setConstatEditMode(true);
  }

  function updateEditableConstatLine(index, field, value) {
    setEditableConstatLines((current) => current.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        const q = Number(next.quantity) || 0;
        const p = Number(next.unit_price) || 0;
        next.amount = (q * p).toFixed(2);
      }
      return next;
    }));
  }

  function addEditableConstatLine() {
    setEditableConstatLines((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        bpu_line_id: "",
        designation: "",
        quantity: 0,
        unit: "",
        unit_price: 0,
        amount: 0,
        thickness_cm: "",
        observations: "",
        actual_quantity: "",
        billing_coefficient: "",
        reference_thickness_cm: "",
        actual_thickness_cm: "",
      },
    ]);
  }

  function removeEditableConstatLine(index) {
    setEditableConstatLines((current) => current.filter((_, i) => i !== index));
  }

  async function saveConstatManual() {
    if (!constat || constatLocked) return;
    setConstatSaving(true);
    try {
      const cleanLines = editableConstatLines.map((line) => ({
        bpu_line_id: line.bpu_line_id || "",
        designation: String(line.designation || "").trim() || "Prestation",
        quantity: Number(line.quantity) || 0,
        unit: String(line.unit || "").trim(),
        unit_price: Number(line.unit_price) || 0,
        thickness_cm: line.thickness_cm === "" ? "" : Number(line.thickness_cm),
        observations: line.observations || "",
        actual_quantity: line.actual_quantity === "" ? "" : Number(line.actual_quantity),
        billing_coefficient: line.billing_coefficient === "" ? "" : Number(line.billing_coefficient),
        reference_thickness_cm: line.reference_thickness_cm === "" ? "" : Number(line.reference_thickness_cm),
        actual_thickness_cm: line.actual_thickness_cm === "" ? "" : Number(line.actual_thickness_cm),
      }));

      const { data, error } = await supabase.rpc("update_constat_manual", {
        p_work_order_id: os.dbId,
        p_constat_id: constat.id,
        p_observations: constatEditObservations || null,
        p_lines: cleanLines,
      });

      if (error) throw error;

      setConstat(data?.constat || null);
      setConstatLines(data?.lines || []);
      setConstatEditMode(false);
      alert("✅ Constat modifié manuellement.");
    } catch (error) {
      console.error("Erreur modification constat :", error);
      alert("Impossible d'enregistrer le constat :\\n\\n" + (error?.message || "Erreur inconnue"));
    } finally {
      setConstatSaving(false);
    }
  }

  async function regenerateConstatFromWorks() {
    if (!constat || constatLocked) return;
    if (!window.confirm("Recalculer le constat à partir des travaux réalisés ?\\n\\nLes modifications manuelles actuellement présentes dans le constat seront remplacées.")) return;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const { error } = await supabase.rpc("generate_constat_for_work_order", {
      p_work_order_id: os.dbId,
      p_user_id: userId,
    });
    if (error) {
      alert("Impossible de recalculer le constat :\\n\\n" + error.message);
      return;
    }
    const { data: refreshed, error: refreshError } = await supabase.rpc(
      "get_constat_for_work_order",
      { p_work_order_id: os.dbId }
    );
    if (refreshError) {
      alert("Le recalcul est terminé mais le constat n'a pas pu être relu.");
      return;
    }
    setConstat(refreshed?.constat || null);
    setConstatLines(refreshed?.lines || []);
    setConstatEditMode(false);
    alert("✅ Constat recalculé depuis les travaux.");
  }

'''
s = s.replace(tabs_needle, helpers + tabs_needle, 1)

# 4) Do not overwrite a manually edited existing constat when saving works again.
old_generate = '''    // 6. Générer / régénérer le constat de facturation en brouillon.
    const { error: constatError } = await supabase.rpc(
      "generate_constat_for_work_order",
      { p_work_order_id: os.dbId, p_user_id: user.id }
    );
    if (constatError) {
      console.error("Erreur génération constat :", constatError);
      alert("⚠️ Les travaux sont enregistrés, mais le constat n'a pas pu être généré :\\n\\n" + constatError.message);
    }
'''
new_generate = '''    // 6. Générer le constat uniquement s'il n'existe pas encore.
    // Cela protège les corrections manuelles apportées ensuite au constat.
    const { data: existingConstatPayload, error: existingConstatError } = await supabase.rpc(
      "get_constat_for_work_order",
      { p_work_order_id: os.dbId }
    );
    if (existingConstatError) {
      console.error("Erreur lecture constat avant génération :", existingConstatError);
    } else if (!existingConstatPayload?.constat) {
      const { error: constatError } = await supabase.rpc(
        "generate_constat_for_work_order",
        { p_work_order_id: os.dbId, p_user_id: user.id }
      );
      if (constatError) {
        console.error("Erreur génération constat :", constatError);
        alert("⚠️ Les travaux sont enregistrés, mais le constat n'a pas pu être généré :\\n\\n" + constatError.message);
      }
    }
'''
if old_generate not in s:
    raise SystemExit('Automatic constat generation block not found')
s = s.replace(old_generate, new_generate, 1)

# 5) Replace the read-only constat panel with a real manual editor.
old_ui_start = '          {activeTab === "constat" && (\n            <div className="os-section">\n              <h3>Constat de facturation</h3>'
ui_start = s.find(old_ui_start)
if ui_start == -1:
    raise SystemExit('Constat UI start not found')
ui_end_marker = '          {/* HISTORIQUE */}'
ui_end = s.find(ui_end_marker, ui_start)
if ui_end == -1:
    raise SystemExit('Constat UI end marker not found')
new_ui = '''          {activeTab === "constat" && (
            <div className="os-section">
              <h3>Constat de facturation</h3>
              {constatLoading ? (
                <div className="os-empty-state"><strong>Chargement du constat...</strong></div>
              ) : !constat ? (
                <div className="os-empty-state">
                  💶<strong>Constat non créé</strong>
                  <span>Le constat sera créé automatiquement après l'enregistrement des travaux réalisés.</span>
                </div>
              ) : (
                <div>
                  <div className="os-info-grid">
                    <div><span>Statut</span><strong>{constat.status || "Brouillon"}</strong></div>
                    <div><span>Date</span><strong>{constat.constat_date ? new Date(constat.constat_date).toLocaleDateString("fr-FR") : "—"}</strong></div>
                    <div><span>Total</span><strong>{Number(constat.total_amount || 0).toFixed(2)} €</strong></div>
                  </div>

                  {constatLocked ? (
                    <div className="os-empty-state" style={{ marginTop: 16 }}>
                      🔒 <strong>Constat verrouillé</strong>
                      <span>Ce constat ne peut plus être modifié car il est {constat.status?.toLowerCase()}.</span>
                    </div>
                  ) : !constatEditMode ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0" }}>
                      <button className="primary" type="button" onClick={startConstatEdit}>✏️ Modifier le constat</button>
                      <button className="secondary" type="button" onClick={regenerateConstatFromWorks}>↻ Recalculer depuis les travaux</button>
                    </div>
                  ) : (
                    <div style={{ margin: "16px 0" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <button className="primary" type="button" disabled={constatSaving} onClick={saveConstatManual}>
                          {constatSaving ? "Enregistrement..." : "💾 Enregistrer les modifications"}
                        </button>
                        <button className="secondary" type="button" disabled={constatSaving} onClick={() => setConstatEditMode(false)}>Annuler</button>
                        <button className="secondary" type="button" disabled={constatSaving} onClick={regenerateConstatFromWorks}>↻ Recalculer depuis les travaux</button>
                      </div>

                      <label>Observations du constat</label>
                      <textarea
                        value={constatEditObservations}
                        onChange={(e) => setConstatEditObservations(e.target.value)}
                        rows="3"
                        placeholder="Observation ou précision de facturation..."
                      />

                      <h4>Détail des prestations — modification manuelle</h4>
                      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 10 }}>
                        <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: 8 }}>Prestation</th>
                              <th style={{ padding: 8 }}>Qté</th>
                              <th style={{ padding: 8 }}>Unité</th>
                              <th style={{ padding: 8 }}>Prix unitaire</th>
                              <th style={{ padding: 8 }}>Montant</th>
                              <th style={{ padding: 8 }}>Épaisseur</th>
                              <th style={{ padding: 8 }}>Observation</th>
                              <th style={{ padding: 8 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editableConstatLines.map((line, index) => (
                              <tr key={line.id || index}>
                                <td style={{ padding: 6 }}><input style={{ width: "100%" }} value={line.designation} onChange={(e) => updateEditableConstatLine(index, "designation", e.target.value)} /></td>
                                <td style={{ padding: 6 }}><input type="number" step="0.01" min="0" style={{ width: 90 }} value={line.quantity} onChange={(e) => updateEditableConstatLine(index, "quantity", e.target.value)} /></td>
                                <td style={{ padding: 6 }}><input style={{ width: 75 }} value={line.unit} onChange={(e) => updateEditableConstatLine(index, "unit", e.target.value)} /></td>
                                <td style={{ padding: 6 }}><input type="number" step="0.01" min="0" style={{ width: 110 }} value={line.unit_price} onChange={(e) => updateEditableConstatLine(index, "unit_price", e.target.value)} /></td>
                                <td style={{ padding: 6, textAlign: "right", fontWeight: 700 }}>{(Number(line.quantity) * Number(line.unit_price)).toFixed(2)} €</td>
                                <td style={{ padding: 6 }}><input type="number" step="0.1" min="0" style={{ width: 90 }} value={line.thickness_cm} onChange={(e) => updateEditableConstatLine(index, "thickness_cm", e.target.value)} /></td>
                                <td style={{ padding: 6 }}><input style={{ width: 180 }} value={line.observations} onChange={(e) => updateEditableConstatLine(index, "observations", e.target.value)} /></td>
                                <td style={{ padding: 6 }}><button className="secondary" type="button" onClick={() => removeEditableConstatLine(index)}>✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button className="secondary" type="button" style={{ marginTop: 10 }} onClick={addEditableConstatLine}>+ Ajouter une prestation</button>
                    </div>
                  )}

                  {!constatEditMode && (
                    <>
                      <h4>Détail des prestations</h4>
                      {constatLines.length === 0 ? (
                        <div className="os-empty-state"><span>Aucune prestation.</span></div>
                      ) : constatLines.map((line) => (
                        <div className="os-info-grid" key={line.id}>
                          <div><span>{line.designation}</span><strong>{Number(line.quantity || 0).toFixed(2)} {line.unit || ""} × {Number(line.unit_price || 0).toFixed(2)} € = {Number(line.amount || 0).toFixed(2)} €</strong></div>
                        </div>
                      ))}
                      {constat.observations && (
                        <div className="os-info-grid" style={{ marginTop: 10 }}>
                          <div><span>Observations</span><strong>{constat.observations}</strong></div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

'''
s = s[:ui_start] + new_ui + s[ui_end:]

p.write_text(s, encoding='utf-8')
