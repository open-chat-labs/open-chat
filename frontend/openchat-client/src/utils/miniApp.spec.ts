import type { MiniAppContent } from "@shared";
import { describe, expect, test } from "vitest";
import { miniAppAction } from "./miniApp";

function card(change: Partial<MiniAppContent> = {}): MiniAppContent {
    return {
        kind: "mini_app_content",
        text: "Uno",
        spectators: false,
        spectatorCount: 0,
        status: "open",
        players: ["alice"],
        ...change,
    };
}

describe("miniAppAction", () => {
    test("anyone joins a game taking players, while there's room", () => {
        expect(miniAppAction(card(), "bob")).toBe("join");
        expect(miniAppAction(card(), "alice")).toBe("play");
        expect(miniAppAction(card({ maxPlayers: 1 }), "bob")).toBe("view");
    });

    test("once it's started, its players play, and others watch only if they may", () => {
        expect(miniAppAction(card({ status: "active" }), "alice")).toBe("play");
        expect(miniAppAction(card({ status: "active" }), "bob")).toBeUndefined();
        expect(miniAppAction(card({ status: "active", spectators: true }), "bob")).toBe("watch");
    });

    test("once it's finished, its players, and spectators if any, view it", () => {
        expect(miniAppAction(card({ status: "finished" }), "alice")).toBe("view");
        expect(miniAppAction(card({ status: "finished" }), "bob")).toBeUndefined();
        expect(miniAppAction(card({ status: "finished", spectators: true }), "bob")).toBe("view");
    });
});
