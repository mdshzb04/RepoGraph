/** Clear email session + NextAuth session, then go to login (no default signout UI). */
export async function performSignOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  const res = await fetch("/api/auth/end-session", {
    method: "POST",
    redirect: "manual",
  });
  const target =
    res.headers.get("Location") ??
    (res.type === "opaqueredirect" ? "/login" : null) ??
    "/login";
  window.location.href = target.startsWith("http")
    ? target
    : `${window.location.origin}${target.startsWith("/") ? target : "/login"}`;
}
