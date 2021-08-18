<script lang="ts">
    export let flush: boolean = false;
</script>

<div class="section-header" class:flush>
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

        &.flush {
            margin-bottom: 0;
        }
    }
</style>
