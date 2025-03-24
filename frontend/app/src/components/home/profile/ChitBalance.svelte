<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import Translatable from "../../Translatable.svelte";
    import LearnToEarn from "./LearnToEarn.svelte";

    export let balance: number;
    export let totalEarned: number;
    export let me: boolean;
    export let size: "small" | "large" = "small";

    let learnToEarn = false;

    function click() {
        if (me) {
            learnToEarn = true;
        }
    }
</script>

{#if learnToEarn}
    <LearnToEarn onClose={() => (learnToEarn = false)} />
{/if}

{#if totalEarned > 0}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div on:click={click} class={`balance ${size}`} class:me>
        <div class="chit"></div>
        <div class="balances">
            <TooltipWrapper position="top" align="middle">
                <div slot="target" class="current">{`${balance.toLocaleString()} CHIT`}</div>
                <div let:position let:align slot="tooltip">
                    <TooltipPopup {align} {position}>
                        <Translatable resourceKey={i18nKey("currentChitBalance")} />
                    </TooltipPopup>
                </div>
            </TooltipWrapper>
            <TooltipWrapper position="bottom" align="middle">
                <div slot="target" class="total">{`${totalEarned.toLocaleString()} CHIT`}</div>
                <div let:position let:align slot="tooltip">
                    <TooltipPopup {align} {position}>
                        <Translatable resourceKey={i18nKey("totalChitEarned")} />
                    </TooltipPopup>
                </div>
            </TooltipWrapper>
        </div>
    </div>
{/if}
{#if me}
    <!-- svelte-ignore a11y-interactive-supports-focus -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-missing-attribute -->
    <a on:click|preventDefault|stopPropagation={click} role="button" class={size}>
        <Translatable resourceKey={i18nKey("profile.earnMore")} />
    </a>
{/if}

<style lang="scss">
    .balance {
        border-radius: var(--rd);
        background-color: var(--button-bg);
        color: var(--button-txt);
        display: flex;
        align-items: center;
        width: fit-content;
        align-self: center;
        margin: 0 0 $sp3 0;

        &.me {
            cursor: pointer;
        }

        .balances {
            display: flex;
            flex-direction: column;
            .total {
                text-align: start;
                @include font(light, normal, fs-60);
            }
        }

        .chit {
            background-image: url("/assets/chit.svg");
            background-repeat: no-repeat;
        }

        &.small {
            padding: $sp2 $sp3;
            gap: $sp3;

            .chit {
                width: $sp5;
                height: $sp5;
            }
        }

        &.large {
            padding: $sp3 $sp4;
            @include font(book, normal, fs-120);

            gap: $sp4;
            .chit {
                width: $sp6;
                height: $sp6;
            }
        }
    }

    a {
        color: var(--txt);
        text-decoration: underline;
        text-underline-offset: $sp2;
        align-self: center;
        margin: 0 0 $sp3 0;

        &.small {
            @include font(book, normal, fs-80);
            color: var(--txt-light);
        }
    }
</style>
