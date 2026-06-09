import { test, expect } from '@playwright/test';
import { registerUser, loginUser, authHeaders, promoteToAdmin } from './helpers.js';

test.describe('Security - Deactivated User', () => {
  test('deactivated user cannot login', async ({ request }) => {
    // Register a user
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    const userId = reg.data.user.id;

    // Promote another user to admin and deactivate this one
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    // Admin deactivates the user
    const deactivateRes = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminReg.data.token),
      data: { id: userId, isActive: false },
    });
    expect(deactivateRes.status()).toBe(200);

    // Deactivated user tries to login - should get 403
    const loginRes = await request.post('/api/multi/login', {
      data: { username: reg.username, password: reg.password },
    });
    expect(loginRes.status()).toBe(403);
    const loginData = await loginRes.json();
    expect(loginData.error).toContain('disabled');
  });

  test('deactivated user token returns 401 on API call', async ({ request }) => {
    // Register a user and get their token
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    const userToken = reg.data.token;
    const userId = reg.data.user.id;

    // Promote another user to admin
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    // Admin deactivates the user
    const deactivateRes = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminReg.data.token),
      data: { id: userId, isActive: false },
    });
    expect(deactivateRes.status()).toBe(200);

    // Deactivated user tries to access profile with their old token
    const profileRes = await request.get('/api/multi/profile', {
      headers: authHeaders(userToken),
    });
    expect(profileRes.status()).toBe(401);
  });

  test('deactivated user token returns 401 on keys endpoint', async ({ request }) => {
    // Register a user and get their token
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    const userToken = reg.data.token;
    const userId = reg.data.user.id;

    // Promote another user to admin
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    // Admin deactivates the user
    await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminReg.data.token),
      data: { id: userId, isActive: false },
    });

    // Deactivated user tries to list keys
    const keysRes = await request.get('/api/multi/keys', {
      headers: authHeaders(userToken),
    });
    expect(keysRes.status()).toBe(401);
  });
});

test.describe('Security - Key Isolation', () => {
  test('user cannot see keys of another user', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request);
    expect(userA.response.status()).toBe(201);
    const userB = await registerUser(request);
    expect(userB.response.status()).toBe(201);

    // User A creates a key
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(userA.data.token),
      data: { name: 'UserA Key' },
    });
    expect(keyRes.status()).toBe(201);

    // User B lists their keys - should not see User A's key
    const listRes = await request.get('/api/multi/keys', {
      headers: authHeaders(userB.data.token),
    });
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    const hasUserAKey = listData.keys.some((k) => k.name === 'UserA Key');
    expect(hasUserAKey).toBe(false);
  });

  test('user cannot delete key of another user', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request);
    expect(userA.response.status()).toBe(201);
    const userB = await registerUser(request);
    expect(userB.response.status()).toBe(201);

    // User A creates a key
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(userA.data.token),
      data: { name: 'UserA Private Key' },
    });
    expect(keyRes.status()).toBe(201);
    const keyId = (await keyRes.json()).key.id;

    // User B tries to delete User A's key
    const deleteRes = await request.delete(`/api/multi/keys?id=${keyId}`, {
      headers: authHeaders(userB.data.token),
    });
    expect(deleteRes.status()).toBe(404);

    // Verify User A's key still exists
    const listRes = await request.get('/api/multi/keys', {
      headers: authHeaders(userA.data.token),
    });
    const listData = await listRes.json();
    expect(listData.keys.some((k) => k.id === keyId)).toBe(true);
  });
});

test.describe('Security - Delete User Cascades Key Deactivation', () => {
  test('deleting a user deactivates their API keys in database', async ({ request }) => {
    // Register a user and create a key
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Create a key for this user
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(userReg.data.token),
      data: { name: 'Cascade Test Key' },
    });
    expect(keyRes.status()).toBe(201);
    const keyData = await keyRes.json();
    const keyId = keyData.key.id;

    // Register admin
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    // Admin deletes the user
    const deleteRes = await request.delete(`/api/multi/admin/users?id=${userId}`, {
      headers: authHeaders(adminReg.data.token),
    });
    expect(deleteRes.status()).toBe(200);

    // Verify the key is deactivated by checking the database directly
    const Database = (await import('better-sqlite3')).default;
    const dbPath = '/tmp/9router-test-data/db/data.sqlite';
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT isActive FROM apiKeys WHERE id = ?').get(keyId);
    db.close();

    // The key should be deactivated (isActive = 0) after user deletion
    expect(row).toBeTruthy();
    expect(row.isActive).toBe(0);
  });

  test('deleted user keys are no longer linked in userApiKeys', async ({ request }) => {
    // Register a user and create a key
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Create a key for this user
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(userReg.data.token),
      data: { name: 'Cascade Link Key' },
    });
    expect(keyRes.status()).toBe(201);
    const keyData = await keyRes.json();
    const keyId = keyData.key.id;

    // Register admin
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    // Admin deletes the user
    const deleteRes = await request.delete(`/api/multi/admin/users?id=${userId}`, {
      headers: authHeaders(adminReg.data.token),
    });
    expect(deleteRes.status()).toBe(200);

    // Verify userApiKeys link is removed and key is deactivated
    const Database = (await import('better-sqlite3')).default;
    const dbPath = '/tmp/9router-test-data/db/data.sqlite';
    const db = new Database(dbPath, { readonly: true });

    const link = db.prepare('SELECT * FROM userApiKeys WHERE userId = ?').get(userId);
    expect(link).toBeUndefined();

    const keyRow = db.prepare('SELECT isActive FROM apiKeys WHERE id = ?').get(keyId);
    expect(keyRow).toBeTruthy();
    expect(keyRow.isActive).toBe(0);

    db.close();
  });
});

test.describe('Security - Token Validation', () => {
  test('malformed JWT token returns 401', async ({ request }) => {
    const res = await request.get('/api/multi/profile', {
      headers: { Authorization: 'Bearer not.a.valid.jwt.token' },
    });
    expect(res.status()).toBe(401);
  });

  test('completely random string as token returns 401', async ({ request }) => {
    const res = await request.get('/api/multi/profile', {
      headers: { Authorization: 'Bearer abc123randomstring' },
    });
    expect(res.status()).toBe(401);
  });

  test('empty bearer token returns 401', async ({ request }) => {
    const res = await request.get('/api/multi/profile', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status()).toBe(401);
  });

  test('missing Authorization header returns 401', async ({ request }) => {
    const res = await request.get('/api/multi/profile');
    expect(res.status()).toBe(401);
  });
});
