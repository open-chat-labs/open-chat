<script lang="ts">
    import { onMount } from "svelte";

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

    interface Invader extends GameObject {
        xSpeed: number;
        ySpeed: number;
        status: boolean;
    }

    let containerWidth: number;
    let ctx: CanvasRenderingContext2D | null;
    let player: Player;
    let bullets: Bullet[];
    let invaders: Invader[];
    let invaderSize = 30;
    let gameover: boolean;
    let invaderDirection: "right" | "left" | "down" = "right";
    let nextDirection: "right" | "left" = "left";
    let destroyed = false;
    const invaderImg = new Image();
    invaderImg.src = "../assets/evil-robot.svg";
    const playerImg = new Image();
    playerImg.src = "../assets/ship.png";
    const laserSound = new Audio("../assets/laser.mp3");

    onMount(() => {
        init();
        gameLoop();
        return () => (destroyed = true);
    });

    function init() {
        const size = 30;
        ctx = canvas.getContext("2d");
        player = {
            x: size + canvas.width / 2,
            y: canvas.height - size,
            width: size,
            height: size,
            color: "#00ff00",
            speed: 5,
        };
        bullets = [];
        invaders = [];
        gameover = false;
        createInvaders();
    }

    function update() {
        if (gameover) return;

        // Move the player
        if (keys.ArrowLeft && player.x > 0) {
            player.x -= player.speed;
        }
        if (keys.ArrowRight && player.x < canvas.width - player.width) {
            player.x += player.speed;
        }

        moveInvaders();

        // Move the bullets
        bullets.forEach(function (bullet) {
            bullet.y -= bullet.speed;
        });

        // Remove bullets that are off the screen
        bullets = bullets.filter(function (bullet) {
            return bullet.y > 0;
        });

        // Check for collisions between bullets and invaders
        bullets.forEach(function (bullet) {
            invaders.forEach(function (invader) {
                if (invader.status && collides(bullet, invader)) {
                    invader.status = false;
                    bullet.y = -100;
                }
            });
        });

        // Create new invaders if all are destroyed
        if (
            invaders.filter(function (invader) {
                return invader.status;
            }).length === 0
        ) {
            createInvaders();
        }

        // Check for collisions between player and invaders
        invaders.forEach(function (invader) {
            if (invader.status && collides(invader, player)) {
                gameover = true;
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
            const l = leftmost(visibleInvaders);
            if (l < 0) {
                invaderDirection = "down";
            }
        }
    }

    function draw() {
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGameObject(player, playerImg);

        bullets.forEach(function (bullet) {
            drawGameObject(bullet);
        });

        invaders
            .filter((i) => i.status)
            .forEach(function (invader) {
                drawGameObject(invader, invaderImg);
            });

        if (gameover) {
            const h = canvas.width / 2;
            const w = canvas.width / 2;
            const x = w - w / 2;
            const y = h - h / 2;
            invaders = [];
            ctx.drawImage(invaderImg, x, y, w, h);
            ctx.fillStyle = "#ffffff";
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2);
        }
    }

    function fireBullet() {
        bullets.push({
            x: player.x + player.width / 2,
            y: player.y,
            width: 3,
            height: 10,
            color: "#ff0000",
            speed: 10,
        });
        console.log("playing laser sound");
        laserSound.currentTime = 0;
        laserSound.play();
    }

    // Create the invaders
    function createInvaders() {
        const invader = new Image();
        invader.src = "../assets/robot.svg";
        let rows = 5;
        let columns = 8;
        let spacing = 30;
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
                    ySpeed: 5,
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

    function gameLoop() {
        if (destroyed) return;
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }
</script>

<div bind:clientWidth={containerWidth} class="wrapper">
    <canvas height="600" width={containerWidth} bind:this={canvas} />
</div>

<style type="text/scss">
    canvas {
        display: block;
    }
</style>
