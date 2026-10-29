import type { MiniAppContent, MiniAppLiveCard } from "@shared";
import { describe, expect, test } from "vitest";
import { miniAppCardView, miniAppFailureMessage, miniAppGame, miniAppGameKey } from "./miniApp";

function card(change: Partial<MiniAppContent> = {}): MiniAppContent {
    return {
        kind: "mini_app_content",
        text: "Uno",
        maxPlayers: 2,
        spectators: false,
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
            actions: [],
        });

        expect(
            miniAppCardView(
                card({ status: { kind: "finished", players: ["alice"], result: "Alice won" } }),
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

        // once it's finished it's no one's turn
        expect(view).toEqual({
            status: "finished",
            players: ["alice", "bob"],
            waitingFor: [],
            watching: 3,
            result: "Bob won",
            yourTurn: false,
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
            "play",
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

    test("someone who can only see the chat may only watch", () => {
        expect(miniAppCardView(card(), live({ member: false }), "bob").actions).toEqual([]);
        expect(
            miniAppCardView(card({ spectators: true }), live({ member: false }), "bob").actions,
        ).toEqual(["watch"]);
    });

    test("once it's started, its players play it, and others watch it if they may", () => {
        const active = live({ status: "active", players: ["alice"], waitingFor: ["alice"] });

        expect(miniAppCardView(card(), active, "alice")).toMatchObject({
            yourTurn: true,
            actions: ["play"],
        });
        expect(miniAppCardView(card(), active, "bob").actions).toEqual([]);
        expect(miniAppCardView(card({ spectators: true }), active, "bob")).toMatchObject({
            yourTurn: false,
            actions: ["watch"],
        });
    });

    test("once it's finished, its players open it, and others too if it can be watched", () => {
        const finished = live({ status: "finished", players: ["alice"] });

        expect(miniAppCardView(card(), finished, "alice").actions).toEqual(["open"]);
        expect(miniAppCardView(card(), finished, "bob").actions).toEqual([]);
        expect(miniAppCardView(card({ spectators: true }), finished, "bob").actions).toEqual([
            "open",
        ]);
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
