<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { rtlStore } from "../../../stores/rtl";
    import { now500 } from "../../../stores/time";
    import Translatable from "../../Translatable.svelte";
    import { Body, ColourVars, Column, Row } from "component-lib";

    interface Props {
        adoptPercent: number;
        rejectPercent: number;
        votingEnded: boolean;
        deadline: number;
        minYesPercentageOfTotal: number;
        minYesPercentageOfExercised: number;
    }

    let {
        adoptPercent,
        rejectPercent,
        votingEnded,
        deadline,
        minYesPercentageOfTotal,
        minYesPercentageOfExercised,
    }: Props = $props();

    const client = getContext<OpenChat>("client");

    let deadlineDate = $derived(new Date(Number(deadline)));
    let rtl = $derived($rtlStore ? "right" : "left");
    let rtlOpposite = $derived($rtlStore ? "left" : "right");
</script>

<Column>
    <!-- Progress -->
    <Column overflow="visible">
        <div class="chevrons">
            <div class="icon" style="{rtl}: calc({minYesPercentageOfTotal}% - 0.5em)">
                <ChevronDown viewBox="-1 0 24 24" color={ColourVars.textPrimary} />
            </div>
            <div class="icon solid" style="{rtl}: calc({minYesPercentageOfExercised}% - 0.5em)">
                <svg viewBox="-1 0 24 24">
                    <path d="M6,10 L12,16 L18,10 H7Z" fill={ColourVars.textPrimary} />
                </svg>
            </div>
        </div>
        <div class="progress">
            <div class="adopt" style="width: {adoptPercent}%; {rtl}: 0;"></div>
            <div class="reject" style="width: {rejectPercent}%; {rtlOpposite}: 0;"></div>
            <div class="vertical-line" style="{rtl}: {minYesPercentageOfTotal}%"></div>
            <div class="vertical-line" style="{rtl}: {minYesPercentageOfExercised}%"></div>
        </div>
    </Column>

    <!-- Percentages -->
    <Row width="fill" mainAxisAlignment="spaceBetween">
        <Column width="hug" padding="sm">
            <Body width="hug" fontWeight="semi-bold" colour="success">{adoptPercent}%</Body>
        </Column>
        <Column width="hug" padding="sm">
            <Body width="hug" fontWeight="semi-bold" colour="error">{rejectPercent}%</Body>
        </Column>
    </Row>

    <!-- Remaining -->
    <Column padding={["sm", "zero", "zero"]} crossAxisAlignment="center">
        <Body colour="textSecondary" width="hug">
            <Translatable
                resourceKey={i18nKey(
                    votingEnded ? "proposal.votingPeriodEnded" : "proposal.votingPeriodRemaining",
                )} />
        </Body>
        <Body fontWeight="semi-bold" width="hug">
            {#if votingEnded}
                {client.toDateString(deadlineDate)} {client.toShortTimeString(deadlineDate)}
            {:else}
                {client.formatTimeRemaining($now500, deadline)}
            {/if}
        </Body>
    </Column>
</Column>

<style lang="scss">
    .wrapper {
        flex: auto;
        position: relative;
    }

    .chevrons {
        width: 100%;
        height: 1rem;
        position: relative;
        overflow: hidden;

        .icon {
            position: absolute;
            top: 0;
            width: 1rem;
            color: var(--txt);
            margin-left: 0px;

            &.solid {
                transform: scale(1.25);
            }
        }
    }

    .progress {
        width: 100%;
        height: 0.3rem;
        position: relative;
        border-radius: var(--rad-md);
        background: var(--background-2);

        .adopt,
        .reject {
            top: 0;
            bottom: 0;
            position: absolute;
            transition-duration: 1s;
            border-radius: var(--rad-md);
        }

        .adopt {
            background: var(--vote-yes-color);
        }

        .reject {
            background: var(--vote-no-color);
        }

        .vertical-line {
            position: absolute;
            top: -0.15rem;
            bottom: -0.25rem;
            width: 2px;
            background-color: var(--txt);
            border-radius: 2px;
        }
    }
</style>
