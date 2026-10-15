import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Landing from './Landing.svelte';
import source from './Landing.svelte?raw';
import { reactiveProps } from '../lib/testing/reactiveProps.svelte';

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
const community = (name: string, members: number) => ({ name, about: `About ${name}`, members });

describe('Landing', () => {
  let target: HTMLElement;
  let app: object | null;
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no 2D canvas; the hero backdrop then simply doesn't draw
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    if (app) unmount(app);
    app = null;
    target.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function show(props: Record<string, unknown> = {}) {
    app = mount(Landing, { target, props });
    flushSync();
  }
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => target.querySelector<T>(sel);
  const all = (sel: string) => [...target.querySelectorAll<HTMLElement>(sel)];
  const root = () => q('[data-oc-page=landing]')!;
  const click = (el: Element | null) => {
    (el as HTMLElement).click();
    flushSync();
  };

  test('every piece of copy resolves (no raw resource keys), with the menus open too', () => {
    show({ communities: [community('OpenChat', 62504)] });
    click(q('.learn-button'));
    expect(target.textContent).not.toMatch(/ui\.(landing|learn)\./);
    click(q('.accent-button'));
    expect(target.textContent).not.toMatch(/ui\.(landing|learn)\./);
    const labels = all('[aria-label], [title]').map((el) => el.getAttribute('aria-label') ?? el.getAttribute('title'));
    expect(labels.filter((l) => /^ui\./.test(l ?? ''))).toEqual([]);
  });

  test('links go to the host routes; Learn links default to the learn hash and follow learnPageHref', () => {
    show({ exploreHref: '/explore', homeHref: '/start', learnHref: '/docs' });
    expect(q<HTMLAnchorElement>('.brand')!.getAttribute('href')).toBe('/start');
    expect(q<HTMLAnchorElement>('.cta.primary')!.getAttribute('href')).toBe('/explore');
    const footerLearn = all('.footer-group')[1].querySelectorAll('a');
    expect([...footerLearn].map((a) => a.getAttribute('href'))).toEqual(['/docs#roadmap', '/docs#whitepaper', '/docs#architecture', '/docs#blog', '/docs#faq']);
    unmount(app!);
    show({ learnPageHref: (p: string) => `/${p}` });
    click(q('.learn-button'));
    expect(all('.learn-item').map((a) => a.getAttribute('href'))).toEqual(['/roadmap', '/whitepaper', '/architecture', '/blog', '/faq']);
  });

  test('community cards come from the host; without any, only the heading and Browse link show', () => {
    show({ communities: [community('Big', 62504), { ...community('Small', 1), href: '/community/small' }] });
    const cards = all('.community');
    expect(cards.map((c) => c.querySelector('.community-members')!.textContent)).toEqual(['62.5K members', '1 member']);
    expect(cards.map((c) => c.tagName)).toEqual(['DIV', 'A']);
    expect(cards[1].getAttribute('href')).toBe('/community/small');
    unmount(app!);
    show();
    expect(q('.community-grid')).toBeNull();
    expect(q('.browse')).not.toBeNull();
  });

  test('member counts round before choosing the unit', () => {
    show({ communities: [community('A', 950_000), community('B', 999_950), community('C', 999_950_000), community('D', 999)] });
    expect(all('.community-members').map((m) => m.textContent)).toEqual(['950K members', '1M members', '1B members', '999 members']);
  });

  test('the Learn menu and footer link only the sub-pages the host has', () => {
    show({ learnPages: ['roadmap', 'blog', 'faq'] });
    const footerLearn = [...all('.footer-group')[1].querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(footerLearn).toEqual(['/learn#roadmap', '/learn#blog', '/learn#faq']);
    click(q('.learn-button'));
    expect(all('.learn-item').map((a) => a.getAttribute('href'))).toEqual(['/learn#roadmap', '/learn#blog', '/learn#faq']);
  });

  test('app build choices and the proposals link are links only when the host gives the URL', () => {
    show({ apkHref: '/apk' });
    expect(all('.build').map((b) => [b.tagName, b.getAttribute('href')])).toEqual([
      ['DIV', null],
      ['A', '/apk'],
    ]);
    expect(q('.proposals')).toBeNull();
    unmount(app!);
    show({ proposalsHref: '/proposals' });
    expect(q('.proposals')!.getAttribute('href')).toBe('/proposals');
  });

  test('the theme controls override mode and accent on the page and report the pick, until the host passes new values', () => {
    const onModeChange = vi.fn();
    const onAccentChange = vi.fn();
    const props = reactiveProps<Record<string, unknown>>({ mode: 'dark', accent: 'pink', onModeChange, onAccentChange });
    app = mount(Landing, { target, props });
    flushSync();
    click(q('.mode-button'));
    expect(root().dataset.mode).toBe('light');
    expect(onModeChange).toHaveBeenCalledWith('light');
    click(q('.accent-button'));
    const items = all('.accent-item');
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    click(items[3]);
    expect(root().dataset.accent).toBe('green');
    expect(onAccentChange).toHaveBeenCalledWith('green');
    expect(q('.accent-menu')).toBeNull();
    // the host's next value wins over the local pick
    props.mode = 'light';
    props.accent = 'blue';
    flushSync();
    expect([root().dataset.mode, root().dataset.accent]).toEqual(['light', 'blue']);
    props.mode = 'dark';
    flushSync();
    expect(root().dataset.mode).toBe('dark');
  });

  test('menus close on Esc and on a press outside, not on a press inside', () => {
    show();
    click(q('.learn-button'));
    expect(q('.learn-button')!.getAttribute('aria-expanded')).toBe('true');
    q('.learn-menu')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    flushSync();
    expect(q('.learn-menu')).not.toBeNull();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    flushSync();
    expect(q('.learn-menu')).toBeNull();
    click(q('.accent-button'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(q('.accent-menu')).toBeNull();
  });

  describe('sign-in', () => {
    const dialog = () => document.querySelector('[role=dialog]');
    const passkey = () => document.querySelector<HTMLButtonElement>('[role=dialog] button.passkey');

    test('Sign in opens AuthDialog; when the host signs the person in, the dialog closes and the page enters the app', async () => {
      const d = deferred();
      const onMethod = vi.fn(() => d.promise);
      const onEnterApp = vi.fn();
      show({ auth: { onMethod }, onEnterApp });
      expect(dialog()).toBeNull();
      click(q('.sign-in'));
      expect(dialog()).not.toBeNull();
      click(passkey());
      expect(onMethod).toHaveBeenCalledWith('passkey', 'login');
      expect(onEnterApp).not.toHaveBeenCalled();
      d.resolve();
      await settle();
      expect(onEnterApp).toHaveBeenCalledOnce();
      expect(dialog()).toBeNull();
    });

    test('a failed sign-in keeps the dialog open and does not enter', async () => {
      const onMethod = vi.fn(() => Promise.reject(new Error('cancelled')));
      const onEnterApp = vi.fn();
      show({ auth: { onMethod }, onEnterApp });
      click(q('.sign-in'));
      click(passkey());
      expect(onMethod).toHaveBeenCalledWith('passkey', 'login');
      await settle();
      expect(onEnterApp).not.toHaveBeenCalled();
      expect(dialog()).not.toBeNull();
    });

    test('a sign-in that finishes after the dialog was closed is stale', async () => {
      const d = deferred();
      const onEnterApp = vi.fn();
      show({ auth: { onMethod: () => d.promise }, onEnterApp });
      click(q('.sign-in'));
      click(passkey());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      flushSync();
      expect(dialog()).toBeNull();
      d.resolve();
      await settle();
      expect(onEnterApp).not.toHaveBeenCalled();
    });

    test('Create account opens the sign-up form; a created account enters the app', async () => {
      const onSignup = vi.fn(() => Promise.resolve());
      const onEnterApp = vi.fn();
      show({ auth: { onSignup }, onEnterApp });
      click(q('.create'));
      const input = document.querySelector<HTMLInputElement>('[role=dialog] input[autocomplete=username]')!;
      input.value = 'newperson1';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      document.querySelector('[role=dialog] form.form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      flushSync();
      expect(onSignup).toHaveBeenCalledWith(expect.objectContaining({ username: 'newperson1' }));
      await settle();
      expect(onEnterApp).toHaveBeenCalledOnce();
      expect(dialog()).toBeNull();
    });

    test('without host callbacks nothing pretends to sign in', async () => {
      const onEnterApp = vi.fn();
      show({ onEnterApp });
      click(q('.sign-in'));
      click(passkey());
      await settle();
      expect(onEnterApp).not.toHaveBeenCalled();
      expect(dialog()).not.toBeNull();
    });
  });

  describe('motion', () => {
    function fakeCanvas() {
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (o, k) => (k in o ? o[k as string] : () => {}),
        set: (o, k, v) => ((o[k as string] = v), true),
      });
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600 } as DOMRect);
      return ctx;
    }
    const prefersReduced = (reduce: boolean) =>
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }));

    afterEach(() => vi.unstubAllGlobals());

    test('the hero backdrop animates normally, and draws one still frame without animating under reduced motion', () => {
      fakeCanvas();
      const raf = vi.fn(() => 1);
      vi.stubGlobal('requestAnimationFrame', raf);
      prefersReduced(false);
      show();
      expect(raf).toHaveBeenCalled();
      unmount(app!);
      app = null;
      raf.mockClear();
      prefersReduced(true);
      const clear = vi.fn();
      const ctx = fakeCanvas();
      ctx.clearRect = clear;
      show();
      expect(raf).not.toHaveBeenCalled();
      expect(clear).toHaveBeenCalled();
    });

    test('the entrance animation and menu chevrons are switched off for reduced motion', () => {
      const guard = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(guard).toMatch(/^@media \(prefers-reduced-motion: reduce\) \{\s*\.rise \{\s*animation: none;\s*\}\s*\.chev \{\s*transition: none;/);
    });
  });
});
