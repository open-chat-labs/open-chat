<!-- A native screen (screens.ts): loaded the first time it shows (a spinner meanwhile), an error with
     a retry if it doesn't load, or a placeholder for a kind whose screen isn't built yet. -->
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
    import { screenLoader, type ScreenContext } from "./screens";

    type Props = {
        step: StackStep;
        /** A tab's root, with its translated title. */
        root: { title: string } | undefined;
        context: ScreenContext;
    };

    let { step, root, context }: Props = $props();

    const load = $derived(screenLoader(step.screen));

    // A placeholder's links to the screens over it, so the stacks can be walked before the
    // screens are built. Development only.
    type Link = { label: string; url: string };
    const links = $derived<Link[]>(load === undefined ? placeholderLinks(step.screen) : []);

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
    {#if load}
        {#await load()}
            <div class="state"><Spinner /></div>
        {:then module}
            {@const Screen = module.default}
            <Screen screen={step.screen} {context} />
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
</style>
