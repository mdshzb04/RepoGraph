"use client";

import type { WorkflowDiagram } from "./types";
import { WorkflowDiagramCanvas } from "./architecture-diagram-canvas";

export function WorkflowDiagramView({ workflow }: { workflow: WorkflowDiagram | null }) {
  return <WorkflowDiagramCanvas workflow={workflow} />;
}
