<script lang="ts">
    import { activityFeedState } from "@src/runes/activity.svelte";
    import { menuCloser } from "component-lib";
    import {
        activityFeedShowing,
        iconSize,
        messageActivitySummaryStore,
        messageContextToChatListScope,
        messageContextToString,
        OpenChat,
        routeForMessage,
        type MessageActivityEvent,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import ActivityEvent from "./ActivityEvent.svelte";

    const client = getContext<OpenChat>("client");

    let selectedEventIndex = $state<number | undefined>();
    let uptodate = $derived.by(() => {
        return $messageActivitySummaryStore.latestTimestamp <= activityFeedState.latestTimestamp;
    });

    function loadActivity() {
        client.subscribeToMessageActivityFeed((resp, final) => {
            activityFeedState.activityEvents = resp.events;
            if (activityFeedState.activityEvents.length > 0 && final) {
                client.markActivityFeedRead(activityFeedState.latestTimestamp);
            }
        });
    }

    function selectEvent(ev: MessageActivityEvent, idx: number) {
        selectedEventIndex = idx;
        page(
            routeForMessage(
                messageContextToChatListScope(ev.messageContext).kind,
                ev.messageContext,
                ev.messageIndex,
            ),
        );
    }

    function eventKey(event: MessageActivityEvent): string {
        return `${messageContextToString(event.messageContext)}_${event.eventIndex}_${
            event.activity
        }`;
    }

    $effect(() => {
        if (!uptodate) {
            loadActivity();
        }
    });
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
            <HoverIcon onclick={() => activityFeedShowing.set(false)}>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    </div>
</SectionHeader>

<div use:menuCloser class="body">
    <VirtualList keyFn={eventKey} items={activityFeedState.activityEvents}>
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
