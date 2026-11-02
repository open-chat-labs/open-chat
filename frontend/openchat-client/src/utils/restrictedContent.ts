import {
    ModerationFlags,
    type ChatSummary,
    type CommunitySummary,
    type Message,
} from "@shared";
import { communitiesStore } from "../state/app/stores";

// True for app store builds which must hide Adult/Offensive content
export const appStoreBuild = import.meta.env.OC_APP_STORE === "true";

const RESTRICTED_FLAGS = ModerationFlags.Offensive | ModerationFlags.Adult;

// True if the given community/group level moderation flags mean the content must be hidden in
// this build. Community/group flags are the ModerationFlags enum where only Adult/Offensive
// indicate objectionable content (UnderReview must not hide anything).
export function moderationFlagsRestricted(moderationFlags: number | undefined): boolean {
    return appStoreBuild && ((moderationFlags ?? 0) & RESTRICTED_FLAGS) !== 0;
}

export function communityRestricted(community: CommunitySummary): boolean {
    return moderationFlagsRestricted(community.moderationFlags);
}

export function chatRestricted(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return moderationFlagsRestricted(chat.moderationFlags);
    }
    if (chat.kind === "channel") {
        // A channel is restricted if its parent community is
        const community = communitiesStore.value.get({
            kind: "community",
            communityId: chat.id.communityId,
        });
        return community !== undefined && communityRestricted(community);
    }
    return false;
}

// Message flags are the classifier's category bits (see MODERATION_CATEGORY_NAMES). The store
// build hides only what the store guidelines treat as objectionable: sexual content, graphic
// violence and threats. The classifier's plain violence, harassment, illicit and self-harm
// categories fire at its default thresholds on ordinary criticism, figures of speech, talk about
// scams and people discussing their own struggles, so they don't hide anything.
const RESTRICTED_MESSAGE_FLAGS =
    1 | // sexual
    2 | // sexual/minors
    8 | // violence/graphic
    32; // harassment/threatening (includes hate/threatening)

export function messageFlagsRestricted(moderationFlags: number | undefined): boolean {
    return appStoreBuild && ((moderationFlags ?? 0) & RESTRICTED_MESSAGE_FLAGS) !== 0;
}

export function messageRestricted(message: Message): boolean {
    return messageFlagsRestricted(message.moderationFlags);
}
