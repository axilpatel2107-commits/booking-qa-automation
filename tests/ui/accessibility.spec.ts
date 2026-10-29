import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures';

// Automated checks catch roughly a third of accessibility issues.
// They are a safety net, not a replacement for keyboard and screen-reader testing.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function seriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

test.describe('Accessibility (WCAG 2.1 AA) @a11y', () => {
  test('login page has no serious violations', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await context.close();
  });

  test('booking page has no serious violations', async ({ page, bookingPage }) => {
    await bookingPage.goto();
    await expect(bookingPage.times.getByRole('button').first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('booking form can be completed with the keyboard only', async ({ page, bookingPage }) => {
    await bookingPage.goto();
    await expect(bookingPage.times.getByRole('button').first()).toBeVisible();
    await bookingPage.licenceClass.focus();
    // Tab should move from the licence class straight to the first free time slot,
    // skipping booked (disabled) ones.
    await page.keyboard.press('Tab');
    const firstFree = bookingPage.times.getByRole('button').and(page.locator(':enabled')).first();
    await expect(firstFree).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(firstFree).toHaveAttribute('aria-pressed', 'true');
  });
});
