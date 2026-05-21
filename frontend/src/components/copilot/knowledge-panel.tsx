"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KnowledgeData, RepoMeta, SearchHit } from "./types";
import { SectionHeader } from "./ui/section-header";
import { StatCard } from "./ui/stat-card";
import { TerminalLog } from "./ui/terminal-log";
import { PanelScroll } from "./ui/panel-scroll";

function vectorLabel(health?: string): string {
  if (health === "healthy") return "Online";
  if (health === "degraded") return "Degraded";
  return "Offline";
}

export function KnowledgePanel({
  repo,
  active,
}: {
  repo: RepoMeta | null;
  active?: boolean;
}) {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fileFilter, setFileFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!repo?.id) {
      setData(null);
      setLoadError(null);
      return;
    }

    setLoadError(null);
    fetch(`/api/repos/${repo.id}/knowledge`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load knowledge");
        setData(json);
      })
      .catch((err) => {
        setData(null);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load knowledge"
        );
      });
  }, [repo?.id, active]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!repo?.id || !searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/repos/${repo.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQ }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setHits(json.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  if (!repo) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Connect a repository to open semantic memory.
      </p>
    );
  }

  const fileCount = data?.fileCount ?? repo.fileCount ?? 0;
  const chunkCount = data?.chunkCount ?? repo.chunkCount ?? 0;
  const embeddingsReady = data?.embeddingsReady ?? repo.embeddingsReady ?? false;
  const vectorDbHealth =
    data?.vectorDbHealth ?? repo.vectorDbHealth ?? "offline";

  const files = (data?.files ?? []).filter((f) =>
    f.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  return (
    <PanelScroll>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <SectionHeader
          title="Knowledge base"
          description={`Semantic repository memory · ${repo.fullName}`}
        />

        {loadError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}. Showing summary from last sync.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Files analyzed" value={fileCount} />
          <StatCard label="Chunks generated" value={chunkCount} />
          <StatCard
            label="Embeddings"
            value={embeddingsReady ? "Ready" : "Pending"}
          />
          <StatCard
            label="Vector DB"
            value={vectorLabel(vectorDbHealth)}
            sub="pgvector semantic index"
          />
        </div>

        {data?.languages &&
          Object.entries(data.languages).filter(([lang]) => lang !== "JSON")
            .length > 0 && (
          <div className="copilot-glass rounded-lg p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dominant languages
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.languages)
                .filter(([lang]) => lang !== "JSON")
                .map(([lang, n]) => (
                <span
                  key={lang}
                  className="rounded-md border border-border/60 px-2 py-0.5 text-xs"
                >
                  {lang} · {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {(data?.indexedAt ?? repo.indexedAt) && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Last sync ·{" "}
            {new Date(data?.indexedAt ?? repo.indexedAt!).toLocaleString()}
            {data?.indexingDurationMs
              ? ` · indexed in ${(data.indexingDurationMs / 1000).toFixed(1)}s`
              : ""}
          </p>
        )}

        <form onSubmit={runSearch} className="copilot-glass flex gap-2 rounded-lg p-3">
          <Input
            placeholder='Semantic search — e.g. "authentication middleware"'
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="sm" disabled={searching || !embeddingsReady}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>

        {hits.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {hits.length} semantic matches
            </p>
            {hits.map((h) => (
              <div key={`${h.path}-${h.startLine}`} className="copilot-glass rounded-lg p-3">
                <p className="font-mono text-xs text-foreground">{h.path}</p>
                <p className="text-[10px] text-muted-foreground">
                  L{h.startLine}–{h.endLine}
                </p>
                <pre className="mt-2 max-h-32 overflow-x-auto text-xs text-muted-foreground">
                  {h.snippet}
                </pre>
              </div>
            ))}
          </div>
        )}

        <div className="copilot-glass overflow-hidden rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 p-3">
            <p className="text-sm font-medium">Indexed files</p>
            <Input
              placeholder="Filter files…"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              className="h-8 w-48 border-border/50 bg-muted/30 text-xs"
            />
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card/90 text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">File</th>
                  <th className="p-2 font-medium">Chunks</th>
                  <th className="p-2 font-medium">Embedding</th>
                  <th className="p-2 font-medium">Processed</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                      {repo.status === "indexing"
                        ? "Indexing in progress…"
                        : "No file list — re-index the repository"}
                    </td>
                  </tr>
                ) : (
                  files.map((f) => (
                    <tr key={f.path} className="border-t border-border/30">
                      <td className="p-2 font-mono">{f.path}</td>
                      <td className="copilot-stat p-2">{f.chunkCount}</td>
                      <td className="p-2 text-muted-foreground">
                        {f.embedded ? "embedded" : "pending"}
                      </td>
                      <td className="p-2 text-[10px] text-muted-foreground">
                        {new Date(f.processedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {data?.activityLog && data.activityLog.length > 0 && (
          <TerminalLog lines={data.activityLog} title="Indexing activity" />
        )}
      </div>
    </PanelScroll>
  );
}
