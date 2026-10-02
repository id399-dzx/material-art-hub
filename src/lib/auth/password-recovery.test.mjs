import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetPasswordWithToken } from './password-recovery.ts';
import { createHash } from 'node:crypto';
import { recoveryTokenFromParams } from './recovery-link.ts';

const token = 'a'.repeat(64);
const newPassword = 'test-only-new-password';
const supabaseHash = createHash('sha224').update('synthetic@example.com000000').digest('hex');

function mockAuth({ verificationError = null, session = { user: { id: 'owner' } }, updateError = null, cleanupFails = false } = {}) {
    const calls = [];
    return { calls, auth: {
        async verifyOtp(params) { calls.push(['verify', params]); return { data: { session, user: session?.user }, error: verificationError }; },
        async updateUser(params) { calls.push(['update', params]); return { error: updateError }; },
        async signOut(params) { calls.push(['signOut', params]); if (cleanupFails) throw new Error('offline'); },
    } };
}

test('missing recovery proof or short password never reaches the auth provider', async () => {
    const { auth, calls } = mockAuth();
    assert.equal((await resetPasswordWithToken(auth, null, newPassword)).status, 400);
    assert.equal((await resetPasswordWithToken(auth, token, 'short')).status, 400);
    assert.deepEqual(calls, []);
});

test('fresh Supabase SHA-224 and PKCE email links reach recovery verification without rewriting the proof', async () => {
    assert.equal(supabaseHash.length, 56);
    for (const tokenHash of [supabaseHash, `pkce_${supabaseHash}`, token]) {
        const parsed = recoveryTokenFromParams({ token_hash: tokenHash, type: 'recovery' });
        assert.equal(parsed, tokenHash, 'the page must accept the same proof as the API');
        const { auth, calls } = mockAuth();
        assert.equal((await resetPasswordWithToken(auth, parsed, newPassword)).status, 200);
        assert.deepEqual(calls[0], ['verify', { token_hash: tokenHash, type: 'recovery' }]);
    }
});

test('non-recovery, missing, duplicated and malformed link parameters never grant recovery access', async () => {
    for (const params of [
        {}, { token_hash: supabaseHash }, { token_hash: supabaseHash, type: 'signup' },
        { token_hash: supabaseHash, type: 'invite' }, { token_hash: [supabaseHash, token], type: 'recovery' },
        { token_hash: `pkce_${supabaseHash.slice(1)}`, type: 'recovery' },
        { token_hash: ` ${supabaseHash}`, type: 'recovery' },
        { token_hash: '<script>'.repeat(8), type: 'recovery' },
    ]) {
        const parsed = recoveryTokenFromParams(params);
        assert.equal(parsed, null);
        const { auth, calls } = mockAuth();
        assert.equal((await resetPasswordWithToken(auth, parsed, newPassword)).status, 400);
        assert.deepEqual(calls, []);
    }
});

test('correctly shaped 56-digit and prefixed tokens still require a valid unexpired recovery proof', async () => {
    for (const tokenHash of [supabaseHash, `pkce_${supabaseHash}`]) {
        const { auth, calls } = mockAuth({ verificationError: { code: 'otp_expired' } });
        const result = await resetPasswordWithToken(auth, tokenHash, newPassword);
        assert.equal(result.status, 401);
        assert.equal(result.invalidLink, true);
        assert.deepEqual(calls.map(([operation]) => operation), ['verify']);
    }
});

test('expired proof and a verification response without a session never update a password', async () => {
    for (const options of [{ verificationError: { code: 'otp_expired' } }, { session: null }]) {
        const { auth, calls } = mockAuth(options);
        const result = await resetPasswordWithToken(auth, token, newPassword);
        assert.equal(result.status, 401);
        assert.equal(result.invalidLink, true);
        assert.deepEqual(calls.map(([operation]) => operation), ['verify']);
    }
});

test('successful reset verifies only a recovery token, updates its session and closes it', async () => {
    const { auth, calls } = mockAuth();
    assert.equal((await resetPasswordWithToken(auth, token, newPassword)).status, 200);
    assert.deepEqual(calls, [
        ['verify', { token_hash: token, type: 'recovery' }],
        ['update', { password: newPassword }],
        ['signOut', { scope: 'local' }],
    ]);
});

test('a rejected password closes the consumed recovery session and directs the user to a new email', async () => {
    const { auth, calls } = mockAuth({ updateError: { code: 'same_password' } });
    const result = await resetPasswordWithToken(auth, token, newPassword);
    assert.equal(result.status, 400);
    assert.equal(result.invalidLink, true);
    assert.match(result.message, /不能与旧密码相同/);
    assert.equal(calls.at(-1)[0], 'signOut');
});

test('session cleanup failure does not misreport a successful password update', async () => {
    const { auth } = mockAuth({ cleanupFails: true });
    assert.equal((await resetPasswordWithToken(auth, token, newPassword)).status, 200);
});
