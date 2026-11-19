import { i18nKey, type Level, type ResourceKey } from "@client";

const keys: Record<Level, { public: string; private: string }> = {
    group: { public: "access.publicGroup", private: "access.privateGroup" },
    channel: { public: "access.publicChannel", private: "access.privateChannel" },
    community: { public: "access.publicCommunity", private: "access.privateCommunity" },
};

/**
 * Whether a group, channel or community is public, naming which it is: "Public group", "Private
 * channel", "Public community". A details panel's line under the name says this; a bare "Public"
 * or "Private" left the reader to guess what was public (a channel in a public community can be
 * private). Each is its own key, translated as a whole phrase: an adjective put before a
 * lower-cased `level.*` noun doesn't agree with it in most languages.
 */
export function visibilityLabel(target: { public: boolean; level: Level }): ResourceKey {
    const forLevel = keys[target.level];
    return i18nKey(target.public ? forLevel.public : forLevel.private);
}
