<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectPermissionRole from "../../SelectPermissionRole.svelte";
    import { CommunityPermissions, communityRoles } from "openchat-client";

    export let permissions: CommunityPermissions;
</script>

<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.changePermissions")}
    bind:rolePermission={permissions.changePermissions} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.changeRoles")}
    bind:rolePermission={permissions.changeRoles} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.inviteUsers")}
    bind:rolePermission={permissions.inviteUsers} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.removeMembers")}
    bind:rolePermission={permissions.removeMembers} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.blockUsers")}
    bind:rolePermission={permissions.blockUsers} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.updateDetails")}
    bind:rolePermission={permissions.updateDetails} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.createPublicChannel")}
    bind:rolePermission={permissions.createPublicChannel} />
<SelectPermissionRole
    roles={communityRoles}
    label={$_("permissions.createPrivateChannel")}
    bind:rolePermission={permissions.createPrivateChannel} />
