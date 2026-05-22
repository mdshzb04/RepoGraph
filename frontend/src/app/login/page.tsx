import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Login",
  description: "Continue with GitHub to use AI GitHub Engineering Copilot.",
};

function isGithubOauthEnabled(): boolean {
  const id =
    process.env.AUTH_GITHUB_ID?.trim() ?? process.env.GITHUB_ID?.trim();
  const secret =
    process.env.AUTH_GITHUB_SECRET?.trim() ??
    process.env.GITHUB_SECRET?.trim();
  return Boolean(id && secret);
}

export default function LoginPage() {
  return <AuthForm githubOauthEnabled={isGithubOauthEnabled()} />;
}
