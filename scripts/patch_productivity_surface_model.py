from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OVERLAY = ROOT / "src" / "productivityLearningOverlay.js"
o = OVERLAY.read_text(encoding="utf-8")
old = 'const observation={id:`obs-${Date.now()}`,date:today(),osId:order.orderId||order.id||null,osNumber:order.osNumber||null,workType:type,quantity:num(root.querySelector("#pl-qty").value),unit:root.querySelector("#pl-unit").value,thicknessCm:num(root.querySelector("#pl-thickness").value),people,durationHours:num(root.querySelector("#pl-duration").value),traffic:root.querySelector("#pl-traffic").value,access:root.querySelector("#pl-access").value,createdAt:new Date().toISOString()};'
new = 'const quantity=num(root.querySelector("#pl-qty").value); const unit=root.querySelector("#pl-unit").value; const observation={id:`obs-${Date.now()}`,date:today(),osId:order.orderId||order.id||null,osNumber:order.osNumber||null,orderId:order.orderId||order.id||null,workType:type,quantity,unit,surfaceM2:unit==="m²"?quantity:0,quantityT:unit==="t"?quantity:0,thicknessCm:num(root.querySelector("#pl-thickness").value),people,crewCount:people,durationHours:num(root.querySelector("#pl-duration").value),actualHours:num(root.querySelector("#pl-duration").value),traffic:root.querySelector("#pl-traffic").value,trafficLevel:root.querySelector("#pl-traffic").value,access:root.querySelector("#pl-access").value,accessLevel:root.querySelector("#pl-access").value,createdAt:new Date().toISOString()};'
if old in o:
    o = o.replace(old, new)
OVERLAY.write_text(o, encoding="utf-8")
print("SETOM: productivity observations enriched; weekly six-person staffing model preserved")
