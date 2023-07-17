<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";

    export let unread: number;
</script>

{#if unread > 0}
    <div
        in:pop={{ duration: 1500, transform: "translateY(-50%)" }}
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
        right: $sp3;
        @include unread();
        top: 50%;
        transform: translateY(-50%);

        @include mobile() {
            right: toRem(6);
        }
    }
</style>
