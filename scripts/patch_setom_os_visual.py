from pathlib import Path

p = Path('src/main.jsx')
s = p.read_text()
for line in [
    'import "./setom_os_visual.css";\n',
    'import "./setom_os_list_visual.css";\n',
    'import "./setom_planning_visual.css";\n',
]:
    if line not in s:
        s = line + s
p.write_text(s)
