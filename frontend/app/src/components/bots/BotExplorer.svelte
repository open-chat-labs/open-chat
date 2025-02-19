<script lang="ts">
    import {
        i18nKey,
        type BotMatch as BotMatchType,
        type ExternalBot,
        type OpenChat,
    } from "openchat-client";
    import Search from "../Search.svelte";
    import { getContext } from "svelte";
    import { botSearchState } from "../../stores/search.svelte";
    import BotProperties from "./install/BotProperties.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 50;

    interface Props {
        onSelect: (match: BotMatchType | ExternalBot | undefined) => void;
        fill?: boolean;
        maxHeight?: string;
        installingBot?: BotMatchType | undefined;
    }

    let { onSelect, fill = false, maxHeight, installingBot }: Props = $props();

    let initialised = $state(false);

    function onSearchEntered(reset = false) {
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
            });
    }

    $effect(() => {
        if (!initialised) {
            onSearchEntered(true);
            initialised = true;
        }
    });
</script>

<Search
    {fill}
    on:searchEntered={() => onSearchEntered(true)}
    searching={false}
    bind:searchTerm={botSearchState.term}
    placeholder={i18nKey("search")} />

<div class="matches" style={maxHeight ? `max-height: ${maxHeight}` : ""}>
    {#each botSearchState.results as match}
        <BotProperties
            showAvatar
            padded
            installing={match === installingBot}
            onClick={onSelect}
            bot={match} />
    {/each}
</div>

<style lang="scss">
    .matches {
        @include nice-scrollbar();
    }
</style>
