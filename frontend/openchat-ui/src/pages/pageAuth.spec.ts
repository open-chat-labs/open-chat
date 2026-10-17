import { describe, expect, test, vi } from 'vitest';
import { PageAuthState, type PageAuth } from './pageAuth.svelte';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('PageAuthState', () => {
  function setup(auth: PageAuth) {
    const onEnterApp = vi.fn();
    const state = new PageAuthState(() => ({ auth, onEnterApp, appHref: '/home' }));
    return { state, onEnterApp, method: () => state.dialog.onMethod!('passkey', 'login') };
  }

  test("the dialog's callbacks are the same functions on every read", () => {
    const { state } = setup({ onMethod: () => Promise.resolve(), onSignup: () => Promise.resolve() });
    const first = state.dialog;
    state.open('signup');
    const second = state.dialog;
    expect(second.kind).toBe('signup');
    expect(second.onMethod).toBe(first.onMethod);
    expect(second.onSignup).toBe(first.onSignup);
    expect(second.onClose).toBe(first.onClose);
  });

  test('attempts started before the page entered enter it once, even if the dialog was closed meanwhile', async () => {
    const attempts = [deferred(), deferred()];
    const { state, onEnterApp, method } = setup({ onMethod: vi.fn().mockReturnValueOnce(attempts[0].promise).mockReturnValueOnce(attempts[1].promise) });
    state.open('login');
    const first = method();
    state.close();
    state.open('login');
    const second = method();
    attempts[0].resolve();
    await first;
    expect([onEnterApp.mock.calls.length, state.kind]).toEqual([1, null]);
    attempts[1].resolve();
    await second;
    expect(onEnterApp).toHaveBeenCalledOnce();
  });

  test('after entering, a new sign-in (the page kept mounted, after a sign-out) enters again and closes its dialog', async () => {
    const late = deferred();
    const onMethod = vi.fn().mockReturnValueOnce(Promise.resolve()).mockReturnValueOnce(late.promise).mockReturnValueOnce(Promise.resolve());
    const { state, onEnterApp, method } = setup({ onMethod });
    state.open('login');
    await method();
    // an extra attempt from the first sign-in, still out
    const stale = method();
    expect(onEnterApp).toHaveBeenCalledTimes(1);
    state.open('login');
    await method();
    expect([onEnterApp.mock.calls.length, state.kind]).toEqual([2, null]);
    // the first sign-in's late result neither enters again nor touches a newer dialog
    state.open('login');
    late.resolve();
    await stale;
    expect([onEnterApp.mock.calls.length, state.kind]).toEqual([2, 'login']);
  });
  test("Open app enters through the host on a plain click, and leaves a modified one to the link", () => {
    const { state, onEnterApp } = setup({});
    const click = (init: MouseEventInit = {}) => {
      const e = new MouseEvent('click', { cancelable: true, button: 0, ...init });
      state.openApp(e);
      return e.defaultPrevented;
    };
    expect(click({ metaKey: true })).toBe(false);
    expect(click({ button: 1 })).toBe(false);
    expect(onEnterApp).not.toHaveBeenCalled();
    expect(click()).toBe(true);
    expect(onEnterApp).toHaveBeenCalledOnce();
  });
});
