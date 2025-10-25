import { tick } from "svelte";

export type TransitionType = "slide_left" | "slide_right" | "fade" | "modal_sheet";

export async function transition(types: TransitionType[], fn: () => void | Promise<void>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(document as any).startViewTransition) {
        fn();
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).startViewTransition({
        update: async () => {
            await fn();
            await tick();
        },
        types,
    });
}
