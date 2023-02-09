/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "remount/es5";

declare module "uuid" {
    export function v1(): string;
}

declare module "svelte-easy-crop" {
    import { SvelteComponentTyped } from "svelte";

    export interface CropperEvents {
        cropcomplete: CustomEvent<CropData>;
    }

    export type CropData = { pixels: { x: number; y: number; width: number; height: number } };

    export interface CropperProps {
        image?: string | null;
        cropSize?: { width: number; height: number };
        cropShape?: "rect" | "round";
    }
    export default class Cropper extends SvelteComponentTyped<CropperProps, CropperEvents> {}
}

declare module "svelte-qr";

declare module "svelte-confetti";

declare namespace svelte.JSX {
    interface HTMLAttributes<T> {
        onleftswipe?: any;
        onrightswipe?: any;
        onswiping?: any;
    }
}

declare global {
    interface Window {
        twttr: any;
        superAdmin: any;
    }
}
