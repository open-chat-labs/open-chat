<!-- A region's screen (screens.ts), loaded the first time it shows, or a placeholder for a kind whose
     screen isn't built yet. -->
<script lang="ts" generics="R extends { kind: string }">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import type { Component, Snippet } from "svelte";
    import Placeholder from "./Placeholder.svelte";
    import { regionSummary, type ScreenContext, type ScreenProps, type Screens } from "./screens";

    type Props = {
        region: R;
        screens: Screens<R>;
        context: ScreenContext;
        /** In place of the default placeholder. */
        placeholder?: Snippet<[R]>;
    };

    let { region, screens, context, placeholder }: Props = $props();

    type Loaded = { default: Component<ScreenProps<R>> };
    const load = $derived(
        screens[region.kind as R["kind"]] as (() => Promise<Loaded>) | undefined,
    );
</script>

{#if load}
    {#await load() then screen}
        <screen.default {region} {context} />
    {:catch}
        <!-- the screen's chunk didn't load (a flaky network, or a new deploy since the page did) -->
        <div class="failed">
            <EmptyState
                preset="error"
                body=" "
                actionLabel="ui.common.retry"
                actionHandler={() => location.reload()} />
        </div>
    {/await}
{:else if placeholder}
    {@render placeholder(region)}
{:else}
    <Placeholder title={region.kind} detail={regionSummary(region)} />
{/if}

<style>
    .failed {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
