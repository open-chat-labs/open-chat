import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Features from './groups/Features.svelte';
import { demoProps } from './demo';

let target: HTMLElement;
let app: object;
beforeEach(() => {
  // jsdom has neither; the demos only need them to exist
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  target = document.body.appendChild(document.createElement('div'));
  app = mount(Features, { target, props: { mode: 'dark', accent: 'pink' } });
  flushSync();
});
afterEach(() => {
  unmount(app);
  target.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const frame = (page: string) => target.querySelector<HTMLElement>(`.page-frame:has([data-oc-page=${page}])`)!;
const click = (el: Element) => {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  flushSync();
  return e;
};

test('links inside the page demos never navigate the docs window', () => {
  const landing = frame('landing');
  for (const sel of ['a.section-link[href="#features"]', 'a.cta.ghost[href="#download"]', 'a.brand[href="#"]']) {
    expect(click(landing.querySelector(sel)!).defaultPrevented, sel).toBe(true);
  }
  // Learn's own handler still gets the click first: the demo's routing follows it
  const learn = frame('learn');
  const faq = [...learn.querySelectorAll('.tab')].find((t) => t.textContent === 'FAQs')!;
  expect(click(faq).defaultPrevented).toBe(true);
  expect(learn.querySelector('.tab[aria-current=page]')!.textContent).toBe('FAQs');
  expect(click(learn.querySelector('a.brand')!).defaultPrevented).toBe(true);
});

test("Learn's routing props are set once, where the demo renders it, not also in its samples", () => {
  expect(Object.keys(demoProps('Learn')).filter((k) => ['page', 'post', 'learnPageHref', 'onNavigate'].includes(k))).toEqual([]);
});
