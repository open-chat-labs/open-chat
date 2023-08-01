<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { emptyUnreadCounts } from "openchat-client";

    export let unread = emptyUnreadCounts();

    $: muted = !unread.mentions && unread.unmuted <= 0;
    $: count = muted ? unread.muted : unread.unmuted;
</script>

{#if count > 0 || unread.mentions}
    <div
        in:pop={{ duration: 1500, transform: "translateY(-50%)" }}
        title={$_("thread.unread", {
            values: { count: count.toString() },
        })}
        class:muted
        class="unread-count">
        {#if unread.mentions}
            @
        {:else}
            {count > 999 ? "999+" : count}
        {/if}
    </div>
{/if}

<style lang="scss">
    .unread-count {
        position: absolute;
        right: $sp3;
        @include unread();
        top: 50%;
        transform: translateY(-50%);

        &.muted {
            background-color: var(--unread-mute-solid);
            text-shadow: none;
            border: 1px solid var(--bd);
        }

        @include mobile() {
            right: toRem(6);
        }
    }
</style>
