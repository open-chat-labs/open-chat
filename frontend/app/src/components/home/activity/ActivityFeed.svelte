<script lang="ts">
    import {
        globalStateStore as global,
        messageContextToString,
        OpenChat,
        routeForMessage,
        ui,
        type GlobalState,
        type MessageActivityEvent,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import { i18nKey } from "../../../i18n/i18n";
    import { activityEvents, activityFeedShowing } from "../../../stores/activity";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import ActivityEvent from "./ActivityEvent.svelte";

    const client = getContext<OpenChat>("client");
    let selectedEventIndex = $state<number | undefined>();

    function uptodate({ messageActivitySummary }: GlobalState, events: MessageActivityEvent[]) {
        const latest = events[0]?.timestamp;
        return messageActivitySummary.latestTimestamp <= latest;
    }

    function loadActivity() {
        client.subscribeToMessageActivityFeed((resp, final) => {
            activityEvents.set(resp.events);
            if ($activityEvents.length > 0 && final) {
                client.markActivityFeedRead($activityEvents[0].timestamp);
            }
        });
    }

    function selectEvent(ev: MessageActivityEvent, idx: number) {
        selectedEventIndex = idx;
        page(routeForMessage("none", ev.messageContext, ev.messageIndex));
    }

    function eventKey(event: MessageActivityEvent): string {
        return `${messageContextToString(event.messageContext)}_${event.eventIndex}_${
            event.activity
        }`;
    }
    $effect(() => {
        if (!uptodate($global, $activityEvents)) {
            loadActivity();
        }
    });
</script>

<SectionHeader slim border={false}>
    <div class="header">
        <div class="icon">
            <BellRingOutline size={ui.iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name"><Translatable resourceKey={i18nKey("activity.title")} /></h4>
        </div>
        <span class="menu">
            <HoverIcon onclick={() => activityFeedShowing.set(false)}>
                <Close size={ui.iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    </div>
</SectionHeader>

<div use:menuCloser class="body">
    <VirtualList keyFn={eventKey} items={$activityEvents}>
        {#snippet children(item, idx)}
            <ActivityEvent
                event={item}
                selected={selectedEventIndex === idx}
                onClick={() => selectEvent(item, idx)} />
        {/snippet}
    </VirtualList>
</div>

<style lang="scss">
    .header {
        @include left_panel_header();
    }
    .body {
        overflow: auto;
        flex: auto;
        @include nice-scrollbar();
        position: relative;
    }
</style>
