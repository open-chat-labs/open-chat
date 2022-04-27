<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";

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

<ButtonGroup align="left">
    <Button on:click={deleteGroup}>{$_("deleteGroup")}</Button>
    {#if canMakeGroupPrivate}
        <Button on:click={makeGroupPrivate}>{$_("makeGroupPrivate")}</Button>
    {/if}
</ButtonGroup>
