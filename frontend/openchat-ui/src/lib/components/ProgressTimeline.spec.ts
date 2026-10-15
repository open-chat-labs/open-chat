import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import ProgressTimeline, { type TimelineStep } from './ProgressTimeline.svelte';

const steps = (...states: TimelineStep['state'][]): TimelineStep[] =>
  states.map((state, i) => ({ label: `Step ${i + 1}`, state, hint: `hint ${i + 1}`, error: state === 'failed' ? `error ${i + 1}` : undefined, meta: state === 'done' ? `0:0${i + 1}` : undefined }));

describe('ProgressTimeline', () => {
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
    app = mount(ProgressTimeline, { target, props });
    flushSync();
  }
  const barText = () => target.querySelector('.bar-text')?.textContent ?? null;
  const rows = () => [...target.querySelectorAll('[role=listitem]')];

  test('the bar reads the active step out of all, with elapsed on its right', () => {
    show({ steps: steps('done', 'active', 'todo', 'todo'), elapsed: '0:12' });
    expect(barText()).toBe('Step 2 of 40:12');
    const bar = target.querySelector('[role=progressbar]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(bar.getAttribute('aria-label')).toBe('Step 2 of 4');
  });

  test('every step stays visible: done shows its time, active reads "now" with its hint, todo its number', () => {
    show({ steps: steps('done', 'active', 'todo') });
    const [done, active, todo] = rows();
    expect(done.querySelector('.meta')!.textContent).toBe('0:01');
    expect(done.querySelector('.note')).toBeNull();
    expect(active.getAttribute('aria-current')).toBe('step');
    expect(active.querySelector('.meta')!.textContent).toBe('now');
    expect(active.querySelector('.note')!.textContent).toBe('hint 2');
    expect(todo.querySelector('.num')!.textContent).toBe('3');
    expect(todo.querySelector('.note')).toBeNull();
  });

  test('a failed step shows its error, and the bar says where it stopped', () => {
    show({ steps: steps('done', 'failed', 'todo') });
    expect(rows()[1].querySelector('.note')!.textContent).toBe('error 2');
    expect(barText()).toBe('Stopped at step 2 of 3');
  });

  test('all done', () => {
    show({ steps: steps('done', 'done') });
    expect(barText()).toBe('2 of 2 steps');
    unmount(app);
    show({ steps: steps('done') });
    expect(barText()).toBe('1 of 1 step');
  });

  test('the funds line says where the money is; showBar false hides the bar', () => {
    show({ steps: steps('active'), funds: { text: '100 CHAT is at ICPSwap', tone: 'warn' }, showBar: false });
    const funds = target.querySelector('[role=status]')!;
    expect(funds.querySelector('.funds-text')!.textContent).toBe('100 CHAT is at ICPSwap');
    expect(funds.classList.contains('warn')).toBe(true);
    expect(target.querySelector('[role=progressbar]')).toBeNull();
  });

  test('older grouped phases are flattened into steps (a phase error goes to its failed step)', () => {
    show({
      phases: [
        { title: 'Send', steps: [{ label: 'Approve', state: 'done' }, { label: 'Transfer', state: 'done' }] },
        { title: 'Swap', error: 'Price moved', steps: [{ label: 'Swap CHAT for ICP', state: 'failed' }] },
        { title: 'Return to your wallet' },
      ],
    });
    expect(rows().map((r) => r.querySelector('.label')!.textContent)).toEqual(['Approve', 'Transfer', 'Swap CHAT for ICP', 'Return to your wallet']);
    expect(rows()[2].querySelector('.note')!.textContent).toBe('Price moved');
    expect(barText()).toBe('Stopped at step 3 of 4');
  });
});
