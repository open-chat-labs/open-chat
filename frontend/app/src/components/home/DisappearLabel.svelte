<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import CameraTimer from "svelte-material-icons/CameraTimer.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";

    const client = getContext<OpenChat>("client");
    export let ttl: bigint;
</script>

<TooltipWrapper position={"bottom"} align={"end"}>
    <div slot="target" class="disappears">
        <div class="expires">
            <CameraTimer size={"1em"} color={"#fff"} />
        </div>
        <div class="name">{client.formatDisappearingMessageTime(Number(ttl), $_)}</div>
    </div>
    <div let:position let:align slot="tooltip">
        <TooltipPopup {position} {align} textLength={100} longestWord={10}>
            {$_("disappearingMessages.summary", {
                values: { duration: client.formatDuration(Number(ttl)) },
            })}
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style lang="scss">
    .disappears {
        display: flex;
        gap: $sp2;
        align-items: center;
        text-transform: uppercase;
        background-color: var(--chatSummary-bg-selected);
        padding: $sp2 $sp3;
        border-radius: $sp3;

        .expires {
            $size: 12px;
            flex: 0 0 $size;
            width: $size;
            height: $size;
        }
    }
</style>
