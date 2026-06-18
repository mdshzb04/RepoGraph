import { NextResponse } from "next/server";
import { hashPassword, validatePassword } from "@/lib/auth-password";
import {
  authCookie,
  createSessionToken,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth-session";
import { createUser, findUserByEmail } from "@/lib/users-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    if (await findUserByEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    await createUser(normalizedEmail, hashPassword(password));

    const token = await createSessionToken(normalizedEmail);
    const response = NextResponse.json({
      success: true,
      email: normalizedEmail,
      message: "Account created successfully.",
    });

    response.cookies.set(authCookie.name, token, authCookie.options);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to create account. Please try again." },
      { status: 500 }
    );
  }
}
