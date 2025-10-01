<script lang="ts">
    import { IconButton, SectionHeader } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
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
        <Translatable resourceKey={i18nKey("Profile settings")} />
    {/snippet}
</SectionHeader>
