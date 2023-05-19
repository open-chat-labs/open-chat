<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { PermissionRole } from "openchat-client";
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";

    export let label: string;
    export let rolePermission: PermissionRole;

    let roles: PermissionRole[] = ["owner", "admins", "moderators", "members"];
</script>

<div class="group-permission">
    <Legend label={`${$_("group.permissions.whoCan")} ${label}`} />
    <Select bind:value={rolePermission}>
        {#each roles as r, _i (r)}
            <option value={r}>{$_(`group.role.${r}`)}</option>
        {/each}
    </Select>
</div>

<style type="text/scss">
    .group-permission {
        max-width: 300px;
    }
</style>
