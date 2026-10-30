import type { BotDefinition, MiniAppContent, MiniAppLiveCard } from "@shared";
import { describe, expect, test } from "vitest";
import {
    miniAppCardView,
    miniAppFailureMessage,
    miniAppGame,
    miniAppGameKey,
    miniAppImageUrl,
} from "./miniApp";

function card(change: Partial<MiniAppContent> = {}): MiniAppContent {
    return {
        kind: "mini_app_content",
        text: "Uno",
        app: "uno",
        maxPlayers: 2,
        spectators: false,
        appSize: { width: 440, height: 740 },
        status: { kind: "open" },
        ...change,
    };
}

function live(change: Partial<MiniAppLiveCard> = {}): MiniAppLiveCard {
    return {
        status: "open",
        players: [],
        waitingFor: [],
        watching: 0,
        result: undefined,
        member: true,
        ...change,
    };
}

describe("miniAppCardView", () => {
    test("shows the card stored in the chat when the service isn't showing it live, with nothing to do", () => {
        expect(
            miniAppCardView(
                card({
                    status: { kind: "active", players: ["alice", "bob"], waitingFor: ["bob"] },
                }),
                undefined,
                "bob",
            ),
        ).toEqual({
            status: "active",
            players: ["alice", "bob"],
            waitingFor: ["bob"],
            watching: undefined,
            result: undefined,
            yourTurn: true,
            showsApp: true,
            actions: [],
        });

        expect(
            miniAppCardView(
                card({
                    status: {
                        kind: "finished",
                        players: ["alice"],
                        result: "Alice won",
                        endState: undefined,
                    },
                }),
                undefined,
                "alice",
            ),
        ).toMatchObject({
            status: "finished",
            players: ["alice"],
            result: "Alice won",
            actions: [],
        });
    });

    test("shows the live card in place of the stored one", () => {
        const view = miniAppCardView(
            card({ status: { kind: "active", players: ["alice", "bob"], waitingFor: ["bob"] } }),
            live({
                status: "finished",
                players: ["alice", "bob"],
                waitingFor: ["alice"],
                watching: 3,
                result: "Bob won",
            }),
            "carol",
        );

        // once it's finished it's no one's turn, and no one's watching
        expect(view).toEqual({
            status: "finished",
            players: ["alice", "bob"],
            waitingFor: [],
            watching: undefined,
            result: "Bob won",
            yourTurn: false,
            showsApp: false,
            actions: [],
        });
    });

    test("who's joined a game that's taking players is only shown live", () => {
        expect(miniAppCardView(card(), undefined, "alice").players).toEqual([]);
        expect(miniAppCardView(card(), live({ players: ["alice"] }), "bob").players).toEqual([
            "alice",
        ]);
    });

    test("a member joins a game taking players until it's full, and a player can leave it", () => {
        expect(miniAppCardView(card(), live({ players: ["alice"] }), "bob").actions).toEqual([
            "join",
        ]);
        expect(miniAppCardView(card(), live({ players: ["alice"] }), "alice").actions).toEqual([
            "leave",
        ]);
        expect(
            miniAppCardView(card(), live({ players: ["alice", "carol"] }), "bob").actions,
        ).toEqual([]);
        expect(
            miniAppCardView(card({ maxPlayers: undefined }), live({ players: ["alice"] }), "bob")
                .actions,
        ).toEqual(["join"]);
    });

    test("someone who can only see the chat can't join, but sees the game's app if it can be watched", () => {
        expect(miniAppCardView(card(), live({ member: false }), "bob")).toMatchObject({
            showsApp: false,
            actions: [],
        });
        expect(
            miniAppCardView(card({ spectators: true }), live({ member: false }), "bob"),
        ).toMatchObject({ showsApp: true, actions: [] });
    });

    test("a player sees the game's app, and so do others if it can be watched", () => {
        expect(miniAppCardView(card(), live({ players: ["alice"] }), "alice").showsApp).toBe(true);
        expect(miniAppCardView(card(), live({ players: ["alice"] }), "bob").showsApp).toBe(false);
        expect(
            miniAppCardView(card({ spectators: true }), live({ players: ["alice"] }), "bob")
                .showsApp,
        ).toBe(true);
        // A player's known from the stored card once the game's started, before the live one shows
        expect(
            miniAppCardView(
                card({ status: { kind: "active", players: ["alice"], waitingFor: ["alice"] } }),
                undefined,
                "alice",
            ).showsApp,
        ).toBe(true);
        // but not before, when the stored card has no players
        expect(miniAppCardView(card(), undefined, "alice").showsApp).toBe(false);
        expect(miniAppCardView(card({ spectators: true }), undefined, "alice").showsApp).toBe(true);
    });

    test("once it's started, there's nothing to do from the card, and its players play it in the card", () => {
        const active = live({ status: "active", players: ["alice"], waitingFor: ["alice"] });

        expect(miniAppCardView(card(), active, "alice")).toMatchObject({
            yourTurn: true,
            showsApp: true,
            actions: [],
        });
        expect(miniAppCardView(card(), active, "bob")).toMatchObject({
            showsApp: false,
            actions: [],
        });
        expect(miniAppCardView(card({ spectators: true }), active, "bob")).toMatchObject({
            yourTurn: false,
            showsApp: true,
            actions: [],
        });
    });

    // The service says a game's finished before the card in the chat records the end, and an app
    // open live is handed the end in place, so it's kept meanwhile rather than torn down and reloaded
    test("when the service says it's finished before the stored card does, whoever saw the app keeps it", () => {
        const finished = live({ status: "finished", players: ["alice"], result: "Alice won" });

        expect(miniAppCardView(card(), finished, "alice")).toMatchObject({
            status: "finished",
            result: "Alice won",
            showsApp: true,
            actions: [],
        });
        expect(miniAppCardView(card({ spectators: true }), finished, "bob")).toMatchObject({
            showsApp: true,
            actions: [],
        });
        // whoever couldn't see it still can't
        expect(miniAppCardView(card(), finished, "bob").showsApp).toBe(false);
        expect(
            miniAppCardView(
                card({ status: { kind: "active", players: ["alice"], waitingFor: ["alice"] } }),
                finished,
                "alice",
            ).showsApp,
        ).toBe(true);
    });

    test("once the stored card records the end, the app shows only if it records how the game ended", () => {
        const ended = (endState: string | undefined) =>
            card({
                spectators: true,
                status: { kind: "finished", players: ["alice"], result: "Alice won", endState },
            });
        const finished = live({ status: "finished", players: ["alice"] });

        for (const [content, userId] of [
            [ended(undefined), "alice"],
            [ended(undefined), "bob"],
        ] as const) {
            expect(miniAppCardView(content, undefined, userId).showsApp).toBe(false);
            expect(miniAppCardView(content, finished, userId).showsApp).toBe(false);
        }
        // how it ended is shown to everyone, whether or not they could have watched the game
        for (const [content, userId] of [
            [ended('{"winner":"alice"}'), "alice"],
            [ended('{"winner":"alice"}'), "bob"],
            [{ ...ended('{"winner":"alice"}'), spectators: false }, "bob"],
        ] as const) {
            expect(miniAppCardView(content, undefined, userId).showsApp).toBe(true);
            expect(miniAppCardView(content, finished, userId).showsApp).toBe(true);
        }
    });
});

describe("miniAppImageUrl", () => {
    const definition: BotDefinition = {
        kind: "bot_definition",
        description: "",
        commands: [],
        autonomousConfig: undefined,
        defaultSubscriptions: undefined,
        dataEncoding: undefined,
        restrictedLocations: undefined,
        miniApps: [
            { name: "chess", imageUrl: "app/chess.svg" },
            { name: "uno", imageUrl: "https://cdn.example.com/uno.png" },
            { name: "odd", imageUrl: "javascript:alert(1)" },
            { name: "broken", imageUrl: "https://" },
        ],
    };

    test("resolves a relative image against the bot's endpoint", () => {
        expect(miniAppImageUrl(definition, "chess", "https://bot.example.com/chess")).toBe(
            "https://bot.example.com/chess/app/chess.svg",
        );
        expect(miniAppImageUrl(definition, "chess", "https://bot.example.com/chess///")).toBe(
            "https://bot.example.com/chess/app/chess.svg",
        );
        expect(miniAppImageUrl(definition, "chess", "http://localhost:3000")).toBe(
            "http://localhost:3000/app/chess.svg",
        );
    });

    test("takes an absolute https image as it is", () => {
        expect(miniAppImageUrl(definition, "uno", "https://bot.example.com")).toBe(
            "https://cdn.example.com/uno.png",
        );
    });

    test("has none for an app the bot doesn't declare, or an image that isn't http(s)", () => {
        expect(miniAppImageUrl(definition, "poker", "https://bot.example.com")).toBeUndefined();
        expect(miniAppImageUrl(definition, "odd", "https://bot.example.com")).toBeUndefined();
        expect(miniAppImageUrl(definition, "broken", "https://bot.example.com")).toBeUndefined();
        expect(miniAppImageUrl(definition, "chess", "not a url")).toBeUndefined();
    });
});

describe("miniAppGame", () => {
    test("is the message's, in a group or channel, but direct chats have none", () => {
        const channel = { kind: "channel", communityId: "community", channelId: 3 } as const;

        expect(miniAppGame({ chatId: channel, threadRootMessageIndex: 4 }, 5n)).toEqual({
            chatId: channel,
            threadRootMessageIndex: 4,
            messageId: 5n,
        });
        expect(
            miniAppGame({ chatId: { kind: "direct_chat", userId: "alice" } }, 5n),
        ).toBeUndefined();
    });

    test("keys tell games in threads and other chats apart", () => {
        const group = { kind: "group_chat", groupId: "group" } as const;
        const keys = new Set([
            miniAppGameKey({ chatId: group, threadRootMessageIndex: undefined, messageId: 1n }),
            miniAppGameKey({ chatId: group, threadRootMessageIndex: 1, messageId: 1n }),
            miniAppGameKey({
                chatId: { kind: "group_chat", groupId: "other" },
                threadRootMessageIndex: undefined,
                messageId: 1n,
            }),
        ]);
        expect(keys.size).toBe(3);
    });
});

describe("miniAppFailureMessage", () => {
    test("shows the bot's own reason when it refuses", () => {
        expect(
            miniAppFailureMessage({ reason: "refused_by_bot", message: "Seats are taken" }),
        ).toMatchObject({
            key: "bots.miniApp.refusals.refusedByBot",
            params: { message: "Seats are taken" },
        });
        expect(miniAppFailureMessage({ reason: "refused_by_bot" }).key).toBe(
            "bots.miniApp.refusals.refusedByBotNoReason",
        );
    });

    test("says why the service refused, or that it couldn't be reached", () => {
        expect(miniAppFailureMessage({ reason: "not_member" }).key).toBe(
            "bots.miniApp.refusals.notMember",
        );
        expect(miniAppFailureMessage(undefined).key).toBe("bots.miniApp.refusals.unreachable");
    });
});
