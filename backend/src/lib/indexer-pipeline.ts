import { fetchRepoFiles } from "./github";
import { analyzeArchitecture } from "./architecture-analyzer";
import { analyzeDeployment } from "./deployment-analyzer";
import { computeHealthScore } from "./health-score";
import {
  createRepoId,
  getRepo,
  saveRepo,
  type RepoKnowledge,
  type VectorDbHealth,
} from "./knowledge";
import { buildObservabilitySnapshot } from "./observability";
import { chunkFiles } from "./rag";
import { buildFileStats, languageBreakdown } from "./repo-stats";
import type { ManifestMap } from "./repo-scanner";
import { buildMermaidFromArchitecture } from "./architecture-context";
import { flushTelemetry, recordOpenAIUsage, recordRepoIndex } from "@engintel/telemetry";
import { pushOtelEvent } from "./telemetry-stream";
import { aiProvider } from "./ai";
import { ensureRepoAiInsights } from "./ai/insights-service";
import { updateIndexJob } from "./index-jobs";
import {
  indexEmbedLimit,
  indexMaxFiles,
  isFullIndexMode,
  skipIndexAiInsights,
  skipIndexLlmSummary,
} from "./index-config";
import {
  clearIndexWorkspace,
  loadIndexWorkspace,
  saveIndexWorkspace,
  type IndexWorkspace,
} from "./index-workspace";

function buildManifests(files: { path: string; content: string }[]): ManifestMap {
  const out: ManifestMap = {};
  for (const f of files) {
    if (
      f.path.endsWith(".json") ||
      f.path.endsWith(".yaml") ||
      f.path.endsWith(".yml") ||
      f.path === "Dockerfile" ||
      f.path.endsWith("requirements.txt") ||
      f.path.endsWith("pyproject.toml") ||
      f.path.endsWith("go.mod")
    ) {
      out[f.path] = f.content;
    }
  }
  return out;
}

function logStep(log: string[], msg: string, repoId?: string): void {
  const line = `${new Date().toISOString()} · ${msg}`;
  log.push(line);
  if (repoId) {
    pushOtelEvent({
      kind: "index",
      name: "engintel.repo.index.step",
      value: msg,
      severity: msg.includes("error") ? "error" : "info",
      attrs: { repo_id: repoId },
    });
  }
}

export type IndexPipelineInput = {
  jobId: string;
  repoId: string;
  owner: string;
  repo: string;
  githubUserToken?: string | null;
  indexedBySub?: string | null;
  indexedByEmail?: string | null;
};

export type StepRunner = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

async function setProgress(
  jobId: string,
  progress: number,
  step: string,
  status: "running" | "completed" | "failed" = "running"
): Promise<void> {
  await updateIndexJob(jobId, { progress, step, status });
}

export async function createPendingRepoRecord(
  input: Pick<
    IndexPipelineInput,
    "repoId" | "owner" | "repo" | "indexedBySub" | "indexedByEmail"
  >
): Promise<RepoKnowledge> {
  const indexedBySub = input.indexedBySub?.trim() || undefined;
  const indexedByEmail = input.indexedByEmail?.trim()
    ? input.indexedByEmail.trim().toLowerCase()
    : undefined;

  const pending: RepoKnowledge = {
    id: input.repoId,
    fullName: `${input.owner}/${input.repo}`,
    defaultBranch: "main",
    indexedAt: new Date().toISOString(),
    status: "indexing",
    fileCount: 0,
    chunkCount: 0,
    summary: "",
    architectureMermaid: "",
    chunks: [],
    vectorDbHealth: "offline",
    activityLog: [`${new Date().toISOString()} · indexing queued`],
    ...(indexedBySub ? { indexedBySub } : {}),
    ...(indexedByEmail ? { indexedByEmail } : {}),
  };
  await saveRepo(pending);
  return pending;
}

async function stepCloneRepository(input: IndexPipelineInput): Promise<void> {
  await setProgress(input.jobId, 10, "Fetching repository from GitHub");
  const { fullName, defaultBranch, files, allPaths } = await fetchRepoFiles(
    input.owner,
    input.repo,
    indexMaxFiles(),
    input.githubUserToken
  );
  await saveIndexWorkspace({
    repoId: input.repoId,
    fullName,
    defaultBranch,
    files,
    allPaths,
    manifests: {},
    chunks: [],
  });
}

async function stepParseFiles(input: IndexPipelineInput): Promise<void> {
  await setProgress(input.jobId, 20, "Parsing files and manifests");
  const ws = (await loadIndexWorkspace(input.repoId))!;
  ws.manifests = buildManifests(ws.files);
  await saveIndexWorkspace(ws);
}

async function stepChunkCode(input: IndexPipelineInput): Promise<void> {
  await setProgress(input.jobId, 30, "Chunking source code");
  const ws = (await loadIndexWorkspace(input.repoId))!;
  ws.chunks = chunkFiles(ws.files);
  await saveIndexWorkspace(ws);
}

async function stepGenerateEmbeddings(input: IndexPipelineInput): Promise<void> {
  const limit = indexEmbedLimit();
  await setProgress(
    input.jobId,
    60,
    limit < 9999
      ? `Generating embeddings (top ${limit} chunks)`
      : "Generating OpenAI embeddings"
  );
  const ws = (await loadIndexWorkspace(input.repoId))!;
  if (aiProvider.openai.isConfigured() && ws.chunks.length) {
    try {
      const targets =
        limit >= ws.chunks.length ? ws.chunks : ws.chunks.slice(0, limit);
      const embedded = await aiProvider.embedChunks(targets);
      const byId = new Map(embedded.map((c) => [c.id, c]));
      ws.chunks = ws.chunks.map((c) => byId.get(c.id) ?? c);
    } catch (err) {
      console.warn("[index] embedding step failed:", err);
    }
  }
  await saveIndexWorkspace(ws);
}

async function stepSaveVectors(input: IndexPipelineInput): Promise<void> {
  await setProgress(input.jobId, 60, "Saving vectors to repository store");
  const ws = (await loadIndexWorkspace(input.repoId))!;
  const repo = await getRepo(input.repoId);
  if (!repo) throw new Error("Repository record missing");

  const embeddingsReady = ws.chunks.some((c) => c.embedding?.length);
  const vectorDbHealth: VectorDbHealth = embeddingsReady
    ? "healthy"
    : aiProvider.openai.isConfigured()
      ? "degraded"
      : "offline";

  await saveRepo({
    ...repo,
    fullName: ws.fullName,
    defaultBranch: ws.defaultBranch,
    fileCount: ws.files.length,
    chunkCount: ws.chunks.length,
    chunks: ws.chunks,
    embeddingsReady,
    vectorDbHealth,
    allPaths: ws.allPaths,
    manifests: ws.manifests,
    folderTree: ws.files.map((f) => f.path).slice(0, 120),
  });
}

async function stepGenerateSummary(input: IndexPipelineInput): Promise<void> {
  await setProgress(
    input.jobId,
    80,
    skipIndexLlmSummary() ? "Building repository summary" : "Generating Claude repository summary"
  );
  const ws = (await loadIndexWorkspace(input.repoId))!;
  const repo = (await getRepo(input.repoId))!;

  let summaryPart = `${ws.fullName} is a codebase with ${ws.files.length} indexed source files and ${ws.chunks.length} searchable chunks.`;
  let llmSummaryUsed = false;
  let llmTokens = 0;
  const modelId = aiProvider.claude.modelId();

  if (!skipIndexLlmSummary()) {
    const treePreview = ws.files.map((f) => f.path).slice(0, 40).join("\n");
    const summaryPrompt = `Repository: ${ws.fullName}
Files (${ws.files.length}):
${treePreview}

Snippets:
${ws.chunks
  .slice(0, 6)
  .map((c) => `[${c.path}]\n${c.content.slice(0, 300)}`)
  .join("\n\n")}`;

    try {
      const result = await aiProvider.generateSummary(
        {
          ...repo,
          chunks: ws.chunks,
          fileCount: ws.files.length,
          chunkCount: ws.chunks.length,
        } as RepoKnowledge,
        summaryPrompt
      );
      if (result?.text) {
        summaryPart = result.text;
        llmSummaryUsed = true;
        llmTokens = result.inputTokens + result.outputTokens;
        if (llmTokens > 0) {
          recordOpenAIUsage(llmTokens, "index_summary", modelId, input.repoId);
        }
      }
    } catch (err) {
      console.warn("[index] summary step skipped:", err);
    }
  } else {
    const topPaths = ws.files
      .slice(0, 8)
      .map((f) => f.path)
      .join(", ");
    if (topPaths) summaryPart += ` Key paths: ${topPaths}.`;
  }

  ws.summary = summaryPart.trim().slice(0, 1200);
  ws.llmSummaryUsed = llmSummaryUsed;
  ws.llmTokens = llmTokens;
  ws.modelId = modelId;
  await saveIndexWorkspace(ws);
}

async function stepGenerateInsights(input: IndexPipelineInput): Promise<void> {
  await setProgress(
    input.jobId,
    90,
    skipIndexAiInsights()
      ? "Building static architecture map"
      : "Generating architecture insights"
  );
  const ws = (await loadIndexWorkspace(input.repoId))!;
  const repo = (await getRepo(input.repoId))!;
  if (!repo) throw new Error("Repository record missing");

  const architecture = analyzeArchitecture(ws.allPaths, ws.manifests, ws.chunks);
  const summary = ws.summary ?? repo.summary;
  const mermaid = buildMermaidFromArchitecture(architecture, summary).slice(0, 4000);

  const partial: RepoKnowledge = {
    ...repo,
    summary,
    architectureMermaid: mermaid,
    architecture,
  };

  if (skipIndexAiInsights()) {
    await saveRepo(partial);
    return;
  }

  await saveRepo(partial);
  const withInsights = await ensureRepoAiInsights(partial);
  await saveRepo(withInsights);
}

async function stepMarkIndexed(
  input: IndexPipelineInput,
  startedAt: number
): Promise<RepoKnowledge> {
  await setProgress(input.jobId, 100, "Finalizing repository index");
  const ws = (await loadIndexWorkspace(input.repoId))!;
  let repo = (await getRepo(input.repoId))!;
  if (!repo) throw new Error("Repository record missing");

  const activityLog = [...(repo.activityLog ?? [])];
  logStep(activityLog, "repository sync complete", input.repoId);

  const indexedAt = new Date().toISOString();
  const fileStats = buildFileStats(ws.chunks, indexedAt);
  const indexingDurationMs = Date.now() - startedAt;

  const partial: RepoKnowledge = {
    ...repo,
    indexedAt,
    status: "ready",
    fileCount: ws.files.length,
    chunkCount: ws.chunks.length,
    summary: (ws.summary ?? repo.summary).trim().slice(0, 1200),
    chunks: ws.chunks,
    files: fileStats,
    languages: languageBreakdown(fileStats),
    indexingDurationMs,
    activityLog,
  };

  const deployment = analyzeDeployment(partial, `https://github.com/${ws.fullName}`);
  const healthScore = computeHealthScore(
    ws.allPaths,
    ws.manifests,
    deployment,
    partial.architecture ?? analyzeArchitecture(ws.allPaths, ws.manifests, ws.chunks)
  );
  const observability = buildObservabilitySnapshot(partial, indexingDurationMs);

  const ready: RepoKnowledge = {
    ...partial,
    healthScore,
    observability,
  };

  recordRepoIndex(
    indexingDurationMs,
    ws.files.length,
    ws.chunks.length,
    ws.fullName,
    "success",
    input.repoId
  );
  pushOtelEvent({
    kind: "index",
    name: "Index job completed",
    value: 1,
    unit: "job",
    attrs: {
      repo_id: input.repoId,
      files: String(ws.files.length),
      chunks: String(ws.chunks.length),
      duration_ms: String(indexingDurationMs),
    },
  });
  await flushTelemetry();

  await saveRepo(ready);
  await clearIndexWorkspace(input.repoId);
  return ready;
}

export async function runIndexPipeline(
  input: IndexPipelineInput,
  runStep: StepRunner
): Promise<RepoKnowledge> {
  const startedAt = Date.now();
  await updateIndexJob(input.jobId, {
    status: "running",
    progress: 0,
    step: isFullIndexMode()
      ? "Starting full index pipeline"
      : "Starting fast index (~2 min)",
  });

  try {
    await runStep("clone-repository", () => stepCloneRepository(input));
    await runStep("parse-files", () => stepParseFiles(input));
    await runStep("chunk-code", () => stepChunkCode(input));
    await runStep("generate-embeddings", () => stepGenerateEmbeddings(input));
    await runStep("save-vectors", () => stepSaveVectors(input));
    await runStep("generate-summary", () => stepGenerateSummary(input));
    await runStep("generate-architecture-insights", () => stepGenerateInsights(input));
    const ready = await runStep("mark-indexed", () =>
      stepMarkIndexed(input, startedAt)
    );
    return ready;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    await updateIndexJob(input.jobId, {
      status: "failed",
      progress: 100,
      step: "Failed",
      error: message,
    });
    const repo = await getRepo(input.repoId);
    if (repo) {
      await saveRepo({
        ...repo,
        status: "error",
        error: message,
        indexedAt: new Date().toISOString(),
      });
    }
    await clearIndexWorkspace(input.repoId);
    recordRepoIndex(
      Date.now() - startedAt,
      0,
      0,
      `${input.owner}/${input.repo}`,
      "error",
      input.repoId
    );
    void flushTelemetry();
    throw err;
  }
}
