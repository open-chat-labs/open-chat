<!-- Says the app is offline and that what it shows (the cache) may be out of date (#10564), while
     the client's offlineStore says so (logic/network/offlineIndicator: a blip doesn't show or hide
     it). A slim strip across the top of the window, between the status bar and the screens, which
     the shell moves down by its height (`height`, the root's --offline-strip: Shell). It opens
     and closes with them. It only says: the app reconnects by itself. Its text wraps to a second
     line rather than lose its end.
     TODO(design): the native plan has no offline indicator; this is the library's offline Banner's
     tone and icon (warning colours) as a strip, the old mobile tree's OfflineFooter moved to the top,
     where it covers neither the tab bar, a composer nor the toasts. -->
<script lang="ts">
    type Props = {
        shown: boolean;
        /** The strip's text. */
        text: string;
        /** Its height when open, in CSS pixels. */
        height?: number;
    };

    let { shown, text, height = $bindable(0) }: Props = $props();
</script>

<!-- always there, so a screen reader hears the text arrive in it -->
<span class="live" role="status">{shown ? text : ""}</span>

<!-- its height is the root's --offline-strip, which opens and closes it (Shell) -->
<div class="offline" aria-hidden="true">
    <div class="content" bind:offsetHeight={height}>
        <span class="icon"></span>
        <span class="text">{text}</span>
    </div>
</div>

<style lang="scss">
    .live {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    .offline {
        position: absolute;
        inset: var(--safe-top) 0 auto;
        // over every screen, pushed ones too
        z-index: 3;
        height: var(--offline-strip, 0px);
        overflow: hidden;
        display: flex;
        // as it opens, it comes down from under the status bar
        align-items: flex-end;
        // the offline tone's tint is see-through, so the page's surface goes under it
        background:
            linear-gradient(var(--status-chit-soft), var(--status-chit-soft)),
            var(--surface-1);
        box-shadow: inset 0 -1px 0 var(--status-chit-soft);
    }

    .content {
        flex: none;
        width: 100%;
        box-sizing: border-box;
        min-height: 28px;
        padding: 5px var(--space-16);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-8);
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
        font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
        color: var(--ink);
        text-align: center;
        text-wrap: balance;
    }
</style>
