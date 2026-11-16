import {
    defaultChatPermissions,
    ROLE_ADMIN,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGateConfig,
    type ChatPermissionRole,
    type ChatPermissions,
    type CryptocurrencyDetails,
    type NervousSystemDetails,
} from "@client";
import type { GateLookups } from "@src/logic/access/gateValues";
import { describe, expect, test } from "vitest";
import {
    canAddEntry,
    changedPermissions,
    customisedPerType,
    gateOperator,
    gateRows,
    generalRows,
    messageTypeRows,
    operatorApplies,
    pageTitle,
    recheckDays,
    recheckExpiry,
    recheckOptions,
    roleId,
    roleOf,
    roleOptions,
    SAME_AS_DEFAULT,
    switchGate,
    templateText,
    withoutPerType,
    withoutStaleExpiry,
} from "./settings.adapter";

// the key and its values, so what's asked for can be seen
const t = (key: string, values?: Record<string, string | number>) =>
    values === undefined ? key : `${key} ${JSON.stringify(values)}`;

const DAY = 24 * 60 * 60 * 1000;

const icp = { ledger: "icp", symbol: "ICP", decimals: 8 } as CryptocurrencyDetails;
const ns = {
    governanceCanisterId: "gov",
    token: { symbol: "CHAT", name: "OpenChat", decimals: 8 },
} as NervousSystemDetails;
const lookups: GateLookups = {
    tokens: new Map([["icp", icp]]),
    nervousSystems: new Map([["gov", ns]]),
};

const config = (gate: AccessGateConfig["gate"], expiry?: bigint): AccessGateConfig => ({
    gate,
    expiry,
});

describe("the settings pages' titles", () => {
    test("Edit is the group's or the channel's, the rest Manage's", () => {
        expect(pageTitle("edit", false, t)).toBe("native.details.menu.editGroup");
        expect(pageTitle("edit", true, t)).toBe("native.details.menu.editChannel");
        expect(pageTitle("gates", true, t)).toBe("native.details.manage.gates");
    });
});

describe("the Gates card", () => {
    test("with no gates: the simple gates off, the gates with setup empty", () => {
        const rows = gateRows(config({ kind: "no_gate" }), lookups, t, "en");
        expect(rows.map((r) => [r.kind, r.gate])).toEqual([
            ["switch", "diamond_gate"],
            ["switch", "lifetime_diamond_gate"],
            ["setup", "payment_gate"],
            ["setup", "token_balance_gate"],
            ["setup", "neuron_gate"],
            ["setup", "chit_earned_gate"],
        ]);
        expect(rows.every((r) => (r.kind === "switch" ? !r.on : r.entries.length === 0))).toBe(
            true,
        );
    });

    // the plan offers neither a locked nor a credential gate, but one already there shows, so it
    // can be seen and taken off; the suspended unique-person gate never shows (and is kept)
    test("a locked gate shows where there is one; a unique-person gate never does", () => {
        const rows = gateRows(
            config({
                kind: "composite_gate",
                operator: "and",
                gates: [{ kind: "locked_gate" }, { kind: "unique_person_gate" }],
            }),
            lookups,
            t,
            "en",
        );
        expect(rows.filter((r) => r.kind === "switch").map((r) => r.gate)).toEqual([
            "diamond_gate",
            "lifetime_diamond_gate",
            "locked_gate",
        ]);
    });

    test("each entry under its gate, in words, with its token", () => {
        const rows = gateRows(
            config({
                kind: "composite_gate",
                operator: "or",
                gates: [
                    { kind: "payment_gate", ledgerCanister: "icp", amount: 150_000_000n, fee: 0n },
                    {
                        kind: "neuron_gate",
                        governanceCanister: "gov",
                        minDissolveDelay: 30 * DAY,
                        minStakeE8s: undefined,
                    },
                    { kind: "chit_earned_gate", minEarned: 1500 },
                ],
            }),
            lookups,
            t,
            "en",
        );
        const entries = Object.fromEntries(
            rows.flatMap((r) => (r.kind === "setup" ? [[r.gate, r.entries]] : [])),
        );
        expect(entries.payment_gate.map((e: { text: string }) => e.text)).toEqual([
            'native.groupSettings.gates.payEntry {"amount":"1.50","symbol":"ICP"}',
        ]);
        expect(entries.neuron_gate[0].text).toBe(
            'OpenChat · native.groupSettings.gates.delayEntry {"count":30}',
        );
        expect(entries.chit_earned_gate[0].text).toBe(
            'native.groupSettings.gates.chitEntry {"amount":"1,500"}',
        );
    });

    test("a switch adds its gate; a credential gate can only go", () => {
        expect(switchGate("diamond_gate")).toEqual({ kind: "diamond_gate" });
        expect(switchGate("credential_gate")).toBeUndefined();
    });

    test("CHIT has one minimum; the others take several entries", () => {
        expect(canAddEntry("chit_earned_gate", 0)).toBe(true);
        expect(canAddEntry("chit_earned_gate", 1)).toBe(false);
        expect(canAddEntry("payment_gate", 3)).toBe(true);
    });
});

describe("the gate settings", () => {
    test("how the gates combine applies from two gates", () => {
        const one = config({ kind: "diamond_gate" });
        const two = config({
            kind: "composite_gate",
            operator: "or",
            gates: [{ kind: "diamond_gate" }, { kind: "locked_gate" }],
        });
        expect(operatorApplies(one)).toBe(false);
        expect(gateOperator(one)).toBe("and");
        expect(operatorApplies(two)).toBe(true);
        expect(gateOperator(two)).toBe("or");
    });

    test("re-checking: never, or every 7, 30 or 90 days", () => {
        expect(recheckDays(config({ kind: "no_gate" }))).toBe(0);
        expect(recheckDays(config({ kind: "diamond_gate" }, BigInt(30 * DAY)))).toBe(30);
        expect(recheckExpiry(0)).toBeUndefined();
        expect(recheckExpiry(7)).toBe(BigInt(7 * DAY));
        expect(recheckOptions(30, t).map((o) => o.id)).toEqual(["0", "7", "30", "90"]);
    });

    // set elsewhere to another interval: it shows, in order, and stays picked
    test("another interval is offered too, in order", () => {
        expect(recheckOptions(14, t)).toEqual([
            { id: "0", label: "native.groupSettings.gates.never" },
            { id: "7", label: "native.groupSettings.gates.weekly" },
            { id: "14", label: 'native.groupSettings.gates.everyDays {"count":14}' },
            { id: "30", label: "native.groupSettings.gates.monthly" },
            { id: "90", label: "native.groupSettings.gates.quarterly" },
        ]);
    });

    test("no gates left, no re-check", () => {
        expect(withoutStaleExpiry(config({ kind: "no_gate" }, BigInt(DAY))).expiry).toBeUndefined();
        expect(withoutStaleExpiry(config({ kind: "diamond_gate" }, BigInt(DAY))).expiry).toBe(
            BigInt(DAY),
        );
    });
});

describe("the rules' templates", () => {
    test("a template's rules, a line each", () => {
        expect(templateText("civil", t)).toBe(
            [
                "• native.groupSettings.templates.civil.rule1",
                "• native.groupSettings.templates.civil.rule2",
                "• native.groupSettings.templates.civil.rule3",
            ].join("\n"),
        );
    });
});

describe("the permissions", () => {
    test("a role and its menu option are the same both ways; a type without one is Same as default", () => {
        const roles: ChatPermissionRole[] = [ROLE_OWNER, ROLE_ADMIN, ROLE_MODERATOR, ROLE_NONE];
        for (const role of roles) {
            expect(roleOf(roleId(role))).toBe(role);
        }
        expect(roleId(undefined)).toBe(SAME_AS_DEFAULT);
        expect(roleOf(SAME_AS_DEFAULT)).toBeUndefined();
        expect(roleOptions(t, true)[0].id).toBe(SAME_AS_DEFAULT);
        expect(roleOptions(t, false).map((o) => o.id)).toEqual([
            "owner",
            "admin",
            "moderator",
            "member",
            "none",
        ]);
    });

    test("a permission other than its default is marked", () => {
        const permissions: ChatPermissions = {
            ...defaultChatPermissions(),
            pinMessages: ROLE_MODERATOR,
        };
        const rows = generalRows(permissions, "moderation", t);
        expect(rows.find((r) => r.key === "pinMessages")).toMatchObject({
            value: "moderator",
            changed: true,
        });
        expect(rows.filter((r) => r.changed)).toHaveLength(1);
    });

    // the defaults have swap offers for nobody, so they read as customised per type
    test("message types: their own role or Same as default, against the defaults", () => {
        const defaults = defaultChatPermissions().messagePermissions;
        expect(customisedPerType(defaults)).toBe(true);
        expect(customisedPerType(withoutPerType(defaults))).toBe(false);
        const rows = messageTypeRows({ default: 1, image: ROLE_ADMIN }, defaults, t);
        expect(rows.find((r) => r.key === "image")).toMatchObject({
            value: "admin",
            changed: true,
        });
        expect(rows.find((r) => r.key === "p2pSwap")).toMatchObject({
            value: SAME_AS_DEFAULT,
            changed: true,
        });
        expect(rows.find((r) => r.key === "text")).toMatchObject({ changed: false });
    });

    test("how many differ from the defaults; threads of their own count", () => {
        expect(changedPermissions(defaultChatPermissions())).toBe(0);
        const changed: ChatPermissions = {
            ...defaultChatPermissions(),
            changeRoles: ROLE_OWNER,
            threadPermissions: { ...defaultChatPermissions().messagePermissions },
        };
        expect(changedPermissions(changed)).toBe(2);
    });
});
