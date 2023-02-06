<script lang="ts">
    import Button from "../Button.svelte";
    import type { OpenChat, PrizeContent } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Clock from "svelte-material-icons/Clock.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { Confetti } from "svelte-confetti";
    import { rtlStore } from "../../stores/rtl";
    import { now } from "../../stores/time";
    import CkBtc from "../icons/CkBtc.svelte";
    import { toastStore } from "../../stores/toast";
    import { claimsStore } from "../../stores/claims";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let content: PrizeContent;
    export let chatId: string;
    export let messageId: bigint;

    $: total = content.prizesRemaining + content.winners.length;
    $: percentage = (content.winners.length / total) * 100;
    $: claimedByYou = content.winners.includes(client.user.userId);
    $: finished = $now >= Number(content.endDate);
    $: disabled = finished || claimedByYou || content.prizesRemaining <= 0;
    $: timeRemaining = finished
        ? $_("prizes.finished")
        : client.formatTimeRemaining($now, Number(content.endDate));
    let progressWidth = 0;
    // let source = "../assets/ckbtc_large.jpeg";

    function claim() {
        if (!client.isDiamondUser()) {
            dispatch("upgrade", "premium");
            return;
        }
        claimsStore.add(messageId);
        client
            .claimPrize(chatId, messageId, {
                ...content,
                winners: [...content.winners, client.user.userId],
                prizesRemaining: content.prizesRemaining - 1,
            })
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast("prizes.claimFailed");
                }
            })
            .finally(() => claimsStore.delete(messageId));
    }
</script>

<div class={`prize ${content.token}`}>
    <div class="top">
        <div class="countdown" class:rtl={$rtlStore}>
            <Clock size={"1em"} color={"#ffffff"} />
            <span>{timeRemaining}</span>
        </div>
        <!-- <img class="image" alt="ckBTC logo" src={source} /> -->
        <div class="prize-coin">
            <CkBtc shadow />
        </div>
    </div>
    <div class="bottom">
        {#if content.caption !== undefined}
            <div class="caption">
                {content.caption}
            </div>
        {/if}
        <div class="click">{$_("prizes.click")}</div>
        <div class="progress" bind:clientWidth={progressWidth}>
            <div
                class="claimed"
                class:rtl={$rtlStore}
                style="background-size: {progressWidth}px 100%; width: {percentage}%" />
        </div>
        <div class="number-claimed">
            {content.winners.length}/{total}
        </div>
        <div class="claim">
            {#if claimedByYou}
                <div class="tada">
                    <div class="confetti">
                        <Confetti />
                    </div>
                </div>
            {/if}

            <ButtonGroup align="fill">
                <Button loading={$claimsStore.has(messageId)} on:click={claim} {disabled} hollow
                    >{claimedByYou
                        ? $_("prizes.claimed")
                        : finished
                        ? $_("prizes.finished")
                        : $_("prizes.claim")}</Button>
            </ButtonGroup>
        </div>
    </div>
</div>

<style type="text/scss">
    $accent: var(--prize);

    :global(.claim button) {
        &:not(.disabled) {
            border: 1px solid $accent !important;
        }
        min-height: 45px !important;
        min-width: unset !important;

        &:not(.disabled):hover,
        &.loading {
            background-color: $accent;
            color: var(--button-txt);
        }
    }
    .top {
        position: relative;
        padding: 30px 0 30px 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: radial-gradient(circle, rgba(238, 31, 122, 1) 0%, rgba(59, 12, 190, 1) 80%);
    }
    .countdown {
        @include font-size(fs-60);
        font-weight: 700;
        position: absolute;
        display: flex;
        gap: $sp2;
        align-items: center;
        border-radius: $sp2;
        top: 10px;
        left: 10px;
        background-color: rgba(0, 0, 0, 0.3);
        padding: $sp2 $sp3;

        &.rtl {
            left: unset;
            right: 10px;
        }
    }

    .tada {
        position: relative;

        .confetti {
            position: absolute;
            pointer-events: none;
            top: 50%;
            left: 50%;
        }
    }

    .caption {
        @include font(bold, normal, fs-100);
        margin-bottom: $sp3;
    }

    .number-claimed {
        @include font(bold, normal, fs-80);
        margin-bottom: $sp3;
    }

    .click {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }

    .progress {
        height: toRem(16);
        position: relative;
        background: var(--chatSummary-bg-selected);
        border-radius: $sp3;
        margin-bottom: $sp2;
        overflow: hidden;
        @include mobile() {
            margin-top: 0;
        }

        .claimed {
            $red: rgba(234, 41, 41, 1);
            $orange: rgba(244, 118, 4, 1);
            $green: rgba(74, 233, 122, 1);
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            background-image: linear-gradient(90deg, $green 0%, $orange 50%, $red 100%);
            &.rtl {
                left: unset;
                right: 0;
                background-image: linear-gradient(90deg, $red 0%, $orange 50%, $green 100%);
            }
        }
    }

    .bottom {
        padding: $sp4;
    }
    .image {
        height: auto;
        width: 360px;
        @include mobile() {
            width: 100%;
        }
    }
</style>
