import { serve } from "inngest/next";
import { inngest, functions } from "../../../inngest";

// Expose the API to Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
