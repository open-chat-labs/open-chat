<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import type { CommunitySummary } from "openchat-client";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";

    export let community: CommunitySummary;

    const dispatch = createEventDispatcher();

    function deleteCommunity() {
        dispatch("deleteCommunity", {
            kind: "delete_community",
            id: community.id,
            doubleCheck: {
                challenge: i18nKey("typeGroupName", { name: community.name }),
                response: i18nKey(community.name),
            },
        });
    }
</script>

<ButtonGroup align="start">
    <Button on:click={deleteCommunity}
        ><Translatable resourceKey={i18nKey("communities.delete")} /></Button>
</ButtonGroup>
