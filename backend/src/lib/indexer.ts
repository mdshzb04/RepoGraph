import { fetchRepoFiles } from "./github";
import { analyzeArchitecture } from "./architecture-analyzer";
import { analyzeDeployment } from "./deployment-analyzer";
import { computeHealthScore } from "./health-score";
import {
  createRepoId,
  saveRepo,
  type RepoKnowledge,
  type VectorDbHealth,
} from "./knowledge";
import { buildObservabilitySnapshot } from "./observability";
import { chunkFiles } from "./rag";
import { buildFileStats, languageBreakdown } from "./repo-stats";
import type { ManifestMap } from "./repo-scanner";
import {
  buildMermaidFromArchitecture,
} from "./architecture-context";
import { flushTelemetry, recordOpenAIUsage, recordRepoIndex } from "@engintel/telemetry";
import { pushOtelEvent } from "./telemetry-stream";
import { isTraceplaneEnabled, recordIndexJobTrace, withTraceplane } from "./traceplane";
import { aiProvider } from "./ai";

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
  const ts = new Date().toISOString();
  const line = `${ts} · ${msg}`;
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

export type IndexRepoOptions = {
  githubUserToken?: string | null;
  indexedBySub?: string | null;
  indexedByEmail?: string | null;
};

export async function indexRepository(
  owner: string,
  repo: string,
  options?: IndexRepoOptions
): Promise<RepoKnowledge> {
  const started = Date.now();
  const id = createRepoId();
  const activityLog: string[] = [];
  const indexedBySub = options?.indexedBySub?.trim() || undefined;
  const indexedByEmail = options?.indexedByEmail?.trim()
    ? options.indexedByEmail.trim().toLowerCase()
    : undefined;

  const pending: RepoKnowledge = {
    id,
    fullName: `${owner}/${repo}`,
    defaultBranch: "main",
    indexedAt: new Date().toISOString(),
    status: "indexing",
    fileCount: 0,
    chunkCount: 0,
    summary: "",
    architectureMermaid: "",
    chunks: [],
    vectorDbHealth: "offline",
    activityLog: [],
    ...(indexedBySub ? { indexedBySub } : {}),
    ...(indexedByEmail ? { indexedByEmail } : {}),
  };
  logStep(activityLog, "indexing started", id);
  await saveRepo({ ...pending, activityLog: [...activityLog] });

  try {
    logStep(activityLog, "fetching repository tree from GitHub", id);
    const { fullName, defaultBranch, files, allPaths } = await fetchRepoFiles(
      owner,
      repo,
      80,
      options?.githubUserToken
    );
    logStep(activityLog, `${files.length} files fetched · ${allPaths.length} paths scanned`, id);

    const manifests = buildManifests(files);
    let chunks = chunkFiles(files);
    logStep(activityLog, `${chunks.length} semantic chunks generated`, id);

    let embeddingsReady = false;
    let vectorDbHealth: VectorDbHealth = "offline";
    if (aiProvider.openai.isConfigured()) {
      try {
        logStep(activityLog, "generating OpenAI embeddings", id);
        chunks = await aiProvider.embedChunks(chunks);
        embeddingsReady = chunks.some((c) => c.embedding?.length);
        vectorDbHealth = embeddingsReady ? "healthy" : "degraded";
        logStep(
          activityLog,
          `embeddings stored · ${chunks.filter((c) => c.embedding?.length).length} vectors`,
          id
        );
      } catch (embErr) {
        console.warn("Embedding generation failed:", embErr);
        logStep(activityLog, "embeddings skipped — keyword retrieval fallback", id);
        vectorDbHealth = "degraded";
      }
    } else {
      logStep(activityLog, "OPENAI_API_KEY missing — skipping embeddings", id);
    }

    const treePreview = files.map((f) => f.path).slice(0, 40).join("\n");
    const summaryPrompt = `Repository: ${fullName}
Files (${files.length}):
${treePreview}

Snippets:
${chunks
  .slice(0, 6)
  .map((c) => `[${c.path}]\n${c.content.slice(0, 300)}`)
  .join("\n\n")}`;

    let summaryPart = `${fullName} is a codebase with ${files.length} indexed source files across ${new Set(files.map((f) => f.path.split("/")[0])).size} top-level modules.`;
    let llmSummaryUsed = false;
    let llmTokens = 0;
    const modelId = aiProvider.claude.modelId();
    try {
      logStep(activityLog, "generating project summary via Claude", id);
      const generateSummary = async () => {
        const result = await aiProvider.generateSummary(
          { ...pending, chunks, fileCount: files.length, chunkCount: chunks.length } as RepoKnowledge,
          summaryPrompt
        );
        if (!result) {
          throw new Error("ANTHROPIC_API_KEY not configured");
        }
        return result;
      };

      let result: Awaited<ReturnType<typeof generateSummary>>;
      if (isTraceplaneEnabled()) {
        try {
          result = await withTraceplane(
            {
              agent: "repograph-index-llm",
              model: modelId,
              provider: "anthropic",
              framework: "ai-sdk",
              environment: process.env.NODE_ENV ?? "development",
              tags: [`repo:${id}`, fullName],
            },
            async (run) => {
              run.setInput(summaryPrompt);
              const out = await generateSummary();
              run.setOutput(out.text);
              run.llmCall({
                model: modelId,
                inputTokens: out.inputTokens,
                outputTokens: out.outputTokens,
              });
              return out;
            }
          );
        } catch (traceErr) {
          console.warn(
            "[traceplane] LLM summary trace failed, continuing:",
            traceErr instanceof Error ? traceErr.message : traceErr
          );
          result = await generateSummary();
        }
      } else {
        result = await generateSummary();
      }

      summaryPart = result.text || summaryPart;
      llmSummaryUsed = true;
      llmTokens = result.inputTokens + result.outputTokens;
      if (llmTokens > 0) {
        recordOpenAIUsage(llmTokens, "index_summary", modelId, id);
        pushOtelEvent({
          kind: "cost",
          name: "engintel.claude.tokens",
          value: llmTokens,
          unit: "tokens",
          attrs: { repo_id: id, operation: "index_summary", model: modelId },
        });
      }
    } catch (aiErr) {
      console.warn("Claude summary skipped:", aiErr);
      logStep(activityLog, "Claude summary skipped — using heuristic analysis", id);
    }

    const architecture = analyzeArchitecture(allPaths, manifests, chunks);
    const mermaid = buildMermaidFromArchitecture(
      architecture,
      summaryPart
    ).slice(0, 4000);
    logStep(activityLog, "architecture context built from repo analysis", id);

    const indexedAt = new Date().toISOString();
    const fileStats = buildFileStats(chunks, indexedAt);
    const indexingDurationMs = Date.now() - started;

    const partial: RepoKnowledge = {
      id,
      fullName,
      defaultBranch,
      indexedAt,
      status: "ready",
      fileCount: files.length,
      chunkCount: chunks.length,
      summary: summaryPart.trim().slice(0, 1200),
      architectureMermaid: mermaid,
      chunks,
      files: fileStats,
      languages: languageBreakdown(fileStats),
      embeddingsReady,
      vectorDbHealth,
      allPaths,
      manifests,
      architecture,
      folderTree: files.map((f) => f.path).slice(0, 120),
      indexingDurationMs,
      ...(indexedBySub ? { indexedBySub } : {}),
      ...(indexedByEmail ? { indexedByEmail } : {}),
    };

    const deployment = analyzeDeployment(
      partial,
      `https://github.com/${fullName}`
    );
    const healthScore = computeHealthScore(
      allPaths,
      manifests,
      deployment,
      architecture
    );
    const observability = buildObservabilitySnapshot(partial, indexingDurationMs);

    logStep(activityLog, `health score: ${healthScore.overall}/100 (${healthScore.grade})`, id);
    logStep(activityLog, "repository sync complete", id);

    const ready: RepoKnowledge = {
      ...partial,
      healthScore,
      observability,
      activityLog,
    };
    recordRepoIndex(
      indexingDurationMs,
      files.length,
      chunks.length,
      fullName,
      "success",
      id
    );
    pushOtelEvent({
      kind: "index",
      name: "Index job completed",
      value: 1,
      unit: "job",
      attrs: {
        repo_id: id,
        files: String(files.length),
        chunks: String(chunks.length),
        duration_ms: String(indexingDurationMs),
      },
    });
    pushOtelEvent({
      kind: "metric",
      name: "engintel.repo.index.duration",
      value: indexingDurationMs,
      unit: "ms",
      attrs: { repo_id: id, files: String(files.length), chunks: String(chunks.length) },
    });
    await flushTelemetry();
    await recordIndexJobTrace({
      fullName,
      fileCount: files.length,
      chunkCount: chunks.length,
      durationMs: indexingDurationMs,
      healthScore: healthScore.overall,
      llmSummaryUsed,
      modelId,
      llmTokens,
    });

    await saveRepo(ready);
    return ready;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    recordRepoIndex(
      Date.now() - started,
      0,
      0,
      `${owner}/${repo}`,
      "error",
      id
    );
    void flushTelemetry();
    logStep(activityLog, `error: ${message}`, id);
    const failed: RepoKnowledge = {
      ...pending,
      status: "error",
      error: message,
      indexedAt: new Date().toISOString(),
      vectorDbHealth: "offline",
      activityLog,
      ...(indexedBySub ? { indexedBySub } : {}),
      ...(indexedByEmail ? { indexedByEmail } : {}),
    };
    await saveRepo(failed);
    throw err;
  }
}
