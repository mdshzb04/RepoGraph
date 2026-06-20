import type { RepoKnowledge } from "../knowledge";
import { buildContextBlock, retrieveChunks } from "../rag";
import { embedChunks, embedQuery } from "./embeddings";
import { claudeProvider } from "./claude-provider";
import { openAIProvider } from "./openai-provider";
import { reasoningRouter } from "./reasoning-router";
import {
  buildArchitecturePrompt,
  buildDependencyPrompt,
  buildExplainPrompt,
  buildWorkflowPrompt,
  ARCHITECTURE_GENERATION_SYSTEM,
  DEPENDENCY_ANALYSIS_SYSTEM,
  DOCUMENTATION_GENERATION_SYSTEM,
  INDEX_SUMMARY_SYSTEM,
  WORKFLOW_GENERATION_SYSTEM,
} from "./prompts";
import {
  buildCondensedContextJson,
  computeArchitectureHash,
} from "./condensed-context";
import { buildWorkflowDiagram, buildWorkflowMermaid } from "../workflow-diagram";
import { extractMermaid, mergeMermaid } from "./mermaid-utils";
import type { GenerateTextResult, RepoAiInsights } from "./types";
import { sanitizeSummary } from "../architecture-context";

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

export const aiProvider: AIProviderFacade = {
  openai: openAIProvider,
  claude: claudeProvider,
  embedChunks,
  embedQuery,

  async retrieveContext(repo, query, limit = 8) {
    const chunks = await retrieveChunks(repo.chunks, query, limit, repo.id);
    return buildContextBlock(chunks);
  },

  async generateSummary(repo, preview) {
    if (!reasoningRouter.isConfigured()) return null;
    const result = await reasoningRouter.generateText({
      task: "index_summary",
      system: INDEX_SUMMARY_SYSTEM,
      prompt: preview,
      maxOutputTokens: 512,
    });
    return { ...result, text: sanitizeSummary(result.text) };
  },

  async generateInsights(repo) {
    const condensed = buildCondensedContextJson(repo);
    const staticWorkflow = buildWorkflowMermaid(repo, buildWorkflowDiagram(repo));
    const staticArchitecture = repo.architectureMermaid ?? "";

    const [arch, workflow, deps] = await Promise.all([
      reasoningRouter.generateText({
        task: "architecture",
        system: ARCHITECTURE_GENERATION_SYSTEM,
        prompt: buildArchitecturePrompt(condensed),
        maxOutputTokens: 2048,
      }),
      reasoningRouter.generateText({
        task: "workflow",
        system: WORKFLOW_GENERATION_SYSTEM,
        prompt: buildWorkflowPrompt(condensed),
        maxOutputTokens: 2048,
      }),
      reasoningRouter.generateText({
        task: "dependency_analysis",
        system: DEPENDENCY_ANALYSIS_SYSTEM,
        prompt: buildDependencyPrompt(condensed),
        maxOutputTokens: 2048,
      }),
    ]);

    const provider = arch.provider ?? workflow.provider ?? deps.provider;

    return {
      architectureMermaid: mergeMermaid(arch.text, staticArchitecture, 12),
      workflowMermaid: mergeMermaid(workflow.text, staticWorkflow, 10),
      dependencyAnalysis: deps.text.trim(),
      generatedAt: new Date().toISOString(),
      indexedAt: repo.indexedAt,
      architectureHash: computeArchitectureHash(repo),
      reasoningProvider: provider,
      reasoningModel: arch.model,
    };
  },

  async explain(repo, subject, focus) {
    const condensed = buildCondensedContextJson(repo);
    const codeContext = await retrieveChunks(
      repo.chunks,
      `${subject} ${focus}`,
      4,
      repo.id
    );
    return reasoningRouter.generateText({
      task: "documentation",
      system: DOCUMENTATION_GENERATION_SYSTEM,
      prompt: `${buildExplainPrompt(subject, focus)}

## Static analysis
\`\`\`json
${condensed}
\`\`\`

## Relevant code (limited)
${buildContextBlock(codeContext)}`,
      maxOutputTokens: 2500,
    });
  },
};

export { REPOSITORY_CHAT_SYSTEM } from "./prompts";
