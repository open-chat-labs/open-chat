<script lang="ts">
    import {
        type ChatPermissionRole,
        iconSize,
        type MemberRole,
        type ResourceKey,
        ROLE_NONE,
        roleAsText,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        label: ResourceKey;
        rolePermission: ChatPermissionRole | undefined;
        roles: readonly MemberRole[];
        defaultRole?: MemberRole | undefined;
    }

    let { label, rolePermission = $bindable(), roles, defaultRole = undefined }: Props = $props();

    let defaultText = $derived($_("role.default"));
    let defaultRoleText = $derived(
        defaultRole !== undefined ? $_(`role.${roleAsText(defaultRole)}`) : undefined,
    );
    let selectedRoleText = $derived(
        rolePermission !== undefined
            ? $_(`role.${roleAsText(rolePermission)}`)
            : defaultText + ` (${defaultRoleText})`,
    );

    let selecting = false;
    let menu: MenuIcon | undefined = $state();

    function select(r: ChatPermissionRole | undefined) {
        rolePermission = r;
    }

    function showMenu(e: Event) {
        e.stopPropagation();
        menu?.showMenu();
    }
</script>

<div class="legend">
    <span class="label"
        ><Translatable resourceKey={i18nKey("permissions.whoCan")} />
        <Translatable resourceKey={label} /></span>
</div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class:selecting class="permission-select" onclick={showMenu}>
    <div class="role">
        {selectedRoleText}
    </div>
    <MenuIcon bind:this={menu} position="bottom" align="end">
        {#snippet menuIcon()}
            <span class="icon">
                <ChevronDown viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
            </span>
        {/snippet}
        {#snippet menuItems()}
            <Menu>
                {#if defaultRole !== undefined}
                    <MenuItem onclick={() => select(undefined)}>
                        {#snippet icon()}
                            <Check
                                viewBox={"0 -3 24 24"}
                                size={$iconSize}
                                color={rolePermission === undefined
                                    ? "var(--icon-inverted-txt)"
                                    : "transparent"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                {defaultText}
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#each roles as r (r)}
                    <MenuItem onclick={() => select(r)}>
                        {#snippet icon()}
                            <Check
                                viewBox={"0 -3 24 24"}
                                size={$iconSize}
                                color={rolePermission !== undefined &&
                                roles.indexOf(rolePermission) >= roles.indexOf(r) &&
                                (r !== ROLE_NONE || rolePermission === ROLE_NONE)
                                    ? "var(--icon-inverted-txt)"
                                    : "transparent"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                {$_(`role.${roleAsText(r)}`)}
                            </div>
                        {/snippet}
                    </MenuItem>
                {/each}
            </Menu>
        {/snippet}
    </MenuIcon>
</div>

<style lang="scss">
    .permission-select {
        max-width: toRem(300);
        background-color: var(--input-bg);
        padding: $sp3 $sp3 $sp3 $sp4;
        color: var(--txt);
        box-shadow: var(--input-sh);
        border-radius: var(--rd);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp2;
        margin-bottom: $sp3;
        cursor: pointer;

        .role {
            flex: auto;
        }
    }
    .legend {
        margin-bottom: $sp2;
        display: flex;
        gap: $sp3;
        .label {
            @include font(book, normal, fs-60);
        }
    }
</style>
