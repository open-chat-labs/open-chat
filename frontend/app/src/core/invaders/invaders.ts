// The rules of the hall of fame's Invaders game, apart from the canvas it's drawn on
// (Invaders.svelte): the player's ship, its shots, the waves of invaders, the score and the end.

export type GameObject = { x: number; y: number; width: number; height: number };
export type Ship = GameObject & { speed: number };
export type Shot = GameObject & { speed: number };
export type Invader = GameObject & { ySpeed: number; alive: boolean };
export type InvadersState = "not_started" | "playing" | "game_over";

/** What steers the ship this frame: the arrow keys held, and the phone's tilt (degrees, - is left). */
export type Steering = { left: boolean; right: boolean; tilt: number | null };

const SHIP_SIZE = 30;
const SHIP_SPEED = 5;
const INVADER_SIZE = 30;
const INVADER_SPACING = 30;
const INVADER_ROWS = 5;
const INVADER_DROP = 8;
const SHOT_SPEED = 10;
const POINTS = 10;
const TILT_SPEED = 0.2;
// the invaders speed up a little every frame of a game, and start again from 1
const START_SPEED = 1;
const SPEED_UP = 0.01;

/** Whether two objects overlap. */
export function collides(a: GameObject, b: GameObject): boolean {
    return (
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    );
}

/**
 * One game of Invaders on a `width` × `height` field: `columns` invaders a row, five rows, which
 * march side to side, dropping a step at each edge, faster all the time; a new wave once one is
 * cleared; 10 points an invader; over once one reaches the ship's row. A score above `highScore`
 * is the new one (`onHighScore`, to keep it).
 */
export class InvadersGame {
    state: InvadersState = "not_started";
    ship!: Ship;
    shots: Shot[] = [];
    invaders: Invader[] = [];
    score = 0;
    newHighScore = false;
    #speed = START_SPEED;
    #direction: "right" | "left" | "down" = "right";
    #next: "right" | "left" = "left";

    constructor(
        public width: number,
        public height: number,
        private columns: number,
        public highScore = 0,
        private onHighScore: (score: number) => void = () => {},
    ) {
        this.reset();
    }

    /** A new game, waiting to start: the ship in the middle, the first wave in place. */
    reset(): void {
        this.ship = {
            x: this.width / 2 - SHIP_SIZE / 2,
            y: this.height - SHIP_SIZE,
            width: SHIP_SIZE,
            height: SHIP_SIZE,
            speed: SHIP_SPEED,
        };
        this.shots = [];
        this.invaders = [];
        this.score = 0;
        this.newHighScore = false;
        this.#speed = START_SPEED;
        this.#direction = "right";
        this.#next = "left";
        this.state = "not_started";
        this.#addWave();
    }

    start(): void {
        this.state = "playing";
    }

    /** Fires a shot from the ship, while playing: whether it did (for its sound). */
    fire(): boolean {
        if (this.state !== "playing") return false;
        this.shots.push({
            x: this.ship.x + this.ship.width / 2,
            y: this.ship.y,
            width: 3,
            height: 10,
            speed: SHOT_SPEED,
        });
        return true;
    }

    /** One frame: the ship, the invaders and the shots move, hits score, and the game may end. */
    update({ left, right, tilt }: Steering): void {
        if (this.state !== "playing") return;
        const ship = this.ship;
        if (left && ship.x > 0) ship.x -= ship.speed;
        if (right && ship.x < this.width - ship.width) ship.x += ship.speed;
        const angle = tilt ?? 0;
        if ((angle < 0 && ship.x > 0) || (angle > 0 && ship.x < this.width - ship.width)) {
            ship.x += angle * TILT_SPEED;
        }

        this.#moveInvaders();

        this.shots.forEach((shot) => (shot.y -= shot.speed));
        this.shots = this.shots.filter((shot) => shot.y > 0);
        for (const shot of this.shots) {
            for (const invader of this.invaders) {
                if (invader.alive && collides(shot, invader)) {
                    invader.alive = false;
                    shot.y = -100;
                    this.score += POINTS;
                }
            }
        }

        if (!this.invaders.some((i) => i.alive)) this.#addWave();

        const landed = this.invaders.some(
            (i) => i.alive && (collides(i, ship) || i.y + ship.height > ship.y),
        );
        if (landed) {
            this.#over();
            return;
        }
        this.#speed += SPEED_UP;
    }

    #over(): void {
        this.state = "game_over";
        this.newHighScore = this.score > this.highScore;
        if (this.newHighScore) {
            this.highScore = this.score;
            this.onHighScore(this.score);
        }
        this.invaders = [];
        this.shots = [];
    }

    #moveInvaders(): void {
        const alive = this.invaders.filter((i) => i.alive);
        if (this.#direction === "right") {
            alive.forEach((i) => (i.x += this.#speed));
            const right = alive.reduce((max, { x }) => Math.max(max, x), 0);
            if (right + INVADER_SIZE > this.width) this.#direction = "down";
        } else if (this.#direction === "down") {
            alive.forEach((i) => (i.y += i.ySpeed));
            this.#direction = this.#next;
            this.#next = this.#next === "left" ? "right" : "left";
        } else {
            alive.forEach((i) => (i.x -= this.#speed));
            const left = alive.reduce((min, { x }) => Math.min(min, x), this.width);
            if (left < 0) this.#direction = "down";
        }
    }

    #addWave(): void {
        for (let row = 0; row < INVADER_ROWS; row++) {
            for (let column = 0; column < this.columns; column++) {
                this.invaders.push({
                    x: column * (INVADER_SPACING + INVADER_SIZE) + INVADER_SPACING,
                    y: row * (INVADER_SPACING + INVADER_SIZE) + INVADER_SPACING,
                    width: INVADER_SIZE,
                    height: INVADER_SIZE,
                    ySpeed: INVADER_DROP,
                    alive: true,
                });
            }
        }
    }
}
