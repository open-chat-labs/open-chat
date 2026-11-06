<!-- The native shell (native design notes §1 Structure): five tabs, each with its own push stack.
     The URL names the screen showing (router/locations.ts); each tab keeps its stack (TabStacks), so
     it comes back as it was left. The tab bar shows only on a tab's root; a pushed screen has the
     whole window (showsTabBar). A pushed screen slides in from the inline end while the one under it moves out to
     the other side (.34s, motion.ts), and Back reverses it. Android's system back closes an open
     sheet or menu first, then pops (back.ts). On a tab's root, a sideways drag swipes to the
     neighbouring tab (tabSwipe.ts); switching tabs slides only the two screens, old and new.
     Signed out, it's the signed-out start instead (features/start), whatever the URL; the
     marketing pages are the web tree's, outside the tabs. -->
<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import TabBar from "@openchat/ui/src/native/TabBar.svelte";
    import { disableWalletFeature } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { expectBackPress } from "@utils/native/notification_channels";
    import {
        allUsersStore,
        anonUserStore,
        communitiesStore,
        currentUserIdStore,
        defaultCommunity,
        identityStateStore,
        lastSelectedCommunityIdStore,
        messageActivitySummaryStore,
        OpenChat,
        pathContextStore,
        routeStore,
        sortedCommunitiesStore,
        unreadDirectAndGroupCountsStore,
        type CommunityIdentifier,
    } from "@client";
    import type { PluginListener } from "@tauri-apps/api/core";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { minimizeApp } from "tauri-plugin-oc-api";
    import ScreenHost from "../features/app/ScreenHost.svelte";
    import type { ScreenContext } from "../features/app/screens";
    import { StartStack, startEntry, startStepFor } from "../features/start/startStack.svelte";
    import {
        showsTabBar,
        locationFor,
        NATIVE_TABS,
        tabRootUrl,
        type NativeLocation,
        type NativeTabId,
    } from "../router/locations";
    import { releaseVelocity, type DragSample } from "@openchat/ui/src/native/sheetDrag";
    import { backAction } from "./back";
    import { popOut, pushIn } from "./motion";
    import { Overlays } from "./overlays.svelte";
    import { tabBarTabs } from "./tabBar.adapter";
    import { TabStacks } from "./tabStacks.svelte";
    import {
        startsSwipe,
        swipeAxis,
        swipeOffset,
        swipeRelease,
        swipeStep,
        tabSlide,
        type SwipeAxis,
    } from "./tabSwipe";
    import Toasts from "./Toasts.svelte";

    const client = getContext<OpenChat>("client");

    const stacks = new TabStacks();
    const overlays = new Overlays();

    // The Communities tab's community when a URL doesn't name one (Explore): the one the tab shows,
    // else the default (the last selected, else the first)
    const defaultCommunityId = $derived(
        defaultCommunity(
            $lastSelectedCommunityIdStore,
            (id) => $communitiesStore.get(id),
            $sortedCommunitiesStore,
        )?.id,
    );

    function communityShown(): CommunityIdentifier | undefined {
        const root = stacks.root("communities")?.screen;
        return root?.kind === "communities" ? root.communityId : undefined;
    }

    const url = $derived(
        $pathContextStore?.path ?? `${window.location.pathname}${window.location.search}`,
    );

    // Signed out, the signed-out start shows (features/start): from someone signed out until
    // there's a user, a sign-in or sign-up started there included; a spinner while a session from
    // before loads. It starts again each time it shows (after a sign-out, at Welcome; for an
    // identity without an account, at Pick a username).
    const start = new StartStack();
    let onStart = $state(false);
    const entry = $derived(startEntry($identityStateStore, $anonUserStore, onStart));
    $effect(() => {
        const now = entry;
        untrack(() => {
            if (now === "start" && !onStart) start.reset(startStepFor($identityStateStore));
            if (now !== "loading") onStart = now === "start";
        });
    });

    const location: NativeLocation = $derived(
        locationFor($routeStore, url, {
            signedOut: entry !== "app",
            // what the tab shows is the stacks' own state, not something to recompute on
            community: untrack(communityShown) ?? defaultCommunityId,
        }),
    );

    $effect(() => {
        const at = location;
        if (at.area === "tabs") untrack(() => stacks.arrive(at));
    });

    const pushed = $derived(stacks.steps.slice(1));
    // the tab bar stays under pushed screens, but not inside a conversation
    const barShown = $derived(showsTabBar(stacks.steps));

    const labels: Record<NativeTabId, string> = $derived({
        chats: $_("native.tabs.chats"),
        communities: $_("native.tabs.communities"),
        wallet: $_("native.tabs.wallet"),
        activity: $_("native.tabs.activity"),
        you: $_("native.tabs.you"),
    });

    const user = $derived($allUsersStore.get($currentUserIdStore));
    const tabs = $derived(
        tabBarTabs({
            labels,
            chatsUnread: $unreadDirectAndGroupCountsStore.chats.unmuted,
            activityUnread: $messageActivitySummaryStore.unreadCount > 0,
            photoUrl: user?.blobUrl,
            wallet: !disableWalletFeature,
        }),
    );
    const tabIds = $derived(tabs.map((t) => t.id));
    const tabIndex = $derived(Math.max(0, tabIds.indexOf(stacks.tab)));

    // ---- Switching tabs: only the old screen and the new one move (tabSlide), whichever tabs lie
    // between them in the bar. The design says nothing about it (its prototype slides the whole row
    // of tabs past), so this is ours. After a swipe, the screens carry on from where the drag left
    // them (`handoff`).

    const SLIDE_MS = 320;
    const panes: Partial<Record<NativeTabId, HTMLElement>> = $state({});
    let handoff: { from: NativeTabId; to: NativeTabId; fromX: number; toX: number } | undefined;
    let shownTab: NativeTabId = untrack(() => stacks.tab);

    $effect(() => {
        const tab = stacks.tab;
        untrack(() => {
            if (tab !== shownTab) slideTabs(shownTab, tab);
            shownTab = tab;
            handoff = undefined;
        });
    });

    function reducedMotion(): boolean {
        return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    }

    function rtl(): boolean {
        return document.documentElement.dir === "rtl";
    }

    function ease(): string {
        return getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
    }

    function slideTabs(from: NativeTabId, to: NativeTabId) {
        const outgoing = panes[from];
        const incoming = panes[to];
        if (outgoing === undefined || incoming === undefined || reducedMotion()) return;
        const width = incoming.clientWidth;
        let start: { outgoing: [string, string]; incoming: string; duration: number };
        if (handoff?.from === from && handoff.to === to && width > 0) {
            // carry on from the drag: both move the rest of the way together
            start = {
                outgoing: [`${handoff.fromX}px`, `${handoff.fromX - handoff.toX}px`],
                incoming: `${handoff.toX}px`,
                duration: Math.max(120, SLIDE_MS * (Math.abs(handoff.toX) / width)),
            };
        } else {
            const slide = tabSlide(tabIds.indexOf(from), tabIds.indexOf(to), rtl());
            start = {
                outgoing: ["0%", `${slide.outgoingTo * 100}%`],
                incoming: `${slide.incomingFrom * 100}%`,
                duration: SLIDE_MS,
            };
        }
        const options = { duration: start.duration, easing: ease() };
        incoming.animate(
            [{ transform: `translateX(${start.incoming})` }, { transform: "translateX(0)" }],
            options,
        );
        // the old screen is hidden once the new one shows: it stays visible while it goes
        outgoing.animate(
            [
                { transform: `translateX(${start.outgoing[0]})`, visibility: "visible" },
                { transform: `translateX(${start.outgoing[1]})`, visibility: "visible" },
            ],
            options,
        );
    }

    // ---- Swiping between tabs on a tab's root (tabSwipe.ts). Touch and pen only: a mouse drag
    // selects text. A drag that starts mostly vertical is the content's scroll, and one starting in
    // something that scrolls sideways itself, an input or [data-tab-swipe="off"] is left to it.

    type Gesture = {
        pointerId: number;
        x0: number;
        y0: number;
        width: number;
        axis: SwipeAxis;
        samples: DragSample[];
    };
    let gesture: Gesture | undefined;
    // the drag showing: the root's screen `offset` px across, and the neighbouring tab's beside it
    let drag = $state<{ offset: number; neighbour: NativeTabId | undefined } | undefined>();
    // a sideways drag ends on a click, which isn't one
    let swallowClick = false;

    function leftToContent(target: EventTarget | null, root: HTMLElement): boolean {
        for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
            if (el instanceof HTMLElement) {
                if (el.dataset.tabSwipe === "off" || el.isContentEditable) return true;
                if (el.matches("input, textarea, select")) return true;
                const overflow = getComputedStyle(el).overflowX;
                if ((overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth) {
                    return true;
                }
            }
        }
        return false;
    }

    function onPointerDown(e: PointerEvent & { currentTarget: HTMLElement }) {
        if (e.pointerType === "mouse" || !e.isPrimary || pushed.length > 0) return;
        const root = e.currentTarget.getBoundingClientRect();
        if (!startsSwipe(e.clientX - root.left, root.width)) return;
        if (leftToContent(e.target, e.currentTarget)) return;
        gesture = {
            pointerId: e.pointerId,
            x0: e.clientX,
            y0: e.clientY,
            width: root.width,
            axis: "undecided",
            samples: [{ t: e.timeStamp, y: e.clientX }],
        };
    }

    function onPointerMove(e: PointerEvent & { currentTarget: HTMLElement }) {
        if (gesture === undefined || e.pointerId !== gesture.pointerId) return;
        const dx = e.clientX - gesture.x0;
        if (gesture.axis === "undecided") {
            gesture.axis = swipeAxis(dx, e.clientY - gesture.y0);
            if (gesture.axis === "vertical") {
                gesture = undefined;
                return;
            }
            if (gesture.axis === "sideways") e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (gesture.axis !== "sideways") return;
        // the samples' y is the pointer's x: releaseVelocity reads one axis
        gesture.samples.push({ t: e.timeStamp, y: e.clientX });
        const neighbour = tabIds[tabIndex + swipeStep(dx, rtl())];
        drag = {
            offset: reducedMotion() ? 0 : swipeOffset(dx, tabIndex, tabIds.length, rtl()),
            neighbour: neighbour !== stacks.tab ? neighbour : undefined,
        };
    }

    function onPointerUp(e: PointerEvent) {
        const ended = gesture;
        if (ended === undefined || e.pointerId !== ended.pointerId) return;
        gesture = undefined;
        if (ended.axis !== "sideways") return;
        swallowClick = true;
        setTimeout(() => (swallowClick = false));
        const dx = e.clientX - ended.x0;
        const velocity = releaseVelocity(ended.samples, e.timeStamp);
        const target =
            e.type === "pointerup"
                ? swipeRelease(dx, ended.width, velocity, tabIndex, tabIds.length, rtl())
                : undefined;
        const shown = drag;
        drag = undefined;
        const to = target !== undefined ? tabIds[target] : undefined;
        if (to !== undefined) {
            const offset = shown?.offset ?? 0;
            handoff = {
                from: stacks.tab,
                to,
                fromX: offset,
                toX: offset - Math.sign(dx) * ended.width,
            };
            selectTab(to);
        } else if (shown !== undefined) {
            springBack(shown.offset, shown.neighbour, ended.width, dx);
        }
    }

    function springBack(offset: number, neighbour: NativeTabId | undefined, width: number, dx: number) {
        if (offset === 0) return;
        const options = { duration: 240, easing: ease() };
        panes[stacks.tab]?.animate(
            [{ transform: `translateX(${offset}px)` }, { transform: "translateX(0)" }],
            options,
        );
        if (neighbour !== undefined) {
            const beside = -Math.sign(dx) * width;
            panes[neighbour]?.animate(
                [
                    { transform: `translateX(${offset + beside}px)`, visibility: "visible" },
                    { transform: `translateX(${beside}px)`, visibility: "visible" },
                ],
                options,
            );
        }
    }

    function paneTransform(tab: NativeTabId): string | undefined {
        if (drag === undefined) return undefined;
        if (tab === stacks.tab) return `translateX(${drag.offset}px)`;
        if (tab === drag.neighbour) {
            const dx = drag.offset;
            return `translateX(calc(${dx}px + ${dx < 0 ? 100 : -100}%))`;
        }
        return undefined;
    }

    // Once a drag is sideways, the browser mustn't pan whatever scrolls under it (a screen's list:
    // touch-action on the root doesn't reach inside a scroller), which would cancel the pointer.
    // A touchmove listener can only stop that when it isn't passive, which Svelte's are.
    let rootEl: HTMLElement | undefined = $state();
    $effect(() => {
        const el = rootEl;
        if (el === undefined) return;
        const holdPan = (e: TouchEvent) => {
            if (gesture?.axis === "sideways" && e.cancelable) e.preventDefault();
        };
        el.addEventListener("touchmove", holdPan, { passive: false });
        return () => el.removeEventListener("touchmove", holdPan);
    });

    function onClickCapture(e: MouseEvent) {
        if (!swallowClick) return;
        swallowClick = false;
        e.stopPropagation();
        e.preventDefault();
    }

    // Tapping a tab opens it where it was left (its root the first time); tapping the tab showing
    // takes its stack back to the root
    function selectTab(id: string) {
        const tab = NATIVE_TABS.find((t) => t === id);
        if (tab === undefined) return;
        if (tab === stacks.tab && location.area === "tabs") {
            const root = stacks.root(tab);
            if (root !== undefined && stacks.steps.length > 1) navigate(root.url, "dismiss");
            return;
        }
        navigate(stacks.topUrl(tab) ?? tabRootUrl(tab, communityShown() ?? defaultCommunityId));
    }

    // The header's back: the screen under the top, going back to where it was in the history
    // when it's there (navigation.ts, "dismiss")
    function back() {
        const url = stacks.backUrl();
        if (url !== undefined) navigate(url, "dismiss");
    }

    const rootContext: ScreenContext = { back: undefined, overlays };
    const pushedContext: ScreenContext = { back, overlays };

    function systemBack() {
        const action = backAction({
            overlayOpen: overlays.any,
            location,
            backUrl: stacks.backUrl(),
            chatsUrl: stacks.topUrl("chats") ?? tabRootUrl("chats", undefined),
            startBack: start.canGoBack,
        });
        switch (action.kind) {
            case "close_overlay":
                overlays.closeTop();
                break;
            case "navigate":
                navigate(action.url, "dismiss");
                break;
            case "start_back":
                start.back();
                break;
            case "leave":
                minimizeApp().catch(console.error);
                break;
        }
    }

    onMount(() => {
        // Android's system back reaches the app as the plugin's event (MainActivity takes every
        // press); iOS has none. A browser's back is its history, which the stacks follow.
        if (!client.isNativeApp()) return;
        let listener: PluginListener | undefined;
        let mounted = true;
        void listenForBack();
        return () => {
            mounted = false;
            listener?.unregister();
        };

        async function listenForBack() {
            try {
                const registered = await expectBackPress(systemBack);
                if (mounted) listener = registered;
                else registered.unregister();
            } catch (err) {
                console.error("Couldn't listen for the system back", err);
            }
        }
    });
</script>

<!-- a chunk that didn't load (a flaky network, or a deploy since the page loaded) stays failed for
     the page's lifetime, so the retry reloads, as ScreenHost's -->
{#snippet chunkFailed()}
    <EmptyState
        preset="error"
        title={$_("unexpectedError")}
        body={$_("regionLoadFailed")}
        actionLabel="ui.common.retry"
        actionHandler={() => window.location.reload()} />
{/snippet}

{#if location.area === "tabs"}
    <div class="shell" class:bar-hidden={!barShown}>
        <div class="stage">
            <!-- the swipe is a touch shortcut for the tab bar, which keyboards and screen readers use -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="root"
                class:covered={pushed.length > 0}
                inert={pushed.length > 0}
                onpointerdown={onPointerDown}
                onpointermove={onPointerMove}
                onpointerup={onPointerUp}
                onpointercancel={onPointerUp}
                onclickcapture={onClickCapture}
                bind:this={rootEl}>
                {#each tabIds as tab (tab)}
                    {@const root = stacks.root(tab)}
                    <section
                        class="pane"
                        class:current={tab === stacks.tab}
                        class:neighbour={tab === drag?.neighbour}
                        inert={tab !== stacks.tab}
                        style:transform={paneTransform(tab)}
                        bind:this={panes[tab]}>
                        <!-- a tab's root is mounted the first time it shows, then kept -->
                        {#if root !== undefined}
                            <ScreenHost
                                step={root}
                                root={{ title: labels[tab] }}
                                context={rootContext} />
                        {/if}
                    </section>
                {/each}
            </div>

            <!-- another tab's stack shows as it was, without the push motion -->
            {#key stacks.tab}
                {#each pushed as step, i (step.key)}
                    <section
                        class="pushed"
                        class:below={i < pushed.length - 1}
                        inert={i < pushed.length - 1}
                        in:pushIn={{ play: () => stacks.change !== "pop" }}
                        out:popOut={{ play: () => stacks.change === "pop" }}>
                        <ScreenHost {step} root={undefined} context={pushedContext} />
                    </section>
                {/each}
            {/key}
        </div>

        <div class="bar" inert={!barShown}>
            <TabBar {tabs} selected={stacks.tab} onSelect={selectTab} />
        </div>

        <Toasts above={barShown ? "tabBar" : "none"} />
    </div>
{:else if location.area === "signed_out"}
    <div class="outside">
        {#if entry === "loading"}
            <Spinner />
        {:else}
            {#await import("../features/start/SignedOutStart.svelte") then { default: SignedOutStart }}
                <SignedOutStart {start} {overlays} />
            {:catch}
                {@render chunkFailed()}
            {/await}
        {/if}
        <Toasts above="none" />
    </div>
{:else if location.area === "marketing"}
    <!-- the marketing pages (Landing, Learn): the web tree's, which have no native design -->
    <div class="marketing">
        {#await import("@src/web/features/marketing/MarketingScreen.svelte") then { default: MarketingScreen }}
            <MarketingScreen route={location.route} />
        {:catch}
            <div class="outside">{@render chunkFailed()}</div>
        {/await}
    </div>
{:else}
    <!-- not found -->
    <div class="outside">
        <EmptyState
            preset="no-results"
            title="not_found"
            body={window.location.pathname}
            actionLabel="Chats"
            actionHandler={() => navigate("/chats")} />
    </div>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .shell,
    .outside {
        position: fixed;
        inset: 0;
        overflow: hidden;
        background: var(--surface-0);
        color: var(--ink);
        font-family: var(--font-sans);
    }

    .outside {
        display: grid;
        place-items: center;
    }

    // the web's marketing pages scroll the document
    .marketing {
        min-height: 100%;
    }

    // the screens, over the tab bar, or the whole window inside a conversation, where the bar
    // goes down out of the way
    .stage {
        position: absolute;
        inset: 0 0 var(--tab-bar-h);
        overflow: hidden;

        .bar-hidden & {
            inset-block-end: 0;
        }
    }

    .bar {
        position: absolute;
        inset: auto 0 0;
        transition: transform 0.34s var(--ease-out);

        .bar-hidden & {
            transform: translateY(100%);
        }
    }

    // a tab's root: covered by a pushed screen, moved out to the other side. Sideways drags are
    // ours (the swipe between tabs), up-and-down ones the content's scroll
    .root {
        position: absolute;
        inset: 0;
        overflow: hidden;
        touch-action: pan-y;
        transition: transform 0.34s var(--ease-out);

        &.covered {
            transform: translateX(-28%);

            :global([dir="rtl"]) & {
                transform: translateX(28%);
            }
        }
    }

    // the tabs' roots, one over the other: the one showing, and while a swipe drags, its neighbour
    .pane {
        position: absolute;
        inset: 0;
        overflow: hidden;
        visibility: hidden;
        background: var(--surface-0);

        &.current,
        &.neighbour {
            visibility: visible;
        }
    }

    .pushed {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--surface-0);
        box-shadow: var(--shadow-push);
        transition: transform 0.34s var(--ease-out);

        &.below {
            transform: translateX(-28%);
            box-shadow: none;

            :global([dir="rtl"]) & {
                transform: translateX(28%);
            }
        }
    }

    @include reduced-motion {
        .bar,
        .root,
        .pushed {
            transition: none;
        }
    }
</style>
