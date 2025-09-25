<script lang="ts">
    import { fade } from "svelte/transition";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
</script>

<div transition:fade={{ duration: 250 }} role="button" tabindex="0" class="offline">
    <div class="icon">
        <CloudOffOutline size={"1.5em"} color={"currentColor"} />
    </div>
    <Translatable resourceKey={i18nKey("offlineMessage")} />
</div>

<style lang="scss">
    .offline {
        position: absolute;
        height: toRem(40);
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp4;
        bottom: 0;
        cursor: pointer;
        @include z-index("anon-banner");
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        padding: $sp4 $sp3;
        text-transform: uppercase;

        .icon {
            flex: 0 0 toRem(24);
        }
    }
</style>
