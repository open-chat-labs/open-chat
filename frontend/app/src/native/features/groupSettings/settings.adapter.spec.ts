import {
    defaultChatPermissions,
    defaultChatRules,
    nullMembership,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGateConfig,
    type CandidateGroupChat,
    type ChatPermissionRole,
    type ChatPermissions,
    type CryptocurrencyDetails,
    type MessagePermissions,
    type MultiUserChat,
    type NervousSystemDetails,
} from "@client";
import type { GateLookups } from "@src/logic/access/gateValues";
import { MAX_DESC_LENGTH, MAX_NAME_LENGTH } from "@src/logic/groupOrCommunity/group.svelte";
import { MAX_RULES_LENGTH } from "@src/logic/groupOrCommunity/groupOrCommunity.svelte";
import { describe, expect, test } from "vitest";
import {
    canAddEntry,
    changeQuestion,
    changedPermissions,
    customisedPerType,
    draftSavable,
    gateOperator,
    gateRemovalLosses,
    gateRows,
    gatesSummary,
    generalRows,
    hasSavableChanges,
    rulesProblem,
    rulesProblemKey,
    threadsAsSaved,
    withMessages,
    messageBaseline,
    invitable,
    messageTypeRows,
    nameLengthValid,
    newGroupEntered,
    settingsReady,
    withLossesRestored,
    operatorApplies,
    pageTitle,
    permissionsSummary,
    recheckDays,
    recheckExpiry,
    recheckOptions,
    roleId,
    roleOf,
    roleOptions,
    rulesSummary,
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

    // the defaults have swap offers for nobody: that's not customising, and a swap offer that
    // follows the default is
    test("message types: their own role or Same as default, against the defaults", () => {
        const defaults = defaultChatPermissions().messagePermissions;
        expect(customisedPerType(defaults, defaults)).toBe(false);
        expect(customisedPerType({ default: ROLE_MEMBER }, defaults)).toBe(true);
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

    // Invariant: switching customising off never opens swap offers to everyone unseen
    test("customising off keeps the default and the baseline's own types", () => {
        const defaults = defaultChatPermissions().messagePermissions;
        const custom: MessagePermissions = {
            default: ROLE_ADMIN,
            image: ROLE_OWNER,
            p2pSwap: ROLE_MEMBER,
        };
        expect(withoutPerType(custom, defaults)).toEqual({
            default: ROLE_ADMIN,
            p2pSwap: ROLE_NONE,
        });
        expect(customisedPerType(withoutPerType(custom, defaults), defaults)).toBe(false);
    });

    test("threads go by the chat's messages, as the count does; the messages by the defaults", () => {
        const permissions: ChatPermissions = {
            ...defaultChatPermissions(),
            messagePermissions: { default: ROLE_MEMBER, p2pSwap: ROLE_NONE, image: ROLE_ADMIN },
            threadPermissions: { default: ROLE_MEMBER, p2pSwap: ROLE_NONE, image: ROLE_ADMIN },
        };
        const threads = messageBaseline("threadPermissions", permissions);
        expect(threads).toBe(permissions.messagePermissions);
        expect(messageBaseline("messagePermissions", permissions)).toEqual(
            defaultChatPermissions().messagePermissions,
        );
        // threads the same as the messages: nothing marked, nothing counted but threads of their own
        const rows = messageTypeRows(permissions.threadPermissions!, threads, t);
        expect(rows.filter((r) => r.changed)).toEqual([]);
        expect(customisedPerType(permissions.threadPermissions!, threads)).toBe(false);
        // the messages' image role is one change, threads of their own another
        expect(changedPermissions(permissions)).toBe(2);
    });

    // Invariant: no thread role the page doesn't show is saved
    test("threads not customised per type follow the messages' types as they change", () => {
        const messages: MessagePermissions = { default: ROLE_MEMBER, image: ROLE_ADMIN };
        const permissions: ChatPermissions = {
            ...defaultChatPermissions(),
            messagePermissions: messages,
            threadPermissions: { default: ROLE_MODERATOR, image: ROLE_ADMIN },
        };
        const next: MessagePermissions = { default: ROLE_MEMBER, video: ROLE_OWNER };
        const followed = withMessages(permissions, next, false);
        expect(followed.messagePermissions).toBe(next);
        expect(followed.threadPermissions).toEqual({ default: ROLE_MODERATOR, video: ROLE_OWNER });
        expect(customisedPerType(followed.threadPermissions!, next)).toBe(false);
        // customised threads keep their own; none stay none
        expect(withMessages(permissions, next, true).threadPermissions).toBe(
            permissions.threadPermissions,
        );
        const none = { ...permissions, threadPermissions: undefined };
        expect(withMessages(none, next, false).threadPermissions).toBeUndefined();
    });
});

describe("what a save would change", () => {
    const group = (permissions: ChatPermissions = defaultChatPermissions()): CandidateGroupChat =>
        ({
            id: { kind: "group_chat", groupId: "g" },
            kind: "candidate_group_chat",
            name: "Group",
            description: "",
            historyVisible: true,
            public: false,
            frozen: false,
            members: [],
            permissions,
            rules: { ...defaultChatRules("group"), newVersion: false },
            gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
            level: "group",
            membership: { ...nullMembership(), role: ROLE_OWNER },
            eventsTTL: undefined,
            messagesVisibleToNonMembers: false,
            externalUrl: undefined,
            verified: false,
        }) as CandidateGroupChat;

    test("nothing changed, nothing to save", () => {
        expect(hasSavableChanges(group(), group())).toBe(false);
    });

    test("a role changed is saved", () => {
        const changed = group({ ...defaultChatPermissions(), pinMessages: ROLE_OWNER });
        expect(hasSavableChanges(group(), changed)).toBe(true);
    });

    // the client compares threads of their own with "members send", so these send nothing
    test("threads given just members send aren't a change; given more, they are", () => {
        const plain: ChatPermissions = {
            ...defaultChatPermissions(),
            messagePermissions: { default: ROLE_MEMBER },
        };
        const original = group(plain);
        expect(
            hasSavableChanges(
                original,
                group({ ...plain, threadPermissions: { default: ROLE_MEMBER } }),
            ),
        ).toBe(false);
        expect(
            hasSavableChanges(
                original,
                group({
                    ...plain,
                    threadPermissions: { default: ROLE_MEMBER, p2pSwap: ROLE_NONE },
                }),
            ),
        ).toBe(true);
    });

    test("threads of their own taken off is a change", () => {
        const withThreads: ChatPermissions = {
            ...defaultChatPermissions(),
            threadPermissions: { default: ROLE_ADMIN },
        };
        expect(hasSavableChanges(group(withThreads), group())).toBe(true);
    });

    test("a draft saves with a name of the right length trimmed, and a description that fits", () => {
        const draft = group();
        expect(draftSavable(draft, true)).toBe(true);
        expect(draftSavable(draft, false)).toBe(false);
        expect(draftSavable({ ...draft, name: "  ab " }, true)).toBe(false);
        expect(draftSavable({ ...draft, name: "     " }, true)).toBe(false);
        expect(draftSavable({ ...draft, name: " abc " }, true)).toBe(true);
        expect(draftSavable({ ...draft, description: "x".repeat(MAX_DESC_LENGTH + 1) }, true)).toBe(
            false,
        );
        expect(nameLengthValid("x".repeat(MAX_NAME_LENGTH))).toBe(true);
        expect(nameLengthValid("x".repeat(MAX_NAME_LENGTH + 1))).toBe(false);
    });

    // Invariant: what's read back after a save is what the server holds
    test("threads read back as the server holds them: the original's where nothing was sent", () => {
        const plain: ChatPermissions = {
            ...defaultChatPermissions(),
            messagePermissions: { default: ROLE_MEMBER },
        };
        const original = group(plain);
        // threads given just "members send", saved with another change: nothing sent for threads
        const candidate = group({
            ...plain,
            pinMessages: ROLE_OWNER,
            threadPermissions: { default: ROLE_MEMBER },
        });
        expect(threadsAsSaved(original, candidate)).toBeUndefined();
        // given a role of their own: sent
        const own = group({ ...plain, threadPermissions: { default: ROLE_ADMIN } });
        expect(threadsAsSaved(original, own)).toEqual({ default: ROLE_ADMIN });
        // taken off: none
        expect(threadsAsSaved(own, original)).toBeUndefined();
        // left alone: the original's
        const pinned = group({ ...own.permissions, pinMessages: ROLE_OWNER });
        expect(threadsAsSaved(own, pinned)).toEqual({ default: ROLE_ADMIN });
    });

    test("why rules can't be saved: none, empty, or too long", () => {
        expect(rulesProblem({ enabled: false, text: "" })).toBeUndefined();
        expect(rulesProblem({ enabled: true, text: "Be kind" })).toBeUndefined();
        expect(rulesProblem({ enabled: true, text: "" })).toBe("needed");
        expect(rulesProblem({ enabled: true, text: "x".repeat(MAX_RULES_LENGTH + 1) })).toBe(
            "tooLong",
        );
        expect(rulesProblemKey("tooLong")).toBe("native.groupSettings.rules.tooLong");
    });

    // Invariant: Create group asks before dropping anything entered
    test("Create group has something entered: people, anything in the draft, history", () => {
        const blank = group();
        expect(newGroupEntered(blank, blank, 0)).toBe(false);
        expect(newGroupEntered(blank, blank, 1)).toBe(true);
        expect(newGroupEntered(blank, { ...blank, description: "About" }, 0)).toBe(true);
        expect(newGroupEntered(blank, { ...blank, eventsTTL: 1000n }, 0)).toBe(true);
        // not in the client's groupChanges
        expect(newGroupEntered(blank, { ...blank, historyVisible: false }, 0)).toBe(true);
    });

    test("the Rules page waits for the rules; the others only for the chat", () => {
        const chat = {} as MultiUserChat;
        const rules = { text: "", enabled: false, version: 0 };
        expect(settingsReady("rules", chat, undefined)).toBe(false);
        expect(settingsReady("rules", chat, rules)).toBe(true);
        expect(settingsReady("edit", chat, undefined)).toBe(true);
        expect(settingsReady("edit", undefined, rules)).toBe(false);
    });
});

describe("a gate taken off, and its Undo", () => {
    const diamond = { kind: "diamond_gate" } as const;
    const locked = { kind: "locked_gate" } as const;
    const chit = { kind: "chit_earned_gate", minEarned: 5 } as const;
    const WEEK = BigInt(7 * DAY);

    test("taking the second of two off loses how they combined", () => {
        const before = config(
            { kind: "composite_gate", operator: "or", gates: [diamond, locked] },
            WEEK,
        );
        const after = config(diamond, WEEK);
        expect(gateRemovalLosses(before, after)).toEqual({ operator: "or", expiry: undefined });
    });

    test("taking the last off loses the re-check", () => {
        expect(gateRemovalLosses(config(diamond, WEEK), config({ kind: "no_gate" }))).toEqual({
            operator: undefined,
            expiry: WEEK,
        });
    });

    test("Undo restores what the removal lost", () => {
        const back = config({ kind: "composite_gate", operator: "and", gates: [diamond, locked] });
        expect(withLossesRestored(back, { operator: "or", expiry: WEEK }, false)).toEqual(
            config({ kind: "composite_gate", operator: "or", gates: [diamond, locked] }, WEEK),
        );
    });

    // Invariant: what was set after the removal stays
    test("Undo leaves an operator and a re-check set since alone", () => {
        const since = config(
            { kind: "composite_gate", operator: "and", gates: [diamond, chit, locked] },
            BigInt(30 * DAY),
        );
        // the gates already combined (another was added since): their operator is the user's
        expect(withLossesRestored(since, { operator: "or", expiry: WEEK }, true)).toEqual(since);
    });
});

describe("Create group's Settings card", () => {
    test("each link says what's set", () => {
        expect(gatesSummary(config({ kind: "no_gate" }), t)).toBe("native.you.off");
        expect(
            gatesSummary(
                config({
                    kind: "composite_gate",
                    operator: "and",
                    gates: [{ kind: "diamond_gate" }, { kind: "unique_person_gate" }],
                }),
                t,
            ),
        ).toBe('native.groupSettings.gatesCount {"count":1}');
        expect(rulesSummary(true, t)).toBe("native.groupSettings.on");
        expect(permissionsSummary(defaultChatPermissions(), t)).toBe(
            "native.groupSettings.permissions.default",
        );
        expect(
            permissionsSummary({ ...defaultChatPermissions(), changeRoles: ROLE_OWNER }, t),
        ).toBe('native.groupSettings.permissions.changedCount {"count":1}');
    });

    test("people are invited, not bots or the user", () => {
        expect(invitable({ kind: "user", userId: "a" }, "me")).toBe(true);
        expect(invitable({ kind: "bot", userId: "b" }, "me")).toBe(false);
        expect(invitable({ kind: "user", userId: "me" }, "me")).toBe(false);
    });
});

describe("the question a save waits on", () => {
    test("a verified rename first, then a change of who can see it", () => {
        const none = { showingVerificationWarning: false, confirming: false };
        expect(changeQuestion(none, true)).toBeUndefined();
        expect(changeQuestion({ ...none, showingVerificationWarning: true }, true)).toBe(
            "verified.nameChangeWarning",
        );
        expect(changeQuestion({ ...none, confirming: true }, true)).toBe("confirmMakeGroupPublic");
        expect(changeQuestion({ ...none, confirming: true }, false)).toBe(
            "confirmMakeGroupPrivate",
        );
    });
});
