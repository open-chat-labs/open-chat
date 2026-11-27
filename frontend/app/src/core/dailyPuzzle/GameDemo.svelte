<script lang="ts">
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import type { DailyPuzzleGameDef } from "./registry";
    import { DemoSteps } from "./demoSteps.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        def: DailyPuzzleGameDef;
    }

    let { def }: Props = $props();

    // the stepping is shared with the native tutorial (DemoSteps)
    const steps = new DemoSteps(untrack(() => def));
    const spec = untrack(() => def.demo);
    const board = $derived(steps.board);
    const frame = $derived(steps.frame);
</script>

{#if spec !== undefined && board !== undefined && frame !== undefined}
    <div class="demo">
        <!-- Keyboard users step with the arrow buttons below; tapping the board is a shortcut. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="board" onclick={() => steps.tapBoard()}>
            <board.Board
                {board}
                violations={steps.violations}
                focus={steps.pointed}
                target={steps.pointed}
                disabled
                onTap={() => {}} />
        </div>
        <div class="step">
            <button
                class="arrow"
                aria-label={$_("back")}
                disabled={steps.isFirst}
                onclick={() => steps.prev()}>
                <ChevronLeft size={"1.6em"} color={"currentColor"} />
            </button>
            <p class="caption">
                <Translatable resourceKey={i18nKey(`${def.i18nPrefix}.${frame.caption}`)} />
            </p>
            <button
                class="arrow"
                aria-label={$_("next")}
                disabled={steps.isLast}
                onclick={() => steps.next()}>
                <ChevronRight size={"1.6em"} color={"currentColor"} />
            </button>
        </div>
        <div class="dots">
            {#each spec.frames as _f, i (i)}
                <span class="dot" class:on={i === steps.index}></span>
            {/each}
        </div>
    </div>
{/if}

<style lang="scss">
    .demo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp3;
    }

    .board {
        width: 100%;
        cursor: pointer;
    }

    .step {
        display: flex;
        align-items: center;
        gap: $sp2;
        width: 100%;
    }

    .arrow {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: toRem(36);
        height: toRem(36);
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        color: var(--txt-light);
        cursor: pointer;

        &:disabled {
            opacity: 0.3;
            cursor: default;
        }
    }

    .caption {
        flex: 1;
        margin: 0;
        text-align: center;
        min-height: 2.4em;
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .dots {
        display: flex;
        gap: $sp2;
    }

    .dot {
        width: toRem(6);
        height: toRem(6);
        border-radius: 50%;
        background-color: var(--txt-light);
        opacity: 0.3;
        transition: opacity 200ms ease-in-out;

        &.on {
            opacity: 1;
        }
    }
</style>
