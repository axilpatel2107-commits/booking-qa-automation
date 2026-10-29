import { test as setup, expect } from '../../fixtures';
import { DEMO_USER } from '../../utils/test-data';

const authFile = '.auth/user.json';

// Sign in once through the real login form and reuse the session in every UI test.
setup('sign in as demo user', async ({ page, loginPage, bookingPage }) => {
  await loginPage.goto();
  await loginPage.login(DEMO_USER.email, DEMO_USER.password);
  await expect(bookingPage.heading).toBeVisible();
  await page.context().storageState({ path: authFile });
});
