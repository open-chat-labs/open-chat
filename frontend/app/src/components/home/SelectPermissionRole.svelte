<script lang="ts">
    import { _ } from "svelte-i18n";
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";

    export let label: string;
    export let rolePermission: string;
    export let roles: readonly string[];
</script>

<div class="permission">
    <Legend label={`${$_("permissions.whoCan")} ${label}`} />
    <Select bind:value={rolePermission}>
        {#each roles as r, _i (r)}
            <option value={r}>{$_(`role.${r}`)}</option>
        {/each}
    </Select>
</div>

<style type="text/scss">
    .permission {
        max-width: 300px;
    }
</style>
