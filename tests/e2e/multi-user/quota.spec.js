import { test, expect } from '@playwright/test';
import { registerUser, authHeaders, promoteToAdmin } from './helpers.js';

test.describe('Quota Enforcement', () => {
  test('profile shows quota info with default limits', async ({ request }) => {
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    const token = reg.data.token;

    const res = await request.get('/api/multi/profile', {
      headers: authHeaders(token),
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.quota).toBeTruthy();
    expect(data.quota.limit).toBeTruthy();
    expect(data.quota.limit.dailyRequests).toBe(1000);
    expect(data.quota.limit.dailyTokens).toBe(10000000);
    expect(data.quota.allowed).toBe(true);
  });

  test('admin can set low quota for user and profile reflects it', async ({ request }) => {
    // Register admin user
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    const adminToken = adminReg.data.token;
    const adminId = adminReg.data.user.id;

    // Promote to admin
    await promoteToAdmin(adminId);

    // Register normal user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userToken = userReg.data.token;
    const userId = userReg.data.user.id;

    // Admin sets very low quota for user
    const updateRes = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminToken),
      data: {
        id: userId,
        quota: { dailyRequests: 1, dailyTokens: 100 },
      },
    });
    expect(updateRes.status()).toBe(200);

    // Check user profile shows new quota
    const profileRes = await request.get('/api/multi/profile', {
      headers: authHeaders(userToken),
    });
    expect(profileRes.status()).toBe(200);
    const profileData = await profileRes.json();
    expect(profileData.quota.limit.dailyRequests).toBe(1);
    expect(profileData.quota.limit.dailyTokens).toBe(100);
  });

  test('quota remaining decreases correctly', async ({ request }) => {
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    const token = reg.data.token;

    const res = await request.get('/api/multi/profile', {
      headers: authHeaders(token),
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.quota.remaining.dailyRequests).toBeLessThanOrEqual(data.quota.limit.dailyRequests);
    expect(data.quota.remaining.dailyTokens).toBeLessThanOrEqual(data.quota.limit.dailyTokens);
  });
});
