"use client";

import {
  Box,
  Cpu,
  DollarSign,
  FolderTree,
  Rocket,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RepoIntel } from "../types";
import {
  CHECK_CLASS,
  CHECK_LABEL,
  CONFIDENCE_BADGE,
  CONFIDENCE_LABEL,
  formatUsdRange,
} from "./intel-utils";

function Panel({
  title,
  icon: Icon,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="copilot-glass rounded-xl p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </p>
      {subtitle && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfraSection({
  title,
  items,
}: {
  title: string;
  items: RepoIntel["infrastructure"];
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-2.5 text-xs">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{item.label}</span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[9px]",
                  CONFIDENCE_BADGE[item.confidence]
                )}
              >
                {CONFIDENCE_LABEL[item.confidence]}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{item.evidence}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IntelPanels({ intel }: { intel: RepoIntel }) {
  const detectedInfra = intel.infrastructure.filter((i) => i.confidence === "detected");
  const inferredInfra = intel.infrastructure.filter((i) => i.confidence === "inferred");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Release & packaging signals"
        icon={Rocket}
        subtitle="Manifest and path heuristics — not a substitute for a deploy pipeline review"
      >
        <p className="mb-2 text-xs text-muted-foreground">{intel.deployment.structure}</p>
        {intel.deployment.isMonorepo && (
          <p className="mb-2 text-[10px] text-muted-foreground">
            Workspace layout suggests a monorepo
          </p>
        )}
        <ul className="space-y-2 text-xs">
          {intel.deployment.checks.map((c) => (
            <li key={c.label} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{c.label}</span>
              <span className={cn("shrink-0", CHECK_CLASS[c.status])}>
                {CHECK_LABEL[c.status] ?? c.status}
              </span>
            </li>
          ))}
        </ul>
        {intel.deployment.blockers.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Blockers noted: {intel.deployment.blockers.join("; ")}
          </p>
        )}
      </Panel>

      <Panel
        title="Security observations"
        icon={Shield}
        subtitle="Static sample only — no dependency CVE scan or secret vault audit"
      >
        <ul className="space-y-2.5 text-xs">
          {intel.security.findings.map((f) => (
            <li key={f.label}>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{f.label}</span>
                <span className={cn("shrink-0", CHECK_CLASS[f.status])}>
                  {CHECK_LABEL[f.status] ?? f.status}
                </span>
              </div>
              {f.detail && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{f.detail}</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Directory concentration"
        icon={FolderTree}
        subtitle="Where indexed files cluster — not commit velocity or ownership"
      >
        {intel.activity.topDirs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Per-file map unavailable.</p>
        ) : (
          <ul className="space-y-1.5 font-mono text-[11px]">
            {intel.activity.topDirs.map((d) => (
              <li key={d.dir} className="flex justify-between">
                <span className="text-muted-foreground">{d.dir}/</span>
                <span className="text-foreground/70">{d.files}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Chunk-dense paths"
        icon={Zap}
        subtitle="Files that produced the most retrieval segments in this index"
      >
        {intel.hotModules.length === 0 ? (
          <p className="text-xs text-muted-foreground">No per-file chunk stats stored.</p>
        ) : (
          <ul className="space-y-1.5 font-mono text-[11px]">
            {intel.hotModules.map((m) => (
              <li key={m.path} className="flex justify-between gap-2">
                <span className="truncate text-muted-foreground">{m.path}</span>
                <span className="shrink-0 text-muted-foreground">{m.chunks}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Model spend (indicative)" icon={DollarSign} subtitle={intel.aiCost.disclaimer}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Index pass</p>
            <p className="mt-0.5 font-mono text-sm text-foreground/90">
              {formatUsdRange(intel.aiCost.indexRangeUsd)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Light ongoing use</p>
            <p className="mt-0.5 font-mono text-sm text-foreground/90">
              {formatUsdRange(intel.aiCost.monthlyRangeUsd)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Pricing basis: {intel.aiCost.model} public rates × indexed footprint
        </p>
      </Panel>

      <Panel
        title="LLM integrations"
        icon={Cpu}
        subtitle="What appears in dependencies or sampled imports"
      >
        {intel.providers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No provider SDKs matched in this index.
          </p>
        ) : (
          <ul className="space-y-2.5 text-xs">
            {intel.providers.map((p) => (
              <li key={p.name}>
                <div className="flex justify-between gap-2">
                  <span>{p.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1.5 py-0.5 text-[9px]",
                      CONFIDENCE_BADGE[p.confidence]
                    )}
                  >
                    {CONFIDENCE_LABEL[p.confidence]}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{p.evidence}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Retrieval pipeline"
        icon={Search}
        subtitle={intel.rag.summary}
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Indicative fit {intel.rag.indicativeScore}/100 — confirm with eval queries on your
          data
        </p>
        <ul className="space-y-2 text-xs">
          {intel.rag.factors.map((f) => (
            <li key={f.label}>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="text-foreground/75">{f.statusLabel}</span>
              </div>
              {f.note && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{f.note}</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Runtime & platform signals"
        icon={Box}
        subtitle="Only components with evidence in the indexed tree are listed"
      >
        {intel.infrastructure.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No container, orchestration, or datastore manifests matched.
          </p>
        ) : (
          <div className="space-y-4">
            <InfraSection title="File-backed" items={detectedInfra} />
            <InfraSection title="Reference only" items={inferredInfra} />
          </div>
        )}
      </Panel>
    </div>
  );
}
