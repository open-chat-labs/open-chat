<script lang="ts">
    import { _ } from "svelte-i18n";
    export let error: Error | undefined = undefined;
</script>

<slot>
    {#if error}
        <div class="error">
            {$_("unexpectedError")}
        </div>
    {/if}
</slot>

<style>
    .error {
        color: var(--error);
        @include font(book, normal, fs-80);
    }
</style>
