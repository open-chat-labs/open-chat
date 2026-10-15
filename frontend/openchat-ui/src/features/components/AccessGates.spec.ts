import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AccessGates from './AccessGates.svelte';

const press = (el: Element | null | undefined) => (el as HTMLElement).click();
const TOKENS = [{ id: 'ryjl3-tyaaa-aaaaa-aaaba-cai', symbol: 'ICP', name: 'Internet Computer', featured: true }];
const PAID = { id: 'r1', type: 'payment', asset: TOKENS[0].id, a: '2', b: '' };

describe('AccessGates', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
    document.body.innerHTML = '';
  });

  function open(props: Record<string, unknown> = {}) {
    const onChange = vi.fn();
    app = mount(AccessGates, {
      target,
      props: { isDiamond: true, tokens: TOKENS, onChange, ...props },
    });
    flushSync();
    return onChange;
  }
  const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];
  function addPayment() {
    press(target.querySelector('.add'));
    flushSync();
    press([...document.querySelectorAll('.option')].find((o) => o.textContent?.includes('Payment')));
    flushSync();
  }
  function typeAmount(text: string) {
    const input = target.querySelector<HTMLInputElement>('.field input')!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    return input;
  }

  test('a gate missing its token or amount is reported incomplete', () => {
    const onChange = open();
    addPayment();
    expect(last(onChange)).toMatchObject({ count: 1, complete: false });
    press(target.querySelector('.asset'));
    flushSync();
    expect(last(onChange).complete).toBe(false);
    typeAmount('2');
    expect(last(onChange)).toMatchObject({ count: 1, complete: true });
  });

  test('"," is a decimal mark: 1,5 is stored as 1.5, not 15', () => {
    const onChange = open();
    addPayment();
    const input = typeAmount('1,5');
    expect(last(onChange).rules[0].a).toBe('1.5');
    expect(input.value).toBe('1.5');
    typeAmount('1.5.2');
    expect(last(onChange).rules[0].a).toBe('1.52');
  });

  test('without Diamond, gates the group already has are shown and can be removed, but not edited or added to', () => {
    const onChange = open({ isDiamond: false, value: { rules: [PAID] } });
    expect(target.textContent).toContain('2 ICP');
    expect(target.querySelector('.banner')).not.toBeNull();
    expect(target.querySelector('.add')).toBeNull();
    expect(target.querySelector('.tool[aria-label="Edit"]')).toBeNull();
    press(target.querySelector('.tool[aria-label="Remove"]'));
    flushSync();
    expect(last(onChange)).toMatchObject({ count: 0, rules: [] });
    // nothing left: the explainer
    expect(target.textContent).toContain('WHAT ARE ACCESS GATES');
  });

  test('without Diamond and without gates: the explainer and upgrade banner', () => {
    open({ isDiamond: false });
    expect(target.textContent).toContain('WHAT ARE ACCESS GATES');
    expect(target.querySelector('.banner')).not.toBeNull();
  });
});
