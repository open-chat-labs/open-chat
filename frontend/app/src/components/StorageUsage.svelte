<script lang="ts">
    import Progress from "./Progress.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    $: percentageStorageRemaining = client.percentageStorageRemaining;
    $: percentageStorageUsed = client.percentageStorageUsed;
    $: storageStore = client.storageStore;
    $: storageInGb = client.storageInGb;
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
    <div class="row used">
        <span class="usage">
            {$_("storageUsed", {
                values: {
                    used: $storageInGb.gbUsed.toFixed(2),
                    limit: $storageInGb.gbLimit.toFixed(1),
                },
            })}
        </span>
    </div>
{/if}

<style lang="scss">
    .row {
        display: flex;
        justify-content: space-between;
        margin: $sp3 0;

        &.used {
            margin-bottom: $sp4;
        }
    }

    .current {
        @include font(book, normal, fs-80);
    }

    .left,
    .usage {
        @include font(light, normal, fs-70);
    }
</style>
