import { test, expect } from '@playwright/test';

test.describe('protected routes', () => {
  const PROTECTED = [
    '/register',
    '/dashboard',
    '/dashboard/team',
    '/dashboard/admin',
    '/dashboard/admin/analytics',
    '/dashboard/admin/settings',
    '/dashboard/coordinator',
    '/dashboard/judge',
  ] as const;

  for (const path of PROTECTED) {
    test(`${path} sends a signed-out visitor to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page, `${path} must not be reachable signed out`).toHaveURL(/\/login/);
    });
  }

  test('the admin export API refuses a signed-out request', async ({ request }) => {
    const response = await request.get('/api/admin/teams/export');
    expect(response.status()).toBe(403);
  });

  test('registering a team refuses a signed-out request', async ({ request }) => {
    const response = await request.post('/api/teams/register', {
      data: { team_name: 'Hacked', members: [] },
    });
    expect([401, 422]).toContain(response.status());
  });

  test('scoring refuses a signed-out request', async ({ request }) => {
    const response = await request.post('/api/scores', { data: { submission_id: 'x' } });
    expect(response.status()).toBe(403);
  });
});

test.describe('login form', () => {
  test('offers password, sign-up and magic link without reloading', async ({ page }) => {
    await page.goto('/login');

    // Password is the default, because the free Supabase mailer cannot
    // carry a rush of magic links.
    await expect(page.getByLabel('Password')).toBeVisible();

    await page.getByRole('button', { name: /Create an account/i }).click();
    await expect(page.getByLabel('Full name')).toBeVisible();

    await page.getByRole('button', { name: /Already have an account/i }).click();
    await expect(page.getByLabel('Full name')).toBeHidden();

    await page.getByRole('button', { name: /Email me a sign-in link/i }).last().click();
    await expect(page.getByLabel('Password')).toBeHidden();
  });

  test('requires an email before submitting', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // The browser's own required-field validation should stop it.
    const invalid = await page
      .getByLabel('Email address')
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(invalid).toBe(true);
  });
});

test.describe('theme', () => {
  test('toggles, persists across a reload, and survives private mode', async ({ page }) => {
    await page.goto('/login');

    const toggle = page.getByRole('button', { name: /Switch to (dark|light) theme/ });
    await expect(toggle).toBeVisible();

    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    await toggle.click();

    const after = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(after, 'clicking the toggle should switch the theme').not.toBe(before);

    await page.reload();
    const persisted = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(persisted, 'the choice should survive a reload').toBe(after);
  });
});

test.describe('accessibility basics', () => {
  for (const path of ['/', '/login', '/problem-statements'] as const) {
    test(`${path}: every form control is labelled`, async ({ page }) => {
      await page.goto(path);

      const unlabelled = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('input, select, textarea')];
        return controls
          .filter((el) => {
            if (el.getAttribute('type') === 'hidden') return false;
            if (el.getAttribute('aria-label')) return false;
            if (el.getAttribute('aria-labelledby')) return false;
            const id = el.getAttribute('id');
            if (id && document.querySelector(`label[for="${id}"]`)) return false;
            return !el.closest('label');
          })
          .map((el) => el.outerHTML.slice(0, 80));
      });

      expect(unlabelled, `${path} has unlabelled controls`).toEqual([]);
    });

    test(`${path}: images carry alt text`, async ({ page }) => {
      await page.goto(path);
      const missing = await page.evaluate(() =>
        [...document.querySelectorAll('img')]
          .filter((img) => !img.hasAttribute('alt'))
          .map((img) => img.getAttribute('src') ?? '(no src)'),
      );
      expect(missing, `${path} has images without alt`).toEqual([]);
    });
  }
});
