"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  Loader2,
  LogOut,
  Database,
  Network,
  Terminal,
  Rocket,
  Activity,
  Users,
} from "lucide-react";
import { DefiLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RepoMeta } from "./types";
import { ChatPanel } from "./chat-panel";
import { KnowledgePanel } from "./knowledge-panel";
import { ArchitecturePanel } from "./architecture-panel";
import { DeploymentsPanel } from "./deployments-panel";
import { ObservabilityPanel } from "./observability-panel";
import { HealthScoreRing } from "./ui/health-score-ring";
import { parseJsonResponse } from "@/lib/api";
import { LogoutModal } from "@/components/auth/logout-modal";
import "@/app/copilot.css";

type Panel = "chat" | "diagram" | "kb" | "deploy" | "obs";

export function CopilotShell() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [input, setInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [activeRepo, setActiveRepo] = useState<RepoMeta | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [panel, setPanel] = useState<Panel>("chat");
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexStep, setIndexStep] = useState("");

  const loadRepo = useCallback(async (id: string) => {
    const res = await fetch(`/api/repos/${id}`);
    if (res.ok) setActiveRepo(await res.json());
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("copilot_repo_id");
    if (saved) loadRepo(saved);
  }, [loadRepo]);

  async function indexRepo(e: React.FormEvent) {
    e.preventDefault();
    setIndexError(null);
    setIndexing(true);
    setIndexStep("Queuing index job…");

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoInput.trim() }),
      });
      const data = await parseJsonResponse<{
        jobId?: string;
        id: string;
        error?: string;
        code?: string;
        progress?: number;
        step?: string;
        status?: string;
      } & RepoMeta>(res);

      if (!res.ok) {
        if (data.code === "INTERNAL_SECRET_MISMATCH") {
          throw new Error(
            "Backend rejected the app proxy — set the same ENGINTEL_INTERNAL_SECRET in frontend and backend env, then restart both."
          );
        }
        throw new Error(data.error ?? "Index failed");
      }

      if (!data.jobId) {
        localStorage.setItem("copilot_repo_id", data.id);
        setActiveRepo(data);
        setIndexStep("Index complete");
        setPanel("chat");
        return;
      }

      localStorage.setItem("copilot_repo_id", data.id);
      setIndexStep(data.step ?? "Indexing…");

      const POLL_MS = 1000;
      const MAX_WAIT_MS = 130_000;
      const deadline = Date.now() + MAX_WAIT_MS;

      while (Date.now() < deadline) {
        await sleep(POLL_MS);

        const [pollRes, repoRes] = await Promise.all([
          fetch(`/api/repos/index/jobs/${data.jobId}`),
          fetch(`/api/repos/${data.id}`),
        ]);

        if (repoRes.ok) {
          const repo = await parseJsonResponse<RepoMeta>(repoRes);
          if (repo.status === "ready") {
            setActiveRepo(repo);
            setIndexStep("Index complete");
            setPanel("chat");
            return;
          }
        }

        if (!pollRes.ok) continue;

        const job = await parseJsonResponse<
          RepoMeta & {
            jobId: string;
            progress: number;
            step: string;
            status: string;
            error?: string;
          }
        >(pollRes);

        setIndexStep(
          job.step
            ? `${job.step}${job.progress != null ? ` (${job.progress}%)` : ""}`
            : "Indexing…"
        );

        if (job.status === "completed") {
          setActiveRepo(job);
          setIndexStep("Index complete");
          setPanel("chat");
          return;
        }
        if (job.status === "failed") {
          throw new Error(job.error ?? "Indexing failed");
        }
      }

      throw new Error(
        "Indexing timed out after ~2 minutes. Try a smaller repo or set INDEX_MODE=full on the backend for deep indexing."
      );
    } catch (err) {
      setIndexError(err instanceof Error ? err.message : "Index failed");
    } finally {
      setIndexing(false);
    }
  }

  const nav = [
    { id: "chat" as const, label: "Assistant", icon: Terminal },
    { id: "diagram" as const, label: "Architecture", icon: Network },
    { id: "kb" as const, label: "Knowledge", icon: Database },
    { id: "deploy" as const, label: "Deployments", icon: Rocket },
    { id: "obs" as const, label: "Observability", icon: Activity },
  ];

  return (
    <div className="copilot-root flex h-dvh max-h-dvh min-h-0 overflow-hidden text-foreground">
      <aside className="copilot-sidebar flex min-h-0 w-72 shrink-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <DefiLogo size={26} />
            <div>
              <span className="block text-sm font-semibold tracking-tight">
                EngIntel
              </span>
              <span className="text-[10px] text-muted-foreground">
                Engineering Intelligence
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="size-4" />
          </Button>
        </div>

        <div className="border-b border-border/40 px-5 py-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Users className="size-3" /> Workspace</span>
            <span className="text-xs font-medium text-foreground">Personal</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-5">
          <form onSubmit={indexRepo} className="space-y-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Repository
            </label>
            <Input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              className="h-9 bg-muted/30"
            />
            <Button
              type="submit"
              className="w-full"
              size="sm"
              disabled={indexing || !repoInput.trim()}
            >
              {indexing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Indexing…
                </>
              ) : (
                <>
                  <GitBranch className="size-3.5" />
                  Connect & index
                </>
              )}
            </Button>
            {indexing && (
              <p className="font-mono text-[10px] text-muted-foreground">
                <span className="text-foreground/50">{">"}</span> {indexStep}
                <span className="copilot-cursor" />
              </p>
            )}
            {indexError && (
              <div className="space-y-1">
                <p className="text-xs text-destructive">{indexError}</p>
                {/private|sign in with GitHub|cannot access/i.test(indexError) && (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Private repos require GitHub sign-in with repo access. Sign out,
                    then use Continue with GitHub on the login page.
                  </p>
                )}
                {/rate limit|GITHUB_TOKEN/i.test(indexError) && (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Add{" "}
                    <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">
                      GITHUB_TOKEN
                    </code>{" "}
                    to{" "}
                    <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">
                      backend/.env
                    </code>{" "}
                    (PAT from{" "}
                    <a
                      href="https://github.com/settings/personal-access-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      github.com/settings/personal-access-tokens
                    </a>
                    ), restart the backend, try again.
                  </p>
                )}
              </div>
            )}
          </form>

          {activeRepo && (
            <div className="copilot-glass space-y-3 rounded-lg p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{activeRepo.fullName}</p>
                {activeRepo.healthScore && (
                  <HealthScoreRing
                    score={activeRepo.healthScore.overall}
                    grade={activeRepo.healthScore.grade}
                    size="sm"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>{activeRepo.fileCount} files</span>
                <span>{activeRepo.chunkCount} chunks</span>
                <span className="col-span-2 capitalize">
                  {activeRepo.status}
                  {activeRepo.embeddingsReady ? " · vectors ready" : ""}
                </span>
                {activeRepo.vectorDbHealth && (
                  <span className="col-span-2 text-[10px]">
                    Vector DB · {activeRepo.vectorDbHealth}
                  </span>
                )}
                {activeRepo.indexedAt && (
                  <span className="col-span-2 text-[10px]">
                    Synced {new Date(activeRepo.indexedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}

          <nav className="space-y-0.5">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-active={panel === id}
                onClick={() => {
                  setPanel(id);
                  if (activeRepo?.id) loadRepo(activeRepo.id);
                }}
                className={cn(
                  "copilot-nav-btn flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        {panel === "chat" && (
          <ChatPanel
            repo={activeRepo}
            indexing={indexing}
            input={input}
            setInput={setInput}
          />
        )}
        {panel === "kb" && (
          <KnowledgePanel repo={activeRepo} active={panel === "kb"} />
        )}
        {panel === "diagram" && (
          <ArchitecturePanel repo={activeRepo} active={panel === "diagram"} />
        )}
        {panel === "deploy" && <DeploymentsPanel repo={activeRepo} />}
        {panel === "obs" && <ObservabilityPanel repo={activeRepo} />}
      </main>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
