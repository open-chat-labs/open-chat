import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GroupPanel from './GroupPanel.svelte';
import { reactiveProps } from '../../lib/testing/reactiveProps.svelte';

const deferred = () => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};
const members = [
  { title: 'Jane Smith', handle: '@jane', tag: 'OWNER', userId: 'u-jane' },
  { title: 'John Smith', handle: '@john', tag: 'YOU', userId: 'u-john' },
  { title: 'Ryan Rogers', handle: '@ryan', tag: '', userId: 'u-ryan' },
];

describe('GroupPanel member actions', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(props: Record<string, unknown>) {
    app = mount(GroupPanel, {
      target,
      props: { title: 'Devs', ownerHandle: '@jane', members, viewRequest: 'members', storageKey: '', viewerRole: 'Owner', canModerate: true, canChangeRoles: true, ...props },
    });
    flushSync();
  }
  const row = (name: string) => [...target.querySelectorAll<HTMLElement>('.rows .cell')].find((c) => c.textContent?.includes(name)) ?? null;
  const tagOf = (name: string) => row(name)!.textContent!.replace(/\s+/g, ' ');
  function pick(name: string, item: RegExp) {
    row(name)!.querySelector<HTMLElement>('.kebab')!.click();
    flushSync();
    const el = [...row(name)!.querySelectorAll<HTMLElement>('[role=menuitem]')].find((i) => item.test((i.textContent ?? '').trim()));
    if (!el) throw new Error(`no menu item ${item} for ${name}`);
    el.click();
    flushSync();
  }
  const error = () => target.querySelector('.member-error');

  test('a role change shows at once and stays when the host accepts', async () => {
    const d = deferred();
    const onRoleChange = vi.fn(() => d.promise);
    open({ onRoleChange });
    pick('Ryan Rogers', /^Admin/);
    expect(onRoleChange).toHaveBeenCalledWith(expect.objectContaining({ handle: '@ryan' }), 'ADMIN');
    expect(tagOf('Ryan Rogers')).toMatch(/admin/i);
    d.resolve();
    await settle();
    expect(tagOf('Ryan Rogers')).toMatch(/admin/i);
    expect(error()).toBeNull();
  });

  test('latest wins: a slow rejected change does not undo a newer accepted one', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    open({
      onRoleChange: () => {
        const d = deferred();
        calls.push(d);
        return d.promise;
      },
    });
    pick('Ryan Rogers', /^Admin/);
    pick('Ryan Rogers', /^Moderator/);
    calls[1].resolve();
    await settle();
    calls[0].reject(new Error('late'));
    await settle();
    expect(tagOf('Ryan Rogers')).toMatch(/moderator/i);
    expect(error()).toBeNull();
  });

  test('a rejected latest change falls back to the host role with an error', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    open({
      onRoleChange: () => {
        const d = deferred();
        calls.push(d);
        return d.promise;
      },
    });
    pick('Ryan Rogers', /^Admin/);
    pick('Ryan Rogers', /^Moderator/);
    calls[0].reject(new Error('x'));
    calls[1].reject(new Error('y'));
    await settle();
    expect(tagOf('Ryan Rogers')).not.toMatch(/admin|moderator/i);
    expect(error()).not.toBeNull();
  });

  test('a removed member disappears at once and comes back with an error if the host rejects', async () => {
    const d = deferred();
    open({ onRemoveMember: () => d.promise });
    pick('Ryan Rogers', /remove/i);
    expect(row('Ryan Rogers')).toBeNull();
    d.reject(new Error('no'));
    await settle();
    expect(row('Ryan Rogers')).not.toBeNull();
    expect(error()).not.toBeNull();
  });

  test('without callbacks there is no member menu', () => {
    open({});
    expect(row('Ryan Rogers')!.querySelector('.kebab')).toBeNull();
  });
});

describe('GroupPanel mute', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(props: Record<string, unknown>) {
    const host = reactiveProps<Record<string, unknown>>({ title: 'Devs', ownerHandle: '@jane', members, storageKey: '', ...props });
    app = mount(GroupPanel, { target, props: host as never });
    flushSync();
    return host;
  }
  const tile = (text: RegExp) => [...target.querySelectorAll<HTMLElement>('.tiles .tile')].find((el) => text.test((el.textContent ?? '').trim()))!;
  const muteTile = () => tile(/^Mute$|^Muted/);
  const everyoneTile = () => tile(/everyone/i);
  const label = (el: HTMLElement) => el.textContent!.trim();
  const press = (el: HTMLElement) => {
    el.click();
    flushSync();
  };
  const error = () => target.querySelector('.member-error');

  test('Unmute shows at once and stays once the host accepts; a repeat tap sends nothing', async () => {
    const d = deferred();
    const onMuteChange = vi.fn(() => d.promise);
    open({ mutedUntil: '8h', onMuteChange });
    expect(label(muteTile())).toBe('Muted · 8h');
    press(muteTile());
    expect(onMuteChange).toHaveBeenCalledWith(null);
    expect(label(muteTile())).toBe('Mute');
    expect(muteTile().classList.contains('on')).toBe(false);
    press(muteTile()); // now reads "Mute": opens the span menu, no second unmute
    expect(onMuteChange).toHaveBeenCalledOnce();
    d.resolve();
    await settle();
    expect(label(muteTile())).toBe('Mute');
  });

  test('a rejected unmute falls back to the host mute and shows an error', async () => {
    open({ mutedUntil: '8h', onMuteChange: () => Promise.reject(new Error('x')) });
    press(muteTile());
    await settle();
    expect(label(muteTile())).toBe('Muted · 8h');
    expect(error()).not.toBeNull();
  });

  test('muting picks a span and shows it at once', async () => {
    const d = deferred();
    const onMuteChange = vi.fn(() => d.promise);
    open({ onMuteChange });
    press(muteTile());
    press([...target.querySelectorAll<HTMLElement>('.mute-option')].find((o) => /8 hours/.test(o.textContent ?? ''))!);
    expect(onMuteChange).toHaveBeenCalledExactlyOnceWith('8h');
    expect(label(muteTile())).toBe('Muted · 8h');
    d.resolve();
    await settle();
    expect(label(muteTile())).toBe('Muted · 8h');
  });

  test('mute @everyone: the latest call wins and a rejection falls back to the host', async () => {
    const a = deferred(), b = deferred();
    const calls = [a, b];
    const onMuteEveryoneChange = vi.fn(() => calls.shift()!.promise);
    open({ muteEveryone: false, onMuteEveryoneChange });
    press(everyoneTile()); // on
    press(everyoneTile()); // off
    expect(onMuteEveryoneChange.mock.calls).toEqual([[true], [false]]);
    a.reject(new Error('late')); // superseded: ignored
    await settle();
    expect(everyoneTile().classList.contains('on')).toBe(false);
    expect(error()).toBeNull();
    b.reject(new Error('x')); // latest rejects: back to the host's value
    await settle();
    expect(everyoneTile().classList.contains('on')).toBe(false);
    expect(error()).not.toBeNull();
  });

  test('a new host mute is followed once nothing is in flight', async () => {
    const host = open({ mutedUntil: null, onMuteChange: () => Promise.resolve() });
    press(muteTile());
    press([...target.querySelectorAll<HTMLElement>('.mute-option')].find((o) => /1 week/.test(o.textContent ?? ''))!);
    await settle();
    expect(label(muteTile())).toBe('Muted · 1w');
    host.mutedUntil = '1w'; // the host catches up
    flushSync();
    host.mutedUntil = null; // then it's unmuted elsewhere
    flushSync();
    expect(label(muteTile())).toBe('Mute');
  });
});
