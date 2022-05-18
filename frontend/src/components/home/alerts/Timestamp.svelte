<script lang="ts">
    export let timestamp: string;
</script>

<p class="timestamp">{timestamp}</p>

<style type="text/scss">
    .timestamp {
        margin-top: $sp3;
        text-transform: lowercase;
        color: var(--alert-tm);
        @include font(book, normal, fs-70);
    }
</style>
