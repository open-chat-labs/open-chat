<script lang="ts">
    import { onDestroy } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import type { Violation } from "@client";
    import type { DailyPuzzleGameDef } from "../../../utils/dailyPuzzleGames";
    import type { DemoFrame } from "./games/types";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        def: DailyPuzzleGameDef;
    }

    let { def }: Props = $props();

    const FRAME_MS = 2600;

    const spec = def.demo;
    // Parsed with the game's own parser, so a malformed demo fails here rather than drawing
    // something the real board could never show.
    const model = spec === undefined ? undefined : def.game.parse(spec.description);

    // Never animate for someone who asked not to be animated; they step it themselves.
    const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    let index: number = $state(0);
    let frame: DemoFrame | undefined = $derived(
        spec === undefined ? undefined : spec.frames[index % spec.frames.length],
    );

    let demoState = $derived.by(() => {
        if (spec === undefined || model === undefined || frame === undefined) return undefined;
        return frame.marks.reduce(
            (s, [k, v]) => def.game.apply(model, s, k, v),
            def.game.empty(model),
        );
    });

    let marks = $derived(
        model !== undefined && demoState !== undefined
            ? def.game.marks(model, demoState)
            : new Map<number, string>(),
    );
    let violations: Violation[] = $derived(
        model !== undefined && demoState !== undefined ? def.game.check(model, demoState) : [],
    );
    let lit: Set<number> = $derived(
        model !== undefined && demoState !== undefined
            ? (def.game.lit?.(model, demoState) ?? new Set<number>())
            : new Set<number>(),
    );
    // On a frame that breaks a rule the checker's red IS the message, and the translucent blue
    // "look here" wash sits on top of it and turns the red pink. Let the mistake speak alone.
    let pointed = $derived(
        violations.length > 0 ? new Set<number>() : new Set(frame?.target ?? []),
    );

    let timer: ReturnType<typeof setInterval> | undefined;
    if (!reduceMotion && spec !== undefined && spec.frames.length > 1) {
        timer = setInterval(() => (index += 1), FRAME_MS);
    }
    onDestroy(() => clearInterval(timer));

    // Tapping always steps, so the demo is controllable whether or not it is animating.
    function step() {
        index += 1;
        if (timer !== undefined) {
            clearInterval(timer);
            timer = setInterval(() => (index += 1), FRAME_MS);
        }
    }
</script>

{#if spec !== undefined && model !== undefined && demoState !== undefined && frame !== undefined}
    {@const Board = def.Board}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="demo" onclick={step}>
        <div class="board">
            <Board
                {model}
                state={demoState}
                {marks}
                {lit}
                {violations}
                focus={pointed}
                target={pointed}
                disabled
                onTap={() => step()} />
        </div>
        <p class="caption">
            <Translatable resourceKey={i18nKey(`${def.i18nPrefix}.${frame.caption}`)} />
        </p>
        <div class="dots">
            {#each spec.frames as _, i (i)}
                <span class="dot" class:on={i === index % spec.frames.length}></span>
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
        cursor: pointer;
    }

    .board {
        width: 100%;
    }

    .caption {
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
