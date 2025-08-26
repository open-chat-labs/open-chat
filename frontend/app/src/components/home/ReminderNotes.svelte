<script lang="ts">
    import Markdown from "./Markdown.svelte";

    interface Props {
        notes: string | undefined;
    }

    let { notes }: Props = $props();
</script>

{#if notes !== undefined && notes !== ""}
    <div class="notes">
        <Markdown inline suppressLinks text={notes} />
    </div>
{/if}

<style lang="scss">
    .notes {
        margin-top: $sp4;
        @include font(book, italic, fs-100);
    }
</style>
