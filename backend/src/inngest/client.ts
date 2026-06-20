import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "repograph-api",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export function isInngestEnabled(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}

export const INDEX_REPOSITORY_EVENT = "repograph/repo.index.requested";
