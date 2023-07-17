import { elasticOut } from "svelte/easing";

type PopParams = {
    duration: number;
    transform?: string;
};

export function pop(
    _node: Element,
    { duration, transform }: PopParams
): { duration: number; css: (t: number) => string } {
    return {
        duration,
        css: (t: number) => {
            return `transform: ${transform} scale(${elasticOut(t)});`;
        },
    };
}
