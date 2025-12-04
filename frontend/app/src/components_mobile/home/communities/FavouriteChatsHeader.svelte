<script lang="ts">
    import { Logo, MenuItem, SectionHeader } from "component-lib";
    import { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        canMarkAllRead: boolean;
    }

    let { canMarkAllRead }: Props = $props();
</script>

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("communities.favourites")} />
    {/snippet}
    {#snippet menu()}
        <MenuItem disabled={!canMarkAllRead} onclick={() => client.markAllReadForCurrentScope()}>
            <Translatable resourceKey={i18nKey("markAllRead")} />
        </MenuItem>
    {/snippet}
</SectionHeader>
