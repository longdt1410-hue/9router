import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { isMultiUserMode, requireUserAuth } from "@/lib/multiUser/middleware";
import { getAdapter } from "@/lib/db/driver";

export const dynamic = "force-dynamic";

const MAX_KEYS_PER_USER = parseInt(process.env.MULTI_USER_MAX_KEYS_PER_USER || "5", 10);

export async function GET(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUserAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getAdapter();
    const links = db.all(`SELECT apiKeyId FROM userApiKeys WHERE userId = ?`, [auth.user.id]);
    if (!links || links.length === 0) {
      return NextResponse.json({ keys: [] });
    }

    const ids = links.map((l) => l.apiKeyId);
    const placeholders = ids.map(() => "?").join(",");
    const keys = db.all(`SELECT id, key, name, isActive, createdAt FROM apiKeys WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.id,
        key: k.key ? k.key.slice(0, 10) + "..." : "",
        name: k.name,
        isActive: k.isActive === 1 || k.isActive === true,
        createdAt: k.createdAt,
      })),
    });
  } catch (error) {
    console.error("Keys list error:", error);
    return NextResponse.json({ error: "Failed to list keys" }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUserAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getAdapter();

    // Check key count limit
    const countRow = db.get(`SELECT COUNT(*) as cnt FROM userApiKeys WHERE userId = ?`, [auth.user.id]);
    if (countRow && countRow.cnt >= MAX_KEYS_PER_USER) {
      return NextResponse.json({ error: `Maximum ${MAX_KEYS_PER_USER} keys per user` }, { status: 400 });
    }

    // Generate a simple API key
    const keyValue = `9r-mu-${uuidv4().replace(/-/g, "")}`;
    const keyId = uuidv4();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.run(
        `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?)`,
        [keyId, keyValue, name, null, 1, now]
      );
      db.run(
        `INSERT INTO userApiKeys(userId, apiKeyId) VALUES(?, ?)`,
        [auth.user.id, keyId]
      );
    });

    return NextResponse.json({
      key: { id: keyId, key: keyValue, name, isActive: true, createdAt: now },
    }, { status: 201 });
  } catch (error) {
    console.error("Key creation error:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUserAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    let keyId = searchParams.get("id");

    // Fallback: read key ID from request body if not in query params
    if (!keyId) {
      try {
        const body = await request.json();
        keyId = body?.id || null;
      } catch {
        // No body or invalid JSON
      }
    }

    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const db = await getAdapter();

    // Verify this key belongs to the user
    const link = db.get(`SELECT * FROM userApiKeys WHERE userId = ? AND apiKeyId = ?`, [auth.user.id, keyId]);
    if (!link) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    db.transaction(() => {
      db.run(`DELETE FROM userApiKeys WHERE userId = ? AND apiKeyId = ?`, [auth.user.id, keyId]);
      db.run(`DELETE FROM apiKeys WHERE id = ?`, [keyId]);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Key deletion error:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
