<script lang="ts">
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import { GroupPermissions, GroupPermissionRole, groupRoles } from "openchat-client";

    export let permissions: GroupPermissions;
    export let isPublic: boolean;

    type PermissionsByRole = Record<GroupPermissionRole, Set<string>>;
    type PermissionsEntry = [keyof GroupPermissions, GroupPermissionRole];

    const roleLabels: Record<GroupPermissionRole, string> = {
        owner: "permissions.ownerOnly",
        admins: "permissions.ownerAndAdmins",
        moderators: "permissions.ownerAndAdminsAndModerators",
        members: "permissions.allMembers",
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
                dict[val].add($_(`permissions.${key}`));
                return dict;
            },
            {
                admins: new Set(),
                moderators: new Set(),
                members: new Set(),
                owner: new Set(),
            } as PermissionsByRole
        );
    }
</script>

<ul>
    {#each groupRoles as role}
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

<style lang="scss">
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
