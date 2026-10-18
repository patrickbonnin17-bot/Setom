from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OVERLAY = ROOT / "src" / "productivityLearningOverlay.js"
STAFFING = ROOT / "src" / "staffingIntelligence.js"
o = OVERLAY.read_text(encoding="utf-8")
o = o.replace('const observation={id:`obs-${Date.now()}`,date:today(),osId:order.orderId||order.id||null,osNumber:order.osNumber||null,workType:type,quantity:num(root.querySelector("#pl-qty").value),unit:root.querySelector("#pl-unit").value,thicknessCm:num(root.querySelector("#pl-thickness").value),people,durationHours:num(root.querySelector("#pl-duration").value),traffic:root.querySelector("#pl-traffic").value,access:root.querySelector("#pl-access").value,createdAt:new Date().toISOString()};', 'const quantity=num(root.querySelector("#pl-qty").value); const unit=root.querySelector("#pl-unit").value; const observation={id:`obs-${Date.now()}`,date:today(),osId:order.orderId||order.id||null,osNumber:order.osNumber||null,orderId:order.orderId||order.id||null,workType:type,quantity,unit,surfaceM2:unit==="m²"?quantity:0,quantityT:unit==="t"?quantity:0,thicknessCm:num(root.querySelector("#pl-thickness").value),people,crewCount:people,durationHours:num(root.querySelector("#pl-duration").value),actualHours:num(root.querySelector("#pl-duration").value),traffic:root.querySelector("#pl-traffic").value,trafficLevel:root.querySelector("#pl-traffic").value,access:root.querySelector("#pl-access").value,accessLevel:root.querySelector("#pl-access").value,createdAt:new Date().toISOString()};')
OVERLAY.write_text(o, encoding="utf-8")
s = STAFFING.read_text(encoding="utf-8")
s = s.replace('beton: { label: "Béton", minimum: 3, productivityTPerPersonHour: 0.65 },', 'beton: { label: "Béton", minimum: 0, productivityTPerPersonHour: 0.65 },')
s = s.replace('const OBS_KEY = "setom:productivity:observations:v1";', 'const OBS_KEY = "setom:productivity:observations:v1";\nconst LEARNING_KEY = "setom:productivity-observations:v1";')
s = s.replace('const value = JSON.parse(localStorage.getItem(OBS_KEY) || "[]");\n    return Array.isArray(value) ? value : [];', 'const a = JSON.parse(localStorage.getItem(OBS_KEY) || "[]");\n    const b = JSON.parse(localStorage.getItem(LEARNING_KEY) || "[]");\n    const sourceA = Array.isArray(a) ? a : [];\n    const sourceB = Array.isArray(b) ? b : [];\n    return [...sourceA, ...sourceB].slice(-2000);')
start = s.index('function historicalSignal(type) {')
end = s.index('\nfunction buildRecommendation()', start)
new_hist = '''function historicalSignal(type, surfaceM2 = 0, thicknessCm = 0) {
  const observations = readObservations().filter((o) => o.workType === type && num(o.actualHours || o.durationHours) > 0 && num(o.crewCount || o.people) > 0);
  if (!observations.length) return { count: 0, confidence: "initiale", productivity: null, surfaceRate: null, timePerOS: null };
  const comparable = observations.filter((o) => {
    const s = num(o.surfaceM2), t = num(o.thicknessCm);
    return (!surfaceM2 || !s || Math.abs(s - surfaceM2) / Math.max(surfaceM2, 0.5) < 0.75) && (!thicknessCm || !t || Math.abs(t - thicknessCm) <= 2);
  });
  const pool = comparable.length >= 3 ? comparable : observations;
  const rates = pool.map((o) => {
    const hours = Math.max(0.25, num(o.actualHours || o.durationHours));
    const crew = Math.max(1, num(o.crewCount || o.people));
    const surface = num(o.surfaceM2), tonnes = num(o.quantityT);
    return { surfaceRate: surface > 0 ? surface / (hours * crew) : 0, tonneRate: tonnes > 0 ? tonnes / (hours * crew) : 0, timePerOS: hours };
  });
  const avg = (key) => { const v = rates.map((x) => x[key]).filter((x) => x > 0); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  return { count: pool.length, confidence: pool.length >= 30 ? "bonne" : pool.length >= 10 ? "moyenne" : "faible", productivity: avg("tonneRate"), surfaceRate: avg("surfaceRate"), timePerOS: rates.reduce((a,b)=>a+b.timePerOS,0)/rates.length };
}
'''
s = s[:start] + new_hist + s[end:]
old = 'const signal = historicalSignal(group.type);\n    const productivity = signal.productivity || num(rule.productivityTPerPersonHour);\n    const baseHours = group.quantityT / Math.max(0.1, productivity * Math.max(1, rule.minimum));\n    const crew = Math.max(rule.minimum, Math.ceil(group.quantityT / Math.max(0.1, productivity * 8)));\n    return { ...group, osCount: group.os.size, minimum: rule.minimum, crew, estimatedHours: round(baseHours), confidence: signal.confidence, historyCount: signal.count };'
new = 'const representative = group.rows[0] || {};\n    const signal = historicalSignal(group.type, num(representative.surfaceM2), num(representative.thicknessCm));\n    const productivity = signal.productivity || num(rule.productivityTPerPersonHour);\n    const minimum = Math.max(1, num(rule.minimum));\n    const baseHours = signal.timePerOS && group.os.size ? signal.timePerOS * group.os.size : group.quantityT / Math.max(0.1, productivity * minimum);\n    const crew = Math.max(minimum, Math.ceil(group.quantityT / Math.max(0.1, productivity * 8)));\n    return { ...group, osCount: group.os.size, minimum, crew, estimatedHours: round(baseHours), confidence: signal.confidence, historyCount: signal.count, surfaceAware: Boolean(representative.surfaceM2 || signal.surfaceRate) };'
if old not in s: raise SystemExit("staffing recommendation block not found")
s = s.replace(old, new)
s = s.replace('window.addEventListener("storage", mount);', 'window.addEventListener("storage", mount);\n  window.addEventListener("setom:productivity-observation", mount);')
STAFFING.write_text(s, encoding="utf-8")
print("SETOM: productivity surface model connected to staffing intelligence")
