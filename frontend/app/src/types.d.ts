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

        crop?: Point | undefined;
        zoom?: number | undefined;
        aspect?: number | undefined;
        minZoom?: number | undefined;
        maxZoom?: number | undefined;
        showGrid?: boolean | undefined;
        zoomSpeed?: number | undefined;
        crossOrigin?: HTMLImgAttributes["crossorigin"];
        restrictPosition?: boolean | undefined;
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
        platformModerator: any;
        platformOperator: any;
    }
}

declare function gtag(command: "event", name: "page_view", options?: any): void;
