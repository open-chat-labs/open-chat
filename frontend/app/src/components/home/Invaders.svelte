<script lang="ts">
    import { onMount, tick } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { _ } from "svelte-i18n";
    import { isTouchDevice } from "../../utils/devices";
    import Button from "../Button.svelte";

    let canvas: HTMLCanvasElement;

    type GameObject = {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
    };

    type Player = GameObject & {
        speed: number;
    };

    type Bullet = GameObject & {
        speed: number;
    };

    type Invader = GameObject & {
        xSpeed: number;
        ySpeed: number;
        status: boolean;
    };

    type State = "not_started" | "playing" | "game_over";

    let containerWidth: number;
    let ctx: CanvasRenderingContext2D | null;
    let player: Player;
    let bullets: Bullet[];
    let invaders: Invader[];
    let invaderSize = 30;
    let state: State = "not_started";
    let invaderDirection: "right" | "left" | "down" = "right";
    let nextDirection: "right" | "left" = "left";
    let destroyed = false;
    let tiltAngle: number | null = 0;
    const tiltSpeed = 0.2;
    const invaderImg = new Image();
    invaderImg.src = "../assets/evil-robot.svg";
    const playerImg = new Image();
    playerImg.src = "../assets/ship.png";
    const laserSound = new Audio("../assets/laser.mp3");

    onMount(() => {
        init();
        if (!isTouchDevice) {
            start();
        }
        return () => (destroyed = true);
    });

    function init() {
        const width = containerWidth;
        const size = 30;
        ctx = canvas.getContext("2d");
        player = {
            x: width / 2 - size / 2,
            y: canvas.height - size,
            width: size,
            height: size,
            color: "#00ff00",
            speed: 5,
        };
        bullets = [];
        invaders = [];
        state = "not_started";
        createInvaders();
        tick().then(draw);
    }

    function update() {
        if (keys.ArrowLeft && player.x > 0) {
            player.x -= player.speed;
        }
        if (keys.ArrowRight && player.x < canvas.width - player.width) {
            player.x += player.speed;
        }

        if (isTouchDevice) {
            const angle = tiltAngle || 0;
            if (
                (angle < 0 && player.x > 0) ||
                (angle > 0 && player.x < canvas.width - player.width)
            ) {
                player.x += (tiltAngle || 0) * tiltSpeed;
            }
        }

        moveInvaders();

        bullets.forEach(function (bullet) {
            bullet.y -= bullet.speed;
        });

        bullets = bullets.filter(function (bullet) {
            return bullet.y > 0;
        });

        bullets.forEach(function (bullet) {
            invaders.forEach(function (invader) {
                if (invader.status && collides(bullet, invader)) {
                    invader.status = false;
                    bullet.y = -100;
                }
            });
        });

        if (
            invaders.filter(function (invader) {
                return invader.status;
            }).length === 0
        ) {
            createInvaders();
        }

        invaders.forEach(function (invader) {
            if (invader.status && collides(invader, player)) {
                state = "game_over";
            }
        });
    }

    function leftmost(i: Invader[]): number {
        return i.reduce((min, { x }) => Math.min(min, x), canvas.width);
    }

    function rightmost(i: Invader[]): number {
        return i.reduce((max, { x }) => Math.max(max, x), 0);
    }

    function moveInvaders() {
        const visibleInvaders = invaders.filter((i) => i.status);

        if (invaderDirection === "right") {
            visibleInvaders.forEach((invader) => {
                invader.x += invader.xSpeed;
            });
            const r = rightmost(visibleInvaders);
            if (r + invaderSize > canvas.width) {
                invaderDirection = "down";
            }
        } else if (invaderDirection === "down") {
            visibleInvaders.forEach((invader) => {
                invader.y += invader.ySpeed;
            });
            invaderDirection = nextDirection;
            nextDirection = nextDirection === "left" ? "right" : "left";
        } else if (invaderDirection === "left") {
            visibleInvaders.forEach((invader) => {
                invader.x -= invader.xSpeed;
            });
            if (leftmost(visibleInvaders) < 0) {
                invaderDirection = "down";
            }
        }
    }

    function drawInvaders() {
        invaders
            .filter((i) => i.status)
            .forEach(function (invader) {
                drawGameObject(invader, invaderImg);
            });
    }

    function drawBullets() {
        bullets.forEach(function (bullet) {
            drawGameObject(bullet);
        });
    }

    function drawGameOver() {
        if (!ctx || !canvas) return;
        const h = canvas.width / 2;
        const w = canvas.width / 2;
        const x = w - w / 2;
        const y = h - h / 2;
        invaders = [];
        ctx.drawImage(invaderImg, x, y, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText($_("halloffame.gameover"), canvas.width / 2, canvas.height / 2);
    }

    function draw() {
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGameObject(player, playerImg);

        drawBullets();

        drawInvaders();

        if (state === "game_over") {
            drawGameOver();
        }
    }

    function fireBullet() {
        if (state !== "playing") return;
        bullets.push({
            x: player.x + player.width / 2,
            y: player.y,
            width: 3,
            height: 10,
            color: "#ff0000",
            speed: 10,
        });
        laserSound.currentTime = 0;
        laserSound.play();
    }

    function createInvaders() {
        const invader = new Image();
        invader.src = "../assets/robot.svg";
        const rows = 5;
        const columns = $mobileWidth ? 5 : 8;
        const spacing = 30;
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
                invaders.push({
                    x: j * (spacing + invaderSize) + spacing,
                    y: i * (spacing + invaderSize) + spacing,
                    width: invaderSize,
                    height: invaderSize,
                    color: "#00ff00",
                    status: true,
                    xSpeed: 3,
                    ySpeed: 8,
                });
            }
        }
    }

    function drawGameObject(obj: GameObject, img?: CanvasImageSource) {
        if (!ctx) return;

        if (img) {
            ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
        } else {
            ctx.fillStyle = obj.color;
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
    }

    function collides(obj1: GameObject, obj2: GameObject) {
        return (
            obj1.x < obj2.x + obj2.width &&
            obj1.x + obj1.width > obj2.x &&
            obj1.y < obj2.y + obj2.height &&
            obj1.y + obj1.height > obj2.y
        );
    }

    let keys: { [key: string]: boolean } = {};
    document.addEventListener("keydown", function (event) {
        keys[event.key] = true;
        if (event.key === " ") {
            fireBullet();
        }
    });

    document.addEventListener("keyup", function (event) {
        keys[event.key] = false;
    });

    function handleOrientation(ev: DeviceOrientationEvent) {
        tiltAngle = ev.gamma; // 0 -> 45 is tilting right, 0 -> -45 is tilting left
    }

    function gameLoop() {
        if (destroyed) return;
        if (state !== "playing") return;

        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    // We'll use tilt controls on mobile devices
    function setUpTilt() {
        if ("DeviceOrientationEvent" in window) {
            //@ts-ignore
            return window.DeviceOrientationEvent.requestPermission().then((response) => {
                if (response === "granted") {
                    window.addEventListener("deviceorientation", handleOrientation, true);
                }
                return;
            });
        } else {
            console.log("Device orientation not supported");
        }
    }

    async function start() {
        if (isTouchDevice) {
            await setUpTilt();
        }
        state = "playing";
        gameLoop();
    }
</script>

<div
    on:click={() => {
        if (isTouchDevice) {
            fireBullet();
        }
    }}
    bind:clientWidth={containerWidth}
    class="invaders">
    <canvas height="500" width={containerWidth} bind:this={canvas} />
    {#if state === "not_started"}
        <div class="start"><Button on:click={start}>{$_("halloffame.start")}</Button></div>
    {/if}
</div>

<style type="text/scss">
    :global(.invaders button) {
        font-family: "Press Start 2P", cursive;
    }
    canvas {
        display: block;
    }
    .invaders {
        position: relative;
    }

    .start {
        position: absolute;
        text-align: center;
        width: 100%;
        left: 0;
        top: calc(50% - 20px);
    }
</style>
