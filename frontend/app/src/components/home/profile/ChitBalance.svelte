<script lang="ts">
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import LearnToEarn from "./LearnToEarn.svelte";

    interface Props {
        chitBalance: number;
        totalEarned: number;
        me: boolean;
        size?: "small" | "large";
    }

    let { chitBalance, totalEarned, me, size = "small" }: Props = $props();

    let learnToEarn = $state(false);

    function click(e: Event) {
        e.stopPropagation();
        e.preventDefault();
        if (me) {
            learnToEarn = true;
        }
    }
</script>

{#if learnToEarn}
    <LearnToEarn onClose={() => (learnToEarn = false)} />
{/if}

{#if chitBalance > 0}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={click} class={`balance ${size}`} class:me>
        <div class="chit"></div>
        <div class="balances">
            <Tooltip position="top" align="middle">
                <div class="current">{`${chitBalance.toLocaleString()} CHIT`}</div>
                {#snippet popupTemplate()}
                    <Translatable resourceKey={i18nKey("chitBalance")} />
                {/snippet}
            </Tooltip>
            <Tooltip position="top" align="middle">
                <div class="total">{`${totalEarned.toLocaleString()} CHIT`}</div>
                {#snippet popupTemplate()}
                    <Translatable resourceKey={i18nKey("totalChitEarned")} />
                {/snippet}
            </Tooltip>
        </div>
    </div>
{/if}
{#if me}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_missing_attribute -->
    <a onclick={click} role="button" class={size}>
        <Translatable resourceKey={i18nKey("profile.earnMore")} />
    </a>
{/if}

<style lang="scss">
    .balance {
        border-radius: var(--rd);
        background: var(--button-bg);
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
