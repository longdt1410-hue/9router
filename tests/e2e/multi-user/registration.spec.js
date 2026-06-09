import { test, expect } from '@playwright/test';
import { uniqueUsername, registerUser } from './helpers.js';

test.describe('User Registration', () => {
  test('successful registration returns 201 with token and user', async ({ request }) => {
    const username = uniqueUsername('reg');
    const res = await request.post('/api/multi/register', {
      data: { username, password: 'validpass123' },
    });

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.token).toBeTruthy();
    expect(data.user).toBeTruthy();
    expect(data.user.username).toBe(username);
    expect(data.user.role).toBe('user');
    expect(data.user.isActive).toBe(true);
  });

  test('duplicate username returns 409', async ({ request }) => {
    const username = uniqueUsername('dup');
    // First registration
    const res1 = await request.post('/api/multi/register', {
      data: { username, password: 'validpass123' },
    });
    expect(res1.status()).toBe(201);

    // Second registration with same username
    const res2 = await request.post('/api/multi/register', {
      data: { username, password: 'otherpass123' },
    });
    expect(res2.status()).toBe(409);
    const data = await res2.json();
    expect(data.error).toContain('already exists');
  });

  test('password too short returns 400', async ({ request }) => {
    const res = await request.post('/api/multi/register', {
      data: { username: uniqueUsername('short'), password: 'ab' },
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('6 characters');
  });

  test('invalid username returns 400', async ({ request }) => {
    // Username with special characters
    const res = await request.post('/api/multi/register', {
      data: { username: 'bad user!@#', password: 'validpass123' },
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  test('username too short returns 400', async ({ request }) => {
    const res = await request.post('/api/multi/register', {
      data: { username: 'ab', password: 'validpass123' },
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('3-30 characters');
  });

  test('registration with optional email works', async ({ request }) => {
    const username = uniqueUsername('email');
    const res = await request.post('/api/multi/register', {
      data: { username, password: 'validpass123', email: `${username}@test.com` },
    });

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe(`${username}@test.com`);
  });
});
