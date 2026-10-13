// Logic for IconButton.svelte — carried over from lib/IconButton.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// public icon keys → canonical names in lib/icons.js
const ICONS = {
  "back": "back",
  "userPlus": "invite",
  "search": "search",
  "send": "send",
  "mic": "mic",
  "mic-off": "mic-off",
  "plus": "plus",
  "emoji": "emoji",
  "bell": "bell",
  "more": "more",
  "close": "close",
  "video": "video",
  "phone": "phone",
  "heart": "heart",
  "share": "share",
  "edit": "edit",
  "trash": "trash",
  "pin": "pin",
  "users": "users",
  "reply": "reply",
  "image": "image",
  "check": "check",
  "check-double": "check-double",
  "verified": "verified",
  "threads": "threads",
  "chevron-down": "chevron-down",
  "chevron-right": "chevron-right"
};

// any canonical name from lib/icons.js works too; the local keys are legacy aliases
const CANON = new Set(["arrow","arrow-down","arrow-up","at","at-off","back","balance","ban","bell","bell-off","bookmark","bot","camera","chat","check","check-double","chevron-down","chevron-right","chevron-up","chit","circle","circle-check","clock","close","coin","coins","community","compass","copy","credential","currency","device","diamond","diamond-outline","disk","dm","dot","dot-heavy","download","edit","embed","emoji","eth","everyone-off","exit","external","eye","eye-off","failed","file","flag","flame","forward","gate","gear","gem","gif","gift","globe","group","hash","heart","heart-filled","hidden","history","home","hook","ii","image","import","info","invite","joystick","kebab","key","lang","layers","leave","link","list","lock","lock-open","mail","manage","map","message","messages","mic","mic-off","more","mute-off","neuron","news","nfid","nft","offline","panel","party","passkey","paste","payment","person","phone","pin","play","plus","poll","qr","receive","refresh","reply","rotate-back","rules","search","send","share","shield","sol","spark","sparkle","spin","star","stop","swap","threads","timer","token","trash","trophy","unlink","user","user-minus","users","verified","video","wallet","wallet-send","warning","zap"]);
class Component extends DCLogic {
  renderVals() {
    const LABELS = { back: "Back", close: "Close", more: "More options", kebab: "More options", search: "Search", plus: "Add", userPlus: "Add members", copy: "Copy", share: "Share", edit: "Edit", settings: "Settings", bell: "Notifications", send: "Send", menu: "Menu" };
    const iconKey = this.props.icon ?? "back";
    const ariaLabel = this.props.label || LABELS[iconKey] || String(iconKey).replace(/([a-z])([A-Z])/g, (m, a, b) => a + " " + b).replace(/^./, c => c.toUpperCase());
    const st = this.props.state ?? "default";
    const boxSize = (this.props.variant ?? "surface") === "accent" ? "36px" : "34px";
    const on = st === "hover";
    const ring = st === "focus" ? "0 0 0 3px var(--accent-dim,rgba(255,86,114,.35))" : (st === "active" ? "inset 0 2px 6px rgba(0,0,0,.32)" : "none");
    const press = st === "active" ? "scale(.94)" : "none";
    const variant = this.props.variant ?? "surface";
    const iconName = this.props.icon ?? "search";
    const paths = ICONS[iconName] ?? (CANON.has(iconName) ? iconName : ICONS.search);
    return {
      ariaLabel,
      onPress: this.props.onClick,
      boxSize,
      focusRing: ring,
      pressTransform: press,
      surfaceBg: on ? "var(--btn-hover,rgba(255,255,255,.1))" : "var(--overlay-1,rgba(255,255,255,.05))",
      // ghost: bare at rest, tint on hover; pressed keeps the tint so open states (menu, panel) stay visible
      ghostBg: on || this.props.pressed ? "var(--btn-hover,rgba(255,255,255,.1))" : "transparent",
      ghostInk: on || this.props.pressed ? "var(--ink,#ECECF1)" : "var(--ink-2,#B9B9C6)",
      accentBg: on ? "var(--accent-hover,#ff6d85)" : "var(--accent,#FF5672)",
      overlayBg: on ? "var(--btn-hover,rgba(255,255,255,.1))" : "var(--card-2,#191921)",
      overlayRing: "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))" + (ring === "none" ? "" : "," + ring),
      maskCss: "var(--icon-" + paths + ") center/contain no-repeat",
      isSurface: variant === "surface",
      isGhost: variant === "ghost",
      isAccent: variant === "accent",
      isOverlay: variant === "overlay",
    };
  }
}

export default Component;
