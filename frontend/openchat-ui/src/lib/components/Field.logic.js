// Logic for Field.svelte — carried over from lib/Field.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    const help = this.props.help ?? "";
    // an onInput handler turns the display field into a live text input;
    // without one it stays the static placeholder chip used in the library
    const isInput = typeof this.props.onInput === "function";
    const value = this.props.value ?? "";
    const showClear = isInput && String(value).length > 0 && typeof this.props.onClear === "function";
    return {
      placeholder: this.props.placeholder ?? "Search messages, people…",
      shortcut: this.props.shortcut ?? "\u2318K",
      showIcon: this.props.showIcon ?? true,
      isInput,
      isStatic: !isInput,
      value,
      onInput: this.props.onInput,
      onClear: this.props.onClear,
      showClear,
      showShortcut: (this.props.showShortcut ?? !isInput) && !!(this.props.shortcut ?? "\u2318K") && !showClear,
      help,
      hasHelp: !!help,
    };
  }
}

export default Component;
