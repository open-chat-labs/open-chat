<script lang="ts">
    import { i18nKey, type BotMatch, type OpenChat } from "openchat-client";
    import Search from "../Search.svelte";
    import { getContext, type Snippet } from "svelte";
    import { botSearchState } from "../../stores/search.svelte";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 50;

    interface Props {
        botMatch: Snippet<[BotMatch]>;
    }

    let { botMatch }: Props = $props();

    let initialised = $state(false);
    let searching = $state(false);
    let more = $derived(botSearchState.total > botSearchState.results.length);

    function onSearchEntered(reset = false) {
        searching = true;
        if (reset) {
            botSearchState.reset();
        } else {
            botSearchState.nextPage();
        }
        console.log("Search entered: ", botSearchState.term);
        client
            .exploreBots(
                botSearchState.term === "" ? undefined : botSearchState.term,
                botSearchState.index,
                PAGE_SIZE,
            )
            .then((results) => {
                console.log("Results: ", results);
                if (results.kind === "success") {
                    if (reset) {
                        botSearchState.results = results.matches;
                    } else {
                        botSearchState.appendResults(results.matches);
                    }
                    botSearchState.total = results.total;
                }
            })
            .finally(() => (searching = false));
    }

    $effect(() => {
        if (!initialised) {
            onSearchEntered(true);
            initialised = true;
        }
    });
</script>

<Search
    on:searchEntered={() => onSearchEntered(true)}
    searching={false}
    bind:searchTerm={botSearchState.term}
    placeholder={i18nKey("search")} />

{#if more}
    <div class="more">
        <Button disabled={searching} loading={searching} on:click={() => onSearchEntered(false)}
            ><Translatable resourceKey={i18nKey("bots.explorer.loadMore")} /></Button>
    </div>
{/if}

{#each botSearchState.results as match}
    {@render botMatch(match)}
{/each}

<style lang="scss"></style>
