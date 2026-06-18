"use server";

import { signIn } from "@/lib/authjs";

export async function signInWithGithub(formData: FormData) {
  const switchAccount = formData.get("switchAccount") === "1";
  await signIn("github", {
    redirectTo: "/",
    ...(switchAccount
      ? { authorizationParams: { prompt: "consent" as const } }
      : {}),
  });
}
