import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-password";
import {
  authCookie,
  createSessionToken,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth-session";
import { findUserByEmail } from "@/lib/users-store";

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

    if (!password) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        {
          error:
            "No account found for this email. Create an account first to continue.",
        },
        { status: 404 }
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    const token = await createSessionToken(normalizedEmail);
    const response = NextResponse.json({
      success: true,
      email: normalizedEmail,
    });

    response.cookies.set(authCookie.name, token, authCookie.options);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 500 }
    );
  }
}
