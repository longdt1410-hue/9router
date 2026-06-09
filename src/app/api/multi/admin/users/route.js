import { NextResponse } from "next/server";
import { isMultiUserMode, requireAdminAuth } from "@/lib/multiUser/middleware";
import { listUsers, updateUser, deleteUser } from "@/lib/multiUser/userDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin list users error:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const allowedFields = {};
    if (data.role !== undefined) allowedFields.role = data.role;
    if (data.isActive !== undefined) allowedFields.isActive = data.isActive;
    if (data.quota !== undefined) allowedFields.quota = data.quota;

    const user = await updateUser(id, allowedFields);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
