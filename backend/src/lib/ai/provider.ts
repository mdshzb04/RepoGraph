import type { RepoKnowledge } from "../knowledge";
import { buildContextBlock, retrieveChunksKeyword } from "../rag";
import { embedChunks, embedQuery, cosineSimilarity } from "./embeddings";
import { claudeProvider } from "./claude-provider";
import { openAIProvider } from "./openai-provider";
import {
  ARCHITECTURE_GENERATION_SYSTEM,
  DEPENDENCY_ANALYSIS_SYSTEM,
  DOCUMENTATION_GENERATION_SYSTEM,
  INDEX_SUMMARY_SYSTEM,
  WORKFLOW_GENERATION_SYSTEM,
  buildExplainPrompt,
} from "./prompts";
import type { GenerateTextResult, RepoAiInsights } from "./types";
import { sanitizeMermaid, sanitizeSummary } from "../architecture-context";
import type { ArchitectureAnalysis } from "../architecture-analyzer";

export type AIProviderFacade = {
  openai: typeof openAIProvider;
  claude: typeof claudeProvider;
  embedChunks: typeof embedChunks;
  embedQuery: typeof embedQuery;
  retrieveContext: (
    repo: RepoKnowledge,
    query: string,
    limit?: number
  ) => Promise<string>;
  generateSummary: (
    repo: RepoKnowledge,
    preview: string
  ) => Promise<GenerateTextResult | null>;
  generateInsights: (repo: RepoKnowledge) => Promise<RepoAiInsights>;
  explain: (
    repo: RepoKnowledge,
    subject: string,
    focus: string
  ) => Promise<GenerateTextResult>;
};

function heuristicContext(repo: RepoKnowledge): string {
  const arch = repo.architecture;
  const lines: string[] = [
    `Repository: ${repo.fullName}`,
    `Files: ${repo.fileCount} · Chunks: ${repo.chunkCount}`,
    `Default branch: ${repo.defaultBranch}`,
    "",
    "## Summary",
    repo.summary,
  ];

  if (arch) {
    lines.push("", "## Detected services", formatArchitectureHints(arch));
    if (arch.apiRoutes?.length) {
      lines.push(
        "",
        "## API routes",
        arch.apiRoutes
          .slice(0, 20)
          .map((r) => `- ${r.method} ${r.path} (${r.file})`)
          .join("\n")
      );
    }
  }

  if (repo.folderTree?.length) {
    lines.push(
      "",
      "## Top paths",
      repo.folderTree.slice(0, 40).map((p) => `- ${p}`).join("\n")
    );
  }

  if (repo.manifests) {
    lines.push("", "## Manifests", Object.keys(repo.manifests).join(", "));
  }

  return lines.join("\n");
}

function formatArchitectureHints(arch: ArchitectureAnalysis): string {
  return arch.services
    .map((s) => `- ${s.label} (${s.type}): ${s.paths.slice(0, 3).join(", ")}`)
    .join("\n");
}

async function retrieveChunksHybrid(
  repo: RepoKnowledge,
  query: string,
  limit = 8
) {
  const chunks = repo.chunks;
  const hasVectors = chunks.some((c) => c.embedding?.length);
  if (hasVectors && openAIProvider.isConfigured() && query.trim()) {
    try {
      const qEmb = await embedQuery(query);
      return chunks
        .filter((c) => c.embedding?.length)
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(qEmb, chunk.embedding!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.chunk);
    } catch {
      /* fall through */
    }
  }
  return retrieveChunksKeyword(chunks, query, limit);
}

function extractMermaid(text: string): string {
  const fenced = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return sanitizeMermaid(fenced[1].trim());
  const anyFence = text.match(/```\s*([\s\S]*?)```/);
  if (anyFence?.[1]?.includes("graph") || anyFence?.[1]?.includes("flowchart")) {
    return sanitizeMermaid(anyFence[1].trim());
  }
  return sanitizeMermaid(text.trim());
}

async function buildFullContext(
  repo: RepoKnowledge,
  query?: string
): Promise<string> {
  const q = query?.trim() || "architecture services modules dependencies data flow";
  const relevant = await retrieveChunksHybrid(repo, q, 10);
  return `${heuristicContext(repo)}

## Relevant code
${buildContextBlock(relevant)}`;
}

export const aiProvider: AIProviderFacade = {
  openai: openAIProvider,
  claude: claudeProvider,
  embedChunks,
  embedQuery,

  async retrieveContext(repo, query, limit = 8) {
    const chunks = await retrieveChunksHybrid(repo, query, limit);
    return buildContextBlock(chunks);
  },

  async generateSummary(repo, preview) {
    if (!claudeProvider.isConfigured()) return null;
    const result = await claudeProvider.generateText({
      task: "index_summary",
      system: INDEX_SUMMARY_SYSTEM,
      prompt: preview,
      maxOutputTokens: 512,
    });
    return { ...result, text: sanitizeSummary(result.text) };
  },

  async generateInsights(repo) {
    const context = await buildFullContext(repo);
    const base = { prompt: context, maxOutputTokens: 4096 as const };

    const [arch, workflow, deps] = await Promise.all([
      claudeProvider.generateText({
        task: "architecture",
        system: ARCHITECTURE_GENERATION_SYSTEM,
        ...base,
      }),
      claudeProvider.generateText({
        task: "workflow",
        system: WORKFLOW_GENERATION_SYSTEM,
        ...base,
      }),
      claudeProvider.generateText({
        task: "dependency_analysis",
        system: DEPENDENCY_ANALYSIS_SYSTEM,
        ...base,
      }),
    ]);

    return {
      architectureMermaid: extractMermaid(arch.text),
      workflowMermaid: extractMermaid(workflow.text),
      dependencyAnalysis: deps.text.trim(),
      generatedAt: new Date().toISOString(),
    };
  },

  async explain(repo, subject, focus) {
    const context = await buildFullContext(repo, `${subject} ${focus}`);
    return claudeProvider.generateText({
      task: "documentation",
      system: DOCUMENTATION_GENERATION_SYSTEM,
      prompt: `${buildExplainPrompt(subject, focus)}\n\n## Repository context\n${context}`,
      maxOutputTokens: 3000,
    });
  },
};

export { REPOSITORY_CHAT_SYSTEM } from "./prompts";
