from pathlib import Path

p = Path('src/main.jsx')
s = p.read_text(encoding='utf-8')

marker = 'const [workComment, setWorkComment] = useState("");'
insert = '''const [workComment, setWorkComment] = useState("");
const [constat, setConstat] = useState(null);
const [constatLines, setConstatLines] = useState([]);
const [constatLoading, setConstatLoading] = useState(false);

useEffect(() => {
  if (!os?.dbId) return;
  async function loadConstat() {
    setConstatLoading(true);
    const { data, error } = await supabase
      .from("constats")
      .select("*")
      .eq("work_order_id", os.dbId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Erreur chargement constat :", error);
      setConstat(null);
      setConstatLines([]);
      setConstatLoading(false);
      return;
    }
    setConstat(data || null);
    if (data?.id) {
      const { data: lines, error: linesError } = await supabase
        .from("constat_lines")
        .select("*")
        .eq("constat_id", data.id)
        .order("id");
      if (linesError) console.error("Erreur chargement lignes constat :", linesError);
      setConstatLines(lines || []);
    } else {
      setConstatLines([]);
    }
    setConstatLoading(false);
  }
  loadConstat();
}, [os?.dbId]);'''
if marker in s and 'const [constat, setConstat]' not in s:
    s = s.replace(marker, insert, 1)

marker2 = '''    // 6. Mettre également l'affichage de l'application à jour
    onUpdate(os.id, {'''
insert2 = '''    // 6. Générer / régénérer le constat de facturation en brouillon.
    const { error: constatError } = await supabase.rpc(
      "generate_constat_for_work_order",
      { p_work_order_id: os.dbId, p_user_id: user.id }
    );
    if (constatError) {
      console.error("Erreur génération constat :", constatError);
      alert("⚠️ Les travaux sont enregistrés, mais le constat n'a pas pu être généré :\\n\\n" + constatError.message);
    }

    // 7. Mettre également l'affichage de l'application à jour
    onUpdate(os.id, {'''
if marker2 in s and 'p_work_order_id: os.dbId' not in s:
    s = s.replace(marker2, insert2, 1)

old = '''          {activeTab === "constat" && (
            <div className="os-section">

              <h3>Constat de facturation</h3>

              <div className="os-empty-state">
                💶
                <strong>Constat non créé</strong>
                <span>
                  Le constat sera généré automatiquement
                  lorsque les travaux seront déclarés
                  effectués.
                </span>
              </div>

            </div>
          )}'''
new = '''          {activeTab === "constat" && (
            <div className="os-section">
              <h3>Constat de facturation</h3>
              {constatLoading ? (
                <div className="os-empty-state"><strong>Chargement du constat...</strong></div>
              ) : !constat ? (
                <div className="os-empty-state">
                  💶<strong>Constat non créé</strong>
                  <span>Le constat sera créé automatiquement après l'enregistrement des travaux réalisés.</span>
                </div>
              ) : (
                <div>
                  <div className="os-info-grid">
                    <div><span>Statut</span><strong>{constat.status || "Brouillon"}</strong></div>
                    <div><span>Date</span><strong>{constat.constat_date ? new Date(constat.constat_date).toLocaleDateString("fr-FR") : "—"}</strong></div>
                    <div><span>Total</span><strong>{Number(constat.total_amount || 0).toFixed(2)} €</strong></div>
                  </div>
                  <h4>Détail des prestations</h4>
                  {constatLines.map((line) => (
                    <div className="os-info-grid" key={line.id}>
                      <div><span>{line.designation}</span><strong>{Number(line.quantity || 0).toFixed(2)} {line.unit || ""} × {Number(line.unit_price || 0).toFixed(2)} € = {Number(line.amount || 0).toFixed(2)} €</strong></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}'''
if old in s:
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
