import {
    defaultChatPermissions,
    editableGates,
    isCompositeGate,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGateConfig,
    type ActiveLeafGate,
    type ChatPermissionRole,
    type ChatPermissions,
    type MessagePermission,
    type MessagePermissions,
} from "@client";
import { DAY_MS, gateAmountText, type GateLookups } from "@src/logic/access/gateValues";
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

/** Whether any message type has a role of its own. */
export function customisedPerType(permissions: MessagePermissions): boolean {
    return MESSAGE_TYPES.some((type) => permissions[type] !== undefined);
}

/** The message types' rows, each with its own role or Same as default. */
export function messageTypeRows(
    permissions: MessagePermissions,
    defaults: MessagePermissions,
    t: Translate,
): PermissionRow[] {
    return MESSAGE_TYPES.map((type) => ({
        key: type,
        label: t(`native.groupSettings.permissions.type.${type}`),
        value: roleId(permissions[type]),
        changed: permissions[type] !== defaults[type],
    }));
}

/** Message permissions with every type following the default. */
export function withoutPerType(permissions: MessagePermissions): MessagePermissions {
    return { default: permissions.default };
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
            : 1 + messages(permissions.threadPermissions, permissions.messagePermissions);
    return (
        general + messages(permissions.messagePermissions, defaults.messagePermissions) + threads
    );
}
