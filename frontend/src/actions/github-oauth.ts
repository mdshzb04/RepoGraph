"use server";

import { signIn } from "@/lib/authjs";

export async function signInWithGithub() {
  await signIn("github", { redirectTo: "/" });
}
