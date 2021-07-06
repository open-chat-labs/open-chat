<script lang="ts">
    import Panel from "../Panel.svelte";
    import Button from "../Button.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import { push } from "svelte-spa-router";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import NoChatSelected from "./NoChatSelected.svelte";
    import type { HomeState } from "./Home.types";
    // import CurrentChat from "./CurrentChat.svelte";
    // import UnexpectedError from "../unexpectedError/UnexpectedError.svelte";
    // import Loading from "../Loading.svelte";
    export let hideLeft: boolean = false;
    export let selectedChatId: bigint | undefined;
    export let state: HomeState;

    $: console.log(state);
</script>

<Panel middle {hideLeft}>
    {#if state === "loadingChats"}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <div />
        {:else}
            <Loading />
        {/if}
    {:else if state === "loadingMessages"}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <div />
        {:else}
            <Loading />
        {/if}
    {:else if selectedChatId === undefined}
        <div in:fade>
            <NoChatSelected on:newchat />
        </div>
    {:else}
        <div class="currentChat">
            {#if $screenWidth === ScreenWidth.ExtraSmall}
                <Button on:click={() => push("/")}>Back</Button>
            {/if}
            <p class="title">{selectedChatId}</p>
        </div>
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
