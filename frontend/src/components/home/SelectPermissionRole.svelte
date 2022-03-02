<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { PermissionRole } from "../../domain/chat/chat";
    import Select from "../Select.svelte";

    export let label: string;
    export let rolePermission: PermissionRole;
    export let viewMode: boolean = false;

    function permissionRoleText() {
        switch (rolePermission) {
            case "owner":
                return $_("group.permissions.ownerOnly");
            case "admins":
                return $_("group.permissions.ownerAndAdmins");
            case "members":
                return $_("group.permissions.allMembers");
        }
    }
</script>

<li>
    <span>{label}</span>
    {#if viewMode}
        <div>{permissionRoleText()}</div>
    {:else}
        <Select bind:value={rolePermission} marginBottom={0}>
            <option value={"owner"}>{$_("group.permissions.ownerOnly")}</option>
            <option value={"admins"}>{$_("group.permissions.ownerAndAdmins")}</option>
            <option value={"members"}>{$_("group.permissions.allMembers")}</option>
        </Select>
    {/if}
</li>

<style type="text/scss">
    li {
        @include font(book, normal, fs-90);

        span {
            @include font(mediumBold, normal, fs-90);
        }

        margin-bottom: $sp4;

        &:last-child {
            margin-bottom: 0;
        }
    }
</style>
