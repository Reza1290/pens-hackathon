import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { env, projectRoot } from '../apps/api/src/config/env.js';
import * as s from '../apps/api/src/db/schema/index.js';
import { createApp } from '../apps/api/src/app.js';
import { sessionSchema, userSchema } from '@kasirnusa/contracts';

const adminUrl = new URL(env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(adminUrl.hostname)) throw new Error('DB tests require local PostgreSQL');
const name = `kasirnusa_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: adminUrl.href });
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: testUrl.href });
const db = drizzle(pool, { schema: s });
let created = false;

beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await migrate(db, { migrationsFolder: resolve(projectRoot, 'apps/api/src/db/migrations') });
});

afterAll(async () => {
  await pool.end();
  if (created && /^kasirnusa_test_[a-f0-9]{32}$/.test(name)) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
});

describe('authentication & session management API', () => {
  it('registers a user, prevents duplicates, and validates schemas', async () => {
    const app = createApp(db, new Set());

    // Successful registration
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'budi.santoso@kasirnusa.id',
        password: 'SecurePassword123!',
        name: 'Budi Santoso',
        role: 'account_manager',
        employee_external_id: 'E05',
      });

    expect(res.status).toBe(201);
    const session = sessionSchema.parse(res.body);
    expect(session.user.email).toBe('budi.santoso@kasirnusa.id');
    expect(session.user.name).toBe('Budi Santoso');
    expect(session.user.role).toBe('account_manager');
    expect(session.user.employee_external_id).toBe('E05');
    expect(session.token).toBeTruthy();

    // Verify password is encrypted in database, not stored plaintext
    const [dbUser] = await db.select().from(s.users).where(eq(s.users.id, session.user.id));
    expect(dbUser.passwordHash).not.toContain('SecurePassword123!');
    expect(dbUser.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);

    // Duplicate email rejected with 409
    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'budi.santoso@kasirnusa.id',
        password: 'AnotherPassword456!',
        name: 'Budi Duplicate',
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error).toBe('Email already registered');

    // Invalid email rejected with 400
    const invalidEmailRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password: 'ValidPassword123!',
        name: 'Invalid Test',
      });
    expect(invalidEmailRes.status).toBe(400);

    // Too short password rejected with 400
    const shortPassRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'valid@kasirnusa.id',
        password: 'short',
        name: 'Short Pass',
      });
    expect(shortPassRes.status).toBe(400);
  });

  it('authenticates user on login and verifies/revokes sessions', async () => {
    const app = createApp(db, new Set());

    // Wrong password returns 401
    const badPass = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'budi.santoso@kasirnusa.id',
        password: 'WrongPassword!',
      });
    expect(badPass.status).toBe(401);
    expect(badPass.body.error).toBe('Invalid email or password');

    // Non-existent user returns 401
    const notFound = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'unknown@kasirnusa.id',
        password: 'Password123!',
      });
    expect(notFound.status).toBe(401);

    // Successful login returns session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'budi.santoso@kasirnusa.id',
        password: 'SecurePassword123!',
      });
    expect(loginRes.status).toBe(200);
    const loginSession = sessionSchema.parse(loginRes.body);
    expect(loginSession.user.email).toBe('budi.santoso@kasirnusa.id');

    // Access /api/auth/me without token -> 401
    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toBe('Authentication token required');

    // Access /api/auth/me with invalid token -> 401
    const invalidToken = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-12345');
    expect(invalidToken.status).toBe(401);
    expect(invalidToken.body.error).toBe('Invalid or expired session');

    // Access /api/auth/me with valid bearer token -> 200
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginSession.token}`);
    expect(meRes.status).toBe(200);
    const meUser = userSchema.parse(meRes.body.user);
    expect(meUser.email).toBe('budi.santoso@kasirnusa.id');
    expect(meUser.name).toBe('Budi Santoso');

    // Logout revokes session
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${loginSession.token}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Subsequent call with revoked token -> 401
    const revokedRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginSession.token}`);
    expect(revokedRes.status).toBe(401);
    expect(revokedRes.body.error).toBe('Invalid or expired session');
  });

  it('seeds default users idempotently and allows login with seeded account', async () => {
    const app = createApp(db, new Set());

    // First seed creates default accounts
    const seedRes1 = await request(app).post('/api/auth/seed');
    expect(seedRes1.status).toBe(200);
    expect(seedRes1.body.created).toBe(4); // admin, wahyu, andi, sari

    // Second seed is idempotent
    const seedRes2 = await request(app).post('/api/auth/seed');
    expect(seedRes2.status).toBe(200);
    expect(seedRes2.body.created).toBe(0);
    expect(seedRes2.body.existing).toBe(4);

    // Login with seeded admin account
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@kasirnusa.id',
        password: 'PasswordKasirNusa2026!',
      });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.body.user.role).toBe('admin');
    expect(adminLogin.body.user.name).toBe('Administrator');

    // Login with seeded account manager (Wahyu E04)
    const wahyuLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wahyu@kasirnusa.id',
        password: 'PasswordKasirNusa2026!',
      });
    expect(wahyuLogin.status).toBe(200);
    expect(wahyuLogin.body.user.role).toBe('account_manager');
    expect(wahyuLogin.body.user.employee_external_id).toBe('E04');
  });
});
