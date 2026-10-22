import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import FleetOperationsOverlay from "./FleetOperationsOverlay";
import SetomIntelligenceOverlay from "./SetomIntelligenceOverlay";

createRoot(document.getElementById("root")).render(<><App /><FleetOperationsOverlay /><SetomIntelligenceOverlay /></>);
