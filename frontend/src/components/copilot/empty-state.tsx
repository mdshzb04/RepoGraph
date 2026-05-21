"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Awaiting repository connection",
  "Analyzing repository structure",
  "Generating embeddings",
  "Building knowledge graph",
  "Architecture graph ready",
];

export function CopilotEmptyState({ indexing }: { indexing: boolean }) {
  const [lines, setLines] = useState<string[]>([STEPS[0]]);

  useEffect(() => {
    if (!indexing) {
      setLines([STEPS[0]]);
      return;
    }
    let i = 1;
    setLines([STEPS[0], STEPS[1]]);
    const t = setInterval(() => {
      i = Math.min(i + 1, STEPS.length - 1);
      setLines(STEPS.slice(0, i + 1));
      if (i >= STEPS.length - 1) clearInterval(t);
    }, 2200);
    return () => clearInterval(t);
  }, [indexing]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="copilot-glass w-full max-w-md rounded-xl p-6 font-mono text-sm">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          copilot · session
        </p>
        {lines.map((line, idx) => (
          <p
            key={line}
            className="copilot-terminal-line text-muted-foreground"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <span className="text-foreground/50">{">"}</span> {line}
            {idx === lines.length - 1 && indexing && (
              <span className="copilot-cursor" />
            )}
          </p>
        ))}
      </div>
      <p className="mt-6 max-w-sm text-center text-sm text-muted-foreground">
        Connect a GitHub repository to enable semantic search, architecture
        analysis, and code-aware chat.
      </p>
    </div>
  );
}
