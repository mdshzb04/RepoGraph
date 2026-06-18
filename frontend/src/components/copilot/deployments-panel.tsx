"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DeploymentAnalysis, HealthScoreData, RepoMeta } from "./types";
import { SectionHeader } from "./ui/section-header";
import { HealthScoreRing } from "./ui/health-score-ring";

const ICON: Record<string, string> = {
  ok: "✓",
  warn: "⚠",
  fail: "✗",
};

export function DeploymentsPanel({ repo }: { repo: RepoMeta | null }) {
  const [data, setData] = useState<DeploymentAnalysis | null>(null);
  const [health, setHealth] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repo?.id) {
      setData(null);
      setHealth(null);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/repos/${repo.id}/deployments`).then((r) => r.json()),
      fetch(`/api/repos/${repo.id}/health`).then((r) => r.json()),
    ])
      .then(([deploy, healthData]) => {
        setData(deploy.error ? null : deploy);
        setHealth(healthData.error ? null : healthData);
      })
      .catch(() => {
        setData(null);
        setHealth(null);
      })
      .finally(() => setLoading(false));
  }, [repo?.id]);

  if (!repo) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Connect and index a repository for deployment intelligence.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="p-8 font-mono text-sm text-muted-foreground">
        {">"} Analyzing deployment stack…
      </p>
    );
  }

  if (!data) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Deployment analysis unavailable. Re-index the repository.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <SectionHeader
          title="Deployments"
          description={`AI deployment intelligence · ${repo.fullName}`}
        />

        {health && (
          <div className="copilot-glass flex flex-col gap-6 rounded-xl p-6 sm:flex-row sm:items-center">
            <HealthScoreRing score={health.overall} grade={health.grade} />
            <div className="flex-1 space-y-3">
              <p className="text-sm font-medium">Repository health score</p>
              <p className="text-xs text-muted-foreground">
                Composite score from deployment readiness, architecture, CI/CD,
                TypeScript, Docker, testing, linting, env management, and docs.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {health.categories.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border/40 px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="copilot-stat">
                        {c.score}/{c.maxScore}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{c.detail}</p>
                  </div>
                ))}
              </div>
              {health.recommendations.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {health.recommendations.slice(0, 3).map((r) => (
                    <li key={r}>→ {r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="copilot-glass grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Framework", data.framework],
            ["Structure", data.structure],
            ["Package manager", data.packageManager],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {k}
              </p>
              <p className="mt-1 text-sm font-medium">{v}</p>
            </div>
          ))}
        </div>

        {data.techStack.length > 0 && (
          <div className="copilot-glass rounded-lg p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Detected stack
            </p>
            <div className="flex flex-wrap gap-2">
              {data.techStack.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border/50 px-2 py-0.5 text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="copilot-glass rounded-lg p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recommended deployment targets
          </p>
          <div className="space-y-2">
            {data.recommendations
              .filter((r) => r.role !== "Database")
              .map((r) => (
              <div
                key={`${r.role}-${r.provider}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {r.role} → {r.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-muted/30 px-3 text-xs hover:bg-muted/50"
                >
                  Deploy <ExternalLink className="ml-1 size-3" />
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="copilot-glass rounded-lg p-4 font-mono text-xs">
          <p className="mb-3 flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Rocket className="size-3.5" /> Deployment readiness
          </p>
          <ul className="space-y-1.5">
            {data.checks.map((c) => (
              <li
                key={c.label}
                className={
                  c.status === "ok"
                    ? "text-foreground/80"
                    : c.status === "warn"
                      ? "text-muted-foreground"
                      : "text-destructive"
                }
              >
                {ICON[c.status]} {c.label}
              </li>
            ))}
          </ul>
        </div>

        {data.envVars.length > 0 && (
          <div className="copilot-glass rounded-lg p-4">
            <p className="mb-2 text-xs text-muted-foreground">Environment variables</p>
            <p className="font-mono text-xs">{data.envVars.join(", ")}</p>
          </div>
        )}

        {data.blockers.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Blockers</p>
            <ul className="mt-1 list-disc pl-4">
              {data.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
