import { Locator, Page, expect } from '@playwright/test';

export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    const section = page.locator('#view-login');
    this.heading = page.getByRole('heading', { name: 'Sign in' });
    this.email = section.getByLabel('Email');
    this.password = section.getByLabel('Password');
    this.submit = section.getByRole('button', { name: 'Sign in' });
    this.error = section.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
