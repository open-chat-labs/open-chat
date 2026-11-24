<!-- A flow's outcome heading (the prototype's receipt and swap progress): an 88px badge with a
     spinner while it's on its way and a tick once it's done, the title and a line under it. -->
<script lang="ts">
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";

    type Props = { done: boolean; title: string; sub: string; busyLabel: string };

    let { done, title, sub, busyLabel }: Props = $props();
</script>

<div class="result">
    <span class="badge" class:done>
        {#if done}
            <span class="tick" aria-hidden="true"></span>
        {:else}
            <Spinner size={34} tone="accent" label={busyLabel} />
        {/if}
    </span>
    <span class="words" role="status">
        <span class="title">{title}</span>
        <span class="sub">{sub}</span>
    </span>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .result {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        text-align: center;
    }

    .badge {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        background: var(--accent-soft);
        @include flex-center;

        &.done {
            background: color-mix(in oklch, var(--status-online) 14%, transparent);
        }
    }

    .tick {
        width: 40px;
        height: 40px;
        background: var(--status-online);
        mask: var(--icon-check) center / contain no-repeat;
    }

    .words {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .title {
        font: 800 text-size(26px) / 1.15 var(--font-sans);
        letter-spacing: -0.01em;
        color: var(--ink);
    }

    .sub {
        font: var(--weight-medium) text-size(14px) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }
</style>
