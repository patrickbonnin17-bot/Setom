from pathlib import Path

path = Path("src/planningOverlay.jsx")
text = path.read_text(encoding="utf-8")

old_state = '  const [sectorFilter, setSectorFilter] = useState("Tous");\n'
new_state = '  const [sectorFilter, setSectorFilter] = useState("Tous");\n  const [mapStatusFilter, setMapStatusFilter] = useState("Tous");\n  const [mapTeamFilter, setMapTeamFilter] = useState("Tous");\n'
if old_state in text and new_state not in text:
    text = text.replace(old_state, new_state, 1)

old_derived = '  const mapOrders = useMemo(() => orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) && (sectorFilter === "Tous" || o.sector_name === sectorFilter)), [orders, sectorFilter]);\n'
new_derived = '''  const mapOrders = useMemo(() => orders.filter((o) =>
    (sectorFilter === "Tous" || o.sector_name === sectorFilter) &&
    (mapStatusFilter === "Tous" || o.status === mapStatusFilter) &&
    (mapTeamFilter === "Tous" || (mapTeamFilter === "Aucune" ? !o.team_id : o.team_id === mapTeamFilter))
  ), [orders, sectorFilter, mapStatusFilter, mapTeamFilter]);\n'''
if old_derived in text:
    text = text.replace(old_derived, new_derived, 1)

old_marker = '      const isPlanned = !!order.planned_date;\n      const color = isPlanned ? "#2563eb" : "#dc2626";\n      const marker = L.circleMarker([point.lat, point.lon], { radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.9 }).addTo(markerLayerRef.current);\n'
new_marker = '''      const statusColors = getOSStatusColors(order.status);\n      const color = statusColors.accent || (order.planned_date ? "#2563eb" : "#dc2626");\n      const marker = L.circleMarker([point.lat, point.lon], { radius: 9, color, weight: 2, fillColor: color, fillOpacity: 0.9 }).addTo(markerLayerRef.current);\n'''
if old_marker in text:
    text = text.replace(old_marker, new_marker, 1)

old_header = '<div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>OS planifiables</strong><span>{mapOrders.length} OS</span></div><label style={{ fontSize: 12, color: "#475569" }}>Secteur<select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}><option value="Tous">Tous les secteurs</option>{sectors.map((sector) => <option key={sector.id} value={sector.name}>{sector.name}</option>)}<option value="Non classé">Non classés</option></select></label>'
new_header = '''<div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>Carte opérationnelle</strong><span>{mapOrders.length} OS</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 7 }}>
              <label style={{ fontSize: 12, color: "#475569" }}>Statut<select value={mapStatusFilter} onChange={(e) => setMapStatusFilter(e.target.value)}><option value="Tous">Tous les statuts</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label style={{ fontSize: 12, color: "#475569" }}>Équipe<select value={mapTeamFilter} onChange={(e) => setMapTeamFilter(e.target.value)}><option value="Tous">Toutes les équipes</option><option value="Aucune">Non affectée</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
              <label style={{ fontSize: 12, color: "#475569" }}>Secteur<select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}><option value="Tous">Tous les secteurs</option>{sectors.map((sector) => <option key={sector.id} value={sector.name}>{sector.name}</option>)}<option value="Non classé">Non classés</option></select></label>
            </div>'''
if old_header in text:
    text = text.replace(old_header, new_header, 1)

old_article = '''              <label>Date de passage<input type="date" value={o.planned_date || selectedDate} disabled={savingId === o.id} onChange={(e) => planOrder(o, e.target.value || null, o.team_id)} /></label>
              <label>Équipe<select value={o.team_id || ""} onChange={(e) => changeOrderTeam(o, e.target.value || null)} disabled={savingId === o.id}><option value="">Non affectée</option>{o.team_id && !teams.some((t) => t.id === o.team_id) && <option value={o.team_id} disabled>Inactive — {o.team_name || "Équipe"}</option>}{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <button disabled={savingId === o.id || o.planned_date === selectedDate} onClick={() => planOrder(o, selectedDate, o.team_id)}>{o.planned_date ? "Déplacer vers cette journée" : "Ajouter à cette journée"}</button>
              {o.planned_date && <button className="setom-map-remove" disabled={savingId === o.id} onClick={() => planOrder(o, null, o.team_id)}>Retirer du planning</button>}'''
new_article = '''              {STATUS_PLANIFIABLE.includes(o.status) ? <>
                <label>Date de passage<input type="date" value={o.planned_date || selectedDate} disabled={savingId === o.id} onChange={(e) => planOrder(o, e.target.value || null, o.team_id)} /></label>
                <label>Équipe<select value={o.team_id || ""} onChange={(e) => changeOrderTeam(o, e.target.value || null)} disabled={savingId === o.id}><option value="">Non affectée</option>{o.team_id && !teams.some((t) => t.id === o.team_id) && <option value={o.team_id} disabled>Inactive — {o.team_name || "Équipe"}</option>}{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <button disabled={savingId === o.id || o.planned_date === selectedDate} onClick={() => planOrder(o, selectedDate, o.team_id)}>{o.planned_date ? "Déplacer vers cette journée" : "Ajouter à cette journée"}</button>
                {o.planned_date && <button className="setom-map-remove" disabled={savingId === o.id} onClick={() => planOrder(o, null, o.team_id)}>Retirer du planning</button>}
              </> : <small style={{ color: getOSStatusColors(o.status).accent, fontWeight: 800 }}>Workflow : {o.status} · consultation cartographique</small>}'''
if old_article in text:
    text = text.replace(old_article, new_article, 1)

if 'const [mapStatusFilter, setMapStatusFilter]' not in text or 'const statusColors = getOSStatusColors(order.status);' not in text:
    raise SystemExit("Map operational patch did not find all expected anchors; refusing partial build.")
path.write_text(text, encoding="utf-8")
print("Operational map status/team filters applied")
