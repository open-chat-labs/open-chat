<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import CameraTimer from "svelte-material-icons/CameraTimer.svelte";
    import Tooltip from "../tooltip/Tooltip.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");
    interface Props {
        ttl: bigint;
    }

    let { ttl }: Props = $props();
</script>

<Tooltip position={"bottom"} align={"end"}>
    <div class="disappears">
        <div class="expires">
            <CameraTimer size={"1em"} color={"var(--txt-light)"} />
        </div>
        <div class="name">{client.formatDisappearingMessageTime(Number(ttl), $_)}</div>
    </div>
    {#snippet popupTemplate()}
        <Translatable
            resourceKey={i18nKey("disappearingMessages.summary", {
                duration: client.formatDuration(Number(ttl)),
            })} />
    {/snippet}
</Tooltip>

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
