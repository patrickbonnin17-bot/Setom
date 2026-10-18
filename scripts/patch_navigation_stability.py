from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old_nav = '''      <nav className="nav">
        {[["dashboard","📊 Tableau de bord"],["os","📋 OS"],["map","🗺️ Carte"],["planning","📅 Planning"],["teams","👷 Équipes"],["reserves","⚠️ Réserves"],["bpu","💶 Bordereau de prix"],["materials","🧱 Matériaux"],["settings","⚙️ Paramètres"],["access","🔐 Accès"]].filter(([id]) => {
          const role = currentProfile?.role;
          if (role === "admin") return true;
          if (role === "bureau") return ["dashboard","os","map","planning","reserves"].includes(id);
          if (role === "equipe_terrain") return ["dashboard","os","planning"].includes(id);
          if (role === "eau_de_toulouse") return ["dashboard","os","reserves"].includes(id);
          return false;
        }).map(([id,label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>{label}</button>)}
      </nav>'''

new_nav = '''      <nav className="nav" aria-label="Navigation SETOM">
        {[["dashboard","📊 Tableau de bord"],["os","📋 Ordres de service"],["travaux","🛠️ Travaux"],["planning","📅 Planning"],["chargement","🚛 Chargement"],["constat","💶 Constat"],["financier","📈 Financier"],["map","🗺️ Carte"],["teams","👷 Équipes"],["reserves","⚠️ Réserves"],["bpu","💶 Bordereau de prix"],["materials","🧱 Matériaux"],["settings","⚙️ Paramètres"],["access","🔐 Accès"]].filter(([id]) => {
          const role = currentProfile?.role;
          if (role === "admin") return true;
          if (role === "bureau") return ["dashboard","os","travaux","planning","chargement","constat","financier","map","reserves"].includes(id);
          if (role === "equipe_terrain") return ["dashboard","os","travaux","planning","chargement"].includes(id);
          if (role === "eau_de_toulouse") return ["dashboard","os","constat","reserves"].includes(id);
          return false;
        }).map(([id,label]) => <button key={id} type="button" aria-current={page === id ? "page" : undefined} className={page === id ? "active" : ""} onClick={() => { setSelectedOS(null); setShowNewOS(false); setShowOsFilters(false); setPage(id); }}>{label}</button>)}
      </nav>'''

if old_nav not in text:
    raise SystemExit("SETOM navigation marker not found")
text = text.replace(old_nav, new_nav, 1)

marker = '      {page === "map" && <><h2>Carte des interventions</h2>'
insert = '''      {page === "travaux" && <><h2>Travaux</h2><p className="setom-page-intro">Accès direct aux OS en préparation, en travaux et réalisés. Ouvrez un OS pour saisir les mesures réelles, les photos et transmettre les travaux.</p><StatusLegend compact /><div className="os-list">{osList.filter((os) => ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os.status)).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}{osList.filter((os) => ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os.status)).length === 0 && <div className="card">Aucun OS dans le circuit travaux.</div>}</div></>}
      {page === "chargement" && <><h2>Chargement</h2><p className="setom-page-intro">Préparation des chargements et suivi des matériaux pour les interventions du jour.</p><div className="cards"><div className="card"><div>OS planifiés</div><div className="number">{osList.filter((os) => !!os.plannedDate).length}</div></div><div className="card"><div>OS avec matériau</div><div className="number">{osList.filter((os) => !!os.work).length}</div></div><div className="card"><div>Surface prévue</div><div className="number">{Math.round(osList.reduce((sum, os) => sum + (Number(String(os.quantity || "").replace(" m²", "").replace(",", "."))) || 0, 0))} m²</div></div></div><div className="os-list">{osList.filter((os) => os.day || os.plannedDate).slice(0, 20).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}{osList.filter((os) => os.day || os.plannedDate).length === 0 && <div className="card">Aucun chargement planifié pour le moment.</div>}</div></>}
      {page === "constat" && <><h2>Constats</h2><p className="setom-page-intro">Suivi centralisé des constats à vérifier, à valider, validés et mis en réserve.</p><div className="os-list">{osList.filter((os) => os.constatStatus || ["Travaux réalisés","Travaux effectués","Constat à vérifier","Constat de facturation","En attente de validation","Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé"].includes(os.status)).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}{osList.filter((os) => os.constatStatus || ["Travaux réalisés","Travaux effectués","Constat à vérifier","Constat de facturation","En attente de validation","Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé"].includes(os.status)).length === 0 && <div className="card">Aucun constat à traiter.</div>}</div></>}
      {page === "financier" && <><h2>Pilotage financier</h2><p className="setom-page-intro">Vue rapide des OS entrés dans le circuit de facturation.</p><div className="cards"><div className="card"><div>À facturer</div><div className="number">{stats.facturation}</div></div><div className="card"><div>En validation</div><div className="number">{stats.validation}</div></div><div className="card"><div>Réserves bloquantes</div><div className="number">{stats.reserves}</div></div><div className="card"><div>Payés</div><div className="number">{osList.filter((os) => os.status === "Payé").length}</div></div></div><div className="os-list">{osList.filter((os) => ["Travaux effectués","Constat de facturation","En attente de validation","Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé"].includes(os.status) || os.constatStatus).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}{osList.filter((os) => ["Travaux effectués","Constat de facturation","En attente de validation","Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé"].includes(os.status) || os.constatStatus).length === 0 && <div className="card">Aucun OS dans le circuit financier.</div>}</div></>}
'''

if marker not in text:
    raise SystemExit("SETOM page insertion marker not found")
text = text.replace(marker, insert + marker, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: navigation stability and workflow entry pages applied")
