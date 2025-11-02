<script lang="ts">
    import { SectionHeader } from "component-lib";
    import { publish, type ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        titleKey: ResourceKey;
        subtitleKey?: ResourceKey;
        onBack?: () => void;
        avatar?: Snippet;
        menu?: Snippet;
    }

    let {
        avatar,
        menu,
        titleKey,
        subtitleKey,
        onBack = () => publish("closeModalPage"),
    }: Props = $props();
</script>

<SectionHeader {menu} {avatar} {onBack}>
    {#snippet title()}
        <Translatable resourceKey={titleKey} />
    {/snippet}
    {#snippet subtitle()}
        {#if subtitleKey}
            <Translatable resourceKey={subtitleKey} />
        {/if}
    {/snippet}
</SectionHeader>
