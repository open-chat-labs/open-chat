<script lang="ts">
    import CanisterMapFrame from "@src/core/CanisterMapFrame.svelte";
</script>

<div class="architecture">
    <CanisterMapFrame syncUrl />
</div>

<style lang="scss">
    // Fills the viewport below the landing page header, which is toRem(80) tall
    .architecture {
        height: calc(100vh - toRem(80));
        height: calc(100dvh - toRem(80));
    }
</style>
