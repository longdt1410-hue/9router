import { NextResponse } from "next/server";
import { isMultiUserMode } from "@/lib/multiUser/middleware";
import { createUser, getUserByUsername, getUserByEmail } from "@/lib/multiUser/userDb";
import { createUserToken } from "@/lib/multiUser/userSession";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (process.env.MULTI_USER_REGISTRATION === "false") {
    return NextResponse.json({ error: "Registration is disabled" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Validate username
    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username must be alphanumeric with underscores only" }, { status: 400 });
    }

    // Validate password
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Validate email (optional)
    if (email && typeof email === "string") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      const existingEmail = await getUserByEmail(email);
      if (existingEmail) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    // Check if username exists
    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const user = await createUser(username, email || null, password);
    const token = await createUserToken(user);

    return NextResponse.json({ user, token }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
