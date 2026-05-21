"use client";

import { FileCode2, Info, Layers, Timer } from "lucide-react";
import type { RepoIntel } from "../types";
import { IntelPanels } from "./intel-panels";
import { INDEX_CONFIDENCE_NOTE } from "./intel-utils";
import { HealthScoreRing } from "../ui/health-score-ring";
import { StatCard } from "../ui/stat-card";

function formatIndexed(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function RepoIntelOverview({ intel }: { intel: RepoIntel }) {
  const indexSec = intel.indexingDurationMs
    ? `${(intel.indexingDurationMs / 1000).toFixed(1)}s`
    : "—";

  return (
    <div className="space-y-4">
      <div className="copilot-glass rounded-lg border border-border/40 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          How this report is built
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {intel.analysis.method}. Last pass: {intel.analysis.pathsScanned} paths,{" "}
          {intel.analysis.chunksSampled} sampled chunks, {intel.analysis.manifestCount}{" "}
          manifests. <span className="text-foreground/80">File-backed</span> signals come
          from manifests or paths; <span className="text-foreground/80">Reference only</span>{" "}
          from string matches in code samples.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Files in index" value={intel.fileCount} sub="from last sync" />
        <StatCard label="Semantic chunks" value={intel.chunkCount} sub="retrieval units" />
        <StatCard label="Sync duration" value={indexSec} />
        <StatCard
          label="Vector index"
          value={intel.embeddingsReady ? "Online" : "Pending"}
          sub={intel.embeddingsReady ? "embeddings written" : "not ready"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {intel.health && (
          <div className="copilot-glass flex flex-col gap-3 rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Operational posture
            </p>
            <p className="text-sm text-foreground/90">{intel.health.posture}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {intel.health.summary}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {INDEX_CONFIDENCE_NOTE[intel.health.indexConfidence]}
            </p>
            <div className="flex gap-4 border-t border-border/30 pt-3">
              <HealthScoreRing
                score={intel.health.overall}
                posture={intel.health.posture}
                size="sm"
              />
              <ul className="min-w-0 flex-1 space-y-2.5">
                {intel.health.categories.map((c) => (
                  <li key={c.label} className="text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="shrink-0 text-foreground/75">{c.statusLabel}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {c.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="copilot-glass rounded-xl p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Layers className="size-3.5" />
            Language distribution
          </p>
          {intel.languages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No breakdown in stored index.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {intel.languages.map((lang) => (
                <li key={lang.name} className="flex justify-between">
                  <span>{lang.name}</span>
                  <span className="text-muted-foreground">
                    {lang.count} files ({lang.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Timer className="size-3" />
            Snapshot {formatIndexed(intel.indexedAt)}
          </p>
        </div>
      </div>

      <IntelPanels intel={intel} />

      {intel.summary && (
        <div className="copilot-glass rounded-xl p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileCode2 className="size-3.5" />
            Generated overview
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{intel.summary}</p>
        </div>
      )}
    </div>
  );
}
