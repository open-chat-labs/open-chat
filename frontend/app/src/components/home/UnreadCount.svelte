<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { emptyUnreadCounts } from "openchat-client";

    interface Props {
        unread?: any;
        solid?: boolean;
    }

    let { unread = emptyUnreadCounts(), solid = true }: Props = $props();

    let muted = $derived(!unread.mentions && unread.unmuted <= 0);
    let count = $derived(muted ? unread.muted : unread.unmuted);
</script>

{#if count > 0 || unread.mentions}
    <div
        in:pop={{ duration: 1500, transform: "translateY(-50%)" }}
        title={$_("thread.unread", {
            values: { count: count.toString() },
        })}
        class:muted
        class:solid
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
        right: toRem(8);
        @include unread();
        top: 50%;
        transform: translateY(-50%);

        &.muted {
            background-color: var(--unread-mute);
            text-shadow: none;
            backdrop-filter: blur(10px);
            color: var(--unread-mute-txt);

            &.solid {
                background-color: var(--unread-mute-solid);
                border: 1px solid var(--bd);
            }
        }
    }
</style>
