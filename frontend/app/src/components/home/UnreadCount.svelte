<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";

    export let unread: number;
</script>

{#if unread > 0}
    <div
        in:pop={{ duration: 1500 }}
        title={$_("thread.unread", {
            values: { count: unread.toString() },
        })}
        class="unread-count">
        {unread > 999 ? "999+" : unread}
    </div>
{/if}

<style lang="scss">
    .unread-count {
        position: absolute;
        right: -16px;
        @include unread();
    }
</style>
