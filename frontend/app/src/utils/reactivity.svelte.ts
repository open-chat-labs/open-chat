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
