from pathlib import Path

path = Path("src/travauxMaterialOverlay.js")
s = path.read_text(encoding="utf-8")

old = '''const observer = new MutationObserver(scheduleRefresh);\nobserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });\nwindow.addEventListener("setom:planning-updated", scheduleRefresh);\naddStyle();\nscheduleRefresh();\n'''

new = '''const observer = new MutationObserver((mutations) => {\n  // Ne jamais relancer le rendu lorsque la mutation vient de notre propre\n  // panneau : renderPanel() retire puis recrée ce panneau, ce qui pouvait\n  // provoquer une boucle de rafraîchissement et bloquer tous les champs.\n  const relevant = mutations.some((mutation) => {\n    const target = mutation.target instanceof Element ? mutation.target : null;\n    if (target?.closest?.(`#${PANEL_ID}`)) return false;\n    if (mutation.type !== "childList") return false;\n    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];\n    return changedNodes.some((node) => {\n      if (!(node instanceof Element)) return false;\n      return node.id !== PANEL_ID && !node.closest?.(`#${PANEL_ID}`);\n    });\n  });\n  if (relevant) scheduleRefresh();\n});\nobserver.observe(document.body, { childList: true, subtree: true });\nwindow.addEventListener("setom:planning-updated", scheduleRefresh);\naddStyle();\nscheduleRefresh();\n'''

if old in s:
    s = s.replace(old, new, 1)
elif "const observer = new MutationObserver((mutations) =>" in s:
    print("SETOM: material overlay observer guard already applied")
    raise SystemExit(0)
else:
    raise SystemExit("SETOM: material overlay observer block not found")

path.write_text(s, encoding="utf-8")
print("SETOM: material overlay mutation loop blocked")
