import { testBackgroundJob } from "./functions";

// Export all background jobs here
export const functions = [
  testBackgroundJob,
  // Future jobs will be added here:
  // indexRepository,
  // generateEmbeddings,
  // analyzePR,
];

export { inngest } from "./client";
