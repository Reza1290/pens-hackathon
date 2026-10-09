import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import type { User, Session, UserRole } from '@kasirnusa/contracts';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHash] = stored.split(':');
  if (!salt || !expectedHash) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const expectedKey = Buffer.from(expectedHash, 'hex');
  if (derivedKey.length !== expectedKey.length) return false;
  return timingSafeEqual(derivedKey, expectedKey);
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function toUserDto(row: typeof s.users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    employee_external_id: row.employeeExternalId,
    role: row.role as UserRole,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function createUser(
  db: Database,
  input: {
    email: string;
    name: string;
    password: string;
    role?: UserRole;
    employeeExternalId?: string;
  }
): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  if (existing.length > 0) throw new Error('Email already registered');

  const id = randomUUID();
  const passwordHash = hashPassword(input.password);
  const role = input.role ?? 'account_manager';

  const [created] = await db
    .insert(s.users)
    .values({
      id,
      email,
      name: input.name.trim(),
      passwordHash,
      role,
      employeeExternalId: input.employeeExternalId ?? null,
      isActive: true,
    })
    .returning();

  return toUserDto(created);
}

export async function authenticate(
  db: Database,
  email: string,
  password: string
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(s.users)
    .where(and(eq(s.users.email, normalizedEmail), eq(s.users.isActive, true)))
    .limit(1);

  if (!user) return null;
  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return toUserDto(user);
}

export async function createSession(
  db: Database,
  userId: string,
  options: { userAgent?: string; ipAddress?: string; ttlDays?: number } = {}
): Promise<Session> {
  const [user] = await db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
  if (!user || !user.isActive) throw new Error('User not found or inactive');

  const id = randomUUID();
  const token = generateToken();
  const ttl = (options.ttlDays ?? 7) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl);

  await db.insert(s.sessions).values({
    id,
    userId,
    token,
    expiresAt,
    userAgent: options.userAgent ?? null,
    ipAddress: options.ipAddress ?? null,
  });

  return {
    token,
    expires_at: expiresAt.toISOString(),
    user: toUserDto(user),
  };
}

export async function verifySession(
  db: Database,
  token: string
): Promise<{ user: User; session: typeof s.sessions.$inferSelect } | null> {
  const now = new Date();
  const [found] = await db
    .select({
      session: s.sessions,
      user: s.users,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.sessions.userId, s.users.id))
    .where(and(eq(s.sessions.token, token), gt(s.sessions.expiresAt, now), eq(s.users.isActive, true)))
    .limit(1);

  if (!found) return null;
  return {
    user: toUserDto(found.user),
    session: found.session,
  };
}

export async function revokeSession(db: Database, token: string): Promise<boolean> {
  const result = await db.delete(s.sessions).where(eq(s.sessions.token, token));
  return true;
}

export async function seedDefaultUsers(db: Database): Promise<{ created: number; existing: number }> {
  const defaultAccounts = [
    { email: 'admin@kasirnusa.id', name: 'Administrator', role: 'admin' as UserRole, password: 'PasswordKasirNusa2026!' },
    { email: 'wahyu@kasirnusa.id', name: 'Wahyu Setiawan', role: 'account_manager' as UserRole, employeeExternalId: 'E04', password: 'PasswordKasirNusa2026!' },
    { email: 'andi@kasirnusa.id', name: 'Andi Prasetyo', role: 'account_manager' as UserRole, employeeExternalId: 'E01', password: 'PasswordKasirNusa2026!' },
    { email: 'sari@kasirnusa.id', name: 'Sari Wulandari', role: 'sales_rep' as UserRole, employeeExternalId: 'E02', password: 'PasswordKasirNusa2026!' },
  ];

  let created = 0;
  let existing = 0;

  for (const acc of defaultAccounts) {
    const found = await db.select().from(s.users).where(eq(s.users.email, acc.email)).limit(1);
    if (found.length > 0) {
      existing++;
    } else {
      await createUser(db, acc);
      created++;
    }
  }

  return { created, existing };
}
