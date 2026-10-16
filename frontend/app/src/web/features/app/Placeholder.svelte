<!-- Stands in for a screen a later phase builds, saying which one and for what (route params).
     Development text only: no translation. -->
<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";

    let { title, detail = "" }: { title: string; detail?: string } = $props();
</script>

<div class="placeholder" data-placeholder={title}>
    <!-- an empty body would fall back to the preset's -->
    <EmptyState preset="no-results" {title} body={detail || " "} actionLabel="" />
</div>

<style>
    .placeholder {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
