import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginUrl, safeReturnTo } from './return-to.ts';

test('sign-in returns to a local page while preserving its query and selected section', () => {
    const destinations = [
        '/',
        '/data-processing#paper-composition',
        '/research-skills?skill=Haojae%2Fscipilot-figure-skill#details',
        '/paper-formatting?journal=nature&tab=upload',
        '/software-plugins?plugin=published-1#downloads',
    ];
    for (const destination of destinations) assert.equal(safeReturnTo(destination), destination);
    assert.equal(safeReturnTo('/library/../data-processing?mode=xy#figure'), '/data-processing?mode=xy#figure');
    const chinese = new URL(safeReturnTo('/论文排版?name=测试#正文'), 'https://fesilent.invalid');
    assert.equal(decodeURIComponent(chinese.pathname), '/论文排版'); assert.equal(chinese.searchParams.get('name'), '测试'); assert.equal(decodeURIComponent(chinese.hash), '#正文');
});

test('external origins, protocol-relative links, scripts, and non-root relative links are rejected', () => {
    const unsafe = [
        'https://outside.example.test/research-skills',
        'https://fesilent.com/research-skills',
        'https://account:password@outside.example.test/path',
        '//outside.example.test/path',
        '///outside.example.test/path',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///private/document',
        'research-skills',
        '../software-plugins',
        ' /data-processing',
    ];
    for (const destination of unsafe) assert.equal(safeReturnTo(destination), '/', destination);
});

test('backslashes and every ASCII control character cannot reach a redirect destination', () => {
    for (const destination of ['/\\outside.example.test', '\\outside.example.test', '/data\\processing', '/software-plugins?file=\\package.zip']) assert.equal(safeReturnTo(destination), '/');
    for (const destination of ['/%5coutside.example.test', '/data%5Cprocessing', '/data%0aprocessing', '/data%7fprocessing', '/%2foutside.example.test', '/bad%ZZ']) assert.equal(safeReturnTo(destination), '/', destination);
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
        const character = String.fromCharCode(code);
        assert.equal(safeReturnTo(`/data-${character}processing`), '/', `control ${code}`);
        assert.equal(safeReturnTo(`/software-plugins?name=${character}tool`), '/', `query control ${code}`);
    }
});

test('login and callback destinations cannot send the user back through the authentication flow', () => {
    const authPaths = [
        '/login', '/login?next=%2Fresearch-skills', '/login#form',
        '/auth/callback', '/auth/callback?code=example',
        '/elsewhere/../login', '/auth/temporary/../callback',
        '/login/', '/login/?next=%2Flogin', '/log%69n',
        '/auth/callback/', '/auth/%63allback?code=example',
    ];
    for (const destination of authPaths) assert.equal(safeReturnTo(destination), '/', destination);
});

test('missing, malformed and excessively long input use a caller-provided local fallback', () => {
    const fallback = '/data-processing#paper-composition';
    for (const value of [undefined, null, false, 0, {}, [], '', '/' + 'a'.repeat(2048)]) assert.equal(safeReturnTo(value, fallback), fallback);
    const limit = '/' + 'a'.repeat(2047); assert.equal(safeReturnTo(limit), limit);
});

test('the login link safely encodes the complete destination as one next parameter', () => {
    const destination = '/research-skills?skill=owner%2Frepo&tab=介绍#details';
    const link = new URL(loginUrl(destination), 'https://fesilent.invalid');
    assert.equal(link.pathname, '/login');
    assert.deepEqual([...link.searchParams.keys()], ['next']);
    assert.equal(link.searchParams.get('next'), safeReturnTo(destination));
    assert.equal(link.hash, '');
    for (const unsafe of ['https://outside.example.test', '//outside.example.test', '/login?next=%2Flogin']) assert.equal(new URL(loginUrl(unsafe), 'https://fesilent.invalid').searchParams.get('next'), '/');
});
