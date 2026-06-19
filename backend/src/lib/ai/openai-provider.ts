import { getAIConfig } from "./config";

/** OpenAI — embeddings only (no chat completions). */
export class OpenAIProvider {
  isConfigured(): boolean {
    return Boolean(getAIConfig().openaiApiKey);
  }

  embeddingModelId(): string {
    return getAIConfig().embeddingModel;
  }
}

export const openAIProvider = new OpenAIProvider();
