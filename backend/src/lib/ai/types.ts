export type ReasoningTask =
  | "repository_chat"
  | "index_summary"
  | "architecture"
  | "workflow"
  | "dependency_analysis"
  | "documentation";

export type GenerateTextInput = {
  task: ReasoningTask;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
};

export type GenerateTextResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider?: "anthropic" | "openai";
};

export type RepoAiInsights = {
  architectureMermaid: string;
  workflowMermaid: string;
  dependencyAnalysis: string;
  generatedAt: string;
  indexedAt: string;
  architectureHash: string;
  reasoningProvider?: "anthropic" | "openai";
  reasoningModel?: string;
};

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
