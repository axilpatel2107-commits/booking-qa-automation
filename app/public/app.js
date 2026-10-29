const TOKEN_KEY = 'slotbook.token';
const $ = (sel) => document.querySelector(sel);

let selectedSlotId = null;
let locationNames = {};

function token() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(path, { ...options, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && path !== '/api/auth/login') signOut();
  return { status: res.status, ok: res.ok, body };
}

function utcDate(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function show(view) {
  for (const id of ['login', 'book', 'mine']) $(`#view-${id}`).hidden = id !== view;
  $('#nav').hidden = view === 'login';
  if (view === 'mine') loadBookings();
}

function signOut() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  show('login');
}

// ---------- Login ----------
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const error = $('#login-error');
  error.textContent = '';
  if (!email || !password) {
    error.textContent = 'Email and password are required';
    return;
  }
  const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!res.ok) {
    error.textContent = 'Invalid email or password';
    return;
  }
  localStorage.setItem(TOKEN_KEY, res.body.token);
  $('#login-form').reset();
  await startBooking();
});

// ---------- Booking ----------
async function startBooking() {
  show('book');
  if (!$('#location').options.length) {
    const res = await api('/api/locations');
    locationNames = Object.fromEntries(res.body.map((l) => [l.id, l.name]));
    $('#location').innerHTML = res.body.map((l) => `<option value="${l.id}">${l.name}</option>`).join('');
    const date = $('#date');
    date.min = utcDate(1);
    date.max = utcDate(21);
    date.value = utcDate(1);
  }
  await loadSlots();
}

let slotRequest = 0;
async function loadSlots() {
  selectedSlotId = null;
  const container = $('#slots');
  const requestId = ++slotRequest;
  const res = await api(`/api/slots?locationId=${$('#location').value}&date=${$('#date').value}`);
  if (requestId !== slotRequest) return; // a newer request replaced this one
  if (!res.ok) {
    container.textContent = res.body?.errors?.[0] || 'Could not load times';
    return;
  }
  container.innerHTML = '';
  for (const slot of res.body) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = slot.time;
    btn.dataset.slotId = slot.id;
    btn.disabled = !slot.available;
    btn.setAttribute('aria-pressed', 'false');
    if (!slot.available) btn.setAttribute('aria-label', `${slot.time} (booked)`);
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      selectedSlotId = slot.id;
    });
    container.appendChild(btn);
  }
}

$('#location').addEventListener('change', loadSlots);
$('#date').addEventListener('change', loadSlots);

$('#book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('#book-error');
  error.textContent = '';
  if (!selectedSlotId) {
    error.textContent = 'Please choose a time';
    return;
  }
  const payload = {
    slotId: selectedSlotId,
    licenceClass: $('#licence').value,
    applicantName: $('#applicant-name').value,
    email: $('#applicant-email').value.trim(),
  };
  const res = await api('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 409) {
    error.textContent = 'Sorry, that time was just taken. Please pick another.';
    await loadSlots();
    return;
  }
  if (!res.ok) {
    error.textContent = res.body?.errors?.join('. ') || 'Something went wrong';
    return;
  }
  const b = res.body;
  $('#book-form').hidden = true;
  $('#confirmation').hidden = false;
  $('[data-testid="booking-reference"]').textContent = b.reference;
  $('[data-testid="booking-summary"]').textContent =
    `${locationNames[b.locationId]} on ${b.date} at ${b.time} (class ${b.licenceClass})`;
});

$('#book-another').addEventListener('click', async () => {
  $('#confirmation').hidden = true;
  $('#book-form').hidden = false;
  $('#applicant-name').value = '';
  $('#applicant-email').value = '';
  await loadSlots();
});

// ---------- My bookings ----------
async function loadBookings() {
  const res = await api('/api/bookings');
  const rows = res.ok ? res.body : [];
  if (!Object.keys(locationNames).length) {
    const loc = await api('/api/locations');
    locationNames = Object.fromEntries(loc.body.map((l) => [l.id, l.name]));
  }
  $('#no-bookings').hidden = rows.length > 0;
  $('#bookings-table').hidden = rows.length === 0;
  const tbody = $('#bookings-table tbody');
  tbody.innerHTML = '';
  for (const b of rows) {
    // Explicit roles keep table semantics for screen readers when phones restyle it as cards.
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.innerHTML =
      `<td role="cell" data-label="Reference">${b.reference}</td><td role="cell" data-label="Centre">${locationNames[b.locationId]}</td>` +
      `<td role="cell" data-label="Date">${b.date}</td><td role="cell" data-label="Time">${b.time}</td>` +
      `<td role="cell" data-label="Class">${b.licenceClass}</td><td role="cell"></td>`;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.setAttribute('aria-label', `Cancel booking ${b.reference}`);
    cancel.addEventListener('click', async () => {
      if (!confirm(`Cancel booking ${b.reference}?`)) return;
      await api(`/api/bookings/${b.id}`, { method: 'DELETE' });
      await loadBookings();
    });
    tr.lastElementChild.appendChild(cancel);
    tbody.appendChild(tr);
  }
}

// ---------- Nav ----------
document.querySelectorAll('[data-view]').forEach((btn) =>
  btn.addEventListener('click', () => (btn.dataset.view === 'book' ? startBooking() : show('mine'))),
);
$('#sign-out').addEventListener('click', signOut);

if (token()) startBooking();
else show('login');
