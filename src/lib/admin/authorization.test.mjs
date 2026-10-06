import assert from 'node:assert/strict';
import test from 'node:test';
import { requireContentAdministrator, ContentHttpError } from './authorization.ts';

const client = (user, error = null) => ({ auth: { getUser: async () => ({ data: { user }, error }) } });
for (const [name, user, error, status] of [
    ['anonymous', null, null, 401],
    ['invalid server session', { email: 'id19991016@gmail.com' }, new Error('Expired token'), 401],
    ['ordinary account', { email: 'member@example.invalid' }, null, 403],
    ['account without verified email', {}, null, 403],
]) test(`${name} cannot manage any section`, async () => {
    await assert.rejects(requireContentAdministrator(client(user, error)), error => error instanceof ContentHttpError && error.status === status);
});
test('verified administrator is allowed', async () => {
    await requireContentAdministrator(client({ email: 'id19991016@gmail.com' }));
});
test('an unreachable account server never grants access', async () => {
    await assert.rejects(requireContentAdministrator({ auth: { getUser: async () => { throw new Error('Network failure'); } } }), error => error.status === 503);
});
