import type { ChatSummary } from "../domain/chat/chat";
import { unconfirmed } from "./unconfirmed";
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import {
    compareChats,
    getContentAsText,
    mergeUnconfirmedIntoSummary,
    updateArgsFromChats,
} from "../domain/chat/chat.utils";
import { currentUserStore, userStore } from "./user";
import { Poller } from "../fsm/poller";
import type { ServiceContainer } from "services/serviceContainer";
import { extractUserIdsFromMentions, missingUserIds } from "domain/user/user.utils";
import { blockedUsers } from "./blockedUsers";
import { push } from "svelte-spa-router";
import { rollbar } from "utils/logging";
import type { IMessageReadTracker } from "./markRead";

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;

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
    messageIndex: number;
    preserveFocus: boolean;
    allowRecursion: boolean;
};

export const serverChatSummariesStore: Writable<Record<string, ChatSummary>> = immutableStore({});

export const chatSummariesStore: Readable<Record<string, ChatSummary>> = derived(
    [serverChatSummariesStore, unconfirmed, currentUserStore],
    ([summaries, unconfirmed, currentUser]) => {
        return Object.entries(summaries).reduce<Record<string, ChatSummary>>(
            (result, [chatId, summary]) => {
                if (currentUser !== undefined) {
                    result[chatId] = mergeUnconfirmedIntoSummary(
                        currentUser.userId,
                        summary,
                        unconfirmed[chatId]?.messages
                    );
                }
                return result;
            },
            {}
        );
    }
);

export const chatSummariesListStore = derived(chatSummariesStore, (summaries) =>
    Object.values(summaries).sort(compareChats)
);

export const chatsLoading = writable(false);

export const selectedChatId = immutableStore<string | undefined>(undefined);

let chatUpdatesSince: bigint | undefined = undefined;
let chatsInitialised = false;

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

function clearSelectedChatId() {
    selectedChatId.update((chatId) => {
        if (chatId !== undefined) {
            push("/");
        }
        return undefined;
    });
}

async function loadChats(api: ServiceContainer, messagesRead: IMessageReadTracker) {
    try {
        const currentUser = get(currentUserStore);
        if (currentUser === undefined) {
            console.log("Current user not set, cannot load chats");
            return;
        }

        console.log("poll: loading chats");

        chatsLoading.set(!chatsInitialised);
        const chats = Object.values(get(serverChatSummariesStore));
        const chatId = get(selectedChatId);
        const chatsResponse =
            chatUpdatesSince === undefined
                ? await api.getInitialState(messagesRead, chatId)
                : await api.getUpdates(
                      chats,
                      updateArgsFromChats(chatUpdatesSince, chats),
                      messagesRead,
                      chatId
                  );

        chatUpdatesSince = chatsResponse.timestamp;

        if (chatsResponse.wasUpdated) {
            const userIds = userIdsFromChatSummaries(chatsResponse.chatSummaries);
            if (!chatsInitialised) {
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
            blockedUsers.set(chatsResponse.blockedUsers);

            const chatId = get(selectedChatId);
            let selectedChatInvalid = true;

            serverChatSummariesStore.set(
                chatsResponse.chatSummaries.reduce<Record<string, ChatSummary>>((rec, chat) => {
                    rec[chat.chatId] = chat;
                    if (chatId === chat.chatId) {
                        selectedChatInvalid = false;
                    }
                    return rec;
                }, {})
            );

            if (selectedChatInvalid) {
                clearSelectedChatId();
            } else if (chatId !== undefined) {
                // TODO - what to do about this
                // selectedChat.chatUpdated(chatsResponse.affectedEvents[chatId] ?? []);
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

            chatsInitialised = true;
        }
    } catch (err) {
        rollbar.error("Error loading chats", err as Error);
        throw err;
    } finally {
        chatsLoading.set(false);
    }
}

export function startChatPoller(api: ServiceContainer, messagesRead: IMessageReadTracker): Poller {
    console.log("poll: starting chats poller");
    return new Poller(
        () => loadChats(api, messagesRead),
        CHAT_UPDATE_INTERVAL,
        CHAT_UPDATE_IDLE_INTERVAL,
        true
    );
}
