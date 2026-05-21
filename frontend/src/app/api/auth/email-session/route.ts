import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookie, verifySessionToken } from "@/lib/auth-session";
import { findUserByEmail } from "@/lib/users-store";

/** Legacy email/password session probe (does not replace Auth.js `/api/auth/session`). */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookie.name)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const email = await verifySessionToken(token);
  if (!email) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    email: user.email,
  });
}
