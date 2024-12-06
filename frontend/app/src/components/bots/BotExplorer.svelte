<script lang="ts">
    import { i18nKey, type OpenChat } from "openchat-client";
    import Search from "../Search.svelte";
    import { getContext } from "svelte";
    import { botSearchStore } from "../../stores/search";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import BotMatch from "./BotMatch.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 50;

    let initialised = $state(false);
    let searching = $state(false);
    let more = $derived($botSearchStore.total > $botSearchStore.results.length);

    function onSearchEntered(reset = false) {
        searching = true;
        if (reset) {
            botSearchStore.reset();
        } else {
            botSearchStore.nextPage();
        }
        console.log("Search entered: ", $botSearchStore.term);
        client
            .exploreBots($botSearchStore.term, $botSearchStore.index, PAGE_SIZE)
            .then((results) => {
                console.log("Results: ", results);
                if (results.kind === "success") {
                    if (reset) {
                        botSearchStore.setResults(results.matches);
                    } else {
                        botSearchStore.appendResults(results.matches);
                    }
                    botSearchStore.setTotal(results.total);
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
    bind:searchTerm={$botSearchStore.term}
    placeholder={i18nKey("search")} />

{#if more}
    <div class="more">
        <Button disabled={searching} loading={searching} on:click={() => onSearchEntered(false)}
            ><Translatable resourceKey={i18nKey("bots.explorer.loadMore")} /></Button>
    </div>
{/if}

{#each $botSearchStore.results as match}
    <BotMatch {match} />
{/each}

<style lang="scss"></style>
