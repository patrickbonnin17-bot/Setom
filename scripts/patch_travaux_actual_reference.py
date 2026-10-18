from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Persist an explicit canonical actual-measurement snapshot alongside the DB fields.
# Planned values are deliberately untouched: actuals are a separate truth used by
# downstream operational/financial surfaces.
anchor = '''      onUpdate(os.id, { actualRoadSurface: roadActual || null, actualSidewalkSurface: sidewalkActual || null, actualOtherSurface: otherActual || null, interventionId: intervention.id });\n      alert("✅ Brouillon des travaux enregistré. Le statut de l'OS n'a pas été modifié.");'''
replacement = '''      const actualReference = {\n        workOrderId: os.dbId,\n        interventionId: intervention.id,\n        roadSurfaceM2: realRoadSurface === "" ? null : roadActual,\n        sidewalkSurfaceM2: realSidewalkSurface === "" ? null : sidewalkActual,\n        otherSurfaceM2: realOtherSurface === "" ? null : otherActual,\n        totalSurfaceM2: totalActualSurface,\n        thicknessCm: thickness !== "" && !isNaN(Number(thickness)) ? Number(thickness) : null,\n        updatedAt: new Date().toISOString(),\n        source: "travaux_reels"\n      };\n      localStorage.setItem(`setom:actual-reference:v1:${os.dbId}`, JSON.stringify(actualReference));\n      window.dispatchEvent(new CustomEvent("setom:actual-measurements-updated", { detail: actualReference }));\n      onUpdate(os.id, { actualRoadSurface: realRoadSurface === "" ? null : roadActual, actualSidewalkSurface: realSidewalkSurface === "" ? null : sidewalkActual, actualOtherSurface: realOtherSurface === "" ? null : otherActual, actualSurfaceM2: totalActualSurface, interventionId: intervention.id });\n      alert("✅ Brouillon des travaux enregistré. Le statut de l'OS n'a pas été modifié.");'''
if anchor not in text:
    raise SystemExit("SETOM: Travaux draft actual-reference anchor not found")
if "setom:actual-reference:v1:" not in text:
    text = text.replace(anchor, replacement, 1)

# Keep the dashboard/OS state synchronized immediately when a field measurement changes.
listener_anchor = '''  useEffect(() => {\n    const handlePlanningUpdate = () => setOsRefreshVersion((version) => version + 1);\n    window.addEventListener("setom:planning-updated", handlePlanningUpdate);\n    return () => window.removeEventListener("setom:planning-updated", handlePlanningUpdate);\n  }, []);'''
listener_replacement = '''  useEffect(() => {\n    const handlePlanningUpdate = () => setOsRefreshVersion((version) => version + 1);\n    const handleActualMeasurements = () => setOsRefreshVersion((version) => version + 1);\n    window.addEventListener("setom:planning-updated", handlePlanningUpdate);\n    window.addEventListener("setom:actual-measurements-updated", handleActualMeasurements);\n    return () => {\n      window.removeEventListener("setom:planning-updated", handlePlanningUpdate);\n      window.removeEventListener("setom:actual-measurements-updated", handleActualMeasurements);\n    };\n  }, []);'''
if listener_anchor in text and "handleActualMeasurements" not in text:
    text = text.replace(listener_anchor, listener_replacement, 1)

# When the final Travaux transmission completes, refresh the canonical constat from the DB workflow.
# This is a read-only refresh; it never calls an unsupported regeneration RPC.
old_final = '''      setOsRefreshVersion((version) => version + 1);\n      alert("Travaux transmis avec succès.");'''
new_final = '''      setOsRefreshVersion((version) => version + 1);\n      window.dispatchEvent(new CustomEvent("setom:travaux-final-transmitted", { detail: { workOrderId: os.dbId } }));\n      alert("Travaux transmis avec succès.");'''
if old_final in text and "setom:travaux-final-transmitted" not in text:
    text = text.replace(old_final, new_final, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: real Travaux measurements bridged as canonical actual reference")
