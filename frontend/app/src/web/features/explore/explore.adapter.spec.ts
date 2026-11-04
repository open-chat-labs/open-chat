import {
    ROLE_MEMBER,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGateConfig,
    type CommunityMatch,
    type CommunitySummary,
    type MemberRole,
} from "@client";
import { exploreCommunities, exploreLanguageOptions, joinedCommunityKeys } from "./explore.adapter";

const noGate: AccessGateConfig = { gate: { kind: "no_gate" }, expiry: undefined };

function match(id: string, overrides: Partial<CommunityMatch> = {}): CommunityMatch {
    return {
        kind: "community_match",
        id: { kind: "community", communityId: id },
        name: `Community ${id}`,
        description: "About it",
        avatar: {},
        banner: {},
        memberCount: 1200,
        channelCount: 4,
        gateConfig: noGate,
        flags: 0,
        primaryLanguage: "fr",
        verified: false,
        ...overrides,
    };
}

const languages = { fr: { name: "Français", code: "fr" }, en: { name: "English", code: "en" } };
const avatar = (m: CommunityMatch) => `/avatar/${m.id.communityId}`;

describe("explore's communities", () => {
    test("each match as the component's community, keyed by its id", () => {
        expect(exploreCommunities([match("a", { verified: true })], avatar, languages)).toEqual([
            {
                key: "a",
                name: "Community a",
                about: "About it",
                members: 1200,
                channelCount: 4,
                verified: true,
                language: "Français",
                avatarUrl: "/avatar/a",
                coverUrl: undefined,
                gate: undefined,
            },
        ]);
    });

    test("the banner is the cover when there is one", () => {
        const [c] = exploreCommunities(
            [match("a", { banner: { blobUrl: "/banner.png" } })],
            avatar,
            languages,
        );
        expect(c.coverUrl).toBe("/banner.png");
    });

    test("a language the app doesn't list shows as its code, and none as the default", () => {
        const [ja, none] = exploreCommunities(
            [match("a", { primaryLanguage: "ja" }), match("b", { primaryLanguage: "" })],
            avatar,
            languages,
        );
        expect(ja.language).toBe("ja");
        expect(none.language).toBeUndefined();
    });

    test("a gate's requirements are its leaf gates", () => {
        const [c] = exploreCommunities(
            [
                match("a", {
                    gateConfig: {
                        gate: {
                            kind: "composite_gate",
                            operator: "and",
                            gates: [{ kind: "diamond_gate" }, { kind: "lifetime_diamond_gate" }],
                        },
                        expiry: undefined,
                    },
                }),
            ],
            avatar,
            languages,
        );
        expect(c.gate?.items).toHaveLength(2);
    });
});

function community(id: string, role: MemberRole): CommunitySummary {
    return {
        id: { kind: "community", communityId: id },
        membership: { role },
    } as CommunitySummary;
}

// Invariant 3: a community the viewer is only previewing is not shown as joined
describe("a community the viewer is only previewing is not shown as joined", () => {
    test("only communities with a role in them are joined", () => {
        expect(
            joinedCommunityKeys([
                community("member", ROLE_MEMBER),
                community("previewed", ROLE_NONE),
                community("owner", ROLE_OWNER),
            ]),
        ).toEqual(["member", "owner"]);
    });
});

describe("explore's languages", () => {
    test("the app's languages, picked by code", () => {
        expect(exploreLanguageOptions([{ name: "עִברִית", code: "iw" }])).toEqual([
            { code: "iw", label: "עִברִית" },
        ]);
    });
});
