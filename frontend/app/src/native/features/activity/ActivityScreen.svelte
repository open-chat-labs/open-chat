<!-- The Activity tab (N13, native plan 16, design notes §3.12): the title with "Mark all read" (it
     fades when nothing is unread, and never moves the layout), All / Mentions / Payments with a badge
     only where something is unread, and the feed's rows grouped by day, an accent dot on the unread
     ones (no tint). Tapping a row opens its message pushed over this tab (`?panel=activity`), and
     marks it read. The tab bar's dot is the shell's (unread activity in the summary).

     The items, their context, the loading and marking read are the web feed's (logic/activity),
     the tabs, badges, days and the marks that roll back the library's (activityFeed). -->
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
    import {
        ACTIVITY_TAB_LABELS,
        ActivityReadMarks,
        activityTabCounts,
        activityTabItems,
        startsDay,
        type ActivityItem,
    } from "@openchat/ui/src/lib/activityFeed.svelte";
    import ActivityRow from "@openchat/ui/src/lib/components/ActivityRow.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Skeleton from "@openchat/ui/src/lib/components/Skeleton.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { activityFeedState } from "@src/logic/activity/activity.svelte";
    import {
        ActivityFeedLoad,
        activityContext,
        markActivityRead,
    } from "@src/logic/activity/activityFeed.svelte";
    import { activityId, activityItem, activityLink, readUpTo } from "@src/logic/activity/activityItem";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "activity" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the feed loads (again) whenever the summary says there's newer activity than it has; a load
    // that failed waits for Retry
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

    let tab = $state(0);
    // what an empty tab says, the prototype's line for each
    const EMPTY = [
        "native.activity.empty.all",
        "native.activity.empty.mentions",
        "native.activity.empty.payments",
    ];
    const marks = new ActivityReadMarks();
    const isUnread = (item: ActivityItem) => marks.isUnread(item);
    const shown = $derived(activityTabItems(items, tab));
    const counts = $derived(activityTabCounts(items, isUnread));
    const anyUnread = $derived(items.some(isUnread));

    function eventsFor(ids: string[]): MessageActivityEvent[] {
        const wanted = new Set(ids);
        return events.filter((event) => wanted.has(activityId(event)));
    }

    function markRead(upTo: bigint | undefined): Promise<void> {
        return markActivityRead(
            client,
            upTo,
            messageActivitySummaryStore.value.readUpToTimestamp,
        );
    }

    // a mark that didn't stick is rolled back (the dot comes back) and said in a toast
    function sayIfFailed() {
        if (marks.failed) context.toast($_("ui.activityPanel.markFailed"));
    }

    function open(item: ActivityItem) {
        const event = eventsFor([item.id])[0];
        if (event === undefined) return;
        void marks.open(item, (ids) => markRead(readUpTo(eventsFor(ids)))).then(sayIfFailed);
        navigate(activityLink(event));
    }

    function markAll() {
        void marks
            .markAll(items, () => markRead(activityFeedState.latestTimestamp), undefined)
            .then(sayIfFailed);
    }
</script>

<div class="activity">
    <NativePageHeader title={$_("native.tabs.activity")} size="lg">
        <!-- always there, so the title row never moves: faded out and inert with nothing unread -->
        <button
            type="button"
            class="mark-all"
            class:hidden={!anyUnread}
            aria-hidden={anyUnread ? undefined : "true"}
            tabindex={anyUnread ? 0 : -1}
            onclick={markAll}
        >
            {$_("ui.activityPanel.markAllRead")}
        </button>
    </NativePageHeader>

    {#if feed.failed}
        <div class="state">
            <EmptyState
                preset="error"
                title={$_("unexpectedError")}
                body={$_("regionLoadFailed")}
                actionLabel="ui.common.retry"
                actionHandler={() => feed.retry()}
            />
        </div>
    {:else}
        <div class="filters">
            <SegmentedTabs
                size="sm"
                labels={ACTIVITY_TAB_LABELS.map((key) => $_(key))}
                {counts}
                selectedIndex={tab}
                dotOnLast={false}
                onSelect={(i) => (tab = i)}
            />
        </div>

        <div class="feed">
            {#if !activityFeedState.initialised}
                <Skeleton variant="activity" count={7} />
            {:else if shown.length === 0}
                <span class="empty">{$_(EMPTY[tab])}</span>
            {:else}
                {#each shown as item, i (item.id)}
                    {#if startsDay(shown, i)}
                        <span class="day" class:first={i === 0}>{item.day}</span>
                    {/if}
                    <div class="row">
                        <ActivityRow
                            title={item.title}
                            context={item.context}
                            preview={item.preview ?? ""}
                            time={item.time}
                            unread={isUnread(item)}
                            color={item.color ?? "violet"}
                            avatarUrl={item.avatarUrl}
                            kind={item.kind ?? "user"}
                            reactions={item.reactions ?? []}
                            tips={item.tips ?? []}
                            onClick={() => open(item)}
                        />
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .activity {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .mark-all {
        flex: none;
        display: flex;
        align-items: center;
        height: var(--touch-target);
        padding: 0 var(--space-10);
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(14px) / 1 var(--font-sans);
        color: var(--accent);
        cursor: pointer;
        transition: opacity 0.2s ease;
        -webkit-tap-highlight-color: transparent;

        &.hidden {
            opacity: 0;
            pointer-events: none;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .filters {
        flex: none;
        padding: var(--space-12) var(--space-16) var(--space-14);
    }

    .feed {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        padding: 0 var(--space-10) calc(var(--space-24) * 2);
    }

    .day {
        padding: var(--space-22) var(--space-12) var(--space-8);
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);

        &.first {
            padding-top: var(--space-4);
        }
    }

    .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
    }

    .empty {
        padding: calc(var(--space-24) * 2) var(--space-24);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .state {
        flex: 1;
        display: grid;
        place-items: center;
        padding: var(--space-24) var(--space-16);
    }

    @include reduced-motion {
        .mark-all {
            transition: none;
        }
    }
</style>
