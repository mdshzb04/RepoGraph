"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";
import { Download, Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

let mermaidReady = false;

function initMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "ui-monospace, monospace",
    flowchart: { curve: "basis", padding: 16, htmlLabels: true },
  });
  mermaidReady = true;
}

type MermaidDiagramProps = {
  chart: string;
  className?: string;
  minHeight?: number;
};

export function MermaidDiagram({
  chart,
  className,
  minHeight = 360,
}: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null
  );

  useEffect(() => {
    const source = chart?.trim();
    if (!source) {
      setSvg(null);
      setError(null);
      return;
    }

    let cancelled = false;
    initMermaid();

    (async () => {
      try {
        const { svg: rendered } = await mermaid.render(
          `mmd-${reactId}-${Date.now()}`,
          source
        );
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
          setScale(1);
          setPan({ x: 0, y: 0 });
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((s) => Math.min(3, Math.max(0.35, s + delta)));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan.x, pan.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const downloadSvg = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  const downloadPng = useCallback(() => {
    if (!svg || !containerRef.current) return;
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = "diagram.png";
        a.click();
        URL.revokeObjectURL(pngUrl);
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [svg]);

  if (!chart?.trim()) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No diagram available.
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Could not render diagram: {error}
        </p>
        <pre className="max-h-[min(320px,50vh)] overflow-auto rounded-lg border border-border/40 bg-muted/20 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(3, s + 0.15))}
          className="rounded-md border border-border/50 bg-muted/30 p-1.5 text-muted-foreground hover:text-foreground"
          title="Zoom in"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.35, s - 0.15))}
          className="rounded-md border border-border/50 bg-muted/30 p-1.5 text-muted-foreground hover:text-foreground"
          title="Zoom out"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded-md border border-border/50 bg-muted/30 p-1.5 text-muted-foreground hover:text-foreground"
          title="Reset view"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <span className="px-2 text-[10px] text-muted-foreground">
          {Math.round(scale * 100)}% · drag to pan
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={downloadSvg}
            disabled={!svg}
            className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Download className="size-3" />
            SVG
          </button>
          <button
            type="button"
            onClick={downloadPng}
            disabled={!svg}
            className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Download className="size-3" />
            PNG
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative overflow-hidden rounded-lg border border-border/40 bg-[#0a0a0f] touch-none"
        style={{ minHeight, maxHeight: "min(560px, 65vh)" }}
      >
        {!svg && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Rendering diagram…
          </p>
        )}
        <div
          ref={containerRef}
          className="flex min-h-full w-full items-center justify-center p-6 [&_svg]:max-w-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
      </div>
    </div>
  );
}
