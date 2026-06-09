import { NextResponse } from "next/server";
import { isMultiUserMode, requireUserAuth } from "@/lib/multiUser/middleware";
import { getAdapter } from "@/lib/db/driver";
import { checkQuota } from "@/lib/multiUser/quotaManager";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isMultiUserMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUserAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "24h";

    const db = await getAdapter();

    // Get user's API keys
    const links = db.all(`SELECT apiKeyId FROM userApiKeys WHERE userId = ?`, [auth.user.id]);
    if (!links || links.length === 0) {
      const quota = await checkQuota(auth.user.id);
      return NextResponse.json({ usage: [], quota, totalRequests: 0, totalTokens: 0 });
    }

    const keyIds = links.map((l) => l.apiKeyId);
    const placeholders = keyIds.map(() => "?").join(",");
    const keyRows = db.all(`SELECT key FROM apiKeys WHERE id IN (${placeholders})`, keyIds);
    const apiKeys = keyRows.map((r) => r.key);

    // Calculate time range
    let since;
    const now = new Date();
    if (period === "7d") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "30d") {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const keyPlaceholders = apiKeys.map(() => "?").join(",");
    const usage = db.all(
      `SELECT timestamp, provider, model, promptTokens, completionTokens, status
       FROM usageHistory
       WHERE apiKey IN (${keyPlaceholders}) AND timestamp >= ?
       ORDER BY timestamp DESC
       LIMIT 500`,
      [...apiKeys, since.toISOString()]
    );

    // Get totals
    const totals = db.get(
      `SELECT COUNT(*) as totalRequests, COALESCE(SUM(promptTokens + completionTokens), 0) as totalTokens
       FROM usageHistory
       WHERE apiKey IN (${keyPlaceholders}) AND timestamp >= ?`,
      [...apiKeys, since.toISOString()]
    );

    const quota = await checkQuota(auth.user.id);

    return NextResponse.json({
      usage: usage || [],
      quota,
      totalRequests: totals?.totalRequests || 0,
      totalTokens: totals?.totalTokens || 0,
      period,
    });
  } catch (error) {
    console.error("Usage fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
