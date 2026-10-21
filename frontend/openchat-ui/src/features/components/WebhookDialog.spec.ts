import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WebhookDialog from './WebhookDialog.svelte';

const deferred = <T = void>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};
const press = (el: Element | null) => (el as HTMLElement).click();
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

const webhook = { id: 'wh-1', name: 'ci_builds', url: 'https://oc.app/webhook/x/old', color: 'blue' as const };

describe('WebhookDialog', () => {
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
    const onCancel = vi.fn();
    app = mount(WebhookDialog, { target, props: { groupName: 'Devs', onCancel, ...props } });
    flushSync();
    return { onCancel, layer: target.querySelector('.layer')! };
  }
  const primary = () => target.querySelector('.primary');
  const typeName = (v: string) => {
    const input = target.querySelector('input:not(.file)') as HTMLInputElement;
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  };

  test('register saves once (no id); nothing dismisses while saving', async () => {
    const d = deferred();
    const onSave = vi.fn(() => d.promise);
    const { onCancel, layer } = open({ onSave });
    typeName('alerts');
    press(primary());
    press(primary());
    await settle();
    esc();
    press(target.querySelector('.oc-veil'));
    press(target.querySelector('.secondary'));
    await vi.runAllTimersAsync();
    expect(onSave).toHaveBeenCalledOnce();
    expect((onSave.mock.calls[0] as unknown[])[0]).toMatchObject({ id: undefined, name: 'alerts', avatar: null });
    expect(onCancel).not.toHaveBeenCalled();
    d.resolve();
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('a taken name blocks saving', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    open({ onSave, takenNames: ['alerts'] });
    typeName('Alerts');
    press(primary());
    await settle();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('regenerate shows the new URL only after the host issues it', async () => {
    const d = deferred<{ url: string }>();
    const onRegenerate = vi.fn(() => d.promise);
    open({ dialogMode: 'edit', webhook, onSave: vi.fn(), onRegenerate });
    press(target.querySelector('.regen'));
    flushSync();
    press(primary());
    press(primary());
    await settle();
    expect(onRegenerate).toHaveBeenCalledOnce();
    expect(onRegenerate).toHaveBeenCalledWith({ id: 'wh-1' });
    expect(target.textContent).not.toContain('/new');
    d.resolve({ url: 'https://oc.app/webhook/x/new' });
    await settle();
    expect(target.textContent).toContain('https://oc.app/webhook/x/new');
  });

  test('a failed regenerate keeps the old URL and shows an error', async () => {
    open({ dialogMode: 'edit', webhook, onSave: vi.fn(), onRegenerate: () => Promise.reject(new Error('x')) });
    press(target.querySelector('.regen'));
    flushSync();
    press(primary());
    await settle();
    expect(target.querySelector('.error')).not.toBeNull();
    press(target.querySelector('.secondary')); // back to the form
    flushSync();
    expect(target.textContent).toContain('https://oc.app/webhook/x/old');
  });

  test('Esc then regenerate during the exit issues nothing', async () => {
    const onRegenerate = vi.fn(() => Promise.resolve({ url: 'u' }));
    const { onCancel } = open({ dialogMode: 'edit', webhook, onSave: vi.fn(), onRegenerate });
    press(target.querySelector('.regen'));
    flushSync();
    esc();
    press(primary());
    await vi.runAllTimersAsync();
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('a failed save keeps the form with an error', async () => {
    const { onCancel } = open({ onSave: () => Promise.reject(new Error('x')) });
    typeName('alerts');
    press(primary());
    await settle();
    expect(target.querySelector('.error')).not.toBeNull();
    expect((target.querySelector('input:not(.file)') as HTMLInputElement).value).toBe('alerts');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
