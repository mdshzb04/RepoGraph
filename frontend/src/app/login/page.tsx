import { AuthForm } from "@/components/auth/auth-form";
import { getAuthConfigStatus, getAuthErrorMessage } from "@/lib/auth-config";

export const metadata = {
  title: "Login",
  description: "Continue with GitHub to use AI GitHub Engineering Copilot.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const config = getAuthConfigStatus();

  return (
    <AuthForm
      githubOauthEnabled={config.githubOauthEnabled}
      authError={error ? getAuthErrorMessage(error) : undefined}
      configWarnings={config.warnings}
      callbackUrl={config.callbackUrl}
    />
  );
}
