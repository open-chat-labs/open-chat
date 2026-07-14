import {
    ModerationFlags,
    type ChatSummary,
    type CommunitySummary,
    type Message,
} from "@shared";

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
    return chat.kind === "group_chat" && moderationFlagsRestricted(chat.moderationFlags);
}

// Messages are hidden in the app store build if they have been flagged in any moderation
// category
export function messageRestricted(message: Message): boolean {
    return appStoreBuild && (message.moderationFlags ?? 0) !== 0;
}
