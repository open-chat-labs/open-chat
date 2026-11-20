<!-- Says the app is offline and that what it shows (the cache) may be out of date (#10564), while
     the client's offlineStore says so (logic/network/offlineIndicator: a blip doesn't show or hide
     it). A slim strip across the top of the window, under the status bar; the shell moves its
     screens down under it (Shell: --safe-top). It only says: the app reconnects by itself.
     TODO(design): the native plan has no offline indicator; this is the library's offline Banner's
     tone and icon (warning colours) as a strip, the old mobile tree's OfflineFooter moved to the top,
     where it covers neither the tab bar, a composer nor the toasts. -->
<script lang="ts">
    type Props = {
        /** The strip's text. */
        text: string;
    };

    let { text }: Props = $props();
</script>

<div class="offline" role="status">
    <span class="icon" aria-hidden="true"></span>
    <span class="text">{text}</span>
</div>

<style lang="scss">
    .offline {
        position: absolute;
        inset: 0 0 auto;
        // over every screen, pushed ones too
        z-index: 3;
        box-sizing: border-box;
        height: calc(var(--safe-top) + var(--offline-strip-h));
        padding: var(--safe-top) var(--space-16) 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-8);
        // the offline tone's tint is see-through, so the page's surface goes under it
        background:
            linear-gradient(var(--status-chit-soft), var(--status-chit-soft)),
            var(--surface-1);
        box-shadow: inset 0 -1px 0 var(--status-chit-soft);
    }

    .icon {
        flex: none;
        width: 14px;
        height: 14px;
        background: var(--status-chit);
        mask: var(--icon-offline) center/contain no-repeat;
    }

    .text {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font: var(--weight-medium) var(--text-sm) / 1.2 var(--font-sans);
        color: var(--ink);
    }
</style>
