import { i18nKey, type ResourceKey } from "@client";
import type { PreviewBar } from "@src/logic/join/previewBar";

// CommunityPreviewBar's props for a preview (logic/join/previewBar decides what it says). Where the
// decision keeps the design's own copy, the prop is left out and the bar uses its own.

export type PreviewBarProps = {
    community: string;
    avatarUrl: string;
    state: PreviewBar["state"];
    requirements: number;
    hint: string | undefined;
    joinLabel: string | undefined;
    backLabel: string | undefined;
    showBack: boolean;
    joinDisabled: boolean;
};

export function previewBarProps(
    bar: PreviewBar,
    avatarUrl: string,
    text: (key: ResourceKey) => string,
): PreviewBarProps {
    const optional = (key: ResourceKey | undefined) => (key === undefined ? undefined : text(key));
    return {
        community: bar.name,
        avatarUrl,
        state: bar.state,
        requirements: bar.requirements,
        hint: optional(bar.hint),
        joinLabel: optional(bar.joinLabel),
        // "Back to Explore" is the bar's own
        backLabel: bar.back === "back" ? text(i18nKey("back")) : undefined,
        showBack: bar.back !== "none",
        joinDisabled: bar.locked,
    };
}
