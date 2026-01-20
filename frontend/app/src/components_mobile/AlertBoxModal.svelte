<script lang="ts">
    import { ColourVars, Column, Sheet, StatusCard } from "component-lib";
    import { type ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import Markdown from "./home/Markdown.svelte";

    interface Props {
        title: ResourceKey;
        warning: ResourceKey;
        onClose: () => void;
    }

    let { onClose, title, warning }: Props = $props();
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <StatusCard
            background={ColourVars.background0}
            mode="warning"
            title={interpolate($_, title)}>
            {#snippet body()}
                <Markdown text={interpolate($_, warning)} />
            {/snippet}
        </StatusCard>
    </Column>
</Sheet>
