import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run against actual installed dependencies, without resolver hooks or network.
// Verifies the narrow override for GHSA-vcc3-ghjq-m6fr; upstream's scanner fix:
// https://github.com/SamVerschueren/decode-uri-component/commit/fa479da
// The version checks deliberately require another compatibility review when a
// parent changes. Usage: node scripts/decoder_compatibility.mjs [frontend-directory]
const frontend = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../frontend', import.meta.url)));
const stylesPackagePath = path.join(frontend, 'node_modules/rollup-styles/package.json');
assert.equal(JSON.parse(readFileSync(stylesPackagePath, 'utf8')).version, '1.5.0');
const stylesRequire = createRequire(stylesPackagePath);
const queryEntry = stylesRequire.resolve('query-string');
const queryPackagePath = path.join(path.dirname(queryEntry), 'package.json');
assert.equal(JSON.parse(readFileSync(queryPackagePath, 'utf8')).version, '8.2.0');
const queryRequire = createRequire(queryPackagePath);
const decoderEntry = queryRequire.resolve('decode-uri-component');
const decoderPackagePath = path.join(path.dirname(decoderEntry), 'package.json');
assert.equal(JSON.parse(readFileSync(decoderPackagePath, 'utf8')).version, '0.5.0');
const decoderUrl = pathToFileURL(decoderEntry).href;
const decode = (await import(decoderUrl)).default;
const qs = (await import(pathToFileURL(queryEntry).href)).default;

const examples = [
  ['', ''], ['plain text', 'plain text'], ['A%20B', 'A B'], ['%2B', '+'],
  ['%00', '\0'], ['%25', '%'], ['%C3%A5', '\u00e5'], ['%E2%82%AC', '\u20ac'],
  ['%F0%9F%98%80', '\u{1f600}'], ['%', '%'], ['%E0%A4%A', '%E0%A4%A'],
  ['%FE%FF', '\ufffd\ufffd'], ['%FF%FE', '\ufffd\ufffd'], ['%C2', '\ufffd'],
  ['%C2%B5%C2', '\u00b5\ufffd'], ['%ED%A0%80', '%ED%A0%80'],
  ['%F4%90%80%80', '%F4%90%80%80'], ['%C0%AF', '%C0%AF'], ['%EE%E9%41', '%EE%E9A'],
];
for (const [encoded, expected] of examples) assert.equal(decode(encoded), expected, encoded);
for (let byte = 0; byte < 256; byte++) {
  const encoded = `%${byte.toString(16).padStart(2, '0')}`;
  assert.equal(decode(encoded), byte < 128 ? String.fromCharCode(byte) : encoded, encoded);
}
assert.throws(() => decode(null), TypeError);
assert.deepEqual({...qs.parse('name=A%20B&unicode=%E2%82%AC&plus=a+b&literal=%2B&empty=&flag&repeat=1&repeat=2&bad=%E0%A4%A')}, {
  name: 'A B', unicode: '\u20ac', plus: 'a b', literal: '+', empty: '', flag: null,
  repeat: ['1', '2'], bad: '%E0%A4%A',
});

// Mirror the options used by rollup-styles' CSS import and asset URL resolvers.
// This is a query-string contract check, not a full production CSS build.
const opts = {parseFragmentIdentifier: true, sort: false, decode: false};
const parsed = qs.parseUrl('https://example.invalid/asset.svg?v=%E0%A4%A&name=A%20B#symbol', opts);
assert.deepEqual({...parsed.query}, {v: '%E0%A4%A', name: 'A%20B'});
assert.equal(parsed.fragmentIdentifier, 'symbol');
assert.equal(qs.stringifyUrl({url:'asset.svg',query:{v:'plain'}}, opts), 'asset.svg?v=plain');
assert.equal(qs.stringifyUrl({url:'https://example.invalid/asset.svg',query:{v:'plain'},fragmentIdentifier:'symbol'}, opts), 'https://example.invalid/asset.svg?v=plain#symbol');

// A child-process deadline makes a reintroduced pathological decoder fail the
// test instead of hanging CI. Never feed this larger case to the old decoder.
const large = spawnSync(process.execPath, ['--input-type=module', '-e',
  'const decode=(await import(process.argv[1])).default;const input="%EE%E9".repeat(32768);const out=decode(input);if(out!==input)throw Error("Malformed bytes changed");console.log(out.length);',
  decoderUrl], {encoding: 'utf8', timeout: 5000});
assert.ifError(large.error);
assert.equal(large.status, 0, large.stderr);
assert.equal(large.stdout.trim(), '196608');
console.log(JSON.stringify({passed:true, decodingCases:examples.length+256,
  queryString:true, encodedUrlOptions:true, boundedMalformedBytes:196608, networkRequests:0}));
