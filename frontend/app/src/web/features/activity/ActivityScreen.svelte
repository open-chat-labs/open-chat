<!-- The left column's activity feed (region "activity", phase 3d): reactions, mentions, replies, tips
     and the rest on the reader's messages, from the client's activity feed (as the old ActivityFeed
     loaded it). Opening one goes to its message with the feed still open (?panel=activity); over
     another page's middle the feed has Back to that page's own panel (ROUTES.md, decision 7). The
     items, their context, the loading and the marks are logic/activity's, shared with the native
     Activity tab. -->
<script lang="ts">
    import {
        allChatsStore,
        allUsersStore,
        bridgedUsersStore,
        communitiesStore,
        cryptoLookup,
        currentUserIdStore,
        messageActivitySummaryStore,
        userGroupSummariesStore,
        type MessageActivityEvent,
        type OpenChat,
    } from "@client";
    import ActivityPanel from "@openchat/ui/src/features/components/ActivityPanel.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { activityFeedState } from "@src/logic/activity/activity.svelte";
    import {
        ActivityFeedLoad,
        activityContext,
        markActivityRead,
    } from "@src/logic/activity/activityFeed.svelte";
    import { activityId, activityItem, activityLink, readUpTo } from "@src/logic/activity/activityItem";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";

    let { region, context: screen }: ScreenProps<Extract<LeftRegion, { kind: "activity" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the feed loads (again) whenever the summary says there's newer activity than it has, as
    // the old feed did; a load that failed waits for Retry
    const feed = new ActivityFeedLoad(client);
    $effect(() => {
        if (feed.needed($messageActivitySummaryStore.latestTimestamp)) untrack(() => feed.load());
    });

    const ctx = $derived.by(() => {
        // read so the chats' names follow their summaries, which can come in after the feed
        void $allChatsStore;
        return activityContext({
            client,
            formatter: $_,
            me: $currentUserIdStore,
            users: $allUsersStore,
            bridgedUsers: $bridgedUsersStore,
            userGroups: { get: (id) => $userGroupSummariesStore.get(id) },
            tokens: $cryptoLookup,
            communityName: (id) => $communitiesStore.get(id)?.name,
            readUpTo: $messageActivitySummaryStore.readUpToTimestamp,
        });
    });

    const events = $derived(activityFeedState.activityEvents);
    const items = $derived(events.map((event) => activityItem(event, ctx)));

    function eventsFor(ids: string[]): MessageActivityEvent[] {
        const wanted = new Set(ids);
        return events.filter((event) => wanted.has(activityId(event)));
    }

    function markRead(upTo: bigint | undefined) {
        return markActivityRead(
            client,
            upTo,
            messageActivitySummaryStore.value.readUpToTimestamp,
        );
    }
</script>

{#if feed.failed}
    <div class="failed">
        <EmptyState
            preset="error"
            title={$_("unexpectedError")}
            body={$_("regionLoadFailed")}
            actionLabel="ui.common.retry"
            actionHandler={() => feed.retry()} />
    </div>
{:else}
    <ActivityPanel
        {items}
        loading={!activityFeedState.initialised}
        onOpen={(item) => {
            const event = eventsFor([item.id])[0];
            // a narrow screen shows the message alone
            if (event !== undefined) navigate(activityLink(event, !screen.narrow));
        }}
        onMarkRead={(ids) => markRead(readUpTo(eventsFor(ids)))}
        onMarkAllRead={() => markRead(activityFeedState.latestTimestamp)}
        onBack={region.over
            ? // the page with the feed closed, replacing this one: Back doesn't depend on history
              // (decision 7), and a pop could land on an entry that still has the feed
              () => navigate(removeQueryStringParam("panel"), "auto")
            : undefined} />
{/if}

<style lang="scss">
    .failed {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
