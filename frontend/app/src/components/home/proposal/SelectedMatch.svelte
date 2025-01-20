<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import type { CommunityMatch, GroupMatch } from "openchat-client";

    interface Props {
        match: CommunityMatch | GroupMatch;
        onRemove: () => void;
    }

    let { match, onRemove }: Props = $props();
</script>

<div class="selected" title={match.name}>
    <div class="name">
        {match.name}
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="close" on:click={onRemove}>
        <Close size={"1.2em"} color={"var(--button-txt)"} />
    </span>
</div>

<style lang="scss">
    .selected {
        background: var(--button-bg);
        color: var(--button-txt);
        display: inline-flex;
        padding: $sp2 $sp3;
        align-items: center;
        border-radius: var(--rd);
        gap: $sp2;
        @include box-shadow(1);

        .close {
            cursor: pointer;
            width: 20px;
            display: flex;
        }
    }
</style>
