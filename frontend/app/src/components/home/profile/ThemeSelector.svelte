<script lang="ts">
    import {
        preferredDarkThemeName,
        preferredLightThemeName,
        preferredDarkTheme,
        preferredLightTheme,
        themes,
        themeType,
    } from "../../../theme/themes";
    import { onMount } from "svelte";
    import type { Theme } from "../../../theme/types";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import ThemeButton from "./ThemeButton.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    type PartitionedThemes = {
        light: Theme[];
        dark: Theme[];
    };

    let partitionedThemes: PartitionedThemes = $state({
        light: [],
        dark: [],
    });

    onMount(() => {
        partitionedThemes = Object.values(themes).reduce((p, theme) => {
            if (theme.hidden) return p;

            if (theme.mode === "light") {
                p.light.push(theme);
            }
            if (theme.mode === "dark") {
                p.dark.push(theme);
            }
            return p;
        }, partitionedThemes);
        partitionedThemes.light.sort((a, b) => a.label.localeCompare(b.label));
        partitionedThemes.dark.sort((a, b) => a.label.localeCompare(b.label));
    });

    function selectLightTheme(name: string) {
        preferredLightThemeName.set(name);
    }

    function selectDarkTheme(name: string) {
        preferredDarkThemeName.set(name);
    }
</script>

<div class="theme-buttons">
    <ButtonGroup nowrap align="fill">
        <Button onClick={() => themeType.set("system")} secondary={$themeType !== "system"}
            ><Translatable resourceKey={i18nKey("theme.system")} /></Button>
        <Button onClick={() => themeType.set("light")} secondary={$themeType !== "light"}
            ><Translatable resourceKey={i18nKey("theme.light")} /></Button>
        <Button onClick={() => themeType.set("dark")} secondary={$themeType !== "dark"}
            ><Translatable resourceKey={i18nKey("theme.dark")} /></Button>
    </ButtonGroup>
</div>

<div class="theme-selection">
    <ThemeButton
        align={"start"}
        onSelect={selectLightTheme}
        label={i18nKey("theme.preferredLightTheme")}
        theme={$preferredLightTheme}
        otherThemes={partitionedThemes.light} />
    <ThemeButton
        align={"end"}
        onSelect={selectDarkTheme}
        label={i18nKey("theme.preferredDarkTheme")}
        theme={$preferredDarkTheme}
        otherThemes={partitionedThemes.dark} />
</div>

<style lang="scss">
    :global(.theme-buttons button) {
        min-width: 0 !important;
        padding: unset !important;
    }

    .theme-buttons {
        margin-bottom: $sp4;
    }

    .theme-selection {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;
    }
</style>
