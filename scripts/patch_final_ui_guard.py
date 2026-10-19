from pathlib import Path
import re

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# 1) Never leave the OS detail dependent on a build-injected component name.
# Some of the historical build patches mutate main.jsx in sequence; keeping this
# section inline makes the final bundle lexical-scope safe on Safari/iOS.
text = re.sub(r'\n\s*<OSDossierPilotage\b[^>]*/>', '''
    <div className="setom-os-live-dossier">
      <div className="setom-os-live-hero">
        <div className="setom-os-live-photo">
          {attachments.find((item) => String(item?.mime_type || "").startsWith("image/") && item?.url)
            ? <img src={attachments.find((item) => String(item?.mime_type || "").startsWith("image/") && item?.url).url} alt={`Photo ${os?.id || "OS"}`} />
            : <div className="setom-os-live-photo-empty"><span>📷</span><strong>Photo chantier</strong><small>Aucune photo disponible pour cet OS</small></div>}
          {attachments.filter((item) => String(item?.mime_type || "").startsWith("image/") && item?.url).length > 1 && <div className="setom-os-live-photo-count">📷 {attachments.filter((item) => String(item?.mime_type || "").startsWith("image/") && item?.url).length} photos</div>}
        </div>
        <div className="setom-os-live-hero-meta">
          <span className="setom-os-live-kicker">Dossier opérationnel</span>
          <strong>{os?.id || "OS"}</strong>
          <span>{os?.address || "Adresse non renseignée"}</span>
          <div className="setom-os-live-status">● {os?.status || "Nouveau"}</div>
        </div>
      </div>
      <div className="setom-os-live-grid">
        <div className="setom-os-live-card"><small>PLANNING</small><strong>{os?.day || "Non planifié"}</strong><span>{os?.plannedDate ? new Date(os.plannedDate + "T12:00:00").toLocaleDateString("fr-FR") : "Date non définie"}</span></div>
        <div className="setom-os-live-card"><small>ÉQUIPE</small><strong>{os?.team || "Non affectée"}</strong><span>{os?.sector || "Secteur non classé"}</span></div>
        <div className="setom-os-live-card"><small>SURFACE RÉALISÉE</small><strong>{(Number(realRoadSurface) || 0) + (Number(realSidewalkSurface) || 0) + (Number(realOtherSurface) || 0) > 0 ? `${((Number(realRoadSurface) || 0) + (Number(realSidewalkSurface) || 0) + (Number(realOtherSurface) || 0)).toFixed(2)} m²` : "—"}</strong><span>{os?.quantity || "Surface prévue non renseignée"}</span></div>
        <div className="setom-os-live-card"><small>CONSTAT / FACTURATION</small><strong>{Number(constat?.total_amount) ? `${Number(constat.total_amount).toFixed(2)} €` : "—"}</strong><span>{constat?.status || os?.constatStatus || "Non généré"} · {constatLines.length} ligne(s)</span></div>
      </div>
    </div>''', text, count=1)

# Remove the now-unused injected component definition if present.
text = re.sub(r'\nfunction OSDossierPilotage\(\{.*?\n\}\n\n(?=function OSModal\()', '\n', text, count=1, flags=re.S)

# 2) Final navigation truth: all top-level navigation buttons must change App.page.
nav_re = re.compile(r'<nav className="nav"[^>]*>.*?</nav>', re.S)
nav_match = nav_re.search(text)
if not nav_match:
    raise SystemExit("SETOM final UI guard: navigation block not found")
nav = '''<nav className="nav" aria-label="Navigation SETOM">
        {[["dashboard","📊 Tableau de bord"],["os","📋 Ordres de service"],["travaux","🛠️ Travaux"],["planning","📅 Planning"],["chargement","🚛 Chargement"],["constat","💶 Constat"],["financier","📈 Financier"],["map","🗺️ Carte"],["teams","👷 Équipes"],["reserves","⚠️ Réserves"],["bpu","💶 Bordereau de prix"],["materials","🧱 Matériaux"],["settings","⚙️ Paramètres"],["access","🔐 Accès"]].filter(([id]) => {
          const role = currentProfile?.role;
          if (role === "admin") return true;
          if (role === "bureau") return ["dashboard","os","travaux","planning","chargement","constat","financier","map","reserves"].includes(id);
          if (role === "equipe_terrain") return ["dashboard","os","travaux","planning","chargement"].includes(id);
          if (role === "eau_de_toulouse") return ["dashboard","os","constat","reserves"].includes(id);
          return false;
        }).map(([id,label]) => <button key={id} type="button" aria-current={page === id ? "page" : undefined} className={page === id ? "active" : ""} onClick={() => { setSelectedOS(null); setShowNewOS(false); setShowOsFilters(false); setPage(id); }}>{label}</button>)}
      </nav>'''
text = text[:nav_match.start()] + nav + text[nav_match.end():]

# 3) Guarantee the four workflow pages exist even if an older patch was skipped.
required_pages = {
    "travaux": '''      {page === "travaux" && <><h2>Travaux</h2><p className="setom-page-intro">Suivi des travaux réalisés, mesures et photos terrain.</p><div className="os-list">{osList.filter((os) => ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os.status)).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}</div></>}
''',
    "chargement": '''      {page === "chargement" && <><h2>Chargement</h2><p className="setom-page-intro">Préparation des chargements et suivi des matériaux du jour.</p><div className="os-list">{osList.filter((os) => os.day || os.plannedDate).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}</div></>}
''',
    "constat": '''      {page === "constat" && <><h2>Constats</h2><p className="setom-page-intro">Suivi des constats et de la facturation.</p><div className="os-list">{osList.filter((os) => os.constatStatus || ["Travaux effectués","Constat à vérifier","Constat de facturation","En attente de validation","Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé"].includes(os.status)).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}</div></>}
''',
    "financier": '''      {page === "financier" && <><h2>Pilotage financier</h2><p className="setom-page-intro">Vue financière des OS transmis pour facturation.</p><div className="cards"><div className="card"><div>À facturer</div><div className="number">{stats.facturation}</div></div><div className="card"><div>En validation</div><div className="number">{stats.validation}</div></div><div className="card"><div>Réserves</div><div className="number">{stats.reserves}</div></div></div></>}
'''
}
for page, block in required_pages.items():
    if f'page === "{page}"' not in text:
        anchor = re.search(r'\n\s*\{page === "dashboard"', text)
        if not anchor:
            raise SystemExit("SETOM final UI guard: dashboard page anchor not found")
        text = text[:anchor.start()] + "\n" + block + text[anchor.start():]

path.write_text(text, encoding="utf-8")

css = Path("src/brochureVisuals.css")
css_text = css.read_text(encoding="utf-8") if css.exists() else ""
css_text += '''\n/* Final UI guard: deterministic OS card media box across all source image ratios. */\n.setom-brochure-os-photo{height:190px!important;min-height:190px!important;aspect-ratio:4/3;overflow:hidden}\n.setom-brochure-os-photo img{width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;object-fit:cover!important;object-position:center!important;display:block!important}\n.setom-brochure-photo-empty{height:100%!important;min-height:0!important}\n@media(max-width:979px){.setom-brochure-os-photo{height:180px!important;min-height:180px!important;aspect-ratio:16/9}.setom-brochure-os-photo img{height:180px!important}}\n@media(max-width:560px){.setom-brochure-os-photo{height:170px!important;min-height:170px!important}.setom-brochure-os-photo img{height:170px!important}}\n'''
css.write_text(css_text, encoding="utf-8")
print("SETOM: final UI guard applied")
