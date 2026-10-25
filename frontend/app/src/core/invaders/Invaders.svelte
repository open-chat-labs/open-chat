<!-- The hall of fame's Invaders game, on a canvas (its rules: invaders.ts), for every tree: the arrow keys steer and Space
     fires; on a touch screen (iOS asks to read the tilt) tilting steers and a tap fires. It starts at once where there's
     a keyboard, and from the host's start button (`start`) on touch and after a game ends. The best score is kept in
     this browser. `fill`: as tall as the host makes it, else 500px. -->
<script lang="ts">
    import { isTouchDevice } from "@src/utils/devices";
    import { onMount, tick, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { InvadersGame, type GameObject, type InvadersState } from "./invaders";
    import { tiltNeedsPermission } from "./support";

    interface Props {
        /** The host's start button, given what starts a game. */
        start: Snippet<[() => void]>;
        /** As tall as the host makes it. */
        fill?: boolean;
    }

    let { start, fill = false }: Props = $props();

    const HIGH_SCORE_KEY = "openchat_invaders";
    const HEIGHT = 500;

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    let containerWidth = $state(0);
    let containerHeight = $state(0);
    const height = $derived(fill ? containerHeight : HEIGHT);
    // state, so the field follows the canvas once the game is made (the game itself is mutated in
    // place each frame, not tracked)
    let game = $state.raw<InvadersGame>();
    // a start under way (iOS asks to read the tilt first): a second press doesn't start a second loop
    let starting = false;
    let phase = $state<InvadersState>("not_started");
    let destroyed = false;
    let tilt: number | null = null;
    const keys: Record<string, boolean> = {};

    const invaderImg = new Image();
    invaderImg.src = "/assets/evil-robot.svg";
    const shipImg = new Image();
    shipImg.src = "/assets/ship.png";
    const laserSound = new Audio("/assets/laser.mp3");

    onMount(() => {
        document.addEventListener("keydown", keydown);
        document.addEventListener("keyup", keyup);
        tick().then(() => {
            if (destroyed) return;
            ctx = canvas.getContext("2d");
            game = new InvadersGame(
                canvas.width,
                canvas.height,
                Number(localStorage.getItem(HIGH_SCORE_KEY) || "0"),
                (score) => localStorage.setItem(HIGH_SCORE_KEY, score.toString()),
            );
            draw();
            if (!isTouchDevice) play();
        });
        return () => {
            destroyed = true;
            document.removeEventListener("keydown", keydown);
            document.removeEventListener("keyup", keyup);
            window.removeEventListener("deviceorientation", handleOrientation, true);
        };
    });

    // the field follows the canvas, as the dialog resizes or the device turns: a game not yet started
    // is laid out again for it; the canvas is cleared as it resizes, so it's drawn again
    $effect(() => {
        const width = containerWidth;
        const h = height;
        const current = phase;
        if (game === undefined) return;
        game.width = width;
        game.height = h;
        if (current === "not_started") game.reset();
        else game.ship.y = h - game.ship.height;
        if (current !== "playing") tick().then(draw);
    });

    function keydown(event: KeyboardEvent) {
        if (phase !== "playing") return;
        // while playing, the keys are the game's: Space doesn't press a focused button, nor the arrows scroll
        if (event.key === " " || event.key.startsWith("Arrow")) event.preventDefault();
        keys[event.key] = true;
        if (event.key === " ") fire();
    }

    function keyup(event: KeyboardEvent) {
        keys[event.key] = false;
        if (phase === "playing" && event.key === " ") event.preventDefault();
    }

    function fire() {
        if (game?.fire()) {
            laserSound.currentTime = 0;
            void laserSound.play().catch(() => {});
        }
    }

    function handleOrientation(ev: DeviceOrientationEvent) {
        // 0 → 45 is tilting right, 0 → -45 tilting left
        tilt = ev.gamma;
    }

    // tilt steers on a touch screen; iOS asks first
    async function setUpTilt() {
        if (!tiltNeedsPermission()) return;
        // @ts-expect-error iOS-only DeviceOrientationEvent.requestPermission is not in the DOM types
        const answer: string = await window.DeviceOrientationEvent.requestPermission();
        if (answer === "granted") {
            window.addEventListener("deviceorientation", handleOrientation, true);
        }
    }

    async function play() {
        if (game === undefined || starting || game.state === "playing") return;
        starting = true;
        try {
            if (game.state === "game_over") game.reset();
            if (isTouchDevice) await setUpTilt();
            game.start();
            phase = game.state;
            requestAnimationFrame(loop);
        } finally {
            starting = false;
        }
    }

    function loop() {
        if (destroyed || game === undefined || game.state !== "playing") return;
        game.update({
            left: !!keys.ArrowLeft,
            right: !!keys.ArrowRight,
            tilt: isTouchDevice ? tilt : null,
        });
        phase = game.state;
        draw();
        requestAnimationFrame(loop);
    }

    function drawObject(obj: GameObject, img?: CanvasImageSource, color = "#00ff00") {
        if (!ctx) return;
        if (img) ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
        else {
            ctx.fillStyle = color;
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
    }

    function draw() {
        if (!ctx || !game) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawObject(game.ship, shipImg);
        game.shots.forEach((shot) => drawObject(shot, undefined, "#ff0000"));
        ctx.fillStyle = "#ffffff";
        ctx.font = "20px Arial";
        ctx.textAlign = "left";
        ctx.fillText(game.score.toString(), 10, 20);
        ctx.textAlign = "right";
        ctx.fillText(game.highScore.toString(), canvas.width - 10, 20);
        if (game.state === "game_over") {
            const w = canvas.width / 2;
            ctx.drawImage(invaderImg, w - w / 2, canvas.height / 2 - w / 2 - 40, w, w);
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillText($_("halloffame.gameover"), canvas.width / 2, canvas.height / 2);
        }
        game.invaders.filter((i) => i.alive).forEach((i) => drawObject(i, invaderImg));
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
    class="invaders"
    class:fill
    bind:clientWidth={containerWidth}
    bind:clientHeight={containerHeight}
    onclick={() => isTouchDevice && fire()}>
    <canvas {height} width={containerWidth} bind:this={canvas}></canvas>
    {#if phase !== "playing"}
        <div class="start">{@render start(play)}</div>
    {/if}
</div>

<style lang="scss">
    // an arcade screen, dark in either theme
    .invaders {
        position: relative;
        background: #000;
    }

    .invaders.fill {
        height: 100%;
    }

    canvas {
        display: block;
    }

    .start {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 12%;
        display: flex;
        justify-content: center;
    }
</style>
