import { get } from "svelte/store";
import type { ChatSummary, Message } from "../../domain/chat/chat";
import { missingUserIds } from "../../domain/user/user.utils";
import { rtcConnectionsManager } from "../../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../../services/serviceContainer";
import {
    currentChatBlockedUsers,
    currentChatMembers,
    currentChatDraftMessage,
    currentChatUserIds,
} from "../../stores/chat";
import { userStore } from "../../stores/user";
import { rollbar } from "../../utils/logging";
import { toastStore } from "../../stores/toast";
import { localMessageUpdates } from "../../stores/localMessageUpdates";

export function selectReaction(
    api: ServiceContainer,
    chat: ChatSummary,
    userId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint,
    reaction: string,
    kind: "add" | "remove"
): Promise<boolean> {
    localMessageUpdates.markReaction(messageId.toString(), {
        reaction,
        kind,
        userId,
    });

    function undoLocally() {
        localMessageUpdates.markReaction(messageId.toString(), {
            reaction,
            kind: kind === "add" ? "remove" : "add",
            userId,
        });
    }

    return (
        chat.kind === "direct_chat"
            ? api.toggleDirectChatReaction(chat.chatId, messageId, reaction, threadRootMessageIndex)
            : api.toggleGroupChatReaction(chat.chatId, messageId, reaction, threadRootMessageIndex)
    )
        .then((resp) => {
            if (resp !== "added" && resp !== "removed") {
                undoLocally();
                return false;
            }
            return true;
        })
        .catch((_) => {
            undoLocally();
            return false;
        });
}

export function deleteMessage(
    api: ServiceContainer,
    chat: ChatSummary,
    userId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint
): Promise<boolean> {
    const messageIdString = messageId.toString();

    localMessageUpdates.markDeleted(messageIdString, userId);

    const recipients = [...get(currentChatUserIds)];
    const chatType = chat.kind;
    const chatId = chat.chatId;

    rtcConnectionsManager.sendMessage(recipients, {
        kind: "remote_user_deleted_message",
        chatType,
        chatId,
        messageId,
        userId,
        threadRootMessageIndex,
    });

    function undelete() {
        rtcConnectionsManager.sendMessage(recipients, {
            kind: "remote_user_undeleted_message",
            chatType,
            chatId,
            messageId,
            userId,
            threadRootMessageIndex,
        });
        localMessageUpdates.markUndeleted(messageIdString);
    }

    return api
        .deleteMessage(chat, messageId, threadRootMessageIndex)
        .then((resp) => {
            const success = resp === "success";
            if (!success) {
                undelete();
            }
            return success;
        })
        .catch((_) => {
            undelete();
            return false;
        });
}

export async function updateUserStore(
    api: ServiceContainer,
    chatId: string,
    userId: string,
    userIdsFromEvents: Set<string>
): Promise<void> {
    const allUserIds = new Set<string>();
    get(currentChatMembers).forEach((m) => allUserIds.add(m.userId));
    get(currentChatBlockedUsers).forEach((u) => allUserIds.add(u));
    userIdsFromEvents.forEach((u) => allUserIds.add(u));

    currentChatUserIds.update(chatId, (userIds) => {
        allUserIds.forEach((u) => {
            if (u !== userId) {
                userIds.add(u);
            }
        });
        return userIds;
    });

    const resp = await api.getUsers(
        {
            userGroups: [
                {
                    users: missingUserIds(get(userStore), new Set<string>(allUserIds)),
                    updatedSince: BigInt(0),
                },
            ],
        },
        true
    );

    userStore.addMany(resp.users);
}

export async function editMessage(
    api: ServiceContainer,
    chat: ChatSummary,
    msg: Message,
    threadRootMessageIndex: number | undefined
): Promise<void> {
    localMessageUpdates.markContentEdited(msg.messageId.toString(), msg.content);

    if (threadRootMessageIndex === undefined) {
        currentChatDraftMessage.clear(chat.chatId);
    }

    return api
        .editMessage(chat, msg, threadRootMessageIndex)
        .then((resp) => {
            if (resp !== "success") {
                rollbar.warn("Error response editing", resp);
                toastStore.showFailureToast("errorEditingMessage");
                localMessageUpdates.revertEditedContent(msg.messageId.toString());
            }
        })
        .catch((err) => {
            rollbar.error("Exception sending message", err);
            toastStore.showFailureToast("errorEditingMessage");
            localMessageUpdates.revertEditedContent(msg.messageId.toString());
        });
}

export function registerPollVote(
    api: ServiceContainer,
    userId: string,
    chatId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint,
    messageIndex: number,
    answerIndex: number,
    type: "register" | "delete"
): void {
    localMessageUpdates.markPollVote(messageId.toString(), {
        answerIndex,
        type,
        userId,
    });

    api.registerPollVote(chatId, messageIndex, answerIndex, type, threadRootMessageIndex)
        .then((resp) => {
            if (resp !== "success") {
                toastStore.showFailureToast("poll.voteFailed");
                rollbar.error("Poll vote failed: ", resp);
                console.log("poll vote failed: ", resp);
            }
        })
        .catch((err) => {
            toastStore.showFailureToast("poll.voteFailed");
            rollbar.error("Poll vote failed: ", err);
            console.log("poll vote failed: ", err);
        });
}

function blockUserLocally(chatId: string, userId: string): void {
    currentChatBlockedUsers.update(chatId, (b) => b.add(userId));
    currentChatMembers.update(chatId, (p) => p.filter((p) => p.userId !== userId));
}

function unblockUserLocally(chatId: string, userId: string): void {
    currentChatBlockedUsers.update(chatId, (b) => {
        b.delete(userId);
        return b;
    });
    currentChatMembers.update(chatId, (p) => [
        ...p,
        {
            role: "participant",
            userId,
            username: get(userStore)[userId]?.username ?? "unknown",
        },
    ]);
}

export function blockUser(api: ServiceContainer, chatId: string, userId: string): Promise<void> {
    blockUserLocally(chatId, userId);
    return api
        .blockUserFromGroupChat(chatId, userId)
        .then((resp) => {
            if (resp === "success") {
                toastStore.showSuccessToast("blockUserSucceeded");
            } else {
                toastStore.showFailureToast("blockUserFailed");
                unblockUserLocally(chatId, userId);
            }
        })
        .catch((err) => {
            toastStore.showFailureToast("blockUserFailed");
            rollbar.error("Error blocking user", err);
            unblockUserLocally(chatId, userId);
        });
}
