<script lang="ts">
    import { IconButton, SectionHeader } from "component-lib";
    import { publish, type ResourceKey } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        titleKey: ResourceKey;
        subtitleKey?: ResourceKey;
        onBack?: () => void;
    }

    let { titleKey, subtitleKey, onBack = () => publish("closeModalPage") }: Props = $props();
</script>

<SectionHeader>
    {#snippet avatar()}
        <IconButton onclick={onBack}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
        </IconButton>
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={titleKey} />
    {/snippet}
    {#snippet subtitle()}
        {#if subtitleKey}
            <Translatable resourceKey={subtitleKey} />
        {/if}
    {/snippet}
</SectionHeader>
