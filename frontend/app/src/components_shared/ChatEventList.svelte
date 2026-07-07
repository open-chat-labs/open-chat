<script lang="ts" module>
    import type { ChatEvent as ChatEventType, EventWrapper, Mention } from "openchat-client";

    export type ChatEventListArgs = {
        isAccepted: (_unconf: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        isConfirmed: (_unconf: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        isFailed: (_failed: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        isReadByMe: (_store: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        messageObserver: IntersectionObserver | undefined;
        focusIndex: number | undefined;
    };

    // state + actions handed to the platform-specific FAB snippet
    export type ChatEventListFabArgs = {
        showGoToTop: boolean;
        showGoToBottom: boolean;
        loadingFromUserScroll: boolean;
        scrollToTop: () => void;
        scrollToLast: () => void;
        scrollToMention: (mention: Mention | undefined) => void;
    };
</script>

<script lang="ts">
    import { portalState } from "component-lib";
    import {
        currentUserIdStore,
        eventIndexesLoadedStore,
        eventListLastScrolled,
        eventListScrollTop,
        eventListScrolling,
        localUpdates,
        messageContextsEqual,
        routeStore,
        subscribe,
        withEqCheck,
        type ChatSummary,
        type Message,
        type MessageContext,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount, tick, untrack, type Snippet } from "svelte";
    import { isSafari, mobileOperatingSystem } from "@utils/devices";
    import type { FlatChatItem } from "./flatChatItems";
    import { vclDebug } from "./vclDebug";
    import { rowByKey } from "./virtualListUtils";
    import VirtualChatList from "./VirtualChatList.svelte";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_READ_THRESHOLD = 500;
    const FROM_END_THRESHOLD = 600;
    const LOADING_THRESHOLD = 400;
    // Loading newer messages gets a bigger head start: scrolling forwards runs
    // into the hard scrollTop=0 wall when the load hasn't landed yet, which
    // feels far worse than the equivalent at the top of the list.
    const LOAD_NEW_THRESHOLD = 800;
    const SCROLL_THRESHOLD = 500;
    const client = getContext<OpenChat>("client");

    interface Props {
        rootSelector: string;
        chat: ChatSummary;
        threadRootEvent: EventWrapper<Message> | undefined;
        items: FlatChatItem[];
        readonly: boolean;
        maintainScroll: boolean;
        visible: boolean;
        initialised: boolean;
        messagesDiv?: HTMLDivElement;
        messagesDivHeight?: number;
        // platform-specific class applied to the scroll viewport — must size it
        // (e.g. flex: auto) and may set padding/gap/background
        viewportClass?: string;
        // y-position of the floating date element (from the platform wrapper)
        stickyDateElTop?: number;
        stickyDateTimestamp?: bigint;
        row: Snippet<[FlatChatItem, ChatEventListArgs]>;
        fabs?: Snippet<[ChatEventListFabArgs]>;
    }

    let {
        rootSelector,
        chat,
        threadRootEvent,
        items: allItems,
        readonly,
        maintainScroll,
        visible,
        initialised = $bindable(),
        messagesDiv = $bindable(undefined),
        messagesDivHeight = $bindable(0),
        viewportClass,
        stickyDateElTop,
        stickyDateTimestamp = $bindable(undefined),
        row,
        fabs,
    }: Props = $props();

    let virtualList: VirtualChatList<FlatChatItem> | undefined = $state();
    let focusIndex = $state<number | undefined>();
    let interrupt = $state(false);
    let fromBottom = $state(0);
    let loadingFromUserScroll = $state(false);
    let showGoToBottom = $state(false);
    let showGoToTop = $state(false);
    let messageObserver: IntersectionObserver | undefined = $state();
    let scrollingToMessage = false;
    let scrollToBottomOnSend = false;
    // Set when the user asks for the latest messages (go-to-bottom FAB). While
    // set, incoming loads of newer messages snap to the bottom instead of
    // preserving the reading position — otherwise the catch-up cascade drifts
    // the viewport away from the bottom the user just asked for. Cleared by a
    // genuine user scroll or a context change.
    let pinToBottom = false;
    let destroyed = false;
    let loadingNewMessages = false;
    let loadingPrevMessages = false;
    // After a scroll-triggered load, block further scroll-triggered loads until
    // the gesture fully stops (see trackScrollStop) — prevents runaway loading
    // while momentum keeps the viewport inside a loading threshold.
    let requireScrollStop = false;
    // Circuit breaker: if a load completes without changing the items at all
    // (e.g. every returned event is filtered out of the timeline), the loading
    // thresholds remain satisfied and the load loop would spin forever —
    // load → scrollTop restore → scroll event → threshold check → load…
    // burning CPU and memory until the tab dies. Cool the loader down when a
    // load makes no progress — per direction, so a fruitless backward load
    // doesn't also suppress new-message loading (or vice versa).
    let loadPrevCooldownUntil = 0;
    let loadNewCooldownUntil = 0;
    let messageReadTimers: Record<number, number> = {};

    let threadSummary = $derived(threadRootEvent?.event.thread);
    let messageContext = $derived.by(
        withEqCheck(
            () => ({
                chatId: chat?.id,
                threadRootMessageIndex: threadRootEvent?.event.messageIndex,
            }),
            messageContextsEqual,
        ),
    );

    // The event store can hold disjoint ranges: the window loaded around a
    // navigation target, an island of the very latest messages (merged from
    // chat summary updates), and scattered strays in between. The timeline
    // flattens everything into one list, so the estimates spanning the gaps
    // are fiction — scrolling forward from an old message crosses the gap in
    // a screenful, hits a false bottom at the island tip, then grinds
    // backfill loads whose progress lands invisibly above the viewport.
    // Render only the contiguous segment containing the anchor: the last
    // navigation target, or the newest segment when reading the live edge.
    // Threads are always contiguous — no filtering.
    let anchorMessageIndex = $state<number | undefined>(undefined);

    let items = $derived.by<FlatChatItem[]>(() => {
        if (threadRootEvent !== undefined || allItems.length === 0) return allItems;
        const loaded = $eventIndexesLoadedStore;
        // Segment boundaries: a split between adjacent event items whose gap
        // is not fully covered by the loaded ranges (expired/disappeared
        // events count as loaded). allItems is newest-first, so event
        // indexes descend as the flat index ascends.
        const bounds = [0];
        let prev: number | undefined;
        for (let i = 0; i < allItems.length; i++) {
            const item = allItems[i];
            if (item.kind !== "event") continue;
            const idx = item.event.index;
            if (prev !== undefined && prev - idx > 1) {
                const gap = prev - idx - 1;
                if (loaded.clone().intersect(idx + 1, prev - 1).length !== gap) {
                    bounds.push(i);
                }
            }
            prev = idx;
        }
        if (bounds.length === 1) return allItems;
        bounds.push(allItems.length);
        let chosen = 0;
        if (anchorMessageIndex !== undefined) {
            for (let s = 0; s < bounds.length - 1; s++) {
                let newest: number | undefined;
                let oldest: number | undefined;
                for (let i = bounds[s]; i < bounds[s + 1]; i++) {
                    const item = allItems[i];
                    if (item.kind === "event" && item.event.event.kind === "message") {
                        newest ??= item.event.event.messageIndex;
                        oldest = item.event.event.messageIndex;
                    }
                }
                if (
                    newest !== undefined &&
                    anchorMessageIndex <= newest &&
                    anchorMessageIndex >= (oldest ?? newest)
                ) {
                    chosen = s;
                    break;
                }
            }
        }
        const seg = allItems.slice(bounds[chosen], bounds[chosen + 1]);
        vclDebug.log("segment", {
            segs: bounds.length - 1,
            chosen,
            anchor: anchorMessageIndex,
            len: seg.length,
            of: allItems.length,
        });
        return seg;
    });

    // messageIndex -> flat item index, for programmatic scrolling.
    // Failed messages are excluded (mirrors findMessageEvent).
    let messageIndexToFlat = $derived.by(() => {
        const map = new Map<number, number>();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (
                item.kind === "event" &&
                item.event.event.kind === "message" &&
                !localUpdates.isFailed(messageContext, item.event.event.messageId)
            ) {
                map.set(item.event.event.messageIndex, i);
            }
        }
        return map;
    });

    const fromTop = () => {
        if (messagesDiv) {
            return messagesDiv.scrollHeight - messagesDiv.clientHeight - fromBottom;
        }
        return 0;
    };

    const insideBottomThreshold = () => fromBottom < LOADING_THRESHOLD;

    // A navigation abandoned by a chat switch exits through the context
    // mismatch guard without clearing scrollingToMessage — which would leave
    // background loading gated off in the newly selected chat.
    $effect(() => {
        void messageContext;
        scrollingToMessage = false;
        navToken++;
        // a hidden-time navigation belongs to the chat it was issued in
        pendingHiddenNav = undefined;
        anchorMessageIndex = undefined;
    });
    const insideTopThreshold = () => fromTop() < LOADING_THRESHOLD;

    $effect(() => {
        void fromBottom;
        updateShowGoToBottom();
        updateShowGoToTop();
    });

    $effect(() => {
        // previously the component would have been destroyed when not showing the middle panel meaning all of
        // these variables would have been re-initialised
        if (!visible) {
            initialised = false;
            destroyed = true;
            loadingFromUserScroll = false;
            scrollingToMessage = false;
            scrollToBottomOnSend = false;
            loadingNewMessages = false;
            loadingPrevMessages = false;
            requireScrollStop = false;
            pinToBottom = false;
        }
    });

    // A navigation that arrived while the list was hidden (covering panel);
    // executed as soon as the list is visible again, with a real viewport to
    // position against. $state is load-bearing: the revive effect must fire
    // when the navigation is stashed, not only when `visible` next changes —
    // depending on layout the visibility flip can precede the stash.
    let pendingHiddenNav = $state<
        { context: MessageContext; index: number; preserveFocus: boolean } | undefined
    >(undefined);

    $effect(() => {
        if (visible && pendingHiddenNav !== undefined) {
            const nav = pendingHiddenNav;
            untrack(() => {
                pendingHiddenNav = undefined;
                destroyed = false;
                vclDebug.log("scroll-to-msg-revive", { index: nav.index });
                scrollToMessageIndex(nav.context, nav.index, nav.preserveFocus);
            });
        }
    });

    // Restore the persisted scroll position (stored as fromBottom, not
    // scrollTop — it is stable across height re-estimation) when the list
    // becomes visible again.
    $effect(() => {
        if (visible && maintainScroll) {
            untrack(() => {
                const fb = $eventListScrollTop;
                if (fb !== undefined) {
                    vclDebug.log("restore", { fb: Math.round(fb) });
                    initialised = true;
                    destroyed = false;
                    fromBottom = fb;
                    // restore the browser scroll position under interrupt; when the
                    // interrupt ends VirtualChatList resyncs its window from it
                    interruptScroll(-fb);
                }
            });
        }
    });

    function updateShowGoToBottom() {
        showGoToBottom = fromBottom > FROM_END_THRESHOLD;
    }

    function updateShowGoToTop() {
        showGoToTop = fromTop() > FROM_END_THRESHOLD;
    }

    function isDateMarker(item: FlatChatItem): boolean {
        return item.kind === "timeline_date";
    }

    function timestampFor(item: FlatChatItem): bigint | undefined {
        switch (item.kind) {
            case "timeline_date":
                return item.timestamp;
            case "event":
                return item.event.timestamp;
            default:
                return undefined;
        }
    }

    onMount(() => {
        const messageObserverOptions = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        messageObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idxAttrs = entry.target.attributes.getNamedItem("data-index");
                const idAttr = entry.target.attributes.getNamedItem("data-id");
                const idx = idxAttrs
                    ? Math.max(...idxAttrs.value.split(" ").map((v) => parseInt(v, 10)))
                    : undefined;
                const id = idAttr ? BigInt(idAttr.value) : undefined;
                if (idx !== undefined) {
                    const intersectionRatioRequired =
                        0 < messagesDivHeight && messagesDivHeight < entry.boundingClientRect.height
                            ? (messagesDivHeight * 0.5) / entry.boundingClientRect.height
                            : 0.5;

                    const isIntersecting = entry.intersectionRatio >= intersectionRatioRequired;
                    if (isIntersecting && messageReadTimers[idx] === undefined) {
                        const context = messageContext;
                        const timer = window.setTimeout(() => {
                            // With virtualization a fast fling can destroy the row
                            // before the observer reports it leaving — the cancel
                            // branch below never runs, and a message that was only
                            // glimpsed would be marked read. A destroyed row is
                            // detached from the document; skip it.
                            if (
                                entry.target.isConnected &&
                                messageContextsEqual(context, messageContext)
                            ) {
                                client.markMessageRead(messageContext, idx, id);
                                messageObserver?.unobserve(entry.target);
                            }
                            delete messageReadTimers[idx];
                        }, MESSAGE_READ_THRESHOLD);
                        messageReadTimers[idx] = timer;
                    }
                    if (!isIntersecting && messageReadTimers[idx] !== undefined) {
                        window.clearTimeout(messageReadTimers[idx]);
                        delete messageReadTimers[idx];
                    }
                }
            });
        }, messageObserverOptions);

        const unsubs = [
            subscribe("chatUpdated", chatsUpdated),
            subscribe("reactionSelected", afterReaction),
            subscribe("sendingMessage", sendingMessage),
            subscribe("sentMessage", sentMessage),
            subscribe("loadedMessageWindow", onMessageWindowLoaded),
            subscribe(
                "loadedNewMessages",
                (args) => !scrollingToMessage && onLoadedNewMessages(args),
            ),
            subscribe(
                "loadedPreviousMessages",
                (args) => !scrollingToMessage && onLoadedPreviousMessages(args),
            ),
        ];
        return () => {
            unsubs.forEach((u) => u());
            destroyed = true;
            messageObserver?.disconnect();
            messageObserver = undefined;
            for (const timer of Object.values(messageReadTimers)) {
                window.clearTimeout(timer);
            }
            messageReadTimers = {};
            clearTimeout(scrollTimeout);
        };
    });

    function chatsUpdated(ctx: MessageContext) {
        // Never start a background new-message load while a message navigation
        // is in flight: loadEventWindow clears the event store before its
        // window arrives, and a concurrent load merging the latest messages
        // into the empty store makes the window fail the contiguity check and
        // get dropped — the navigation then lands nowhere (observed as pinned
        // message navigation failing on busy channels most of the time).
        if (messageContextsEqual(ctx, messageContext) && !scrollingToMessage) {
            // I *think* chatsUpdated is only going to be because there are new messages to load
            // so there is no need to load more previous messages. It's better that we don't even check
            // here because in certain race conditions we might ending up loading the previous messages twice.
            loadNewMessagesIfRequired();
        }
    }

    function sendingMessage(ctx: MessageContext) {
        if (messageContextsEqual(ctx, messageContext)) {
            scrollToBottomOnSend = insideBottomThreshold();
        }
    }

    function sentMessage(payload: { context: MessageContext; event: EventWrapper<Message> }) {
        tick().then(() => {
            if (messageContextsEqual(payload.context, messageContext)) {
                afterSendMessage(payload.context, payload.event);
            }
        });
    }

    async function afterReaction({
        messageId,
        kind,
    }: {
        messageId: bigint;
        kind: "add" | "remove";
    }) {
        if (
            !client.moreNewMessagesAvailable(chat.id, threadRootEvent) &&
            kind === "add" &&
            insideBottomThreshold() &&
            findLastMessage()?.messageId === messageId
        ) {
            await scrollBottom("smooth");
        }
    }

    function findLastMessage(): Message | undefined {
        // items[0] is the newest
        for (const item of items) {
            if (item.kind === "event" && item.event.event.kind === "message") {
                return item.event.event;
            }
        }
    }

    async function afterSendMessage(context: MessageContext, event: EventWrapper<Message>) {
        if (context.threadRootMessageIndex !== undefined && threadRootEvent !== undefined) {
            const summary = {
                participantIds: new Set<string>([$currentUserIdStore]),
                numberOfReplies: event.event.messageIndex + 1,
                latestEventIndex: event.index,
                latestEventTimestamp: event.timestamp,
            };
            client.markThreadSummaryUpdated(threadRootEvent.event.messageId, summary);
        }

        if (!client.moreNewMessagesAvailable(chat.id, threadRootEvent) && scrollToBottomOnSend) {
            scrollBottom("smooth");
            scrollToBottomOnSend = false;
        }
    }

    async function scrollBottom(behavior: ScrollBehavior = "auto"): Promise<void> {
        vclDebug.log("scroll-bottom", { behavior });
        // going to the bottom means reading the live edge — re-anchor the
        // rendered segment to the newest range
        anchorMessageIndex = undefined;
        virtualList?.scrollToBottom(behavior);
        // Protect the jump-to-bottom from iOS momentum: a frame of overflow-y:hidden
        // halts native momentum scrolling and gates onScroll, so stale in-flight
        // scroll events can't desync the virtual window from `fromBottom`.
        // Smooth scrolls are the gentle new-message auto-follow (already near the
        // bottom, no momentum race), so leave those animating uninterrupted.
        if (behavior !== "smooth") {
            await interruptScroll(0);
        }
    }

    function shouldLoadPreviousMessages() {
        if (!chat || Date.now() < loadPrevCooldownUntil) return false;
        return (
            visible &&
            insideTopThreshold() &&
            client.morePreviousMessagesAvailable(chat.id, threadRootEvent)
        );
    }

    function shouldLoadNewMessages() {
        if (!chat || Date.now() < loadNewCooldownUntil) return false;
        return (
            visible &&
            fromBottom < LOAD_NEW_THRESHOLD &&
            client.moreNewMessagesAvailable(chat.id, threadRootEvent)
        );
    }

    async function loadNew(): Promise<void> {
        const el = messagesDiv;
        const preLoadScrollHeight = el?.scrollHeight;
        // At the bottom the view must FOLLOW new content, not preserve the
        // reading position: scrollTop=0 is the column-reverse scroll origin
        // (the old list stayed pinned there for free), so an anchor restore
        // would push the view away from the bottom by the height of every
        // arriving batch — in a busy channel that reads as the list
        // repeatedly jumping ~a viewport up from the bottom.
        const preAtBottom = fromBottom < 10;
        // Capture the bottom-most rendered row as a position anchor. After the
        // load we restore its exact on-screen position from the DOM — the only
        // coordinate system that mixes no estimates.
        const anchorEl = el?.querySelector<HTMLElement>(".vcl-row");
        const anchorKey = anchorEl?.dataset.key;
        const anchorTop = anchorEl?.getBoundingClientRect().top;

        await client.loadNewMessages(chat.id, threadRootEvent);

        // In column-reverse, new messages are inserted at the visual bottom (scroll
        // origin), shifting existing content upward. Move the browser scroll
        // position to match. VirtualChatList's prepend handling has already
        // moved fromBottom to the equivalent position in the new coordinate
        // space using its height estimates, and its window/spacers are computed
        // from those same estimates — so restore scrollTop to -fromBottom. Do
        // NOT use the scrollHeight delta: it mixes real heights (rendered rows)
        // with estimates (spacer), and on a large prepend the two coordinate
        // systems disagree by more than the overscan — observed as a visible
        // jump plus a flash of the wrong window at the first forward load.
        if (pinToBottom) {
            // the user asked for the latest messages; follow the new content
            // instead of preserving the reading position
            await tick();
            await scrollBottom();
            // The pin has served its purpose once we're caught up — without
            // this release a user later reading just under the bottom
            // (fromBottom below the genuine-scroll release threshold) would
            // be yanked to the latest by the next new-message load.
            if (!client.moreNewMessagesAvailable(chat.id, threadRootEvent)) {
                pinToBottom = false;
            }
            return;
        }

        if (el && preLoadScrollHeight !== undefined) {
            await tick();
            const delta = el.scrollHeight - preLoadScrollHeight;
            // Preferred restore: the anchor row's actual pixel shift. Fallback:
            // -fromBottom, which at least shares its coordinate system (height
            // estimates) with the virtual window, unlike the scrollHeight delta.
            let target = -fromBottom;
            let anchored = false;
            // Follow-to-bottom applies ONLY at the live bottom of the chat:
            // preAtBottom re-checked against the current position (the user
            // may have scrolled away mid-load), AND the load must have caught
            // us up. At the catch-up WALL (scrollTop=0 mid-history because
            // the newer content is not loaded yet) preAtBottom is also true,
            // but forcing the bottom there teleports the user ~a batch of
            // messages forward on every load — position preservation is what
            // riding the wall needs.
            const caughtUp = !client.moreNewMessagesAvailable(chat.id, threadRootEvent);
            if (preAtBottom && caughtUp && -el.scrollTop < 200) {
                target = 0;
            } else if (anchorKey !== undefined && anchorTop !== undefined) {
                const again = rowByKey(el, anchorKey);
                if (again) {
                    target = el.scrollTop + (again.getBoundingClientRect().top - anchorTop);
                    anchored = true;
                }
            }
            vclDebug.log("load-new", {
                preH: Math.round(preLoadScrollHeight),
                postH: Math.round(el.scrollHeight),
                delta: Math.round(delta),
                st: Math.round(el.scrollTop),
                fb: Math.round(fromBottom),
                target: Math.round(target),
                anchored,
                atBottom: preAtBottom,
            });
            if (delta > 0) {
                if (mobileOperatingSystem === "iOS" || isSafari) {
                    // the one-frame overflow-y:hidden halts iOS momentum / macOS
                    // Safari trackpad inertia, so the programmatic write cannot
                    // be swallowed by native physics. Safari desktop needs this
                    // too: unlike Chrome (whose wheel animation a write cancels),
                    // Safari's inertia keeps running and clobbers the restore a
                    // frame later — the viewport teleports by the prepend height
                    // and the suddenly-near-bottom position triggers a cascade of
                    // further loads (observed as forward scroll "skipping").
                    await interruptScroll(target);
                } else {
                    // on Chrome desktop the freeze itself is a visible hitch
                    // mid-glide; a plain write is safe (it cancels the wheel
                    // animation) and onScroll resyncs the window
                    virtualList?.markProgrammaticScroll();
                    el.scrollTop = target;
                }
            }
        }
    }

    async function loadPrev(initialLoad: boolean): Promise<void> {
        const el = messagesDiv;
        const preLoadScrollTop = el?.scrollTop;

        await client.loadPreviousMessages(chat.id, threadRootEvent, initialLoad);

        vclDebug.log("load-prev", {
            preTop: preLoadScrollTop !== undefined ? Math.round(preLoadScrollTop) : undefined,
            postTop: el ? Math.round(el.scrollTop) : undefined,
            fb: Math.round(fromBottom),
            initialLoad,
        });
        // Restore against the browser's async post-growth scroll adjustment
        // (column-reverse quirk after the topSpacer grows), but to where the
        // user actually IS — not to the position captured at load start. On
        // iOS the user keeps scrolling while the load is in flight, and
        // restoring the stale scrollTop yanked the view forward by exactly
        // the distance scrolled during the load (the top message ducked off
        // the top of the screen). fromBottom tracks the last scroll event and
        // is frozen while the interrupt gates the handler, so it is the
        // pre-quirk, post-user-scroll position.
        await interruptScroll(-fromBottom);
    }

    async function loadNewMessagesIfRequired(fromScroll = false): Promise<boolean> {
        if (loadingNewMessages || loadingPrevMessages) return true;
        loadingNewMessages = shouldLoadNewMessages();
        loadingFromUserScroll = loadingNewMessages && fromScroll;
        if (loadingNewMessages) {
            await loadNew();
            loadingNewMessages = false;
            loadingFromUserScroll = false;
            return true;
        }
        return false;
    }

    async function loadMoreIfRequired(fromScroll = false, initialLoad = false): Promise<boolean> {
        if (loadingPrevMessages || loadingNewMessages) return true;

        // After a scroll-triggered load of OLDER messages, block further such
        // loads until the gesture fully stops (trackScrollStop clears the flag)
        // — this is what prevents runaway loading during momentum overshoot.
        // Loads of NEWER messages are exempt: the user is heading for the
        // bottom, consecutive loads are exactly what they want, and gating them
        // turns a fast forward scroll into a stop-start crawl against the
        // scrollTop=0 wall. A forward cascade terminates naturally at the
        // latest message.
        const shouldLoadPrev = shouldLoadPreviousMessages() && !(fromScroll && requireScrollStop);
        const shouldLoadNew = shouldLoadNewMessages();

        if (!shouldLoadPrev && !shouldLoadNew) return false;

        loadingPrevMessages = shouldLoadPrev;
        loadingNewMessages = shouldLoadNew;
        loadingFromUserScroll = fromScroll;
        if (fromScroll && shouldLoadPrev) requireScrollStop = true;

        vclDebug.log("load-check", {
            prev: shouldLoadPrev,
            new: shouldLoadNew,
            fromScroll,
            fb: Math.round(fromBottom),
            ft: Math.round(fromTop()),
        });

        const preLen = items.length;
        const preFirst = items[0]?.key;
        const preLast = items[items.length - 1]?.key;

        const loadPromises = [];
        if (shouldLoadNew) {
            loadPromises.push(loadNew());
        }
        if (shouldLoadPrev) {
            loadPromises.push(loadPrev(initialLoad));
        }
        await Promise.all(loadPromises);
        loadingPrevMessages = false;
        loadingNewMessages = false;
        loadingFromUserScroll = false;

        if (
            items.length === preLen &&
            items[0]?.key === preFirst &&
            items[items.length - 1]?.key === preLast
        ) {
            vclDebug.log("!load-noprogress", { len: preLen, prev: shouldLoadPrev, new: shouldLoadNew });
            const until = Date.now() + 5000;
            if (shouldLoadPrev) loadPrevCooldownUntil = until;
            if (shouldLoadNew) loadNewCooldownUntil = until;
        }
        return true;
    }

    async function resetScroll(initialLoad: boolean) {
        if (initialLoad) {
            await scrollBottom("auto");
        }
        if (!initialised) {
            initialised = true;
        }
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(messageContext, mention.messageIndex, false);
        }
    }

    function findMessageEvent(index: number): EventWrapper<Message> | undefined {
        for (const item of items) {
            if (
                item.kind === "event" &&
                item.event.event.kind === "message" &&
                item.event.event.messageIndex === index &&
                (messageContext === undefined ||
                    !localUpdates.isFailed(messageContext, item.event.event.messageId))
            ) {
                return item.event as EventWrapper<Message>;
            }
        }
    }

    function isAccepted(_: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && messageContext) {
            return !localUpdates.isPendingAcceptance(messageContext, evt.event.messageId);
        }
        return true;
    }

    function isConfirmed(_: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && messageContext) {
            return !localUpdates.isUnconfirmed(messageContext, evt.event.messageId);
        }
        return true;
    }

    function isFailed(_: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && messageContext) {
            return localUpdates.isFailed(messageContext, evt.event.messageId);
        }
        return false;
    }

    function isReadByMe(_: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (readonly || (evt.event.kind === "message" && evt.event.sender === $currentUserIdStore))
            return true;

        if (evt.event.kind === "message" || evt.event.kind === "aggregate_common_events") {
            let messageIndex =
                evt.event.kind === "message"
                    ? evt.event.messageIndex
                    : Math.max(...evt.event.messagesDeleted);
            let messageId = evt.event.kind === "message" ? evt.event.messageId : undefined;
            return client.isMessageRead(messageContext, messageIndex, messageId);
        }
        return true;
    }

    function checkIfTargetMessageHasAThread(index: number) {
        const msgEvent = findMessageEvent(index);
        if (msgEvent && threadRootEvent === undefined) {
            if (
                msgEvent.event.thread !== undefined &&
                // deliberately excludes favourites_route — matches the
                // pre-virtualisation behaviour
                ($routeStore.kind === "global_chat_selected_route" ||
                    $routeStore.kind === "selected_channel_route") &&
                ($routeStore.open || $routeStore.threadMessageIndex !== undefined)
            ) {
                client.openThread(chat.id, msgEvent, false, $routeStore.threadMessageIndex);
            }
        }
    }

    // Incremented for every externally-initiated navigation; the recursive
    // load-and-refine loop checks it so that a newer navigation (or a rapid
    // second click) cancels an older in-flight one instead of the two loops
    // fighting each other with loads and scrolls.
    let navToken = 0;

    export function scrollToMessageIndex(
        context: MessageContext,
        index: number,
        preserveFocus: boolean,
        filling: boolean = false,
        hasLookedUpEvent: boolean = false,
    ): Promise<void> {
        const token = ++navToken;
        return scrollToMessageIndexInternal(
            token,
            context,
            index,
            preserveFocus,
            filling,
            hasLookedUpEvent,
        ).finally(() => {
            // The recursion clears the flag on its normal exit paths, but a
            // rejection anywhere (e.g. loadEventWindow failing on a network
            // blip) would otherwise leave it stuck true — permanently gating
            // scroll-triggered and background loading. Only the navigation
            // that currently owns the flag may clear it.
            if (token === navToken) {
                scrollingToMessage = false;
                // Schedule the focus-highlight clear here, not on the happy
                // path: an early exit (context switch, superseded navigation,
                // rejection) used to skip the timer and leave the target
                // highlighted forever.
                if (!preserveFocus) {
                    window.setTimeout(() => {
                        if (token === navToken && messageContextsEqual(context, messageContext)) {
                            focusIndex = undefined;
                        }
                    }, 500);
                }
            }
        });
    }

    async function scrollToMessageIndexInternal(
        token: number,
        context: MessageContext,
        index: number,
        preserveFocus: boolean,
        filling: boolean = false,
        hasLookedUpEvent: boolean = false,
    ): Promise<void> {
        // it is possible for the chat to change while this function is recursing so double check.
        // Every early exit logs: three separate debugging sessions were burned
        // on navigations that died silently between two log lines.
        if (token !== navToken) {
            vclDebug.log("scroll-to-msg-exit", { index, why: "superseded", token, navToken });
            return Promise.resolve();
        }
        if (!messageContextsEqual(context, messageContext)) {
            vclDebug.log("scroll-to-msg-exit", { index, why: "context-changed" });
            return Promise.resolve();
        }

        if (index < 0) {
            focusIndex = undefined;
            return Promise.resolve();
        }

        scrollingToMessage = true;
        // Anchor the rendered segment to the navigation target: if the store
        // holds the target in a range disjoint from the current one, the
        // filtered timeline must switch segments for the lookup below to see
        // it. Only anchor once the target is actually loaded — re-anchoring
        // to an unloaded index would flip the timeline to the newest segment
        // and flash unrelated content for the duration of the window load.
        // (After the window load, the recursive call lands here again with
        // the target present.)
        if (
            allItems.some(
                (it) =>
                    it.kind === "event" &&
                    it.event.event.kind === "message" &&
                    it.event.event.messageIndex === index,
            )
        ) {
            anchorMessageIndex = index;
        }

        let flatIndex = messageIndexToFlat.get(index);
        vclDebug.log("scroll-to-msg", {
            index,
            flatIndex,
            filling,
            hasLookedUpEvent,
        });
        if (flatIndex !== undefined) {
            focusIndex = index;
            // Delegate positioning to the virtual list: it positions on estimated
            // heights immediately and fires debounced corrective re-scrolls as
            // real measurements arrive.
            if (virtualList === undefined) {
                vclDebug.log("scroll-to-msg-exit", { index, why: "no-virtual-list" });
            }
            virtualList?.scrollToIndex(flatIndex, "instant");
            await tick();
            if (!messageContextsEqual(context, messageContext)) {
                vclDebug.log("scroll-to-msg-exit", { index, why: "context-changed-post-tick" });
                return Promise.resolve();
            }
            if (!filling) {
                // if we are not filling in extra events around the target then check if we need to open a thread
                checkIfTargetMessageHasAThread(index);
            }
            if (await loadMoreIfRequired(false, true)) {
                return scrollToMessageIndexInternal(
                    token,
                    context,
                    index,
                    preserveFocus,
                    true,
                    hasLookedUpEvent,
                );
            } else {
                scrollingToMessage = false;
                return Promise.resolve();
            }
        } else if (destroyed) {
            // The chat is hidden behind a covering panel (which marks the
            // list destroyed to emulate the old unmount semantics). A
            // navigation arriving in this state is usually the very act of
            // returning to the chat — on single-column layouts the pinned
            // panel's tap updates the route several ms before the panel
            // finishes closing — so defer it until the list is visible again
            // instead of swallowing it.
            vclDebug.log("scroll-to-msg-deferred", { index });
            pendingHiddenNav = { context, index, preserveFocus };
        } else if (!destroyed) {
            // check whether we have already loaded the event we are looking
            // for (only the anchored segment counts — a hit in a disjoint
            // island is filtered out above, so we want the window load)
            const loaded = findMessageEvent(index);
            if (loaded === undefined) {
                if (!hasLookedUpEvent) {
                    // we must only recurse if we have not already loaded the event, otherwise we will enter an infinite loop.
                    // Suppress scroll handling across the store swap: the content
                    // momentarily shrinks while the old events are cleared, and the
                    // browser clamps scrollTop towards zero — without the interrupt
                    // that stray scroll event slides the virtual window to the
                    // bottom and queues a pile of bogus corrections before the
                    // navigation has even positioned itself.
                    interrupt = true;
                    try {
                        const loadedIdx = await client.loadEventWindow(
                            context.chatId,
                            index,
                            threadRootEvent,
                        );
                        vclDebug.log("scroll-to-msg-window", { index, loadedIdx });
                        await tick();
                    } finally {
                        await interruptScroll();
                    }
                    return scrollToMessageIndexInternal(
                        token,
                        context,
                        index,
                        preserveFocus,
                        filling,
                        true,
                    );
                }
                vclDebug.log("scroll-to-msg-exit", { index, why: "not-found-after-window-load" });
                scrollingToMessage = false;
                // A failed event-window load clears the event store before it
                // fails, which would otherwise leave the user staring at an
                // empty list. Fall back to an initial load of the latest
                // messages so there is always something on screen.
                if (items.length === 0 && messageContextsEqual(context, messageContext)) {
                    vclDebug.log("!blank-recovery", { index });
                    await client.loadPreviousMessages(chat.id, threadRootEvent, true);
                }
            } else {
                // the event is loaded but does not appear in the flat items (e.g. it
                // is hidden or filtered out) so we cannot scroll to it. Try the next
                // message, or failing that, the bottom.
                const next = messageIndexToFlat.get(index + 1);
                if (next !== undefined) {
                    return scrollToMessageIndexInternal(
                        token,
                        context,
                        index + 1,
                        preserveFocus,
                        filling,
                    );
                }
                scrollingToMessage = false;
                return scrollBottom();
            }
        }
    }

    export async function onMessageWindowLoaded({
        context,
        messageIndex,
        initialLoad,
    }: {
        context: MessageContext;
        messageIndex: number | undefined;
        initialLoad: boolean;
    }) {
        if (messageIndex === undefined || initialLoad === false) return;
        await tick();
        if (!messageContextsEqual(context, messageContext)) return;
        initialised = true;
        await scrollToMessageIndex(context, messageIndex, false);
    }

    async function onLoadedPreviousMessages({
        context,
        initialLoad,
    }: {
        context: MessageContext;
        initialLoad: boolean;
    }) {
        if (!messageContextsEqual(context, messageContext)) return;
        await resetScroll(initialLoad);
        if (!messageContextsEqual(context, messageContext)) return;

        // It is possible the when we load previous messages, because of the filtering applied, we might not
        // have enough events. To cover that case we will check if we need to load some more.
        loadMoreIfRequired();
    }

    async function onLoadedNewMessages(context: MessageContext) {
        if (!messageContextsEqual(context, messageContext)) return;

        if (
            !loadingFromUserScroll &&
            !client.moreNewMessagesAvailable(chat.id, threadRootEvent) &&
            insideBottomThreshold()
        ) {
            // only scroll if we are now within threshold from the bottom
            scrollBottom("smooth");
        }
    }

    // Set overflow-y: hidden on the viewport for one frame. This immediately
    // halts any momentum scrolling on iOS (preventing the screen going black)
    // and gates the scroll handler while we programmatically write scrollTop.
    // If restoreScrollTop is given, it is applied inside the rAF — after any
    // async browser scroll adjustment has fired — before revealing the viewport.
    function interruptScroll(restoreScrollTop?: number): Promise<void> {
        interrupt = true;
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                const el = messagesDiv;
                if (el && restoreScrollTop !== undefined && el.scrollTop !== restoreScrollTop) {
                    vclDebug.log("interrupt-restore", {
                        from: Math.round(el.scrollTop),
                        to: Math.round(restoreScrollTop),
                    });
                    virtualList?.markProgrammaticScroll();
                    el.scrollTop = restoreScrollTop;
                }
                interrupt = false;
                resolve();
            });
        });
    }

    function onUserScroll(genuine: boolean) {
        // Only release the bottom pin when the user genuinely scrolls away from
        // the bottom — scroll events from our own smooth scrollBottom animation
        // arrive later than the programmatic-write detection window and must
        // not cancel the user's go-to-latest intent.
        if (genuine && pinToBottom && fromBottom > 200) {
            pinToBottom = false;
        }
        trackScrollStop(SCROLL_THRESHOLD);
        if (maintainScroll) {
            eventListScrollTop.set(fromBottom);
        }
        updateShowGoToBottom();
        updateShowGoToTop();
        portalState.close();
        eventListLastScrolled.set(Date.now());

        if (
            !initialised ||
            interrupt ||
            loadingFromUserScroll ||
            scrollingToMessage ||
            !visible
        )
            return;

        loadMoreIfRequired(true);
    }

    // A touchstart is an unambiguous user gesture (scroll events may be our
    // own writes) — release the go-to-latest pin immediately. Without this,
    // on iOS in a busy chat the pin's catch-up loads keep snapping the
    // viewport to the bottom faster than the genuine-scroll release (200px of
    // drag) can trigger, trapping the user at the latest message.
    function onUserTouch() {
        pinToBottom = false;
    }

    async function loadIndexThenScrollToBottom(context: MessageContext, messageIndex: number) {
        await scrollToMessageIndex(context, messageIndex, false);
        if (messageContextsEqual(context, messageContext)) {
            await scrollBottom();
            // Release the go-to-latest pin once it has completed with nothing
            // left to catch up on; it must not linger and snap a later load.
            if (!client.moreNewMessagesAvailable(chat.id, threadRootEvent)) {
                pinToBottom = false;
            }
        }
    }

    function scrollToTop() {
        scrollToMessageIndex(messageContext, 0, false);
    }

    function scrollToLast() {
        pinToBottom = true;
        if (threadSummary !== undefined) {
            loadIndexThenScrollToBottom(messageContext, threadSummary.numberOfReplies - 1);
        } else {
            loadIndexThenScrollToBottom(
                messageContext,
                chat.latestMessage?.event.messageIndex ?? -1,
            );
        }
    }

    let scrollTimeout: number | undefined = undefined;
    function trackScrollStop(delay: number) {
        eventListScrolling.set(true);
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            eventListScrolling.set(false);
            requireScrollStop = false;
            // After scroll stops, re-check thresholds in case we're still inside one.
            // This handles the case where a load completed but momentum kept scrolling
            // (blocking further loads), and the user is now stationary near a threshold.
            loadMoreIfRequired(false);
        }, delay);
    }
</script>

<VirtualChatList
    bind:this={virtualList}
    {items}
    {interrupt}
    bind:fromBottom
    bind:viewport={messagesDiv}
    bind:viewportHeight={messagesDivHeight}
    id={`scrollable-list-${rootSelector}`}
    viewportClass={`scrollable-list ${rootSelector} ${viewportClass ?? ""}`}
    {onUserScroll}
    {onUserTouch}
    {isDateMarker}
    {timestampFor}
    {stickyDateElTop}
    bind:stickyDateTimestamp
    row={renderRow} />

{#snippet renderRow(item: FlatChatItem, _absIdx: number)}
    {@render row(item, {
        isAccepted,
        isConfirmed,
        isFailed,
        isReadByMe,
        messageObserver,
        focusIndex,
    })}
{/snippet}

{@render fabs?.({
    showGoToTop,
    showGoToBottom,
    loadingFromUserScroll,
    scrollToTop,
    scrollToLast,
    scrollToMention,
})}
