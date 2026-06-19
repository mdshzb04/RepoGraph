import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getAIConfig, requireAnthropicKey } from "./config";
import type { GenerateTextInput, GenerateTextResult } from "./types";
import { AIProviderError } from "./types";

function reasoningModel() {
  requireAnthropicKey();
  return anthropic(getAIConfig().reasoningModel);
}

function friendlyError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/rate limit|429/i.test(msg)) {
    return new AIProviderError(
      "Claude is rate-limited. Please wait a moment and try again.",
      "CLAUDE_RATE_LIMIT",
      true
    );
  }
  if (/401|403|api.?key|authentication/i.test(msg)) {
    return new AIProviderError(
      "Claude API key is invalid or missing. Set ANTHROPIC_API_KEY in backend/.env.",
      "CLAUDE_AUTH",
      false
    );
  }
  if (/timeout|503|529|overloaded/i.test(msg)) {
    return new AIProviderError(
      "Claude is temporarily unavailable. Please try again shortly.",
      "CLAUDE_UNAVAILABLE",
      true
    );
  }
  return new AIProviderError(
    "Claude could not complete this request. Please try again.",
    "CLAUDE_ERROR",
    true
  );
}

async function once(input: GenerateTextInput): Promise<GenerateTextResult> {
  const modelId = getAIConfig().reasoningModel;
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
  };
}

/** Claude — reasoning, chat, architecture, workflows, analysis. */
export class ClaudeProvider {
  isConfigured(): boolean {
    return Boolean(getAIConfig().anthropicApiKey);
  }

  modelId(): string {
    return getAIConfig().reasoningModel;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    try {
      return await once(input);
    } catch (first) {
      try {
        return await once(input);
      } catch (second) {
        throw friendlyError(second ?? first);
      }
    }
  }

  formatUserError(err: unknown): string {
    return friendlyError(err).message;
  }
}

export const claudeProvider = new ClaudeProvider();
