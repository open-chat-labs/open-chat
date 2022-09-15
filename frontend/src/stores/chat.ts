import type {
    ChatEvent,
    ChatSummary,
    CurrentChatState,
    EnhancedReplyContext,
    EventWrapper,
    GroupChatDetails,
    Member,
    Message,
    MessageContent,
    ThreadSyncDetails,
} from "../domain/chat/chat";
import { unconfirmed } from "./unconfirmed";
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import {
    compareChats,
    getContentAsText,
    getFirstUnreadMention,
    getFirstUnreadMessageIndex,
    getNextEventIndex,
    getNextMessageIndex,
    mergeServerEventsWithLocalUpdates,
    mergeUnconfirmedIntoSummary,
    updateArgsFromChats,
} from "../domain/chat/chat.utils";
import { userStore } from "./user";
import { Poller } from "../services/poller";
import type { ServiceContainer } from "../services/serviceContainer";
import { extractUserIdsFromMentions, missingUserIds } from "../domain/user/user.utils";
import { blockedUsers } from "./blockedUsers";
import { pinnedChatsStore } from "./pinnedChats";
import { push } from "svelte-spa-router";
import { rollbar } from "../utils/logging";
import { closeNotificationsForChat } from "../utils/notifications";
import type { CreatedUser } from "../domain/user/user";
import { scrollStrategy } from "./settings";
import DRange from "drange";
import { emptyChatMetrics } from "../domain/chat/chat.utils.shared";
import { snsFunctions } from "./snsFunctions";
import { archivedChatsStore, mutedChatsStore } from "./tempChatsStore";
import { filteredProposalsStore, resetFilteredProposalsStore } from "./filteredProposals";
import { createChatSpecificDataStore } from "./dataByChatFactory";
import { localMessageUpdates } from "../stores/localMessageUpdates";
import type { DraftMessage } from "./draftMessageFactory";

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;

let chatUpdatesSince: bigint | undefined = undefined;

export type ChatState = {
    chatId: string;
    event: ChatLifecycleEvent;
};

export type ChatLifecycleEvent =
    | Nothing
    | LoadedNewEvents
    | SendingMessage
    | ChatUpdated
    | LoadedEventWindow
    | LoadedPreviousEvents;

type Nothing = { kind: "nothing" };
type LoadedNewEvents = { kind: "loaded_new_events"; newLatestMessage: boolean };
type SendingMessage = {
    kind: "sending_message";
    scroll: ScrollBehavior;
};
type ChatUpdated = { kind: "chat_updated" };
type LoadedPreviousEvents = { kind: "loaded_previous_events" };
type LoadedEventWindow = {
    kind: "loaded_event_window";
    focusThreadMessageIndex: number | undefined;
    messageIndex: number;
    preserveFocus: boolean;
    allowRecursion: boolean;
};

export const currentUserStore = immutableStore<CreatedUser | undefined>(undefined);

export const serverChatSummariesStore: Writable<Record<string, ChatSummary>> = immutableStore({});

export const chatSummariesStore: Readable<Record<string, ChatSummary>> = derived(
    [
        serverChatSummariesStore,
        unconfirmed,
        currentUserStore,
        localMessageUpdates,
        archivedChatsStore,
        mutedChatsStore,
    ],
    ([summaries, unconfirmed, currentUser, localUpdates, archivedChats, mutedChats]) => {
        return Object.entries(summaries).reduce<Record<string, ChatSummary>>(
            (result, [chatId, summary]) => {
                if (currentUser !== undefined) {
                    result[chatId] = mergeUnconfirmedIntoSummary(
                        currentUser.userId,
                        summary,
                        unconfirmed,
                        localUpdates,
                        archivedChats.get(summary.chatId),
                        mutedChats.get(chatId)
                    );
                }
                return result;
            },
            {}
        );
    }
);

// This is annoying. If only the pinnedChatIndex was stored in the chatSummary...
export const chatSummariesListStore = derived(
    [chatSummariesStore, pinnedChatsStore],
    ([summaries, pinnedChats]) => {
        const pinned = pinnedChats
            .filter((id) => summaries[id] !== undefined)
            .map((id) => summaries[id]);
        const unpinned = Object.values(summaries)
            .filter((chat) => !pinnedChats.includes(chat.chatId))
            .sort(compareChats);
        return pinned.concat(unpinned);
    }
);

export const selectedChatId = writable<string | undefined>(undefined);
export const chatsLoading = writable(false);
export const chatsInitialised = writable(false);
export const chatUpdatedStore: Writable<{ affectedEvents: number[] } | undefined> =
    writable(undefined);

export const selectedServerChatStore = derived(
    [serverChatSummariesStore, selectedChatId],
    ([$serverChats, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $serverChats[$selectedChatId];
    }
);

export const selectedChatStore = derived(
    [chatSummariesStore, selectedChatId],
    ([$chatSummaries, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $chatSummaries[$selectedChatId];
    }
);

export const nextMessageIndex = derived([selectedServerChatStore], ([$selectedServerChatStore]) => {
    if ($selectedServerChatStore === undefined) return 0;
    return getNextMessageIndex(
        $selectedServerChatStore,
        unconfirmed.getMessages($selectedServerChatStore.chatId)
    );
});

export const nextEventIndex = derived([selectedServerChatStore], ([$selectedServerChatStore]) => {
    if ($selectedServerChatStore === undefined) return 0;
    return getNextEventIndex(
        $selectedServerChatStore,
        unconfirmed.getMessages($selectedServerChatStore.chatId)
    );
});

export const isProposalGroup = derived([selectedChatStore], ([$selectedChat]) => {
    return (
        $selectedChat !== undefined &&
        $selectedChat.kind === "group_chat" &&
        $selectedChat.subtype?.kind === "governance_proposals"
    );
});

export const threadsByChatStore = derived([chatSummariesListStore], ([summaries]) => {
    return summaries.reduce((result, chat) => {
        if (chat.kind === "group_chat" && chat.latestThreads.length > 0) {
            result[chat.chatId] = chat.latestThreads;
        }
        return result;
    }, {} as Record<string, ThreadSyncDetails[]>);
});

export const threadsFollowedByMeStore = derived([threadsByChatStore], ([threadsByChat]) => {
    return Object.entries(threadsByChat).reduce<Record<string, Set<number>>>(
        (result, [chatId, threads]) => {
            const set = new Set<number>();
            for (const thread of threads) {
                set.add(thread.threadRootMessageIndex);
            }
            result[chatId] = set;
            return result;
        },
        {}
    );
});

export const proposalTopicsStore = derived(
    [selectedChatStore, snsFunctions],
    ([$selectedChat, $snsFunctions]): Map<number, string> => {
        if (
            $selectedChat !== undefined &&
            $selectedChat.kind === "group_chat" &&
            $selectedChat.subtype !== undefined
        ) {
            if ($selectedChat.subtype.isNns) {
                return new Map([
                    [1, "Neuron Management"],
                    [3, "Network Economics"],
                    [4, "Governance"],
                    [5, "Node Admin"],
                    [6, "Participant Management"],
                    [7, "Subnet Management"],
                    [8, "Network Canister Management"],
                    [9, "KYC"],
                    [10, "Node Provider Rewards"],
                    [11, "SNS Decentralization Sale"],
                ]);
            } else {
                const snsFunctionsMap = $snsFunctions.get(
                    $selectedChat.subtype.governanceCanisterId
                );
                if (snsFunctionsMap !== undefined) {
                    return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                }
            }
        }

        return new Map();
    }
);

function countThreads<T>(things: Record<string, T[]>): number {
    return Object.values(things)
        .map((ts) => ts.length)
        .reduce((total, n) => total + n, 0);
}

// returns the total number of threads that we are involved in
export const numberOfThreadsStore = derived([threadsByChatStore], ([threads]) =>
    countThreads(threads)
);

export function setSelectedChat(
    api: ServiceContainer,
    chat: ChatSummary,
    messageIndex?: number,
    threadMessageIndex?: number
): void {
    // const summaries = get(chatSummariesStore);
    // const currentUser = get(currentUserStore);
    const currentScrollStrategy = get(scrollStrategy);

    // if (currentUser === undefined) return;

    // const chat = summaries[chatId];

    // if (chat === undefined) return;

    closeNotificationsForChat(chat.chatId);

    // TODO don't think this should be in here really
    if (
        chat.kind === "group_chat" &&
        chat.subtype?.kind === "governance_proposals" &&
        !chat.subtype.isNns
    ) {
        api.listNervousSystemFunctions(chat.subtype.governanceCanisterId);
    }

    // const user: UserSummary = {
    //     kind: "user",
    //     userId: currentUser.userId,
    //     username: currentUser.username,
    //     lastOnline: Date.now(),
    //     updated: BigInt(Date.now()),
    // };

    if (messageIndex === undefined) {
        if (currentScrollStrategy === "firstMention") {
            messageIndex =
                getFirstUnreadMention(chat)?.messageIndex ?? getFirstUnreadMessageIndex(chat);
        }
        if (currentScrollStrategy === "firstMessage") {
            messageIndex = getFirstUnreadMessageIndex(chat);
        }
    }

    // const readableChatSummary = readable(chat, (set) =>
    //     serverChatSummariesStore.subscribe((summaries) => {
    //         if (summaries[chat.chatId] !== undefined) {
    //             set(summaries[chat.chatId]);
    //         }
    //     })
    // );

    clearSelectedChat();

    // initialise a bunch of stores
    serverEventsStore.set(chat.chatId, unconfirmed.getMessages(chat.chatId));
    focusMessageIndex.set(chat.chatId, messageIndex);
    currentChatMembers.set(chat.chatId, []);
    currentChatBlockedUsers.set(chat.chatId, new Set<string>());
    currentChatPinnedMessages.set(chat.chatId, new Set<number>());
    currentChatUserIds.set(
        chat.chatId,
        new Set<string>(chat.kind === "direct_chat" ? [chat.chatId] : [])
    );
    resetFilteredProposalsStore(chat);
    selectedChatId.set(chat.chatId);

    console.log("would have constructed chat controller");

    // selectedChatControllerStore.set(
    //     new ChatController(
    //         api,
    //         user,
    //         readableChatSummary,
    //         messageIndex,
    //         threadMessageIndex,
    //         (message) => updateSummaryWithConfirmedMessage(chat.chatId, message)
    //     )
    // );
}

export function updateSummaryWithConfirmedMessage(
    chatId: string,
    message: EventWrapper<Message>
): void {
    serverChatSummariesStore.update((summaries) => {
        const summary = summaries[chatId];
        if (summary === undefined) return summaries;

        const latestEventIndex = Math.max(message.index, summary.latestEventIndex);
        const overwriteLatestMessage =
            summary.latestMessage === undefined ||
            message.index > summary.latestMessage.index ||
            // If they are the same message, take the confirmed one since it'll have the correct timestamp
            message.event.messageId === summary.latestMessage.event.messageId;

        const latestMessage = overwriteLatestMessage ? message : summary.latestMessage;

        return {
            ...summaries,
            [chatId]: {
                ...summary,
                latestEventIndex,
                latestMessage,
            },
        };
    });
}

function userIdsFromChatSummaries(chats: ChatSummary[]): Set<string> {
    const userIds = new Set<string>();
    chats.forEach((chat) => {
        if (chat.kind === "direct_chat") {
            userIds.add(chat.them);
        } else if (chat.latestMessage !== undefined) {
            userIds.add(chat.latestMessage.event.sender);
            extractUserIdsFromMentions(getContentAsText(chat.latestMessage.event.content)).forEach(
                (id) => userIds.add(id)
            );
        }
    });
    return userIds;
}

export function clearSelectedChat(): void {
    filteredProposalsStore.set(undefined);
    selectedChatId.update((chatId) => {
        if (chatId !== undefined) {
            groupDetails.clear(chatId);
            serverEventsStore.clear(chatId);
            focusMessageIndex.clear(chatId);
            currentChatMembers.clear(chatId);
            currentChatBlockedUsers.clear(chatId);
            currentChatPinnedMessages.clear(chatId);
        }
        return undefined;
    });
}

async function loadChats(api: ServiceContainer) {
    try {
        const currentUser = get(currentUserStore);
        if (currentUser === undefined) {
            console.log("Current user not set, cannot load chats");
            return;
        }

        const init = get(chatsInitialised);

        chatsLoading.set(!init);
        const chats = Object.values(get(serverChatSummariesStore));
        const selectedChat = get(selectedChatStore);
        const currentState: CurrentChatState = {
            chatSummaries: chats,
            blockedUsers: get(blockedUsers),
            pinnedChats: get(pinnedChatsStore),
        };
        const chatsResponse =
            chatUpdatesSince === undefined
                ? await api.getInitialState(selectedChat?.chatId)
                : await api.getUpdates(
                      currentState,
                      updateArgsFromChats(chatUpdatesSince, chats),
                      selectedChat?.chatId
                  );

        chatUpdatesSince = chatsResponse.timestamp;

        if (chatsResponse.wasUpdated) {
            const userIds = userIdsFromChatSummaries(chatsResponse.chatSummaries);
            if (!init) {
                for (const userId of currentUser.referrals) {
                    userIds.add(userId);
                }
            }
            userIds.add(currentUser.userId);
            const usersResponse = await api.getUsers(
                {
                    userGroups: [
                        {
                            users: missingUserIds(get(userStore), userIds),
                            updatedSince: BigInt(0),
                        },
                    ],
                },
                true
            );

            userStore.addMany(usersResponse.users);

            if (chatsResponse.blockedUsers !== undefined) {
                blockedUsers.set(chatsResponse.blockedUsers);
            }

            if (chatsResponse.pinnedChats !== undefined) {
                pinnedChatsStore.set(chatsResponse.pinnedChats);
            }

            const selectedChat = get(selectedChatStore);
            let selectedChatInvalid = true;

            serverChatSummariesStore.set(
                chatsResponse.chatSummaries.reduce<Record<string, ChatSummary>>((rec, chat) => {
                    rec[chat.chatId] = chat;
                    if (selectedChat !== undefined && selectedChat.chatId === chat.chatId) {
                        selectedChatInvalid = false;
                    }
                    return rec;
                }, {})
            );

            if (selectedChatInvalid) {
                clearSelectedChat();
            } else if (selectedChat !== undefined) {
                chatUpdatedStore.set({
                    affectedEvents: chatsResponse.affectedEvents[selectedChat.chatId] ?? [],
                });
            }

            if (chatsResponse.avatarIdUpdate !== undefined) {
                const blobReference =
                    chatsResponse.avatarIdUpdate === "set_to_none"
                        ? undefined
                        : {
                              canisterId: currentUser.userId,
                              blobId: chatsResponse.avatarIdUpdate.value,
                          };
                const dataContent = {
                    blobReference,
                    blobData: undefined,
                    blobUrl: undefined,
                };
                const user = {
                    ...get(userStore)[currentUser.userId],
                    ...dataContent,
                };
                userStore.add(api.rehydrateDataContent(user, "avatar"));
            }

            chatsInitialised.set(true);
        }
    } catch (err) {
        rollbar.error("Error loading chats", err as Error);
        throw err;
    } finally {
        chatsLoading.set(false);
    }
}

export function createDirectChat(chatId: string): void {
    serverChatSummariesStore.update((chatSummaries) => {
        return {
            ...chatSummaries,
            [chatId]: {
                kind: "direct_chat",
                them: chatId,
                chatId,
                readByMe: new DRange(),
                readByThem: new DRange(),
                latestMessage: undefined,
                latestEventIndex: 0,
                dateCreated: BigInt(Date.now()),
                notificationsMuted: false,
                metrics: emptyChatMetrics(),
                myMetrics: emptyChatMetrics(),
                archived: false,
            },
        };
    });
    push(`/${chatId}`);
}

export function startChatPoller(api: ServiceContainer): Poller {
    return new Poller(() => loadChats(api), CHAT_UPDATE_INTERVAL, CHAT_UPDATE_IDLE_INTERVAL, true);
}

export function removeChat(chatId: string): void {
    serverChatSummariesStore.update((summaries) => {
        return Object.entries(summaries).reduce((agg, [k, v]) => {
            if (k !== chatId) {
                agg[k] = v;
            }
            return agg;
        }, {} as Record<string, ChatSummary>);
    });
}

// All of the below state is relative to the selected chat

export const serverEventsStore = createChatSpecificDataStore<EventWrapper<ChatEvent>[]>([]);
export const eventsStore: Readable<EventWrapper<ChatEvent>[]> = derived(
    [serverEventsStore, localMessageUpdates],
    ([$serverEventsForSelectedChat, $localMessageUpdates]) => {
        return mergeServerEventsWithLocalUpdates(
            $serverEventsForSelectedChat,
            $localMessageUpdates
        );
    }
);
export const currentChatMembers = createChatSpecificDataStore<Member[]>([]);
export const currentChatUserIds = createChatSpecificDataStore<Set<string>>(new Set<string>());
export const currentChatBlockedUsers = createChatSpecificDataStore<Set<string>>(new Set<string>());
export const currentChatPinnedMessages = createChatSpecificDataStore<Set<number>>(
    new Set<number>()
);
export const focusMessageIndex = createChatSpecificDataStore<number | undefined>(undefined);
// This set will contain 1 key for each rendered user event group which is used as that group's key
export const groupDetails = createChatSpecificDataStore<GroupChatDetails | undefined>(undefined);

const draftMessages = createChatSpecificDataStore<DraftMessage>({});
export const currentChatDraftMessage = {
    ...draftMessages,
    setTextContent: (id: string, textContent: string | undefined): void =>
        draftMessages.update(id, (d) => ({ ...d, ...{ textContent } })),
    setAttachment: (id: string, attachment: MessageContent | undefined): void =>
        draftMessages.update(id, (d) => ({ ...d, ...{ attachment } })),
    setReplyingTo: (id: string, replyingTo: EnhancedReplyContext | undefined): void =>
        draftMessages.update(id, (d) => ({ ...d, ...{ replyingTo } })),
    setEditing: (id: string, editingEvent: EventWrapper<Message>): void => {
        const users = get(userStore);
        const updated = {
            editingEvent,
            attachment:
                editingEvent?.event.content.kind !== "text_content"
                    ? editingEvent?.event.content
                    : undefined,
            replyingTo:
                editingEvent.event.repliesTo &&
                editingEvent.event.repliesTo.kind === "rehydrated_reply_context"
                    ? {
                          ...editingEvent.event.repliesTo,
                          content: editingEvent.event.content,
                          sender: users[editingEvent.event.sender],
                      }
                    : undefined,
        };
        draftMessages.update(id, (d) => ({ ...d, ...updated }));
    },
};
export const currentChatTextContent = derived(currentChatDraftMessage, (d) => d.textContent);
export const currentChatReplyingTo = derived(currentChatDraftMessage, (d) => d.replyingTo);
export const currentChatFileToAttach = derived(currentChatDraftMessage, (d) => d.attachment);
export const currentChatEditingEvent = derived(currentChatDraftMessage, (d) => d.editingEvent);
