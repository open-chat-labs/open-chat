<script lang="ts">
    import { Logo, SectionHeader } from "component-lib";
    import { i18nKey } from "@src/i18n/i18n";
    import Translatable from "@src/mobile/shared/Translatable.svelte";
    import GroupChatsMenu from "./GroupChatsMenu.svelte";

    interface Props {
        canMarkAllRead: boolean;
    }

    let props: Props = $props();
</script>

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("communities.directAndGroupChats")} />
    {/snippet}
    {#snippet menu()}
        <GroupChatsMenu {...props} />
    {/snippet}
</SectionHeader>
