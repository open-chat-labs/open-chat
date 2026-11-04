import { describe, expect, test } from 'vitest';
import { LANGUAGES, NO_FLAG, languageFlag } from './languages';

describe('languageFlag', () => {
  test('reads a code, with or without a region', () => {
    expect(languageFlag('pt')).toBe('🇵🇹');
    expect(languageFlag('pt-BR')).toBe('🇵🇹');
    expect(languageFlag('zh_CN')).toBe('🇨🇳');
    expect(languageFlag('EN')).toBe('🇬🇧');
  });

  test('reads the older codes a host may still use', () => {
    expect(languageFlag('cn')).toBe(languageFlag('zh'));
    expect(languageFlag('jp')).toBe(languageFlag('ja'));
    expect(languageFlag('iw')).toBe(languageFlag('he'));
    expect(languageFlag('iw')).not.toBe(NO_FLAG);
  });

  test("reads a language's own name and the library's English key", () => {
    expect(languageFlag('Português')).toBe('🇵🇹');
    expect(languageFlag('日本語')).toBe('🇯🇵');
    expect(languageFlag('ui.exploreCommunities.english')).toBe('🇬🇧');
  });

  test('is the white flag for a language it has no flag for', () => {
    expect(languageFlag('xx')).toBe(NO_FLAG);
    expect(languageFlag('Klingon')).toBe(NO_FLAG);
    expect(languageFlag('')).toBe(NO_FLAG);
  });

  test('every listed language has a flag of its own', () => {
    expect(LANGUAGES.filter((l) => languageFlag(l.code) === NO_FLAG)).toEqual([]);
  });
});
