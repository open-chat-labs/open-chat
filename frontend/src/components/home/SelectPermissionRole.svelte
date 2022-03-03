<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { PermissionRole } from "../../domain/chat/chat";
    import Select from "../Select.svelte";

    export let label: string;
    export let rolePermission: PermissionRole;
    export let viewMode: boolean = false;

    let textLookup: Record<PermissionRole, string> = {
        owner: $_("group.permissions.ownerOnly"),
        admins: $_("group.permissions.ownerAndAdmins"),
        members: $_("group.permissions.allMembers"),
    };
</script>

<li>
    <span>{label}</span>
    {#if viewMode}
        <div>{textLookup[rolePermission]}</div>
    {:else}
        <Select bind:value={rolePermission} margin={false}>
            <option value={"owner"}>{textLookup["owner"]}</option>
            <option value={"admins"}>{textLookup["admins"]}</option>
            <option value={"members"}>{textLookup["members"]}</option>
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
