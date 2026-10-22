import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import FleetOperationsOverlay from "./FleetOperationsOverlay";

createRoot(document.getElementById("root")).render(<><App /><FleetOperationsOverlay /></>);
