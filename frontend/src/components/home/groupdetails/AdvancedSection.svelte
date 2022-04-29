<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { GroupChatSummary } from "../../../domain/chat/chat";

    export let canMakeGroupPrivate: boolean;
    export let group: GroupChatSummary;

    const dispatch = createEventDispatcher();

    function deleteGroup() {
        dispatch("deleteGroup", {
            kind: "delete",
            chatId: group.chatId,
            doubleCheck: {
                challenge: $_("typeGroupName", { values: { name: group.name } }),
                response: group.name,
            },
        });
    }

    function makeGroupPrivate() {
        dispatch("makeGroupPrivate", { kind: "makePrivate", chatId: group.chatId });
    }
</script>

<ButtonGroup align="left">
    <Button on:click={deleteGroup}>{$_("deleteGroup")}</Button>
    {#if canMakeGroupPrivate}
        <Button on:click={makeGroupPrivate}>{$_("makeGroupPrivate")}</Button>
    {/if}
</ButtonGroup>
