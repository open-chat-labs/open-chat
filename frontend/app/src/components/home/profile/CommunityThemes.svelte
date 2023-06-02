<script lang="ts">
    import Select from "../../Select.svelte";
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

    function themeSelected() {
        if (communityThemeName !== "") {
            saveSeletedTheme(communityThemeName);
        }
    }
</script>

<Legend rules={$_("useAtOwnRisk")} label={$_("communityTheme")} />
<Select on:change={themeSelected} bind:value={communityThemeName}>
    <option disabled selected value={""}>{$_("selectCommunityTheme")}</option>
    {#each communityThemes as theme}
        <option value={theme.name}>{theme.label}</option>
    {/each}
</Select>

<style lang="scss">
</style>
