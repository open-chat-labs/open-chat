import { elasticOut } from "svelte/easing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pop(_node: any, { duration }: any): { duration: any; css: (t: number) => string } {
    return {
        duration,
        css: (t: number) => {
            return `transform: scale(${elasticOut(t)});`;
        },
    };
}
