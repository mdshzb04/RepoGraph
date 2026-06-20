import { claudeProvider } from "./claude-provider";
import { openAIProvider } from "./openai-provider";
import type { GenerateTextInput, GenerateTextResult } from "./types";
import { AIProviderError } from "./types";

export type ReasoningProviderId = "anthropic" | "openai";

function isFallbackEligible(err: unknown): boolean {
  if (err instanceof AIProviderError) {
    return err.retryable && err.code !== "CLAUDE_AUTH" && err.code !== "CLAUDE_MODEL";
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate limit|503|529|timeout|overloaded|quota|capacity|unavailable/i.test(msg);
}

function logRouting(
  task: string,
  provider: ReasoningProviderId,
  model: string,
  fallback = false
): void {
  console.log(
    `[ai:router] task=${task} provider=${provider} model=${model}${fallback ? " (fallback)" : ""}`
  );
}

/** Provider-agnostic reasoning — Claude primary, OpenAI GPT fallback. */
export const reasoningRouter = {
  isConfigured(): boolean {
    return claudeProvider.isConfigured() || openAIProvider.isConfigured();
  },

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    if (claudeProvider.isConfigured()) {
      try {
        const result = await claudeProvider.generateText(input);
        logRouting(input.task, "anthropic", result.model);
        return result;
      } catch (first) {
        if (!isFallbackEligible(first) || !openAIProvider.isConfigured()) {
          throw first;
        }
        console.warn(
          `[ai:router] Claude failed (${first instanceof Error ? first.message : first}), retrying once…`
        );
        try {
          const retry = await claudeProvider.generateText(input);
          logRouting(input.task, "anthropic", retry.model);
          return retry;
        } catch (second) {
          if (!isFallbackEligible(second) || !openAIProvider.isConfigured()) {
            throw second;
          }
          const fallback = await openAIProvider.generateText(input);
          logRouting(input.task, "openai", fallback.model, true);
          return fallback;
        }
      }
    }

    if (openAIProvider.isConfigured()) {
      const result = await openAIProvider.generateText(input);
      logRouting(input.task, "openai", result.model);
      return result;
    }

    throw new AIProviderError(
      "No reasoning provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
      "NO_PROVIDER",
      false
    );
  },

  formatUserError(err: unknown): string {
    if (err instanceof AIProviderError) return err.message;
    return claudeProvider.formatUserError(err);
  },
};
