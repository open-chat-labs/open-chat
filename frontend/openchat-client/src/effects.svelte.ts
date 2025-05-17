import { untrack } from "svelte";
import type { OpenChat } from "./openchat";
import { app } from "./state/app.svelte";
import { pathState } from "./state/path.svelte";
import { userStore } from "./state/users/users.svelte";
import { dummyCurrentUser, dummyUserStore, dummyWalletConfigStore } from "./stores";

function onSelectedCommunityChanged(client: OpenChat) {
    $effect(() => {
        if (app.chatsInitialised && app.selectedCommunityId !== undefined) {
            const id = app.selectedCommunityId;

            // this untrack is not really necessary in this case but it's probably a good pattern to follow to
            // make double sure we are only reacting to the things we want to react to
            untrack(() => {
                client.setSelectedCommunity(id).then((preview) => {
                    if (preview && app.selectedChatId === undefined) {
                        // if we are previewing the community we need to select the first chat manually
                        client.selectFirstChat();
                    }
                });
            });
        }
    });
}

function onSelectedChatChanged() {}

// function onSelectedMessageChanged(client: OpenChat) {
//     $effect(() => {
//         // we will do all the stuff that depends on the selected message
//         // if the message is undefined we load the previous messages
//         // if we have a message id then we load the event window
//     });
// }

function onThreadClosed() {}

function onThreadStateChanged() {}

// In the transition period we need to try to keep certain svelte 5
// runes and Svelte 4 stores in sync. The easiest way to do this is with effects
function syncState() {
    $effect(() => {
        void app.walletConfig;
        dummyWalletConfigStore.set(Symbol());
    });

    $effect(() => {
        void app.currentUser;
        dummyCurrentUser.set(Symbol());
    });

    $effect(() => {
        void userStore.allUsers;
        dummyUserStore.set(Symbol());
    });
}

export function configureEffects(client: OpenChat) {
    // Note that the order of these effects is important
    $effect.root(() => {
        syncState();

        onSelectedCommunityChanged(client);

        onThreadStateChanged();

        onThreadClosed();

        // TODO - this seems to be a reasonable approach, but it causes a flicker of No Chat Selected for some reason
        // so we might need to rethink - ok for now though.
        // Actually this is already the case on webtest & prod so it's no worse - but could it be better?
        $effect(() => {
            if (
                app.selectedChatId === undefined &&
                app.chatListScope.kind !== "none" &&
                !pathState.exploring
            ) {
                client.selectFirstChat();
            }
        });

        onSelectedChatChanged();
    });
}
