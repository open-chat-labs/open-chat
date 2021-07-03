<script lang="ts">
    import Panel from "../Panel.svelte";
    import Button from "../Button.svelte";
    import { push } from "svelte-spa-router";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import NoChatSelected from "./NoChatSelected.svelte";
    import type { MiddlePanelState } from "./MiddlePanel.types";
    import Loading from "../Loading.svelte";
    // import CurrentChat from "./CurrentChat.svelte";
    // import UnexpectedError from "../unexpectedError/UnexpectedError.svelte";
    // import Loading from "../Loading.svelte";
    export let hideLeft: boolean = false;
    export let selectedChatId: string | undefined;
    export let state: MiddlePanelState;
</script>

<Panel middle {hideLeft}>
    {#if state === "loadingChats"}
        <Loading />
    {:else if selectedChatId === undefined}
        <NoChatSelected on:newchat />
    {:else}
        <div class="currentChat">
            {#if $screenWidth === ScreenWidth.ExtraSmall}
                <Button on:click={() => push("/")}>Back</Button>
            {/if}
            <p class="title">{selectedChatId}</p>
        </div>
    {/if}

    <!-- {#if $chatStore}
        {#await $chatStore.chatDetails}
            <Loading />
        {:then chat}
            <CurrentChat on:goback {chat} />
        {:catch err}
            <UnexpectedError error={err} />
        {/await}
    {/if} -->
</Panel>

<style type="text/scss">
    @import "../../styles/mixins";

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
