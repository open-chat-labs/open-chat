import { onMount, untrack } from 'svelte';

type AnyProps = Record<string, any>;

/**
 * Binds a prototype logic class to Svelte 5 runes.
 * - `v` is the merged view model: props, overridden by whatever renderVals() returns.
 * - setState/forceUpdate bump a rune so v recomputes; componentDidMount / DidUpdate / WillUnmount fire as in React.
 * Template-only components pass `null` and get the props back.
 */
export function useLogic(Cls: any, props: AnyProps): { readonly v: AnyProps } {
  if (!Cls) return { get v() { return props; } };
  const inst = untrack(() => new Cls(props));
  inst.props = props;
  let tick = $state(0);
  let prevState = inst.state;
  let prevProps: AnyProps = untrack(() => ({ ...props }));
  inst.setState = (update: any, cb?: () => void) => {
    const cur = inst.state;
    const next = typeof update === 'function' ? update(cur, inst.props) : update;
    if (next == null) { if (cb) queueMicrotask(cb); return; }
    inst.state = { ...cur, ...next };
    tick++;
    if (cb) queueMicrotask(cb);
  };
  inst.forceUpdate = (cb?: () => void) => { tick++; if (cb) queueMicrotask(cb); };

  const v = $derived.by(() => {
    tick;
    const out = inst.renderVals ? inst.renderVals() : {};
    return { ...props, ...out };
  });

  let mounted = false;
  onMount(() => {
    queueMicrotask(() => { mounted = true; inst.componentDidMount?.(); });
    return () => inst.componentWillUnmount?.();
  });
  $effect(() => {
    v;
    untrack(() => {
      if (!mounted) return;
      const ps = prevState, pp = prevProps;
      prevState = inst.state; prevProps = { ...props };
      inst.componentDidUpdate?.(pp, ps);
    });
  });

  return { get v() { return v; } };
}

/** Text output: nothing for null/undefined/booleans (matches the prototype), otherwise the string. */
export function t(x: unknown): string {
  return x == null || typeof x === 'boolean' ? '' : String(x);
}

/** use:ref={someRef} — fills a { current } ref object (React.createRef) with the element. */
export function ref(node: Element, r: { current: Element | null } | null | undefined) {
  let cur = r;
  if (cur) cur.current = node;
  return {
    update(n: typeof r) { if (cur && cur !== n) cur.current = null; cur = n; if (cur) cur.current = node; },
    destroy() { if (cur && cur.current === node) cur.current = null; },
  };
}
