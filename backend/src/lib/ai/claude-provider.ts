import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getAIConfig, requireAnthropicKey } from "./config";
import type { GenerateTextInput, GenerateTextResult } from "./types";
import { AIProviderError } from "./types";

function reasoningModel() {
  requireAnthropicKey();
  return anthropic(getAIConfig().reasoningModel);
}

function mapError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const body =
    err && typeof err === "object" && "responseBody" in err
      ? String((err as { responseBody?: string }).responseBody ?? "")
      : "";
  const combined = `${msg} ${body}`;

  if (/rate limit|429/i.test(combined)) {
    return new AIProviderError("Claude rate-limited.", "CLAUDE_RATE_LIMIT", true);
  }
  if (/401|403|api.?key|authentication/i.test(combined)) {
    return new AIProviderError(
      "Claude API key invalid. Set ANTHROPIC_API_KEY in backend/.env.",
      "CLAUDE_AUTH",
      false
    );
  }
  if (/timeout|503|529|overloaded|capacity/i.test(combined)) {
    return new AIProviderError("Claude temporarily unavailable.", "CLAUDE_UNAVAILABLE", true);
  }
  if (/quota|billing|credit|usage limit/i.test(combined)) {
    return new AIProviderError("Claude quota exceeded.", "CLAUDE_QUOTA", true);
  }
  if (/not_found_error|"model:/i.test(combined)) {
    return new AIProviderError(
      `Claude model unavailable (${getAIConfig().reasoningModel}). Set ANTHROPIC_MODEL.`,
      "CLAUDE_MODEL",
      false
    );
  }
  return new AIProviderError(
    "Claude could not complete this request.",
    "CLAUDE_ERROR",
    true
  );
}

/** Claude — primary reasoning provider. */
export class ClaudeProvider {
  isConfigured(): boolean {
    return Boolean(getAIConfig().anthropicApiKey);
  }

  modelId(): string {
    return getAIConfig().reasoningModel;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const modelId = getAIConfig().reasoningModel;
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
        provider: "anthropic",
      };
    } catch (err) {
      throw mapError(err);
    }
  }

  formatUserError(err: unknown): string {
    return mapError(err).message;
  }
}

export const claudeProvider = new ClaudeProvider();
