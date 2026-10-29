import { test, expect } from '../../fixtures';
import { isoDate } from '../../utils/test-data';

test.describe('Slots API', () => {
  test('returns eight hourly slots for a valid centre and date @smoke', async ({ api }) => {
    const date = isoDate(3);
    const res = await api.getSlots('lakeside', date);
    expect(res.status()).toBe(200);

    const slots = await res.json();
    expect(slots.map((s: { time: string }) => s.time)).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
    ]);
    for (const s of slots) {
      expect(s).toEqual({ id: `lakeside_${date}_${s.time.replace(':', '')}`, locationId: 'lakeside', date, time: s.time, available: expect.any(Boolean) });
    }
  });

  test('lists all test centres', async ({ request }) => {
    const res = await request.get('/api/locations');
    expect(res.status()).toBe(200);
    expect((await res.json()).map((l: { id: string }) => l.id)).toEqual(['downtown', 'northgate', 'lakeside', 'westfield']);
  });

  // Boundary values around the 1-21 day booking window.
  const invalid = [
    { case: 'today (window starts tomorrow)', locationId: 'downtown', date: isoDate(0) },
    { case: 'one day past the window', locationId: 'downtown', date: isoDate(22) },
    { case: 'a date in the past', locationId: 'downtown', date: isoDate(-5) },
    { case: 'a badly formatted date', locationId: 'downtown', date: '30/10/2026' },
    { case: 'an unknown centre', locationId: 'atlantis', date: isoDate(2) },
  ];
  for (const { case: name, locationId, date } of invalid) {
    test(`rejects ${name} with 400`, async ({ api }) => {
      expect((await api.getSlots(locationId, date)).status()).toBe(400);
    });
  }

  for (const days of [1, 21]) {
    test(`accepts the window edge: ${days} day(s) ahead`, async ({ api }) => {
      expect((await api.getSlots('northgate', isoDate(days))).status()).toBe(200);
    });
  }
});
