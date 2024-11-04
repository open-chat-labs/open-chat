<script lang="ts">
    import Button from "../Button.svelte";
    import Diamond from "../icons/Diamond.svelte";
    import type { ChatIdentifier, OpenChat, PrizeContent } from "openchat-client";
    import { currentUser as user, isDiamond, cryptoLookup } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Clock from "svelte-material-icons/Clock.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { Confetti } from "svelte-confetti";
    import { rtlStore } from "../../stores/rtl";
    import { now500 } from "../../stores/time";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import { toastStore } from "../../stores/toast";
    import { claimsStore } from "../../stores/claims";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let content: PrizeContent;
    export let chatId: ChatIdentifier;
    export let messageId: bigint;
    export let me: boolean;

    $: logo =
        Object.values($cryptoLookup).find(
            (t) => t.symbol.toLowerCase() === content.token.toLowerCase(),
        )?.logo ?? "";
    $: total = content.prizesRemaining + content.prizesPending + content.winners.length;
    $: percentage = (content.winners.length / total) * 100;
    $: claimedByYou = content.winners.includes($user.userId);
    $: finished = $now500 >= Number(content.endDate);
    $: allClaimed = content.prizesRemaining <= 0;
    $: disabled = finished || claimedByYou || allClaimed;
    $: timeRemaining = finished
        ? $_("prizes.finished")
        : client.formatTimeRemaining($now500, Number(content.endDate));

    let progressWidth = 0;

    function claim(e: MouseEvent) {
        if (e.isTrusted && chatId.kind !== "direct_chat" && !me) {
            if (!$isDiamond && content.diamondOnly) {
                dispatch("upgrade");
                return;
            }
            claimsStore.add(messageId);
            client
                .claimPrize(chatId, messageId)
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("prizes.claimFailed"));
                    }
                })
                .finally(() => claimsStore.delete(messageId));
        }
    }
</script>

<div class={`prize ${content.token}`}>
    <div class="top">
        <div class="countdown" class:rtl={$rtlStore}>
            <Clock size={"1em"} color={"#ffffff"} />
            <span>
                {#if allClaimed && !finished}
                    <Translatable resourceKey={i18nKey("prizes.allClaimed")} />
                {:else}
                    {timeRemaining}
                {/if}
            </span>
            {#if content.diamondOnly}
                <Diamond y={0} size={"1em"} />
            {/if}
        </div>
        <div class="prize-coin">
            <SpinningToken {logo} />
        </div>
    </div>
    <div class="bottom">
        {#if content.caption !== undefined}
            <div class="caption">
                {content.caption}
            </div>
        {/if}
        {#if !me}
            <div class="click"><Translatable resourceKey={i18nKey("prizes.click")} /></div>
        {:else if finished}
            <div class="click"><Translatable resourceKey={i18nKey("prizes.prizeFinished")} /></div>
        {:else}
            <div class="click"><Translatable resourceKey={i18nKey("prizes.live")} /></div>
        {/if}
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

            {#if !me}
                <ButtonGroup align="fill">
                    <Button loading={$claimsStore.has(messageId)} on:click={claim} {disabled} hollow
                        ><Translatable
                            resourceKey={i18nKey(
                                claimedByYou
                                    ? "prizes.claimed"
                                    : finished
                                      ? "prizes.finished"
                                      : allClaimed
                                        ? "prizes.allClaimed"
                                        : "prizes.claim",
                            )} /></Button>
                </ButtonGroup>
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
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

    .prize {
        max-width: 400px;
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
        border-radius: var(--rd);
        color: white;
        top: 10px;
        left: 10px;
        background-color: rgba(0, 0, 0, 0.3);
        padding: $sp2 $sp3;
        text-transform: lowercase;

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

    .number-claimed {
        @include font(bold, normal, fs-80);
        margin-bottom: $sp3;
    }

    .click,
    .caption {
        @include font(book, normal, fs-80);
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
