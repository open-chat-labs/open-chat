// Base class + React shim for the component logic files (*.logic.js).
// The logic classes are carried over verbatim from the prototype: renderVals() returns the values the
// markup reads; setState / forceUpdate / lifecycle hooks behave like the prototype runtime.
export class DCLogic {
  constructor(props) { this.props = props; this.state = {}; }
  setState() {}
  forceUpdate() {}
}

// Only createRef is used by the library. createElement is not supported — markup belongs in the .svelte file.
export const React = {
  createRef: () => ({ current: null }),
  createElement: () => { throw new Error('React.createElement is not available in the Svelte export'); },
};
