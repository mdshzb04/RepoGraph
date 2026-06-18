import { handlers } from "@/lib/authjs";
import { shouldLogAuthPath } from "@/lib/auth-config";
import type { NextRequest } from "next/server";

const { GET: authGET, POST: authPOST } = handlers;

async function logAuthResponse(
  method: string,
  req: NextRequest,
  res: Response
): Promise<Response> {
  const { pathname, search } = new URL(req.url);
  if (!shouldLogAuthPath(pathname)) return res;

  const line = `[auth] ${method} ${pathname}${search} -> ${res.status}`;
  if (res.status >= 400) {
    console.error(line);
    if (pathname.includes("/error") || pathname.includes("/callback/")) {
      const clone = res.clone();
      const body = await clone.text().catch(() => "");
      if (body) console.error("[auth] response body:", body.slice(0, 500));
    }
  } else {
    console.info(line);
  }
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const res = await authGET(req);
    return logAuthResponse("GET", req, res);
  } catch (error) {
    console.error("[auth] GET unhandled", req.url, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const res = await authPOST(req);
    return logAuthResponse("POST", req, res);
  } catch (error) {
    console.error("[auth] POST unhandled", req.url, error);
    throw error;
  }
}
