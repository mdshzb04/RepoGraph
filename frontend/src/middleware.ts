import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { auth } from "@/lib/authjs";
import { authCookie, verifySessionToken } from "@/lib/auth-session";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".webp")
  ) {
    return true;
  }
  return false;
}

async function legacySessionEmail(request: NextAuthRequest): Promise<string | null> {
  const token = request.cookies.get(authCookie.name)?.value;
  return token ? await verifySessionToken(token) : null;
}

export default auth(async (request: NextAuthRequest) => {
  const { pathname } = request.nextUrl;
  const oauthUser = !!request.auth?.user;
  const legacyEmail =
    oauthUser ? null : await legacySessionEmail(request);

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && (oauthUser || legacyEmail)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (oauthUser || legacyEmail) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
