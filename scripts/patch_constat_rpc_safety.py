from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# The database-backed SETOM workflow exposes get_constat_for_work_order, but
# regenerate_constat_for_work_order is not part of the deployed RPC contract.
# Never call a non-existent RPC from the OS dossier: automatic generation is
# server/data-workflow driven; the UI reads the resulting record.
old = '''      if (!constatData && os.status === "Travaux effectués" && ["admin","bureau"].includes(profile?.role)) {
        const { data: authData } = await supabase.auth.getUser(); const userId = authData?.user?.id || null;
        const { error: rpcError } = await supabase.rpc("regenerate_constat_for_work_order", { p_work_order_id: os.dbId, p_user_id: userId });
        if (!rpcError) { const { data: refreshed, error: refreshError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId }); if(!refreshError){constatData=refreshed?.constat||null;linesData=refreshed?.lines||[];} } else console.error("Erreur génération constat automatique :", rpcError);
      }
'''
new = '''      if (!constatData && os.status === "Travaux effectués" && ["admin","bureau"].includes(profile?.role)) {
        for (let attempt = 0; attempt < 3 && !constatData; attempt += 1) {
          if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          const { data: refreshed, error: refreshError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId });
          if (!refreshError) {
            constatData = refreshed?.constat || null;
            linesData = refreshed?.lines || [];
          } else if (attempt === 2) console.error("Erreur lecture constat automatique :", refreshError);
        }
      }
'''
if old in text:
    text = text.replace(old, new, 1)

start = text.find('  async function regenerateConstatFromWorks()')
end = text.find('\n\n  const canManagePlanning', start) if start != -1 else -1
if start != -1 and end != -1:
    replacement = '''  async function regenerateConstatFromWorks() {
    if (!constat || constatLocked) return;
    try {
      const { data: refreshed, error: refreshError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId });
      if (refreshError) throw refreshError;
      setConstat(refreshed?.constat || null);
      setConstatLines(refreshed?.lines || []);
      setConstatEditMode(false);
      alert("✅ Constat actualisé depuis la base SETOM.");
    } catch (error) {
      console.error("Erreur actualisation constat :", error);
      alert("Impossible d'actualiser le constat :\\n\\n" + (error?.message || "Erreur inconnue"));
    }
  }'''
    text = text[:start] + replacement + text[end:]

text = text.replace('↻ Recalculer depuis les travaux', '↻ Actualiser le constat')
if 'regenerate_constat_for_work_order' in text:
    raise SystemExit("SETOM: unsupported regenerate_constat_for_work_order RPC remains")
path.write_text(text, encoding="utf-8")
print("SETOM: all unsupported constat regeneration calls removed")
