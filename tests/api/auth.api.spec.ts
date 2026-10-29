import { test, expect } from '../../fixtures';
import { DEMO_USER, uniqueEmail } from '../../utils/test-data';

test.describe('Auth API', () => {
  test('login returns a token and the user profile @smoke', async ({ api }) => {
    const res = await api.login(DEMO_USER.email, DEMO_USER.password);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      token: expect.stringMatching(/^[0-9a-f]{48}$/),
      user: { id: expect.any(String), email: DEMO_USER.email, name: expect.any(String) },
    });
    expect(body.user).not.toHaveProperty('password');
  });

  test('wrong password returns 401 with a generic message', async ({ api }) => {
    const res = await api.login(DEMO_USER.email, 'wrong');
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ errors: ['Invalid email or password'] });
  });

  test('unknown email returns the same 401 as a wrong password', async ({ api }) => {
    const res = await api.login(uniqueEmail('nobody'), 'whatever1');
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ errors: ['Invalid email or password'] });
  });

  test('missing credentials return 400', async ({ api }) => {
    const res = await api.login('', '');
    expect(res.status()).toBe(400);
  });

  test('a new user can register and then log in', async ({ api }) => {
    const user = { email: uniqueEmail(), password: 'Str0ngPass!', name: 'Arjun Singh' };
    const reg = await api.register(user);
    expect(reg.status()).toBe(201);
    expect(await reg.json()).toEqual({ id: expect.any(String), email: user.email, name: user.name });

    expect((await api.login(user.email, user.password)).status()).toBe(200);
  });

  test('registering the same email twice returns 409', async ({ api }) => {
    const user = { email: uniqueEmail(), password: 'Str0ngPass!', name: 'Mei Chen' };
    expect((await api.register(user)).status()).toBe(201);
    const again = await api.register({ ...user, email: user.email.toUpperCase() });
    expect(again.status()).toBe(409);
  });

  const invalidRegistrations = [
    { case: 'bad email', data: { email: 'nope', password: 'Str0ngPass!', name: 'Ava' }, error: 'email must be a valid address' },
    { case: 'short password', data: { email: uniqueEmail(), password: 'short', name: 'Ava' }, error: 'password must be at least 8 characters' },
    { case: 'missing name', data: { email: uniqueEmail(), password: 'Str0ngPass!', name: '' }, error: 'name must be at least 2 characters' },
  ];
  for (const { case: name, data, error } of invalidRegistrations) {
    test(`register rejects ${name} with 400`, async ({ api }) => {
      const res = await api.register(data);
      expect(res.status()).toBe(400);
      expect((await res.json()).errors).toContain(error);
    });
  }
});
