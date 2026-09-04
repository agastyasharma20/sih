import { test, expect, type Page } from '@playwright/test';

/** Fails the test if the page logged an error or threw while loading. */
function watchForErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  return problems;
}

const PUBLIC_PAGES = ['/', '/login', '/problem-statements', '/results'] as const;

test.describe('public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} loads without errors`, async ({ page }) => {
      const problems = watchForErrors(page);
      const response = await page.goto(path);

      expect(response?.status(), `${path} should return 200`).toBe(200);
      await expect(page.locator('body')).toBeVisible();

      // Supabase is unreachable in some environments; that is a warning,
      // not a page defect, so only genuine script failures fail here.
      const real = problems.filter(
        (p) => !/supabase|fetch failed|Failed to load resource/i.test(p),
      );
      expect(real, `${path} logged errors`).toEqual([]);
    });

    test(`${path} has exactly one h1`, async ({ page }) => {
      await page.goto(path);
      const count = await page.locator('h1').count();
      expect(count, `${path} should have one h1 for screen readers`).toBe(1);
    });

    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(400);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // A couple of pixels is sub-pixel rounding; a real overflow is worse.
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('landing page', () => {
  test('shows the event, the stages and the leadership', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Hackathon/i);
    await expect(page.getByText('How the round works')).toBeVisible();
    await expect(page.getByText('PIEMR Leadership for SIH')).toBeVisible();
  });

  test('credits the developer with working contact links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toContainText('Agastya Sharma');
    await expect(footer.getByRole('link', { name: /work\.agastya20@gmail\.com/ })).toHaveAttribute(
      'href',
      'mailto:work.agastya20@gmail.com',
    );
    await expect(footer.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/agastya20',
    );
  });

  test('every external link opens safely', async ({ page }) => {
    await page.goto('/');

    const external = page.locator('a[target="_blank"]');
    const count = await external.count();

    for (let i = 0; i < count; i += 1) {
      // Without noreferrer/noopener a new tab can reach back into this one.
      await expect(external.nth(i)).toHaveAttribute('rel', /noreferrer|noopener/);
    }
  });
});

test.describe('navigation', () => {
  test('reaches the problem statements and results pages', async ({ page, isMobile }) => {
    test.skip(isMobile, 'those header links are hidden on small screens by design');

    await page.goto('/');
    await page.getByRole('link', { name: 'Problem statements' }).first().click();
    await expect(page).toHaveURL(/problem-statements/);

    await page.goto('/');
    await page.getByRole('link', { name: 'Results' }).first().click();
    await expect(page).toHaveURL(/results/);
  });

  test('sign in leads to the login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
  });
});
