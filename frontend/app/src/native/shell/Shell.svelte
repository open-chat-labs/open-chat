<!-- The native shell (native design notes §1 Structure): five tabs, each with its own push stack.
     The URL names the screen showing (router/locations.ts); each tab keeps its stack (TabStacks), so
     it comes back as it was left. Screens sit over the tab bar, which hides inside a conversation
     (hidesTabBar). A pushed screen slides in from the inline end while the one under it moves out to
     the other side (.34s, motion.ts), and Back reverses it. Android's system back closes an open
     sheet or menu first, then pops (back.ts). -->
<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
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
    import {
        hidesTabBar,
        locationFor,
        NATIVE_TABS,
        tabRootUrl,
        type NativeLocation,
        type NativeTabId,
    } from "../router/locations";
    import { backAction } from "./back";
    import { popOut, pushIn } from "./motion";
    import { Overlays } from "./overlays.svelte";
    import { tabBarTabs } from "./tabBar.adapter";
    import { TabStacks } from "./tabStacks.svelte";
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

    const location: NativeLocation = $derived(
        locationFor($routeStore, url, {
            signedOut: $anonUserStore,
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
    const barShown = $derived(!stacks.steps.some((step) => hidesTabBar(step.screen)));

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
    const tabIds = $derived(NATIVE_TABS.filter((id) => tabs.some((t) => t.id === id)));
    const tabIndex = $derived(Math.max(0, tabIds.indexOf(stacks.tab)));

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
            steps: stacks.steps,
            chatsUrl: stacks.topUrl("chats") ?? tabRootUrl("chats", undefined),
        });
        switch (action.kind) {
            case "close_overlay":
                overlays.closeTop();
                break;
            case "navigate":
                navigate(action.url, "dismiss");
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

{#if location.area === "tabs"}
    <div class="shell" class:bar-hidden={!barShown}>
        <div class="stage">
            <div class="root" class:covered={pushed.length > 0} inert={pushed.length > 0}>
                <div class="track" style:--tab-index={tabIndex}>
                    {#each tabIds as tab (tab)}
                        {@const root = stacks.root(tab)}
                        <section class="pane" inert={tab !== stacks.tab}>
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
{:else}
    <!-- outside the tabs: the marketing pages and the signed-out start (N4), and not found -->
    <div class="outside">
        <EmptyState
            preset="no-results"
            title={location.area === "marketing" ? location.route.kind : "not_found"}
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

    // a tab's root: covered by a pushed screen, moved out to the other side
    .root {
        position: absolute;
        inset: 0;
        overflow: hidden;
        transition: transform 0.34s var(--ease-out);

        &.covered {
            transform: translateX(-28%);

            :global([dir="rtl"]) & {
                transform: translateX(28%);
            }
        }
    }

    // the tabs' roots side by side, the one showing in view
    .track {
        display: flex;
        height: 100%;
        transform: translateX(calc(var(--tab-index) * -100%));
        transition: transform 0.32s var(--ease-out);

        :global([dir="rtl"]) & {
            transform: translateX(calc(var(--tab-index) * 100%));
        }
    }

    .pane {
        flex: none;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
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
        .track,
        .pushed {
            transition: none;
        }
    }
</style>
