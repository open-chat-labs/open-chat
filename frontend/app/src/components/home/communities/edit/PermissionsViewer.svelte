<script lang="ts">
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import { CommunityPermissionRole, CommunityPermissions, communityRoles } from "openchat-client";

    export let permissions: CommunityPermissions;

    type PermissionsByRole = Record<CommunityPermissionRole, Set<string>>;
    type PermissionsEntry = [keyof CommunityPermissions, CommunityPermissionRole];

    const roleLabels: Record<CommunityPermissionRole, string> = {
        owner: "permissions.ownerOnly",
        admins: "permissions.ownerAndAdmins",
        members: "permissions.allMembers",
    };

    $: partitioned = partitionPermissions(permissions);

    function partitionPermissions(permissions: CommunityPermissions): PermissionsByRole {
        return (Object.entries(permissions) as PermissionsEntry[]).reduce(
            (dict: PermissionsByRole, [key, val]) => {
                dict[val].add($_(`permissions.${key}`));
                return dict;
            },
            {
                admins: new Set(),
                members: new Set(),
                owner: new Set(),
            } as PermissionsByRole
        );
    }
</script>

<ul>
    {#each communityRoles as role}
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
