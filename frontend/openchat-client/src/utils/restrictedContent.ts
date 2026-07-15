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
// this build
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

// Messages are hidden in the app store build if they have been flagged in any moderation
// category
export function messageFlagsRestricted(moderationFlags: number | undefined): boolean {
    return appStoreBuild && (moderationFlags ?? 0) !== 0;
}

export function messageRestricted(message: Message): boolean {
    return messageFlagsRestricted(message.moderationFlags);
}
