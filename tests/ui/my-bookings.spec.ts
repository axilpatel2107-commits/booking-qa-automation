import { test, expect } from '../../fixtures';
import { LOCATIONS } from '../../utils/test-data';

test.describe('My bookings', () => {
  test('a new booking is listed and can be cancelled @smoke @mobile', async ({ page, demoApi, myBookingsPage }) => {
    // Arrange through the API: faster and keeps this test focused on the list.
    const booking = await demoApi.bookFreeSlot({ licenceClass: 'M2' });

    await page.goto('/');
    await myBookingsPage.open();
    const row = myBookingsPage.row(booking.reference);
    await expect(row).toContainText(LOCATIONS[booking.locationId]);
    await expect(row).toContainText(booking.date);
    await expect(row).toContainText(booking.time);

    await myBookingsPage.cancel(booking.reference);
    await expect(row).toHaveCount(0);

    // Cancelling should free the slot for other people.
    const slots = await (await demoApi.getSlots(booking.locationId, booking.date)).json();
    expect(slots.find((s: { id: string }) => s.id === booking.slotId).available).toBe(true);
  });

  // Regression test: on phones the Cancel button used to be pushed off the right edge of the screen.
  test('cancel button is fully on screen on small devices @mobile', async ({ page, demoApi, myBookingsPage, cleanup }) => {
    const booking = await demoApi.bookFreeSlot();
    cleanup.booking(booking.reference);

    await page.goto('/');
    await myBookingsPage.open();
    const button = page.getByRole('button', { name: `Cancel booking ${booking.reference}` });
    const box = (await button.boundingBox())!;
    const viewportWidth = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
    // Nothing else may sit on top of it either.
    await button.click({ trial: true });
  });

  test('dismissing the cancel dialog keeps the booking', async ({ page, demoApi, myBookingsPage, cleanup }) => {
    const booking = await demoApi.bookFreeSlot();
    cleanup.booking(booking.reference);

    await page.goto('/');
    await myBookingsPage.open();
    await myBookingsPage.cancel(booking.reference, { accept: false });

    await expect(myBookingsPage.row(booking.reference)).toHaveCount(1);
    expect((await demoApi.getBooking(booking.id)).status()).toBe(200);
  });
});

test.describe('My bookings for a brand-new user', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows a friendly empty state', async ({ api, loginPage, myBookingsPage }) => {
    const user = await api.asNewUser();
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    await myBookingsPage.open();

    await expect(myBookingsPage.emptyState).toBeVisible();
    await expect(myBookingsPage.table).toBeHidden();
  });
});
