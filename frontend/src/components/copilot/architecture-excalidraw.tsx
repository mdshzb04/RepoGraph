"use client";

import { useMemo } from "react";
import { layoutToExcalidraw } from "@/lib/excalidraw-from-layout";
import { layoutTopology, layoutWorkflow } from "@/lib/diagram-layout";
import type { ArchitectureTopology, WorkflowDiagram } from "./types";
import { ExcalidrawViewer } from "./excalidraw-viewer";

export function ArchitectureExcalidrawDiagram({
  topology,
}: {
  topology: ArchitectureTopology | null;
}) {
  const scene = useMemo(() => {
    const layout = topology ? layoutTopology(topology) : null;
    return layout ? layoutToExcalidraw(layout) : null;
  }, [topology]);
  return <ExcalidrawViewer scene={scene} />;
}

export function WorkflowExcalidrawDiagram({
  workflow,
}: {
  workflow: WorkflowDiagram | null;
}) {
  const scene = useMemo(() => {
    const layout = workflow ? layoutWorkflow(workflow) : null;
    return layout ? layoutToExcalidraw(layout) : null;
  }, [workflow]);
  return <ExcalidrawViewer scene={scene} />;
}
