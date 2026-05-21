const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const authCookie = {
  name: "defi_session",
  maxAge: 60 * 60 * 24 * 7,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export function isValidEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254) return false;
  return EMAIL_REGEX.test(normalized);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getSessionSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-only-change-auth-secret-in-production"
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payload: string): Promise<string> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(email: string): Promise<string> {
  const payload = `${normalizeEmail(email)}:${Date.now()}`;
  const signature = await signPayload(payload);
  return toBase64Url(new TextEncoder().encode(`${payload}|${signature}`));
}

export async function verifySessionToken(
  token: string
): Promise<string | null> {
  try {
    const decoded = new TextDecoder().decode(fromBase64Url(token));
    const separator = decoded.lastIndexOf("|");
    if (separator === -1) return null;

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    const expected = await signPayload(payload);

    if (signature.length !== expected.length) return null;

    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    const [email, issuedAtRaw] = payload.split(":");
    const issuedAt = Number(issuedAtRaw);
    if (!email || !issuedAt || Number.isNaN(issuedAt)) return null;
    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return null;
    if (!isValidEmail(email)) return null;

    return normalizeEmail(email);
  } catch {
    return null;
  }
}
