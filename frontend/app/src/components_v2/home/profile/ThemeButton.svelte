<script lang="ts">
    import type { Alignment } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import { allUsersStore, AvatarSize, iconSize, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import type { Theme } from "../../../theme/types";
    import Avatar from "../../Avatar.svelte";
    import Legend from "../../Legend.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        theme: Theme;
        otherThemes: Theme[];
        label: ResourceKey;
        align: Alignment;
        onSelect: (name: string) => void;
    }

    let { theme, otherThemes, label, align, onSelect }: Props = $props();
</script>

<div class="theme-wrapper">
    <Legend {label} />
    <MenuIcon gutter={0} position="bottom" {align}>
        {#snippet menuIcon()}
            <div
                tabindex="0"
                role="button"
                class="theme"
                style={`background: ${theme.bg}; border-color: ${theme.accent}`}>
                <div style={`color: ${theme.txt}`} class="theme-txt">
                    {theme.label}
                </div>

                <div class="icon">
                    <ChevronDown
                        viewBox={"0 -3 24 24"}
                        size={$iconSize}
                        color={`${theme.accent}`} />
                </div>
            </div>
        {/snippet}
        {#snippet menuItems()}
            <Menu>
                {#each otherThemes.toSorted() as theme}
                    <MenuItem onclick={() => onSelect(theme.name)}>
                        {#snippet text()}
                            <div class="theme-item">
                                <div class="label">{theme.label}</div>
                                {#if theme.author !== undefined && $allUsersStore.get(theme.author) !== undefined}
                                    <div class="avatar">
                                        <Avatar
                                            url={client.userAvatarUrl(
                                                $allUsersStore.get(theme.author),
                                            )}
                                            userId={theme.author}
                                            size={AvatarSize.Tiny} />
                                    </div>
                                {/if}
                            </div>
                        {/snippet}
                    </MenuItem>
                {/each}
            </Menu>
        {/snippet}
    </MenuIcon>
</div>

<style lang="scss">
    .theme-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp3;
        width: 100%;
    }

    .theme-txt {
        @include ellipsis();
    }

    .icon {
        flex: 0 0 24px;
    }

    .theme-wrapper {
        flex: 1;
    }

    .theme {
        text-align: center;
        padding: 36px 22px;
        height: 65px;
        color: #fff;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp2;
        border-bottom: $sp2 solid var(--accent);

        @include mobile() {
            padding: 12px;
        }
    }
</style>
