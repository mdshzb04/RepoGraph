import type { DefaultSession } from "next-auth";

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
    };
  }
}
