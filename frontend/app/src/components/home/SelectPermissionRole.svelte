<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Legend from "../Legend.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { iconSize } from "../../stores/iconSize";

    const dispatch = createEventDispatcher();

    export let label: string;
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

<Legend label={`${$_("permissions.whoCan")} ${label}`} />
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
                    <MenuItem on:click={() => select(undefined)}>
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
                    <MenuItem on:click={() => select(r)}>
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
</style>
