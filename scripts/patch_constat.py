from pathlib import Path
import re

p = Path('src/main.jsx')
s = p.read_text(encoding='utf-8')

# Replace the constat loading effect with a self-healing version. The UI can
# briefly render before the database trigger/RPC result is visible; in that
# case we explicitly regenerate (idempotently) and fetch again.
pattern = re.compile(
    r'useEffect\(\(\) => \{\n  if \(!os\?\.dbId\) return;.*?\n\}, \[os\?\.dbId\]\);',
    re.S,
)
replacement = '''useEffect(() => {
  if (!os?.dbId) return;
  let cancelled = false;

  async function loadConstat() {
    setConstatLoading(true);

    async function fetchConstat() {
      const { data, error } = await supabase
        .from("constats")
        .select("*")
        .eq("work_order_id", os.dbId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Erreur chargement constat :", error);
        return { constat: null, error };
      }

      const latest = data?.[0] || null;
      if (!latest) return { constat: null, error: null };

      const { data: lines, error: linesError } = await supabase
        .from("constat_lines")
        .select("*")
        .eq("constat_id", latest.id)
        .order("id");

      if (linesError) console.error("Erreur chargement lignes constat :", linesError);
      return { constat: latest, lines: lines || [], error: null };
    }

    let result = await fetchConstat();

    // If the OS is completed but the UI cannot see a constat yet, regenerate
    // it once. The database function is idempotent for an OS.
    if (!result.constat && os.status === "Travaux effectués") {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const { error: rpcError } = await supabase.rpc(
        "generate_constat_for_work_order",
        { p_work_order_id: os.dbId, p_user_id: userId }
      );
      if (rpcError) console.error("Erreur génération constat automatique :", rpcError);
      result = await fetchConstat();
    }

    if (!cancelled) {
      setConstat(result.constat || null);
      setConstatLines(result.lines || []);
      setConstatLoading(false);
    }
  }

  loadConstat();
  return () => { cancelled = true; };
}, [os?.dbId, os?.status]);'''

if pattern.search(s):
    s = pattern.sub(replacement, s, count=1)
elif 'const [constat, setConstat]' not in s:
    raise SystemExit('Constat loading effect not found')

p.write_text(s, encoding='utf-8')
