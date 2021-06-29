<script lang="ts">
    import Panel from "./Panel.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import UnexpectedError from "./unexpectedError/UnexpectedError.svelte";
    import Loading from "./Loading.svelte";
    import { chatStore } from "../stores/chats";
    export let hideLeft: boolean = false;
</script>

<Panel middle {hideLeft}>
    {#if $chatStore}
        {#await $chatStore.chatDetails}
            <Loading />
        {:then chat}
            <CurrentChat on:goback {chat} />
        {:catch err}
            <UnexpectedError error={err} />
        {/await}
    {/if}
</Panel>
