import { test, expect } from '../../fixtures';
import { LOCATIONS, newApplicant } from '../../utils/test-data';

test.describe('Booking a road test', () => {
  test.beforeEach(async ({ bookingPage }) => {
    await bookingPage.goto();
  });

  test('user can book a free slot end to end @smoke @mobile', async ({ bookingPage, demoApi, cleanup }) => {
    const slot = await demoApi.findFreeSlot();
    const applicant = newApplicant();

    const reference = await bookingPage.book({
      centre: LOCATIONS[slot.locationId],
      date: slot.date,
      time: slot.time,
      licenceClass: 'G',
      name: applicant.name,
      email: applicant.email,
    });
    cleanup.booking(reference);

    await expect(bookingPage.confirmation.getByRole('heading')).toHaveText('Booking confirmed');
    expect(reference).toMatch(/^SB-[0-9A-F]{6}$/);
    await expect(bookingPage.summary).toHaveText(
      `${LOCATIONS[slot.locationId]} on ${slot.date} at ${slot.time} (class G)`,
    );

    // The UI said it worked; check the backend agrees.
    const saved = (await (await demoApi.listBookings()).json()).find((b: { reference: string }) => b.reference === reference);
    expect(saved).toMatchObject({ slotId: slot.id, licenceClass: 'G', applicantName: applicant.name });
  });

  test('a slot booked by someone else is shown as unavailable', async ({ bookingPage, userApi }) => {
    const taken = await userApi.bookFreeSlot();

    await bookingPage.chooseCentreAndDate(LOCATIONS[taken.locationId], taken.date);
    const button = bookingPage.times.getByRole('button', { name: `${taken.time} (booked)` });
    await expect(button).toBeDisabled();
  });

  test('if a slot is taken while the user is filling the form, they get a clear message', async ({
    bookingPage,
    demoApi,
    userApi,
  }) => {
    const slot = await demoApi.findFreeSlot();
    const applicant = newApplicant();

    await bookingPage.chooseCentreAndDate(LOCATIONS[slot.locationId], slot.date);
    await bookingPage.chooseTime(slot.time);
    await bookingPage.fillApplicant(applicant.name, applicant.email);

    // Another user grabs the same slot before we press Confirm.
    await userApi.bookFreeSlot({ slotId: slot.id });

    await bookingPage.confirm.click();
    await expect(bookingPage.error).toHaveText('Sorry, that time was just taken. Please pick another.');
    await expect(bookingPage.times.getByRole('button', { name: `${slot.time} (booked)` })).toBeDisabled();
    await expect(bookingPage.confirmation).toBeHidden();
  });

  test.describe('form validation', () => {
    test('confirming without choosing a time asks the user to pick one', async ({ bookingPage, page }) => {
      let bookingCalled = false;
      page.on('request', (r) => r.url().endsWith('/api/bookings') && r.method() === 'POST' && (bookingCalled = true));

      await bookingPage.fillApplicant('Priya Shah', 'priya@example.test');
      await bookingPage.confirm.click();

      await expect(bookingPage.error).toHaveText('Please choose a time');
      expect(bookingCalled).toBe(false);
    });

    const badInputs = [
      { case: 'invalid email', name: 'Priya Shah', email: 'priya-at-example', message: 'email must be a valid address' },
      { case: 'name too short', name: 'P', email: 'priya@example.test', message: 'applicantName must be 2-60 characters' },
    ];
    for (const input of badInputs) {
      test(`${input.case} is rejected with a helpful message`, async ({ bookingPage, demoApi }) => {
        const slot = await demoApi.findFreeSlot();
        await bookingPage.chooseCentreAndDate(LOCATIONS[slot.locationId], slot.date);
        await bookingPage.chooseTime(slot.time);
        await bookingPage.fillApplicant(input.name, input.email);
        await bookingPage.confirm.click();

        await expect(bookingPage.error).toContainText(input.message);
        await expect(bookingPage.confirmation).toBeHidden();
      });
    }
  });
});
