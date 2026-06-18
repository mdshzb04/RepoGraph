import type { UIMessage } from "ai";

const KEY = "copilot_global_chat_v1";
const MAX_MESSAGES = 100;

export function loadGlobalChatMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (m): m is UIMessage =>
        m != null &&
        typeof m === "object" &&
        "id" in m &&
        "role" in m &&
        "parts" in m
    );
  } catch {
    return [];
  }
}

export function saveGlobalChatMessages(messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const clipped =
      messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;
    localStorage.setItem(KEY, JSON.stringify(clipped));
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearGlobalChatMemory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
