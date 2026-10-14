import { describe, expect, test } from 'vitest';
import { detectNetwork } from './networks';

describe('detectNetwork', () => {
  test.each([
    ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC'],
    ['1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'BTC'],
    ['0x4E2a9F07c1B3dD58e7A9b2c06F1d3E8a5C7b9D21', 'ETH'],
    ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', 'XRP'],
    ['5sj6i-pqaaa-aaaaf-a3cmq-cai', 'ICP'],
    ['6fe2b-qpkus-3dzpo-iuc7d-nwyfk-7tqaf-2lhi4-cpm5c-ys7gz-wbf3a-dae', 'ICP'],
    ['a'.repeat(64), 'ICP'],
  ])('%s is %s', (address, network) => expect(detectNetwork(address)).toBe(network));

  test('trims whitespace', () => expect(detectNetwork('  5sj6i-pqaaa-aaaaf-a3cmq-cai \n')).toBe('ICP'));
  test('empty is null', () => expect(detectNetwork('   ')).toBeNull());
  test.each(['hello', '0x123', 'bc1short', '5sj6i'])('%s is unknown', (address) => expect(detectNetwork(address)).toBe('unknown'));
});
