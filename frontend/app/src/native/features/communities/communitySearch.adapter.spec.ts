import type { ChannelIdentifier, ChannelMatch } from "@client";
import { describe, expect, test } from "vitest";
import {
    channelKey,
    communitySearchSections,
    joinedChannelRows,
    otherChannelRows,
} from "./communitySearch.adapter";

const id = (channelId: number): ChannelIdentifier => ({
    kind: "channel",
    communityId: "c1",
    channelId,
});
const members = (count: number) => `${count} members`;

const match = (channelId: number, name: string, over: Partial<ChannelMatch> = {}): ChannelMatch =>
    ({
        id: id(channelId),
        name,
        memberCount: 2,
        public: true,
        invited: false,
        ...over,
    }) as ChannelMatch;

describe("a community's search", () => {
    test("the user's channels whose names hold the term, by name, the match marked", () => {
        const rows = joinedChannelRows(
            [
                { id: id(1), name: "Playtests", memberCount: 4 },
                { id: id(2), name: "devlogs", memberCount: 3 },
                { id: id(3), name: "general", memberCount: 9 },
            ],
            "t",
            members,
        );
        expect(rows.map((r) => r.id)).toEqual(["c1/1"]);
        expect(rows[0]).toMatchObject({
            kind: "channel",
            sub: "4 members",
            title: { before: "Play", match: "t", after: "ests" },
        });
        expect(joinedChannelRows([{ id: id(1), name: "a", memberCount: 1 }], "", members)).toEqual(
            [],
        );
    });

    test("others found: not the user's, and only those they can read", () => {
        const joined = new Set([channelKey(id(1))]);
        const rows = otherChannelRows(
            [
                match(1, "general"),
                match(2, "art"),
                match(3, "secret", { public: false }),
                match(4, "invited", { public: false, invited: true }),
            ],
            { has: (c) => joined.has(channelKey(c)) },
            "",
            members,
        );
        expect(rows.map((r) => r.id)).toEqual(["c1/2", "c1/4"]);
    });

    test("sections with something in them, the first five until Show all", () => {
        const row = (n: number) =>
            ({ id: `r${n}`, title: { before: "", match: "", after: "" }, sub: "", subMarkdown: false, kind: "channel", color: "violet" }) as const;
        const many = [1, 2, 3, 4, 5, 6].map(row);
        const sections = communitySearchSections({ joined: [], others: many }, {});
        expect(sections.map((s) => s.id)).toEqual(["others"]);
        expect(sections[0].section).toMatchObject({ total: 6, more: true });
        expect(sections[0].section.rows).toHaveLength(5);
        expect(
            communitySearchSections({ joined: [], others: many }, { others: true })[0].section.rows,
        ).toHaveLength(6);
    });
});
