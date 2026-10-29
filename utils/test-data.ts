import { randomUUID } from 'node:crypto';

export const DEMO_USER = {
  email: process.env.DEMO_EMAIL || 'demo@slotbook.test',
  password: process.env.DEMO_PASSWORD || 'Demo123!',
};

export const LOCATIONS = {
  downtown: 'Downtown Centre',
  northgate: 'Northgate',
  lakeside: 'Lakeside',
  westfield: 'Westfield',
} as const;

export type LocationId = keyof typeof LOCATIONS;
export const LICENCE_CLASSES = ['G2', 'G', 'M2', 'M'] as const;
export type LicenceClass = (typeof LICENCE_CLASSES)[number];

/** Short unique suffix so parallel tests never collide on emails or names. */
export const uid = () => randomUUID().slice(0, 8);

export const uniqueEmail = (prefix = 'qa') => `${prefix}.${uid()}@example.test`;

export function newApplicant() {
  const first = ['Priya', 'Liam', 'Sofia', 'Omar', 'Mei', 'Noah', 'Ava', 'Arjun'];
  const last = ['Shah', 'Tremblay', 'Nguyen', 'Brown', 'Singh', 'Roy', 'Martin', 'Chen'];
  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  return { name: `${pick(first)} ${pick(last)}`, email: uniqueEmail('applicant') };
}

/** ISO date (YYYY-MM-DD) `days` from today, in UTC to match the server. */
export function isoDate(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
