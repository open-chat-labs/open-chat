<script lang="ts">
    import { _ } from "svelte-i18n";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import type { Violation } from "@client";
    import type { DailyPuzzleGameDef } from "../../../utils/dailyPuzzleGames";
    import type { DemoFrame } from "./games/types";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        def: DailyPuzzleGameDef;
    }

    let { def }: Props = $props();

    const spec = def.demo;
    const last = spec === undefined ? 0 : spec.frames.length - 1;

    // The reader steps through the frames themselves; nothing advances on a timer.
    let index: number = $state(0);
    let frame: DemoFrame | undefined = $derived(spec?.frames[index]);

    // The frame's marks on the demo puzzle, parsed and checked by the game itself, so a
    // malformed demo fails here rather than drawing something the real board could never show.
    let board = $derived(
        spec === undefined || frame === undefined
            ? undefined
            : def.newBoard(spec.description, frame.marks),
    );
    let violations: Violation[] = $derived(board?.violations ?? []);
    // On a frame that breaks a rule the checker's red IS the message, and the translucent blue
    // "look here" wash sits on top of it and turns the red pink. Let the mistake speak alone.
    let pointed = $derived(
        violations.length > 0 ? new Set<number>() : new Set(frame?.target ?? []),
    );

    function prev() {
        index = Math.max(0, index - 1);
    }

    function next() {
        index = Math.min(last, index + 1);
    }

    // Tapping the board past the last step starts the tutorial again.
    function tapBoard() {
        index = index === last ? 0 : index + 1;
    }
</script>

{#if spec !== undefined && board !== undefined && frame !== undefined}
    <div class="demo">
        <!-- Keyboard users step with the arrow buttons below; tapping the board is a shortcut. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="board" onclick={tapBoard}>
            <board.Board
                {board}
                {violations}
                focus={pointed}
                target={pointed}
                disabled
                onTap={() => {}} />
        </div>
        <div class="step">
            <button class="arrow" aria-label={$_("back")} disabled={index === 0} onclick={prev}>
                <ChevronLeft size={"1.6em"} color={"currentColor"} />
            </button>
            <p class="caption">
                <Translatable resourceKey={i18nKey(`${def.i18nPrefix}.${frame.caption}`)} />
            </p>
            <button class="arrow" aria-label={$_("next")} disabled={index === last} onclick={next}>
                <ChevronRight size={"1.6em"} color={"currentColor"} />
            </button>
        </div>
        <div class="dots">
            {#each spec.frames as _f, i (i)}
                <span class="dot" class:on={i === index}></span>
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
