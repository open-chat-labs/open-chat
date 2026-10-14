import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import PollBuilderDialog from './PollBuilderDialog.svelte';

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
const press = (el: Element | null) => (el as HTMLElement).click();
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};

describe('PollBuilderDialog publish', () => {
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

  function open(onPublish: () => Promise<void>) {
    const onClose = vi.fn();
    const publish = vi.fn(onPublish);
    app = mount(PollBuilderDialog, { target, props: { onPublish: publish, onClose } });
    flushSync();
    type(target.querySelector('textarea')!, 'Lunch?');
    const answers = () => [...target.querySelectorAll<HTMLInputElement>('input[data-sortable-input]')];
    type(answers()[0], 'Pizza');
    type(answers()[1], 'Sushi');
    const dialog = target.querySelector<HTMLElement>('.dialog')!;
    const esc = () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { onClose, publish, esc, answers, publishButton: target.querySelector('.publish') };
  }

  test('a second publish while publishing is ignored', async () => {
    const d = deferred();
    const { publish, publishButton } = open(() => d.promise);
    press(publishButton);
    press(publishButton);
    await settle();
    expect(publish).toHaveBeenCalledOnce();
    expect(((publish.mock.calls[0] as unknown[])[0])).toMatchObject({ question: 'Lunch?', options: [{ label: 'Pizza' }, { label: 'Sushi' }] });
  });

  test('closing and discarding are ignored while publishing', async () => {
    const d = deferred();
    const { onClose, esc, publishButton } = open(() => d.promise);
    press(publishButton);
    await settle();
    esc();
    press(target.querySelector('.scrim'));
    flushSync();
    expect(target.querySelector('.confirm')).toBeNull(); // no "discard?" while publishing
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('Discard in the open "discard?" prompt is ignored while a publish (Ctrl+Enter) is pending', async () => {
    const d = deferred();
    const { onClose, publish, esc } = open(() => d.promise);
    esc(); // content: asks "Discard this poll?"
    flushSync();
    const prompt = target.querySelector('.confirm')!;
    expect(prompt).not.toBeNull();
    // publish from the keyboard while the prompt is still up
    target.querySelector<HTMLElement>('.dialog')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    await settle();
    expect(publish).toHaveBeenCalledOnce();
    const discard = [...prompt.querySelectorAll<HTMLElement>('button, [role=button]')].find((b) => /discard/i.test(b.textContent ?? ''))!;
    press(discard);
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('once published, nothing more is published', async () => {
    const { publish, publishButton } = open(() => Promise.resolve());
    press(publishButton);
    await settle();
    press(publishButton);
    await settle();
    expect(publish).toHaveBeenCalledOnce();
  });

  test('a failure shows the error, an edit clears it, and publishing again works', async () => {
    const { publish, publishButton, answers } = open(() => Promise.reject(new Error('no')));
    press(publishButton);
    await settle();
    expect(target.querySelector('.reason.failed')).not.toBeNull();
    type(answers()[1], 'Ramen');
    expect(target.querySelector('.reason.failed')).toBeNull();
    press(publishButton);
    await settle();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
