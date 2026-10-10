# Login and radius consistency — 10 October 2026

## Implemented

- `/login` uses an equal split: context illustration on the left and sign-in form on the right. Mobile retains the brand and gives the form the full width.
- Shared radius tokens: 4px for controls/nodes and 6px for panels. Existing dashboard Tailwind radius classes and landing/graph styles use these tokens; circles and pills retain their shapes.
- Form calls the existing login API, handles invalid credentials and temporary failures, disables duplicate submits, supports password visibility and password-manager autocomplete.
- Browser sessions use tab-scoped session storage with an in-memory fallback; passwords are never persisted. Reload verifies the session with `/auth/me`; expiry and API 401 responses return the user to login.
- Dashboard entry requires a verified browser session, preserving the requested internal destination and snapshot. External redirect destinations are rejected. Header uses the returned user. Removed the hardcoded user/persona switch and replaced placeholder logout with the actual POST endpoint.
- No registration, reset-password service, account seeding, provider/model changes or server authorization changes were added. Existing API endpoints and dataset/workspace checks remain; the browser route guard is not a substitute for server authorization.

## Validation

- Web and root TypeScript checks and web production build passed.
- Three Playwright login tests passed using stubbed auth responses: failed/successful login, deep-link return, bearer header, reload verification, logout method/token cleanup, expired session, external redirect rejection, password visibility and 1440px/390px/320px layouts.
- After adding the idle-expiry timer, TypeScript and build checks passed. The final browser rerun was declined at the command-permission prompt, so idle timer behavior has not been browser-verified.
- Screenshots: ignored `artifacts/login-desktop.png` and `artifacts/login-mobile.png`.
- Existing evidence-journey tests now use an explicit browser-auth fixture, keeping their account-data checks separate from authentication. Full historical E2E suite not rerun; live credentials were not used for the login tests.

## Review

Review `/login`, then the landing graph and dashboard panel corners. No commit or deployment was performed by this implementation session. An external process committed shared-workspace changes during the session; that history was preserved.
