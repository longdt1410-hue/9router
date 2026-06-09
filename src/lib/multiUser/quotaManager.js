import { getAdapter } from "../db/driver.js";
import { parseJson } from "../db/helpers/jsonCol.js";

export function getDefaultQuota() {
  if (process.env.MULTI_USER_DEFAULT_QUOTA) {
    try {
      return JSON.parse(process.env.MULTI_USER_DEFAULT_QUOTA);
    } catch {
      // Fall through to default
    }
  }
  return { dailyRequests: 1000, dailyTokens: 10000000 };
}

export async function getUserUsageToday(userId) {
  const db = await getAdapter();

  // Get all API key IDs belonging to this user
  const keyRows = db.all(`SELECT apiKeyId FROM userApiKeys WHERE userId = ?`, [userId]);
  if (!keyRows || keyRows.length === 0) {
    return { requests: 0, tokens: 0 };
  }

  const keyIds = keyRows.map((r) => r.apiKeyId);

  // Get the actual key strings for these IDs
  const placeholders = keyIds.map(() => "?").join(",");
  const apiKeyRows = db.all(`SELECT key FROM apiKeys WHERE id IN (${placeholders})`, keyIds);
  if (!apiKeyRows || apiKeyRows.length === 0) {
    return { requests: 0, tokens: 0 };
  }

  const apiKeys = apiKeyRows.map((r) => r.key);

  // Query usageHistory for today
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const keyPlaceholders = apiKeys.map(() => "?").join(",");
  const row = db.get(
    `SELECT COUNT(*) as requests, COALESCE(SUM(promptTokens + completionTokens), 0) as tokens
     FROM usageHistory
     WHERE apiKey IN (${keyPlaceholders}) AND timestamp >= ?`,
    [...apiKeys, todayStr]
  );

  return {
    requests: row?.requests || 0,
    tokens: row?.tokens || 0,
  };
}

export async function checkQuota(userId) {
  const db = await getAdapter();

  // Get user's custom quota or use default
  const userRow = db.get(`SELECT quota FROM users WHERE id = ?`, [userId]);
  const userQuota = parseJson(userRow?.quota, null) || getDefaultQuota();

  const usage = await getUserUsageToday(userId);

  const allowed =
    usage.requests < userQuota.dailyRequests &&
    usage.tokens < userQuota.dailyTokens;

  return {
    allowed,
    remaining: {
      dailyRequests: Math.max(0, userQuota.dailyRequests - usage.requests),
      dailyTokens: Math.max(0, userQuota.dailyTokens - usage.tokens),
    },
    used: {
      dailyRequests: usage.requests,
      dailyTokens: usage.tokens,
    },
    limit: userQuota,
  };
}
