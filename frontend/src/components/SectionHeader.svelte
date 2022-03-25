<script lang="ts">
    import { rtlStore } from "../stores/rtl";

    export let flush: boolean = false;
    export let shadow: boolean = false;
    export let entry = false;
    export let gap = false;
</script>

<div class="section-header" class:flush class:shadow class:entry class:gap class:rtl={$rtlStore}>
    <slot />
</div>

<style type="text/scss">
    .section-header {
        display: flex;
        position: sticky;
        top: 0;
        align-items: center;
        width: 100%;
        padding: $sp3;
        height: 60px;
        margin-bottom: $sp3;
        background-color: var(--section-bg);
        border: 1px solid var(--section-bd);
        color: var(--section-txt);
        @include z-index("section-header");
        flex: 0 0 60px;

        &.entry {
            background-color: var(--entry-bg);
        }

        &.flush {
            margin-bottom: 0;
            border-left: 1px solid var(--section-bd-start);
        }

        &.flush.rtl {
            border-left: inherit;
            border-right: 1px solid var(--section-bd-start);
        }

        &.shadow {
            box-shadow: 0 5px 5px rgba(0, 0, 0, 0.2);
        }

        &.gap {
            gap: $sp4;
        }
    }
</style>
