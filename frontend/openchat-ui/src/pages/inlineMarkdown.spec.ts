import { describe, expect, test } from 'vitest';
import { imageOf, inlineMarkdown, plainText, safeHref, searchText } from './inlineMarkdown';

describe('inline markdown', () => {
  test('splits a line into text, links, bold and code, in order', () => {
    expect(inlineMarkdown('See [the FAQ](/faq?q=airdrop) for **why**, or run `dfx info`.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'the FAQ', href: '/faq?q=airdrop' },
      { kind: 'text', text: ' for ' },
      { kind: 'bold', text: 'why' },
      { kind: 'text', text: ', or run ' },
      { kind: 'code', text: 'dfx info' },
      { kind: 'text', text: '.' },
    ]);
  });

  test('plain text is one part, and an empty line none', () => {
    expect(inlineMarkdown('Nothing to see')).toEqual([{ kind: 'text', text: 'Nothing to see' }]);
    expect(inlineMarkdown('')).toEqual([]);
  });

  test('a link with parentheses in its address keeps them', () => {
    expect(inlineMarkdown('[ICP](https://en.wikipedia.org/wiki/ICP_(blockchain))')).toEqual([
      { kind: 'link', text: 'ICP', href: 'https://en.wikipedia.org/wiki/ICP_(blockchain)' },
    ]);
  });

  test("a link that can't be followed safely is only its text", () => {
    expect(inlineMarkdown('[click](javascript:alert(1)) here')).toEqual([{ kind: 'text', text: 'click here' }]);
    expect(safeHref('//evil.example')).toBe(false);
    expect(['https://oc.app', 'mailto:a@b.c', '/home', '#top'].every(safeHref)).toBe(true);
  });

  test('unclosed markers stay as they are', () => {
    expect(plainText('2 ** 3 and a `tick')).toBe('2 ** 3 and a `tick');
  });

  test('plain text drops the markup, for searching', () => {
    expect(plainText('Stake **CHAT** in [a neuron](https://nns.ic0.app)')).toBe('Stake CHAT in a neuron');
  });
});

describe('an image paragraph', () => {
  test('is a paragraph that is only an image', () => {
    expect(imageOf('![The new sign-in](/assets/blog/signin.png)')).toEqual({ alt: 'The new sign-in', src: '/assets/blog/signin.png' });
    expect(imageOf('See ![x](/a.png) here')).toBeNull();
  });

  test('takes web and relative sources, not script ones', () => {
    expect(imageOf('![a](https://oc.app/a.png)')).not.toBeNull();
    expect(imageOf('![a](assets/a.png)')).not.toBeNull();
    expect(imageOf('![a](javascript:x)')).toBeNull();
  });
});

describe('the searchable text', () => {
  test('is the words without markup, leaving out image paragraphs (their alt text and source)', () => {
    const answer = 'Use **Suggest** in the [menu](/faq).\n\n![Correcting a translation](/assets/screenshots/translation_correction.png)';
    expect(searchText(answer)).toBe('Use Suggest in the menu.');
  });
});

