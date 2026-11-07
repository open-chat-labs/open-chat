/** What `observeRead` watches with: ChatEventList's message observer, and whether the row is read. */
export type ObserveReadArgs = { observer?: IntersectionObserver; read: boolean };

/**
 * A timeline row the reader hasn't read is watched (ChatEventList's message observer, which reads
 * the row's data-index / data-id) until it has been on screen long enough to count as read. A
 * Svelte action, for every tree's rows on ChatEventList.
 */
export function observeRead(node: HTMLElement, args: ObserveReadArgs) {
    let observer = args.observer;
    if (!args.read) observer?.observe(node);
    return {
        update(next: ObserveReadArgs) {
            if (next.read || next.observer !== observer) observer?.unobserve(node);
            observer = next.observer;
            if (!next.read) observer?.observe(node);
        },
        destroy: () => observer?.unobserve(node),
    };
}
