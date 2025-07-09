<script lang="ts">
    import { type BotMatch as BotMatchType, type ExternalBotLike } from "openchat-client";
    import { botSearchState } from "../../stores/search.svelte";
    import BotProperties from "./install/BotProperties.svelte";

    interface Props {
        onSelect: (match: ExternalBotLike | undefined) => void;
        installingBot?: BotMatchType | undefined;
    }

    let { onSelect, installingBot }: Props = $props();
</script>

<div class="matches">
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
