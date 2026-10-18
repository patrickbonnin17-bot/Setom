from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

marker = '  const [page, setPage] = useState("dashboard");\n'
insert = '''  const [page, setPage] = useState("dashboard");\n\n  useEffect(() => {\n    const handleSetomNavigate = (event) => {\n      const detail = event?.detail || {};\n      const nextPage = String(detail.page || "").trim();\n      if (!nextPage) return;\n      setSelectedOS(null);\n      setShowNewOS(false);\n      setShowOsFilters(false);\n      setPage(nextPage);\n      if (nextPage === "chargement") {\n        window.__setomCurrentSection = "chargement";\n        try { sessionStorage.setItem("setom:current-section", "chargement"); } catch (_) {}\n      }\n    };\n    window.addEventListener("setom:navigate", handleSetomNavigate);\n    return () => window.removeEventListener("setom:navigate", handleSetomNavigate);\n  }, []);\n'''

if 'window.addEventListener("setom:navigate", handleSetomNavigate)' not in text:
    if marker not in text:
        raise SystemExit("SETOM page state marker not found")
    text = text.replace(marker, insert, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: cross-module navigation event bridge applied")
