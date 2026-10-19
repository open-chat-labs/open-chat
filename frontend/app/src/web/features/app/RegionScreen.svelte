<!-- A region's screen (screens.ts): loaded the first time it shows (a spinner meanwhile) and kept, an
     error with a retry if it doesn't load, or a placeholder for a kind whose screen isn't built yet. -->
<script lang="ts" generics="R extends { kind: string }">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { untrack, type Component, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Placeholder from "./Placeholder.svelte";
    import {
        regionSummary,
        screenLoader,
        type ScreenContext,
        type ScreenProps,
        type Screens,
    } from "./screens";

    type Props = {
        region: R;
        screens: Screens<R>;
        context: ScreenContext;
        /** Which column, so placeholders can be told apart (both can be "wallet"). */
        column: "left" | "middle";
        /** Shown over a placeholder: the buttons its screen will have (Back, the panel toggle). */
        toolbar?: Snippet;
    };

    let { region, screens, context, column, toolbar }: Props = $props();

    type Loaded = { default: Component<ScreenProps<R>> };
    const load = $derived(
        screens[region.kind as R["kind"]] as (() => Promise<Loaded>) | undefined,
    );
    const loader = $derived(load && screenLoader(load));

    $effect(() => {
        const wanted = loader;
        untrack(() => wanted?.want());
    });
</script>

<!-- a new kind is a new screen: the old one goes before the new region reaches it -->
{#key region.kind}
    {#if loader}
        {#if loader.module}
            <loader.module.default {region} {context} />
        {:else if loader.failed}
            <!-- the chunk didn't load (a flaky network, or a deploy since the page loaded). The
                 browser keeps a failed import failed for the page's lifetime (importing it again
                 doesn't fetch it), so the retry reloads the page -->
            <div class="state">
                <EmptyState
                    preset="error"
                    title={$_("unexpectedError")}
                    body={$_("regionLoadFailed")}
                    actionLabel="ui.common.retry"
                    actionHandler={() => location.reload()} />
            </div>
        {:else}
            <div class="state"><Spinner /></div>
        {/if}
    {:else}
        <div class="placeholder">
            {@render toolbar?.()}
            <Placeholder title="{column}: {region.kind}" detail={regionSummary(region)} />
        </div>
    {/if}
{/key}

<style>
    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }

    .placeholder {
        position: relative;
        height: 100%;
    }
</style>
