import { test, expect } from '@playwright/test';
import { registerUser, authHeaders, promoteToAdmin } from './helpers.js';

test.describe('Quota Integration - /v1/chat/completions', () => {
  test('user with zero dailyRequests quota gets 429 on chat endpoint', async ({ request }) => {
    // Register a user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Create an API key for the user
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(userReg.data.token),
      data: { name: 'Quota Test Key' },
    });
    expect(keyRes.status()).toBe(201);
    const keyData = await keyRes.json();
    const apiKey = keyData.key.key; // Full key value

    // Register admin and set quota to 0
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    const quotaRes = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminReg.data.token),
      data: { id: userId, quota: { dailyRequests: 0, dailyTokens: 0 } },
    });
    expect(quotaRes.status()).toBe(200);

    // Now make a request to /v1/chat/completions with this API key
    const chatRes = await request.post('/v1/chat/completions', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    // Should return 429 because quota is exceeded (0 daily requests allowed)
    expect(chatRes.status()).toBe(429);
    const chatData = await chatRes.json();
    expect(chatData.error).toBeDefined();
  });

  test('user with sufficient quota does not get 429 on chat endpoint', async ({ request }) => {
    // Register a user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Create an API key for the user
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(userReg.data.token),
      data: { name: 'Quota OK Key' },
    });
    expect(keyRes.status()).toBe(201);
    const keyData = await keyRes.json();
    const apiKey = keyData.key.key;

    // Register admin and set a generous quota
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    const quotaRes = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminReg.data.token),
      data: { id: userId, quota: { dailyRequests: 1000, dailyTokens: 10000000 } },
    });
    expect(quotaRes.status()).toBe(200);

    // Make a request to /v1/chat/completions
    const chatRes = await request.post('/v1/chat/completions', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    // Should NOT get 429 - might get another error (no provider configured)
    // but it should pass the quota check
    expect(chatRes.status()).not.toBe(429);
  });

  test('profile quota shows allowed=false when quota is 0', async ({ request }) => {
    // Register a user
    const userReg = await registerUser(request);
    expect(userReg.response.status()).toBe(201);
    const userId = userReg.data.user.id;

    // Register admin and set quota to 0
    const adminReg = await registerUser(request);
    expect(adminReg.response.status()).toBe(201);
    await promoteToAdmin(adminReg.data.user.id);

    const quotaRes = await request.patch('/api/multi/admin/users', {
      headers: authHeaders(adminReg.data.token),
      data: { id: userId, quota: { dailyRequests: 0, dailyTokens: 0 } },
    });
    expect(quotaRes.status()).toBe(200);

    // Check profile to verify quota is reflected
    const profileRes = await request.get('/api/multi/profile', {
      headers: authHeaders(userReg.data.token),
    });
    expect(profileRes.status()).toBe(200);
    const profileData = await profileRes.json();
    expect(profileData.quota.allowed).toBe(false);
    expect(profileData.quota.limit.dailyRequests).toBe(0);
    expect(profileData.quota.limit.dailyTokens).toBe(0);
  });
});
