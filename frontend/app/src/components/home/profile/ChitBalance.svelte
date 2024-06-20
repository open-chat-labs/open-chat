<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import LearnToEarn from "./LearnToEarn.svelte";

    export let balance: number;
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
    <LearnToEarn on:close={() => (learnToEarn = false)} />
{/if}

{#if balance > 0}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div on:click={click} class={`balance ${size}`} class:me>
        <div class="chit"></div>
        {`${balance.toLocaleString()} CHIT`}
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

        .chit {
            background-image: url("/assets/chit.svg");
            background-repeat: no-repeat;
        }

        &.small {
            padding: $sp2 $sp3;
            gap: $sp3;

            .chit {
                width: $sp4;
                height: $sp4;
            }
        }

        &.large {
            padding: $sp3 $sp4;
            @include font(book, normal, fs-120);

            gap: $sp4;
            .chit {
                width: $sp5;
                height: $sp5;
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
