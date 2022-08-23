import type {
    ChatSummary,
    CurrentChatState,
    EventWrapper,
    Message,
    ThreadSyncDetails,
} from "../domain/chat/chat";
import { unconfirmed } from "./unconfirmed";
import { derived, get, readable, Readable, writable, Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import {
    compareChats,
    getContentAsText,
    getFirstUnreadMention,
    getFirstUnreadMessageIndex,
    mergeUnconfirmedIntoSummary,
    updateArgsFromChats,
} from "../domain/chat/chat.utils";
import { userStore } from "./user";
import { Poller } from "../fsm/poller";
import type { ServiceContainer } from "../services/serviceContainer";
import { extractUserIdsFromMentions, missingUserIds } from "../domain/user/user.utils";
import { blockedUsers } from "./blockedUsers";
import { pinnedChatsStore } from "./pinnedChats";
import { push } from "svelte-spa-router";
import { rollbar } from "../utils/logging";
import { closeNotificationsForChat } from "../utils/notifications";
import type { CreatedUser, UserSummary } from "../domain/user/user";
import { scrollStrategy } from "./settings";
import { ChatController } from "../fsm/chat.controller";
import DRange from "drange";
import { emptyChatMetrics } from "../domain/chat/chat.utils.shared";
import { snsFunctions } from "./snsFunctions";
import { mutedChatsStore } from "./mutedChatsStore";
import { filteredProposalsStore, resetFilteredProposalsStore } from "./filteredProposals";

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
    | LoadedNewMessages
    | SendingMessage
    | ChatUpdated
    | LoadedEventWindow
    | LoadedPreviousMessages;

type Nothing = { kind: "nothing" };
type LoadedNewMessages = { kind: "loaded_new_messages" };
type SendingMessage = {
    kind: "sending_message";
    scroll: ScrollBehavior;
};
type ChatUpdated = { kind: "chat_updated" };
type LoadedPreviousMessages = { kind: "loaded_previous_messages" };
type LoadedEventWindow = {
    kind: "loaded_event_window";
    focusThreadMessageIndex: number | undefined;
    messageIndex: number;
    preserveFocus: boolean;
    allowRecursion: boolean;
};

export const currentUserStore = immutableStore<CreatedUser | undefined>(undefined);

export const selectedChatStore = writable<ChatController | undefined>(undefined);

export const isProposalGroup = derived([selectedChatStore], ([$selectedChatStore]) => {
    return (
        $selectedChatStore !== undefined &&
        $selectedChatStore.chatVal.kind === "group_chat" &&
        $selectedChatStore.chatVal.subtype?.kind === "governance_proposals"
    );
});

export const serverChatSummariesStore: Writable<Record<string, ChatSummary>> = immutableStore({});

export const chatSummariesStore: Readable<Record<string, ChatSummary>> = derived(
    [serverChatSummariesStore, unconfirmed, currentUserStore, mutedChatsStore],
    ([summaries, unconfirmed, currentUser, mutedChats]) => {
        return Object.entries(summaries).reduce<Record<string, ChatSummary>>(
            (result, [chatId, summary]) => {
                if (currentUser !== undefined) {
                    result[chatId] = mergeUnconfirmedIntoSummary(
                        currentUser.userId,
                        summary,
                        unconfirmed,
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

export const threadsByChatStore = derived([chatSummariesListStore], ([summaries]) => {
    return summaries.reduce((result, chat) => {
        if (chat.kind === "group_chat" && chat.latestThreads.length > 0) {
            result[chat.chatId] = chat.latestThreads;
        }
        return result;
    }, {} as Record<string, ThreadSyncDetails[]>);
});

export const proposalTopicsStore = derived(
    [selectedChatStore, snsFunctions],
    ([selectedChat, snsFunctions]): Map<number, string> => {
        if (selectedChat !== undefined) {
            const chat = get(selectedChat.chat);
            if (chat.kind === "group_chat" && chat.subtype !== undefined) {
                if (chat.subtype.isNns) {
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
                    const snsFunctionsMap = snsFunctions.get(chat.subtype.governanceCanisterId);
                    if (snsFunctionsMap !== undefined) {
                        return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                    }
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

// returns the totol number of threads that we are involved in
export const numberOfThreadsStore = derived([threadsByChatStore], ([threads]) =>
    countThreads(threads)
);

export const chatsLoading = writable(false);
export const chatsInitialised = writable(false);

export function setSelectedChat(
    api: ServiceContainer,
    chatId: string,
    messageIndex?: number,
    threadMessageIndex?: number
): void {
    const summaries = get(chatSummariesStore);
    const currentUser = get(currentUserStore);
    const currentScrollStrategy = get(scrollStrategy);

    if (currentUser === undefined) return;

    const chat = summaries[chatId];

    if (chat === undefined) return;

    closeNotificationsForChat(chatId);

    if (
        chat.kind === "group_chat" &&
        chat.subtype?.kind === "governance_proposals" &&
        !chat.subtype.isNns
    ) {
        api.listNervousSystemFunctions(chat.subtype.governanceCanisterId);
    }

    const user: UserSummary = {
        kind: "user",
        userId: currentUser.userId,
        username: currentUser.username,
        lastOnline: Date.now(),
        updated: BigInt(Date.now()),
    };

    if (messageIndex === undefined) {
        if (currentScrollStrategy === "firstMention") {
            messageIndex =
                getFirstUnreadMention(chat)?.messageIndex ?? getFirstUnreadMessageIndex(chat);
        }
        if (currentScrollStrategy === "firstMessage") {
            messageIndex = getFirstUnreadMessageIndex(chat);
        }
    }

    const readableChatSummary = readable(chat, (set) =>
        serverChatSummariesStore.subscribe((summaries) => {
            if (summaries[chat.chatId] !== undefined) {
                set(summaries[chat.chatId]);
            }
        })
    );

    selectedChatStore.set(
        new ChatController(
            api,
            user,
            readableChatSummary,
            messageIndex,
            threadMessageIndex,
            (message) => updateSummaryWithConfirmedMessage(chat.chatId, message)
        )
    );

    resetFilteredProposalsStore(chat);
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

export function clearSelectedChat(navigate = true): void {
    filteredProposalsStore.set(undefined);
    selectedChatStore.update((controller) => {
        if (controller !== undefined) {
            controller.destroy();
            if (navigate) {
                push("/");
            }
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
                selectedChat.chatUpdated(chatsResponse.affectedEvents[selectedChat.chatId] ?? []);
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
