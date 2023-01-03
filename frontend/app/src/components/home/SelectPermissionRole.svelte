<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { PermissionRole } from "openchat-client";
    import Legend from "../Legend.svelte";

    export let label: string;
    export let rolePermission: PermissionRole;

    let roles: PermissionRole[] = ["owner", "admins", "members"];
</script>

<li>
    <Legend label={`${$_("group.permissions.whoCan")} ${label}`} />
    <div class="roles">
        {#each roles as r, _i (r)}
            <div
                class="role"
                on:click={() => (rolePermission = r)}
                class:selected={roles.indexOf(rolePermission) >= roles.indexOf(r)}>
                {$_(`group.role.${r}`)}
            </div>
            <div class="arrow">></div>
        {/each}
    </div>
</li>

<style type="text/scss">
    li {
        @include font(book, normal, fs-90);

        margin-bottom: $sp4;

        &:last-child {
            margin-bottom: 0;
        }
    }

    .roles {
        display: flex;
        gap: $sp3;
        align-items: center;
        border-bottom: 1px solid var(--bd);
        padding: $sp3 0 $sp4 0;

        .arrow:last-child {
            display: none;
        }

        .role {
            border-radius: 22px;
            border: 1px solid var(--accent);
            @include font(book, normal, fs-80);
            text-transform: lowercase;
            padding: 6px 10px;
            text-align: center;
            cursor: pointer;

            &.selected {
                background-color: var(--accent);
                color: #fff;
            }
        }
    }
</style>
