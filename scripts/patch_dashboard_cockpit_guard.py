from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "scripts" / "patch_dashboard_cockpit.py"
s = TARGET.read_text(encoding="utf-8")

# Normalize the dashboard render replacement itself. Historical navigation patches
# may change the exact JSX spacing/parentheses, so patch by structure rather than
# by one brittle literal block.
block = re.compile(
    r'    pattern = re\.compile\(r.*?\n'
    r'    match = pattern\.search\(s\)\n'
    r'    if not match:\n.*?'
    r'    s = s\[:match\.start\(\)\] \+ replacement \+ s\[match\.end\(\):\]\n',
    re.S,
)

replacement = '''    pattern = re.compile(r'\\{page\\s*===\\s*"dashboard"\\s*&&\\s*\\(.*?\\n\\s*\\{page\\s*===\\s*"os"', re.S)
    match = pattern.search(s)
    replacement = '''{page === "dashboard" && <DashboardCockpit osList={osList} dbTeams={dbTeams} dbMaterials={dbMaterials} appSettings={appSettings} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />}

      {page === "os"'''
    if match:
        s = s[:match.start()] + replacement + s[match.end():]
    else:
        os_anchor = re.search(r'\\{page\\s*===\\s*"os"', s)
        if not os_anchor:
            raise SystemExit("SETOM dashboard: no dashboard or OS render anchor found; refusing to corrupt main.jsx")
        dashboard_render = '''{page === "dashboard" && <DashboardCockpit osList={osList} dbTeams={dbTeams} dbMaterials={dbMaterials} appSettings={appSettings} onOpenOS={(os) => { setSelectedOS(os); setPage("os"); }} onNavigate={setPage} />}

      '''
        s = s[:os_anchor.start()] + dashboard_render + s[os_anchor.start():]
'''

m = block.search(s)
if m:
    s = s[:m.start()] + replacement + s[m.end():]
    TARGET.write_text(s, encoding="utf-8")
    print("SETOM dashboard: render patch normalized")
else:
    # Already normalized: leave the patch script untouched and let the build continue.
    if 'no dashboard or OS render anchor found' in s and 'pattern = re.compile(r\'\\{page\\s*===\\s*"dashboard"' in s:
        print("SETOM dashboard: render patch already normalized")
    else:
        raise SystemExit("SETOM dashboard guard: dashboard patch structure not recognized")
