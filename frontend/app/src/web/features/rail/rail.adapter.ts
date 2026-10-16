import type { CommunitySummary } from "@client";
import type NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
import type { ComponentProps } from "svelte";

type Pin = ComponentProps<typeof NavRail>["pins"][number];

// NavRail's fallback swatches, for communities without an avatar
const COLOURS: Pin["color"][] = ["sunset", "blue", "teal", "plum"];

function colourFor(id: string): Pin["color"] {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return COLOURS[Math.abs(hash) % COLOURS.length];
}

// The user's communities as the rail's pins, in the order they're sorted in (sortedCommunitiesStore)
export function pinsFor(
    communities: CommunitySummary[],
    avatarUrl: (community: CommunitySummary) => string | undefined,
): Pin[] {
    return communities.map((community) => ({
        id: community.id.communityId,
        name: community.name,
        avatarUrl: avatarUrl(community),
        color: colourFor(community.id.communityId),
    }));
}
