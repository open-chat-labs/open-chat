<script lang="ts">
    import { Body, Column } from "component-lib";
    import { iconSize } from "openchat-client";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        mode: "yes" | "no";
        percentage: number;
        disabled: boolean;
        voting: boolean;
        voted: boolean;
        onClick: () => void;
    }

    let { mode, percentage, disabled, voting, voted, onClick }: Props = $props();

    let label = $derived(mode === "yes" ? i18nKey("proposal.adopt") : i18nKey("proposal.reject"));
    let iconColor = $derived(disabled && !voted ? "var(--vote-maybe-color)" : "var(--txt)");
</script>

<Column crossAxisAlignment={"center"} mainAxisAlignment={"center"} gap={"sm"}>
    <Body fontWeight={"bold"} width={"hug"}>
        <Translatable resourceKey={label} />
    </Body>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onClick} class:voting class:voted class:disabled class={`icon ${mode}`}>
        {#if !voting}
            {#if mode === "yes"}
                <ThumbUp size={$iconSize} color={iconColor} />
            {:else}
                <ThumbDown size={$iconSize} color={iconColor} />
            {/if}
        {/if}
    </div>
    <Body fontWeight={"bold"} colour={mode === "yes" ? "success" : "error"} width={"hug"}>
        {percentage}%
    </Body>
</Column>

<style lang="scss">
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

        &.voted.yes,
        &.voting.yes {
            background-color: var(--vote-yes-color);
        }

        &.voted.no,
        &.voting.no {
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
</style>
