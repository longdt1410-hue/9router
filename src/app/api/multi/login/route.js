import { NextResponse } from "next/server";
import { isMultiUserMode } from "@/lib/multiUser/middleware";
import { validateUserPassword } from "@/lib/multiUser/userDb";
import { createUserToken } from "@/lib/multiUser/userSession";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRate(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true };
  if (now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.firstAttempt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

function recordLoginAttempt(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

function getClientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
}

export async function POST(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rateCheck = checkLoginRate(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${rateCheck.retryAfter}s` },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const user = await validateUserPassword(username, password);
    if (!user) {
      recordLoginAttempt(ip);
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
    }

    const token = await createUserToken(user);
    return NextResponse.json({ user, token });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
