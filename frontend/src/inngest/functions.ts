import { inngest } from "./client";

export const testBackgroundJob = inngest.createFunction(
  {
    id: "test-background-job",
    triggers: [{ event: "app/test.event" }],
  },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { message: `Hello Inngest! Processed event: ${event.name}` };
  }
);
