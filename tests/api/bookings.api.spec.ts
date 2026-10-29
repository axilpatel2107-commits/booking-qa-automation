import { test, expect } from '../../fixtures';
import { ApiClient, Booking } from '../../utils/api-client';
import { expectBookingShape } from '../../utils/assertions';
import { isoDate, newApplicant } from '../../utils/test-data';

test.describe('Bookings API', () => {
  test('create, read and list a booking @smoke', async ({ userApi }) => {
    const slot = await userApi.findFreeSlot();
    const applicant = newApplicant();

    const create = await userApi.createBooking({
      slotId: slot.id,
      licenceClass: 'G2',
      applicantName: `  ${applicant.name}  `,
      email: applicant.email,
    });
    expect(create.status()).toBe(201);
    const booking: Booking = await create.json();
    expectBookingShape(booking);
    expect(booking).toMatchObject({
      slotId: slot.id,
      locationId: slot.locationId,
      date: slot.date,
      time: slot.time,
      applicantName: applicant.name, // whitespace trimmed
    });

    const read = await userApi.getBooking(booking.id);
    expect(read.status()).toBe(200);
    expect(await read.json()).toEqual(booking);

    const list = await (await userApi.listBookings()).json();
    expect(list).toEqual([booking]);

    // Slot should now show as taken.
    const slots = await (await userApi.getSlots(slot.locationId, slot.date)).json();
    expect(slots.find((s: { id: string }) => s.id === slot.id).available).toBe(false);
  });

  test('the same slot cannot be booked twice (409)', async ({ userApi, request }) => {
    const first = await userApi.bookFreeSlot();
    const otherUser = new ApiClient(request);
    await otherUser.asNewUser();

    const second = await otherUser.createBooking({
      slotId: first.slotId,
      licenceClass: 'G',
      applicantName: 'Liam Tremblay',
      email: 'liam@example.test',
    });
    expect(second.status()).toBe(409);
    expect(await second.json()).toEqual({ errors: ['That time slot was just taken'] });
  });

  test('a user cannot see, change or cancel someone else\'s booking', async ({ userApi, request }) => {
    const booking = await userApi.bookFreeSlot();
    const intruder = new ApiClient(request);
    await intruder.asNewUser();

    // 404 rather than 403, so booking IDs can't be probed.
    expect((await intruder.getBooking(booking.id)).status()).toBe(404);
    expect((await intruder.cancelBooking(booking.id)).status()).toBe(404);
    const freeSlot = await intruder.findFreeSlot();
    expect((await intruder.reschedule(booking.id, freeSlot.id)).status()).toBe(404);
    expect(await (await intruder.listBookings()).json()).toEqual([]);

    // Owner's booking is untouched.
    expect(await (await userApi.getBooking(booking.id)).json()).toEqual(booking);
  });

  test('rescheduling moves the booking and frees the old slot', async ({ userApi }) => {
    const booking = await userApi.bookFreeSlot();
    const target = await userApi.findFreeSlot();

    const res = await userApi.reschedule(booking.id, target.id);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: booking.id, reference: booking.reference, slotId: target.id, date: target.date, time: target.time });

    const oldSlots = await (await userApi.getSlots(booking.locationId, booking.date)).json();
    expect(oldSlots.find((s: { id: string }) => s.id === booking.slotId).available).toBe(true);
  });

  test('cancelling returns 204, hides the booking and frees the slot', async ({ userApi }) => {
    const booking = await userApi.bookFreeSlot();

    expect((await userApi.cancelBooking(booking.id)).status()).toBe(204);
    expect((await userApi.getBooking(booking.id)).status()).toBe(404);
    expect((await userApi.cancelBooking(booking.id)).status()).toBe(404); // not idempotent-success
    expect(await (await userApi.listBookings()).json()).toEqual([]);

    const slots = await (await userApi.getSlots(booking.locationId, booking.date)).json();
    expect(slots.find((s: { id: string }) => s.id === booking.slotId).available).toBe(true);
  });

  test.describe('authentication', () => {
    test('all booking endpoints require a token', async ({ api }) => {
      const responses = await Promise.all([
        api.listBookings(),
        api.createBooking({}),
        api.getBooking('any'),
        api.reschedule('any', 'any'),
        api.cancelBooking('any'),
      ]);
      for (const res of responses) expect(res.status(), res.url()).toBe(401);
    });

    test('a made-up token is rejected', async ({ api }) => {
      api.withToken('0'.repeat(48));
      expect((await api.listBookings()).status()).toBe(401);
    });
  });

  test.describe('input validation', () => {
    const valid = () => ({
      slotId: `downtown_${isoDate(5)}_1000`,
      licenceClass: 'G2',
      applicantName: 'Sofia Nguyen',
      email: 'sofia@example.test',
    });

    const cases: { case: string; body: Record<string, unknown>; error: string }[] = [
      { case: 'missing slotId', body: { ...valid(), slotId: undefined }, error: 'slotId is missing or not a bookable slot' },
      { case: 'slot in the past', body: { ...valid(), slotId: `downtown_${isoDate(-1)}_1000` }, error: 'slotId is missing or not a bookable slot' },
      { case: 'slot outside opening hours', body: { ...valid(), slotId: `downtown_${isoDate(5)}_2000` }, error: 'slotId is missing or not a bookable slot' },
      { case: 'unknown licence class', body: { ...valid(), licenceClass: 'Z' }, error: 'licenceClass must be one of G2, G, M2, M' },
      { case: 'lowercase licence class', body: { ...valid(), licenceClass: 'g2' }, error: 'licenceClass must be one of G2, G, M2, M' },
      { case: 'one-character name', body: { ...valid(), applicantName: 'S' }, error: 'applicantName must be 2-60 characters' },
      { case: '61-character name', body: { ...valid(), applicantName: 'a'.repeat(61) }, error: 'applicantName must be 2-60 characters' },
      { case: 'whitespace-only name', body: { ...valid(), applicantName: '    ' }, error: 'applicantName must be 2-60 characters' },
      { case: 'invalid email', body: { ...valid(), email: 'sofia@' }, error: 'email must be a valid address' },
      { case: 'email as a number', body: { ...valid(), email: 12345 }, error: 'email must be a valid address' },
    ];

    for (const { case: name, body, error } of cases) {
      test(`${name} → 400`, async ({ userApi }) => {
        const res = await userApi.createBooking(body);
        expect(res.status()).toBe(400);
        expect((await res.json()).errors).toContain(error);
      });
    }

    test('60-character name is accepted (upper boundary)', async ({ userApi }) => {
      const booking = await userApi.bookFreeSlot({ applicantName: 'a'.repeat(60) });
      expect(booking.applicantName).toHaveLength(60);
    });

    test('multiple problems are all reported at once', async ({ userApi }) => {
      const res = await userApi.createBooking({ slotId: 'x', licenceClass: 'X', applicantName: '', email: '' });
      expect(res.status()).toBe(400);
      expect((await res.json()).errors).toHaveLength(4);
    });

    test('malformed JSON returns a clean 400, not a stack trace', async ({ userApi }) => {
      const res = await userApi.createBooking('{"slotId": ');
      expect(res.status()).toBe(400);
      expect(res.headers()['content-type']).toContain('application/json');
      expect(await res.json()).toEqual({ errors: ['Malformed JSON body'] });
    });
  });
});
