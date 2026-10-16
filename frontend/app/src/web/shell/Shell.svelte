<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";

    // TODO(phase 1): the nav rail and the three columns. Until then this shows that the
    // root, the theme and the library's i18n are wired up.
</script>

<main class="shell">
    <EmptyState preset="no-conversations" actionLabel="" />
</main>

<style>
    .shell {
        display: grid;
        place-items: center;
        min-height: 100vh;
        background: var(--surface-0);
        color: var(--ink);
    }
</style>
