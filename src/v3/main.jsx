import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import FleetOperationsOverlay from "./FleetOperationsOverlay";
import SetomIntelligenceOverlay from "./SetomIntelligenceOverlay";
import SetomRouteOptimizerOverlay from "./SetomRouteOptimizerOverlay";
import SetomOperationalMapOverlay from "./SetomOperationalMapOverlay";
import "./setom-reference.css";
import "./setom-operational-map.css";
import "./setom-sidebar-photo.css";
import "./SetomPerformanceOverlay";

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <FleetOperationsOverlay />
    <SetomIntelligenceOverlay />
    <SetomRouteOptimizerOverlay />
    <SetomOperationalMapOverlay />
  </>
);
