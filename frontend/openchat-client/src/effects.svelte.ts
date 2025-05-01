import { chatIdentifiersEqual, type ChatIdentifier } from "openchat-shared";
import { untrack } from "svelte";
import type { OpenChat } from "./openchat";
import { app } from "./state/app.svelte";
import { localUpdates } from "./state/global";
import { pathState } from "./state/path.svelte";
import { ui } from "./state/ui.svelte";
import {
    chatListScopeStore,
    dummyCommunityPreviewStore,
    dummyExpiredEventRangeStore,
    dummyPinnedChatsStore,
    dummyScopedServerChats,
    dummyServerCommunities,
    dummyServerDirectChats,
    dummyServerEventsStore,
    dummyServerFavourites,
    dummyServerGroupChats,
    dummyThreadEventsStore,
    dummyWalletConfigStore,
    selectedChatId,
    selectedMessageContext,
} from "./stores";

function onSelectedCommunityChanged(client: OpenChat) {
    $effect(() => {
        if (app.chatsInitialised && app.selectedCommunityId !== undefined) {
            const id = app.selectedCommunityId;

            // this untrack is not really necessary in this case but it's probably a good pattern to follow to
            // make double sure we are only reacting to the things we want to react to
            untrack(() => {
                client.setSelectedCommunity(id).then((preview) => {
                    if (preview) {
                        // if we are previewing the community we need to select the first chat manually
                        client.selectFirstChat();
                    }
                });
            });
        }
    });
}

function onSelectedChatChanged(client: OpenChat) {
    $effect(() => {
        // we have to be *so* careful with the reactivity here. Is this actually better?
        if (
            app.chatsInitialised &&
            app.selectedChatId !== undefined &&
            (pathState.routeKind === "selected_channel_route" ||
                pathState.routeKind === "global_chat_selected_route")
        ) {
            untrack(() => {
                if (
                    pathState.route.kind === "selected_channel_route" ||
                    pathState.route.kind === "global_chat_selected_route"
                ) {
                    selectedChatId.set(app.selectedChatId);
                    const id = app.selectedChatId;
                    const messageIndex = pathState.route.messageIndex;
                    const threadMessageIndex = pathState.route.threadMessageIndex;
                    if (id !== undefined) {
                        client.setSelectedChat(id, messageIndex, threadMessageIndex);
                    }
                }
            });
        }
    });

    $effect(() => {
        if (app.selectedChatId === undefined) {
            selectedChatId.set(undefined);
        }
    });
}

// function onSelectedMessageChanged(client: OpenChat) {
//     $effect(() => {
//         // we will do all the stuff that depends on the selected message
//         // if the message is undefined we load the previous messages
//         // if we have a message id then we load the event window
//     });
// }

function onThreadClosed() {
    $effect(() => {
        if (!pathState.threadOpen) {
            untrack(() => {
                ui.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            });
        }
    });
}

function onThreadStateChanged(client: OpenChat) {
    let previousChatId: ChatIdentifier | undefined = undefined;
    $effect(() => {
        if (
            pathState.threadOpen &&
            pathState.messageIndex !== undefined &&
            app.selectedChatId !== undefined &&
            chatIdentifiersEqual(previousChatId, app.selectedChatId)
        ) {
            const chatId = app.selectedChatId;
            const idx = pathState.messageIndex;
            const threadIdx = pathState.threadMessageIndex;
            untrack(() => {
                client.openThreadFromMessageIndex(chatId, idx, threadIdx);
            });
        }
        previousChatId = app.selectedChatId;
    });
}

// In the transition period we need to try to keep certain svelte 5
// runes and Svelte 4 stores in sync. The easiest way to do this is with effects
function syncState() {
    $effect(() => {
        dummyCommunityPreviewStore.set(localUpdates.previewCommunities.size);
    });

    $effect(() => {
        chatListScopeStore.set(pathState.route.scope);
    });

    $effect(() => {
        void app.pinnedChats;
        dummyPinnedChatsStore.set(Symbol());
    });

    $effect(() => {
        void app.walletConfig;
        dummyWalletConfigStore.set(Symbol());
    });

    $effect(() => {
        void app.serverCommunities;
        dummyServerCommunities.set(Symbol());
    });

    $effect(() => {
        void app.serverDirectChats;
        dummyServerDirectChats.set(Symbol());
    });

    $effect(() => {
        void app.serverGroupChats;
        dummyServerGroupChats.set(Symbol());
    });

    $effect(() => {
        void app.serverFavourites;
        dummyServerFavourites.set(Symbol());
    });

    $effect(() => {
        void app.scopedServerChats;
        dummyScopedServerChats.set(Symbol());
    });

    $effect(() => {
        void app.selectedChat.serverEvents;
        dummyServerEventsStore.set(Symbol());
    });

    $effect(() => {
        void app.selectedChat.serverThreadEvents;
        dummyThreadEventsStore.set(Symbol());
    });

    $effect(() => {
        void app.selectedChat.expiredEventRanges;
        dummyExpiredEventRangeStore.set(Symbol());
    });

    $effect(() => {
        selectedMessageContext.set(app.selectedMessageContext);
    });
}

export function configureEffects(client: OpenChat) {
    $effect.root(() => {
        onSelectedCommunityChanged(client);

        onSelectedChatChanged(client);

        onThreadStateChanged(client);

        onThreadClosed();

        syncState();

        // TODO - this seems to be a reasonable approach, but it causes a flicker of No Chat Selected for some reason
        // so we might need to rethink - ok for now though.
        // Actually this is already the case on webtest & prod so it's no worse - but could it be better?
        $effect(() => {
            if (app.selectedChatId === undefined && pathState.route.scope.kind !== "none") {
                client.selectFirstChat();
            }
        });
    });
}
