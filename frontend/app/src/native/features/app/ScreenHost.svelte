<!-- A native screen (screens.ts): at once when its chunk is in (the shell preloads them, and waits
     for a screen's before it goes there: screenModules), else once it is, with nothing in the middle
     of the screen meanwhile but a small spinner if it takes long; an error with a retry if it
     doesn't load, or a placeholder for a kind whose screen isn't built yet. -->
<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import {
        allUsersStore,
        chatSummariesListStore,
        communitiesStore,
        routeForChatIdentifier,
        sortedCommunitiesStore,
    } from "@client";
    import { _ } from "svelte-i18n";
    import type { NativeScreen, StackStep } from "../../router/locations";
    import Placeholder from "./Placeholder.svelte";
    import { screenModules, type ScreenContext } from "./screens";

    type Props = {
        step: StackStep;
        /** A tab's root, with its translated title. */
        root: { title: string } | undefined;
        context: ScreenContext;
    };

    let { step, root, context }: Props = $props();

    const built = $derived(screenModules.has(step.screen.kind));
    // its chunk, when it's in by the time the screen shows
    const Ready = $derived(screenModules.loaded(step.screen.kind));

    // A placeholder's links to the screens over it, so the stacks can be walked before the
    // screens are built. Development only.
    type Link = { label: string; url: string };
    const links = $derived<Link[]>(built ? [] : placeholderLinks(step.screen));

    function placeholderLinks(screen: NativeScreen): Link[] {
        switch (screen.kind) {
            case "chats":
                return [
                    ...$chatSummariesListStore.slice(0, 8).map((chat) => ({
                        label:
                            chat.kind === "direct_chat"
                                ? `@${$allUsersStore.get(chat.them.userId)?.username ?? chat.them.userId}`
                                : chat.name,
                        url: routeForChatIdentifier(screen.scope.kind, chat.id),
                    })),
                    { label: "Followed threads", url: "/chats?threads" },
                ];
            case "communities": {
                const community = $communitiesStore.get(screen.communityId);
                const others = $sortedCommunitiesStore.filter(
                    (c) => c.id.communityId !== screen.communityId.communityId,
                );
                return [
                    ...(community?.channels ?? []).slice(0, 6).map((channel) => ({
                        label: `#${channel.name}`,
                        url: routeForChatIdentifier("community", channel.id),
                    })),
                    { label: "Explore", url: "/communities" },
                    ...others.slice(0, 4).map((c) => ({
                        label: `Switch to ${c.name}`,
                        url: `/community/${c.id.communityId}`,
                    })),
                ];
            }
            case "wallet":
                return [
                    { label: "Send", url: "/wallet/send" },
                    { label: "Receive", url: "/wallet/receive" },
                    { label: "Swap", url: "/wallet/swap" },
                    { label: "Recipients", url: "/wallet/recipients" },
                ];
            default:
                return [];
        }
    }
</script>

<!-- another screen (another kind, another community's root) is a new instance: the old one goes,
     state and scroll included, before the new step reaches it -->
{#key step.key}
    {#if Ready !== undefined}
        <Ready screen={step.screen} {context} />
    {:else if built}
        {#await screenModules.load(step.screen.kind)}
            <div class="state waiting"><Spinner /></div>
        {:then Screen}
            {#if Screen !== undefined}
                <Screen screen={step.screen} {context} />
            {/if}
        {:catch}
            <!-- the chunk didn't load (a flaky network, or a deploy since the page loaded). The
                 browser keeps a failed import failed for the page's lifetime, so the retry reloads -->
            <div class="state">
                <EmptyState
                    preset="error"
                    title={$_("unexpectedError")}
                    body={$_("regionLoadFailed")}
                    actionLabel="ui.common.retry"
                    actionHandler={() => location.reload()} />
            </div>
        {/await}
    {:else}
        <Placeholder
            title={root?.title ?? step.screen.kind}
            detail={step.url}
            root={root !== undefined}
            back={context.back}
            {links} />
    {/if}
{/key}

<style lang="scss">
    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }

    // a chunk that takes long (a slow network): a spinner only after a while, never a flash of one
    .waiting {
        animation: oc-veil-in 200ms 1.2s both;

        @media (prefers-reduced-motion: reduce) {
            animation-duration: 1ms;
        }
    }
</style>
