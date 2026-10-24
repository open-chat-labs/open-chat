import { describe, expect, it } from "vitest";
import { ringedKeys } from "./violations";

describe("unruly violations", () => {
    /** Invariant: a run of three gets the red ring, not only red discs, so players who can't
     * tell the red from the disc colour still see it. */
    it("rings the cells of a run", () => {
        expect(ringedKeys([{ kind: "run", keys: [3, 4, 5] }])).toEqual(new Set([3, 4, 5]));
    });
});
