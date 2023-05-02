<script lang="ts">
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import type { GroupPermissions, PermissionRole } from "openchat-client";

    export let permissions: GroupPermissions;
    export let isPublic: boolean;

    type PermissionsByRole = Record<PermissionRole, Set<string>>;
    type PermissionsEntry = [keyof GroupPermissions, PermissionRole];

    const allRoles: PermissionRole[] = ["owner", "admins", "members"];

    const roleLabels: Record<PermissionRole, string> = {
        owner: "group.permissions.ownerOnly",
        admins: "group.permissions.ownerAndAdmins",
        members: "group.permissions.allMembers",
    };

    $: partitioned = partitionPermissions(permissions);

    function filterPermissions([key, _]: PermissionsEntry): boolean {
        if (isPublic && (key === "removeMembers" || key === "inviteUsers")) {
            return false;
        }
        if (!isPublic && key === "blockUsers") {
            return false;
        }
        return true;
    }

    function partitionPermissions(permissions: GroupPermissions): PermissionsByRole {
        return (Object.entries(permissions) as PermissionsEntry[]).filter(filterPermissions).reduce(
            (dict: PermissionsByRole, [key, val]) => {
                dict[val].add($_(`group.permissions.${key}`));
                return dict;
            },
            { admins: new Set(), members: new Set(), owner: new Set() } as PermissionsByRole
        );
    }
</script>

<ul>
    {#each allRoles as role}
        {#if partitioned[role].size > 0}
            <li class="section">
                <div class="who-can">{$_(roleLabels[role])}</div>
                <ul>
                    {#each [...partitioned[role]] as perm}
                        <li class="permission">
                            <Check size={"1em"} color={"limegreen"} />
                            {perm}
                        </li>
                    {/each}
                </ul>
            </li>
        {/if}
    {/each}
</ul>

<style type="text/scss">
    ul {
        list-style: none;
    }

    .section {
        margin-bottom: $sp4;
    }

    .who-can {
        @include font(bold, normal, fs-110);
    }

    .permission {
        display: flex;
        align-items: center;
        gap: $sp3;
        @include font(light, normal, fs-90);
    }
</style>
