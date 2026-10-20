<!-- The left column's activity feed (region "activity", phase 3d): reactions, mentions, replies, tips
     and the rest on the reader's messages, from the client's activity feed (as the old ActivityFeed
     loaded it). Opening one goes to its message with the feed still open (?panel=activity); over
     another page's middle the feed has Back to that page's own panel (ROUTES.md, decision 7). -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        currentUserIdStore,
        messageActivitySummaryStore,
        type MessageActivityEvent,
        type MessageContext,
        type OpenChat,
    } from "@client";
    import ActivityPanel from "@openchat/ui/src/features/components/ActivityPanel.svelte";
    import { activityFeedState } from "@src/runes/activity.svelte";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import {
        activityId,
        activityItem,
        activityLink,
        readUpTo,
        type ActivityContext,
    } from "./activity.adapter";

    let { region }: ScreenProps<Extract<LeftRegion, { kind: "activity" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the feed loads (again) whenever the summary says there's newer activity than it has, as
    // the old feed did
    const upToDate = $derived(
        activityFeedState.initialised &&
            $messageActivitySummaryStore.latestTimestamp <= activityFeedState.latestTimestamp,
    );
    $effect(() => {
        if (upToDate) return;
        untrack(() =>
            client.subscribeToMessageActivityFeed((response) => {
                activityFeedState.activityEvents = response.events;
            }),
        );
    });

    // as the old feed named a chat: the person, the group, or "Community > channel", and
    // "Thread" for a message in a thread
    function chatName(context: MessageContext): string | undefined {
        const chat = client.lookupChatSummary(context.chatId);
        if (chat === undefined) return undefined;
        const parts: string[] = [];
        switch (chat.kind) {
            case "direct_chat":
                parts.push(client.getDisplayName(chat.them.userId));
                break;
            case "group_chat":
                parts.push(chat.name);
                break;
            case "channel": {
                const community = $communitiesStore.get({
                    kind: "community",
                    communityId: chat.id.communityId,
                });
                if (community !== undefined) parts.push(community.name);
                parts.push(chat.name);
                break;
            }
        }
        if (context.threadRootMessageIndex !== undefined) parts.push("Thread");
        return parts.join(" > ");
    }

    const ctx = $derived.by((): ActivityContext => {
        const users = $allUsersStore;
        return {
            me: $currentUserIdStore,
            you: $_("you"),
            anon: $_("activity.anon"),
            missing: $_("activity.missingMessage"),
            userName: (userId) => client.displayName(users.get(userId)),
            chatName,
            contentText: (content) => client.getContentAsText($_, content),
            t: (key, values) => $_(key, { values }),
            day: (timestamp) => client.formatMessageDate(timestamp, $_("today"), $_("yesterday")),
            time: (timestamp) => client.toShortTimeString(new Date(Number(timestamp))),
            readUpTo: $messageActivitySummaryStore.readUpToTimestamp,
        };
    });

    const events = $derived(activityFeedState.activityEvents);
    const items = $derived(events.map((event) => activityItem(event, ctx)));

    function eventsFor(ids: string[]): MessageActivityEvent[] {
        const wanted = new Set(ids);
        return events.filter((event) => wanted.has(activityId(event)));
    }

    function markRead(upTo: bigint | undefined) {
        if (upTo !== undefined && upTo > $messageActivitySummaryStore.readUpToTimestamp) {
            return client.markActivityFeedRead(upTo);
        }
    }
</script>

<ActivityPanel
    {items}
    loading={!activityFeedState.initialised}
    onOpen={(item) => {
        const event = eventsFor([item.id])[0];
        if (event !== undefined) navigate(activityLink(event));
    }}
    onMarkRead={(ids) => markRead(readUpTo(eventsFor(ids)))}
    onMarkAllRead={() => markRead(activityFeedState.latestTimestamp)}
    onBack={region.over ? () => navigate(removeQueryStringParam("panel"), "dismiss") : undefined} />
