<script lang="ts">
    import { Container, Logo, SectionHeader } from "component-lib";
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
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import ActivityEvent from "./ActivityEvent.svelte";

    const client = getContext<OpenChat>("client");

    let activityEvents = $state<MessageActivityEvent[]>([]);
    let latestTimestamp = $derived(activityEvents[0]?.timestamp ?? 0n);
    let uptodate = $derived.by(() => {
        return $messageActivitySummaryStore.latestTimestamp <= latestTimestamp;
    });

    function loadActivity() {
        client.subscribeToMessageActivityFeed((resp, final) => {
            activityEvents = resp.events;
            if (activityEvents.length > 0 && final) {
                client.markActivityFeedRead(latestTimestamp);
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

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("activity.title")} />
    {/snippet}
</SectionHeader>

<Container height={{ kind: "fill" }} closeMenuOnScroll direction={"vertical"}>
    <VirtualList keyFn={eventKey} items={activityEvents}>
        {#snippet children(item)}
            <ActivityEvent event={item} onClick={() => selectEvent(item)} />
        {/snippet}
    </VirtualList>
</Container>
