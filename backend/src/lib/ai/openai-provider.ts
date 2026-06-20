import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getAIConfig } from "./config";
import type { GenerateTextInput, GenerateTextResult } from "./types";
import { AIProviderError } from "./types";

function reasoningModel() {
  const { openaiReasoningModel } = getAIConfig();
  return openai(openaiReasoningModel);
}

function mapError(err: unknown): AIProviderError {
  const msg = err instanceof Error ? err.message : String(err);
  if (/rate limit|429/i.test(msg)) {
    return new AIProviderError("OpenAI rate-limited.", "OPENAI_RATE_LIMIT", true);
  }
  if (/401|403|api.?key|authentication/i.test(msg)) {
    return new AIProviderError("OpenAI API key invalid.", "OPENAI_AUTH", false);
  }
  if (/timeout|503|529|overloaded|capacity/i.test(msg)) {
    return new AIProviderError("OpenAI temporarily unavailable.", "OPENAI_UNAVAILABLE", true);
  }
  if (/quota|billing|insufficient/i.test(msg)) {
    return new AIProviderError("OpenAI quota exceeded.", "OPENAI_QUOTA", true);
  }
  return new AIProviderError("OpenAI could not complete this request.", "OPENAI_ERROR", true);
}

/** OpenAI — embeddings via embeddings.ts; reasoning fallback only. */
export class OpenAIProvider {
  isConfigured(): boolean {
    return Boolean(getAIConfig().openaiApiKey);
  }

  embeddingModelId(): string {
    return getAIConfig().embeddingModel;
  }

  reasoningModelId(): string {
    return getAIConfig().openaiReasoningModel;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const modelId = getAIConfig().openaiReasoningModel;
    if (!getAIConfig().openaiApiKey) {
      throw new AIProviderError("OPENAI_API_KEY not configured.", "OPENAI_AUTH", false);
    }
    try {
      const { text, usage } = await generateText({
        model: reasoningModel(),
        system: input.system,
        prompt: input.prompt,
        maxOutputTokens: input.maxOutputTokens ?? 4096,
      });
      return {
        text,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        model: modelId,
        provider: "openai",
      };
    } catch (err) {
      throw mapError(err);
    }
  }
}

export const openAIProvider = new OpenAIProvider();
