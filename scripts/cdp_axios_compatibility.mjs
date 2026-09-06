import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run against the installed dependency tree. No resolver hooks, credentials from
// the environment, external requests, or persistent test keys are used.
// Verifies the version-scoped security override while this SDK pins Axios 1.16.0.
// Advisory: https://github.com/axios/axios/security/advisories/GHSA-gcfj-64vw-6mp9
// Usage: node scripts/cdp_axios_compatibility.mjs [frontend-directory]
const frontend = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../frontend', import.meta.url)));
const sdkPackagePath = path.join(frontend, 'node_modules/@coinbase/cdp-sdk/package.json');
const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, 'utf8'));
assert.equal(sdkPackage.version, '1.52.0', 'Review compatibility again when the parent SDK changes');
const sdkRequire = createRequire(sdkPackagePath);
const axiosPackagePath = sdkRequire.resolve('axios/package.json');
const axiosUrl = pathToFileURL(path.join(path.dirname(axiosPackagePath), 'index.js')).href;
const sdkUrl = pathToFileURL(path.join(frontend, 'node_modules/@coinbase/cdp-sdk/_esm/')).href;

const { default: axios, AxiosError } = await import(axiosUrl);
assert.equal(axios.VERSION, '1.18.1');
const sdk = await import(new URL('openapi-client/cdpApiClient.js', sdkUrl));
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
sdk.configure({
  basePath: 'https://example.invalid/platform',
  apiKeyId: 'local-compatibility-test-only',
  apiKeySecret: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});
const instance = sdk.getAxiosInstance();
const seen = [];
instance.defaults.adapter = async config => {
  seen.push(config);
  return { status: 200, statusText: 'OK', headers: {}, config, data: '{"ok":true}' };
};
const data = await sdk.cdpApiClient({
  url: '/compatibility-probe',
  method: 'POST',
  data: { amount: 15n, nested: { values: [20n] } },
  headers: { 'X-User-Header': 'preserved' },
}, 'local-idempotency-key');
assert.deepEqual(data, { ok: true });
assert.equal(seen.length, 1);
assert.equal(seen[0].baseURL, 'https://example.invalid/platform');
assert.equal(seen[0].url, '/compatibility-probe');
assert.equal(seen[0].headers.get('X-Idempotency-Key'), 'local-idempotency-key');
assert.equal(seen[0].headers.get('X-User-Header'), 'preserved');
assert.equal(seen[0].headers.get('Content-Type'), 'application/json');
assert.deepEqual(JSON.parse(seen[0].data), { amount: '15', nested: { values: ['20'] } });
const auth = seen[0].headers.get('Authorization');
assert.match(auth, /^Bearer /);
const jwtPayload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url'));
assert.deepEqual(jwtPayload.uris, ['POST example.invalid/platform/compatibility-probe']);

instance.defaults.adapter = async config => {
  throw new AxiosError('getaddrinfo ENOTFOUND', 'ENOTFOUND', config);
};
await assert.rejects(
  sdk.cdpApiClient({ url: '/compatibility-probe', method: 'GET', 'axios-retry': { retries: 0 } }),
  error => error.name === 'NetworkError' && error.errorType === 'network_dns_failure',
);

instance.defaults.adapter = async config => {
  throw new AxiosError('conflict', 'ERR_BAD_REQUEST', config, undefined, {
    status: 409, statusText: 'Conflict', config, headers: {},
    data: { errorType: 'already_exists', errorMessage: 'conflict' },
  });
};
await assert.rejects(
  sdk.cdpApiClient({ url: '/compatibility-probe', method: 'POST', 'axios-retry': { retries: 0 } }),
  error => error.name === 'APIError' && error.statusCode === 409 && error.errorType === 'already_exists',
);

let attempts = 0;
instance.defaults.adapter = async config => {
  attempts++;
  if (attempts === 1) {
    throw new AxiosError('retryable', 'ERR_BAD_RESPONSE', config, undefined, {
      status: 503, statusText: 'Unavailable', config, headers: {}, data: '',
    });
  }
  return { status: 200, statusText: 'OK', headers: {}, config, data: '{"retried":true}' };
};
assert.deepEqual(await sdk.cdpApiClient({
  url: '/compatibility-probe', method: 'GET', 'axios-retry': { retries: 1, retryDelay: () => 0 },
}), { retried: true });
assert.equal(attempts, 2);
console.log(JSON.stringify({
  passed: true, sdk: sdkPackage.version, axios: axios.VERSION,
  checks: ['JWT signing path', 'bigint JSON', 'idempotency and user headers', 'JSON response',
    'network error mapping', 'API error mapping', 'retry integration'],
  networkRequests: 0, credentials: 'ephemeral local test key only',
}));
