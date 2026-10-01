import request from 'supertest';
import app from '../src/app';
import { setupTestDB } from './setup';

setupTestDB();

describe('Auth Endpoints', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Juan Dela Cruz',
    currency: 'PHP'
  };

  it('should register a new user with default categories seeded', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.name).toBe(testUser.name);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    // Check categories were auto-seeded
    const catRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${res.body.accessToken}`);

    expect(catRes.status).toBe(200);
    expect(catRes.body.categories.length).toBeGreaterThan(5);
  });

  it('should login an existing user and rotate tokens', async () => {
    // Register
    await request(app).post('/api/auth/register').send(testUser);

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');

    const oldRefresh = loginRes.body.refreshToken;

    // Refresh token rotation
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body).toHaveProperty('refreshToken');
    expect(refreshRes.body.refreshToken).not.toBe(oldRefresh);

    // Reusing old refresh token should fail
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh });

    expect(replayRes.status).toBe(401);
  });

  it('should reject invalid credentials', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});
