from pathlib import Path
import re

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

state_anchor = 'const [constat, setConstat] = useState(null); const [constatLines, setConstatLines] = useState([]); const [constatLoading, setConstatLoading] = useState(false);'
state_replacement = state_anchor + ' const [constatRefreshVersion, setConstatRefreshVersion] = useState(0);'
if 'const [constatRefreshVersion, setConstatRefreshVersion]' not in text:
    if state_anchor not in text:
        raise SystemExit('SETOM: constat state anchor missing')
    text = text.replace(state_anchor, state_replacement, 1)

listener = '''  useEffect(() => {
    const refreshConstat = () => setConstatRefreshVersion((version) => version + 1);
    window.addEventListener("setom:travaux-final-transmitted", refreshConstat);
    return () => window.removeEventListener("setom:travaux-final-transmitted", refreshConstat);
  }, []);

'''
if 'window.addEventListener("setom:travaux-final-transmitted", refreshConstat);' not in text:
    marker = '  useEffect(() => {\n    if (!os?.dbId) return;\n    if (!["admin","bureau","eau_de_toulouse"].includes(profile?.role))'
    if marker not in text:
        raise SystemExit('SETOM: constat effect anchor missing')
    text = text.replace(marker, listener + marker, 1)

old_dep = '  }, [os?.dbId, os?.status, profile?.role]);\n\n  useEffect(() => {\n    if (!os?.dbId) return;\n    async function loadAttachments()'
new_dep = '  }, [os?.dbId, os?.status, profile?.role, constatRefreshVersion]);\n\n  useEffect(() => {\n    if (!os?.dbId) return;\n    async function loadAttachments()'
if old_dep in text:
    text = text.replace(old_dep, new_dep, 1)
elif 'profile?.role, constatRefreshVersion' not in text:
    raise SystemExit('SETOM: constat effect dependency anchor missing')

# The canonical constat is refreshed after the final Travaux transmission and
# read with get_constat_for_work_order. The deployed database does not expose
# regenerate_constat_for_work_order, so remove any legacy UI/RPC path before the
# build audit runs.
text = re.sub(
    r'\n      if \(!constatData && os\.status === "Travaux effectués".*?\n      }\n      if\(!cancelled\)',
    '\n      if(!cancelled)',
    text,
    flags=re.S,
)
text = re.sub(
    r'\n  async function regenerateConstatFromWorks\(\).*?\n\n  const canManagePlanning',
    '\n\n  const canManagePlanning',
    text,
    flags=re.S,
)
text = re.sub(
    r'\s*<button className="secondary" type="button"[^>]*onClick=\{regenerateConstatFromWorks\}>↻ Recalculer depuis les travaux</button>',
    '',
    text,
)

path.write_text(text, encoding="utf-8")
print('SETOM: constat refresh wired to final Travaux transmission; unsupported regeneration RPC removed')
