from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Draft entry may be available from Nouveau/À planifier, but final transmission
# must only appear once the OS is planned or already in the active work phase.
text = text.replace(
    '["Nouveau","À planifier","Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}',
    '["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}'
)
text = text.replace(
    '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}',
    '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}'
)

path.write_text(text, encoding="utf-8")
print("SETOM: final Travaux transmission guard applied")
