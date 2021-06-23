<script lang="ts">
    import { themes, saveSeletedTheme, loadSavedTheme } from "../theme/themes";
    import type { Themes } from "../theme/themes";
    import ModalContent from "./ModalContent.svelte";
    import Radio from "./Radio.svelte";

    let currentTheme = loadSavedTheme();
    let allThemes = Object.entries(themes);

    function selectTheme(e: any) {
        const key = e.target.value as keyof Themes;
        saveSeletedTheme(key);
    }
</script>

<ModalContent>
    <span slot="header"> Choose your theme </span>
    <span slot="body">
        <Radio
            group="theme"
            value="system"
            checked={currentTheme === "system"}
            id="system"
            on:change={selectTheme}
            label="System default"
        />
        {#each allThemes as [name, theme]}
            <Radio
                group="theme"
                value={name}
                checked={theme.name === currentTheme}
                id={name}
                label={theme.label}
                on:change={selectTheme}
            />
        {/each}
    </span>
</ModalContent>
