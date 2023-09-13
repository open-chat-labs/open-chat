export function runOnceIdle(action: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => window.requestIdleCallback(() => action().finally(() => resolve())));
}
