// Seed test for the Playwright AI agents (planner / generator / healer).
// The agents run this first to get the app into a known state: signed in
// as the demo user and sitting on the booking page. It also runs in CI
// as a quick smoke check.
import { test, expect } from '../fixtures';

test.describe('Seed', () => {
  test('signed in on the booking page @smoke', async ({ bookingPage }) => {
    await bookingPage.goto();
    await expect(bookingPage.times.getByRole('button').first()).toBeVisible();
  });
});
