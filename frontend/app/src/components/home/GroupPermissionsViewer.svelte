<script lang="ts">
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import { ChatPermissions, ChatPermissionRole, chatRoles } from "openchat-client";

    export let permissions: ChatPermissions;
    export let isPublic: boolean;

    type PermissionsByRole = Record<ChatPermissionRole, Set<string>>;
    type PermissionsEntry = [keyof ChatPermissions, ChatPermissionRole];

    const roleLabels: Record<ChatPermissionRole, string> = {
        owner: "permissions.ownerOnly",
        admin: "permissions.ownerAndAdmins",
        moderator: "permissions.ownerAndAdminsAndModerators",
        member: "permissions.allMembers",
        none: "",
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

    function partitionPermissions(permissions: ChatPermissions): PermissionsByRole {
        return (Object.entries(permissions) as PermissionsEntry[]).filter(filterPermissions).reduce(
            (dict: PermissionsByRole, [key, val]) => {
                dict[val].add($_(`permissions.${String(key)}`));
                return dict;
            },
            {
                admin: new Set(),
                moderator: new Set(),
                member: new Set(),
                owner: new Set(),
            } as PermissionsByRole
        );
    }
</script>

<ul>
    {#each chatRoles as role}
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
