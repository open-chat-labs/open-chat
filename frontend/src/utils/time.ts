export type CountdownData = {
    total: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
};

export function startsInFromSeconds(totalSeconds: number): CountdownData {
    const total = totalSeconds * 1000;
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    return {
        total,
        days,
        hours,
        minutes,
        seconds,
    };
}

export function startsIn(now: number, time: number): CountdownData {
    const total = time - now;
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return {
        total,
        days,
        hours,
        minutes,
        seconds,
    };
}

export function formatTimeRemaining(now: number, deadline: number): string {
    function pad(num: number): string {
        return num.toString().padStart(2, "0");
    }

    const data = startsIn(now, deadline);
    return `${pad(data.days)}:${pad(data.hours)}:${pad(data.minutes)}:${pad(data.seconds)}`;
}

export function startsInFormatted({
    total,
    days,
    hours,
    minutes,
}: CountdownData): "days" | "hours" | "minutes" | "seconds" | "finished" {
    if (total < 0) return "finished";
    if (days > 0) {
        return "days";
    }
    if (hours > 0) {
        return "hours";
    }
    if (minutes > 0) {
        return "minutes";
    }
    return "seconds";
}
