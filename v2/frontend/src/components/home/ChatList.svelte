<script lang="ts">
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import Loading from "../Loading.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import NewMessageFab from "./NewMessageFab.svelte";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { elasticOut } from "svelte/easing";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import { _ } from "svelte-i18n";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";
    import { toastStore } from "../../stores/toast";

    export let machine: ActorRefFrom<HomeMachine>;

    $: user = $machine.context.user
        ? $machine.context.userLookup[$machine.context.user?.userId]
        : undefined;

    function filterChats(_event: { detail: string }) {}

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        // optimistic update
        machine.send({
            type: "UPDATE_USER_AVATAR",
            data: {
                blobData: ev.detail.data,
                blobUrl: ev.detail.url,
            },
        });
        $machine.context.serviceContainer
            ?.setUserAvatar(ev.detail.data)
            .then((_resp) => toastStore.showSuccessToast("avatarUpdated"))
            .catch((_err) => console.log(_err));
    }
</script>

{#if user}
    <CurrentUser
        on:userAvatarSelected={userAvatarSelected}
        on:logout
        {user}
        on:newchat
        on:joinGroup
        on:newGroup />
    <div class="body">
        <SearchChats on:filter={filterChats} />
        {#if $machine.matches("loading_chats")}
            <Loading />
        {:else}
            <div class="chat-summaries">
                {#each $machine.context.chatSummaries as chatSummary, _i (chatSummary.chatId)}
                    <div
                        animate:flip={{ duration: 600, easing: elasticOut }}
                        out:fade|local={{ duration: 150 }}>
                        <ChatSummary
                            users={$machine.context.userLookup}
                            {chatSummary}
                            selected={$machine.context.selectedChat?.chatId ===
                                chatSummary.chatId} />
                    </div>
                {/each}
            </div>
        {/if}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <NewMessageFab on:newchat />
        {/if}
    </div>
{/if}

<style type="text/scss">
    .body {
        overflow: auto;
        @include size-below(xs) {
            padding: 0 $sp3;
        }
    }
    .chat-summaries {
        overflow: auto;
    }
</style>
