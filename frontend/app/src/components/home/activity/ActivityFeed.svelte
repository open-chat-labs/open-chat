<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import { _ } from "svelte-i18n";
    import {
        messageContextToString,
        OpenChat,
        routeForMessage,
        type GlobalState,
        type MessageActivityEvent,
        globalStateStore as global,
    } from "openchat-client";
    import { getContext } from "svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import { activityEvents, activityFeedShowing } from "../../../stores/activity";
    import { menuCloser } from "../../../actions/closeMenu";
    import page from "page";
    import ActivityEvent from "./ActivityEvent.svelte";
    import VirtualList from "../../VirtualList.svelte";

    const client = getContext<OpenChat>("client");
    let selectedEvent: MessageActivityEvent | undefined = undefined;

    $: {
        if (!uptodate($global, $activityEvents)) {
            loadActivity();
        }
    }

    function uptodate({ messageActivitySummary }: GlobalState, events: MessageActivityEvent[]) {
        const latest = events[0]?.timestamp;
        return messageActivitySummary.latestTimestamp <= latest;
    }

    function loadActivity() {
        client.messageActivityFeed().subscribe((resp, final) => {
            activityEvents.set(resp.events);
            if ($activityEvents.length > 0 && final) {
                client.markActivityFeedRead($activityEvents[0].timestamp);
            }
        });
    }

    function selectEvent(ev: MessageActivityEvent) {
        selectedEvent = ev;
        page(routeForMessage("none", ev.messageContext, ev.messageIndex));
    }

    function eventKey(event: MessageActivityEvent): string {
        return `${messageContextToString(event.messageContext)}_${event.eventIndex}_${
            event.activity
        }`;
    }
</script>

<SectionHeader slim border={false}>
    <div class="header">
        <div class="icon">
            <BellRingOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name"><Translatable resourceKey={i18nKey("activity.title")} /></h4>
        </div>
        <span class="menu">
            <HoverIcon on:click={() => activityFeedShowing.set(false)}>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    </div>
</SectionHeader>

<div use:menuCloser class="body">
    <VirtualList keyFn={eventKey} items={$activityEvents} let:item>
        <ActivityEvent
            event={item}
            selected={selectedEvent === item}
            on:click={() => selectEvent(item)} />
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
