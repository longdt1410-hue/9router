import { NextResponse } from "next/server";
import { getUserFromRequest } from "./userSession.js";
import { getUserById } from "./userDb.js";

export function isMultiUserMode() {
  return process.env.MULTI_USER_MODE === "true";
}

export async function requireUserAuth(request) {
  const payload = await getUserFromRequest(request);
  if (!payload) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await getUserById(payload.userId);
  if (!user || !user.isActive) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user };
}

export async function requireAdminAuth(request) {
  const result = await requireUserAuth(request);
  if (result.error) return result;

  if (result.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return result;
}
