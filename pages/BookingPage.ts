import { Locator, Page, expect } from '@playwright/test';
import { LOCATIONS, LicenceClass } from '../utils/test-data';

export interface BookingDetails {
  centre: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  licenceClass?: LicenceClass;
  name: string;
  email: string;
}

export class BookingPage {
  readonly heading: Locator;
  readonly centre: Locator;
  readonly date: Locator;
  readonly licenceClass: Locator;
  readonly times: Locator;
  readonly applicantName: Locator;
  readonly applicantEmail: Locator;
  readonly confirm: Locator;
  readonly error: Locator;
  readonly confirmation: Locator;
  readonly reference: Locator;
  readonly summary: Locator;

  constructor(private readonly page: Page) {
    const section = page.locator('#view-book');
    this.heading = page.getByRole('heading', { name: 'Book a road test' });
    this.centre = section.getByLabel('Test centre');
    this.date = section.getByLabel('Date');
    this.licenceClass = section.getByLabel('Licence class');
    this.times = section.getByRole('group', { name: 'Available times' });
    this.applicantName = section.getByLabel('Full name');
    this.applicantEmail = section.getByRole('group', { name: 'Applicant' }).getByLabel('Email');
    this.confirm = section.getByRole('button', { name: 'Confirm booking' });
    this.error = section.getByRole('alert');
    this.confirmation = section.getByRole('status');
    this.reference = page.getByTestId('booking-reference');
    this.summary = page.getByTestId('booking-summary');
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  timeButton(time: string) {
    return this.times.getByRole('button', { name: time, exact: true });
  }

  async chooseCentreAndDate(centre: string, date: string) {
    await this.centre.selectOption({ label: centre });
    await this.date.fill(date);
    // Wait until the times for *this* centre and date are rendered, so we never
    // click a button from the previous list while it is being replaced.
    const locationId = Object.entries(LOCATIONS).find(([, name]) => name === centre)?.[0];
    await expect(this.times.locator(`button[data-slot-id^="${locationId}_${date}_"]`)).toHaveCount(8);
  }

  async chooseTime(time: string) {
    await this.timeButton(time).click();
    await expect(this.timeButton(time)).toHaveAttribute('aria-pressed', 'true');
  }

  async fillApplicant(name: string, email: string) {
    await this.applicantName.fill(name);
    await this.applicantEmail.fill(email);
  }

  /** Full happy-path booking. Returns the reference number shown to the user. */
  async book(details: BookingDetails) {
    await this.chooseCentreAndDate(details.centre, details.date);
    if (details.licenceClass) await this.licenceClass.selectOption(details.licenceClass);
    await this.chooseTime(details.time);
    await this.fillApplicant(details.name, details.email);
    await this.confirm.click();
    await expect(this.confirmation).toBeVisible();
    return (await this.reference.textContent())!.trim();
  }
}
