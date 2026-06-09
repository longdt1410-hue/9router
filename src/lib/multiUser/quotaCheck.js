import { getAdapter } from "../db/driver.js";
import { checkQuota } from "./quotaManager.js";

/**
 * Check quota for a given API key string.
 * Looks up the user associated with the key via userApiKeys table.
 * Returns null if the key is not associated with any user (pass through).
 * Returns { allowed, remaining, used, limit } if a user is found.
 */
export async function checkQuotaForApiKey(apiKeyStr) {
  const db = await getAdapter();

  // Find the apiKey record by key string
  const keyRow = db.get(`SELECT id FROM apiKeys WHERE key = ?`, [apiKeyStr]);
  if (!keyRow) return null;

  // Find the user who owns this key
  const link = db.get(`SELECT userId FROM userApiKeys WHERE apiKeyId = ?`, [keyRow.id]);
  if (!link) return null;

  // Check quota for this user
  return checkQuota(link.userId);
}
