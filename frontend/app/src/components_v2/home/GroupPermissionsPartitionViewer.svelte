<script lang="ts">
    import Check from "svelte-material-icons/Check.svelte";
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
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

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
</script>

<ul>
    {#each chatRoles as role}
        {#if partition[role].size > 0}
            <li class="section">
                <div class="who-can"><Translatable resourceKey={i18nKey(roleLabels[role])} /></div>
                <ul>
                    {#each [...partition[role]] as perm}
                        <li class="permission">
                            <Check size={"1em"} color={"var(--success)"} />
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
