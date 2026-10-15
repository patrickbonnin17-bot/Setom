import React from "react";
import { OS_STATUS_LEGEND } from "./statusColors";

export default function StatusLegend({ compact = false }) {
  return <div className={compact ? "setom-status-legend compact" : "setom-status-legend"} aria-label="Légende des couleurs des statuts OS">
    {OS_STATUS_LEGEND.map((item) => <span className="setom-status-legend-item" key={item.label}>
      <i aria-hidden="true" style={{ backgroundColor: item.accent }} />
      <span>{item.label}</span>
    </span>)}
  </div>;
}
