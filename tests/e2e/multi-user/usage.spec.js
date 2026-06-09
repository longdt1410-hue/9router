import { test, expect } from '@playwright/test';
import { registerUser, authHeaders } from './helpers.js';

test.describe('Usage Endpoint', () => {
  let token;

  test.beforeEach(async ({ request }) => {
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    token = reg.data.token;

    // Create an API key for the user
    const keyRes = await request.post('/api/multi/keys', {
      headers: authHeaders(token),
      data: { name: 'Usage Test Key' },
    });
    expect(keyRes.status()).toBe(201);
  });

  test('GET /api/multi/usage returns usage data structure', async ({ request }) => {
    const res = await request.get('/api/multi/usage?period=24h', {
      headers: authHeaders(token),
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('usage');
    expect(data).toHaveProperty('quota');
    expect(data).toHaveProperty('totalRequests');
    expect(data).toHaveProperty('totalTokens');
    expect(data.usage).toBeInstanceOf(Array);
    expect(typeof data.totalRequests).toBe('number');
    expect(typeof data.totalTokens).toBe('number');
  });

  test('usage endpoint includes quota info', async ({ request }) => {
    const res = await request.get('/api/multi/usage?period=24h', {
      headers: authHeaders(token),
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.quota).toBeTruthy();
    expect(data.quota).toHaveProperty('allowed');
    expect(data.quota).toHaveProperty('remaining');
    expect(data.quota).toHaveProperty('limit');
  });

  test('usage endpoint supports different periods', async ({ request }) => {
    const periods = ['24h', '7d', '30d'];

    for (const period of periods) {
      const res = await request.get(`/api/multi/usage?period=${period}`, {
        headers: authHeaders(token),
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.period).toBe(period);
    }
  });

  test('unauthorized access returns 401', async ({ request }) => {
    const res = await request.get('/api/multi/usage?period=24h', {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(res.status()).toBe(401);
  });
});
