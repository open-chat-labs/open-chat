import type { ChatSummary } from "./chat";

export type VideoCallCounts = {
    muted: number;
    unmuted: number;
};

export function videoCallsInProgressForChats(chats: (ChatSummary | undefined)[]): VideoCallCounts {
    return chats.reduce(
        (counts, chat) => {
            if (chat === undefined) return counts;
            if (chat.videoCallInProgress) {
                if (chat.membership.notificationsMuted) {
                    counts.muted += 1;
                } else {
                    counts.unmuted += 1;
                }
            }
            return counts;
        },
        { muted: 0, unmuted: 0 } as VideoCallCounts,
    );
}
