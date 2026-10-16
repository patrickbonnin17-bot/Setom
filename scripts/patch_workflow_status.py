from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
replacements = [
    (
        'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);',
        'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status);'
    ),
    (
        'if(!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status)){alert("Le statut actuel de cet OS ne permet pas de transmettre les travaux : "+(os?.status||"non renseigné")+".");return;}',
        'if(!["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status)){alert("Le statut actuel de cet OS ne permet pas de transmettre les travaux : "+(os?.status||"non renseigné")+".");return;}'
    ),
    (
        '["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>',
        '["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>'
    ),
    (
        '{!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}',
        '{!["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}'
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Patch target not found: {old[:120]}")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: En travaux is editable/transmittable in Travaux")
