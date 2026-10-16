import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import Landing from './Landing.svelte';
import source from './Landing.svelte?raw';
import { reactiveProps } from '../lib/testing/reactiveProps.svelte';
import WithI18n from '../lib/testing/WithI18n.svelte';
import { HeroBackground } from './heroBackground';
import { dictionaryTranslator, messages } from '../lib/i18n';

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

  test('logos are root-relative, so the page works on a nested route', () => {
    show();
    expect(all('img.logo').map((i) => i.getAttribute('src'))).toEqual(['/assets/openchat-logo.svg', '/assets/openchat-logo.svg']);
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

  test('a cover URL is used as given, so an already percent-encoded one is not encoded again', () => {
    // jsdom drops a background shorthand it can't parse, so read what the page sets
    const set = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    show({ communities: [{ ...community('A', 1), coverUrl: 'https://cdn.example/a%20b.png' }] });
    expect(set).toHaveBeenCalledWith('background', 'center/cover url("https://cdn.example/a%20b.png")', '');
  });

  test('member counts are compact, rounding up into the next unit', () => {
    show({ communities: [community('A', 950_000), community('B', 999_950), community('C', 999_950_000), community('D', 999)] });
    expect(all('.community-members').map((m) => m.textContent)).toEqual(['950K members', '1M members', '1B members', '999 members']);
  });

  test("member counts follow the host translator's locale", () => {
    app = mount(WithI18n, {
      target,
      props: { i18n: dictionaryTranslator(messages.en, 'de'), component: Landing, props: { communities: [community('A', 1_234_567)] } },
    });
    flushSync();
    expect(q('.community-members')!.textContent).toBe('1,2\u00a0Mio. members');
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

  test('icons are the library Icon: arrows mirror in RTL, the rest keep their direction', () => {
    show({ playStoreHref: '/play' });
    const flips = (sel: string) => all(`${sel} [style*="--icon-"]`).map((i) => i.hasAttribute('data-oc-flip'));
    expect(flips('.cta.primary')).toEqual([true, true]);
    expect(flips('.build.link')).toEqual([true]);
    expect(flips('.learn-button')).toEqual([false]);
    expect(all('[style*="--icon-"]').every((i) => i.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  test("the sections a link jumps to keep clear of the sticky header, at the header's measured height", () => {
    let measured = () => {};
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          measured = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    show();
    expect(root().style.getPropertyValue('--header-h')).toBe('');
    // wrapped onto two rows
    Object.defineProperty(q('header.top')!, 'offsetHeight', { value: 105 });
    measured();
    flushSync();
    expect(root().style.getPropertyValue('--header-h')).toBe('105px');
    expect(all('section[id]').map((s) => s.id)).toEqual(['download', 'features', 'communities', 'governance']);
    expect(source).toMatch(/\.band\[id\] \{\s*scroll-margin-top: var\(--header-h, 69px\);/);
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

    test('a host callback that returns no promise has not signed anyone in', async () => {
      const onMethod = vi.fn(() => undefined);
      const onSignup = vi.fn(() => undefined);
      const onEnterApp = vi.fn();
      show({ auth: { onMethod, onSignup }, onEnterApp });
      click(q('.sign-in'));
      click(passkey());
      await settle();
      expect(onMethod).toHaveBeenCalledOnce();
      expect(onEnterApp).not.toHaveBeenCalled();
      expect(dialog()).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      flushSync();
      click(q('.create'));
      const input = document.querySelector<HTMLInputElement>('[role=dialog] input[autocomplete=username]')!;
      input.value = 'newperson1';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      document.querySelector('[role=dialog] form.form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
      expect(onSignup).toHaveBeenCalledOnce();
      expect(onEnterApp).not.toHaveBeenCalled();
      expect(dialog()).not.toBeNull();
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

    test('a mode, accent or style change rethemes the backdrop, with the new theme already applied; nothing rebuilds or re-measures it', () => {
      fakeCanvas();
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      prefersReduced(false);
      const create = vi.spyOn(HeroBackground, 'create');
      const resize = vi.spyOn(HeroBackground.prototype, 'resize');
      // the theme root's mode at each retheme
      const themes: (string | undefined)[] = [];
      const retheme = HeroBackground.prototype.retheme;
      vi.spyOn(HeroBackground.prototype, 'retheme').mockImplementation(function (this: HeroBackground) {
        themes.push(root().dataset.mode);
        retheme.call(this);
      });
      const props = reactiveProps<Record<string, unknown>>({ heroBg: 'pulse' });
      app = mount(Landing, { target, props });
      flushSync();
      // creating it measured and themed it once; the theme effect's first run adds nothing
      expect([create.mock.calls.length, resize.mock.calls.length, themes]).toEqual([1, 1, ['dark']]);
      click(q('.mode-button'));
      expect(themes).toEqual(['dark', 'light']);
      props.heroBg = 'aurora';
      flushSync();
      expect(themes).toEqual(['dark', 'light', 'light']);
      expect([create.mock.calls.length, resize.mock.calls.length]).toEqual([1, 1]);
    });

    test('the entrance animation and menu chevrons are switched off for reduced motion', () => {
      const guard = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(guard).toMatch(/^@media \(prefers-reduced-motion: reduce\) \{\s*\.rise \{\s*animation: none;\s*\}\s*\.chev \{\s*transition: none;/);
    });
  });
});
