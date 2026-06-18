export type OtelStreamEvent = {
  id: string;
  at: string;
  kind: "metric" | "span" | "log" | "index" | "retrieval" | "cost";
  name: string;
  value?: number | string;
  unit?: string;
  attrs?: Record<string, string>;
  severity?: "info" | "warn" | "error";
};

const MAX = 120;
const buffer: OtelStreamEvent[] = [];
const subscribers = new Set<(e: OtelStreamEvent) => void>();

let traceRecorder: ((repoId?: string, kind?: string) => void) | null = null;

/** Wire from backend after telemetry init — avoids circular imports. */
export function setTraceRecorder(fn: (repoId?: string, kind?: string) => void): void {
  traceRecorder = fn;
}

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pushOtelEvent(
  partial: Omit<OtelStreamEvent, "id" | "at"> & { at?: string }
): OtelStreamEvent {
  const event: OtelStreamEvent = {
    id: id(),
    at: partial.at ?? new Date().toISOString(),
    kind: partial.kind,
    name: partial.name,
    value: partial.value,
    unit: partial.unit,
    attrs: partial.attrs,
    severity: partial.severity,
  };
  buffer.push(event);
  if (buffer.length > MAX) buffer.shift();
  traceRecorder?.(partial.attrs?.repo_id ?? partial.attrs?.repoId, partial.kind);
  for (const sub of subscribers) sub(event);
  return event;
}

export function getRecentOtelEvents(limit = 40): OtelStreamEvent[] {
  return buffer.slice(-limit);
}

export function getRecentOtelEventsForRepo(
  repoId: string,
  limit = 40
): OtelStreamEvent[] {
  return buffer
    .filter((e) => e.attrs?.repo_id === repoId || e.attrs?.repoId === repoId)
    .slice(-limit);
}

export function subscribeOtel(fn: (e: OtelStreamEvent) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function sseOtelHandler(
  req: { on: (ev: string, fn: () => void) => void },
  res: {
    setHeader: (k: string, v: string) => void;
    flushHeaders?: () => void;
    write: (chunk: string) => void;
    end: () => void;
  },
  repoId: string
): () => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: "hello", repoId, events: getRecentOtelEventsForRepo(repoId, 24) });

  const unsub = subscribeOtel((e) => {
    if (e.attrs?.repo_id === repoId || e.attrs?.repoId === repoId) {
      send({ type: "event", event: e });
    }
  });

  const heartbeat = setInterval(() => {
    send({ type: "heartbeat", at: new Date().toISOString() });
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsub();
    res.end();
  });

  return unsub;
}
