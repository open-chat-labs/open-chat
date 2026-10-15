// Page-wide behaviours the components rely on: Enter/Space on role=button|tab|switch… spans, focus handling for
// hand-built modals (a11y.js) and the themed tooltip for every [title] (tooltip.js). Idempotent and SSR-safe.
import { installA11y } from './a11y.js';
import { installTooltips } from './tooltip.js';

export { installA11y, installTooltips };

export function installBehaviours() {
  installA11y();
  installTooltips();
}
