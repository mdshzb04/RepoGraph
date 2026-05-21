"use client";

import { useEffect, useState } from "react";
import { Layers, Map, Network, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArchitectureData, RepoMeta } from "./types";
import { parseJsonResponse } from "@/lib/api";
import { ArchitectureTopologyMap } from "./architecture-topology";
import { DependencyExplorer } from "./dependency-explorer";
import { ArchitectureExcalidrawDiagram, WorkflowExcalidrawDiagram } from "./architecture-excalidraw";
import { SectionHeader } from "./ui/section-header";
import { PanelScroll } from "./ui/panel-scroll";

type Layer = "overview" | "workflow" | "topology" | "dependencies";

const TABS: { id: Layer; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "System overview", icon: Layers },
  { id: "workflow", label: "Workflow", icon: Workflow },
  { id: "topology", label: "Topology", icon: Network },
  { id: "dependencies", label: "Dependencies", icon: Map },
];

function LayerShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="copilot-glass rounded-xl p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {hint && (
          <span className="ml-auto text-[10px] normal-case text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function ArchitecturePanel({
  repo,
  active,
}: {
  repo: RepoMeta | null;
  active?: boolean;
}) {
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("overview");

  useEffect(() => {
    if (!repo?.id) {
      setData(null);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetch(`/api/repos/${repo.id}/architecture`)
      .then(async (r) => {
        const json = await parseJsonResponse<ArchitectureData & { error?: string; code?: string }>(r);
        if (!r.ok) {
          throw new Error(json.error ?? "Architecture unavailable");
        }
        setData(json);
      })
      .catch((err) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : "Architecture unavailable");
      })
      .finally(() => setLoading(false));
  }, [repo?.id, active]);

  if (!repo) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Connect a repository to analyze architecture.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="p-8 font-mono text-sm text-muted-foreground">
        {">"} Loading architecture…
      </p>
    );
  }

  const routeCount = data?.analysis?.apiRoutes.length ?? 0;
  const serviceCount = data?.analysis?.services.length ?? 0;

  return (
    <PanelScroll>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <SectionHeader title="Architecture" description={repo.fullName} />

        {loadError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </p>
        )}

        <div className="flex flex-wrap gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayer(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors",
                layer === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Generated from indexed routes, imports, services, and manifests
          {routeCount > 0 && ` · ${routeCount} routes`}
          {serviceCount > 0 && ` · ${serviceCount} services`}
        </p>

        {layer === "overview" && (
          <LayerShell title="Architecture diagram" hint="Excalidraw · dagre layout">
            <ArchitectureExcalidrawDiagram topology={data?.topology ?? null} />
          </LayerShell>
        )}

        {layer === "workflow" && (
          <LayerShell title="Workflow diagram" hint="Excalidraw · request lifecycle">
            <WorkflowExcalidrawDiagram workflow={data?.workflow ?? null} />
          </LayerShell>
        )}

        {layer === "topology" && (
          <LayerShell title="System topology" hint="runtime + infrastructure">
            <ArchitectureTopologyMap topology={data?.topology ?? null} />
          </LayerShell>
        )}

        {layer === "dependencies" && (
          <LayerShell title="Service dependency map" hint="hover for metadata">
            <DependencyExplorer graph={data?.dependencyGraph ?? null} />
          </LayerShell>
        )}
      </div>
    </PanelScroll>
  );
}
