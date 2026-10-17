import { flushSync, mount, unmount, type ComponentProps } from 'svelte';
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import Learn from './Learn.svelte';
import { LEARN_PAGES, placeholderLearnContent, type LearnContent } from './learnContent';
import { reactiveProps } from '../lib/testing/reactiveProps.svelte';

describe('Learn', () => {
  let target: HTMLElement;
  let app: object | null;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
    window.scrollTo = vi.fn();
  });
  afterEach(() => {
    if (app) unmount(app);
    app = null;
    target.remove();
    history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function show(props: Record<string, unknown> = {}) {
    app = mount(Learn, { target, props });
    flushSync();
  }
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => target.querySelector<T>(sel);
  const all = (sel: string) => [...target.querySelectorAll<HTMLElement>(sel)];
  const tab = (label: string) => all('.tab').find((t) => t.textContent === label)!;
  const current = () => q('.tab[aria-current=page]')?.textContent;
  const h1 = () => q('h1')?.textContent;
  const click = (el: Element | null) => {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    (el as HTMLElement).dispatchEvent(e);
    flushSync();
    return e;
  };
  /** Clicks with modifiers; true when the link's own navigation would go ahead (stopped after Learn's handler: jsdom can't navigate). */
  const clickThrough = (el: Element, init: MouseEventInit) => {
    let navigates: boolean | undefined;
    const stop = (e: Event) => {
      navigates = !e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', stop);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
    document.removeEventListener('click', stop);
    flushSync();
    return navigates;
  };

  test.each(LEARN_PAGES)('#%s: every piece of copy resolves (no raw resource keys)', (page) => {
    history.replaceState(null, '', '/learn#' + page);
    show();
    expect(current()).toBeTruthy();
    expect(target.textContent).not.toMatch(/ui\.(landing|learn)\./);
    const labels = all('[aria-label]').map((el) => el.getAttribute('aria-label'));
    expect(labels.filter((l) => /^ui\./.test(l ?? ''))).toEqual([]);
  });

  test('signed in, Open app replaces Sign in and Create account', () => {
    const onEnterApp = vi.fn();
    show({ signedIn: true, onEnterApp, appHref: '/app' });
    expect(q('.sign-in')).toBeNull();
    const open = q('a.create')!;
    expect([open.textContent, open.getAttribute('href')]).toEqual(['Open OpenChat', '/app']);
    click(open);
    expect(onEnterApp).toHaveBeenCalledOnce();
  });

  describe('without `page`, the URL hash picks the sub-page', () => {
    test('a deep link opens that sub-page or post; no hash or an unknown one shows the roadmap', () => {
      history.replaceState(null, '', '/learn#faq');
      show();
      expect([current(), h1()]).toEqual(['FAQs', 'Questions, answered']);
      unmount(app!);
      history.replaceState(null, '', '/learn#blog/android-beta');
      show();
      expect([current(), h1()]).toEqual(['Blog', 'The Android app is in beta']);
      unmount(app!);
      history.replaceState(null, '', '/learn#nope');
      show();
      expect(current()).toBe('Roadmap');
    });

    test('a tab click switches in place, writes the hash and tells the host', () => {
      const onNavigate = vi.fn();
      history.replaceState(null, '', '/learn');
      show({ onNavigate });
      const e = click(tab('Whitepaper'));
      expect(e.defaultPrevented).toBe(true);
      expect([current(), h1(), location.hash]).toEqual(['Whitepaper', 'The OpenChat SNS', '#whitepaper']);
      expect(onNavigate).toHaveBeenCalledWith('whitepaper', undefined);
      click(tab('Blog'));
      click(q('.post'));
      expect(location.hash).toBe('#blog/openchat-is-now-a-dao');
      expect(h1()).toBe('OpenChat is now a DAO');
      click(q('.back'));
      expect([location.hash, h1()]).toEqual(['#blog', 'News from the DAO']);
    });

    test.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('a modified or non-primary click (%o) is left to the browser', (init) => {
      const onNavigate = vi.fn();
      history.replaceState(null, '', '/learn');
      show({ onNavigate });
      expect(clickThrough(tab('FAQs'), init)).toBe(true);
      expect([current(), location.hash]).toEqual(['Roadmap', '']);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    test("a tab click makes its own entry, as the link would, and leaves the host router's state on the one it was on", async () => {
      const onNavigate = vi.fn();
      history.replaceState({ router: 7 }, '', '/learn');
      show({ onNavigate });
      const entries = history.length;
      // let hashchanges still queued from earlier tests' clicks fire first
      await new Promise((r) => setTimeout(r, 0));
      const hashchange = vi.fn();
      window.addEventListener('hashchange', hashchange);
      onTestFinished(() => window.removeEventListener('hashchange', hashchange));
      click(tab('FAQs'));
      // a fresh entry has no state (null; undefined in jsdom)
      expect([location.hash, history.state ?? null, history.length]).toEqual(['#faq', null, entries + 1]);
      // a host router sees the hashchange; Learn's own read of it finds FAQs already showing, so nothing runs twice
      await new Promise((r) => setTimeout(r, 0));
      flushSync();
      expect([hashchange.mock.calls.length, current(), onNavigate.mock.calls.length]).toEqual([1, 'FAQs', 1]);
      const back = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
      history.back();
      await back;
      flushSync();
      expect([history.state, current()]).toEqual([{ router: 7 }, 'Roadmap']);
    });

    test('back / forward and an edited hash follow the URL', () => {
      show();
      history.replaceState(null, '', '/learn#architecture');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(current()).toBe('Architecture');
      history.replaceState(null, '', '/learn#faq');
      window.dispatchEvent(new PopStateEvent('popstate'));
      flushSync();
      expect(current()).toBe('FAQs');
    });

    test('Back / Forward and an edited hash tell the host too, once per change; the sub-page it opens on does not', () => {
      const onNavigate = vi.fn();
      const listen = vi.spyOn(window, 'addEventListener');
      history.replaceState(null, '', '/learn#faq');
      show({ onNavigate });
      expect(onNavigate).not.toHaveBeenCalled();
      history.replaceState(null, '', '/learn#blog/android-beta');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      // some browsers fire both for one change
      window.dispatchEvent(new PopStateEvent('popstate'));
      flushSync();
      expect(onNavigate.mock.calls).toEqual([['blog', 'android-beta']]);
      history.replaceState(null, '', '/learn');
      window.dispatchEvent(new PopStateEvent('popstate'));
      // an unknown hash changes nothing, so says nothing
      history.replaceState(null, '', '/learn#vision');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(onNavigate.mock.calls).toEqual([
        ['blog', 'android-beta'],
        ['roadmap', undefined],
      ]);
      expect(current()).toBe('Roadmap');
      // the listeners were set up once, not again on every change
      expect(listen.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(1);
    });

    test('tells the host the sub-page it shows: a doc the content lacks is the roadmap it falls back to', () => {
      const onNavigate = vi.fn();
      const content: LearnContent = { ...placeholderLearnContent, docs: {} };
      history.replaceState(null, '', '/learn#faq');
      show({ onNavigate, content });
      history.replaceState(null, '', '/learn#whitepaper');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(current()).toBe('Roadmap');
      expect(onNavigate.mock.calls).toEqual([['roadmap', undefined]]);
      // from there, the roadmap itself is no change
      history.replaceState(null, '', '/learn');
      window.dispatchEvent(new PopStateEvent('popstate'));
      flushSync();
      expect(onNavigate.mock.calls).toEqual([['roadmap', undefined]]);
    });

    test('back to the entry without a hash shows the roadmap again; an unknown hash leaves the sub-page alone', () => {
      history.replaceState(null, '', '/learn');
      show();
      click(tab('FAQs'));
      expect(current()).toBe('FAQs');
      history.replaceState(null, '', '/learn');
      window.dispatchEvent(new PopStateEvent('popstate'));
      flushSync();
      expect(current()).toBe('Roadmap');
      click(tab('FAQs'));
      history.replaceState(null, '', '/learn#vision');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(current()).toBe('FAQs');
    });

    test('learnPageHref is for host routing: hash-mode links stay hash links, so a click and the href agree', () => {
      history.replaceState(null, '', '/learn');
      show({ learnPageHref: (p: string) => `/${p}` });
      expect(tab('FAQs').getAttribute('href')).toBe('/learn#faq');
      click(tab('FAQs'));
      expect(location.hash).toBe('#faq');
    });
  });

  describe('with `page`, the host routes', () => {
    test('a host that sets `page` has to give learnPageHref too (checked by the type checker)', () => {
      const routed: ComponentProps<typeof Learn> = { page: 'faq', learnPageHref: (p) => `/${p}` };
      // @ts-expect-error without learnPageHref the links would be hash links, which a host-routed Learn ignores
      const unlinked: ComponentProps<typeof Learn> = { page: 'faq' };
      expect([routed, unlinked]).toHaveLength(2);
    });

    test('the host picks the sub-page and post; the hash is ignored', () => {
      history.replaceState(null, '', '/learn#faq');
      const props = reactiveProps<Record<string, unknown>>({ page: 'architecture' });
      app = mount(Learn, { target, props });
      flushSync();
      expect(current()).toBe('Architecture');
      props.page = 'blog';
      props.post = 'introducing-diamond';
      flushSync();
      expect(h1()).toBe('Introducing Diamond membership');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(current()).toBe('Blog');
    });

    test('the hash routes again once the host stops setting `page`, and not while it sets it', () => {
      history.replaceState(null, '', '/learn#faq');
      const props = reactiveProps<Record<string, unknown>>({ page: 'architecture', learnPageHref: (p: string) => `/${p}` });
      app = mount(Learn, { target, props });
      flushSync();
      expect(current()).toBe('Architecture');
      props.page = undefined;
      flushSync();
      expect(current()).toBe('FAQs');
      history.replaceState(null, '', '/learn#blog');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(current()).toBe('Blog');
      props.page = 'roadmap';
      flushSync();
      history.replaceState(null, '', '/learn#faq');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      flushSync();
      expect(current()).toBe('Roadmap');
      // the hash it ignored while host-routed is read afresh when hash routing resumes
      props.page = undefined;
      flushSync();
      expect(current()).toBe('FAQs');
    });

    test('with onNavigate the host takes the click; without it the link navigates', () => {
      const onNavigate = vi.fn();
      const learnPageHref = (p: string, post?: string) => (post ? `/${p}/${post}` : `/${p}`);
      show({ page: 'roadmap', onNavigate, learnPageHref });
      expect(all('.tab').map((t) => t.getAttribute('href'))).toEqual(['/roadmap', '/whitepaper', '/architecture', '/blog', '/faq']);
      const e = click(tab('FAQs'));
      expect(e.defaultPrevented).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('faq', undefined);
      // nothing changes until the host routes
      expect(current()).toBe('Roadmap');
      unmount(app!);
      show({ page: 'blog', learnPageHref });
      expect(q('.post')!.getAttribute('href')).toBe('/blog/openchat-is-now-a-dao');
      // the link's own navigation goes ahead (checked after Learn's handler, then stopped: jsdom can't navigate)
      let navigates: boolean | undefined;
      const stop = (e: Event) => {
        navigates = !e.defaultPrevented;
        e.preventDefault();
      };
      document.addEventListener('click', stop);
      click(q('.post'));
      document.removeEventListener('click', stop);
      expect(navigates).toBe(true);
    });

    test('post covers are used as given, so an already percent-encoded URL is not encoded again', () => {
      const cover = 'https://cdn.example/a%20b.png';
      const content: LearnContent = { ...placeholderLearnContent, posts: placeholderLearnContent.posts.map((p) => ({ ...p, cover })) };
      // jsdom drops a background shorthand it can't parse, so read what the page sets
      const set = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
      show({ page: 'blog', content });
      expect(set).toHaveBeenCalledWith('background', `center/cover url("${cover}")`, '');
      unmount(app!);
      set.mockClear();
      show({ page: 'blog', post: content.posts[0].slug, content });
      expect(set).toHaveBeenCalledWith('background', `center/cover url("${cover}")`, '');
    });

    test('a modified click is left to the browser, not taken by onNavigate', () => {
      const onNavigate = vi.fn();
      show({ page: 'roadmap', onNavigate, learnPageHref: (p: string) => `/${p}` });
      expect(clickThrough(tab('FAQs'), { metaKey: true })).toBe(true);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    test("the way back to all posts is an Icon arrow that mirrors in RTL", () => {
      show({ page: 'blog', post: 'gone' });
      expect(q('.back [style*="--icon-back"]')!.hasAttribute('data-oc-flip')).toBe(true);
    });

    test('an unknown post says so, with the way back to all posts', () => {
      show({ page: 'blog', post: 'gone' });
      expect(q('.article')!.textContent).toContain('That post isn’t here any more.');
      expect(q('.back')).not.toBeNull();
    });

    test('a doc sub-page the content does not have shows the roadmap, whether the host or the hash asks for it', () => {
      const content: LearnContent = { ...placeholderLearnContent, docs: { whitepaper: placeholderLearnContent.docs.whitepaper } };
      show({ page: 'architecture', content });
      expect([current(), h1()]).toEqual(['Roadmap', 'Where we’ve been, where we’re going']);
      unmount(app!);
      history.replaceState(null, '', '/learn#architecture');
      show({ content });
      expect([current(), h1()]).toEqual(['Roadmap', 'Where we’ve been, where we’re going']);
    });
  });

  test('FAQ search filters questions and opens the matches; nothing matching says so', () => {
    show({ page: 'faq' });
    expect(all('.answer')).toHaveLength(0);
    const first = all('.question-button')[0];
    click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(all('.answer')).toHaveLength(1);
    const input = q<HTMLInputElement>('.search-input')!;
    input.value = 'hotkey';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(all('.question-text').map((x) => x.textContent)).toEqual(['How do I vote on proposals?']);
    expect(all('.answer')).toHaveLength(1);
    input.value = 'zebra';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(all('.question')).toHaveLength(0);
    expect(q('.faq-empty')!.textContent).toBe('No questions match “zebra”.');
  });

  test('the same question in two groups opens on its own', () => {
    const faq = [
      { title: 'Basics', items: [{ q: 'Is it free?', a: 'Yes.' }] },
      { title: 'Diamond', items: [{ q: 'Is it free?', a: 'No.' }] },
    ];
    show({ page: 'faq', content: { ...placeholderLearnContent, faq } });
    const [first, second] = all('.question-button');
    click(first);
    expect([first.getAttribute('aria-expanded'), second.getAttribute('aria-expanded')]).toEqual(['true', 'false']);
    expect(all('.answer').map((a) => a.textContent)).toEqual(['Yes.']);
  });

  test('while searching, a match can be closed and reopened; clearing the search restores the questions as they were', () => {
    show({ page: 'faq' });
    const search = (value: string) => {
      const input = q<HTMLInputElement>('.search-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
    };
    click(all('.question-button')[0]);
    search('hotkey');
    const match = all('.question-button')[0];
    expect(match.getAttribute('aria-expanded')).toBe('true');
    click(match);
    expect([match.getAttribute('aria-expanded'), all('.answer').length]).toEqual(['false', 0]);
    click(match);
    expect(match.getAttribute('aria-expanded')).toBe('true');
    click(match);
    search('');
    // only the question opened before the search is open
    expect(all('.question-button').map((b) => b.getAttribute('aria-expanded')).filter((x) => x === 'true')).toHaveLength(1);
    expect(all('.question-button')[0].getAttribute('aria-expanded')).toBe('true');
    // a new query starts with every match open again
    search('hotkey');
    expect(all('.question-button')[0].getAttribute('aria-expanded')).toBe('true');
  });

  test('roadmap: up-next cards, years in order, and items with detail expand', () => {
    show({ page: 'roadmap' });
    expect(all('.next-title').map((x) => x.textContent)).toEqual(['NFTs, contacts, personas and more', 'Native apps', 'Blue sky thinking']);
    expect(all('.year-label').map((x) => x.textContent)).toEqual(['2025', '2024', '2023', '2022', '2021', '2020']);
    const item = all('.item-button')[0];
    expect(item.getAttribute('aria-expanded')).toBe('false');
    click(item);
    expect(item.getAttribute('aria-expanded')).toBe('true');
    expect(q('.item-detail')!.textContent).toContain('Bot platform and SDK');
    click(item);
    expect(q('.item-detail')).toBeNull();
  });

  test('roadmap content out of year order still gets one heading per year', () => {
    const done = (year: string, title: string) => ({ status: 'done' as const, year, when: 'Q1', title });
    show({ page: 'roadmap', content: { ...placeholderLearnContent, roadmap: [done('2024', 'A'), done('2025', 'B'), done('2024', 'C')] } });
    expect(all('.year').map((y) => [y.querySelector('.year-label')!.textContent, [...y.querySelectorAll('.item-title')].map((x) => x.textContent)])).toEqual([
      ['2024', ['A', 'C']],
      ['2025', ['B']],
    ]);
  });

  test('host content replaces the placeholder; a doc it leaves out has no tab', () => {
    const content: LearnContent = {
      docs: { whitepaper: { ...placeholderLearnContent.docs.whitepaper!, title: 'Our paper' } },
      posts: [],
      roadmap: [{ status: 'done', year: '2030', when: 'Q1', title: 'Without detail' }],
      faq: [{ title: 'Basics', items: [{ q: 'Q?', a: 'A.' }] }],
    };
    show({ page: 'whitepaper', content });
    expect(all('.tab').map((t) => t.textContent)).toEqual(['Roadmap', 'Whitepaper', 'Blog', 'FAQs']);
    expect(h1()).toBe('Our paper');
    unmount(app!);
    show({ page: 'roadmap', content });
    expect(q('.next')).toBeNull();
    const item = q<HTMLButtonElement>('.item-button')!;
    expect(item.disabled).toBe(true);
    expect(item.hasAttribute('aria-expanded')).toBe(false);
  });

  test('the logos are drawn inline, in the sign-in dialog too, each with its own gradients', () => {
    show({ page: 'blog', post: 'android-beta', learnPageHref: (p: string, post?: string) => `/${p}/${post ?? ''}` });
    click(q('.sign-in'));
    expect([...document.querySelectorAll('img')].filter((i) => i.getAttribute('src')?.includes('logo'))).toEqual([]);
    const logos = [...document.querySelectorAll('svg.logo')];
    expect(logos.length).toBeGreaterThanOrEqual(3);
    // two logos sharing gradient ids would both paint from the first (and lose their fill if it's hidden)
    const ids = logos.flatMap((l) => [...l.querySelectorAll('linearGradient')].map((g) => g.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of logos) for (const path of l.querySelectorAll('path')) expect(l.querySelector(path.getAttribute('fill')!.replace(/^url\((#.+)\)$/, '$1'))).not.toBeNull();
  });

  test('sign in opens AuthDialog and a successful sign-in enters the app', async () => {
    const onEnterApp = vi.fn();
    show({ auth: { onMethod: () => Promise.resolve() }, onEnterApp });
    click(q('.sign-in'));
    click(document.querySelector('[role=dialog] button.passkey'));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    flushSync();
    expect(onEnterApp).toHaveBeenCalledOnce();
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  test.each([
    [false, 'smooth'],
    [true, 'auto'],
  ])('the index scrolls to a section, without smooth scrolling under reduced motion (reduced %s)', (reduce, behavior) => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }));
    const scrolled = vi.fn();
    const had = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrolled;
    onTestFinished(() => {
      if (had) Object.defineProperty(Element.prototype, 'scrollIntoView', had);
      else delete (Element.prototype as Partial<Element>).scrollIntoView;
    });
    // the host page has its own element with a content section's id
    const hosts = document.body.insertBefore(Object.assign(document.createElement('div'), { id: 'tokenomics' }), document.body.firstChild);
    onTestFinished(() => hosts.remove());
    show({ page: 'whitepaper' });
    click(all('.toc-item')[3]);
    expect(scrolled).toHaveBeenCalledWith({ behavior, block: 'start' });
    expect(scrolled.mock.contexts[0]).toBe(q('.doc-section#learn-tokenomics'));
    expect(document.querySelectorAll('[id="tokenomics"]')).toHaveLength(1);
  });
});
