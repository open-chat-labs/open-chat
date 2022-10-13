import type { ChatMetrics, ChatSummary } from "./chat";

export const MAX_EVENTS = 150;

export function emptyChatMetrics(): ChatMetrics {
    return {
        audioMessages: 0,
        cyclesMessages: 0,
        edits: 0,
        icpMessages: 0,
        giphyMessages: 0,
        deletedMessages: 0,
        fileMessages: 0,
        pollVotes: 0,
        textMessages: 0,
        imageMessages: 0,
        replies: 0,
        videoMessages: 0,
        polls: 0,
        reactions: 0,
    };
}

export function isPreviewing(chat: ChatSummary): boolean {
    return chat.kind === "group_chat" && chat.myRole === "previewer";
}
