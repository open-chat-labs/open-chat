// Logic for BotDialog.svelte — carried over from lib/BotDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const BOT = "var(--icon-bot) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";
const ARROW = "var(--icon-arrow) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const WARN = "var(--icon-warning) center/contain no-repeat";
const DOWNLOAD = "var(--icon-receive) center/contain no-repeat";
const CHAT = "var(--icon-chat) center/contain no-repeat";
const LOCK = "var(--icon-lock) center/contain no-repeat";
const MESSAGE = "var(--icon-message) center/contain no-repeat";

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  rose: "linear-gradient(140deg,#FF6B8B,#C13584)",
  plum: "linear-gradient(140deg,#B06BFF,#6A2BFF)",
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
};

// permission vocabulary — the two scopes a bot can be granted in a chat
const PERMS = {
  read: { label: "Read messages", scope: "chat" },
  summary: { label: "Read chat summary", scope: "chat" },
  members: { label: "Read members", scope: "chat" },
  pinned: { label: "Read pinned messages", scope: "chat" },
  threads: { label: "Read thread replies", scope: "chat" },
  react: { label: "React to messages", scope: "chat" },
  send: { label: "Send text messages", scope: "message" },
  images: { label: "Send images and files", scope: "message" },
  remove: { label: "Delete messages", scope: "message", risky: true },
  pin: { label: "Pin messages", scope: "message", risky: true },
  everyone: { label: "Mention all members", scope: "message", risky: true },
};

const CAN_DO = {
  read: { text: "reads messages" },
  summary: { text: "reads chat summaries" },
  threads: { text: "reads thread replies" },
  pinned: { text: "reads pinned messages" },
  members: { text: "sees who's here" },
  send: { text: "posts messages" },
  images: { text: "posts images and files" },
  remove: { text: "delete messages", risky: true },
  pin: { text: "pin messages", risky: true },
  everyone: { text: "mention everyone", risky: true },
};
const CAN_DO_ORDER = ["read", "summary", "threads", "pinned", "members", "send", "images", "remove", "pin", "everyone"];

// each bot declares the permissions it asks for and which ones every command needs
const CATALOG = {
  ReminderBot: {
    creator: "@jane_smith", color: "slate",
    description: "Sends one-off and recurring reminder messages into this chat.",
    perms: ["read", "send"],
    commands: [
      { name: "/remind_at", about: "One-off reminder at a date and time", needs: ["send"] },
      { name: "/remind_recurring", about: "Repeating reminder on a schedule", needs: ["send"] },
      { name: "/list_reminders", about: "Show every reminder set in this chat", needs: ["read", "send"] },
      { name: "/delete_reminder", about: "Cancel a reminder you set", needs: ["read"] },
    ],
  },
  LlamaBot: {
    creator: "@openchat_labs", color: "slate",
    description: "Sends prompts to the Llama 3 LLM and posts the reply in the thread.",
    perms: ["read", "summary", "send"],
    commands: [
      { name: "/ask", about: "Answer a question in the thread", needs: ["send"] },
      { name: "/summarise", about: "Summarise the recent conversation", needs: ["summary", "send"] },
    ],
  },
  WelcomeBot: {
    creator: "@jane_smith", color: "plum",
    description: "Greets new members with a custom message when they join.",
    perms: ["read", "send"],
    commands: [
      { name: "/set_welcome", about: "Set the message new members see", needs: ["send"] },
      { name: "/preview_welcome", about: "Show the current welcome message", needs: ["read"] },
    ],
  },
  YoutubeBot: {
    creator: "@tubetools", color: "rose",
    description: "Subscribe to a YouTube channel to get updates about new video releases.",
    perms: ["send"],
    commands: [
      { name: "/subscribe", about: "Follow a channel and post its new videos", needs: ["send"] },
      { name: "/unsubscribe", about: "Stop following a channel", needs: ["send"] },
    ],
  },
  DiscordBot: {
    creator: "@bridgeworks", color: "blue",
    description: "Proxy messages from your Discord community into OpenChat.",
    perms: ["read", "send"],
    commands: [
      { name: "/link_channel", about: "Bridge a Discord channel to this chat", needs: ["send"] },
      { name: "/unlink_channel", about: "Remove a bridged channel", needs: ["read"] },
    ],
  },
  AdventureBot: {
    creator: "@mira_dev", color: "amber",
    description: "Play a selection of classic text-based adventures in chat.",
    perms: ["read", "send", "images", "react"],
    commands: [
      { name: "/play", about: "Start an adventure in this chat", needs: ["send"] },
      { name: "/inventory", about: "Show what your party is carrying", needs: ["read", "send"] },
      { name: "/quit", about: "End the current game", needs: ["read"] },
    ],
  },
  ModerationBot: {
    creator: "@openchat_labs", color: "teal",
    description: "Performs automated moderation using rules you configure.",
    perms: ["read", "summary", "members", "pinned", "threads", "send", "remove", "pin", "everyone"],
    commands: [
      { name: "/watchlist", about: "Manage the words and links it acts on", needs: ["read"] },
      { name: "/purge", about: "Remove the last N messages from a member", needs: ["remove"] },
      { name: "/pin_rules", about: "Pin the group rules to the top", needs: ["pin"] },
    ],
  },
};

const FALLBACK = {
  creator: "@openchat_labs", color: "slate",
  description: "This bot has not published a description yet.",
  perms: ["read", "send"],
  commands: [{ name: "/help", about: "List what this bot can do", needs: ["send"] }],
};

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = { step: null, granted: null, closing: false, confirmRemove: false };

  componentWillUnmount() { clearTimeout(this._t); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  renderVals() {
    const bot = this.props.bot ?? {};
    const name = bot.name ?? bot.title ?? "ReminderBot";
    const spec = CATALOG[name] ?? FALLBACK;
    const installed = this.props.installed ?? false;
    const viewOnly = !!this.props.readOnly && installed;
    const step = this.state.step ?? this.props.initialStep ?? "details";
    const isConfigure = step === "configure";
    const isRemove = step === "remove";
    const groupName = this.props.groupName ?? "this group";

    // every permission starts granted; revoking one greys out the commands that need it
    const granted = this.state.granted ?? spec.perms.reduce((acc, k) => { acc[k] = true; return acc; }, {});
    const asked = spec.perms.map(k => ({ key: k, label: PERMS[k].label, scope: PERMS[k].scope, risky: !!PERMS[k].risky }));
    const riskyAsked = asked.filter(p => p.risky);
    const listNames = riskyAsked.map(p => p.label.toLowerCase());
    const riskyNames = listNames.length > 1
      ? listNames.slice(0, -1).join(", ") + " and " + listNames[listNames.length - 1]
      : (listNames[0] || "");

    const groupOf = scope => {
      const items = asked.filter(p => p.scope === scope);
      return items.map((p, i) => ({
        label: p.label,
        ink: granted[p.key] ? "var(--ink,#E4E4EC)" : "var(--ink-4,#7C7C8C)",
        on: granted[p.key],
        risky: p.risky,
        divider: i === items.length - 1 ? "transparent" : "var(--line-1,rgba(255,255,255,.07))",
        onChange: on => this.setState({ granted: Object.assign({}, granted, { [p.key]: on }) }),
      }));
    };

    const groups = [
      { label: "IN THIS CHAT", mask: CHAT, items: groupOf("chat") },
      { label: "FOR MESSAGES", mask: MESSAGE, items: groupOf("message") },
    ].filter(g => g.items.length > 0);

    // view-only: commands the bot can't run here are simply left out
    const runnable = viewOnly ? spec.commands.filter(c => !c.needs.some(k => granted[k] === false)) : spec.commands;
    const commands = runnable.map((c, i) => {
      const blocked = isConfigure && c.needs.some(k => granted[k] === false);
      return {
        name: c.name,
        about: c.about,
        divider: i === runnable.length - 1 ? "transparent" : "var(--line-1,rgba(255,255,255,.07))",
        blocked,
        allowed: !blocked,
      };
    });
    const blocked = commands.filter(c => c.blocked);

    const primaryLabel = isRemove ? "Remove bot" : isConfigure
      ? (installed ? "Save permissions" : "Install into group")
      : (installed ? "Edit permissions" : "Choose permissions");

    return {
      botName: name,
      groupName,
      creator: spec.creator,
      description: bot.description ?? spec.description,
      botGradient: GRADIENTS[bot.color ?? spec.color] ?? GRADIENTS.slate,
      installed,
      isDetails: !isConfigure && !isRemove,
      isRemove,
      primaryBg: isRemove ? "var(--status-danger,#FF5A5F)" : "var(--accent,#FF5672)",
      primaryInk: isRemove ? "#fff" : "var(--on-accent,#2E0512)",
      removeFacts: [
        { text: "Its commands stop working for everyone in " + groupName + ".", mask: WARN, ink: "var(--status-danger,#FF5A5F)" },
        { text: "The permissions you granted are revoked.", mask: "var(--icon-lock) center/contain no-repeat", ink: "var(--ink-3,#9A9AA8)" },
        { text: "You can reinstall it later from Bots.", mask: "var(--icon-rotate-back) center/contain no-repeat", ink: "var(--ink-3,#9A9AA8)" },
      ].map((r, i) => Object.assign(r, { divider: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none" })),
      isConfigure,
      headerTitle: isRemove ? "Remove bot" : isConfigure ? (installed ? "Bot permissions" : "Install a bot") : "Bot details",
      headerSub: isConfigure && !installed ? "Step 2 of 2 · " + name + " in " + groupName : name + " · " + groupName,
      commandsLabel: "COMMANDS · " + runnable.length,
      viewOnly, notViewOnly: !viewOnly,
      // one plain-language sentence for everyone; the parts that act on people's messages are highlighted
      ...(() => {
        const on = CAN_DO_ORDER.filter(k => spec.perms.indexOf(k) !== -1 && granted[k] !== false);
        const list = a => a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : (a[0] || "");
        const plain = list(on.filter(k => !CAN_DO[k].risky).map(k => CAN_DO[k].text));
        const risky = list(on.filter(k => CAN_DO[k].risky).map(k => CAN_DO[k].text));
        const verb = installed ? "" : "Asks to ";
        const lead = plain
          ? (verb ? verb + plain.replace(/(^|, | and )(reads|sees|posts)/g, (m, p, v) => p + ({ reads: "read", sees: "see", posts: "post" })[v]) : plain.charAt(0).toUpperCase() + plain.slice(1)) + " in " + groupName + (risky ? (installed ? ", and can also " : ", and to ") : "")
          : (installed ? "Can " : "Asks to ");
        return { plainLead: lead, plainRisky: risky };
      })(),
      commands,
      groups,
      hasBlocked: blocked.length > 0,
      blockedTitle: blocked.length === 1 ? "1 command will stop working" : blocked.length + " commands will stop working",
      blockedBody: blocked.map(c => c.name).join(", ") + " need" + (blocked.length === 1 ? "s" : "") + " a permission you revoked. You can grant it again at any time.",
      summaryVerb: installed ? "Has" : "Asks for",
      permCountLabel: (installed ? Object.keys(granted).filter(k => granted[k]).length : asked.length) === 1
        ? "1 permission"
        : (installed ? Object.keys(granted).filter(k => granted[k]).length : asked.length) + " permissions",
      riskyClause: riskyAsked.length ? ", including " : "",
      riskyNames,
      lockMask: LOCK,
      showInstallTarget: !installed,
      detailsFootnote: installed
        ? (viewOnly ? name + " is installed in " + groupName + ". Only admins can change its permissions or remove it."
          : name + " is installed in " + groupName + ". Editing permissions changes what it can do here.")
        : "Installing adds " + name + " to " + groupName + ". You choose which permissions to grant on the next step.",
      configureFootnote: "By " + (installed ? "saving" : "installing") + ", " + name + " can act in " + groupName + " with the permissions above.",
      secondaryLabel: isConfigure || isRemove ? "Back" : viewOnly ? "Close" : "Cancel",
      botName: name, groupName,
      trashMask: "var(--icon-trash) center/contain no-repeat",
      // view-only: people without bot rights can read the details but not remove or change permissions
      canRemove: installed && !isConfigure && !!this.props.onRemove && !viewOnly,
      showPrimary: !viewOnly,
      confirmingRemove: this.state.confirmRemove,
      removeTitle: this.state.confirmRemove ? "Remove " + name + "?" : "Remove from " + groupName,
      removeBody: "Its commands stop working and its permissions are revoked.",
      notConfirming: !this.state.confirmRemove,
      askRemove: () => this.setState({ step: "remove" }),
      cancelRemove: () => this.setState({ confirmRemove: false }),
      confirmRemove: () => this._close(() => { if (this.props.onRemove) this.props.onRemove({ name }); }),
      primaryLabel,
      primaryMask: isRemove ? "var(--icon-trash) center/contain no-repeat" : isConfigure ? (installed ? CHECK : DOWNLOAD) : ARROW,
      onSecondary: isConfigure || isRemove ? () => this.setState({ step: "details" }) : () => this._close(this.props.onCancel),
      onPrimary: isRemove
        ? () => this._close(() => { if (this.props.onRemove) this.props.onRemove({ name }); })
        : isConfigure
        ? () => this._close(() => {
            if (this.props.onInstall) this.props.onInstall({ name, color: bot.color ?? spec.color, description: bot.description ?? spec.description, granted });
            else if (this.props.onCancel) this.props.onCancel();
          })
        : () => this.setState({ step: "configure" }),
      onCancel: () => this._close(this.props.onCancel),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
      botMask: BOT,
      closeMask: CLOSE,
      arrowMask: ARROW,
      checkMask: CHECK,
      warnMask: WARN,
    };
  }
}

export default Component;
