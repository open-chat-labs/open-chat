import {
    defaultChatPermissions,
    groupChanges,
    ROLE_ADMIN,
    ROLE_MODERATOR,
    ROLE_OWNER,
    type CandidateGroupChat,
} from "@client";
import { durationMs } from "@openchat/ui/src/features/components/GroupSettingsDialog.svelte";
import type { GroupSettings } from "@openchat/ui/src/lib/types";
import { describe, expect, test } from "vitest";
import type { GateLookups } from "../access/gates.adapter";
import { candidateFromSettings, groupSettings } from "./settings.adapter";

const lookups: GateLookups = { tokens: new Map(), nervousSystems: new Map() };

function group(overrides: Partial<CandidateGroupChat> = {}): CandidateGroupChat {
    return {
        id: { kind: "group_chat", groupId: "g" },
        kind: "candidate_group_chat",
        name: "Hikers",
        description: "Walks at the weekend",
        historyVisible: true,
        public: false,
        frozen: false,
        members: [],
        permissions: {
            ...defaultChatPermissions(),
            tipMessages: ROLE_MODERATOR,
            messagePermissions: { default: ROLE_MODERATOR, poll: ROLE_ADMIN },
            threadPermissions: { default: ROLE_OWNER, memeFighter: ROLE_ADMIN },
        },
        rules: { enabled: true, text: "Be kind", version: 2, newVersion: false },
        avatar: { blobUrl: "blob:avatar", blobReference: undefined, blobData: undefined },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        level: "group",
        membership: { role: ROLE_OWNER },
        // set by the old editors, and none of the dialog's durations
        eventsTTL: 7_200_000n,
        messagesVisibleToNonMembers: false,
        verified: false,
        ...overrides,
    } as CandidateGroupChat;
}

// What GroupSettingsDialog's Save hands back for a value it was opened with and not changed: it
// works out `afterMs` from the duration label, and only offers a new rules version for new rules
function savedUnchanged(value: GroupSettings): GroupSettings {
    const { settings } = value;
    return {
        ...value,
        settings: {
            ...settings,
            afterMs: settings.disappearOn ? durationMs(settings.after) : null,
        },
        rules: { ...value.rules, newVersion: false },
    };
}

describe("group settings adapter", () => {
    // 4b invariant 6: opening Manage and saving without changes sends nothing
    test("a group opened in the dialog and saved unchanged has no changes", () => {
        for (const original of [
            group(),
            group({ eventsTTL: undefined, permissions: defaultChatPermissions() }),
            group({ avatar: undefined, public: true }),
        ]) {
            const saved = savedUnchanged(groupSettings(original, lookups));
            const candidate = candidateFromSettings(saved, original, lookups);
            expect(groupChanges(original, candidate)).toEqual({});
        }
    });

    test("an edit in the dialog is the only change sent", () => {
        const original = group();
        const saved = savedUnchanged(groupSettings(original, lookups));
        saved.info.name = "Ramblers";
        saved.permissions.general.pin = "member";

        const changes = groupChanges(original, candidateFromSettings(saved, original, lookups));

        expect(changes.name).toBe("Ramblers");
        expect(changes.permissions?.pinMessages).toBe(1);
        expect(Object.keys(changes).sort()).toEqual(["name", "permissions"]);
    });
});
