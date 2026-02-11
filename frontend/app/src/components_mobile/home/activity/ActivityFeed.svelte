<script lang="ts">
    import { activityFeedState } from "@src/runes/activity.svelte";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { Body, Container, Logo, SectionHeader } from "component-lib";
    import {
        messageActivitySummaryStore,
        messageContextToChatListScope,
        messageContextToString,
        OpenChat,
        routeForMessage,
        type MessageActivityEvent,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import NothingToSee from "../NothingToSee.svelte";
    import ActivityEvent from "./ActivityEvent.svelte";

    const client = getContext<OpenChat>("client");

    let uptodate = $derived.by(() => {
        return $messageActivitySummaryStore.latestTimestamp <= activityFeedState.latestTimestamp;
    });

    type ActivityItem =
        | { kind: "event"; formattedTime: string; event: MessageActivityEvent }
        | { kind: "header"; formattedTime: string; timestamp: bigint };

    let formatHeaderTime = (timestamp: bigint): string =>
        client.getSmartDateHeader(timestamp, $_("today"), $_("yesterday"));

    let activityItems: ActivityItem[] = $derived(
        activityFeedState.activityEvents.reduce((acc, curItem, idx) => {
            const curTimeFmt = formatHeaderTime(curItem.timestamp);
            const prev = activityFeedState.activityEvents[idx - 1];
            const prevTimeFmt = prev ? formatHeaderTime(prev.timestamp) : undefined;
            if (curTimeFmt !== prevTimeFmt) {
                acc.push({
                    kind: "header",
                    formattedTime: curTimeFmt,
                    timestamp: curItem.timestamp,
                });
            }

            acc.push({
                kind: "event",
                formattedTime: curTimeFmt,
                event: curItem,
            });

            return acc;
        }, [] as ActivityItem[]),
    );

    function loadActivity() {
        let firstResponse = true;
        client.subscribeToMessageActivityFeed((resp, final) => {
            if (firstResponse) {
                activityFeedState.activityEvents = resp.events;
                firstResponse = false;
            }
            activityFeedState.populateMessages(resp.events);
            if (activityFeedState.activityEvents.length > 0 && final) {
                client.markActivityFeedRead(activityFeedState.latestTimestamp);
            }
        });
    }

    function selectEvent(ev: MessageActivityEvent) {
        page(
            routeForMessage(
                messageContextToChatListScope(ev.messageContext).kind,
                ev.messageContext,
                ev.messageIndex,
            ),
        );
    }

    function eventKey(item: ActivityItem): string {
        switch (item.kind) {
            case "event": {
                const { messageContext, eventIndex, activity } = item.event;
                return `${messageContextToString(messageContext)}_${eventIndex}_${activity}`;
            }

            case "header": {
                return `events_header_${item.timestamp}`;
            }
        }
    }

    trackedEffect("activityFeed", () => {
        if (!uptodate || !activityFeedState.initialised) {
            loadActivity();
        }
    });
</script>

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("activity.title")} />
    {/snippet}
</SectionHeader>

<Container
    mainAxisAlignment={activityFeedState.initialised ? undefined : "center"}
    crossAxisAlignment={activityFeedState.initialised ? undefined : "center"}
    height={"fill"}
    closeMenuOnScroll
    direction={"vertical"}>
    {#if !activityFeedState.initialised}
        <FancyLoader size={"3rem"} />
    {:else if activityFeedState.activityEvents.length === 0 && activityFeedState.initialised}
        <NothingToSee title={"No activity yet"} subtitle={"Check back later for new activity"} />
    {:else}
        <VirtualList keyFn={eventKey} items={activityItems}>
            {#snippet children(item)}
                {#if item.kind === "header"}
                    <!-- TODO make the time header stick to top-->
                    <Container
                        supplementalClass="activity_time_header"
                        padding={["xl", "zero", "zero"]}>
                        <Body colour={"textSecondary"} fontWeight={"semi-bold"}>
                            {item.formattedTime}
                        </Body>
                    </Container>
                {:else}
                    <ActivityEvent
                        message={activityFeedState.getMessage(item.event.messageId)}
                        event={item.event}
                        onClick={() => selectEvent(item.event)} />
                {/if}
            {/snippet}
        </VirtualList>
    {/if}
</Container>

<style lang="scss">
    :global(.activity_time_header) {
        padding-left: 4.75rem !important;
    }
</style>
