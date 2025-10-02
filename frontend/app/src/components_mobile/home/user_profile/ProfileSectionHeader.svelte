<script lang="ts">
    import { IconButton, SectionHeader } from "component-lib";
    import type { OpenChat, ResourceKey } from "openchat-client";
    import { getContext } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        titleKey: ResourceKey;
    }

    let { titleKey }: Props = $props();
</script>

<SectionHeader>
    {#snippet avatar()}
        <IconButton onclick={client.popRightPanelHistory}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
        </IconButton>
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={titleKey} />
    {/snippet}
</SectionHeader>
