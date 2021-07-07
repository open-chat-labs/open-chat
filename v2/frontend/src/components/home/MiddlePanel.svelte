<script lang="ts">
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import type { UserLookup } from "../../domain/user";
    import NoChatSelected from "./NoChatSelected.svelte";
    import type { HomeState } from "./Home.types";
    import CurrentChat from "./CurrentChat.svelte";
    import type { ChatSummary } from "../../domain/chat";
    export let hideLeft: boolean = false;
    export let selectedChatSummary: ChatSummary | undefined;
    export let state: HomeState;
    export let users: UserLookup;
</script>

<Panel middle {hideLeft}>
    {#if state === "loadingChats"}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <div />
        {:else}
            <Loading />
        {/if}
    {:else if state === "noChatSelected" || selectedChatSummary === undefined}
        <div in:fade>
            <NoChatSelected on:newchat />
        </div>
    {:else}
        <CurrentChat {users} {state} on:clearSelection {selectedChatSummary} />
    {/if}
</Panel>

<style type="text/scss">
    .currentChat {
        background-color: var(--currentChat-header-bg);
        color: var(--currentChat-header-txt);

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;

        height: 100%;
    }

    .title {
        @include font(bold, normal, fs-180);
        text-align: center;
        margin-bottom: $sp3;
    }
</style>
