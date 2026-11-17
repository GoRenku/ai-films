import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOOKMARK_SCOPES, CALLBACK, authorizationRequest, exchangeToken, bookmarkCredentials, bookmarkAuthStatus } from './x-bookmark-auth.mjs';

test('authorization uses PKCE, unpredictable state and only read/renewal scopes', () => {
  const a = authorizationRequest('fixture');
  const b = authorizationRequest('fixture');
  const url = new URL(a.url);
  assert.equal(url.searchParams.get('redirect_uri'), CALLBACK);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(a.verifier).digest('base64url'));
  assert.notEqual(a.state, b.state);
  assert.deepEqual(url.searchParams.get('scope').split(' '), BOOKMARK_SCOPES);
  assert.equal(BOOKMARK_SCOPES.some(s => s.endsWith('.write')), false);
});

test('exchanges public and confidential client tokens without putting secrets in URLs', async () => {
  for (const confidential of [false, true]) {
    await exchangeToken({grant_type:'refresh_token', refresh_token:'fixture-refresh'}, {
      env: {X_OAUTH_CLIENT_ID:'fixture-id', ...(confidential ? {X_OAUTH_CLIENT_SECRET:'fixture-secret'} : {})},
      request: async (url, options) => {
        assert.equal(url, 'https://api.x.com/2/oauth2/token');
        assert.equal(options.body.get('refresh_token'), 'fixture-refresh');
        assert.equal(options.body.has('client_id'), !confidential);
        assert.equal(Boolean(options.headers.Authorization), confidential);
        return Response.json({access_token:'fixture-token', expires_in:7200});
      }
    });
  }
});

test('renews privately, saves rotated refresh token, and reuses a valid token', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'lm-auth-test-'));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  const file = join(dir, 'x-bookmark-auth.json');
  writeFileSync(file, JSON.stringify({user_id:'123', access_token:'old', refresh_token:'old-refresh', expires_at:0, scope:BOOKMARK_SCOPES.join(' ')}));
  process.env.X_OAUTH_CLIENT_ID = 'fixture-id';
  t.after(() => delete process.env.X_OAUTH_CLIENT_ID);
  let calls = 0;
  const request = async () => {
    calls++;
    return Response.json({access_token:'renewed', refresh_token:'rotated', expires_in:7200});
  };
  assert.equal((await bookmarkCredentials(dir, {request})).accessToken, 'renewed');
  assert.equal(JSON.parse(readFileSync(file)).refresh_token, 'rotated');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal((await bookmarkCredentials(dir, {request})).userId, '123');
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(bookmarkAuthStatus(dir)).includes('rotated'), false);
});

test('missing authorization and provider failures do not expose token response bodies', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'lm-auth-test-'));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  await assert.rejects(bookmarkCredentials(dir), /authorization is incomplete/);
  await assert.rejects(exchangeToken({}, {env:{X_OAUTH_CLIENT_ID:'fixture'}, request:async()=>new Response('private-detail', {status:401})}), error => !error.message.includes('private-detail'));
});
