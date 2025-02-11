<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    const dispatch = createEventDispatcher();

    export let label: ResourceKey;
    export let rolePermission: string | undefined;
    export let roles: readonly string[];
    export let defaultRole: string | undefined = undefined;

    $: defaultText = $_("role.default");
    $: defaultRoleText = defaultRole !== undefined ? $_(`role.${defaultRole}`) : undefined;
    $: selectedRoleText =
        rolePermission !== undefined
            ? $_(`role.${rolePermission}`)
            : defaultText + ` (${defaultRoleText})`;

    let selecting = false;
    let menu: MenuIcon;

    function select(r: string | undefined) {
        rolePermission = r;
        dispatch("change", rolePermission);
    }
</script>

<div class="legend">
    <span class="label"
        ><Translatable resourceKey={i18nKey("permissions.whoCan")} />
        <Translatable resourceKey={label} /></span>
</div>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class:selecting class="permission-select" on:click|stopPropagation={() => menu.showMenu()}>
    <div class="role">
        {selectedRoleText}
    </div>
    <MenuIcon bind:this={menu} position="bottom" align="end">
        <span class="icon" slot="icon">
            <ChevronDown viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
        </span>
        <span slot="menu">
            <Menu>
                {#if defaultRole !== undefined}
                    <MenuItem onclick={() => select(undefined)}>
                        <Check
                            viewBox={"0 -3 24 24"}
                            size={$iconSize}
                            slot="icon"
                            color={rolePermission === undefined
                                ? "var(--icon-inverted-txt)"
                                : "transparent"} />
                        <div slot="text">
                            {defaultText}
                        </div>
                    </MenuItem>
                {/if}
                {#each roles as r (r)}
                    <MenuItem onclick={() => select(r)}>
                        <Check
                            viewBox={"0 -3 24 24"}
                            size={$iconSize}
                            slot="icon"
                            color={rolePermission !== undefined &&
                            roles.indexOf(rolePermission) >= roles.indexOf(r) &&
                            (r !== "none" || rolePermission === "none")
                                ? "var(--icon-inverted-txt)"
                                : "transparent"} />
                        <div slot="text">
                            {$_(`role.${r}`)}
                        </div>
                    </MenuItem>
                {/each}
            </Menu>
        </span>
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
