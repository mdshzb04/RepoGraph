"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RepoMeta } from "./types";
import { CopilotEmptyState } from "./empty-state";
import {
  loadGlobalChatMessages,
  saveGlobalChatMessages,
} from "@/lib/copilot-chat-memory";

const CHAT_API = "/api/copilot/chat";

const SUGGESTIONS = [
  "Summarize the architecture",
  "Find security gaps",
  "Suggest test coverage",
  "Explain the API layer",
];

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatPanel({
  repo,
  indexing,
  input,
  setInput,
}: {
  repo: RepoMeta | null;
  indexing: boolean;
  input: string;
  setInput: (v: string) => void;
}) {
  const repoRef = useRef(repo);
  repoRef.current = repo;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [initialMessages] = useState<UIMessage[]>(loadGlobalChatMessages);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: CHAT_API,
        body: () => ({ repoId: repoRef.current?.id ?? null }),
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    id: "copilot-global-memory",
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    const t = window.setTimeout(() => saveGlobalChatMessages(messages), 400);
    return () => window.clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "streaming" || status === "submitted";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading || !repo) return;
    setInput("");
    await sendMessage({ text });
  }

  if (!repo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CopilotEmptyState indexing={indexing} />
      </div>
    );
  }

  return (
    <div className="copilot-chat flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/40 bg-card/40 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{repo.fullName}</p>
            <p className="text-[11px] text-muted-foreground">
              {repo.chunkCount} chunks · {repo.fileCount} files indexed
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 pt-8">
            <div className="text-center">
              <p className="text-lg font-medium tracking-tight">What should we explore?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask about architecture, bugs, refactors, or deployment.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="copilot-glass rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50",
                      isUser ? "bg-muted" : "bg-primary/10 text-primary"
                    )}
                  >
                    {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </span>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                      isUser
                        ? "copilot-glass bg-primary/10 text-foreground"
                        : "copilot-glass border border-border/30"
                    )}
                  >
                    {getMessageText(m)}
                  </div>
                </div>
              );
            })}
            {isLoading && messages.at(-1)?.role === "user" && (
              <div className="flex gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="size-3.5" />
                </span>
                <div className="copilot-glass flex items-center gap-1 rounded-2xl px-4 py-3">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background/90 p-4 backdrop-blur-md sm:px-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="copilot-glass flex items-center gap-2 rounded-xl border border-border/50 py-1.5 pr-1.5 pl-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit(e);
                }
              }}
              rows={1}
              placeholder={`Ask about ${repo.fullName}…`}
              disabled={!repo}
              className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon-sm"
              disabled={isLoading || !input.trim() || !repo}
              className="shrink-0 self-center"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
