import { test, expect } from '@playwright/test';
import { uniqueUsername, registerUser } from './helpers.js';

test.describe('User Login', () => {
  test('successful login returns token and user', async ({ request }) => {
    const username = uniqueUsername('login');
    const password = 'loginpass123';

    // Register first
    const regRes = await request.post('/api/multi/register', {
      data: { username, password },
    });
    expect(regRes.status()).toBe(201);

    // Login
    const res = await request.post('/api/multi/login', {
      data: { username, password },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.token).toBeTruthy();
    expect(data.user).toBeTruthy();
    expect(data.user.username).toBe(username);
  });

  test('wrong password returns 401', async ({ request }) => {
    const username = uniqueUsername('wrongpw');
    const password = 'correctpass123';

    // Register first
    const regRes = await request.post('/api/multi/register', {
      data: { username, password },
    });
    expect(regRes.status()).toBe(201);

    // Login with wrong password
    const res = await request.post('/api/multi/login', {
      data: { username, password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid');
  });

  test('non-existent user returns 401', async ({ request }) => {
    const res = await request.post('/api/multi/login', {
      data: { username: 'nonexistent_user_12345', password: 'somepass123' },
    });
    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid');
  });

  test('missing credentials returns 400', async ({ request }) => {
    const res = await request.post('/api/multi/login', {
      data: { username: 'testuser', password: '' },
    });
    // Empty password should be caught by the validation
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});
