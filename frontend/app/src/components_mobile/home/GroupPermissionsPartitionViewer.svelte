<script lang="ts">
    import { Body, Container, type SizeMode } from "component-lib";
    import {
        type ChatPermissionRole,
        chatRoles,
        type PermissionsByRole,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_NONE,
        ROLE_OWNER,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        partition: PermissionsByRole;
    }

    let { partition }: Props = $props();

    const roleLabels: Record<ChatPermissionRole, string> = {
        [ROLE_NONE]: "permissions.nobody",
        [ROLE_OWNER]: "permissions.ownerOnly",
        [ROLE_ADMIN]: "permissions.ownerAndAdmins",
        [ROLE_MODERATOR]: "permissions.ownerAndAdminsAndModerators",
        [ROLE_MEMBER]: "permissions.allMembers",
    };

    const width: SizeMode = { kind: "hug" };
</script>

{#each chatRoles as role}
    {#if partition[role].size > 0}
        {@const perms = [...partition[role]]}
        <Container {width} wrap gap={"sm"}>
            <Body {width} colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey(roleLabels[role])} />
            </Body>
            <Body {width} colour={"textSecondary"}>//</Body>
            {#each perms as perm, i}
                {@const last = i === perms.length - 1}
                <Body {width}>
                    {perm}
                </Body>
                {#if !last}
                    <Body colour={"primary"} {width}>/</Body>
                {/if}
            {/each}
        </Container>
    {/if}
{/each}
