import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AccessGatesCards from './AccessGatesCards.svelte';

const press = (el: Element | null | undefined) => (el as HTMLElement).click();

describe('AccessGatesCards', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(value: object | null = null) {
    const onChange = vi.fn();
    app = mount(AccessGatesCards, { target, props: { isDiamond: true, value, onChange } });
    flushSync();
    return onChange;
  }
  const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

  test('switching All / Any reports the mode', () => {
    const onChange = open();
    press(target.querySelectorAll('[role=tab]')[1]);
    flushSync();
    expect(onChange).toHaveBeenCalled();
    expect(last(onChange).mode).toBe('Any');
  });

  test('turning the re-check on reports intervalOn with a numeric everyDays', () => {
    const onChange = open();
    press(target.querySelector('.recheck [role=switch]'));
    flushSync();
    const state = last(onChange);
    expect(state.intervalOn).toBe(true);
    expect(typeof state.everyDays).toBe('number');
    expect(state.everyDays).toBe(30);
  });

  test('picking an interval reports it in days', () => {
    const onChange = open({ intervalOn: true, everyDays: 30 });
    const radios = [...target.querySelectorAll('.recheck [role=radio]')];
    if (!radios.length) press(target.querySelector('.recheck [role=button]')); // collapsed: expand first
    flushSync();
    const choices = [...target.querySelectorAll<HTMLElement>('.recheck [role=radio]')];
    expect(choices.length).toBeGreaterThan(0);
    press(choices.find((c) => /3 months/i.test(c.textContent ?? '')));
    flushSync();
    expect(last(onChange)).toMatchObject({ intervalOn: true, everyDays: 90 });
  });

  test('starts from value', () => {
    const onChange = open({ mode: 'Any', intervalOn: true, everyDays: 7 });
    press(target.querySelectorAll('[role=tab]')[1]);
    flushSync();
    expect(last(onChange)).toMatchObject({ mode: 'Any', intervalOn: true, everyDays: 7 });
  });

  test('a payment gate is incomplete until it has a token and amount; "1,5" is stored as 1.5', () => {
    const onChange = vi.fn();
    const tokens = [{ id: 'ryjl3-tyaaa-aaaaa-aaaba-cai', symbol: 'ICP', name: 'Internet Computer', featured: true }];
    app = mount(AccessGatesCards, { target, props: { isDiamond: true, tokens, onChange } });
    flushSync();
    press(target.querySelector('.add'));
    flushSync();
    press([...document.querySelectorAll('.option')].find((o) => o.querySelector('.option-label')?.textContent === 'Payment'));
    flushSync();
    expect(last(onChange)).toMatchObject({ count: 1, complete: false });
    press(target.querySelector('.asset'));
    flushSync();
    const input = target.querySelector<HTMLInputElement>('.field input')!;
    input.value = '1,5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(last(onChange)).toMatchObject({ complete: true });
    expect(last(onChange).gates[0].a).toBe('1.5');
  });
});
