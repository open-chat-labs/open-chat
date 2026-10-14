import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GroupPanel from './GroupPanel.svelte';

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
