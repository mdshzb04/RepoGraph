import { NextResponse } from "next/server";
import { signOut } from "@/lib/authjs";
import { authCookie } from "@/lib/auth-session";

export async function POST(request: Request) {
  const login = new URL("/login", request.url);
  const signOutResponse = await signOut({ redirect: false });
  const response = NextResponse.redirect(login);

  response.cookies.set(authCookie.name, "", {
    ...authCookie.options,
    maxAge: 0,
  });

  if (signOutResponse instanceof Response) {
    for (const cookie of signOutResponse.headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }
  }

  return response;
}
