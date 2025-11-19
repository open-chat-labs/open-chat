<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Container, type SizeMode } from "component-lib";
    import {
        communityRoles,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_OWNER,
        type CommunityPermissionRole,
        type CommunityPermissions,
        type ResourceKey,
    } from "openchat-client";
    import Translatable from "../../../Translatable.svelte";

    interface Props {
        permissions: CommunityPermissions;
        isPublic: boolean;
    }

    let { permissions, isPublic }: Props = $props();

    type PermissionsByRole = Record<CommunityPermissionRole, Set<string>>;
    type PermissionsEntry = [keyof CommunityPermissions, CommunityPermissionRole];

    const roleLabels: Record<CommunityPermissionRole, ResourceKey> = {
        [ROLE_OWNER]: i18nKey("permissions.ownerOnly"),
        [ROLE_ADMIN]: i18nKey("permissions.ownerAndAdmins"),
        [ROLE_MEMBER]: i18nKey("permissions.allMembers"),
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
                [ROLE_OWNER]: new Set(),
                [ROLE_ADMIN]: new Set(),
                [ROLE_MEMBER]: new Set(),
            } as PermissionsByRole,
        );
    }
    let partitioned = $derived(partitionPermissions(permissions));
    const width: SizeMode = { kind: "hug" };
</script>

<Container gap={"xl"} direction={"vertical"}>
    <Body colour={"textSecondary"} fontWeight={"bold"}>
        <Translatable resourceKey={i18nKey("Permissions")}></Translatable>
    </Body>

    {#each communityRoles as role}
        {#if partitioned[role].size > 0}
            {@const perms = [...partitioned[role]]}
            <Container {width} wrap gap={"sm"}>
                <Body {width} colour={"textSecondary"}>
                    <Translatable resourceKey={roleLabels[role]} />
                </Body>
                <Body {width} colour={"textSecondary"}>//</Body>
                {#each perms as perm, i}
                    {@const last = i === perms.length - 1}
                    <Body {width}>
                        <Translatable resourceKey={i18nKey(perm)} />
                    </Body>
                    {#if !last}
                        <Body colour={"primary"} {width}>/</Body>
                    {/if}
                {/each}
            </Container>
        {/if}
    {/each}
</Container>
