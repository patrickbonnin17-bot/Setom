from pathlib import Path

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

path.write_text(text, encoding="utf-8")
print('SETOM: constat refresh wired to final Travaux transmission')