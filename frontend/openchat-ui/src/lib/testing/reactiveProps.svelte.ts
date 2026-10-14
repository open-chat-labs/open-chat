// Test helper: props a spec can change after mount (mount(C, { target, props: reactiveProps({ … }) }), then assign
// to them and flushSync()). A plain .spec.ts can't create $state itself, so it borrows this module's runes.
export function reactiveProps<T extends Record<string, unknown>>(initial: T): T {
  const props = $state(initial);
  return props;
}
