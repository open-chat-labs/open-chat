<script lang="ts">
    import { IconButton, SectionHeader } from "component-lib";
    import { publish, type ResourceKey } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        titleKey: ResourceKey;
    }

    let { titleKey }: Props = $props();
</script>

<SectionHeader>
    {#snippet avatar()}
        <IconButton onclick={() => publish("closeModalPage")}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
        </IconButton>
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={titleKey} />
    {/snippet}
</SectionHeader>
