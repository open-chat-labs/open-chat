import { describe, expect, test } from "vitest";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import { senderColor } from "./conversation/messageRow";
import { SWATCHES, swatchFor } from "./swatch";

describe("an id's swatch", () => {
    test("is the same every time", () => {
        expect(swatchFor("alice")).toBe(swatchFor("alice"));
    });

    test("is one of the library's Avatar gradients", () => {
        expect([...SWATCHES].sort()).toEqual(Object.keys(AVATAR_GRADIENTS).sort());
        for (const id of ["alice", "bob", "carol", "dave", "erin", "frank"]) {
            expect(AVATAR_GRADIENTS[swatchFor(id)]).toBeDefined();
        }
    });

    test("is a sender's too, so a person has the same one in the list and in their messages", () => {
        for (const id of ["alice", "bob", "carol", "dave", "erin", "frank"]) {
            expect(senderColor(id)).toBe(swatchFor(id));
        }
    });
});
