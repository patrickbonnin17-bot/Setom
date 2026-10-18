from pathlib import Path

path = Path("src/planningOverlay.jsx")
text = path.read_text(encoding="utf-8")

if 'import "./planningOperationalBoard.css";' not in text:
    text = text.replace('import "./planningOverlay.css";', 'import "./planningOverlay.css";\nimport "./planningOperationalBoard.css";', 1)

state_anchor = '  const [routeTeamId, setRouteTeamId] = useState("");'
state_replacement = '''  const [routeTeamId, setRouteTeamId] = useState("");
  const [selectedPlanningOrderId, setSelectedPlanningOrderId] = useState(null);'''
if state_anchor in text and 'selectedPlanningOrderId' not in text:
    text = text.replace(state_anchor, state_replacement, 1)

helper_anchor = '  const selectedOrders = byDate.get(selectedDate) || [];'
helper_replacement = '''  const selectedOrders = byDate.get(selectedDate) || [];
  const selectedPlanningOrder = orders.find((order) => order.id === selectedPlanningOrderId) || null;
  const selectedDaySurface = selectedOrders.reduce((sum, order) => sum + (Number(order.planned_surface_m2) || 0), 0);
  const selectedDayTeams = [...new Set(selectedOrders.map((order) => order.team_name).filter(Boolean))];
  const planningMaterialSummary = useMemo(() => {
    const map = new Map();
    selectedOrders.forEach((order) => {
      const name = String(order.material_detail || "Intervention").trim() || "Intervention";
      const current = map.get(name) || { name, surface: 0, count: 0 };
      current.surface += Number(order.planned_surface_m2) || 0;
      current.count += 1;
      map.set(name, current);
    });
    return [...map.values()].sort((a, b) => b.surface - a.surface);
  }, [selectedOrders]);'''
if helper_anchor in text and 'planningMaterialSummary' not in text:
    text = text.replace(helper_anchor, helper_replacement, 1)

if 'function renderOrder(order)' not in text:
    raise SystemExit("SETOM: planning renderOrder anchor not found")

old_day = '''        {view === "jour" && <div className="setom-day-view"><div className="setom-day-title"><strong>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong><span>{selectedOrders.length} OS planifié(s)</span></div>{selectedOrders.map(renderOrder)}<div className="setom-add-row"><select defaultValue="" onChange={(e) => { const o = orders.find((x) => String(x.id) === e.target.value); if (o) planOrder(o, selectedDate, o.team_id); e.target.value = ""; }}><option value="">+ Ajouter un OS à cette journée…</option>{orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) && !o.planned_date).map((o) => <option key={o.id} value={o.id}>{fullOsNumber(o)} · {o.address}</option>)}</select></div></div>}'''
new_day = '''        {view === "jour" && <div className="setom-planning-board">
          <section className="setom-day-view setom-planning-list">
            <div className="setom-day-title"><div><strong>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong><span>{selectedOrders.length} OS planifié(s)</span></div><div className="setom-day-kpis"><b>{selectedDaySurface.toLocaleString("fr-FR")} m²</b><span>{selectedDayTeams.length} équipe(s)</span></div></div>
            <div className="setom-planning-material-strip">{planningMaterialSummary.length ? planningMaterialSummary.map((item) => <span key={item.name}><b>{item.name}</b> · {item.surface.toLocaleString("fr-FR")} m² · {item.count} OS</span>) : <span>Aucun matériau prévu sur cette journée.</span>}</div>
            {selectedOrders.map((order) => <div key={order.id} role="button" tabIndex={0} className={`setom-planning-order-select ${selectedPlanningOrderId === order.id ? "active" : ""}`} onClick={(event) => { if (event.target.closest("button,select,input,a")) return; setSelectedPlanningOrderId(order.id); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button,select,input,a")) { event.preventDefault(); setSelectedPlanningOrderId(order.id); } }}>{renderOrder(order)}</div>)}
            <div className="setom-add-row"><select defaultValue="" onChange={(e) => { const o = orders.find((x) => String(x.id) === e.target.value); if (o) { setSelectedPlanningOrderId(o.id); planOrder(o, selectedDate, o.team_id); } e.target.value = ""; }}><option value="">+ Ajouter un OS à cette journée…</option>{orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) && !o.planned_date).map((o) => <option key={o.id} value={o.id}>{fullOsNumber(o)} · {o.address}</option>)}</select></div>
          </section>
          <aside className="setom-planning-detail">
            {selectedPlanningOrder ? <>
              <div className="setom-detail-kicker">OS sélectionné</div><h3>{fullOsNumber(selectedPlanningOrder)}</h3>
              <div className="setom-detail-status" style={getOSStatusBadgeStyle(selectedPlanningOrder.status)}>{selectedPlanningOrder.status}</div>
              <dl><div><dt>Adresse</dt><dd>{selectedPlanningOrder.address || "Non renseignée"}{selectedPlanningOrder.city ? `, ${selectedPlanningOrder.city}` : ""}</dd></div><div><dt>Secteur</dt><dd>{selectedPlanningOrder.sector_name || "Non classé"}</dd></div><div><dt>Travaux</dt><dd>{selectedPlanningOrder.material_detail || "Intervention"}</dd></div><div><dt>Surface</dt><dd>{selectedPlanningOrder.planned_surface_m2 ? `${selectedPlanningOrder.planned_surface_m2} m²` : "Non renseignée"}</dd></div><div><dt>Équipe</dt><dd>{selectedPlanningOrder.team_name || "Non affectée"}</dd></div><div><dt>Échéance</dt><dd>{selectedPlanningOrder.deadline_date ? new Date(selectedPlanningOrder.deadline_date + "T12:00:00").toLocaleDateString("fr-FR") : "Non renseignée"}</dd></div></dl>
              <div className="setom-detail-actions">{isOffice && STATUS_PLANIFIABLE.includes(selectedPlanningOrder.status) ? <><button className="primary" onClick={() => planOrder(selectedPlanningOrder, selectedPlanningOrder.planned_date || selectedDate, selectedPlanningOrder.team_id)}>Enregistrer la journée</button><button onClick={() => moveOrder(selectedPlanningOrder, -1)}>← Jour précédent</button><button onClick={() => moveOrder(selectedPlanningOrder, 1)}>Jour suivant →</button></> : <span>Lecture seule pour ce statut.</span>}</div>
              <div className="setom-detail-loading-link"><strong>Préparation chargement</strong><span>Cette journée est prête à être reprise dans le module Chargement pour répartir les matériaux par rotation et contrôler le tonnage.</span><button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("setom:navigate", { detail: { page: "chargement", orderId: selectedPlanningOrder.id, date: selectedPlanningOrder.planned_date || selectedDate } })); onClose(); }}>🚛 Ouvrir le chargement</button></div>
            </> : <div className="setom-detail-empty"><strong>Sélectionnez un OS</strong><span>Le détail de l’intervention, son équipe, sa surface et son passage apparaîtront ici.</span></div>}
          </aside>
        </div>}'''
if old_day not in text:
    raise SystemExit("SETOM: day planning render block not found")
text = text.replace(old_day, new_day, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: operational planning board applied")
