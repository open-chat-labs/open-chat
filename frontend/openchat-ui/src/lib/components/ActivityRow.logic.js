// Logic for ActivityRow.svelte — carried over from lib/ActivityRow.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    const preview = this.props.preview ?? "";
    const reactions = this.props.reactions ?? [];
    const unread = this.props.unread ?? false;
    return {
      title: this.props.title ?? "",
      context: this.props.context ?? "",
      preview,
      hasPreview: !!preview,
      reactions,
      hasReactions: reactions.length > 0,
      time: this.props.time ?? "",
      unread,
      color: this.props.color ?? "violet",
      // channels and groups read as squircles, people as circles
      avatarShape: this.props.kind === "group" ? "squircle" : "circle",
      rowBg: unread ? "var(--overlay-1,rgba(255,255,255,.035))" : "transparent",
      onPress: this.props.onClick,
    };
  }
}

export default Component;
