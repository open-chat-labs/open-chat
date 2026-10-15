// use:modal={onEscape} for hand-built dialogs: joins the dialog stack DialogShell uses (window.__ocDialogs), so Esc
// closes only the topmost dialog and a11y.js knows which modal traps focus. Pass undefined (e.g. when the dialog is
// embedded in a host) to stay off the stack. An Esc an inner control already handled (defaultPrevented) is ignored.
type Entry = { boxRef: { current: HTMLElement } };

const stack = (): Entry[] => ((window as unknown as { __ocDialogs?: Entry[] }).__ocDialogs ??= []);

export function modal(node: HTMLElement, onEscape: (() => void) | undefined) {
  let handler = onEscape;
  const self: Entry = { boxRef: { current: node } };

  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !handler) return;
    const s = stack();
    if (s[s.length - 1] !== self) return;
    e.preventDefault();
    handler();
  };
  const on = () => {
    if (stack().includes(self)) return;
    stack().push(self);
    window.addEventListener('keydown', key);
  };
  const off = () => {
    window.removeEventListener('keydown', key);
    const s = stack(), i = s.indexOf(self);
    if (i >= 0) s.splice(i, 1);
  };

  if (handler) on();
  return {
    update(next: (() => void) | undefined) {
      handler = next;
      if (handler) on();
      else off();
    },
    destroy: off,
  };
}
