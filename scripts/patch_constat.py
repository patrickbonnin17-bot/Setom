from pathlib import Path
import re

p = Path('src/main.jsx')
s = p.read_text(encoding='utf-8')

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

    // Read through a SECURITY DEFINER RPC so RLS on constats/constat_lines
    // cannot make an existing constat appear as "non créé" in the UI.
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

    // If completed and no constat exists, generate it once, then read it again.
    if (!constatData && os.status === "Travaux effectués") {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const { error: rpcError } = await supabase.rpc(
        "generate_constat_for_work_order",
        { p_work_order_id: os.dbId, p_user_id: userId }
      );

      if (rpcError) {
        console.error("Erreur génération constat automatique :", rpcError);
      } else {
        const { data: refreshed, error: refreshError } = await supabase.rpc(
          "get_constat_for_work_order",
          { p_work_order_id: os.dbId }
        );
        if (!refreshError) {
          constatData = refreshed?.constat || null;
          linesData = refreshed?.lines || [];
        }
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
p.write_text(s, encoding='utf-8')
