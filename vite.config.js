import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const setomWorkTabPlugin = {
  name: "setom-work-tab-plugin",
  transform(code, id) {
    if (!id.endsWith("/src/v2/App.jsx")) return null;
    const start = code.indexOf("function WorkTab(");
    const end = code.indexOf("function PhotosTab(", start);
    if (start === -1 || end === -1) return null;
    const replacement = "function WorkTab({os,updateOs,onSaved}){return React.createElement(WorkMeasurements,{os,updateOs,onSaved})}\n";
    const withWorkTab = code.slice(0, start) + replacement + code.slice(end);
    const next = withWorkTab.replace('<WorkTab os={os} updateOs={updateOs}/>', '<WorkTab os={os} updateOs={updateOs} onSaved={()=>setTab("photos")}/>');
    return { code: `import WorkMeasurements from \"./WorkMeasurements\";\n${next}`, map: null };
  },
};

export default defineConfig({ plugins: [setomWorkTabPlugin, react()] });
