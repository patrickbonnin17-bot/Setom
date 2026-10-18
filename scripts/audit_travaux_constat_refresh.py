from pathlib import Path

text = Path("src/main.jsx").read_text(encoding="utf-8")
required = [
    "const [constatRefreshVersion, setConstatRefreshVersion]",
    'setom:travaux-final-transmitted',
    'const refreshConstat = () => setConstatRefreshVersion',
    'profile?.role, constatRefreshVersion',
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit("SETOM audit: final Travaux → Constat refresh missing: " + ", ".join(missing))
if 'regenerate_constat_for_work_order' in text:
    raise SystemExit("SETOM audit: unsupported constat regeneration RPC remains in source")
print("SETOM audit: final Travaux transmission refreshes the canonical Constat read without regeneration RPC")