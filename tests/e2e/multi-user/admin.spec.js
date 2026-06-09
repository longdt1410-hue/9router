import { test, expect } from '@playwright/test';
import { registerUser, authHeaders, promoteToAdmin } from './helpers.js';

test.describe('Admin Endpoints', () => {
  let adminToken;
  let adminId;

  test.beforeEach(async ({ request }) => {
    // Register a user and promote to admin
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    adminToken = reg.data.token;
    adminId = reg.data.user.id;
    await promoteToAdmin(adminId);
  });

  test('admin can list users', async ({ request }) => {
    const res = await request.get('/api/multi/admin/users', {
      headers: authHeaders(adminToken),
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.users).toBeInstanceOf(Array);
    expect(data.users.length).toBeGreaterThanOrEqual(1);
    // Each user should have expected fields
    const user = data.users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('isActive');
  });

  test('admin can update user role', async ({ request }) => {
    // Register another user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Admin updates user role
    const res = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminToken),
      data: { id: userId, role: 'admin' },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.user.role).toBe('admin');
  });

  test('admin can deactivate user', async ({ request }) => {
    // Register another user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Admin deactivates user
    const res = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminToken),
      data: { id: userId, isActive: false },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.user.isActive).toBe(false);
  });

  test('admin can set user quota', async ({ request }) => {
    // Register another user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Admin sets quota
    const quota = { dailyRequests: 500, dailyTokens: 5000000 };
    const res = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminToken),
      data: { id: userId, quota },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.user.quota).toEqual(quota);
  });

  test('non-admin gets 403', async ({ request }) => {
    // Register a regular user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userToken = userReg.data.token;

    // Try to access admin endpoint
    const res = await request.get('/api/multi/admin/users', {
      headers: authHeaders(userToken),
    });
    expect(res.status()).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Forbidden');
  });

  test('admin cannot delete themselves', async ({ request }) => {
    const res = await request.delete(`/api/multi/admin/users?id=${adminId}`, {
      headers: authHeaders(adminToken),
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Cannot delete your own account');
  });

  test('admin can delete other users', async ({ request }) => {
    // Register another user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Admin deletes user
    const res = await request.delete(`/api/multi/admin/users?id=${userId}`, {
      headers: authHeaders(adminToken),
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
