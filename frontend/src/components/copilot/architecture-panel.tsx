"use client";

import { useEffect, useState } from "react";
import { Layers, Map, Network, RefreshCw, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArchitectureData, RepoMeta } from "./types";
import { parseJsonResponse } from "@/lib/api";
import { ArchitectureTopologyMap } from "./architecture-topology";
import { DependencyExplorer } from "./dependency-explorer";
import { ArchitectureExcalidrawDiagram } from "./architecture-excalidraw";
import { MermaidDiagram } from "./mermaid-diagram";
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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!repo?.id) {
      setData(null);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const qs = refreshKey > 0 ? "?refresh=1" : "";
    fetch(`/api/repos/${repo.id}/architecture${qs}`)
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
  }, [repo?.id, active, refreshKey]);

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
  const workflowMermaid = data?.workflowMermaid ?? data?.claudeWorkflowMermaid ?? "";

  return (
    <PanelScroll>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-3">
          <SectionHeader title="Architecture" description={repo.fullName} />
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            title="Regenerate AI insights"
          >
            <RefreshCw className="size-3.5" />
            Refresh AI
          </button>
        </div>

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
          Static analysis + AI refinement
          {data?.aiInsightsGeneratedAt &&
            ` · AI ${new Date(data.aiInsightsGeneratedAt).toLocaleString()}`}
          {data?.aiInsightsProvider && ` · ${data.aiInsightsProvider}`}
          {routeCount > 0 && ` · ${routeCount} routes detected`}
          {serviceCount > 0 && ` · ${serviceCount} services`}
        </p>

        {layer === "overview" && (
          <LayerShell title="Architecture diagram" hint="Excalidraw · dagre layout">
            <ArchitectureExcalidrawDiagram topology={data?.topology ?? null} />
          </LayerShell>
        )}

        {layer === "workflow" && (
          <LayerShell
            title="Workflow diagram"
            hint="Request lifecycle · interactive Mermaid"
          >
            {workflowMermaid ? (
              <MermaidDiagram chart={workflowMermaid} minHeight={400} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No workflow diagram — index repository first.
              </p>
            )}
          </LayerShell>
        )}

        {layer === "topology" && (
          <LayerShell title="System topology" hint="runtime + infrastructure">
            <ArchitectureTopologyMap topology={data?.topology ?? null} />
          </LayerShell>
        )}

        {layer === "dependencies" && (
          <div className="space-y-4">
            {data?.dependencyAnalysis && (
              <LayerShell title="Dependency summary" hint="AI cluster overview">
                <div className="prose prose-invert max-w-none text-sm text-muted-foreground">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                    {data.dependencyAnalysis}
                  </pre>
                </div>
              </LayerShell>
            )}
            <LayerShell title="Service dependency map" hint="expand clusters · hover edges">
              <DependencyExplorer graph={data?.dependencyGraph ?? null} />
            </LayerShell>
          </div>
        )}
      </div>
    </PanelScroll>
  );
}
