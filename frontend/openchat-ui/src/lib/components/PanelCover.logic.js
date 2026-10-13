// Logic for PanelCover.svelte — carried over from lib/PanelCover.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const MASKS = {
  favourite: "var(--icon-heart) center/contain no-repeat",
  close: "var(--icon-close) center/contain no-repeat",
  share: "var(--icon-share) center/contain no-repeat",
  edit: "var(--icon-edit) center/contain no-repeat",
  manage: "var(--icon-manage) center/contain no-repeat",
  info: "var(--icon-info) center/contain no-repeat",
  more: "var(--icon-more) center/contain no-repeat",
  invite: "var(--icon-invite) center/contain no-repeat",
};

class Component extends DCLogic {
  renderVals() {
    const handlers = this.props.handlers ?? {};
    const given = this.props.actions;
    const trail = this.props.trailActions ?? (given ? undefined : ["favourite"]);
    // explicit lead/trail when given; otherwise the legacy "close sits opposite" split
    const lead = given ?? ["close"];
    const legacy = !trail;
    const leadNames = legacy ? lead.filter(n => n !== "close") : lead;
    const trailNames = legacy ? lead.filter(n => n === "close") : trail;
    const build = n => ({ mask: MASKS[n] || MASKS.close, onPress: handlers[n] });
    return {
      cover: this.props.cover || "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)",
      leadActions: leadNames.map(build),
      trailActions: trailNames.map(build),
    };
  }
}

export default Component;
