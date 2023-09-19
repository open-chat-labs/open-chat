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
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Legend from "../../Legend.svelte";
    import { getContext, onMount } from "svelte";
    import type { Theme } from "../../../theme/types";
    import MenuIcon from "../../MenuIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { AvatarSize, type OpenChat } from "openchat-client";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");

    $: userStore = client.userStore;

    type PartitionedThemes = {
        light: Theme[];
        dark: Theme[];
    };

    let lightMenu: MenuIcon;
    let darkMenu: MenuIcon;

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
</script>

<div class="theme-buttons">
    <ButtonGroup nowrap align="fill">
        <Button on:click={() => themeType.set("system")} secondary={$themeType !== "system"}
            >{"System"}</Button>
        <Button on:click={() => themeType.set("light")} secondary={$themeType !== "light"}
            >{"Light"}</Button>
        <Button on:click={() => themeType.set("dark")} secondary={$themeType !== "dark"}
            >{"Dark"}</Button>
    </ButtonGroup>
</div>

<div class="theme-selection">
    <div class="theme-wrapper">
        <Legend label={`Prefered light theme`} />
        <div
            tabindex="0"
            role="button"
            class="theme"
            on:click={() => lightMenu.showMenu()}
            style={`background: ${$preferredLightTheme.bg}; border-color: ${$preferredLightTheme.accent}`}>
            <span style={`color: ${$preferredLightTheme.txt}`} class="theme-txt">
                {$preferredLightTheme.label}
            </span>

            <MenuIcon bind:this={lightMenu} position="bottom" align="end">
                <span class="icon" slot="icon">
                    <ChevronDown
                        viewBox={"0 -3 24 24"}
                        size={$iconSize}
                        color={`${$preferredLightTheme.accent}`} />
                </span>
                <span slot="menu">
                    <Menu>
                        {#each partitionedThemes.light as theme}
                            <MenuItem on:click={() => preferredLightThemeName.set(theme.name)}>
                                <div slot="text">
                                    {theme.label}
                                </div>
                            </MenuItem>
                        {/each}
                    </Menu>
                </span>
            </MenuIcon>
        </div>
    </div>
    <div class="theme-wrapper">
        <Legend label={`Prefered dark theme`} />
        <div
            tabindex="0"
            role="button"
            class="theme"
            on:click={() => darkMenu.showMenu()}
            style={`background: ${$preferredDarkTheme.bg}; border-color: ${$preferredDarkTheme.accent}`}>
            <span style={`color: ${$preferredDarkTheme.txt}`} class="theme-txt">
                {$preferredDarkTheme.label}
            </span>

            <MenuIcon bind:this={darkMenu} position="bottom" align="end">
                <span class="icon" slot="icon">
                    <ChevronDown
                        viewBox={"0 -3 24 24"}
                        size={$iconSize}
                        color={`${$preferredDarkTheme.accent}`} />
                </span>
                <span slot="menu">
                    <Menu>
                        {#each partitionedThemes.dark as theme}
                            <MenuItem on:click={() => preferredDarkThemeName.set(theme.name)}>
                                <div class="theme-item" slot="text">
                                    <div class="label">{theme.label}</div>
                                    {#if theme.author !== undefined && $userStore[theme.author] !== undefined}
                                        <div class="avatar">
                                            <Avatar
                                                url={client.userAvatarUrl($userStore[theme.author])}
                                                userId={theme.author}
                                                size={AvatarSize.Tiny} />
                                        </div>
                                    {/if}
                                </div>
                            </MenuItem>
                        {/each}
                    </Menu>
                </span>
            </MenuIcon>
        </div>
    </div>
</div>

<style lang="scss">
    :global(.theme-buttons button) {
        min-width: 0 !important;
    }

    .theme-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp3;
        width: 100%;
    }

    .theme-buttons {
        margin-bottom: $sp4;
    }

    .theme-selection {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;
        .theme-wrapper {
            flex: 1;
        }

        .theme {
            text-align: center;
            padding: 22px;
            height: 65px;
            color: #fff;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: $sp2;
            border-bottom: $sp2 solid var(--accent);
        }
    }
</style>
