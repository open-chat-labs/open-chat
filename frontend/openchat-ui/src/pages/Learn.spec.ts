import { flushSync, mount, unmount } from 'svelte';
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

  test.each(LEARN_PAGES)('#%s: every piece of copy resolves (no raw resource keys)', (page) => {
    history.replaceState(null, '', '/learn#' + page);
    show();
    expect(current()).toBeTruthy();
    expect(target.textContent).not.toMatch(/ui\.(landing|learn)\./);
    const labels = all('[aria-label]').map((el) => el.getAttribute('aria-label'));
    expect(labels.filter((l) => /^ui\./.test(l ?? ''))).toEqual([]);
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
    show({ page: 'whitepaper' });
    click(all('.toc-item')[3]);
    expect(scrolled).toHaveBeenCalledWith({ behavior, block: 'start' });
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById('tokenomics'));
  });
});
