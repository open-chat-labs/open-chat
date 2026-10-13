// Logic for TypingIndicator.svelte — carried over from lib/TypingIndicator.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const GRADIENTS = {
  violet: "linear-gradient(140deg,#8C6BFF,#FF5EAE)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
};

class Component extends DCLogic {
  renderVals() {
    const names = this.props.names ?? ["Danielle", "Priya"];
    const colors = this.props.colors ?? ["violet", "teal"];
    const label = names.length > 1 ? names.length + " people are typing" : names[0] + " is typing";
    return {
      ringColor: this.props.ringColor ?? "var(--card,#0e0e12)",
      label: this.props.label ?? label,
      people: names.map((n, i) => ({
        gradient: GRADIENTS[colors[i % colors.length]] ?? GRADIENTS.violet,
        offset: i === 0 ? "0px" : "-9px",
      })),
    };
  }
}

export default Component;
