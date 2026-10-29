import { expect } from '@playwright/test';

/** Contract check for a booking object returned by the API. */
export function expectBookingShape(body: unknown) {
  expect(body).toEqual({
    id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    reference: expect.stringMatching(/^SB-[0-9A-F]{6}$/),
    slotId: expect.any(String),
    locationId: expect.any(String),
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    time: expect.stringMatching(/^\d{2}:\d{2}$/),
    licenceClass: expect.stringMatching(/^(G2|G|M2|M)$/),
    applicantName: expect.any(String),
    email: expect.any(String),
    status: 'confirmed',
    createdAt: expect.any(String),
  });
  // No internal fields should leak to the client.
  expect(body).not.toHaveProperty('userId');
}
