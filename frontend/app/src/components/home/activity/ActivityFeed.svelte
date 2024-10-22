<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import { _ } from "svelte-i18n";
    import { OpenChat, routeForMessage, type MessageActivityEvent } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import { activityFeedShowing } from "../../../stores/activity";
    import { menuCloser } from "../../../actions/closeMenu";
    import page from "page";
    import ActivityEvent from "./ActivityEvent.svelte";

    const client = getContext<OpenChat>("client");
    let selectedEvent: MessageActivityEvent | undefined = undefined;

    let activityEvents: MessageActivityEvent[] = [];

    // TODO we want to get this to re-load if we find that we have new stuff

    onMount(() => {
        client.messageActivityFeed().then((resp) => {
            console.log("MessageActivity", resp);
            activityEvents = resp.events;

            if (activityEvents.length > 0) {
                client.markActivityFeedRead(activityEvents[0].timestamp);
            }
        });
    });

    function selectEvent(ev: MessageActivityEvent) {
        selectedEvent = ev;
        page(routeForMessage("none", ev.messageContext, ev.messageIndex));
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
    {#each activityEvents as event}
        <ActivityEvent
            {event}
            selected={selectedEvent === event}
            on:click={() => selectEvent(event)} />
    {/each}
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
