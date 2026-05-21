import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const githubId =
  process.env.AUTH_GITHUB_ID?.trim() || process.env.GITHUB_ID?.trim();
const githubSecret =
  process.env.AUTH_GITHUB_SECRET?.trim() || process.env.GITHUB_SECRET?.trim();

const oauthScope =
  process.env.GITHUB_OAUTH_SCOPE?.trim() ?? "read:user user:email repo";

const providers = [];
if (githubId && githubSecret) {
  providers.push(
    GitHub({
      clientId: githubId,
      clientSecret: githubSecret,
      authorization: { params: { scope: oauthScope } },
    })
  );
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "[auth] GitHub OAuth is disabled: set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  basePath: "/api/auth",
  pages: {
    signOut: "/auth/sign-out",
  },
  providers,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  callbacks: {
    authorized: () => true,
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken =
          typeof account.access_token === "string"
            ? account.access_token
            : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
