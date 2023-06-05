<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import type { Community } from "openchat-client";

    export let community: Community;

    const dispatch = createEventDispatcher();

    function deleteCommunity() {
        dispatch("deleteCommunity", {
            kind: "delete_community",
            id: community.id,
            doubleCheck: {
                challenge: $_("typeGroupName", { values: { name: community.name } }),
                response: community.name,
            },
        });
    }
</script>

<ButtonGroup align="start">
    <Button on:click={deleteCommunity}>{$_("communities.delete")}</Button>
</ButtonGroup>
