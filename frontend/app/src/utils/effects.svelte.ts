/**
 * There is a risk that effects can run much more frequently than we expect.
 * This utility will warn us if the effect is running more often than we think is reasonable.
 */
export function trackedEffect(
    name: string,
    fn: () => void,
    options?: {
        maxCalls?: number;
        durationMs?: number;
    },
) {
    const { maxCalls = 5, durationMs = 1000 } = options ?? {};
    let callTimes: number[] = [];

    $effect(() => {
        const now = performance.now();
        callTimes.push(now);
        callTimes = callTimes.filter((t) => now - t < durationMs);

        if (callTimes.length > maxCalls) {
            console.warn(
                `[$effect: ${name}] triggered ${callTimes.length} times in the past ${durationMs}ms exceeding the limit of ${maxCalls}`,
            );
        }

        fn();
    });
}
