import { expect, test } from 'vitest';
import { referralCode } from './referral';

test('reads the ref parameter of an invite link, with or without a scheme', () => {
  expect(referralCode('https://oc.app/?ref=abc-123')).toBe('abc-123');
  expect(referralCode('oc.app/?ref=abc-123')).toBe('abc-123');
  expect(referralCode('  https://oc.app/community/x?code=1&ref=abc#top ')).toBe('abc');
  expect(referralCode('https://oc.app/?ref=a%2Db')).toBe('a-b');
});

test('is undefined for text without a referrer in it', () => {
  expect(referralCode('lucy')).toBe(undefined);
  expect(referralCode('https://oc.app/?referrer=abc')).toBe(undefined);
  expect(referralCode('https://oc.app/?ref=')).toBe(undefined);
  expect(referralCode('https://oc.app/?ref=%E0%A4%A')).toBe(undefined);
});
