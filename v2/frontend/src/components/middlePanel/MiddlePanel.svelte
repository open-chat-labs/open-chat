<script lang="ts">
    import Panel from "../Panel.svelte";
    import Button from "../Button.svelte";
    import { push } from "svelte-spa-router";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    // import CurrentChat from "./CurrentChat.svelte";
    // import UnexpectedError from "../unexpectedError/UnexpectedError.svelte";
    // import Loading from "../Loading.svelte";
    export let hideLeft: boolean = false;
    export let selectedChatId: string | undefined;
</script>

<Panel middle {hideLeft}>
    <h1 style="color: aqua;">{selectedChatId}</h1>

    {#if $screenWidth === ScreenWidth.ExtraSmall}
        <Button on:click={() => push("/")}>Back</Button>
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
