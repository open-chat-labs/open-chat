<script lang="ts">
    import Check from "svelte-material-icons/Check.svelte";
    import {
        type CommunityPermissionRole,
        type CommunityPermissions,
        type ResourceKey,
        communityRoles,
    } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        permissions: CommunityPermissions;
        isPublic: boolean;
    }

    let { permissions, isPublic }: Props = $props();

    type PermissionsByRole = Record<CommunityPermissionRole, Set<string>>;
    type PermissionsEntry = [keyof CommunityPermissions, CommunityPermissionRole];

    const roleLabels: Record<CommunityPermissionRole, ResourceKey> = {
        owner: i18nKey("permissions.ownerOnly"),
        admin: i18nKey("permissions.ownerAndAdmins"),
        member: i18nKey("permissions.allMembers"),
    };

    function partitionPermissions(permissions: CommunityPermissions): PermissionsByRole {
        return (Object.entries(permissions) as PermissionsEntry[]).reduce(
            (dict: PermissionsByRole, [key, val]) => {
                if (key !== "inviteUsers" || !isPublic) {
                    dict[val].add(`permissions.${key}`);
                }
                return dict;
            },
            {
                admin: new Set(),
                member: new Set(),
                owner: new Set(),
            } as PermissionsByRole,
        );
    }
    let partitioned = $derived(partitionPermissions(permissions));
</script>

<ul>
    {#each communityRoles as role}
        {#if partitioned[role].size > 0}
            <li class="section">
                <div class="who-can"><Translatable resourceKey={roleLabels[role]} /></div>
                <ul>
                    {#each [...partitioned[role]] as perm}
                        <li class="permission">
                            <Check size={"1em"} color={"limegreen"} />
                            <Translatable resourceKey={i18nKey(perm)} />
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
