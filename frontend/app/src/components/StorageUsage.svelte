<script lang="ts">
    import {
        percentageStorageRemainingStore,
        percentageStorageUsedStore,
        storageInGBStore,
        storageStore,
    } from "openchat-client";
    import { i18nKey } from "../i18n/i18n";
    import Progress from "./Progress.svelte";
    import Translatable from "./Translatable.svelte";
</script>

<!-- don't display anything if the user hasn't got any storage -->
{#if $storageStore.byteLimit > 0}
    <div class="row">
        <span class="current">
            <Translatable resourceKey={i18nKey("currentUsage")} />
        </span>
        <span class="left">
            <Translatable
                resourceKey={i18nKey("percLeft", { perc: $percentageStorageRemainingStore })} />
        </span>
    </div>
    <div class="storage-progress">
        <Progress bg={"accent"} percent={$percentageStorageUsedStore} />
    </div>
    <div class="row used">
        <span class="usage">
            <Translatable
                resourceKey={i18nKey("storageUsed", {
                    used: $storageInGBStore.gbUsed.toFixed(2),
                    limit: $storageInGBStore.gbLimit.toFixed(1),
                })} />
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
