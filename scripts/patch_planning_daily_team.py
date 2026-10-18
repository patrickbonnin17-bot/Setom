from pathlib import Path

path = Path("src/planningOverlay.jsx")
text = path.read_text(encoding="utf-8")

# SETOM staffing rule: one team is assigned to a planning day, not independently per OS.
if "const destinationTeamIds = new Set(destinationOrders.map((item) => item.team_id).filter(Boolean));" not in text:
    anchor = "      const destinationOrders = dateKey ? (byDate.get(dateKey) || []) : [];\n"
    replacement = anchor + '''      const destinationTeamIds = new Set(destinationOrders.map((item) => item.team_id).filter(Boolean));
      if (dateKey && destinationTeamIds.size && teamId && !destinationTeamIds.has(teamId)) {
        throw new Error("Cette journée est déjà affectée à une autre équipe. Modifiez l’équipe de la journée, pas celle d’un OS isolé.");
      }
      const effectiveDayTeamId = dateKey && destinationTeamIds.size ? [...destinationTeamIds][0] : (teamId || null);
'''
    if anchor not in text:
        raise SystemExit("SETOM: daily-team planOrder anchor not found")
    text = text.replace(anchor, replacement, 1)
    text = text.replace("team_id: teamId || null, planned_order: nextPosition", "team_id: effectiveDayTeamId, planned_order: nextPosition", 1)
    text = text.replace("planned_date: date || null, status: date ? \"Planifié\" : \"À planifier\", team_id: teamId || null, planned_order: nextPosition", "planned_date: date || null, status: date ? \"Planifié\" : \"À planifier\", team_id: effectiveDayTeamId, planned_order: nextPosition", 1)
    text = text.replace("team_id: teamId || null, team_name: teams.find((t) => t.id === teamId)?.name || \"Non affectée\"", "team_id: effectiveDayTeamId, team_name: teams.find((t) => t.id === effectiveDayTeamId)?.name || \"Non affectée\"", 1)

old_change = '  async function changeOrderTeam(order, teamId) { await planOrder(order, order.planned_date, teamId || null); }'
new_change = '''  async function changeOrderTeam(order, teamId) {
    if (!order?.planned_date || !teamId) { await planOrder(order, order?.planned_date || null, teamId || null); return; }
    if (!["admin", "bureau"].includes(profile?.role)) { setError("Votre profil ne permet pas de modifier l’équipe de la journée."); return; }
    setSavingId(order.id); setError("");
    try {
      const dayOrders = byDate.get(order.planned_date) || [];
      const plannedIds = dayOrders.map((item) => item.interventionId).filter(Boolean);
      if (!plannedIds.length) throw new Error("Aucune intervention à mettre à jour pour cette journée.");
      const { error: updateError } = await supabase.from("interventions").update({ team_id: teamId }).in("id", plannedIds);
      if (updateError) throw updateError;
      setOrders((current) => current.map((item) => item.planned_date === order.planned_date ? { ...item, team_id: teamId, team_name: teams.find((team) => team.id === teamId)?.name || "Non affectée" } : item));
      window.dispatchEvent(new Event("setom:planning-updated"));
    } catch (e) { setError(e?.message || "Impossible de modifier l’équipe de la journée."); }
    finally { setSavingId(null); }
  }'''
if old_change in text:
    text = text.replace(old_change, new_change, 1)

# Automatic planning chooses one team for each day.
if "const dayTeam = new Map();" not in text:
    anchor = "      const dayOrders = new Map();\n"
    if anchor not in text:
        raise SystemExit("SETOM: auto-plan dayOrders anchor not found")
    text = text.replace(anchor, anchor + "      const dayTeam = new Map();\n", 1)
    anchor2 = "        if (order.team_id) {\n"
    if anchor2 not in text:
        raise SystemExit("SETOM: existing day team anchor not found")
    text = text.replace(anchor2, "        if (order.team_id) {\n          dayTeam.set(order.planned_date, order.team_id);\n", 1)
    choices_anchor = "          const choices = teamPool.map((team) => {"
    replacement = '''          const lockedTeamId = dayTeam.get(candidateDate);
          if (lockedTeamId) teamPool = teamPool.filter((team) => team.id === lockedTeamId);
          const choices = teamPool.map((team) => {'''
    if choices_anchor not in text:
        raise SystemExit("SETOM: auto-plan team choices anchor not found")
    text = text.replace(choices_anchor, replacement, 1)
    selected_anchor = "          const choice = choices[0];\n"
    if selected_anchor not in text:
        raise SystemExit("SETOM: auto-plan choice anchor not found")
    text = text.replace(selected_anchor, selected_anchor + "          dayTeam.set(candidateDate, choice.team.id);\n", 1)

if "Équipe unique de la journée" not in text:
    marker = '<div className="setom-day-kpis">'
    if marker in text:
        text = text.replace(marker, '<div className="setom-day-team-rule">Équipe unique de la journée · adaptation possible pour toute la journée</div>' + marker, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: daily team assignment enforced across planning")
