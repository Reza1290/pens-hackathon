import { test as base } from '@playwright/test';

// Existing evidence journeys exercise real account data, with browser auth stubbed.
// Login/session behavior is covered separately by login.spec.ts.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => sessionStorage.setItem('kasirnusa_session_token', 'evidence-ui-test'));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: {
      id: '00000000-0000-4000-8000-000000000001', email: 'review@example.com', name: 'UI Reviewer',
      employee_external_id: null, role: 'account_manager', is_active: true,
      created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    } } }));
    await use(page);
  },
});
