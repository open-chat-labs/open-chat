/**
 * Where a message list's floating date sits on the screen, which ChatEventList takes as
 * `stickyDateElTop` (VirtualChatList pins the day of the messages at that height there, and leaves
 * it to a day's own pill as that passes under it). Measured as it mounts and again whenever what
 * holds it changes size (a bar shown above the list, the window resized). A Svelte action, for
 * every new tree's message list.
 */
export function stickyDateTop(node: HTMLElement, onTop: (top: number) => void) {
    let report = onTop;
    const measure = () => report(node.getBoundingClientRect().top);
    measure();
    const observer = new ResizeObserver(measure);
    const area = node.parentElement;
    if (area !== null) observer.observe(area);
    return {
        update(next: (top: number) => void) {
            report = next;
        },
        destroy: () => observer.disconnect(),
    };
}
