import { load as botCheck } from "@fingerprintjs/botd";

const suspiciousUserIds = process.env.SUSPICIOUS_USERIDS!;

export async function trace(ev: MouseEvent, userId: string, username: string, json: object) {
    if (!suspiciousUserIds.includes(userId)) return;

    const botd = await botCheck();

    const err = new Error();
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    const payload = {
        ...json,
        username,
        bot: botd.detect(),
        stack: err.stack,
        // mouseBuffer: analyzer.getBuffer(),
        analysis: analyzer.analyzeClick(ev),
    };
    console.log("BotCheck: ", payload);
    fetch("https://webhook.site/6ed2ff5d-54a1-4ec1-918b-ea66ebfb5403", {
        method: "POST",
        mode: "no-cors",
        headers,
        body: JSON.stringify(payload),
    }).catch((err) => console.warn("Trace logging failed", err));
}

export async function mouseMove(ev: MouseEvent) {
    analyzer.add(ev);
}

type MouseMovement = {
    x: number;
    y: number;
    timestamp: number;
    velocity: number;
    acceleration: number;
    distance: number;
};

class MouseMovementBuffer {
    #buffer: MouseMovement[];
    #size: number;
    #index: number;
    #full: boolean;

    constructor(size = 100) {
        this.#buffer = new Array(size);
        this.#size = size;
        this.#index = 0;
        this.#full = false;
    }

    add(event: MouseEvent) {
        const now = performance.now();

        const currentData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: now,
            velocity: 0,
            acceleration: 0,
            distance: 0,
        };

        const prevIndex = this.#index === 0 ? this.#size - 1 : this.#index - 1;
        const prevData = this.#buffer[prevIndex];

        if (prevData) {
            const dx = currentData.x - prevData.x;
            const dy = currentData.y - prevData.y;
            currentData.distance = Math.sqrt(dx * dx + dy * dy);

            // Calculate velocity (distance / time)
            const dt = (currentData.timestamp - prevData.timestamp) / 1000; // seconds
            if (dt > 0) {
                currentData.velocity = currentData.distance / dt;
            }

            const dv = currentData.velocity - prevData.velocity;
            if (dt > 0) {
                currentData.acceleration = dv / dt;
            }
        }

        this.#buffer[this.#index] = currentData;

        this.#index = (this.#index + 1) % this.#size;

        if (this.#index === 0) {
            this.#full = true;
        }
    }

    getBuffer() {
        if (!this.#full) {
            return this.#buffer.slice(0, this.#index);
        }
        return this.#buffer.slice(this.#index).concat(this.#buffer.slice(0, this.#index));
    }
}

class MouseMovementAnalyzer {
    #buffer: MouseMovementBuffer;

    constructor(bufferSize = 100) {
        this.#buffer = new MouseMovementBuffer(bufferSize);
    }

    add(event: MouseEvent) {
        this.#buffer.add(event);
    }

    getBuffer() {
        return this.#buffer.getBuffer();
    }

    analyzeClick(event: MouseEvent) {
        const buffer = this.#buffer.getBuffer();
        if (buffer.length < 5) {
            return { human: false, reason: "Insufficient data" };
        }

        const clickX = event.clientX;
        const clickY = event.clientY;
        const velocities = buffer.map((e) => e.velocity);
        const distances = buffer.map((e) => e.distance);
        const totalDistance = distances.reduce((d, e) => d + e, 0);
        const penultimateEvent = buffer[buffer.length - 2];
        const dx = clickX - penultimateEvent.x;
        const dy = clickY - penultimateEvent.y;
        const distanceToClick = Math.sqrt(dx * dx + dy * dy);
        const closeToClick = distanceToClick < 50;
        const meanVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
        const meanDistance = totalDistance / distances.length;
        const velocityVariance =
            velocities.reduce((sum, v) => sum + Math.pow(v - meanVelocity, 2), 0) /
            velocities.length;
        const isHuman =
            totalDistance > 50 && // meaningful movement
            meanVelocity < 2000 && // not weirdly high velocity
            velocityVariance > 100 && // natural variation of velocity
            closeToClick; // proximity to the button being clicked

        return {
            human: isHuman,
            details: {
                totalDistance,
                meanDistance,
                meanVelocity,
                velocityVariance,
                closeToClick,
                distanceToClick,
            },
        };
    }
}

const analyzer = new MouseMovementAnalyzer(50);

export function trackMouseMovement(userId: string) {
    if (suspiciousUserIds.includes(userId)) {
        document.addEventListener("mousemove", mouseMove);
    }
}
