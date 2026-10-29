import { test, expect } from '../../fixtures';
import { DEMO_USER } from '../../utils/test-data';

test.describe('Sign in', () => {
  // These tests start logged out.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('valid credentials open the booking page @smoke @mobile', async ({ loginPage, bookingPage }) => {
    await loginPage.login(DEMO_USER.email, DEMO_USER.password);
    await expect(bookingPage.heading).toBeVisible();
    await expect(loginPage.heading).toBeHidden();
  });

  test('email is not case sensitive', async ({ loginPage, bookingPage }) => {
    await loginPage.login(DEMO_USER.email.toUpperCase(), DEMO_USER.password);
    await expect(bookingPage.heading).toBeVisible();
  });

  test('wrong password shows a generic error', async ({ loginPage }) => {
    await loginPage.login(DEMO_USER.email, 'not-the-password');
    // Same message for wrong email or wrong password, so accounts can't be enumerated.
    await expect(loginPage.error).toHaveText('Invalid email or password');
    await expect(loginPage.heading).toBeVisible();
  });

  const missingFields = [
    { case: 'empty email', email: '', password: 'Demo123!' },
    { case: 'empty password', email: 'demo@slotbook.test', password: '' },
    { case: 'both empty', email: '', password: '' },
  ];
  for (const { case: name, email, password } of missingFields) {
    test(`${name} is rejected before calling the API`, async ({ page, loginPage }) => {
      let loginCalled = false;
      page.on('request', (r) => r.url().includes('/api/auth/login') && (loginCalled = true));
      await loginPage.login(email, password);
      await expect(loginPage.error).toHaveText('Email and password are required');
      expect(loginCalled).toBe(false);
    });
  }
});

test('sign out returns to the login screen and clears the session @mobile', async ({ page, loginPage }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(loginPage.heading).toBeVisible();
  await page.reload();
  await expect(loginPage.heading).toBeVisible();
});
