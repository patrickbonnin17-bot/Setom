from pathlib import Path

main = Path("src/main.jsx")
s = main.read_text(encoding="utf-8")
needle = 'import "./chargementRotations";'
line = 'import "./productivityLearningOverlay";'
if line not in s:
    if needle in s:
        s = s.replace(needle, needle + "\n" + line, 1)
    else:
        s = s + "\n" + line + "\n"
main.write_text(s, encoding="utf-8")
print("SETOM: productivity learning overlay wired")
