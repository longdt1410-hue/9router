import { test, expect } from '@playwright/test';
import { uniqueUsername, registerUser, authHeaders } from './helpers.js';

test.describe('API Key Management', () => {
  let token;
  let username;

  test.beforeEach(async ({ request }) => {
    const reg = await registerUser(request);
    expect(reg.response.status()).toBe(201);
    token = reg.data.token;
    username = reg.username;
  });

  test('create API key returns 201 with key data', async ({ request }) => {
    const res = await request.post('/api/multi/keys', {
      headers: authHeaders(token),
      data: { name: 'Test Key' },
    });

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.key).toBeTruthy();
    expect(data.key.id).toBeTruthy();
    expect(data.key.key).toMatch(/^9r-mu-/);
    expect(data.key.name).toBe('Test Key');
    expect(data.key.isActive).toBe(true);
  });

  test('list keys returns created keys', async ({ request }) => {
    // Create a key first
    const createRes = await request.post('/api/multi/keys', {
      headers: authHeaders(token),
      data: { name: 'List Test Key' },
    });
    expect(createRes.status()).toBe(201);

    // List keys
    const res = await request.get('/api/multi/keys', {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.keys).toBeInstanceOf(Array);
    expect(data.keys.length).toBeGreaterThanOrEqual(1);
    expect(data.keys.some(k => k.name === 'List Test Key')).toBe(true);
  });

  test('delete key removes it from list', async ({ request }) => {
    // Create a key
    const createRes = await request.post('/api/multi/keys', {
      headers: authHeaders(token),
      data: { name: 'Delete Me' },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const keyId = created.key.id;

    // Delete the key
    const deleteRes = await request.delete(`/api/multi/keys?id=${keyId}`, {
      headers: authHeaders(token),
    });
    expect(deleteRes.status()).toBe(200);

    // Verify key is gone
    const listRes = await request.get('/api/multi/keys', {
      headers: authHeaders(token),
    });
    const listData = await listRes.json();
    expect(listData.keys.some(k => k.id === keyId)).toBe(false);
  });

  test('unauthorized access returns 401', async ({ request }) => {
    const res = await request.get('/api/multi/keys', {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(res.status()).toBe(401);
  });

  test('create key without name returns 400', async ({ request }) => {
    const res = await request.post('/api/multi/keys', {
      headers: authHeaders(token),
      data: {},
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Name is required');
  });

  test('maximum keys limit is enforced', async ({ request }) => {
    // Create 5 keys (the max)
    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/multi/keys', {
        headers: authHeaders(token),
        data: { name: `Key ${i + 1}` },
      });
      expect(res.status()).toBe(201);
    }

    // Try to create a 6th key
    const res = await request.post('/api/multi/keys', {
      headers: authHeaders(token),
      data: { name: 'Key 6 - Should Fail' },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Maximum');
  });
});
