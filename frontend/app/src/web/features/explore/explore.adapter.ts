import { isCommunityMember, type CommunityMatch, type CommunitySummary } from "@client";
import type {
    ExploreCommunity,
    ExploreLanguage,
} from "@openchat/ui/src/features/components/ExploreCommunities.svelte";
import { flattenGateConfig } from "@src/utils/access";
import { swatchFor } from "@src/logic/swatch";

// ExploreCommunities' props from the client's explore results, the user's communities and the
// app's languages.

/** A language as the app lists them (`supportedLanguages` in `i18n/i18n.ts`). */
export type AppLanguage = { name: string; code: string };

/**
 * A page of explore results as the component's communities. `avatarUrl`: the community's own
 * picture, none (the card's swatch) without one, as everywhere in the new web UI (2026-11-10); the
 * cover is the banner when there is one, the design's colour without.
 * The language is shown by its name in `languages` (by code), or as the code it has.
 */
export function exploreCommunities(
    matches: CommunityMatch[],
    avatarUrl: (match: CommunityMatch) => string | undefined,
    languages: Record<string, AppLanguage>,
): ExploreCommunity[] {
    return matches.map((match) => {
        const gates = flattenGateConfig(match.gateConfig);
        const language = match.primaryLanguage;
        return {
            key: match.id.communityId,
            name: match.name,
            about: match.description,
            members: match.memberCount,
            channelCount: match.channelCount,
            verified: match.verified,
            language: language === "" ? undefined : (languages[language]?.name ?? language),
            avatarUrl: avatarUrl(match),
            // its swatch without one, as on the rail and in its panel (swatchFor)
            color: swatchFor(match.id.communityId),
            coverUrl: match.banner.blobUrl,
            gate: gates.length > 0 ? { items: gates } : undefined,
        };
    });
}

/** The communities the user has joined, by id: not those they're only previewing. */
export function joinedCommunityKeys(communities: Iterable<CommunitySummary>): string[] {
    return [...communities].filter(isCommunityMember).map((c) => c.id.communityId);
}

/** The languages the filter offers: the app's, picked by code. */
export function exploreLanguageOptions(languages: AppLanguage[]): ExploreLanguage[] {
    return languages.map((l) => ({ code: l.code, label: l.name }));
}
