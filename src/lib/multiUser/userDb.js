import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getAdapter } from "../db/driver.js";
import { parseJson, stringifyJson } from "../db/helpers/jsonCol.js";

const SALT_ROUNDS = 12;

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    displayName: row.displayName || null,
    role: row.role || "user",
    quota: parseJson(row.quota, null),
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createUser(username, email, password) {
  const db = await getAdapter();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date().toISOString();
  const user = {
    id: uuidv4(),
    username,
    email: email || null,
    passwordHash,
    displayName: null,
    role: "user",
    quota: null,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO users(id, username, email, passwordHash, displayName, role, quota, isActive, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.email, user.passwordHash, user.displayName, user.role, user.quota, user.isActive, user.createdAt, user.updatedAt]
  );
  return rowToUser(user);
}

export async function getUserByUsername(username) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE username = ?`, [username]);
  return rowToUser(row);
}

export async function getUserByEmail(email) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE email = ?`, [email]);
  return rowToUser(row);
}

export async function getUserById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  return rowToUser(row);
}

export async function updateUser(id, data) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!row) return null;

  const updates = {};
  if (data.displayName !== undefined) updates.displayName = data.displayName;
  if (data.email !== undefined) updates.email = data.email;
  if (data.role !== undefined) updates.role = data.role;
  if (data.quota !== undefined) updates.quota = stringifyJson(data.quota);
  if (data.isActive !== undefined) updates.isActive = data.isActive ? 1 : 0;
  if (data.password) updates.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const keys = Object.keys(updates);
  if (keys.length === 0) return rowToUser(row);

  const now = new Date().toISOString();
  const setClauses = [...keys.map((k) => `${k} = ?`), "updatedAt = ?"];
  const values = [...keys.map((k) => updates[k]), now, id];

  db.run(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`, values);
  const updated = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  return rowToUser(updated);
}

export async function deleteUser(id) {
  const db = await getAdapter();
  // Deactivate API keys linked to this user before removing links
  const links = db.all(`SELECT apiKeyId FROM userApiKeys WHERE userId = ?`, [id]);
  if (links && links.length > 0) {
    const ids = links.map((l) => l.apiKeyId);
    const placeholders = ids.map(() => "?").join(",");
    db.run(`UPDATE apiKeys SET isActive = 0 WHERE id IN (${placeholders})`, ids);
  }
  const res = db.run(`DELETE FROM users WHERE id = ?`, [id]);
  db.run(`DELETE FROM userApiKeys WHERE userId = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function listUsers() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM users ORDER BY createdAt ASC`);
  return rows.map(rowToUser);
}

export async function validateUserPassword(username, password) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE username = ?`, [username]);
  if (!row) return null;
  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) return null;
  return rowToUser(row);
}
