<script lang="ts">
    import Radio from "../../Radio.svelte";
    import Legend from "../../Legend.svelte";
    import { _ } from "svelte-i18n";
    import { themeNameStore, saveSeletedTheme, communityThemes } from "../../../theme/themes";
    import { onMount } from "svelte";

    let communityThemeName = "";

    onMount(() => {
        return themeNameStore.subscribe((n) => {
            communityThemeName = ["system", "light", "dark"].includes(n) ? "" : n;
        });
    });

    function themeSelected(name: string) {
        communityThemeName = name;
        saveSeletedTheme(name);
    }
</script>

<div class="community-themes">
    <Legend rules={$_("useAtOwnRisk")} label={$_("communityTheme")} />
    {#each communityThemes as theme}
        <Radio
            on:change={() => themeSelected(theme.name)}
            value={theme.name}
            checked={communityThemeName === theme.name}
            id={`theme_${theme.name}`}
            label={theme.name}
            group={"community_themes"} />
    {/each}
</div>

<style type="text/scss">
    .community-themes {
        margin-bottom: $sp4;
    }
</style>
