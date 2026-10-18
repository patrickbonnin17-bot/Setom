from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

marker = '  const [page, setPage] = useState("dashboard");\n'
insert = '''  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    const allowedPages = new Set([
      "dashboard", "os", "travaux", "planning", "chargement", "constat",
      "financier", "map", "teams", "reserves", "bpu", "materials", "settings", "access"
    ]);
    const handleSetomNavigate = async (event) => {
      const detail = event?.detail || {};
      const nextPage = String(detail.page || "").trim();
      if (!allowedPages.has(nextPage)) return;
      setShowNewOS(false);
      setShowOsFilters(false);
      if (nextPage === "chargement") {
        setSelectedOS(null);
        const loadingDate = String(detail.date || "").trim();
        const orderId = String(detail.orderId || "").trim();
        window.__setomCurrentSection = "chargement";
        try {
          sessionStorage.setItem("setom:current-section", "chargement");
          if (/^\\d{4}-\\d{2}-\\d{2}$/.test(loadingDate)) {
            sessionStorage.setItem("setom:chargement:date:v1", loadingDate);
            localStorage.setItem("setom:chargement:date:v1", loadingDate);
          }
          if (orderId) {
            sessionStorage.setItem("setom:chargement:order:v1", orderId);
            localStorage.setItem("setom:chargement:order:v1", orderId);
          } else {
            sessionStorage.removeItem("setom:chargement:order:v1");
            localStorage.removeItem("setom:chargement:order:v1");
          }
        } catch (_) {}
        window.dispatchEvent(new CustomEvent("setom:chargement-date-changed", { detail: { date: loadingDate, orderId } }));
        window.dispatchEvent(new CustomEvent("setom:chargement-order-changed", { detail: { orderId, date: loadingDate } }));
        setPage(nextPage);
        return;
      }
      const orderId = String(detail.orderId || "").trim();
      const osNumber = String(detail.osNumber || "").trim();
      if (orderId || osNumber) {
        let query = supabase.from("work_orders").select("*").limit(1);
        query = orderId ? query.eq("id", orderId) : query.eq("os_number", osNumber);
        const { data, error } = await query.maybeSingle();
        if (!error && data) setSelectedOS(data);
      }
      setPage(nextPage);
    };
    window.addEventListener("setom:navigate", handleSetomNavigate);
    return () => window.removeEventListener("setom:navigate", handleSetomNavigate);
  }, []);
'''

if 'window.addEventListener("setom:navigate", handleSetomNavigate)' not in text:
    if marker not in text:
        raise SystemExit("SETOM page state marker not found")
    text = text.replace(marker, insert, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: cross-module navigation event bridge applied")
