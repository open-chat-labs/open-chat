<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import Button from "../../Button.svelte";

    export let canMakeGroupPrivate: boolean;
    export let chatId: string;

    const dispatch = createEventDispatcher();

    function deleteGroup() {
        dispatch("deleteGroup", chatId);
    }

    function makeGroupPrivate() {
        dispatch("makeGroupPrivate", chatId);
    }
</script>

<div class="wrapper">
    <Button on:click={deleteGroup}>{$_("deleteGroup")}</Button>
    {#if canMakeGroupPrivate}
        <Button on:click={makeGroupPrivate}>{$_("makeGroupPrivate")}</Button>
    {/if}
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        gap: $sp4;
    }
</style>
