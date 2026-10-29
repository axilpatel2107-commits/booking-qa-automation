import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { LOCATIONS, LocationId, LicenceClass, isoDate, randomInt, newApplicant, uniqueEmail } from './test-data';

export interface Slot {
  id: string;
  locationId: LocationId;
  date: string;
  time: string;
  available: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  slotId: string;
  locationId: LocationId;
  date: string;
  time: string;
  licenceClass: LicenceClass;
  applicantName: string;
  email: string;
  status: 'confirmed';
  createdAt: string;
}

export interface BookingInput {
  slotId: string;
  licenceClass: LicenceClass;
  applicantName: string;
  email: string;
}

/**
 * Thin wrapper around Playwright's request context.
 * Methods return the raw APIResponse so tests can assert on status codes,
 * plus a few helpers for setting up data quickly.
 */
export class ApiClient {
  private token?: string;

  constructor(private readonly request: APIRequestContext) {}

  get authToken() {
    return this.token;
  }

  withToken(token: string) {
    this.token = token;
    return this;
  }

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // ----- auth -----
  register(data: { email: string; password: string; name: string }) {
    return this.request.post('/api/auth/register', { data });
  }

  login(email: string, password: string) {
    return this.request.post('/api/auth/login', { data: { email, password } });
  }

  async loginAs(email: string, password: string) {
    const res = await this.login(email, password);
    expect(res, 'login should succeed').toBeOK();
    this.token = (await res.json()).token;
    return this;
  }

  /** Registers a throwaway user and logs in as them. */
  async asNewUser() {
    const user = { email: uniqueEmail('user'), password: 'Passw0rd!', name: 'Test User' };
    expect(await this.register(user)).toBeOK();
    await this.loginAs(user.email, user.password);
    return user;
  }

  // ----- slots -----
  getSlots(locationId: string, date: string) {
    return this.request.get('/api/slots', { params: { locationId, date } });
  }

  /**
   * Finds a free slot at a random centre and date. Randomising keeps parallel
   * workers away from each other without needing a shared lock.
   */
  async findFreeSlot(options: { locationId?: LocationId; minDays?: number; maxDays?: number } = {}): Promise<Slot> {
    const ids = Object.keys(LOCATIONS) as LocationId[];
    for (let attempt = 0; attempt < 20; attempt++) {
      const locationId = options.locationId ?? ids[randomInt(0, ids.length - 1)];
      const date = isoDate(randomInt(options.minDays ?? 1, options.maxDays ?? 21));
      const res = await this.getSlots(locationId, date);
      expect(res).toBeOK();
      const free = ((await res.json()) as Slot[]).filter((s) => s.available);
      if (free.length) return free[randomInt(0, free.length - 1)];
    }
    throw new Error('No free slot found after 20 attempts. Restart the app to reset data.');
  }

  // ----- bookings -----
  listBookings() {
    return this.request.get('/api/bookings', { headers: this.headers() });
  }

  getBooking(id: string) {
    return this.request.get(`/api/bookings/${id}`, { headers: this.headers() });
  }

  createBooking(data: Partial<BookingInput> | Record<string, unknown> | string) {
    // Passing a string lets tests send deliberately malformed bodies.
    return typeof data === 'string'
      ? this.request.post('/api/bookings', {
          headers: { ...this.headers(), 'Content-Type': 'application/json' },
          data,
        })
      : this.request.post('/api/bookings', { headers: this.headers(), data });
  }

  reschedule(id: string, slotId: string) {
    return this.request.patch(`/api/bookings/${id}`, { headers: this.headers(), data: { slotId } });
  }

  cancelBooking(id: string) {
    return this.request.delete(`/api/bookings/${id}`, { headers: this.headers() });
  }

  /** Books a free slot and returns the created booking. */
  async bookFreeSlot(overrides: Partial<BookingInput> = {}): Promise<Booking> {
    const applicant = newApplicant();
    const slotId = overrides.slotId ?? (await this.findFreeSlot()).id;
    const res: APIResponse = await this.createBooking({
      slotId,
      licenceClass: 'G2',
      applicantName: applicant.name,
      email: applicant.email,
      ...overrides,
    });
    expect(res.status(), await res.text()).toBe(201);
    return res.json();
  }
}
