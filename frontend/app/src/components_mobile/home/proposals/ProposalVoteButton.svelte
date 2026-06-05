<script lang="ts">
    import {
        Body,
        BodySmall,
        Column,
        ColourVars,
        Row,
        Spinner,
        type ColourVarKeys,
    } from "component-lib";
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

    let labelKey = $derived(
        mode === "yes"
            ? `proposal.adopt${voted ? "ed" : ""}`
            : `proposal.reject${voted ? "ed" : ""}`,
    );

    let voteActive = $derived(!disabled && !voted);

    let textColour = $derived<ColourVarKeys>(
        voteActive
            ? mode === "yes"
                ? "success"
                : "error"
            : voted
              ? "textPrimary"
              : "textSecondary",
    );

    let buttonBg = $derived(
        voted ? (mode === "yes" ? ColourVars.success : ColourVars.error) : undefined,
    );
</script>

<Row
    onClick={() => {
        if (!disabled && !voting && !voted) {
            onClick();
        }
    }}
    gap="xs"
    padding={["sm", "md"]}
    width="fill"
    borderRadius="md"
    mainAxisAlignment="spaceBetween"
    crossAxisAlignment="center"
    backgroundColor={buttonBg}
    borderStyle="solid"
    borderWidth="thick"
    borderColour={disabled && !voted
        ? ColourVars.disabledButton
        : mode === "yes"
          ? ColourVars.success
          : ColourVars.error}>
    <!-- Label & Pct -->
    <Column width="hug" gap="zero">
        <Body fontWeight="bold" width="hug" colour={textColour}>
            <Translatable resourceKey={i18nKey(labelKey)} />
        </Body>
        <BodySmall width="hug" colour={textColour}>
            {percentage}%
        </BodySmall>
    </Column>

    <!-- Icon -->
    <div class={`icon ${mode}`} class:voted>
        {#if voting}
            <Spinner size="1.25rem" />
        {:else if mode === "yes"}
            <ThumbUp size={$iconSize} />
        {:else}
            <ThumbDown size={$iconSize} />
        {/if}
    </div>
</Row>

<style lang="scss">
    .icon {
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 2.25rem;
        height: 2.25rem;
        cursor: pointer;
        padding: var(--sp-sm);
        background-color: var(--background-0);

        &.voted.yes,
        &.voting.yes,
        &.voted.no,
        &.voting.no {
            background-color: var(--background-2);
        }

        &.disabled {
            background-color: transparent;
            cursor: not-allowed;
        }
    }
</style>
