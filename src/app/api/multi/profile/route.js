import { NextResponse } from "next/server";
import { isMultiUserMode, requireUserAuth } from "@/lib/multiUser/middleware";
import { updateUser, getUserById } from "@/lib/multiUser/userDb";
import { checkQuota } from "@/lib/multiUser/quotaManager";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUserAuth(request);
  if (auth.error) return auth.error;

  try {
    const quota = await checkQuota(auth.user.id);
    return NextResponse.json({ user: auth.user, quota });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUserAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const allowedFields = {};

    if (body.displayName !== undefined) {
      allowedFields.displayName = body.displayName;
    }
    if (body.email !== undefined) {
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      allowedFields.email = body.email || null;
    }
    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      if (body.password.length > 72) {
        return NextResponse.json({ error: "Password must not exceed 72 characters" }, { status: 400 });
      }
      allowedFields.password = body.password;
    }

    const user = await updateUser(auth.user.id, allowedFields);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
