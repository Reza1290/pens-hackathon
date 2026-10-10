import { test, expect } from '@playwright/test';

// Stub auth responses to exercise the browser session lifecycle without creating users.
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'review@example.com', name: 'Review User', employee_external_id: null, role: 'account_manager', is_active: true, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const session = { user, token: 'browser-test-session', expires_at: '2099-01-01T00:00:00Z' };

test('sign in handles failure, returns to a deep link, restores and signs out with POST', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/datasets', route => route.fulfill({ json: { items: [] } }));
  let attempts = 0;
  await page.route('**/api/auth/login', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ email: user.email, password: 'test-password' });
    attempts++;
    await route.fulfill(attempts === 1 ? { status: 401, json: { error: 'Invalid email or password' } } : { json: session });
  });
  await page.route('**/api/auth/me', route => {
    expect(route.request().headers().authorization).toBe('Bearer ' + session.token);
    return route.fulfill({ json: { user } });
  });
  let revoked = false;
  await page.route('**/api/auth/logout', route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers().authorization).toBe('Bearer ' + session.token);
    revoked = true;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/accounts/00000000-0000-4000-8000-000000000002?dataset_id=review');
  await expect(page.getByRole('heading', { name: 'Sign in to KasirNusa' })).toBeVisible();
  await page.getByLabel('Work email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/accounts\/.*\?dataset_id=review$/);
  await expect(page.getByRole('button', { name: 'Review User' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Review User' })).toBeVisible();
  await page.getByRole('button', { name: 'Review User' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to KasirNusa' })).toBeVisible();
  expect(revoked).toBe(true);
  expect(await page.evaluate(() => sessionStorage.getItem('kasirnusa_session_token'))).toBeNull();
  expect(errors).toEqual([]);
});

test('expired sessions return to login and external redirects are rejected', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('kasirnusa_session_token', 'expired'));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: 'Invalid or expired session' } }));
  await page.route('**/api/auth/login', route => route.fulfill({ json: session }));
  await page.route('**/api/datasets', route => route.fulfill({ json: { items: [] } }));
  await page.goto('/login?next=https://example.com');
  await page.getByLabel('Work email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
});

test('login layout is usable on desktop and mobile, with consistent radii', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to KasirNusa' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/login-desktop.png' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect(await page.locator('.login-page').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/login-mobile.png' });
  const radius = await page.getByLabel('Work email').evaluate(element => getComputedStyle(element).borderRadius);
  expect(radius).toBe('4px');
  await page.goto('/');
  expect(await page.locator('.context-example').evaluate(element => getComputedStyle(element).borderRadius)).toBe('6px');
});
