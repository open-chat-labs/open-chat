<script lang="ts">
    import Button from "../Button.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    const dispatch = createEventDispatcher();

    function newChat() {
        dispatch("newchat");
    }
</script>

<div class="wrapper">
    <h1 class="title">{$_("noChatSelected")}</h1>
    <p class="subtitle">{$_("selectAChat")}</p>

    <Button on:click={newChat}>{$_("newChat")}</Button>
</div>

<style type="text/scss">
    .wrapper {
        background-color: var(--currentChat-header-bg);
        color: var(--currentChat-header-txt);

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;

        @include fullHeight();
    }

    .subtitle {
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;
    }
</style>
