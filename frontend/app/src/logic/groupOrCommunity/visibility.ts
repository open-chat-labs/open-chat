import { i18nKey, type Level, type ResourceKey } from "@client";

/**
 * Whether a group, channel or community is public, naming which it is: "Public group", "Private
 * channel", "Public community". A details panel's line under the name says this; a bare "Public"
 * or "Private" left the reader to guess what was public (a channel in a public community can be
 * private).
 */
export function visibilityLabel(target: { public: boolean; level: Level }): ResourceKey {
    return i18nKey(
        target.public ? "group.publicGroup" : "group.privateGroup",
        undefined,
        target.level,
        true,
    );
}
