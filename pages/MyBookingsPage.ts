import { Locator, Page, expect } from '@playwright/test';

export class MyBookingsPage {
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly table: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'My bookings' });
    this.emptyState = page.getByText('You have no upcoming bookings.');
    this.table = page.getByRole('table');
  }

  async open() {
    await this.page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'My bookings' }).click();
    await expect(this.heading).toBeVisible();
  }

  row(reference: string) {
    return this.table.getByRole('row').filter({ hasText: reference });
  }

  /** Clicks Cancel and answers the browser confirm dialog. */
  async cancel(reference: string, { accept = true } = {}) {
    this.page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(reference);
      await (accept ? dialog.accept() : dialog.dismiss());
    });
    await this.page.getByRole('button', { name: `Cancel booking ${reference}` }).click();
  }
}
