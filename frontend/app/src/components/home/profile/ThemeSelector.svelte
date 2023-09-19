<script lang="ts">
    import { _ } from "svelte-i18n";
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

    type PartitionedThemes = {
        light: Theme[];
        dark: Theme[];
    };

    let partitionedThemes: PartitionedThemes = {
        light: [],
        dark: [],
    };

    onMount(() => {
        partitionedThemes = Object.values(themes).reduce((p, theme) => {
            if (theme.mode === "light") {
                p.light.push(theme);
            }
            if (theme.mode === "dark") {
                p.dark.push(theme);
            }
            return p;
        }, partitionedThemes);
    });

    function selectLightTheme(ev: CustomEvent<string>) {
        preferredLightThemeName.set(ev.detail);
    }

    function selectDarkTheme(ev: CustomEvent<string>) {
        preferredDarkThemeName.set(ev.detail);
    }
</script>

<div class="theme-buttons">
    <ButtonGroup nowrap align="fill">
        <Button on:click={() => themeType.set("system")} secondary={$themeType !== "system"}
            >{$_("theme.system")}</Button>
        <Button on:click={() => themeType.set("light")} secondary={$themeType !== "light"}
            >{$_("theme.light")}</Button>
        <Button on:click={() => themeType.set("dark")} secondary={$themeType !== "dark"}
            >{$_("theme.dark")}</Button>
    </ButtonGroup>
</div>

<div class="theme-selection">
    <ThemeSelection
        on:select={selectLightTheme}
        label={$_("theme.preferredLightTheme")}
        theme={$preferredLightTheme}
        otherThemes={partitionedThemes.light} />
    <ThemeSelection
        on:select={selectDarkTheme}
        label={$_("theme.preferredDarkTheme")}
        theme={$preferredDarkTheme}
        otherThemes={partitionedThemes.dark} />
</div>

<style lang="scss">
    :global(.theme-buttons button) {
        min-width: 0 !important;
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
