/**
 * Shared helpers for multi-user e2e tests.
 */

let userCounter = 0;

export function uniqueUsername(prefix = 'testuser') {
  userCounter++;
  return `${prefix}_${Date.now()}_${userCounter}`;
}

/**
 * Register a new user and return { token, user }
 */
export async function registerUser(request, { username, password, email } = {}) {
  const uname = username || uniqueUsername();
  const pass = password || 'testpass123';
  const body = { username: uname, password: pass };
  if (email) body.email = email;

  const res = await request.post('/api/multi/register', { data: body });
  const data = await res.json();
  return { response: res, data, username: uname, password: pass };
}

/**
 * Login and return { token, user }
 */
export async function loginUser(request, { username, password }) {
  const res = await request.post('/api/multi/login', {
    data: { username, password },
  });
  const data = await res.json();
  return { response: res, data };
}

/**
 * Get auth headers for a token
 */
export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Promote a user to admin by updating the SQLite DB directly.
 * This uses better-sqlite3 to manipulate the test database (same as the server).
 */
export async function promoteToAdmin(userId) {
  const fs = await import('fs');
  const Database = (await import('better-sqlite3')).default;
  
  const dbPath = '/tmp/9router-test-data/db/data.sqlite';
  
  // Wait for the DB file to be created by the server
  let attempts = 0;
  while (!fs.default.existsSync(dbPath) && attempts < 20) {
    await new Promise(r => setTimeout(r, 200));
    attempts++;
  }
  
  if (!fs.default.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath} after waiting`);
  }
  
  // Wait a bit more for any pending writes
  await new Promise(r => setTimeout(r, 100));
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(userId);
  db.close();
}
