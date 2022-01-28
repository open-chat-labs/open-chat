<script lang="ts">
    import Progress from "./Progress.svelte";
    import { _ } from "svelte-i18n";
    import {
        percentageStorageRemaining,
        percentageStorageUsed,
        storageStore,
        storageInMb,
    } from "../stores/storage";
</script>

<!-- don't display anything if the user hasn't got any storage -->
{#if $storageStore.byteLimit > 0}
    <div class="row">
        <span class="current">
            {$_("currentUsage")}
        </span>
        <span class="left">
            {$_("percLeft", { values: { perc: $percentageStorageRemaining } })}
        </span>
    </div>
    <div class="storage-progress">
        <Progress bg={"accent"} percent={$percentageStorageUsed} />
    </div>
    <div class="row">
        <span class="usage">
            {$_("mbUsed", {
                values: {
                    used: $storageInMb.mbUsed.toString(),
                    limit: $storageInMb.mbLimit.toString(),
                },
            })}
        </span>
    </div>
{/if}

<style type="text/scss">
    .row {
        display: flex;
        justify-content: space-between;
        margin: $sp3 0;
    }

    .current {
        @include font(book, normal, fs-80);
    }

    .left,
    .usage {
        @include font(light, normal, fs-70);
    }
</style>
