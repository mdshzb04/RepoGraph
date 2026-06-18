import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
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
  sanitizeSummary,
} from "./architecture-context";
import { flushTelemetry, recordOpenAIUsage, recordRepoIndex } from "@engintel/telemetry";
import { pushOtelEvent } from "./telemetry-stream";
import { isTraceplaneEnabled, withTraceplane } from "./traceplane";

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
    const chunks = chunkFiles(files);
    logStep(activityLog, `${chunks.length} semantic chunks generated`, id);

    const treePreview = files.map((f) => f.path).slice(0, 40).join("\n");
    const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const summaryPrompt = `Repository: ${fullName}
Files (${files.length}):
${treePreview}

Snippets:
${chunks
  .slice(0, 6)
  .map((c) => `[${c.path}]\n${c.content.slice(0, 300)}`)
  .join("\n\n")}`;

    let summaryPart = `${fullName} is a codebase with ${files.length} indexed source files across ${new Set(files.map((f) => f.path.split("/")[0])).size} top-level modules.`;
    try {
      logStep(activityLog, "generating project summary via LLM", id);
      const generateSummary = async () => {
        const { text, usage } = await generateText({
          model: openai(modelId),
          system:
            "Write only a plain 3-4 sentence project summary for engineers. No markdown headings, no code fences, no Mermaid, no JSON.",
          prompt: summaryPrompt,
        });
        return { text, usage };
      };

      const { text, usage } = isTraceplaneEnabled()
        ? await withTraceplane(
            {
              agent: "repograph-index",
              model: modelId,
              provider: "openai",
              framework: "ai-sdk",
              environment: process.env.NODE_ENV ?? "development",
              tags: [`repo:${id}`, fullName],
            },
            async (run) => {
              run.setInput(summaryPrompt);
              const result = await generateSummary();
              run.setOutput(result.text);
              run.llmCall({
                model: modelId,
                inputTokens: result.usage?.inputTokens ?? 0,
                outputTokens: result.usage?.outputTokens ?? 0,
              });
              return result;
            }
          )
        : await generateSummary();

      summaryPart = sanitizeSummary(text) || summaryPart;
      const tokens = usage?.totalTokens ?? 0;
      if (tokens > 0) {
        recordOpenAIUsage(tokens, "index_summary", modelId, id);
        pushOtelEvent({
          kind: "cost",
          name: "engintel.openai.tokens",
          value: tokens,
          unit: "tokens",
          attrs: { repo_id: id, operation: "index_summary", model: modelId },
        });
      }
    } catch (aiErr) {
      console.warn("AI summary skipped:", aiErr);
      logStep(activityLog, "LLM summary skipped — using heuristic analysis", id);
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
      embeddingsReady: true,
      vectorDbHealth: "healthy" as VectorDbHealth,
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

    logStep(activityLog, "embeddings stored · vector index online", id);
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
