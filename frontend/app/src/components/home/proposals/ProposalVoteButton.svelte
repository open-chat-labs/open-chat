<script lang="ts">
    import { _ } from "svelte-i18n";
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";
    import { iconSize } from "../../../stores/iconSize";

    export let mode: "yes" | "no";
    export let percentage: number;
    export let disabled: boolean;
    export let voting: boolean;
    export let voted: boolean;

    $: label = mode === "yes" ? $_("proposal.adopt") : $_("proposal.reject");
    $: iconColor = disabled && !voted ? "var(--vote-maybe-color)" : "var(--txt)";
    $: title = voted
        ? mode === "yes"
            ? $_("proposal.youVotedAdopt")
            : $_("proposal.youVotedReject")
        : "";
</script>

<div class="vote-button" {title}>
    <div class="label">{label}</div>
    <div on:click class:voting class:voted class:disabled class={`icon ${mode}`}>
        {#if !voting}
            {#if mode === "yes"}
                <ThumbUp size={$iconSize} color={iconColor} />
            {:else}
                <ThumbDown size={$iconSize} color={iconColor} />
            {/if}
        {/if}
    </div>
    <div class={`percentage ${mode}`}>{percentage}%</div>
</div>

<style lang="scss">
    .vote-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .icon {
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 45px;
        height: 45px;
        cursor: pointer;
        border: solid 1px transparent;
        background-color: var(--vote-maybe-color);
        transition: background-color 250ms ease-in-out;

        &.voted.yes,
        &.voting.yes {
            background-color: var(--vote-yes-color);
        }

        &.voted.no,
        &.voting.no {
            background-color: var(--vote-no-color);
        }

        &.yes:not(.voted):not(.voting):not(.disabled):hover {
            background-color: var(--vote-yes-color);
        }

        &.no:not(.voted):not(.voting):not(.disabled):hover {
            background-color: var(--vote-no-color);
        }

        &.disabled {
            background-color: transparent;
            cursor: not-allowed;

            &:not(.voted):not(.voting) {
                border: 1px solid var(--vote-maybe-color);
            }
        }

        &.voting {
            @include loading-spinner(
                1.2em,
                0.6em,
                var(--button-spinner),
                "/assets/plain-spinner.svg"
            );
        }
    }

    .percentage {
        &.yes {
            color: var(--vote-yes-color);
        }
        &.no {
            color: var(--vote-no-color);
        }
    }
</style>
