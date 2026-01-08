<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import { Search } from "component-lib";
    import {
        i18nKey,
        type BotInstallationLocation,
        type BotMatch as BotMatchType,
        type ExternalBotLike,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { botSearchState } from "../../stores/search.svelte";
    import BotProperties from "./install/BotProperties.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 50;

    interface Props {
        location?: BotInstallationLocation;
        onSelect: (match: ExternalBotLike | undefined) => void;
        fill?: boolean;
        maxHeight?: string;
        installingBot?: BotMatchType | undefined;
        excludeInstalled?: boolean;
    }

    let { location, onSelect, maxHeight, installingBot, excludeInstalled }: Props = $props();

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
                location,
                excludeInstalled ?? false,
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

    onMount(() => onSearchEntered(true));
</script>

<Search
    onSearch={() => onSearchEntered(true)}
    onClear={() => (botSearchState.term = "")}
    searching={false}
    bind:value={botSearchState.term}
    placeholder={interpolate($_, i18nKey("search"))} />

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
