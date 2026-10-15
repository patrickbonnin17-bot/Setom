from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old_can = 'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);'
new_can = 'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["À planifier","Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);'
if old_can not in text:
    raise SystemExit("canEditWork pattern not found")
text = text.replace(old_can, new_can, 1)

old_actions = '{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button>}{!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}'
new_actions = '{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button>}{os?.status === "À planifier" && <span style={{ color: "#667085", fontSize: 13 }}>Préparation possible : renseignez les mesures et ajoutez les photos. La transmission sera disponible après planification.</span>}{!["À planifier","Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}'
if old_actions not in text:
    raise SystemExit("work actions pattern not found")
text = text.replace(old_actions, new_actions, 1)

path.write_text(text, encoding="utf-8")

css = Path("src/style.css")
style = css.read_text(encoding="utf-8")
old_css = '.attachment-button input {\n  display: none;\n}'
new_css = '.attachment-button {\n  position: relative;\n  overflow: hidden;\n  touch-action: manipulation;\n}\n\n.attachment-button input {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  opacity: 0;\n  display: block;\n  cursor: pointer;\n  z-index: 2;\n}'
if old_css not in style:
    raise SystemExit("attachment input CSS pattern not found")
style = style.replace(old_css, new_css, 1)
css.write_text(style, encoding="utf-8")
