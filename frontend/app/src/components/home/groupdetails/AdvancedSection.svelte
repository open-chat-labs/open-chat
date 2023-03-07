<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { GroupChatSummary } from "openchat-client";

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
</script>

<ButtonGroup align="start">
    <Button on:click={deleteGroup}>{$_("deleteGroup")}</Button>
</ButtonGroup>
