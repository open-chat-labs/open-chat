export function runOnceIdle(action: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
        const callback = () => action().finally(() => resolve());
        return "requestIdleCallback" in window
            ? window.requestIdleCallback(callback)
            : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              //@ts-ignore
              window.setTimeout(callback, 1000);
    });
}
