from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "scripts" / "patch_dashboard_cockpit.py"

s = TARGET.read_text(encoding="utf-8")

old = '''pattern = re.compile(r'\\{page === "dashboard" && \\(.*?\\n\\s*\\{page === "os" && \\(', re.S)\n    match = pattern.search(s)\n    if not match:\n        raise SystemExit("SETOM dashboard: dashboard render block not found before OS page")\n    replacement = \'\'\'{page === "dashboard" && <DashboardCockpit osList={osList} dbTeams={dbTeams} dbMaterials={dbMaterials} appSettings={appSettings} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />}\\n\\n      {page === "os" && (\'\'\'\n    s = s[:match.start()] + replacement + s[match.end():]\n'''

new = '''pattern = re.compile(r'\\{page\\s*===\\s*"dashboard"\\s*&&\\s*\\(.*?\\n\\s*\\{page\\s*===\\s*"os"', re.S)\n    match = pattern.search(s)\n    if match:\n        replacement = \'\'\'{page === "dashboard" && <DashboardCockpit osList={osList} dbTeams={dbTeams} dbMaterials={dbMaterials} appSettings={appSettings} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />}\\n\\n      {page === "os"\'\'\'\n        s = s[:match.start()] + replacement + s[match.end():]\n    else:\n        # Some navigation patches replace the legacy dashboard block before this patch runs.\n        # In that case, inject the cockpit immediately before the existing OS page block.\n        os_anchor = re.search(r'\\{page\\s*===\\s*"os"', s)\n        if not os_anchor:\n            raise SystemExit("SETOM dashboard: no dashboard or OS render anchor found; refusing to corrupt main.jsx")\n        dashboard_render = \'\'\'{page === "dashboard" && <DashboardCockpit osList={osList} dbTeams={dbTeams} dbMaterials={dbMaterials} appSettings={appSettings} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />}\\n\\n      \'\'\'\n        s = s[:os_anchor.start()] + dashboard_render + s[os_anchor.start():]\n'''

if old in s:
    s = s.replace(old, new, 1)
elif 'no dashboard or OS render anchor found' not in s:
    raise SystemExit("SETOM dashboard guard: expected patch block not found")

TARGET.write_text(s, encoding="utf-8")
print("SETOM dashboard: robust render-anchor guard applied")
