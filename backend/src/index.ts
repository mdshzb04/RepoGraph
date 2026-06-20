import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { parseRepoInput } from "./lib/github";
import { indexRepository } from "./lib/indexer";
import { getRepo, listRepos, listReposForUser } from "./lib/knowledge";
import {
  buildContextBlock,
  retrieveChunks,
  retrieveChunksScored,
} from "./lib/rag";
import {
  aiProvider,
  REPOSITORY_CHAT_SYSTEM,
  claudeProvider,
  getAIConfig,
} from "./lib/ai";
import { ensureRepoAiInsights } from "./lib/ai/insights-service";
import { pushOtelEvent, sseOtelHandler, setTraceRecorder } from "./lib/telemetry-stream";
import { analyzeDeployment } from "./lib/deployment-analyzer";
import { computeHealthScore } from "./lib/health-score";
import {
  buildMermaidFromArchitecture,
  sanitizeMermaid,
  sanitizeSummary,
} from "./lib/architecture-context";
import { buildArchitectureTopology } from "./lib/architecture-topology";
import {
  isContaminatedArchitecture,
  rebuildArchitectureCache,
} from "./lib/architecture-cache";
import { buildDependencyGraph } from "./lib/dependency-graph";
import { buildExcalidrawScene } from "./lib/excalidraw-scene";
import { buildWorkflowDiagram } from "./lib/workflow-diagram";
import { buildObservabilitySnapshot } from "./lib/observability";
import {
  canAccessRepo,
  parseRepoAccessFromRequest,
  timingSafeCompare,
} from "./lib/repo-access";
import {
  bootstrapGrafanaPublicEmbed,
  flushTelemetry,
  getStatus,
  getTelemetryConfig,
  initTelemetry,
  recordVectorSearch,
  recordOpenAIUsage,
  recordTraceEvent,
  shutdownTelemetry,
  telemetryMiddleware,
  hydrateIndexingBaseline,
  hydrateIndexRuns,
  exportIndexBaselineToOtel,
  getLiveTelemetrySnapshot,
} from "@engintel/telemetry";
import {
  flushTraceRun,
  initTraceplane,
  isTraceplaneEnabled,
  startTraceRun,
} from "./lib/traceplane";

dotenv.config();
initTelemetry();
const traceplaneReady = initTraceplane();
setTraceRecorder((repoId, kind) => recordTraceEvent(repoId, kind));

void listRepos().then((repos) => {
  const ready = repos.filter((r) => r.status === "ready");
  if (!ready.length) return;
  hydrateIndexingBaseline(
    ready.map((r) => ({
      repoId: r.id,
      fullName: r.fullName,
      fileCount: r.fileCount ?? 0,
      chunkCount: r.chunkCount ?? 0,
      indexingDurationMs: r.indexingDurationMs,
    }))
  );
  hydrateIndexRuns(
    ready.map((r) => ({
      repoId: r.id,
      fullName: r.fullName,
      fileCount: r.fileCount ?? 0,
      chunkCount: r.chunkCount ?? 0,
      indexingDurationMs: r.indexingDurationMs,
      indexedAt: r.indexedAt,
    }))
  );
  const idx = getLiveTelemetrySnapshot().indexing;
  exportIndexBaselineToOtel(idx.totalJobs, idx.totalFiles, idx.totalChunks);
  void flushTelemetry();
});

const app = express();
const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || "0.0.0.0";

const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  process.env.FRONTEND_URL ??
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "4mb" }));
app.use(telemetryMiddleware());

function readGithubUserToken(req: express.Request): string | undefined {
  const raw = req.headers["x-github-user-token"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const first = raw?.[0];
  return typeof first === "string" && first.trim() ? first.trim() : undefined;
}

function trustedFrontendProxyOk(req: express.Request): boolean {
  const expected = process.env.ENGINTEL_INTERNAL_SECRET?.trim();
  if (!expected) return true;
  const got = req.headers["x-engintel-internal"];
  const value = typeof got === "string" ? got : got?.[0] ?? "";
  return timingSafeCompare(expected, value);
}

app.use((req, res, next) => {
  const p = req.path;
  if (!p.startsWith("/api/repos") && p !== "/api/chat") {
    next();
    return;
  }
  if (!trustedFrontendProxyOk(req)) {
    res.status(401).json({
      error:
        "Unauthorized — frontend must send x-engintel-internal matching ENGINTEL_INTERNAL_SECRET",
      code: "INTERNAL_SECRET_MISMATCH",
    });
    return;
  }
  next();
});

async function getRepoAuthorized(req: express.Request, id: string) {
  const repo = await getRepo(id);
  if (!repo) return null;
  if (!canAccessRepo(repo, parseRepoAccessFromRequest(req))) return null;
  return repo;
}

function repoSummary(repo: NonNullable<Awaited<ReturnType<typeof getRepo>>>) {
  return {
    id: repo.id,
    fullName: repo.fullName,
    status: repo.status,
    summary: repo.summary,
    architectureMermaid: repo.architectureMermaid,
    fileCount: repo.fileCount,
    chunkCount: repo.chunkCount,
    indexedAt: repo.indexedAt,
    embeddingsReady: repo.embeddingsReady ?? repo.status === "ready",
    vectorDbHealth: repo.vectorDbHealth ?? (repo.embeddingsReady ? "healthy" : "offline"),
    languages: repo.languages ?? {},
    folderTree: repo.folderTree ?? [],
    healthScore: repo.healthScore
      ? { overall: repo.healthScore.overall, grade: repo.healthScore.grade }
      : undefined,
    error: repo.error,
  };
}

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Engineering Intelligence API",
    hint: "Use the app at http://localhost:3000 — this port is the REST API only.",
    health: "/health",
    docs: ["/api/repos", "/api/chat", "/api/telemetry/status"],
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Engineering Intelligence API",
    version: "1.0.0",
    telemetry: getStatus(),
  });
});

app.get("/api/telemetry/status", async (_req, res) => {
  const cfg = getTelemetryConfig();
  if (!process.env.GRAFANA_CLOUD_EMBED_URL?.trim()) {
    await bootstrapGrafanaPublicEmbed(
      cfg.dashboardUrl,
      process.env.GRAFANA_CLOUD_DASHBOARD_UID?.trim()
    );
  }
  res.json(getStatus());
});

app.get("/api/repos", async (req, res) => {
  const ctx = parseRepoAccessFromRequest(req);
  const repos = await listReposForUser(ctx);
  res.json(
    repos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      status: r.status,
      fileCount: r.fileCount,
      chunkCount: r.chunkCount,
      indexedAt: r.indexedAt,
      healthScore: r.healthScore?.overall,
    }))
  );
});

app.get("/api/repos/:id", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }
  res.json(repoSummary(repo));
});

app.get("/api/repos/:id/knowledge", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }
  res.json({
    id: repo.id,
    fullName: repo.fullName,
    status: repo.status,
    indexedAt: repo.indexedAt,
    fileCount: repo.fileCount,
    chunkCount: repo.chunkCount,
    embeddingsReady: repo.embeddingsReady ?? false,
    vectorDbHealth: repo.vectorDbHealth ?? "offline",
    languages: repo.languages ?? {},
    summary: repo.summary,
    activityLog: repo.activityLog ?? [],
    files: repo.files ?? [],
    folderTree: repo.folderTree ?? [],
    indexingDurationMs: repo.indexingDurationMs,
  });
});

app.get("/api/repos/:id/architecture", async (req, res) => {
  try {
    const repo = await getRepoAuthorized(req, req.params.id);
    if (!repo || repo.status !== "ready") {
      res.status(404).json({ error: "Index repository first", code: "NOT_INDEXED" });
      return;
    }

    const force = req.query.refresh === "1" || req.query.rebuild === "1";
    const rebuilt = await rebuildArchitectureCache(
      repo,
      readGithubUserToken(req),
      { force }
    );

    if (!rebuilt.ok) {
      if (
        isContaminatedArchitecture(repo.architectureMermaid) ||
        isContaminatedArchitecture(repo.summary)
      ) {
        res.status(rebuilt.status).json({
          error: rebuilt.error,
          code: rebuilt.code,
          fullName: repo.fullName,
        });
        return;
      }
      res.status(rebuilt.status).json({ error: rebuilt.error, code: rebuilt.code });
      return;
    }

    const current = rebuilt.repo;
    const withInsights = await ensureRepoAiInsights(current, {
      force: force || !current.aiInsights,
    });

    let mermaid = sanitizeMermaid(
      withInsights.aiInsights?.architectureMermaid?.trim() ??
        withInsights.architectureMermaid?.trim() ??
        ""
    );

    const summary = sanitizeSummary(withInsights.summary);
    if (!mermaid && withInsights.architecture) {
      mermaid = buildMermaidFromArchitecture(withInsights.architecture, summary).slice(
        0,
        4000
      );
    }

    const topology = buildArchitectureTopology(withInsights);
    const dependencyGraph = buildDependencyGraph(withInsights);
    const workflow = buildWorkflowDiagram(withInsights);
    const claudeWorkflowMermaid = withInsights.aiInsights?.workflowMermaid;

    res.json({
      fullName: withInsights.fullName,
      summary,
      architectureMermaid: mermaid,
      analysis: withInsights.architecture ?? null,
      folderTree: withInsights.folderTree ?? [],
      topology,
      dependencyGraph,
      workflow,
      claudeWorkflowMermaid: claudeWorkflowMermaid ?? null,
      dependencyAnalysis: withInsights.aiInsights?.dependencyAnalysis ?? null,
      aiInsightsGeneratedAt: withInsights.aiInsights?.generatedAt ?? null,
      excalidrawScene: buildExcalidrawScene(withInsights, topology),
      rebuilt: rebuilt.rebuilt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Architecture generation failed";
    res.status(500).json({ error: message, code: "ARCHITECTURE_ERROR" });
  }
});

app.get("/api/repos/:id/deployments", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo || repo.status !== "ready") {
    res.status(404).json({ error: "Index repository first" });
    return;
  }
  const analysis = analyzeDeployment(
    repo,
    `https://github.com/${repo.fullName}`
  );
  res.json(analysis);
});

app.get("/api/repos/:id/health", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo || repo.status !== "ready") {
    res.status(404).json({ error: "Index repository first" });
    return;
  }
  if (repo.healthScore) {
    res.json(repo.healthScore);
    return;
  }
  const deployment = analyzeDeployment(
    repo,
    `https://github.com/${repo.fullName}`
  );
  const score = computeHealthScore(
    repo.allPaths ?? repo.folderTree ?? [],
    repo.manifests ?? {},
    deployment,
    repo.architecture
  );
  res.json(score);
});

app.get("/api/repos/:id/observability", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }
  res.json(buildObservabilitySnapshot(repo, repo.indexingDurationMs));
});

app.get("/api/repos/:id/observability/stream", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }
  sseOtelHandler(req, res, repo.id);
});

app.post("/api/repos/:id/search", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo?.chunks.length) {
    res.status(404).json({ error: "No indexed data" });
    return;
  }
  const query = typeof req.body.query === "string" ? req.body.query : "";
  if (!query.trim()) {
    res.status(400).json({ error: "query required" });
    return;
  }
  const searchStart = performance.now();
  const scored = await retrieveChunksScored(repo.chunks, query, 8);
  const searchMs = performance.now() - searchStart;
  const hits = scored.map(({ chunk, score }) => ({
    path: chunk.path,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    snippet: chunk.content.slice(0, 500),
    score,
  }));
  const healthy = (repo.embeddingsReady ?? false) && repo.status === "ready";
  recordVectorSearch(searchMs, hits.length, healthy, repo.id);
  pushOtelEvent({
    kind: "retrieval",
    name: "engintel.vector.search",
    value: Math.round(searchMs),
    unit: "ms",
    attrs: { repo_id: repo.id, hits: String(hits.length) },
  });
  res.json({
    query,
    results: hits,
    latencyMs: searchMs,
    vectorDbHealth: repo.vectorDbHealth ?? "healthy",
    retrievalMode: repo.chunks.some((c) => c.embedding?.length)
      ? "vector"
      : "keyword",
  });
});

app.post("/api/repos/:id/explain", async (req, res) => {
  const repo = await getRepoAuthorized(req, req.params.id);
  if (!repo || repo.status !== "ready") {
    res.status(404).json({ error: "Index repository first" });
    return;
  }
  if (!claudeProvider.isConfigured()) {
    res.status(503).json({
      error: "ANTHROPIC_API_KEY is required for explanations.",
    });
    return;
  }

  const subject =
    typeof req.body.subject === "string" ? req.body.subject.trim() : "";
  const focus = typeof req.body.focus === "string" ? req.body.focus.trim() : "";
  if (!subject) {
    res.status(400).json({ error: "subject is required" });
    return;
  }

  try {
    const result = await aiProvider.explain(
      repo,
      subject,
      focus || "architecture and responsibilities"
    );
    const tokens = result.inputTokens + result.outputTokens;
    if (tokens > 0) {
      recordOpenAIUsage(tokens, "explain", result.model, repo.id);
      pushOtelEvent({
        kind: "cost",
        name: "engintel.claude.tokens",
        value: tokens,
        unit: "tokens",
        attrs: { repo_id: repo.id, operation: "explain", model: result.model },
      });
    }
    res.json({
      subject,
      focus,
      markdown: result.text,
      model: result.model,
    });
  } catch (err) {
    res.status(503).json({
      error: claudeProvider.formatUserError(err),
    });
  }
});

app.post("/api/repos/index", async (req, res) => {
  const input = typeof req.body.repo === "string" ? req.body.repo : "";
  const parsed = parseRepoInput(input);
  if (!parsed) {
    res.status(400).json({ error: "Use owner/repo or a GitHub URL" });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "OPENAI_API_KEY required for indexing" });
    return;
  }
  try {
    const ctx = parseRepoAccessFromRequest(req);
    const knowledge = await indexRepository(parsed.owner, parsed.repo, {
      githubUserToken: readGithubUserToken(req),
      indexedBySub: ctx.userSub ?? null,
      indexedByEmail: ctx.userEmail ?? null,
    });
    res.json({
      ...repoSummary(knowledge),
      architecture: knowledge.architecture,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to index repository",
    });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages, repoId } = req.body as {
    messages?: UIMessage[];
    repoId?: string;
  };

  if (!messages?.length) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }
  if (!claudeProvider.isConfigured()) {
    res.status(503).json({
      error:
        "ANTHROPIC_API_KEY is not configured. Add it to backend/.env for chat.",
    });
    return;
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastText =
    lastUser?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? "";

  const ctxChat = parseRepoAccessFromRequest(req);

  let system = REPOSITORY_CHAT_SYSTEM;

  if (repoId) {
    const repo = await getRepo(repoId);
    if (
      repo &&
      canAccessRepo(repo, ctxChat) &&
      repo.status === "ready"
    ) {
      const relevant = await retrieveChunks(repo.chunks, lastText, 6);
      const wantsDiagram =
        /architecture|diagram|flow|structure/i.test(lastText);
      system += `\n\n## Repository: ${repo.fullName}\n${repo.summary}\n\n## Relevant code\n${buildContextBlock(relevant)}`;
      if (repo.aiInsights?.dependencyAnalysis) {
        system += `\n\n## Dependency analysis\n${repo.aiInsights.dependencyAnalysis.slice(0, 3000)}`;
      }
      if (wantsDiagram && repo.architectureMermaid) {
        system += `\n\n## Stored architecture (Mermaid)\n\`\`\`mermaid\n${repo.architectureMermaid}\n\`\`\``;
      }
      if (repo.healthScore) {
        system += `\n\n## Health score: ${repo.healthScore.overall}/100 (${repo.healthScore.grade})`;
      }
    } else {
      system += "\n\nNo indexed repository context. Ask the user to connect a repo first.";
    }
  }

  try {
    const modelId = getAIConfig().reasoningModel;
    const traceRun = traceplaneReady
      ? startTraceRun({
          agent: "repograph-chat",
          model: modelId,
          provider: "anthropic",
          framework: "ai-sdk",
          environment: process.env.NODE_ENV ?? "development",
          tags: repoId ? [`repo:${repoId}`] : [],
        })
      : null;
    traceRun?.setInput(lastText);

    const llmStarted = Date.now();
    const result = streamText({
      model: anthropic(modelId),
      system,
      messages: await convertToModelMessages(messages),
      onFinish: ({ usage }) => {
        const tokens = usage?.totalTokens ?? 0;
        if (tokens > 0 && repoId) {
          recordOpenAIUsage(tokens, "chat", modelId, repoId);
          pushOtelEvent({
            kind: "cost",
            name: "engintel.claude.tokens",
            value: tokens,
            unit: "tokens",
            attrs: { repo_id: repoId, operation: "chat", model: modelId },
          });
        }
        void flushTelemetry();
      },
    });
    result.pipeUIMessageStreamToResponse(res);

    if (traceRun) {
      void (async () => {
        try {
          const [text, usage] = await Promise.all([result.text, result.usage]);
          traceRun.setOutput(text);
          traceRun.llmCall({
            model: modelId,
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            latencyMs: Date.now() - llmStarted,
          });
          await flushTraceRun(traceRun);
        } catch (traceErr) {
          await flushTraceRun(traceRun, traceErr);
        }
      })();
    }
  } catch (error) {
    console.error("Chat error:", error);
    res.status(503).json({
      error: claudeProvider.formatUserError(error),
    });
  }
});

const server = app.listen(port, host, () => {
  const status = getStatus();
  const ai = getAIConfig();
  console.log(`Engineering Intelligence API at http://${host}:${port}`);
  console.log(
    `[ai] openai=${ai.openaiApiKey ? "configured (embeddings)" : "missing"} · anthropic=${ai.anthropicApiKey ? `configured (${ai.reasoningModel})` : "missing"}`
  );
  console.log(
    `[telemetry] ${status.enabled ? "Grafana Cloud OTLP enabled" : "disabled (set GRAFANA_CLOUD_* to enable)"}`
  );
  console.log(
    `[traceplane] ${isTraceplaneEnabled() ? "enabled" : "disabled (set TRACEPLANE_API_KEY to enable)"}`
  );
});

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[shutdown] ${signal} received`);
  server.close();
  await shutdownTelemetry();
  process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
