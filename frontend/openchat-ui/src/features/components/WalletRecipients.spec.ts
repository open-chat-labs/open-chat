import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WalletRecipients, { type Recipient } from './WalletRecipients.svelte';

const deferred = () => {
  let resolve!: (v?: unknown) => void, reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};
const people: Recipient[] = [
  { id: 'a', name: 'Aaa', address: '5sj6i-pqaaa-aaaaf-a3cmq-cai', token: null },
  { id: 'b', name: 'Bbb', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', token: null },
  { id: 'c', name: 'Ccc', address: '0x7Bf3c9A1e64D25aB8f0C3e7d19A4b62F5dE81Ca0', token: null },
];

describe('WalletRecipients', () => {
  let target: HTMLElement;
  let app: object | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    target.remove();
    vi.useRealTimers();
  });

  const names = () => [...target.querySelectorAll('.row .name')].map((n) => n.textContent);
  const row = (name: string) => [...target.querySelectorAll<HTMLElement>('.row')].find((r) => r.querySelector('.name')?.textContent === name)!;
  function remove(name: string) {
    (row(name).querySelector('.options') as HTMLElement).click();
    flushSync();
    (row(name).querySelector('.menu-item.danger') as HTMLElement).click();
    flushSync();
    (row(name).querySelector('.remove') as HTMLElement).click();
    flushSync();
  }

  test('a failed remove puts back only that row, where it was, and shows an error', async () => {
    const calls: Record<string, ReturnType<typeof deferred>> = { a: deferred(), b: deferred() };
    app = mount(WalletRecipients, { target, props: { tokens: [], recipients: people, onRemove: (id: string) => calls[id].promise } });
    flushSync();
    remove('Aaa');
    remove('Bbb');
    expect(names()).toEqual(['Ccc']);
    calls.b.resolve(); // the host removed B
    await settle();
    calls.a.reject(new Error('no')); // A failed later
    await settle();
    expect(names()).toEqual(['Aaa', 'Ccc']);
    expect(target.querySelector('[role=alert]')).not.toBeNull();
  });

  test('a save is sent once while pending, and the form stays with an error if it fails', async () => {
    const d = deferred();
    const onAdd = vi.fn(() => d.promise as Promise<Recipient>);
    app = mount(WalletRecipients, { target, props: { tokens: [], recipients: [], onAdd } });
    flushSync();
    (target.querySelector('.add') as HTMLElement).click();
    flushSync();
    const address = target.querySelector<HTMLTextAreaElement>('.address-input')!;
    address.value = '5sj6i-pqaaa-aaaaf-a3cmq-cai';
    address.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    const save = target.querySelector('.save') as HTMLElement;
    save.click();
    save.click();
    await settle();
    expect(onAdd).toHaveBeenCalledOnce();
    d.reject(new Error('no'));
    await settle();
    expect(target.querySelector('.form')).not.toBeNull();
    expect(target.querySelector('[role=alert]')).not.toBeNull();
  });
});
