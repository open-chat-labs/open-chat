import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import Toggle from './Toggle.svelte';

describe('Toggle', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function show(props: Record<string, unknown>) {
    app = mount(Toggle, { target, props: { on: false, ...props } });
    flushSync();
    return target.querySelector('[role=switch]')!;
  }

  test('a switch without a label is named by ariaLabel (translated)', () => {
    expect(show({ ariaLabel: 'ui.newChannelDialog.publicTitle' }).getAttribute('aria-label')).toBe('Public channel');
  });

  test('ariaLabel takes literal text too', () => {
    expect(show({ ariaLabel: 'Mute notifications' }).getAttribute('aria-label')).toBe('Mute notifications');
  });

  test('a labelled switch is named by its label', () => {
    expect(show({ label: 'Mute notifications', ariaLabel: 'Other' }).getAttribute('aria-label')).toBe('Mute notifications');
  });
});
