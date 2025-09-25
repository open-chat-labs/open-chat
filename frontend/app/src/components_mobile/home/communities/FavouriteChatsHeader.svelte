<script lang="ts">
    import { MenuItem, SectionHeader } from "component-lib";
    import { iconSize, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
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
        <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("communities.favourites")} />
    {/snippet}
    {#snippet menu()}
        <MenuItem disabled={!canMarkAllRead} onclick={() => client.markAllReadForCurrentScope()}>
            {#snippet icon()}
                <CheckboxMultipleMarked size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            <Translatable resourceKey={i18nKey("markAllRead")} />
        </MenuItem>
    {/snippet}
</SectionHeader>
