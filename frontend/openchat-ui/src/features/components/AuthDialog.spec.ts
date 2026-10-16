import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AuthDialog from './AuthDialog.svelte';

const deferred = () => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};

describe('AuthDialog: one host call at a time', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
    vi.useRealTimers();
  });

  function open(props: Record<string, unknown>) {
    app = mount(AuthDialog, { target, props: { inline: true, ...props } });
    flushSync();
  }
  const q = <T extends Element = HTMLElement>(sel: string) => target.querySelector<T & HTMLElement>(sel);
  const typeInto = (input: HTMLInputElement | null, value: string) => {
    input!.value = value;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  };
  const submit = (form: HTMLFormElement | null) => {
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();
  };
  const switchMode = () => {
    q('.switch-cta')!.click();
    flushSync();
  };

  test('switching mode while a sign-up is pending cannot start a second one', async () => {
    const d = deferred();
    const onSignup = vi.fn(() => d.promise);
    open({ kind: 'signup', onSignup });
    typeInto(q<HTMLInputElement>('input[autocomplete=username]'), 'newperson1');
    submit(q<HTMLFormElement>('form.form'));
    expect(onSignup).toHaveBeenCalledOnce();
    // Sign in → Create account → Continue, all while the first sign-up is still with the host
    switchMode();
    switchMode();
    expect(q('.switch-cta')!.hasAttribute('disabled')).toBe(true);
    const form = q<HTMLFormElement>('form.form');
    if (form) submit(form);
    await settle();
    expect(onSignup).toHaveBeenCalledOnce();
    d.resolve();
    await settle();
    expect(q('.switch-cta')!.hasAttribute('disabled')).toBe(false);
  });

  test('a method that is pending blocks the email link (and a second method)', async () => {
    const d = deferred();
    const onMethod = vi.fn(() => d.promise);
    const onRequestEmailLink = vi.fn(() => Promise.resolve());
    open({ kind: 'login', onMethod, onRequestEmailLink });
    q('.passkey')!.click();
    flushSync();
    // switching to sign-up and back must not clear the pending state either
    switchMode();
    switchMode();
    typeInto(q<HTMLInputElement>('form.email input'), 'me@example.com');
    submit(q<HTMLFormElement>('form.email'));
    q('.passkey')!.click();
    await settle();
    expect(onMethod).toHaveBeenCalledOnce();
    expect(onRequestEmailLink).not.toHaveBeenCalled();
    d.reject(new Error('cancelled'));
    await settle();
    // after it settles the user can try again
    q('.passkey')!.click();
    await settle();
    expect(onMethod).toHaveBeenCalledTimes(2);
  });

  test('Back from "Check your inbox" waits for a pending resend', async () => {
    let call = 0;
    const second = deferred();
    const onRequestEmailLink = vi.fn(() => (++call === 1 ? Promise.resolve() : second.promise));
    const onMethod = vi.fn(() => Promise.resolve());
    open({ kind: 'login', onMethod, onRequestEmailLink });
    typeInto(q<HTMLInputElement>('form.email input'), 'me@example.com');
    submit(q<HTMLFormElement>('form.email'));
    await settle();
    expect(target.textContent).toContain('Check your inbox');
    q('.sent .link')!.click(); // resend, pending
    flushSync();
    const back = target.querySelector<HTMLButtonElement>('.head-button[aria-label="Back"]')!;
    back.click();
    flushSync();
    expect(target.textContent).toContain('Check your inbox');
    expect(back.disabled).toBe(true);
    second.resolve();
    await settle();
    back.click();
    flushSync();
    q('.passkey')!.click();
    await settle();
    expect(onMethod).toHaveBeenCalledOnce();
  });
});

describe('AuthDialog: what the host offers', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
    vi.useRealTimers();
  });

  function open(props: Record<string, unknown>) {
    app = mount(AuthDialog, { target, props: { inline: true, ...props } });
    flushSync();
  }
  const q = <T extends Element = HTMLElement>(sel: string) => target.querySelector<T & HTMLElement>(sel);
  const typeInto = (input: HTMLInputElement | null, value: string) => {
    input!.value = value;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  };
  const labels = (sel: string) => [...target.querySelectorAll(sel)].map((el) => el.textContent!.trim());

  test('offers only the methods it is given', () => {
    open({ kind: 'login', methods: ['email', 'ii'], onMethod: vi.fn() });
    expect(q('.passkey')).toBeNull();
    expect(q('.or')).toBeNull();
    expect(q('form.email')).not.toBeNull();
    expect(labels('.tile-label')).toEqual(['Internet ID']);
  });

  test('asks which wallet, then passes it on', async () => {
    const onMethod = vi.fn(() => Promise.resolve());
    open({ kind: 'login', onMethod, wallets: { eth: [{ id: 'metaMask', name: 'MetaMask' }, { id: 'walletConnect', name: 'WalletConnect' }] } });
    q('.tile[title="Sign in with Ethereum"]')!.click();
    flushSync();
    expect(onMethod).not.toHaveBeenCalled();
    expect(labels('.option .method-label')).toEqual(['MetaMask', 'WalletConnect']);
    [...target.querySelectorAll<HTMLButtonElement>('.option')][1].click();
    await settle();
    expect(onMethod).toHaveBeenCalledWith('eth', 'login', 'walletConnect');
  });

  test('a method without a wallet list starts straight away', async () => {
    const onMethod = vi.fn(() => Promise.resolve());
    open({ kind: 'login', onMethod, wallets: { eth: [{ id: 'metaMask', name: 'MetaMask' }] } });
    q('.tile[title="Sign in with Solana"]')!.click();
    await settle();
    expect(onMethod).toHaveBeenCalledWith('sol', 'login');
  });

  test('shows the code the sent link goes with', async () => {
    open({ kind: 'login', onRequestEmailLink: () => Promise.resolve({ code: '123' }) });
    typeInto(q<HTMLInputElement>('form.email input'), 'me@example.com');
    q<HTMLFormElement>('form.email')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(q('.sent .code')!.textContent).toBe('123');
  });

  test("a link's page sends the code once three digits are in, and says what came of it", async () => {
    const onLinkCode = vi.fn().mockResolvedValueOnce('expired').mockResolvedValueOnce('elsewhere');
    open({ kind: 'link', onLinkCode });
    expect(q('.switch')).toBeNull();
    typeInto(q<HTMLInputElement>('.code-input'), '12');
    expect(onLinkCode).not.toHaveBeenCalled();
    typeInto(q<HTMLInputElement>('.code-input'), '123');
    await settle();
    expect(onLinkCode).toHaveBeenCalledWith('123');
    expect(q('[role=alert]')!.textContent).toContain('expired');
    typeInto(q<HTMLInputElement>('.code-input'), '456');
    await settle();
    expect(q('.sent-title')!.textContent).toBe('You’re signed in');
    expect(target.textContent).toContain('Close this page');
  });

  test('lists the other methods in the order given', () => {
    open({ kind: 'login', methods: ['passkey', 'email', 'sol', 'ii'], onMethod: vi.fn() });
    expect(labels('.tile-label')).toEqual(['Solana', 'Internet ID']);
  });

  test('prefills the sign-in email, and keeps sign-up’s recovery email apart', async () => {
    const onSignup = vi.fn(() => Promise.resolve());
    open({ kind: 'login', email: 'me@example.com', onSignup });
    expect(q<HTMLInputElement>('form.email input')!.value).toBe('me@example.com');
    q('.switch-cta')!.click();
    flushSync();
    expect(q<HTMLInputElement>('input[autocomplete=email]')!.value).toBe('');
    typeInto(q<HTMLInputElement>('input[autocomplete=username]'), 'newperson1');
    q<HTMLFormElement>('form.form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(onSignup).toHaveBeenCalledWith(expect.objectContaining({ email: undefined }));
  });

  test('prefills the referrer, who can be removed before signing up', async () => {
    const onSignup = vi.fn(() => Promise.resolve());
    open({ kind: 'signup', referrer: { userId: 'r1', name: 'Hamish', handle: 'hamish', grad: 'red' }, onSignup });
    expect(q('.field.picked .who')!.textContent).toContain('Hamish');
    q('.field.picked .clear')!.click();
    flushSync();
    expect(q('.field.picked')).toBeNull();
    typeInto(q<HTMLInputElement>('input[autocomplete=username]'), 'newperson1');
    q<HTMLFormElement>('form.form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(onSignup).toHaveBeenCalledWith(expect.objectContaining({ referrerId: undefined }));
  });

  test('says why a sign-up failed when the host does', async () => {
    open({ kind: 'signup', onSignup: () => Promise.reject({ reason: 'That username is already taken' }) });
    typeInto(q<HTMLInputElement>('input[autocomplete=username]'), 'newperson1');
    q<HTMLFormElement>('form.form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(q('.signup-error')!.textContent).toBe('That username is already taken');
  });

  test('a failure without a reason gets the generic line', async () => {
    open({ kind: 'signup', onSignup: () => Promise.reject(new Error('boom')) });
    typeInto(q<HTMLInputElement>('input[autocomplete=username]'), 'newperson1');
    q<HTMLFormElement>('form.form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(q('.signup-error')!.textContent).toBe('Couldn’t create your account. Try again.');
  });

  test('leaving "Check your inbox" tells the host, by Back or by closing', async () => {
    const onCancelEmailLink = vi.fn();
    const onClose = vi.fn();
    open({ kind: 'login', onRequestEmailLink: () => Promise.resolve(), onCancelEmailLink, onClose });
    const send = async () => {
      typeInto(q<HTMLInputElement>('form.email input'), 'me@example.com');
      q<HTMLFormElement>('form.email')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    };
    await send();
    q('.head-button[aria-label="Back"]')!.click();
    flushSync();
    expect(onCancelEmailLink).toHaveBeenCalledOnce();
    await send();
    q('.head-button[aria-label="Close"]')!.click();
    expect(onCancelEmailLink).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('closing from the methods has no link to cancel', () => {
    const onCancelEmailLink = vi.fn();
    open({ kind: 'login', onCancelEmailLink, onClose: vi.fn() });
    q('.head-button[aria-label="Close"]')!.click();
    expect(onCancelEmailLink).not.toHaveBeenCalled();
  });

  test("a link's code the host rejects reads as invalid", async () => {
    open({ kind: 'link', onLinkCode: () => Promise.reject(new Error('network')) });
    typeInto(q<HTMLInputElement>('.code-input'), '123');
    await settle();
    expect(q('[role=alert]')!.textContent).toContain('Check the code');
  });
});
