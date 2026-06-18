import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import {
  getAuthConfigStatus,
  GITHUB_OAUTH_CALLBACK_PATH,
  PRODUCTION_SITE_URL,
} from "@/lib/auth-config";

const config = getAuthConfigStatus();
const oauthScope =
  process.env.GITHUB_OAUTH_SCOPE?.trim() ?? "read:user user:email repo";

const providers = [];
if (config.githubId && config.githubSecret) {
  providers.push(
    GitHub({
      clientId: config.githubId,
      clientSecret: config.githubSecret,
      authorization: { params: { scope: oauthScope } },
    })
  );
} else if (process.env.NODE_ENV === "production") {
  console.error("[auth] GitHub OAuth disabled — missing client id/secret.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: config.secret,
  trustHost: true,
  basePath: "/api/auth",
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/auth/sign-out",
  },
  providers,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  callbacks: {
    authorized: () => true,
    async signIn({ account, profile }) {
      if (account?.provider === "github") {
        console.info("[auth] signIn", {
          provider: account.provider,
          login: profile && "login" in profile ? profile.login : undefined,
          sub: profile && "id" in profile ? profile.id : undefined,
        });
        return true;
      }
      return false;
    },
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken =
          typeof account.access_token === "string"
            ? account.access_token
            : undefined;
      }
      if (profile && "login" in profile && typeof profile.login === "string") {
        token.githubLogin = profile.login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const origin = config.siteUrl?.replace(/\/$/, "") ?? baseUrl.replace(/\/$/, "");
      if (url.startsWith("/")) return `${origin}${url}`;
      try {
        if (new URL(url).origin === origin) return url;
      } catch {
        /* ignore */
      }
      return origin;
    },
  },
  events: {
    async signIn(message) {
      console.info("[auth] event signIn", {
        provider: message.account?.provider,
        userId: message.user?.id,
      });
    },
    async signOut(message) {
      console.info("[auth] event signOut", {
        session: "session" in message,
      });
    },
  },
  logger: {
    error(error) {
      console.error("[auth] logger.error", error);
    },
    warn(code) {
      console.warn("[auth] logger.warn", code);
    },
    debug(message, metadata) {
      if (process.env.AUTH_DEBUG === "true") {
        console.debug("[auth] logger.debug", message, metadata);
      }
    },
  },
});

if (process.env.NODE_ENV === "production" && !config.ready) {
  console.error("[auth] production config incomplete", {
    expectedCallback: `${PRODUCTION_SITE_URL}${GITHUB_OAUTH_CALLBACK_PATH}`,
    warnings: config.warnings,
  });
}
