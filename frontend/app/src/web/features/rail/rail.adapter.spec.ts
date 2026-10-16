import type { CommunitySummary } from "@client";
import { pinsFor } from "./rail.adapter";

const community = (communityId: string, name: string) =>
    ({ id: { kind: "community", communityId }, name }) as CommunitySummary;

describe("the rail's pins", () => {
    test("are the communities, in order, by id", () => {
        const pins = pinsFor(
            [community("c2", "Second"), community("c1", "First")],
            () => undefined,
        );
        expect(pins.map((p) => [p.id, p.name])).toEqual([
            ["c2", "Second"],
            ["c1", "First"],
        ]);
    });

    test("carry the community's avatar", () => {
        const [pin] = pinsFor([community("c1", "First")], (c) => `/avatar/${c.id.communityId}`);
        expect(pin.avatarUrl).toBe("/avatar/c1");
    });

    test("keep the same fallback colour for a community", () => {
        const colour = (id: string) => pinsFor([community(id, "x")], () => undefined)[0].color;
        expect(colour("c1")).toBe(colour("c1"));
        expect(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(colour)).size).toBeGreaterThan(
            1,
        );
    });
});
