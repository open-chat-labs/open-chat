// Which network an address belongs to, read off its own shape. Shared by Send and saved recipients so an address
// saved as valid is judged the same way when sending.
export type AddressNetwork = 'BTC' | 'ETH' | 'XRP' | 'ICP';

const TESTS: [AddressNetwork, RegExp][] = [
  ['BTC', /^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/],
  ['ETH', /^0x[0-9a-fA-F]{40}$/],
  ['XRP', /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/],
  // textual principal (groups of 5, shorter last group) or a 64-hex account identifier
  ['ICP', /^([a-z0-9]{5}-){2,10}[a-z0-9]{1,5}$|^[0-9a-f]{64}$/],
];

/** null for an empty address, 'unknown' when no network matches. */
export function detectNetwork(address: string): AddressNetwork | 'unknown' | null {
  const v = (address || '').trim();
  if (!v) return null;
  return TESTS.find(([, re]) => re.test(v))?.[0] ?? 'unknown';
}
