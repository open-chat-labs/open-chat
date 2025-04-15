/**
 * This can be used to create a debounced $derived rune. You need to pass in a function the
 * returns all dependencies that you want this to react to (which is annoyingly manual), then
 * pass in the function that creates end result i.e. what you would have passed to $derive.by
 *
 * Example usage:
 * ==============
 * let errors = $derived.by(
 *     debouncedDerived(
 *        () => [$state.snapshot(candidate)],   // this is the (deep) dependency
 *        () => validateBot(candidate),         // this is the work we want to do
 *        500,                                  // this is the delay time in ms
 *        new Map(),                            // this is the initial value of the derived state
 *     ),
 * );
 */
export function debouncedDerived<T>(
    dependencies: () => void,
    action: () => Promise<T>,
    delay: number,
    initialValue: T,
) {
    let value = $state<T>(initialValue);
    let timer: number | undefined;
    $effect(() => {
        dependencies(); // subscribe to the dependencies (*this* is the hack)
        window.clearTimeout(timer);
        timer = window.setTimeout(async () => (value = await action()), delay);
        return () => clearTimeout(timer);
    });
    return () => value;
}

/**
 * This can be used with a derived expression to allow us to provide a custom equality check
 * to make sure that if the derived result has not actually changed we will return the existing
 * value. This will ensure that downstream effects will not fire unnecessarily. Would be much
 * nicer if svelte provided this capability directly
 */
export function withEqCheck<T>(
    next: () => T,
    eq: (a: T, b: T) => boolean = (a: T, b: T) => a === b,
): () => T {
    let prev: T | undefined = undefined;

    return () => {
        const n = next();
        if (prev === undefined) {
            prev = n;
            return n;
        } else {
            if (eq(prev as T, n)) {
                return prev as T;
            } else {
                prev = n;
                return n;
            }
        }
    };
}
