import { app } from "./state/app.svelte";
import { userStore } from "./state/users/users.svelte";
import { dummyCurrentUser, dummyUserStore, dummyWalletConfigStore } from "./stores";

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

$effect.root(() => {
    syncState();
});
