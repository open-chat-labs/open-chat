import {
    defaultChatPermissions,
    editableGates,
    groupChanges,
    isCompositeGate,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGateConfig,
    type ActiveLeafGate,
    type CandidateGroupChat,
    type ChatPermissionRole,
    type ChatPermissions,
    type MessagePermission,
    type MessagePermissions,
    type MultiUserChat,
    type VersionedRules,
    type OptionalChatPermissions,
    type OptionalMessagePermissions,
} from "@client";
import { DAY_MS, gateAmountText, type GateLookups } from "@src/logic/access/gateValues";
import {
    MAX_DESC_LENGTH,
    MAX_NAME_LENGTH,
    MIN_NAME_LENGTH,
} from "@src/logic/groupOrCommunity/group.svelte";
import { MAX_RULES_LENGTH } from "@src/logic/groupOrCommunity/groupOrCommunity.svelte";
import { gateLabel } from "@src/utils/access";
import type { GroupSettingsPage } from "../../router/locations";

// A group's or channel's settings pages (native plan 11), read from the group being edited (the
// shared UpdateGroupState's candidate): the Access gates card's rows and the gate settings, the
// rules' templates, the permission rows with the role each needs, and the summaries Create
// group's Settings card shows. Words come back translated through `t`.

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** A settings page's title: Edit group (or channel), or its Manage row's. */
export function pageTitle(page: GroupSettingsPage, channel: boolean, t: Translate): string {
    switch (page) {
        case "edit":
            return t(channel ? "native.details.menu.editChannel" : "native.details.menu.editGroup");
        default:
            return t(`native.details.manage.${page}`);
    }
}

/**
 * Whether a settings page can make its draft: once the chat is in, and for Rules once its rules
 * are too (they come with its details). A Rules draft made without them would hold the default
 * rules, and saving it would put those in place of the group's.
 */
export function settingsReady(
    page: GroupSettingsPage,
    chat: MultiUserChat | undefined,
    rules: VersionedRules | undefined,
): boolean {
    return chat !== undefined && (page !== "rules" || rules !== undefined);
}

// ── access gates ──

/** Gates that are a switch: on or off, nothing to set. */
export type SwitchGateKind =
    | "diamond_gate"
    | "lifetime_diamond_gate"
    | "locked_gate"
    | "credential_gate";
/** Gates set up in the gate sheet (a token or nervous system, then a value), each kind several times but CHIT. */
export type SetupGateKind =
    | "payment_gate"
    | "token_balance_gate"
    | "neuron_gate"
    | "chit_earned_gate";

// the plan's simple gates (unique person is suspended, so not offered: GAPS.md), and its gates
// with setup, in its order
const SWITCH_GATES: SwitchGateKind[] = ["diamond_gate", "lifetime_diamond_gate"];
// offered only where one is already there, so it can be seen and taken off (the plan has neither)
const KEPT_GATES: SwitchGateKind[] = ["locked_gate", "credential_gate"];
const SETUP_GATES: SetupGateKind[] = [
    "payment_gate",
    "token_balance_gate",
    "neuron_gate",
    "chit_earned_gate",
];

export type GateEntry = { gate: ActiveLeafGate; key: string; text: string };

export type GateRow =
    | { kind: "switch"; gate: SwitchGateKind; label: string; on: boolean }
    | { kind: "setup"; gate: SetupGateKind; label: string; entries: GateEntry[] };

/** The gates the editor shows: not the suspended unique-person gate, nor ones it has no row for. */
export function shownGates(config: AccessGateConfig): ActiveLeafGate[] {
    return editableGates(config.gate).shown;
}

/** An entry's identity among its kind's: its token or nervous system. */
export function gateKey(gate: ActiveLeafGate): string {
    switch (gate.kind) {
        case "payment_gate":
        case "token_balance_gate":
            return `${gate.kind}:${gate.ledgerCanister}`;
        case "neuron_gate":
            return `${gate.kind}:${gate.governanceCanister}`;
        default:
            return gate.kind;
    }
}

/** How an entry of a gate with setup reads under its row ("3 ICP", "100 CHAT or more"). */
export function gateEntryText(
    gate: ActiveLeafGate,
    lookups: GateLookups,
    t: Translate,
    locale: string,
): string {
    switch (gate.kind) {
        case "payment_gate": {
            const token = lookups.tokens.get(gate.ledgerCanister);
            return t("native.groupSettings.gates.payEntry", {
                amount: gateAmountText(gate.amount, token?.decimals),
                symbol: token?.symbol ?? gate.ledgerCanister,
            });
        }
        case "token_balance_gate": {
            const token = lookups.tokens.get(gate.ledgerCanister);
            return t("native.groupSettings.gates.balanceEntry", {
                amount: gateAmountText(gate.minBalance, token?.decimals),
                symbol: token?.symbol ?? gate.ledgerCanister,
            });
        }
        case "neuron_gate": {
            const ns = lookups.nervousSystems.get(gate.governanceCanister);
            const parts = [ns?.token.name ?? gate.governanceCanister];
            if (gate.minDissolveDelay) {
                parts.push(
                    t("native.groupSettings.gates.delayEntry", {
                        count: gate.minDissolveDelay / DAY_MS,
                    }),
                );
            }
            if (gate.minStakeE8s) {
                parts.push(
                    t("native.groupSettings.gates.stakeEntry", {
                        amount: gateAmountText(BigInt(gate.minStakeE8s), ns?.token.decimals),
                        symbol: ns?.token.symbol ?? "",
                    }),
                );
            }
            return parts.join(" · ");
        }
        case "chit_earned_gate":
            return t("native.groupSettings.gates.chitEntry", {
                amount: gate.minEarned.toLocaleString(locale),
            });
        default:
            return t(gateLabel[gate.kind]);
    }
}

/**
 * The Gates card: the switch gates, on where the group has one (a locked or credential gate only
 * where it has one), then each gate with setup with its entries.
 */
export function gateRows(
    config: AccessGateConfig,
    lookups: GateLookups,
    t: Translate,
    locale: string,
): GateRow[] {
    const shown = shownGates(config);
    const has = (kind: ActiveLeafGate["kind"]) => shown.some((g) => g.kind === kind);
    const switches: GateRow[] = [...SWITCH_GATES, ...KEPT_GATES.filter((kind) => has(kind))].map(
        (gate) => ({ kind: "switch", gate, label: t(gateLabel[gate]), on: has(gate) }),
    );
    const setups: GateRow[] = SETUP_GATES.map((gate) => ({
        kind: "setup",
        gate,
        label: t(gateLabel[gate]),
        entries: shown
            .filter((g) => g.kind === gate)
            .map((g) => ({ gate: g, key: gateKey(g), text: gateEntryText(g, lookups, t, locale) })),
    }));
    return [...switches, ...setups];
}

/** The gate a switch adds; none for a credential gate, which names a credential (it can only go). */
export function switchGate(kind: SwitchGateKind): ActiveLeafGate | undefined {
    switch (kind) {
        case "diamond_gate":
        case "lifetime_diamond_gate":
        case "locked_gate":
            return { kind };
        case "credential_gate":
            return undefined;
    }
}

/** Whether a gate with setup can have another entry: CHIT has one minimum. */
export function canAddEntry(kind: SetupGateKind, entries: number): boolean {
    return kind !== "chit_earned_gate" || entries === 0;
}

/** How the gates combine, which applies once there are two or more. */
export function gateOperator(config: AccessGateConfig): "and" | "or" {
    return isCompositeGate(config.gate) ? config.gate.operator : "and";
}

export function operatorApplies(config: AccessGateConfig): boolean {
    return isCompositeGate(config.gate);
}

/** The re-check choices, in days (0: never), as the plan has them. */
export const RECHECK_DAYS = [0, 7, 30, 90] as const;

/** How often members are re-checked, in days; 0 for never. */
export function recheckDays(config: AccessGateConfig): number {
    return config.expiry === undefined ? 0 : Math.round(Number(config.expiry) / DAY_MS);
}

/** The gate config's `expiry` for re-checking every `days` (0: never). */
export function recheckExpiry(days: number): bigint | undefined {
    return days > 0 ? BigInt(days * DAY_MS) : undefined;
}

const RECHECK_LABEL: Record<number, string> = {
    0: "native.groupSettings.gates.never",
    7: "native.groupSettings.gates.weekly",
    30: "native.groupSettings.gates.monthly",
    90: "native.groupSettings.gates.quarterly",
};

/**
 * The re-check menu's options: the plan's four, and the group's own interval where it's another
 * (set elsewhere), in order of length, so it shows and stays picked.
 */
export function recheckOptions(current: number, t: Translate): { id: string; label: string }[] {
    const days: number[] = [...RECHECK_DAYS];
    if (!days.includes(current)) {
        days.push(current);
        days.sort((a, b) => a - b);
    }
    return days.map((d) => ({
        id: String(d),
        label:
            RECHECK_LABEL[d] !== undefined
                ? t(RECHECK_LABEL[d])
                : t("native.groupSettings.gates.everyDays", { count: d }),
    }));
}

/**
 * The gate config once a gate is taken off: no re-check once there are no gates left, as the web
 * saves it.
 */
export function withoutStaleExpiry(config: AccessGateConfig): AccessGateConfig {
    return config.gate.kind === "no_gate" ? { ...config, expiry: undefined } : config;
}

// ── rules ──

export const RULE_TEMPLATES = [
    "standard",
    "trading",
    "support",
    "civil",
    "project",
    "announce",
] as const;
export type RuleTemplate = (typeof RULE_TEMPLATES)[number];

/** A template's rules as the text it puts in the field: a line each. */
export function templateText(template: RuleTemplate, t: Translate): string {
    return [1, 2, 3]
        .map((i) => `• ${t(`native.groupSettings.templates.${template}.rule${i}`)}`)
        .join("\n");
}

// ── permissions ──

export type GeneralPermission = Exclude<
    keyof ChatPermissions,
    "messagePermissions" | "threadPermissions" | "addMembers" | "tipMessages"
>;

/** The plan's Members and Moderation cards, with the permissions the design gives each. */
export const PERMISSION_CARDS: {
    card: "members" | "moderation";
    permissions: GeneralPermission[];
}[] = [
    {
        card: "members",
        permissions: ["changeRoles", "updateGroup", "inviteUsers", "removeMembers"],
    },
    {
        card: "moderation",
        permissions: [
            "deleteMessages",
            "pinMessages",
            "reactToMessages",
            "mentionAllMembers",
            "startVideoCall",
        ],
    },
];

export const MESSAGE_TYPES: readonly MessagePermission[] = [
    "text",
    "image",
    "video",
    "audio",
    "file",
    "poll",
    "crypto",
    "giphy",
    "prize",
    "memeFighter",
    "p2pSwap",
];

const ROLE_IDS: [ChatPermissionRole, string][] = [
    [ROLE_OWNER, "owner"],
    [ROLE_ADMIN, "admin"],
    [ROLE_MODERATOR, "moderator"],
    [ROLE_MEMBER, "member"],
    [ROLE_NONE, "none"],
];

/** A message type's role where it has none of its own: the messages' default. */
export const SAME_AS_DEFAULT = "default";

/** A role as its menu's option id; a message type without one of its own is SAME_AS_DEFAULT. */
export function roleId(role: ChatPermissionRole | undefined): string {
    return ROLE_IDS.find(([r]) => r === role)?.[1] ?? SAME_AS_DEFAULT;
}

/** The role an option id stands for; undefined for SAME_AS_DEFAULT. */
export function roleOf(id: string): ChatPermissionRole | undefined {
    return ROLE_IDS.find(([, i]) => i === id)?.[0];
}

/** A permission's role menu: the lowest role that has it, and for a message type, Same as default first. */
export function roleOptions(t: Translate, sameAsDefault: boolean): { id: string; label: string }[] {
    return [
        ...(sameAsDefault
            ? [{ id: SAME_AS_DEFAULT, label: t("native.groupSettings.permissions.sameAsDefault") }]
            : []),
        ...ROLE_IDS.map(([, id]) => ({
            id,
            label: t(`native.groupSettings.permissions.role.${id}`),
        })),
    ];
}

export type PermissionRow = { key: string; label: string; value: string; changed: boolean };

/** A card's permissions, each with its role and whether that's other than the default. */
export function generalRows(
    permissions: ChatPermissions,
    card: "members" | "moderation",
    t: Translate,
): PermissionRow[] {
    const defaults = defaultChatPermissions();
    const keys = PERMISSION_CARDS.find((c) => c.card === card)?.permissions ?? [];
    return keys.map((key) => ({
        key,
        label: t(`native.groupSettings.permissions.perm.${key}`),
        value: roleId(permissions[key]),
        changed: permissions[key] !== defaults[key],
    }));
}

/**
 * What a set of message permissions is compared with: the messages' with the defaults
 * (defaultChatPermissions, whose swap offers are for nobody), and threads' of their own with the
 * chat's messages', which they follow without them. The accent, the count (changedPermissions)
 * and the per-type switches all go by it.
 */
export function messageBaseline(
    scope: "messagePermissions" | "threadPermissions",
    permissions: ChatPermissions,
): MessagePermissions {
    return scope === "messagePermissions"
        ? defaultChatPermissions().messagePermissions
        : permissions.messagePermissions;
}

/** Whether any message type's role is other than its baseline's (a role of its own, or none). */
export function customisedPerType(
    permissions: MessagePermissions,
    baseline: MessagePermissions,
): boolean {
    return MESSAGE_TYPES.some((type) => permissions[type] !== baseline[type]);
}

/** The message types' rows, each with its own role or Same as default, marked where it's not the baseline's. */
export function messageTypeRows(
    permissions: MessagePermissions,
    baseline: MessagePermissions,
    t: Translate,
): PermissionRow[] {
    return MESSAGE_TYPES.map((type) => ({
        key: type,
        label: t(`native.groupSettings.permissions.type.${type}`),
        value: roleId(permissions[type]),
        changed: permissions[type] !== baseline[type],
    }));
}

/**
 * Message permissions with no customising of their own: the default kept, each type as the
 * baseline has it. The baseline's own types stay (the defaults' swap offers for nobody), so
 * switching customising off never opens one to everyone unseen.
 */
export function withoutPerType(
    permissions: MessagePermissions,
    baseline: MessagePermissions,
): MessagePermissions {
    const next: MessagePermissions = { default: permissions.default };
    for (const type of MESSAGE_TYPES) {
        if (baseline[type] !== undefined) next[type] = baseline[type];
    }
    return next;
}

/**
 * The permissions with the messages' set to `messages`. Threads of their own that aren't
 * customised per type (`threadsCustomised` false, their rows hidden) keep their types in step
 * with the messages', so no thread role the page doesn't show is saved.
 */
export function withMessages(
    permissions: ChatPermissions,
    messages: MessagePermissions,
    threadsCustomised: boolean,
): ChatPermissions {
    const threads = permissions.threadPermissions;
    return {
        ...permissions,
        messagePermissions: messages,
        threadPermissions:
            threads === undefined || threadsCustomised
                ? threads
                : withoutPerType(threads, messages),
    };
}

/** How many permissions are other than the defaults; threads of their own count as one more. */
export function changedPermissions(permissions: ChatPermissions): number {
    const defaults = defaultChatPermissions();
    const general = PERMISSION_CARDS.flatMap((c) => c.permissions).filter(
        (key) => permissions[key] !== defaults[key],
    ).length;
    const messages = (perms: MessagePermissions, base: MessagePermissions) =>
        (perms.default !== base.default ? 1 : 0) +
        MESSAGE_TYPES.filter((type) => perms[type] !== base[type]).length;
    const threads =
        permissions.threadPermissions === undefined
            ? 0
            : 1 +
              messages(
                  permissions.threadPermissions,
                  messageBaseline("threadPermissions", permissions),
              );
    return (
        general +
        messages(
            permissions.messagePermissions,
            messageBaseline("messagePermissions", permissions),
        ) +
        threads
    );
}

// ── saving ──

// A message permissions update that sets nothing: every field undefined
function messagesSetNothing(update: OptionalMessagePermissions | undefined): boolean {
    return update === undefined || Object.values(update).every((v) => v === undefined);
}

// A permissions update that sets nothing: no role, and message and thread updates that set
// nothing ("set_to_none" for threads sets something)
function setsNothing(update: OptionalChatPermissions): boolean {
    const { messagePermissions, threadPermissions, ...roles } = update;
    return (
        Object.values(roles).every((v) => v === undefined) &&
        messagesSetNothing(messagePermissions) &&
        (threadPermissions === undefined ||
            (threadPermissions !== "set_to_none" && messagesSetNothing(threadPermissions.value)))
    );
}

/**
 * Whether the draft has anything a save would change: the client's groupChanges, less a
 * permissions update that sets nothing. That's one the client can't express, as threads given
 * permissions of their own that are just "members send" (the client compares them with that, so
 * sends nothing): Save would say "Changes saved" and the switch be off again on reopening.
 */
export function hasSavableChanges(
    original: CandidateGroupChat,
    candidate: CandidateGroupChat,
): boolean {
    const changes = groupChanges(original, candidate);
    if (changes.permissions !== undefined && setsNothing(changes.permissions)) {
        delete changes.permissions;
    }
    return Object.keys(changes).length > 0;
}

/**
 * The threads' permissions the server holds once the draft is saved, which the pages read back
 * for the minute after (savedThreads): the original's where the update leaves them alone (as for
 * threads given just "members send", which the client sends nothing for), none where it takes
 * them off, else the draft's.
 */
export function threadsAsSaved(
    original: CandidateGroupChat,
    candidate: CandidateGroupChat,
): MessagePermissions | undefined {
    const update = groupChanges(original, candidate).permissions?.threadPermissions;
    if (update === "set_to_none") return undefined;
    return update === undefined || messagesSetNothing(update.value)
        ? original.permissions.threadPermissions
        : candidate.permissions.threadPermissions;
}

/** Why the rules can't be saved: switched on with no text, or text too long; undefined if they can. */
export function rulesProblem(rules: { enabled: boolean; text: string }): "needed" | "tooLong" | undefined {
    if (!rules.enabled) return undefined;
    if (rules.text.length === 0) return "needed";
    return rules.text.length > MAX_RULES_LENGTH ? "tooLong" : undefined;
}

/** A rules problem's note: the Rules page's under the text, Create group's on its Rules row. */
export function rulesProblemKey(problem: "needed" | "tooLong"): string {
    return problem === "needed"
        ? "native.groupSettings.rules.needed"
        : "native.groupSettings.rules.tooLong";
}

/** Whether a name is as long as a group's may be, as it's saved: trimmed. */
export function nameLengthValid(name: string): boolean {
    const length = name.trim().length;
    return length >= MIN_NAME_LENGTH && length <= MAX_NAME_LENGTH;
}

/**
 * Whether the draft can be saved (or created): the shared editor's checks (`editorValid`: the
 * rules, the name untrimmed, the link), the name trimmed as the page shows it, and a description
 * no longer than a group's may be, which the editor doesn't check.
 */
export function draftSavable(group: CandidateGroupChat, editorValid: boolean): boolean {
    return (
        editorValid &&
        nameLengthValid(group.name) &&
        group.description.length <= MAX_DESC_LENGTH
    );
}

// ── a gate taken off, and its Undo ──

/** What taking a gate off lost besides it: how the gates combined (down to one), the re-check (down to none). */
export type GateRemovalLosses = { operator?: "and" | "or"; expiry?: bigint };

export function gateRemovalLosses(
    before: AccessGateConfig,
    after: AccessGateConfig,
): GateRemovalLosses {
    return {
        operator:
            isCompositeGate(before.gate) && !isCompositeGate(after.gate)
                ? before.gate.operator
                : undefined,
        expiry: before.expiry !== undefined && after.expiry === undefined ? before.expiry : undefined,
    };
}

/**
 * The gate config once Undo has put a gate back (`config` has it again; `wasComposite`, whether
 * it combined gates before): what the removal lost, unless set again since (the gates combine
 * again only through the gate put back, the re-check is still unset).
 */
export function withLossesRestored(
    config: AccessGateConfig,
    losses: GateRemovalLosses,
    wasComposite: boolean,
): AccessGateConfig {
    let next = config;
    if (losses.operator !== undefined && !wasComposite && isCompositeGate(next.gate)) {
        next = { ...next, gate: { ...next.gate, operator: losses.operator } };
    }
    if (losses.expiry !== undefined && next.expiry === undefined) {
        next = { ...next, expiry: losses.expiry };
    }
    return next;
}

// ── Create group's Settings card ──

/** Access gates' value: Off, or how many. */
export function gatesSummary(config: AccessGateConfig, t: Translate): string {
    const count = shownGates(config).length;
    return count === 0 ? t("native.you.off") : t("native.groupSettings.gatesCount", { count });
}

/** Rules' value: On or Off. */
export function rulesSummary(enabled: boolean, t: Translate): string {
    return t(enabled ? "native.groupSettings.on" : "native.you.off");
}

/** Permissions' value: Default, or how many differ from it. */
export function permissionsSummary(permissions: ChatPermissions, t: Translate): string {
    const count = changedPermissions(permissions);
    return count === 0
        ? t("native.groupSettings.permissions.default")
        : t("native.groupSettings.permissions.changedCount", { count });
}

/** Who may be invited to a new group: people (not bots), not the user. */
export function invitable(user: { kind: string; userId: string }, me: string): boolean {
    return user.kind === "user" && user.userId !== me;
}
