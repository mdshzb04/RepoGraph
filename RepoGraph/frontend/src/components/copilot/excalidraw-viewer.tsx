"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawScene } from "./types";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(720px,75vh)] items-center justify-center font-mono text-xs text-muted-foreground">
        {">"} Loading diagram…
      </div>
    ),
  }
);

export function ExcalidrawViewer({ scene }: { scene: ExcalidrawScene | null }) {
  const initialData = useMemo((): ExcalidrawInitialDataState | null => {
    if (!scene?.elements?.length) return null;
    return {
      elements: scene.elements as unknown as ExcalidrawInitialDataState["elements"],
      appState: {
        viewBackgroundColor: "transparent",
        currentItemStrokeColor: scene.appState?.currentItemStrokeColor ?? "#475569",
        theme: "dark",
        zenModeEnabled: true,
      },
      scrollToContent: true,
    };
  }, [scene]);

  if (!initialData) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Re-index the repository to generate diagrams.
      </p>
    );
  }

  return (
    <div className="h-[min(720px,75vh)] min-h-[480px] w-full overflow-hidden rounded-lg border border-border/40 bg-muted/5">
      <Excalidraw
        initialData={initialData}
        viewModeEnabled
        zenModeEnabled
        gridModeEnabled={false}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: { saveFileToDisk: true },
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}
