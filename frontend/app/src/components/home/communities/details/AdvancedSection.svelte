<script lang="ts">
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import type { CommunitySummary } from "openchat-client";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
    import { publish } from "@src/utils/pubsub";

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();

    function deleteCommunity() {
        publish("deleteCommunity", {
            kind: "delete_community",
            communityId: community.id,
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
