import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import AchievementsDialog, { type Achievement } from './AchievementsDialog.svelte';

const PARTNERS_EMPTY = 'External achievements are set by third parties';

describe('AchievementsDialog groups', () => {
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

  function open(achievements: Achievement[]) {
    app = mount(AchievementsDialog, { target, props: { achievements } });
    flushSync();
  }
  const groups = () => [...document.querySelectorAll('.group')];
  const head = (label: string) =>
    groups()
      .find((g) => g.querySelector('.group-label')?.textContent === label)!
      .querySelector<HTMLElement>('.group-head')!;

  test('a group the catalogue has nothing for is left out; an empty Partners group explains itself', () => {
    open([
      {
        id: 'sent-message',
        group: 'messaging',
        reward: 100,
        done: false,
        label: 'Send a message',
      },
    ]);
    const labels = groups().map((g) => g.querySelector('.group-label')!.textContent);
    expect(labels).toEqual(['Messaging', 'From partners']);
    head('From partners').click();
    flushSync();
    expect(document.body.textContent).toContain(PARTNERS_EMPTY);
  });

  test('group heads report whether they are expanded', () => {
    open([
      {
        id: 'sent-message',
        group: 'messaging',
        reward: 100,
        done: false,
        label: 'Send a message',
      },
    ]);
    const h = head('Messaging');
    expect(h.getAttribute('aria-expanded')).toBe('false');
    h.click();
    flushSync();
    expect(head('Messaging').getAttribute('aria-expanded')).toBe('true');
  });
});
