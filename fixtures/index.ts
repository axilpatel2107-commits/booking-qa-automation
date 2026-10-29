import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { BookingPage } from '../pages/BookingPage';
import { MyBookingsPage } from '../pages/MyBookingsPage';
import { ApiClient, Booking } from '../utils/api-client';
import { DEMO_USER } from '../utils/test-data';

type Fixtures = {
  loginPage: LoginPage;
  bookingPage: BookingPage;
  myBookingsPage: MyBookingsPage;
  /** Unauthenticated API client. */
  api: ApiClient;
  /** API client logged in as a brand-new user (isolated data per test). */
  userApi: ApiClient;
  /** API client logged in as the same demo user the UI tests use. */
  demoApi: ApiClient;
  /** Register booking references here and they are cancelled after the test. */
  cleanup: { booking: (reference: string) => void };
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  bookingPage: async ({ page }, use) => use(new BookingPage(page)),
  myBookingsPage: async ({ page }, use) => use(new MyBookingsPage(page)),

  api: async ({ request }, use) => use(new ApiClient(request)),

  userApi: async ({ request }, use) => {
    const client = new ApiClient(request);
    await client.asNewUser();
    await use(client);
  },

  demoApi: async ({ request }, use) => {
    await use(await new ApiClient(request).loginAs(DEMO_USER.email, DEMO_USER.password));
  },

  cleanup: async ({ demoApi }, use) => {
    const references: string[] = [];
    await use({ booking: (ref) => references.push(ref) });
    if (!references.length) return;
    const bookings: Booking[] = await (await demoApi.listBookings()).json();
    for (const b of bookings.filter((x) => references.includes(x.reference))) {
      await demoApi.cancelBooking(b.id);
    }
  },
});

export { expect };
