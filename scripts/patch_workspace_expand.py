from pathlib import Path
import re

main = Path("src/main.jsx")
text = main.read_text(encoding="utf-8")

if "workspaceExpanded" not in text:
    marker = '  const [page, setPage] = useState("dashboard");'
    if marker not in text:
        raise SystemExit("SETOM: page state marker not found")
    text = text.replace(marker, marker + '\n  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);', 1)

marker = '  useEffect(() => {\n    const handlePlanningUpdate = () => setOsRefreshVersion((version) => version + 1);'
if marker in text and 'handleWorkspaceKey' not in text:
    replacement = '''  useEffect(() => {\n    if (page !== "map" && page !== "planning") setWorkspaceExpanded(false);\n  }, [page]);\n\n  useEffect(() => {\n    const handleWorkspaceKey = (event) => {\n      if (event.key === "Escape") setWorkspaceExpanded(false);\n    };\n    window.addEventListener("keydown", handleWorkspaceKey);\n    return () => window.removeEventListener("keydown", handleWorkspaceKey);\n  }, []);\n\n''' + marker
    text = text.replace(marker, replacement, 1)

map_pattern = re.compile(r'\{page === "map" && <>.*?</>\}\s*\{page === "planning"', re.S)
map_match = map_pattern.search(text)
if not map_match:
    raise SystemExit("SETOM: map page block not found")
map_block = map_match.group(0)
map_inner = map_block[:-len('{page === "planning"')]
if 'workspace-shell' not in map_inner:
    old_start = '{page === "map" && <>'
    start = '{page === "map" && <><div className={`workspace-shell ${workspaceExpanded ? "workspace-expanded" : ""}`}>'
    map_inner = map_inner.replace(old_start, start + '\n<div className="workspace-toolbar"><strong>🗺️ Carte des interventions</strong><button type="button" className="secondary workspace-expand-button" onClick={() => setWorkspaceExpanded((value) => !value)}>{workspaceExpanded ? "↙ Réduire" : "⛶ Agrandir"}</button></div>', 1)
    map_inner = map_inner.replace('</div></>}', '</div></div></>}', 1)
    text = text[:map_match.start()] + map_inner + '{page === "planning"' + text[map_match.end():]

planning_pattern = re.compile(r'\{page === "planning" && <>.*?</>\}\s*\{page === "teams"', re.S)
planning_match = planning_pattern.search(text)
if not planning_match:
    raise SystemExit("SETOM: planning page block not found")
planning_block = planning_match.group(0)
planning_inner = planning_block[:-len('{page === "teams"')]
if 'workspace-shell' not in planning_inner:
    old_start = '{page === "planning" && <>'
    start = '{page === "planning" && <><div className={`workspace-shell ${workspaceExpanded ? "workspace-expanded" : ""}`}>'
    planning_inner = planning_inner.replace(old_start, start + '\n<div className="workspace-toolbar"><strong>📅 Planning hebdomadaire</strong><button type="button" className="secondary workspace-expand-button" onClick={() => setWorkspaceExpanded((value) => !value)}>{workspaceExpanded ? "↙ Réduire" : "⛶ Agrandir"}</button></div>', 1)
    planning_inner = planning_inner.replace('</div></>}', '</div></div></>}', 1)
    text = text[:planning_match.start()] + planning_inner + '{page === "teams"' + text[planning_match.end():]

main.write_text(text, encoding="utf-8")

css = Path("src/style.css")
style = css.read_text(encoding="utf-8")
marker = "/* SETOM WORKSPACE EXPAND */"
if marker not in style:
    style += r'''
/* SETOM WORKSPACE EXPAND */
.workspace-shell {
  position: relative;
  min-width: 0;
}
.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d9e0e7;
  border-radius: 12px;
}
.workspace-expand-button {
  white-space: nowrap;
}
.workspace-expanded {
  position: fixed !important;
  inset: 12px !important;
  z-index: 1200 !important;
  background: #f4f6f8;
  padding: 12px;
  border-radius: 16px;
  box-shadow: 0 18px 55px rgba(15, 23, 42, .28);
  overflow: auto !important;
}
.workspace-expanded .workspace-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
}
.workspace-expanded .map {
  height: calc(100dvh - 105px) !important;
  min-height: 0 !important;
  max-height: none !important;
}
.workspace-expanded .planning {
  min-height: calc(100dvh - 155px) !important;
  max-height: none !important;
  overflow: visible !important;
}
.workspace-expanded .week {
  min-height: calc(100dvh - 180px);
}
@media (max-width: 700px) {
  .workspace-expanded {
    inset: 6px !important;
    padding: 8px;
    border-radius: 12px;
  }
  .workspace-toolbar {
    padding: 8px 10px;
  }
  .workspace-expanded .map {
    height: calc(100dvh - 82px) !important;
  }
}
'''
css.write_text(style, encoding="utf-8")
print("SETOM: planning/map expandable workspace applied")
