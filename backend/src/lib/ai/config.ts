export type AIConfig = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  embeddingModel: string;
  reasoningModel: string;
  openaiReasoningModel: string;
};

export function getAIConfig(): AIConfig {
  return {
    openaiApiKey:
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.OPENAI_KEY?.trim() ||
      undefined,
    anthropicApiKey:
      process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.CLAUDE_API_KEY?.trim() ||
      undefined,
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    reasoningModel:
      process.env.ANTHROPIC_MODEL?.trim() ||
      process.env.CLAUDE_MODEL?.trim() ||
      "claude-sonnet-4-6",
    openaiReasoningModel:
      process.env.OPENAI_REASONING_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-4.1",
  };
}

export function requireOpenAIKey(): string {
  const key = getAIConfig().openaiApiKey;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is required for embeddings. Add it to backend/.env."
    );
  }
  return key;
}

export function requireAnthropicKey(): string {
  const key = getAIConfig().anthropicApiKey;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for chat and reasoning. Add it to backend/.env."
    );
  }
  return key;
}
