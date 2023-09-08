<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectPermissionRole from "../../SelectPermissionRole.svelte";
    import { type CommunityPermissions, communityRoles } from "openchat-client";

    export let permissions: CommunityPermissions;
    export let isPublic: boolean;

    const selectors = Object.keys(permissions)
        .filter((p) => !isPublic || p !== "inviteUsers")
        .map<[keyof CommunityPermissions, string]>((p) => [
            p as keyof CommunityPermissions,
            `permissions.${p}`,
        ]);
</script>

{#each selectors as [key, i18nKey]}
    <SelectPermissionRole
        roles={communityRoles}
        label={$_(i18nKey)}
        bind:rolePermission={permissions[key]} />
{/each}
