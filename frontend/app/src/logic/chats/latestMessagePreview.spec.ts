import type {
    BridgedUserId,
    BridgedUserSummary,
    ChatSummary,
    MessageContent,
    UserLookup,
    UserSummary,
} from "@client";
import { deletedUser } from "@client";
import { describe, expect, test, vi } from "vitest";

// messages are restricted only in the app store build; here any moderation flag restricts
vi.mock("@client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    messageFlagsRestricted: (flags: number | undefined) => (flags ?? 0) !== 0,
}));
import { latestMessagePreview, type PreviewText } from "./latestMessagePreview";

const membership = { role: 1, archived: false, notificationsMuted: false };

function chat(
    kind: "direct_chat" | "group_chat",
    latest:
        | {
              sender: string;
              text: string;
              flags?: number;
              webhook?: boolean;
              bridgedFrom?: BridgedUserId;
          }
        | undefined,
    extra: Partial<ChatSummary> = {},
): ChatSummary {
    return {
        kind,
        id: kind === "direct_chat" ? { kind, userId: "alice" } : { kind, groupId: "g1" },
        them: { kind: "direct_chat", userId: "alice" },
        latestMessageIndex: latest === undefined ? undefined : 3,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latest && {
            timestamp: 5n,
            event: {
                messageId: 9n,
                sender: latest.sender,
                content: { kind: "text_content", text: latest.text },
                moderationFlags: latest.flags,
                senderContext: latest.webhook
                    ? { kind: "webhook" }
                    : latest.bridgedFrom
                      ? { kind: "bot", finalised: true, bridgedFrom: latest.bridgedFrom }
                      : undefined,
            },
        },
        ...extra,
    } as unknown as ChatSummary;
}

const text: PreviewText = {
    formatter: (key, options) =>
        options?.values ? `${key}(${JSON.stringify(options.values)})` : key,
    me: "me",
    displayName: (id, kind) => (kind === "me" ? "You" : kind === "webhook" ? "Webhook" : id),
    translations: new Map([[9n, "bonjour"]]),
    contentText: (content: MessageContent) =>
        content.kind === "text_content" ? content.text : content.kind,
    bridgedUsers: new Map(),
    users: new Map() as UserLookup,
};
const untranslated = { ...text, translations: new Map<bigint, string>() };

/** Invariant: a chat's preview line is the same in every tree (the old rows' formatLatestMessage). */
describe("a chat's latest message preview", () => {
    test("is the text in a DM, and after its sender (you, a webhook, the user) in a group", () => {
        expect(
            latestMessagePreview(
                chat("direct_chat", { sender: "alice", text: "hi" }),
                untranslated,
            ),
        ).toBe("hi");
        expect(
            latestMessagePreview(chat("group_chat", { sender: "bob", text: "hi" }), untranslated),
        ).toBe("bob: hi");
        expect(
            latestMessagePreview(chat("group_chat", { sender: "me", text: "hi" }), untranslated),
        ).toBe("You: hi");
        expect(
            latestMessagePreview(
                chat("group_chat", { sender: "x", text: "hi", webhook: true }),
                untranslated,
            ),
        ).toBe("Webhook: hi");
    });

    test("shows restricted content as such, not its text", () => {
        expect(
            latestMessagePreview(
                chat("direct_chat", { sender: "alice", text: "hi", flags: 1 }),
                untranslated,
            ),
        ).toBe("restricted_content");
    });

    test("shows the reader's translation", () => {
        expect(
            latestMessagePreview(chat("direct_chat", { sender: "alice", text: "hello" }), text),
        ).toBe("bonjour");
    });

    test("says disappearing messages changed, and is empty once the message has gone", () => {
        const changed = chat("group_chat", { sender: "bob", text: "hi" }, {
            eventsTTL: 3_600_000n,
            eventsTtlLastUpdated: 6n,
        } as Partial<ChatSummary>);
        expect(latestMessagePreview(changed, untranslated)).toMatch(
            /^disappearingMessages\.timeUpdated/,
        );
        const gone = chat("direct_chat", { sender: "alice", text: "secret" });
        (gone.latestMessage as { expiresAt?: number }).expiresAt = 1_000;
        expect(latestMessagePreview(gone, untranslated, 2_000)).toBe("");
    });

    test("shows a relayed message as from who linked the account, else the account and its platform", () => {
        const nelly: BridgedUserId = { kind: "telegram", id: "123" };
        const relayed = chat("group_chat", {
            sender: "bridge-bot",
            text: "hi",
            bridgedFrom: nelly,
        });
        const profile = (linkedUserId?: string): BridgedUserSummary => ({
            user: { kind: "telegram", profile: { id: "123", displayName: "Nelly Smith" } },
            linkedUserId,
            updated: 0n,
        });
        const withProfile = (summary?: BridgedUserSummary, users: UserSummary[] = []) => ({
            ...untranslated,
            bridgedUsers: new Map(summary ? [["telegram:123", summary]] : []),
            users: new Map(users.map((u) => [u.userId, u])) as UserLookup,
        });
        const user = (userId: string) =>
            ({ kind: "user", userId, username: userId, updated: 0n }) as UserSummary;

        // Before its profile has loaded
        expect(latestMessagePreview(relayed, withProfile())).toBe(
            'bridgedUserUnknown({"platform":"Telegram"}): hi',
        );
        expect(latestMessagePreview(relayed, withProfile(profile()))).toBe(
            'bridgedUserWithPlatform({"name":"Nelly Smith","platform":"Telegram"}): hi',
        );
        expect(latestMessagePreview(relayed, withProfile(profile("bob"), [user("bob")]))).toBe(
            "bob: hi",
        );
        expect(latestMessagePreview(relayed, withProfile(profile("me"), [user("me")]))).toBe(
            "You: hi",
        );
        // Linked, but the OpenChat user hasn't loaded yet
        expect(latestMessagePreview(relayed, withProfile(profile("bob")))).toBe(
            'bridgedUserWithPlatform({"name":"Nelly Smith","platform":"Telegram"}): hi',
        );
        // Who linked it has deleted their account, so it's the account's own profile again
        expect(
            latestMessagePreview(relayed, withProfile(profile("bob"), [deletedUser("bob")])),
        ).toBe('bridgedUserWithPlatform({"name":"Nelly Smith","platform":"Telegram"}): hi');
    });

    test("names a Discord account by its display name, else its username", () => {
        const mish: BridgedUserId = { kind: "discord", id: "273575371251908627" };
        const relayed = chat("group_chat", { sender: "bridge-bot", text: "hi", bridgedFrom: mish });
        const withProfile = (displayName?: string) => ({
            ...untranslated,
            bridgedUsers: new Map<string, BridgedUserSummary>([
                [
                    "discord:273575371251908627",
                    {
                        user: {
                            kind: "discord",
                            profile: { id: mish.id, username: "mish6", displayName },
                        },
                        updated: 0n,
                    },
                ],
            ]),
        });
        expect(latestMessagePreview(relayed, withProfile("Mish"))).toBe(
            'bridgedUserWithPlatform({"name":"Mish","platform":"Discord"}): hi',
        );
        expect(latestMessagePreview(relayed, withProfile())).toBe(
            'bridgedUserWithPlatform({"name":"mish6","platform":"Discord"}): hi',
        );
    });
});
