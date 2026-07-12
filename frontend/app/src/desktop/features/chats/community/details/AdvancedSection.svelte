<script lang="ts">
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import { publish, type CommunitySummary } from "@client";
    import { i18nKey } from "@src/i18n/i18n";
    import Translatable from "@src/ui/Translatable.svelte";

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
    <Button danger onClick={deleteCommunity}
        ><Translatable resourceKey={i18nKey("communities.delete")} /></Button>
</ButtonGroup>
