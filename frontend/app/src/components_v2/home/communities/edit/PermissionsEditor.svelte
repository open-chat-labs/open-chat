<script lang="ts">
    import SelectPermissionRole from "../../SelectPermissionRole.svelte";
    import { type CommunityPermissions, communityRoles } from "openchat-client";
    import { i18nKey } from "../../../../i18n/i18n";

    interface Props {
        permissions: CommunityPermissions;
    }

    let { permissions = $bindable() }: Props = $props();

    const selectors = Object.keys(permissions).map<[keyof CommunityPermissions, string]>((p) => [
        p as keyof CommunityPermissions,
        `permissions.${p}`,
    ]);
</script>

{#each selectors as [key, resourceKey]}
    <SelectPermissionRole
        roles={communityRoles}
        label={i18nKey(resourceKey)}
        bind:rolePermission={permissions[key]} />
{/each}
