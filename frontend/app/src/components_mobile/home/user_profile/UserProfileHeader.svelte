<script lang="ts">
    import { Logo, SectionHeader } from "component-lib";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
</script>

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("profile.title")} />
    {/snippet}
    {#snippet menu()}
        Menu
    {/snippet}
</SectionHeader>
