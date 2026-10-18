from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

marker = '  const [page, setPage] = useState("dashboard");\n'
insert = '''  const [page, setPage] = useState("dashboard");\n\n  useEffect(() => {\n    const allowedPages = new Set([\n      "dashboard", "os", "travaux", "planning", "chargement", "constat",\n      "financier", "map", "teams", "reserves", "bpu", "materials", "settings", "access"\n    ]);\n    const handleSetomNavigate = (event) => {\n      const detail = event?.detail || {};\n      const nextPage = String(detail.page || "").trim();\n      if (!allowedPages.has(nextPage)) return;\n      setSelectedOS(null);\n      setShowNewOS(false);\n      setShowOsFilters(false);\n      if (nextPage === "chargement") {\n        const loadingDate = String(detail.date || "").trim();\n        const orderId = String(detail.orderId || "").trim();\n        window.__setomCurrentSection = "chargement";\n        try {\n          sessionStorage.setItem("setom:current-section", "chargement");\n          if (/^\\d{4}-\\d{2}-\\d{2}$/.test(loadingDate)) {\n            sessionStorage.setItem("setom:chargement:date:v1", loadingDate);\n            localStorage.setItem("setom:chargement:date:v1", loadingDate);\n          }\n          if (orderId) {\n            sessionStorage.setItem("setom:chargement:order:v1", orderId);\n            localStorage.setItem("setom:chargement:order:v1", orderId);\n          } else {\n            sessionStorage.removeItem("setom:chargement:order:v1");\n            localStorage.removeItem("setom:chargement:order:v1");\n          }\n        } catch (_) {}\n        window.dispatchEvent(new CustomEvent("setom:chargement-date-changed", { detail: { date: loadingDate, orderId } }));\n        window.dispatchEvent(new CustomEvent("setom:chargement-order-changed", { detail: { orderId, date: loadingDate } }));\n      }\n      setPage(nextPage);\n    };\n    window.addEventListener("setom:navigate", handleSetomNavigate);\n    return () => window.removeEventListener("setom:navigate", handleSetomNavigate);\n  }, []);\n'''

if 'window.addEventListener("setom:navigate", handleSetomNavigate)' not in text:
    if marker not in text:
        raise SystemExit("SETOM page state marker not found")
    text = text.replace(marker, insert, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: cross-module navigation event bridge applied")
