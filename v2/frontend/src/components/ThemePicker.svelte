<script lang="ts">
    import { themes, saveSeletedTheme, loadAndApplySavedTheme } from "../theme/themes";
    import type { Themes } from "../theme/themes";
    import ModalContent from "./ModalContent.svelte";
    import Radio from "./Radio.svelte";

    let currentTheme = loadAndApplySavedTheme();
    let allThemes = Object.entries(themes);

    function selectTheme(e: any) {
        const key = e.target.value as keyof Themes;
        saveSeletedTheme(key);
    }
</script>

<ModalContent on:close>
    <span slot="header"> Choose your theme </span>
    <div class="body" slot="body">
        <Radio
            group="theme"
            value="system"
            checked={currentTheme === "system"}
            id="system"
            on:change={selectTheme}
            label="System default" />
        {#each allThemes as [name, theme]}
            <Radio
                group="theme"
                value={name}
                checked={theme.name === currentTheme}
                id={name}
                label={theme.label}
                on:change={selectTheme} />
        {/each}
    </div>
</ModalContent>

<style type="text/scss">
    .body {
        padding: $sp4 0;
    }
</style>
