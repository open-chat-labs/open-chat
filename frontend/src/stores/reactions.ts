import { containsReaction } from "../domain/chat/chat.utils";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../services/serviceContainer";
import type { Writable } from "svelte/store";
import { overwriteCachedEvents } from "../utils/caching";
import { rollbar } from "../utils/logging";
import type {
    ChatEvent,
    ChatSummary,
    EventWrapper,
    LocalReaction,
    Reaction,
} from "../domain/chat/chat";

const PRUNE_LOCAL_REACTIONS_INTERVAL = 30 * 1000;

export let localReactions: Record<string, LocalReaction[]> = {};

export function pruneLocalReactions(): void {
    const limit = Date.now() - 10000;
    localReactions = Object.entries(localReactions).reduce((pruned, [k, v]) => {
        const filtered = v.filter((r) => r.timestamp > limit);
        if (filtered.length > 0) {
            pruned[k] = filtered;
        }
        return pruned;
    }, {} as Record<string, LocalReaction[]>);
}

export function mergeReactions(incoming: Reaction[], localReactions: LocalReaction[]): Reaction[] {
    const merged = localReactions.reduce<Reaction[]>((result, local) => {
        return applyLocalReaction(local, result);
    }, incoming);
    return merged;
}

// todo - this needs tweaking because local reactions may have come via rtc and therefore not might not be mine
function applyLocalReaction(local: LocalReaction, reactions: Reaction[]): Reaction[] {
    const r = reactions.find((r) => r.reaction === local.reaction);
    if (r === undefined) {
        if (local.kind === "add") {
            reactions.push({ reaction: local.reaction, userIds: new Set([local.userId]) });
        }
    } else {
        if (local.kind === "add") {
            r.userIds.add(local.userId);
        } else {
            r.userIds.delete(local.userId);
            if (r.userIds.size === 0) {
                reactions = reactions.filter((r) => r.reaction !== local.reaction);
            }
        }
    }
    return reactions;
}

export function toggleReaction(
    userId: string,
    reactions: Reaction[],
    reaction: string
): Reaction[] {
    const result: Reaction[] = [];
    let found = false;

    reactions.forEach((r) => {
        if (r.reaction === reaction) {
            const userIds = new Set(r.userIds);
            if (userIds.delete(userId)) {
                if (userIds.size > 0) {
                    result.push({
                        ...r,
                        userIds,
                    });
                }
            } else {
                userIds.add(userId);
                result.push({
                    ...r,
                    userIds,
                });
            }
            found = true;
        } else {
            result.push(r);
        }
    });

    if (!found) {
        result.push({ reaction, userIds: new Set([userId]) });
    }

    return result;
}

export function toggleReactionInEventList(
    chat: ChatSummary,
    userId: string,
    events: EventWrapper<ChatEvent>[],
    messageId: bigint,
    reaction: string,
    chatUserIds: Set<string>,
    currentUserId: string,
    threadRootMessageIndex?: number
): EventWrapper<ChatEvent>[] {
    messageId = BigInt(messageId);
    const key = messageId.toString();
    if (localReactions[key] === undefined) {
        localReactions[key] = [];
    }
    const messageReactions = localReactions[key];
    return events.map((e) => {
        if (e.event.kind === "message" && e.event.messageId === messageId) {
            const addOrRemove = containsReaction(userId, reaction, e.event.reactions)
                ? "remove"
                : "add";
            messageReactions.push({
                reaction,
                timestamp: Date.now(),
                kind: addOrRemove,
                userId: userId,
            });
            const updatedEvent = {
                ...e,
                event: {
                    ...e.event,
                    reactions: toggleReaction(userId, e.event.reactions, reaction),
                },
            };
            overwriteCachedEvents(chat.chatId, [updatedEvent], threadRootMessageIndex).catch(
                (err) => rollbar.error("Unable to overwrite cached event toggling reaction", err)
            );

            if (userId === currentUserId) {
                rtcConnectionsManager.sendMessage([...chatUserIds], {
                    kind: "remote_user_toggled_reaction",
                    chatType: chat.kind,
                    chatId: chat.chatId,
                    messageId,
                    userId: userId,
                    reaction,
                    threadRootMessageIndex,
                });
            }
            return updatedEvent;
        }
        return e;
    });
}

export function selectReaction(
    api: ServiceContainer,
    eventStore: Writable<EventWrapper<ChatEvent>[]>,
    chat: ChatSummary,
    userId: string,
    messageId: bigint,
    reaction: string,
    chatUserIds: Set<string>,
    currentUserId: string,
    threadRootMessageIndex?: number
): Promise<boolean> {
    const toggle = () =>
        // optimistic update
        eventStore.update((events) =>
            toggleReactionInEventList(
                chat,
                userId,
                events,
                messageId,
                reaction,
                chatUserIds,
                currentUserId,
                threadRootMessageIndex
            )
        );
    toggle();

    const apiPromise =
        chat.kind === "group_chat"
            ? api.toggleGroupChatReaction(chat.chatId, messageId, reaction, threadRootMessageIndex)
            : api.toggleDirectChatReaction(chat.them, messageId, reaction, threadRootMessageIndex);

    return apiPromise
        .then((resp) => {
            if (resp !== "added" && resp !== "removed") {
                // toggle again to undo
                console.log("Reaction failed: ", resp);
                toggle();
            } else {
                if (resp === "added") {
                    return true;
                }
            }
            return false;
        })
        .catch((err) => {
            // toggle again to undo
            console.log("Reaction failed: ", err);
            toggle();
            return false;
        });
}

export function startPruningLocalReactions(): void {
    const pruneInterval = window.setInterval(() => {
        pruneLocalReactions();
    }, PRUNE_LOCAL_REACTIONS_INTERVAL);
}
