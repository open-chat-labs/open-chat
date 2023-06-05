<script lang="ts">
    import Markdown from "./Markdown.svelte";

    export let notes: string | undefined;
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
