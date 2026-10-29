// SlotBook: a small appointment-booking app used as the system under test.
// Everything is in memory, so a restart gives you a clean slate.
const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const LICENCE_CLASSES = ['G2', 'G', 'M2', 'M'];
const TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const DAYS_AHEAD = 21;

const locations = [
  { id: 'downtown', name: 'Downtown Centre' },
  { id: 'northgate', name: 'Northgate' },
  { id: 'lakeside', name: 'Lakeside' },
  { id: 'westfield', name: 'Westfield' },
];

const users = new Map(); // email -> { id, email, name, password }
const tokens = new Map(); // token -> userId
const bookings = new Map(); // bookingId -> booking
const takenSlots = new Map(); // slotId -> bookingId

function addUser(email, password, name) {
  const user = { id: crypto.randomUUID(), email: email.toLowerCase(), password, name };
  users.set(user.email, user);
  return user;
}
addUser('demo@slotbook.test', 'Demo123!', 'Demo User');

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function bookableDates() {
  return Array.from({ length: DAYS_AHEAD }, (_, i) => isoDate(i + 1));
}

function slotId(locationId, date, time) {
  return `${locationId}_${date}_${time.replace(':', '')}`;
}

function parseSlotId(id) {
  const match = /^([a-z]+)_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})$/.exec(String(id || ''));
  if (!match) return null;
  const [, locationId, date, hh, mm] = match;
  const time = `${hh}:${mm}`;
  const valid =
    locations.some((l) => l.id === locationId) && bookableDates().includes(date) && TIMES.includes(time);
  return valid ? { locationId, date, time } : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBookingBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be JSON'];
  if (!parseSlotId(body.slotId)) errors.push('slotId is missing or not a bookable slot');
  if (!LICENCE_CLASSES.includes(body.licenceClass))
    errors.push(`licenceClass must be one of ${LICENCE_CLASSES.join(', ')}`);
  const name = typeof body.applicantName === 'string' ? body.applicantName.trim() : '';
  if (name.length < 2 || name.length > 60) errors.push('applicantName must be 2-60 characters');
  if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email)) errors.push('email must be a valid address');
  return errors;
}

function newReference() {
  return 'SB-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function publicBooking(b) {
  const { userId, ...rest } = b;
  return rest;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Return a clean 400 instead of an HTML stack trace for malformed JSON.
app.use((err, _req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ errors: ['Malformed JSON body'] });
  return next(err);
});

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && tokens.get(token);
  if (!userId) return res.status(401).json({ errors: ['Missing or invalid token'] });
  req.userId = userId;
  return next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  const errors = [];
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) errors.push('email must be a valid address');
  if (typeof password !== 'string' || password.length < 8) errors.push('password must be at least 8 characters');
  if (typeof name !== 'string' || name.trim().length < 2) errors.push('name must be at least 2 characters');
  if (errors.length) return res.status(400).json({ errors });
  if (users.has(email.toLowerCase())) return res.status(409).json({ errors: ['email is already registered'] });
  const user = addUser(email, password, name.trim());
  return res.status(201).json({ id: user.id, email: user.email, name: user.name });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ errors: ['email and password are required'] });
  const user = users.get(String(email).toLowerCase());
  if (!user || user.password !== password) return res.status(401).json({ errors: ['Invalid email or password'] });
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, user.id);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/locations', (_req, res) => res.json(locations));

app.get('/api/slots', (req, res) => {
  const { locationId, date } = req.query;
  if (!locations.some((l) => l.id === locationId)) return res.status(400).json({ errors: ['Unknown locationId'] });
  if (!bookableDates().includes(date))
    return res.status(400).json({ errors: [`date must be between ${isoDate(1)} and ${isoDate(DAYS_AHEAD)}`] });
  const slots = TIMES.map((time) => {
    const id = slotId(locationId, date, time);
    return { id, locationId, date, time, available: !takenSlots.has(id) };
  });
  return res.json(slots);
});

app.get('/api/bookings', requireAuth, (req, res) => {
  const mine = [...bookings.values()].filter((b) => b.userId === req.userId && b.status === 'confirmed');
  mine.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json(mine.map(publicBooking));
});

app.post('/api/bookings', requireAuth, (req, res) => {
  const errors = validateBookingBody(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const { slotId: id, licenceClass, applicantName, email } = req.body;
  if (takenSlots.has(id)) return res.status(409).json({ errors: ['That time slot was just taken'] });
  const slot = parseSlotId(id);
  const booking = {
    id: crypto.randomUUID(),
    reference: newReference(),
    slotId: id,
    locationId: slot.locationId,
    date: slot.date,
    time: slot.time,
    licenceClass,
    applicantName: applicantName.trim(),
    email,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    userId: req.userId,
  };
  bookings.set(booking.id, booking);
  takenSlots.set(id, booking.id);
  return res.status(201).json(publicBooking(booking));
});

function findOwnBooking(req, res) {
  const booking = bookings.get(req.params.id);
  // Someone else's booking looks exactly like a missing one, so IDs can't be probed.
  if (!booking || booking.userId !== req.userId || booking.status !== 'confirmed') {
    res.status(404).json({ errors: ['Booking not found'] });
    return null;
  }
  return booking;
}

app.get('/api/bookings/:id', requireAuth, (req, res) => {
  const booking = findOwnBooking(req, res);
  if (booking) res.json(publicBooking(booking));
});

app.patch('/api/bookings/:id', requireAuth, (req, res) => {
  const booking = findOwnBooking(req, res);
  if (!booking) return;
  const slot = parseSlotId(req.body && req.body.slotId);
  if (!slot) return res.status(400).json({ errors: ['slotId is missing or not a bookable slot'] });
  if (takenSlots.has(req.body.slotId)) return res.status(409).json({ errors: ['That time slot was just taken'] });
  takenSlots.delete(booking.slotId);
  Object.assign(booking, { slotId: req.body.slotId, ...slot });
  takenSlots.set(booking.slotId, booking.id);
  return res.json(publicBooking(booking));
});

app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const booking = findOwnBooking(req, res);
  if (!booking) return;
  booking.status = 'cancelled';
  takenSlots.delete(booking.slotId);
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ errors: ['Not found'] }));

app.listen(PORT, () => console.log(`SlotBook running on http://localhost:${PORT}`));
