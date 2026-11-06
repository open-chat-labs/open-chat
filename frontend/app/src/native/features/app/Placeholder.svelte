<!-- Stands in for a native screen a later issue builds: its header (a tab root's title, or a pushed
     screen's back), what it will be, and links to the screens over it, so the tabs and stacks can be
     walked meanwhile. Development text only: no translation, except a tab's title. -->
<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";

    type Props = {
        title: string;
        detail: string;
        /** A tab's root: its title row, without back. */
        root: boolean;
        back: (() => void) | undefined;
        links: { label: string; url: string }[];
    };

    let { title, detail, root, back, links }: Props = $props();
</script>

<div class="placeholder" class:root data-placeholder={title}>
    <NativePageHeader {title} size={root ? "lg" : "md"} onBack={back} />
    <div class="body">
        <!-- an empty body would fall back to the preset's -->
        <EmptyState preset="no-results" title={title} body={detail || " "} actionLabel="" />
        {#if links.length > 0}
            <nav class="links">
                {#each links as link (link.url)}
                    <a href={link.url}>{link.label}</a>
                {/each}
            </nav>
        {/if}
    </div>
</div>

<style lang="scss">
    .placeholder {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-16);
        padding: var(--space-24) var(--space-16) var(--scroll-end);
    }

    .links {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        width: 100%;
    }

    a {
        display: flex;
        align-items: center;
        min-height: var(--touch-target);
        padding: 0 var(--space-16);
        border-radius: var(--radius-md);
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-medium) var(--text-sm) / 1.2 var(--font-sans);
        text-decoration: none;
        overflow-wrap: anywhere;
    }
</style>
