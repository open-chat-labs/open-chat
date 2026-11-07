import { describe, expect, test } from "vitest";
import { HeldWhileLeaving } from "./heldWhileLeaving";

describe("what the conversation shows as it leaves", () => {
    test("the initial value until its chat is selected", () => {
        const held = new HeldWhileLeaving<string[]>([]);
        expect(held.of(false, ["another chat's"])).toEqual([]);
    });

    test("follows the chat while it's selected", () => {
        const held = new HeldWhileLeaving<string[]>([]);
        expect(held.of(true, ["a"])).toEqual(["a"]);
        expect(held.of(true, ["a", "b"])).toEqual(["a", "b"]);
    });

    test("keeps the last of it once the selection moves off it, whatever comes after", () => {
        const held = new HeldWhileLeaving<string[]>([]);
        held.of(true, ["a", "b"]);
        expect(held.of(false, [])).toEqual(["a", "b"]);
        expect(held.of(false, ["another chat's"])).toEqual(["a", "b"]);
    });

    test("follows it again should it be selected again", () => {
        const held = new HeldWhileLeaving<string | undefined>(undefined);
        held.of(true, "a");
        held.of(false, undefined);
        expect(held.of(true, "b")).toBe("b");
    });
});
