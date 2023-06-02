<script lang="ts">
    import { _ } from "svelte-i18n";
    import Legend from "../Legend.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { iconSize } from "../../stores/iconSize";

    export let label: string;
    export let rolePermission: string;
    export let roles: readonly string[];

    let selecting = false;
    let menu: MenuIcon;

    function select(r: string) {
        rolePermission = r;
    }
</script>

<Legend label={`${$_("permissions.whoCan")} ${label}`} />
<div class:selecting class="select" on:click|stopPropagation={() => menu.showMenu()}>
    <div class="role">
        {$_(`role.${rolePermission}`)}
    </div>
    <MenuIcon bind:this={menu} position="bottom" align="end">
        <span class="icon" slot="icon">
            <Kebab viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
        </span>
        <span slot="menu">
            <Menu>
                {#each roles as r, _i (r)}
                    <MenuItem on:click={() => select(r)}>
                        <Check
                            viewBox={"0 -3 24 24"}
                            size={$iconSize}
                            slot="icon"
                            color={roles.indexOf(rolePermission) >= roles.indexOf(r)
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

<style type="text/scss">
    .select {
        max-width: toRem(300);
        background-color: var(--input-bg);
        padding: $sp3 $sp3 $sp3 $sp4;
        color: var(--txt);
        box-shadow: var(--input-sh);
        border-radius: $sp2;
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
