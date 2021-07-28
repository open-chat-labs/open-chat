import { elasticOut } from "svelte/easing";

type PopParams = {
    duration: number;
};

export function pop(
    _node: Element,
    { duration }: PopParams
): { duration: number; css: (t: number) => string } {
    return {
        duration,
        css: (t: number) => {
            return `transform: scale(${elasticOut(t)});`;
        },
    };
}
