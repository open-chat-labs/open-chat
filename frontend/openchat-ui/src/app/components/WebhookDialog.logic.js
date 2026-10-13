// Logic for WebhookDialog.svelte — carried over from lib/WebhookDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const HOOK = "var(--icon-hook) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";
const COPY = "var(--icon-copy) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const WARN = "var(--icon-warning) center/contain no-repeat";
const CYCLE = "var(--icon-refresh) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-right) center/contain no-repeat";
const EDIT = "var(--icon-edit) center/contain no-repeat";

const GRADIENTS = {
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  plum: "linear-gradient(140deg,#B06BFF,#6A2BFF)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  rose: "linear-gradient(140deg,#FF6B8B,#C13584)",
};

const HOST = "https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/";
const secret = () => {
  let s = "";
  while (s.length < 32) s += Math.floor(Math.random() * 16).toString(16);
  return s.slice(0, 32);
};

const VALID = /^[A-Za-z0-9_]+$/;
const NAME_MAX = 30;

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = { name: null, color: null, url: null, view: "form", copied: false, regenerated: false, closing: false, avatarUrl: null };

  _avatarInput = React.createRef();
  _freshUrl = HOST + secret();

  componentWillUnmount() { clearTimeout(this._t); clearTimeout(this._c); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  renderVals() {
    const hook = this.props.webhook ?? {};
    const isEdit = (this.props.dialogMode ?? "register") === "edit";
    const name = this.state.name ?? hook.name ?? (isEdit ? "ci_builds" : "");
    const color = this.state.color ?? hook.color ?? "slate";
    const url = this.state.url ?? hook.url ?? this._freshUrl;
    const isConfirm = this.state.view === "confirm";
    const groupName = this.props.groupName ?? "this group";
    const valid = VALID.test(name);
    const dirty = name.length > 0;
    const photo = this.state.avatarUrl ?? hook.avatarUrl ?? null;

    const colors = Object.keys(GRADIENTS).map(key => ({
      label: key,
      gradient: GRADIENTS[key],
      ring: key === color
        ? "0 0 0 2px var(--surface-1,#0e0e12), 0 0 0 4px var(--accent,#FF5672)"
        : "inset 0 0 0 1px var(--line-2)",
      onSelect: () => this.setState({ color: key }),
    }));

    const save = () => {
      if (!valid) return;
      this._close(() => {
        if (this.props.onSave) this.props.onSave({ name, color, url, avatarUrl: photo, isNew: !isEdit });
        else if (this.props.onCancel) this.props.onCancel();
      });
    };

    return {
      groupName,
      isEdit,
      isRegister: !isEdit,
      isForm: !isConfirm,
      isConfirm,
      headerTitle: isConfirm ? "Regenerate the URL" : (isEdit ? name : "Register a webhook"),
      headerSub: isConfirm ? name + " · " + groupName : (isEdit ? "Webhook in " + groupName : groupName),
      showAvatarTile: isEdit && !isConfirm,
      showAccentTile: !isEdit && !isConfirm,
      name,
      nameLeft: NAME_MAX - name.length,
      onName: e => this.setState({ name: e.target.value.slice(0, NAME_MAX) }),
      nameHint: dirty && !valid
        ? "Letters, numbers and underscores only — no spaces or punctuation."
        : "Must be unique in this chat. Letters, numbers and underscores only.",
      hintInk: dirty && !valid ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      fieldLine: dirty && !valid ? "var(--status-danger,#F5493D)" : "var(--line-1,rgba(255,255,255,.07))",
      gradient: GRADIENTS[color] ?? GRADIENTS.slate,
      avatarImage: photo ? 'url(' + photo + ') center/cover no-repeat' : 'none',
      hasPhoto: !!photo,
      avatarRef: this._avatarInput,
      editMask: EDIT,
      onPickAvatar: () => { if (this._avatarInput.current) this._avatarInput.current.click(); },
      onAvatarFile: e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (this.state.avatarUrl) URL.revokeObjectURL(this.state.avatarUrl);
        this.setState({ avatarUrl: URL.createObjectURL(f) });
      },
      onClearAvatar: () => {
        if (this.state.avatarUrl) URL.revokeObjectURL(this.state.avatarUrl);
        this.setState({ avatarUrl: null });
      },
      colors,
      url,
      showUrl: isEdit,
      copyHint: this.state.copied ? "Copied to your clipboard" : "Click the URL to copy it",
      copyInk: this.state.copied ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#9A9AA8)",
      copyMask: this.state.copied ? CHECK : COPY,
      onCopy: () => {
        try { if (navigator.clipboard) navigator.clipboard.writeText(url); } catch (e) {}
        clearTimeout(this._c);
        this.setState({ copied: true });
        this._c = setTimeout(() => this.setState({ copied: false }), 1600);
      },
      justRegenerated: this.state.regenerated && !isConfirm,
      registerNote: "Registering gives " + groupName + " a URL your tools can post to.",
      explainerOpen: !!this.state.explainer,
      explainerLabel: this.state.explainer ? "Hide details" : "How webhooks work",
      explainerTurn: this.state.explainer ? "rotate(-90deg)" : "rotate(90deg)",
      toggleExplainer: () => this.setState({ explainer: !this.state.explainer }),
      onAskRegenerate: () => this.setState({ view: "confirm" }),
      secondaryLabel: isConfirm ? "Back" : "Cancel",
      onSecondary: isConfirm ? () => this.setState({ view: "form" }) : () => this._close(this.props.onCancel),
      primaryLabel: isConfirm ? "Regenerate URL" : (isEdit ? "Update webhook" : "Register webhook"),
      primaryMask: isConfirm ? CYCLE : (isEdit ? CHECK : HOOK),
      primaryBg: isConfirm ? "var(--status-chit,#FF9F45)" : (valid ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.09))"),
      primaryInk: isConfirm ? "#2A1600" : (valid ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)"),
      primaryCursor: isConfirm || valid ? "pointer" : "not-allowed",
      onPrimary: isConfirm
        ? () => {
            const next = HOST + secret();
            this.setState({ url: next, view: "form", regenerated: true, copied: false });
            if (this.props.onRegenerate) this.props.onRegenerate(next);
          }
        : save,
      onCancel: () => this._close(this.props.onCancel),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
      hookMask: HOOK,
      closeMask: CLOSE,
      checkMask: CHECK,
      warnMask: WARN,
      cycleMask: CYCLE,
      chevronMask: CHEVRON,
    };
  }
}

export default Component;
