// Logic for AuthDialog.svelte — carried over from lib/AuthDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  passkey: "var(--icon-passkey) center/contain no-repeat",
  ii: "var(--icon-ii) center/contain no-repeat",
  eth: "var(--icon-eth) center/contain no-repeat",
  sol: "var(--icon-sol) center/contain no-repeat",
  nfid: "var(--icon-nfid) center/contain no-repeat",
  mail: "var(--icon-mail) center/contain no-repeat",
  send: "var(--icon-send) center/contain no-repeat",
  search: "var(--icon-search) center/contain no-repeat",
  close: "var(--icon-close) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
  dots: "var(--icon-more) center/contain no-repeat",
  back: "var(--icon-back) center/contain no-repeat",
};
const OTHERS = [
  { key: "ii", name: "Internet Identity", short: "Internet ID", mask: M.ii, wait: "Finish in the Internet Identity window" },
  { key: "eth", name: "Ethereum", mask: M.eth, wait: "Approve the signature request in your wallet" },
  { key: "sol", name: "Solana", mask: M.sol, wait: "Approve the signature request in your wallet" },
  { key: "nfid", name: "NFID (Legacy)", short: "NFID", mask: M.nfid, loginOnly: true, wait: "Finish in the NFID window" },
];
const PEOPLE = [
  { name: "Hamish", handle: "hamish", grad: "linear-gradient(140deg,#8B7BFF,#5B3FD9)" },
  { name: "Ana Ribeiro", handle: "ana_r", grad: "linear-gradient(140deg,#5CB8FF,#2F6BFF)" },
  { name: "Julian", handle: "julian_jelfs", grad: "linear-gradient(140deg,#2EE6A8,#1FA6B8)" },
  { name: "Matt Grogan", handle: "matt", grad: "linear-gradient(140deg,#FFC061,#F58A2E)" },
  { name: "Hannah", handle: "hannah_k", grad: "linear-gradient(140deg,#FF8FA8,#E0456A)" },
];
const TAKEN = ["openchat", "hamish", "admin", "julian_jelfs", "matt"];
class Component extends DCLogic {
  state = { kind: null, step: "methods", wait: null, email: "", username: "", checked: null, refQuery: "", referrer: null };
  componentDidMount() { this._esc = e => { if (e.key === "Escape" && !this.props.inline) this.close(); }; document.addEventListener("keydown", this._esc); }
  componentWillUnmount() { clearTimeout(this._t); clearTimeout(this._u); document.removeEventListener("keydown", this._esc); }
  kind() { return this.state.kind ?? this.props.kind ?? "login"; }
  close = () => { clearTimeout(this._t); this.props.onClose && this.props.onClose(); };
  finish = k => { this.props.onDone && this.props.onDone(k); };
  pick = k => { if (this.state.wait) return; this.setState({ wait: k }); this._t = setTimeout(() => this.finish(k), 1600); };
  renderVals() {
    const s = this.state, signup = this.kind() === "signup", w = s.wait;
    const step = signup && s.step === "methods" && !s.formDone ? "form" : s.step;
    const verb = signup ? "Continue with " : "Sign in with ";
    const uname = s.username, valid = /^[A-Za-z0-9_]{5,20}$/.test(uname);
    const taken = valid && s.checked === uname.toLowerCase() && TAKEN.includes(uname.toLowerCase());
    const ok = valid && s.checked === uname.toLowerCase() && !taken;
    let userMsg = "", userMsgInk = "var(--ink-4,#7C7C8C)";
    if (uname && /[^A-Za-z0-9_]/.test(uname)) { userMsg = "Only letters, numbers and underscores"; userMsgInk = "var(--status-error,#F5493D)"; }
    else if (uname && uname.length < 5) userMsg = "At least 5 characters";
    const chip = taken ? { label: "Taken", bg: "color-mix(in oklch,var(--status-error,#F5493D) 16%,transparent)", ink: "var(--status-error,#F5493D)", mask: M.close }
      : ok ? { label: "Available", bg: "color-mix(in oklch,var(--status-online,#2EE6A8) 16%,transparent)", ink: "var(--status-online,#2EE6A8)", mask: M.check }
      : valid ? { label: "Checking", bg: "var(--overlay-2,rgba(255,255,255,.08))", ink: "var(--ink-3,#9A9AA8)", mask: M.dots } : null;
    const emailOk = /^\S+@\S+\.\S+$/.test(s.email);
    const q = s.refQuery.trim().toLowerCase();
    const refResults = q ? PEOPLE.filter(p => p.name.toLowerCase().includes(q) || p.handle.includes(q)).slice(0, 4).map(p => Object.assign({}, p, { pick: () => this.setState({ referrer: p, refQuery: "" }) })) : [];
    const waitM = w && (w === "passkey" ? { wait: signup ? "Create the passkey when your browser asks" : "Choose your passkey when your browser asks" } : OTHERS.find(o => o.key === w));
    const variant = this.props.variant ?? "grid", inline = !!this.props.inline, split = variant === "split";
    return {
      backdropStyle: inline ? "position:relative;display:flex;justify-content:center" : "position:fixed;inset:0;z-index:200;display:flex;padding:24px;overflow-y:auto;background:var(--scrim);backdrop-filter:blur(6px)",
      cardMax: split ? "820px" : variant === "grid" ? "540px" : "460px", cardMaxH: inline ? "none" : "calc(100vh - 48px)", cardCols: split ? "minmax(0,5fr) minmax(0,7fr)" : "minmax(0,1fr)",
      cardMinH: variant !== "grid" ? "0" : "548px",
      passkeyTop: variant === "grid" && !signup ? "16px" : "0",
      colGap: variant === "grid" ? "32px" : "24px", methodsGap: variant === "grid" ? (signup ? "14px" : "20px") : "10px",
      isSplit: split, notSplit: !split, isGrid: variant === "grid", notGrid: variant !== "grid",
      moreLabel: signup ? "OR CONTINUE WITH" : "MORE WAYS TO SIGN IN",
      close: this.close, stop: e => e.stopPropagation(),
      title: signup ? (step === "form" ? "Create your account" : "Secure your account") : "Sign in to OpenChat",
      sub: step === "methods" && signup ? "Choose how you'll sign in as @" + uname + "." : (this.props.reason || "Fully featured. Fully secure."),
      canBack: (signup && step === "methods") || step === "sent",
      back: () => { clearTimeout(this._t); this.setState(step === "sent" ? { step: "methods", wait: null } : { formDone: false, step: "methods", wait: null }); },
      backMask: M.back, closeMask: M.close, mailMask: M.mail, sendMask: M.send, searchMask: M.search,
      showMethods: step === "methods", showSent: step === "sent", showForm: step === "form",
      showEmail: !signup,
      passkey: { label: signup ? "Create a passkey" : "Sign in with Passkey", mask: M.passkey, disabled: !!w, op: w && w !== "passkey" ? .45 : 1, pick: () => this.pick("passkey") },
      others: OTHERS.filter(o => !(signup && o.loginOnly)).map(o => ({ label: verb + o.name, short: o.short || o.name, mask: o.mask, disabled: !!w, op: w && w !== o.key ? .45 : 1, pick: () => this.pick(o.key) })),
      hasWait: !!waitM, waitText: waitM ? waitM.wait + "…" : "",
      busy: !!w, emailOp: w ? .45 : 1,
      email: s.email, onEmail: e => this.setState({ email: e.target.value }),
      emailDisabled: !emailOk || !!w,
      sendBg: emailOk ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.08))", sendInk: emailOk ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      sendEmail: e => { e.preventDefault(); if (emailOk && !w) this.setState({ step: "sent" }); },
      simulateLink: () => this.finish("email"),
      username: uname, userLeft: 20 - uname.length,
      onUsername: e => { const v = e.target.value; this.setState({ username: v, checked: null }); clearTimeout(this._u); if (/^[A-Za-z0-9_]{5,20}$/.test(v)) this._u = setTimeout(() => this.setState({ checked: v.toLowerCase() }), 450); },
      hasUserMsg: !!userMsg, userMsg, userMsgInk, hasChip: !!chip, chip: chip || {},
      userRing: taken || userMsgInk.includes("error") ? "inset 0 0 0 1px var(--status-error,#F5493D)" : ok ? "inset 0 0 0 1px color-mix(in oklch,var(--status-online,#2EE6A8) 60%,transparent)" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))",
      refQuery: s.refQuery, onRefQuery: e => this.setState({ refQuery: e.target.value }),
      refResults, hasRefResults: refResults.length > 0,
      referrer: s.referrer || {}, hasReferrer: !!s.referrer, noReferrer: !s.referrer,
      clearReferrer: () => this.setState({ referrer: null }),
      cantProceed: !ok, proceedBg: ok ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.08))", proceedInk: ok ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)", proceedCursor: ok ? "pointer" : "not-allowed",
      proceed: e => { e.preventDefault(); if (ok) this.finish("signup"); },
      switchText: signup ? "Already have an account?" : "New to OpenChat?",
      switchCta: signup ? "Sign in" : "Create an account",
      switchKind: () => { clearTimeout(this._t); this.setState({ kind: signup ? "login" : "signup", step: "methods", formDone: false, wait: null }); },
    };
  }
}

export default Component;
